import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invokeClaudeJSON, invokeClaudeText, llmConfigured } from "@server/lib/anthropic.js";
import { emptyTrace, withUsageTracking } from "@server/lib/usageTracking.js";

const fetchMock = vi.fn();
const review = () => invokeClaudeJSON({ system: "PRIVATE_SYSTEM_CANARY", user: "PRIVATE_URL_CANARY", schema: { type: "object" } });
const helper = (model?: string) => invokeClaudeText({ system: "PRIVATE_SYSTEM_CANARY", messages: [{ role: "user", content: "PRIVATE_MESSAGE_CANARY" }], model });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "synthetic-test-key"); vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-5"); vi.stubEnv("ANTHROPIC_MODEL_CHAT", "claude-haiku-4-5-20251001");
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("provider attempts and measured usage", () => {
  it("records structured review usage including cache tokens without prompts, outputs or credentials", async () => {
    fetchMock.mockResolvedValue(json({ model: "claude-sonnet-5", usage: { input_tokens: 123, output_tokens: 17, cache_read_input_tokens: 20, cache_creation_input_tokens: 5 },
      content: [{ type: "tool_use", input: { result: "PRIVATE_OUTPUT_CANARY" } }] }));
    const trace = emptyTrace(), checkpoint = vi.fn();
    expect(await withUsageTracking(trace, review, checkpoint)).toEqual({ result: "PRIVATE_OUTPUT_CANARY" });
    expect(trace.models).toHaveLength(1); expect(trace.models[0]).toMatchObject({ provider: "anthropic", model: "claude-sonnet-5", stage: "review", status: "succeeded",
      inputTokens: 123, outputTokens: 17, cacheReadTokens: 20, cacheWriteTokens: 5 });
    expect(trace.models[0].durationMs).toBeGreaterThanOrEqual(0); expect(checkpoint).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(trace)).not.toMatch(/CANARY|synthetic-test-key/);
    const captured = checkpoint.mock.calls[0][0]; trace.models[0].inputTokens = 900; expect(captured.models[0].inputTokens).toBe(123);
  });
  it("retains measured failure tokens on a non-success HTTP response", async () => {
    fetchMock.mockResolvedValue(json({ usage: { input_tokens: 23, output_tokens: 4 }, error: { message: "PRIVATE_ERROR_CANARY" } }, 500));
    const trace = emptyTrace(); expect(await withUsageTracking(trace, review)).toBeNull();
    expect(trace.models[0]).toMatchObject({ status: "failed", stage: "review", inputTokens: 23, outputTokens: 4, cacheReadTokens: 0, cacheWriteTokens: 0 });
    expect(JSON.stringify(trace)).not.toContain("PRIVATE_ERROR_CANARY");
  });
  it("records a malformed successful response as failed while retaining provider token usage", async () => {
    fetchMock.mockResolvedValue(json({ usage: { input_tokens: 9, output_tokens: 2 }, content: [] }));
    const trace = emptyTrace(); expect(await withUsageTracking(trace, helper)).toBeNull();
    expect(trace.models[0]).toMatchObject({ status: "failed", stage: "helper", inputTokens: 9, outputTokens: 2 });
  });
  it.each(["no-usage", "invalid-tokens", "invalid-json", "network-failure"])("keeps unknown token amounts unknown for %s", async kind => {
    if (kind === "network-failure") fetchMock.mockRejectedValue(new Error("PRIVATE_NETWORK_CANARY"));
    else if (kind === "invalid-json") fetchMock.mockResolvedValue(new Response("not json"));
    else fetchMock.mockResolvedValue(json({ ...(kind === "invalid-tokens" ? { usage: { input_tokens: "12", output_tokens: -1, cache_read_input_tokens: 1.5, cache_creation_input_tokens: Number.MAX_SAFE_INTEGER + 1 } } : {}),
      content: [{ type: "text", text: "Synthetic answer" }] }));
    const trace = emptyTrace(); await withUsageTracking(trace, helper);
    expect(trace.models).toHaveLength(1); expect(trace.models[0]).toMatchObject({ inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null });
  });
  it.each(["gpt-6-astra", "claude-sonnet-astra", "claude-sonnet-5\nPRIVATE_MODEL_CANARY", "https://attacker.example/PRIVATE_MODEL_CANARY"])("blocks configured review and helper model %s before fetch", async model => {
    vi.stubEnv("ANTHROPIC_MODEL", model); const trace = emptyTrace();
    expect(await withUsageTracking(trace, review)).toBeNull(); expect(await withUsageTracking(trace, () => helper(model))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled(); expect(trace.models).toHaveLength(2);
    expect(trace.models.map(attempt => attempt.status)).toEqual(["blocked", "blocked"]);
    expect(trace.models.every(attempt => attempt.inputTokens === null && attempt.outputTokens === null)).toBe(true);
    expect(JSON.stringify(trace)).not.toContain("PRIVATE_MODEL_CANARY");
  });
  it("keeps concurrent review and helper traces isolated when responses arrive out of order", async () => {
    const pending = new Map<string, (response: Response) => void>();
    fetchMock.mockImplementation((_url, options) => new Promise<Response>(resolve => pending.set(JSON.parse(options.body).model, resolve)));
    const reviewTrace = emptyTrace(), helperTrace = emptyTrace();
    const reviewResult = withUsageTracking(reviewTrace, review), helperResult = withUsageTracking(helperTrace, helper);
    pending.get("claude-haiku-4-5-20251001")!(json({ usage: { input_tokens: 7, output_tokens: 3 }, content: [{ type: "text", text: "Helper answer" }] }));
    expect(await helperResult).toBe("Helper answer"); expect(reviewTrace.models).toEqual([]);
    pending.get("claude-sonnet-5")!(json({ usage: { input_tokens: 99, output_tokens: 11 }, content: [{ type: "tool_use", input: { okay: true } }] }));
    await reviewResult;
    expect(reviewTrace.models).toHaveLength(1); expect(helperTrace.models).toHaveLength(1);
    expect(reviewTrace.models[0]).toMatchObject({ stage: "review", inputTokens: 99 }); expect(helperTrace.models[0]).toMatchObject({ stage: "helper", inputTokens: 7 });
  });
  it("does not call or record a provider attempt when no API key is configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", ""); const trace = emptyTrace(); expect(llmConfigured()).toBe(false);
    expect(await withUsageTracking(trace, review)).toBeNull(); expect(await withUsageTracking(trace, helper)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled(); expect(trace.models).toEqual([]);
  });
});
