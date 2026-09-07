/* Fetch-only Anthropic client. Missing/failed enrichment retains deterministic scoring. */
import { assertCustomerModelAllowed } from "./customerModelPolicy.js";
import { measuredTokens, recordModelUsage, type ModelUsage } from "./usageTracking.js";
const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";
export function llmConfigured(): boolean { return Boolean(process.env.ANTHROPIC_API_KEY); }
interface MessageResponse { model?: string; usage?: Record<string, unknown>; content?: Array<{ type: string; text?: string; input?: unknown }>; }
async function invoke(body: Record<string, unknown>, stage: ModelUsage["stage"], timeout: number): Promise<MessageResponse | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = String(body.model);
  const started = Date.now();
  let status: ModelUsage["status"] = "blocked";
  let data: MessageResponse | null = null;
  try {
    assertCustomerModelAllowed({ provider: "anthropic", model, stage });
    status = "failed";
    const response = await fetch(API_URL, { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
    data = await response.json().catch(() => null) as MessageResponse | null;
    if (!response.ok) { console.warn(`[LLM] Anthropic ${stage} ${response.status}`); return null; }
    if (!data || !Array.isArray(data.content) || !data.content.some(part => stage === "review" ? part.type === "tool_use" && part.input !== undefined : part.type === "text" && typeof part.text === "string")) return null;
    status = "succeeded";
    return data;
  } catch { console.warn(`[LLM] ${stage} unavailable`); return null; }
  finally {
    const usage = data?.usage;
    recordModelUsage({ provider: "anthropic", model: typeof data?.model === "string" && /^claude-[a-zA-Z0-9.-]{1,90}$/.test(data.model) ? data.model : /^claude-[a-zA-Z0-9.-]{1,90}$/.test(model) ? model : "blocked-model", stage, status,
      inputTokens: measuredTokens(usage?.input_tokens), outputTokens: measuredTokens(usage?.output_tokens),
      cacheReadTokens: usage ? measuredTokens(usage.cache_read_input_tokens ?? 0) : null,
      cacheWriteTokens: usage ? measuredTokens(usage.cache_creation_input_tokens ?? 0) : null,
      durationMs: Date.now() - started });
  }
}
export async function invokeClaudeText(params: { system: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens?: number; model?: string }): Promise<string | null> {
  const data = await invoke({ model: params.model || process.env.ANTHROPIC_MODEL_CHAT || "claude-haiku-4-5-20251001", max_tokens: params.maxTokens ?? 500, system: params.system, messages: params.messages }, "helper", 30_000);
  return data?.content?.find(part => part.type === "text")?.text ?? null;
}
export async function invokeClaudeJSON(params: { system: string; user: string; schema: Record<string, unknown>; maxTokens?: number }): Promise<unknown | null> {
  const data = await invoke({ model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL, max_tokens: params.maxTokens ?? 4_000, system: params.system,
    messages: [{ role: "user", content: params.user }], tools: [{ name: "audit_result", strict: true, description: "Return the improved portfolio audit report.", input_schema: params.schema }], tool_choice: { type: "tool", name: "audit_result" } }, "review", 90_000);
  return data?.content?.find(part => part.type === "tool_use")?.input ?? null;
}
