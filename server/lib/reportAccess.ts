import { ACCOUNT_ACCESS_POLICY, CATEGORY_META, type AuditReport, type CategoryAccess, type CategoryScore } from "../../shared/audit.js";
export const LOCKED = "Unlocks with Pro.";
export const ACCOUNT_LOCKED = "Read your full feedback. It's free. Sign in to continue.";
export function categoryAccess(report: AuditReport, category: CategoryScore, entitled: boolean, signedIn = false): CategoryAccess {
  if (report.accessPolicy === ACCOUNT_ACCESS_POLICY && category.grade === "D" && !signedIn && !entitled) return "free-account-required";
  if (report.verification?.deepReviewVerified === true && (CATEGORY_META[category.key]?.premium || category.premium) && !entitled) return "pro-required";
  return "open";
}
/** Single outbound policy; never mutate the full retained report. */
export function redactReport(report: AuditReport, entitled: boolean, signedIn = false): AuditReport {
  const copy = structuredClone(report);
  delete copy.sourceSnapshot;
  delete copy.acceptedEvidence;
  for (const device of Object.values(copy.rendered?.devices ?? {})) {
    if (device.capture) delete device.capture.imageRef;
  }
  // Standout secrecy applies even to an imported report without today's D policy.
  if (copy.standouts) {
    if (!entitled && (copy.standouts.status === "pro-required" || (copy.standouts.status === "available" && copy.standouts.items.length))) {
      copy.standouts = { version: "relative-v1", status: "pro-required", items: [], teaser: "Unlock" };
    } else if (copy.standouts.status !== "available" || !copy.standouts.items.length) {
      copy.standouts = { version: "relative-v1", status: "unavailable", items: [] };
    }
  }
  if (copy.accessPolicy === ACCOUNT_ACCESS_POLICY) {
    const lockedKeys = new Set(copy.categories.filter(category => categoryAccess(copy, category, entitled, signedIn) !== "open").map(category => category.key));
    copy.categories = copy.categories.map(category => {
      const access = categoryAccess(copy, category, entitled, signedIn);
      return access === "open" ? { ...category, premium: false, access, recruiterNote: undefined } :
        { ...category, access, premium: access === "pro-required", blurb: CATEGORY_META[category.key].blurb,
          details: [], recommendation: access === "free-account-required" ? ACCOUNT_LOCKED : LOCKED, recruiterNote: undefined };
    });
    copy.topFixes = copy.topFixes.map(fix => {
      const category = copy.categories.find(category => category.key === fix.categoryKey);
      const access = category?.access ?? (lockedKeys.size ? "free-account-required" : "open");
      return access === "open" ? { ...fix, premium: false, access } : { ...fix, access, premium: access === "pro-required",
        title: access === "free-account-required" ? "More feedback with a free account" : "Pro improvement",
        description: access === "free-account-required" ? ACCOUNT_LOCKED : LOCKED };
    });
    if (lockedKeys.size) {
      // Model summaries and raw browser examples can repeat gated feedback.
      copy.headline = "Your homepage preview is ready.";
      copy.subhead = "Your grades are visible. Sign in for the full feedback. No payment required.";
      for (const device of Object.values(copy.rendered?.devices ?? {})) delete device.observations;
    }
    if (!copy.standouts) {
      copy.standouts = { version: "relative-v1", status: "unavailable", items: [] };
    }
    return copy;
  }
  // The initial grader's nine categories and fixes are free at every letter.
  // A future verified deep review must retain an explicit evidence contract.
  if (copy.verification?.deepReviewVerified !== true) {
    if (copy.overallGrade === "S") copy.overallGrade = "A+";
    copy.categories = copy.categories.map(category => ({ ...category, premium: false, grade: category.grade === "S" ? "A+" : category.grade, recruiterNote: undefined }));
    copy.topFixes = copy.topFixes.map(fix => ({ ...fix, premium: false }));
    return copy;
  }
  if (entitled) return copy;
  if (copy.overallGrade === "S") copy.overallGrade = "A+";
  copy.categories = copy.categories.map((category) => CATEGORY_META[category.key]?.premium || category.premium ? { ...category, premium: true, details: [], recommendation: LOCKED, recruiterNote: undefined } : category);
  copy.topFixes = copy.topFixes.map((fix) => fix.premium ? { ...fix, title: "Pro improvement", description: LOCKED } : fix);
  return copy;
}
