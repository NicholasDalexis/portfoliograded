import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import type { AcceptedAssessmentEvidence, AuditReport } from "../../shared/audit.js";
import type { RenderedReview } from "../../shared/renderedEvidence.js";
import { renderedObservationsSchema } from "../../shared/renderedEvidence.js";
import { RUBRIC_VERSION, GENERAL_RUBRIC, rubricForRole } from "../../shared/rubrics.js";

export const ASSESSMENT_METHOD_VERSION = "homepage-bounded-evidence-v2";
export type PreviousAcceptedAssessment = { id: string; report: AuditReport };
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function assessmentUrlKey(raw: string): string {
  const url = new URL(raw); url.hash = ""; return url.toString();
}
/** Only known non-content attributes are ignored. Visible dates and script/style content remain. */
export function materialHtmlFingerprint(html: string): string {
  const $ = load(html);
  $("*").each((_index, element) => {
    if (!("attribs" in element)) return;
    for (const key of Object.keys(element.attribs ?? {})) {
      if (key === "nonce" || /^data-(tracking|analytics)-/.test(key)) $(element).removeAttr(key);
    }
  });
  return digest($.html());
}

export function acceptedEvidenceFor(input: {
  url: string; role: string; desktop: { html: string; finalUrl: string; materialSha256?: string }; mobile: { html: string; finalUrl: string; materialSha256?: string };
  rendered: RenderedReview; methodVersion?: string;
}): AcceptedAssessmentEvidence | undefined {
  if (input.rendered.status !== "complete" || input.rendered.version !== "1" || input.rendered.scope !== "homepage-first-viewport") return undefined;
  const devices = [];
  for (const device of ["web", "mobile"] as const) {
    const result = input.rendered.devices[device];
    if (result?.status !== "captured" || !result.capture || !/^[a-f0-9]{64}$/.test(result.capture.imageSha256)) return undefined;
    const parsed = renderedObservationsSchema.safeParse(result.observations);
    if (!parsed.success) return undefined;
    devices.push({ device, finalUrl: result.capture.finalUrl, viewport: result.capture.viewport,
      imageSha256: result.capture.imageSha256, observations: parsed.data });
  }
  const rubric = rubricForRole(input.role) ?? GENERAL_RUBRIC;
  const settings = { methodVersion: input.methodVersion ?? ASSESSMENT_METHOD_VERSION,
    scope: "homepage-html-and-first-viewport" as const, rubricKey: rubric.key, rubricVersion: RUBRIC_VERSION,
    roleKey: input.role.trim().toLowerCase() || "creative", url: assessmentUrlKey(input.url) };
  return { version: 1, ...settings, fingerprint: digest({ ...settings,
    desktop: { finalUrl: input.desktop.finalUrl, html: input.desktop.materialSha256 ?? materialHtmlFingerprint(input.desktop.html) },
    mobile: { finalUrl: input.mobile.finalUrl, html: input.mobile.materialSha256 ?? materialHtmlFingerprint(input.mobile.html) }, devices }) };
}

export function previousMatchesRequest(previous: PreviousAcceptedAssessment | undefined, url: string, role: string): previous is PreviousAcceptedAssessment {
  const evidence = previous?.report.acceptedEvidence;
  if (!previous) return false;
  const roleKey = role.trim().toLowerCase() || "creative";
  if (!evidence) {
    // Historical accepted HTML reports can be preserved on a failed new check,
    // but cannot be reused without the new complete evidence fingerprint.
    return !previous.report.accessPolicy && Boolean(previous.report.sourceSnapshot) && previous.report.verification?.mode === "homepage-html" &&
      previous.report.verification.pages.length > 0 && previous.report.verification.pages.every(page => page.status >= 200 && page.status < 300) &&
      assessmentUrlKey(previous.report.url) === assessmentUrlKey(url) && (previous.report.role.trim().toLowerCase() || "creative") === roleKey;
  }
  if (evidence.version !== 1 || previous.report.assessment?.evidenceStatus !== "complete") return false;
  return evidence.url === assessmentUrlKey(url) && evidence.roleKey === roleKey;
}

/** Returns accepted content with its original dates/images; the new check is separate metadata. */
export function reuseAcceptedAssessment(previous: PreviousAcceptedAssessment | undefined, evidence: AcceptedAssessmentEvidence | undefined,
  input: { url: string; role: string; checkedAt?: string }): AuditReport | null {
  if (!previousMatchesRequest(previous, input.url, input.role)) return null;
  const before = previous.report.acceptedEvidence;
  if (evidence && (!before || before.methodVersion !== evidence.methodVersion || before.rubricVersion !== evidence.rubricVersion ||
      before.rubricKey !== evidence.rubricKey || before.fingerprint !== evidence.fingerprint)) return null;
  const report = structuredClone(previous.report);
  report.assessment = { methodVersion: report.assessment?.methodVersion ?? `legacy-homepage-html-rubric-${report.verification?.rubricVersion ?? "unknown"}`,
    acceptedAt: report.assessment?.acceptedAt ?? report.generatedAt, status: evidence ? "reused" : "previous-preserved",
    evidenceStatus: "complete", checkedAt: input.checkedAt ?? new Date().toISOString(), previousReportId: previous.id };
  return report;
}
