/*
 * Grade anchors. real example portfolios per role per grade, shown as
 * "want to see what an S looks like?" links after a grade. Built from OUR
 * OWN graded index over time (with the ToS/privacy disclosure in force),
 * not scraped from the web. Nic's call (Jul 11): his site holds Marketing's
 * S slot until a real user earns it.
 */
export interface GradeAnchor {
  url: string;
  label: string;
  tier: "S" | "A" | "B";
}

export const GRADE_ANCHORS: Record<string, GradeAnchor[]> = {
  marketing: [{ url: "https://nicholasalexis.com", label: "nicholasalexis.com", tier: "S" }],
  // other roles fill from the graded index as strong submissions land
};

/** Best anchor STRICTLY above the given tier (so an S never upsells an S). */
export function anchorAbove(rubricKey: string | undefined, currentTier: "S" | "A" | "B" | "C" | "D"): GradeAnchor | null {
  if (!rubricKey) return null;
  const order = ["S", "A", "B", "C", "D"];
  const anchors = GRADE_ANCHORS[rubricKey] ?? [];
  const current = order.indexOf(currentTier);
  const better = anchors.filter((a) => order.indexOf(a.tier) < current);
  return better.sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier))[0] ?? null;
}
