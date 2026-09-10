import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ACCESS_POLICY, type AuditReport } from "@shared/audit.js";
import type { RenderedReview } from "@shared/renderedEvidence.js";
import { RUBRIC_VERSION } from "@shared/rubrics.js";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), render: vi.fn(), llm: vi.fn() }));
vi.mock("@server/lib/publicNetwork.js", async original => ({ ...await original<any>(), publicFetch: mocks.fetch,
  resolvePublic: vi.fn().mockResolvedValue({ address: "93.184.216.34", family: 4 }) }));
vi.mock("@server/lib/renderedReview.js", () => ({ collectRenderedReview: mocks.render }));
vi.mock("@server/lib/anthropic.js", () => ({ invokeClaudeJSON: mocks.llm, llmConfigured: () => true }));
const { runPortfolioAudit } = await import("@server/lib/auditEngine.js");
const { acceptedEvidenceFor, ASSESSMENT_METHOD_VERSION, materialHtmlFingerprint, reuseAcceptedAssessment } = await import("@server/lib/assessmentReuse.js");
const { selectStandouts } = await import("@server/lib/standoutPolicy.js");
const { redactReport } = await import("@server/lib/reportAccess.js");
const { assertCustomerModelAllowed } = await import("@server/lib/customerModelPolicy.js");
const { secureStore } = await import("@server/lib/secureStore.js");
const { recordAuditInDocument, getHistory, redactPremium } = await import("@server/lib/historyStore.js");
const url = "https://example.org/";
const role = "Marketing";
const html = '<html><head><title>Portfolio from a marketer</title><meta name="description" content="Selected marketing projects, measurable outcomes and contact details."><meta name="viewport" content="width=device-width"></head><body><main><h1>I am a marketing designer</h1><h2>Selected projects</h2><p>I launched a project and increased sales 20%. About me and my marketing work.</p><a href="mailto:example@example.org">Contact me</a></main></body></html>';
function rendered(hash = "a".repeat(64)): RenderedReview {
  const observations = { layoutViewport: { width: 1440, height: 900 }, document: { width: 1440, height: 900 }, horizontalOverflowPx: 0,
    elementsExamined: 3, sampleTruncated: false, headings: { visible: 1, examples: [] }, contact: { visibleCandidates: 1, examples: [] },
    targets: { visible: 1, below44: 0, examples: [] }, contrast: { tested: 1, belowThreshold: 0, skippedComplex: 0, examples: [] } };
  const device = { status: "captured" as const, capture: { capturedAt: "2026-09-06T00:00:00Z", finalUrl: url,
    viewport: { width: 1440, height: 900 }, imageSha256: hash, imageRef: `${hash}.jpg`, imageChanged: false }, observations };
  return { version: "1", method: "chromium-dom", scope: "homepage-first-viewport", status: "complete", devices: { web: device, mobile: structuredClone(device) }, limitations: [] };
}
function report(): AuditReport {
  const evidence = acceptedEvidenceFor({ url, role, desktop: { html, finalUrl: url }, mobile: { html, finalUrl: url }, rendered: rendered() })!;
  return { url, role, generatedAt: "2026-09-06T00:00:00Z", overall: 80, overallGrade: "B", headline: "PRIVATE_D_SUMMARY", subhead: "PRIVATE_D_SUBHEAD",
    bounceEstimate: 0, bounceTarget: 0, loadDesktopMs: 0, loadMobileMs: 0, accessPolicy: ACCOUNT_ACCESS_POLICY, acceptedEvidence: evidence,
    assessment: { methodVersion: ASSESSMENT_METHOD_VERSION, status: "new", evidenceStatus: "complete", acceptedAt: "2026-09-06T00:00:00Z", checkedAt: "2026-09-06T00:00:00Z" },
    categories: [
      { key: "accessibility", title: "Accessibility", blurb: "PRIVATE_D_BLURB", score: 50, grade: "D", premium: false, details: [{ label: "Private D label", status: "fail", note: "PRIVATE_D_NOTE" }], recommendation: "PRIVATE_D_FIX" },
      { key: "conversion", title: "Contact path", blurb: "Contact", score: 95, grade: "A+", premium: false, details: [{ label: "Email in HTML", status: "pass", note: "The HTML contains an email link." }], recommendation: "Keep checking your email link." },
      { key: "mobile", title: "Phone experience", blurb: "Phone", score: 99, grade: "A+", premium: false, details: [{ label: "Viewport", status: "pass", note: "Source declares device width." }], recommendation: "Check phone layout." },
    ],
    topFixes: [{ title: "PRIVATE_D_FIX", description: "PRIVATE_D_DESCRIPTION", impact: "High", premium: false, categoryKey: "accessibility" }],
    verification: { mode: "homepage-html", rubricKey: "marketing", rubricVersion: RUBRIC_VERSION, pageCount: 1,
      pages: [{ url, status: 200, device: "desktop-user-agent" }], visualReview: false, mobileLayoutReviewed: false, performanceMeasured: false,
      deepReviewVerified: false, aiEnrichment: "not-configured", limitations: [] }, rendered: rendered(),
    standouts: { version: "relative-v1", status: "available", items: [{ categoryKey: "conversion", title: "PRIVATE_STANDOUT_TITLE", score: 95, grade: "A+",
      explanation: "PRIVATE_STANDOUT_NOTE", evidenceScope: "homepage-html", remainingIssues: true }] } };
}
beforeEach(() => {
  mocks.fetch.mockReset().mockImplementation(async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }));
  mocks.render.mockReset().mockImplementation(async () => rendered());
  mocks.llm.mockReset().mockResolvedValue(null);
  secureStore.update(store => { store.audits = {}; store.histories = {}; store.quotas = {}; });
});

describe("accepted assessment reuse before enrichment", () => {
  it("refreshes source and browser evidence then reuses the accepted grade, explanations and original capture", async () => {
    const first = await runPortfolioAudit({ url, role, isPro: false });
    expect(first.acceptedEvidence).toBeDefined(); expect(mocks.llm).toHaveBeenCalledTimes(1);
    expect(mocks.render.mock.invocationCallOrder[0]).toBeLessThan(mocks.llm.mock.invocationCallOrder[0]);
    const next = await runPortfolioAudit({ url, role, isPro: false, previousAccepted: { id: "accepted", report: first } });
    expect(mocks.fetch).toHaveBeenCalledTimes(4); expect(mocks.render).toHaveBeenCalledTimes(2); expect(mocks.llm).toHaveBeenCalledTimes(1);
    expect(next.assessment).toMatchObject({ status: "reused", previousReportId: "accepted" });
    expect(next.categories).toEqual(first.categories); expect(next.generatedAt).toBe(first.generatedAt); expect(next.rendered).toEqual(first.rendered);
  });
  it("ignores known tracking/nonce noise but preserves visible dates, styles, images, projects and content after the scoring excerpt", () => {
    expect(materialHtmlFingerprint('<p nonce="a" data-tracking-time="1">Work</p>')).toBe(materialHtmlFingerprint('<p nonce="b" data-tracking-time="2">Work</p>'));
    for (const [before, after] of [["2025", "2026"], ['src="a.jpg"', 'src="b.jpg"'], ['href="/project-a"', 'href="/project-b"'], ['color:red', 'color:blue']])
      expect(materialHtmlFingerprint(before)).not.toBe(materialHtmlFingerprint(after));
    const prefix = "x".repeat(700_010); expect(materialHtmlFingerprint(prefix + "a")).not.toBe(materialHtmlFingerprint(prefix + "b"));
  });
  it("changed screenshot, role or method requires a new assessment rather than reusing a numeric floor", async () => {
    const first = await runPortfolioAudit({ url, role, isPro: false });
    mocks.render.mockResolvedValue(rendered("b".repeat(64)));
    const changed = await runPortfolioAudit({ url, role, isPro: false, previousAccepted: { id: "old", report: first } });
    expect(changed.assessment?.status).toBe("new"); expect(mocks.llm).toHaveBeenCalledTimes(2);
    expect(reuseAcceptedAssessment({ id: "old", report: first }, first.acceptedEvidence, { url, role: "Architecture" })).toBeNull();
    expect(reuseAcceptedAssessment({ id: "old", report: first }, { ...first.acceptedEvidence!, methodVersion: "next-method" }, { url, role })).toBeNull();
  });
  it("checks the full downloaded HTML after the 700,000-character scoring excerpt", async () => {
    let tail = "first project";
    mocks.fetch.mockImplementation(async () => new Response(html + " ".repeat(700_010) + tail, { status: 200, headers: { "content-type": "text/html" } }));
    const first = await runPortfolioAudit({ url, role, isPro: false }); tail = "changed project";
    const changed = await runPortfolioAudit({ url, role, isPro: false, previousAccepted: { id: "old", report: first } });
    expect(changed.assessment?.status).toBe("new"); expect(mocks.llm).toHaveBeenCalledTimes(2);
  });
  it("partial capture or a failed refetch preserves accepted content without a model call or a replacement grade", async () => {
    const first = await runPortfolioAudit({ url, role, isPro: false });
    const partial = rendered(); partial.status = "partial"; partial.devices.mobile = { status: "unavailable", reason: "capture_failed" };
    mocks.render.mockResolvedValue(partial);
    const preserved = await runPortfolioAudit({ url, role, isPro: false, previousAccepted: { id: "old", report: first } });
    expect(preserved.assessment?.status).toBe("previous-preserved"); expect(preserved.overall).toBe(first.overall); expect(mocks.llm).toHaveBeenCalledTimes(1);
    mocks.fetch.mockRejectedValue(new Error("fixture failure"));
    const failure = await runPortfolioAudit({ url, role, isPro: false, previousAccepted: { id: "old", report: first } });
    expect(failure.assessment?.status).toBe("previous-preserved"); expect(failure.categories).toEqual(first.categories); expect(mocks.llm).toHaveBeenCalledTimes(1);
  });
  it("preserves an old accepted HTML report on failure without adopting the new account policy", () => {
    const old = report(); delete old.accessPolicy; delete old.acceptedEvidence; delete old.assessment;
    old.sourceSnapshot = { version: 1, capturedAt: old.generatedAt, desktop: { finalUrl: url, sha256: "a".repeat(64) }, mobile: { finalUrl: url, sha256: "a".repeat(64) } };
    const preserved = reuseAcceptedAssessment({ id: "legacy", report: old }, undefined, { url, role });
    expect(preserved?.assessment?.status).toBe("previous-preserved"); expect(preserved?.accessPolicy).toBeUndefined();
    expect(reuseAcceptedAssessment({ id: "legacy", report: old }, report().acceptedEvidence, { url, role })).toBeNull();
  });
  it("a first partial preview is honest and cannot become a reuse baseline or hidden standout", async () => {
    const partial = rendered(); partial.status = "partial";
    mocks.render.mockResolvedValue(partial);
    const first = await runPortfolioAudit({ url, role, isPro: false });
    expect(first.assessment).toMatchObject({ status: "new", evidenceStatus: "partial" }); expect(first.acceptedEvidence).toBeUndefined();
    expect(first.standouts).toEqual({ version: "relative-v1", status: "unavailable", items: [] }); expect(mocks.llm).not.toHaveBeenCalled();
  });
});

describe("versioned account and standout access", () => {
  it("omits D content, summaries and actual standout details from guest payloads without mutating the stored report", () => {
    const original = report(), before = structuredClone(original), response = redactReport(original, false);
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("PRIVATE_D_"); expect(serialized).not.toContain("PRIVATE_STANDOUT_"); expect(response.acceptedEvidence).toBeUndefined();
    expect(response.categories[0]).toMatchObject({ title: "Accessibility", grade: "D", score: 50, access: "free-account-required", details: [] });
    expect(response.standouts).toEqual({ version: "relative-v1", status: "pro-required", items: [], teaser: "Unlock" }); expect(original).toEqual(before);
    expect(response.rendered?.devices.web.observations).toBeUndefined();
    expect(redactReport(response, false)).toEqual(response);
  });
  it("free verified sign-in opens D, Pro alone reveals the standout, and historic reports keep their prior policy", () => {
    expect(redactReport(report(), false, true).categories[0]).toMatchObject({ access: "open", recommendation: "PRIVATE_D_FIX" });
    expect(redactReport(report(), false, true).standouts?.items).toEqual([]);
    expect(redactReport(report(), true, true).standouts?.items[0].explanation).toBe("PRIVATE_STANDOUT_NOTE");
    const legacy = report(); delete legacy.accessPolicy; delete legacy.standouts;
    expect(redactReport(legacy, false).categories[0].recommendation).toBe("PRIVATE_D_FIX");
  });
  it("selects the strongest assessed HTML category while leaving scores and weaknesses intact", () => {
    const original = report(), before = structuredClone(original), selected = selectStandouts(original);
    expect(selected.items[0]).toMatchObject({ categoryKey: "conversion", score: 95, grade: "A+", remainingIssues: true });
    expect(selected.items[0].explanation).toContain("not a visual or whole-portfolio judgment"); expect(original).toEqual(before);
    delete original.acceptedEvidence; expect(selectStandouts(original).status).toBe("unavailable");
  });
});

describe("honest current grade, persistent best milestones and history redaction", () => {
  function save(id: string, value: AuditReport) {
    return secureStore.update(store => { store.audits[id] = { id, ownerId: "user:owner", url, role, report: value };
      return recordAuditInDocument(store, "user:owner", value, id, false, undefined, `2026-09-06T00:00:0${id.length}Z`); });
  }
  it("a real regression lowers current but leaves best; changed methods keep separate milestones and duplicate IDs do not count", () => {
    const first = report(); first.overall = 90; first.overallGrade = "A"; save("a", first);
    const later = report(); later.overall = 70; later.overallGrade = "C"; save("bb", later); save("bb", later);
    const history = getHistory(url, "user:owner", role)!;
    expect(history.runs).toHaveLength(2); expect(history.currentAssessment?.overall).toBe(70); expect(history.bestAchieved).toMatchObject({ reportId: "a", overall: 90 });
    later.assessment!.methodVersion = "new-visual-method"; save("ccc", later);
    expect(getHistory(url, "user:owner", role)?.milestones).toHaveLength(2);
    expect(getHistory(url, "user:owner", role)?.bestAchieved?.methodVersion).toBe("new-visual-method");
  });
  it("does not leak a gated fix through aggregate history, and sign-in restores the original text", () => {
    const history = save("a", report());
    expect(JSON.stringify(redactPremium(history, false))).not.toContain("PRIVATE_D_");
    expect(JSON.stringify(redactPremium(history, false, true))).toContain("PRIVATE_D_DESCRIPTION");
    expect(Object.values(history.suggestions)[0].auditIds).toEqual(["a"]);
  });
});

describe("customer provider policy", () => {
  it.each(["claude-sonnet-5", "claude-haiku-4-5-20251001"])("keeps existing Anthropic model family %s", model => expect(() => assertCustomerModelAllowed({ provider: "anthropic", model })).not.toThrow());
  it.each(["gpt-6-astra", "claude-sonnet-astra", "ASTRA", "gpt-5.6-luna", "unknown", "claude-sonnet-5 "])("blocks an ineligible primary, retry or helper model %s", model => {
    for (const stage of ["primary", "retry", "fallback", "helper"]) expect(() => assertCustomerModelAllowed({ provider: "anthropic", model, stage })).toThrow("blocked");
  });
  it("does not enable an unapproved provider even with a similar model name", () => expect(() => assertCustomerModelAllowed({ provider: "openai", model: "claude-sonnet-5" })).toThrow());
});
