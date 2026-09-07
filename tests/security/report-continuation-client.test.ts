import { describe, expect, it, vi } from "vitest";
import {
  continueSavedReport,
  reportSignInMessage,
} from "@/lib/reportContinuation";

const reportId = "synthetic-report-123";
const saved = { id: reportId, report: { categories: [] } };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function setup(replies: Response[], canClaimGuestReport = true) {
  const controller = new AbortController();
  const state = { uid: "account-one" as string | null };
  const request = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      replies.shift() ?? response({}, 500)
  );
  const dependencies = {
    currentUid: () => state.uid,
    getHeaders: vi.fn(async () => ({
      Authorization: "Bearer synthetic-verified-token",
    })),
    request: request as unknown as typeof fetch,
  };
  const input = {
    reportId,
    accountUid: "account-one",
    canClaimGuestReport,
    signal: controller.signal,
  };
  return { controller, state, request, dependencies, input };
}

describe("exact saved-report account continuation", () => {
  it("opens an already-owned report without claiming or grading", async () => {
    const t = setup([response(saved)]);
    await expect(continueSavedReport(t.input, t.dependencies)).resolves.toEqual(
      saved
    );
    expect(t.request).toHaveBeenCalledTimes(1);
    expect(t.request.mock.calls[0]?.[0]).toBe(`/api/audits/${reportId}`);
  });
  it("claims only the selected guest report, then GETs that same report", async () => {
    const t = setup([
      response({}, 404),
      response({ reportId }),
      response(saved),
    ]);
    await expect(continueSavedReport(t.input, t.dependencies)).resolves.toEqual(
      saved
    );
    const calls = t.request.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([path, init]) => [path, init.method ?? "GET"])).toEqual([
      [`/api/audits/${reportId}`, "GET"],
      ["/api/report-claims", "POST"],
      [`/api/audits/${reportId}`, "GET"],
    ]);
    expect(JSON.parse(String(calls[1][1].body))).toEqual({ reportId });
    expect(calls.every(([, init]) => init.credentials === "same-origin")).toBe(
      true
    );
  });
  it("does not try to claim a missing non-guest account report", async () => {
    const t = setup([response({}, 404)], false);
    await expect(
      continueSavedReport(t.input, t.dependencies)
    ).rejects.toMatchObject({ code: "report_unavailable" });
    expect(t.request).toHaveBeenCalledTimes(1);
  });
  it("never downgrades token failures to an anonymous request", async () => {
    const t = setup([]);
    t.dependencies.getHeaders.mockRejectedValueOnce(
      new Error("token unavailable")
    );
    await expect(continueSavedReport(t.input, t.dependencies)).rejects.toThrow(
      "token unavailable"
    );
    expect(t.request).not.toHaveBeenCalled();
    t.dependencies.getHeaders.mockResolvedValueOnce(
      {} as { Authorization: string }
    );
    await expect(
      continueSavedReport(t.input, t.dependencies)
    ).rejects.toMatchObject({ code: "sign_in_required" });
    expect(t.request).not.toHaveBeenCalled();
  });
  it("does not claim after account identity changes during the first read", async () => {
    const t = setup([]);
    t.request.mockImplementationOnce(async () => {
      t.state.uid = "account-two";
      return response({}, 404);
    });
    await expect(
      continueSavedReport(t.input, t.dependencies)
    ).rejects.toMatchObject({ code: "account_changed" });
    expect(t.request).toHaveBeenCalledTimes(1);
  });
  it("discards a returned report after sign-out", async () => {
    const t = setup([]);
    t.request.mockImplementationOnce(async () => {
      t.state.uid = null;
      return response(saved);
    });
    await expect(
      continueSavedReport(t.input, t.dependencies)
    ).rejects.toMatchObject({ code: "account_changed" });
  });
  it("cancellation prevents the post-claim read without starting a review", async () => {
    const t = setup([response({}, 404)]);
    t.request
      .mockImplementationOnce(async () => response({}, 404))
      .mockImplementationOnce(async () => {
        t.controller.abort();
        return response({ reportId });
      });
    await expect(
      continueSavedReport(t.input, t.dependencies)
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(t.request).toHaveBeenCalledTimes(2);
  });
  it("rejects a mismatched claim ID and does not read another report", async () => {
    const t = setup([
      response({}, 404),
      response({ reportId: "other-report" }),
    ]);
    await expect(
      continueSavedReport(t.input, t.dependencies)
    ).rejects.toMatchObject({ code: "invalid_claim" });
    expect(t.request).toHaveBeenCalledTimes(2);
  });
  it("rejects a mismatched report response", async () => {
    const t = setup([response({ ...saved, id: "other-report" })]);
    await expect(
      continueSavedReport(t.input, t.dependencies)
    ).rejects.toMatchObject({ code: "invalid_report" });
  });
  it("does not expose a foreign-owner reason in claim errors", async () => {
    const t = setup([
      response({}, 404),
      response({ reason: "private-account@example.invalid" }, 404),
    ]);
    await expect(
      continueSavedReport(t.input, t.dependencies)
    ).rejects.toMatchObject({ code: "claim_unavailable" });
  });
  it("offers Google sign-in for a verified account using an ineligible provider", async () => {
    const t = setup([
      response({}, 404),
      response({ error: "google_account_required" }, 403),
    ]);
    await expect(
      continueSavedReport(t.input, t.dependencies)
    ).rejects.toMatchObject({ code: "google_account_required" });
    expect(t.request).toHaveBeenCalledTimes(2);
  });
  it("rejects invalid IDs before any request", async () => {
    const t = setup([]);
    await expect(
      continueSavedReport(
        { ...t.input, reportId: "../../other" },
        t.dependencies
      )
    ).rejects.toMatchObject({ code: "invalid_report" });
    expect(t.request).not.toHaveBeenCalled();
  });
  it("keeps popup cancellation and blocking messages actionable", () => {
    expect(reportSignInMessage({ code: "auth/popup-blocked" })).toContain(
      "Allow pop-ups"
    );
    expect(
      reportSignInMessage({ code: "auth/popup-closed-by-user" })
    ).toContain("Your report is still here");
  });
});
