/** A comparison of fetched homepage source, not a claim about an entire site. */
export interface HomepageSourceSnapshot {
  version: 1;
  capturedAt: string;
  desktop: { finalUrl: string; sha256: string };
  mobile: { finalUrl: string; sha256: string };
}
export interface SavedReportSummary {
  id: string;
  url: string;
  role: string;
  createdAt: string;
  overall: number;
  overallGrade: string;
  methodVersion?: string;
  bestAchieved?: BestAchieved;
}
export interface BestAchieved {
  reportId: string;
  at: string;
  role: string;
  methodVersion: string;
  overall: number;
  overallGrade: string;
}
export interface HomepageChangeCheck {
  status: "source-changed" | "no-source-change" | "baseline-missing";
  checkedAt: string;
  reportCreatedAt: string;
  reportOutdated: boolean;
}
