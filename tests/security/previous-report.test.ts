import { describe, it, expect } from "vitest";
import { selectPreviousReport } from "@/lib/previousReport";
import type { SavedReportSummary } from "@shared/reportHistory";

const report = (id: string, patch: Partial<SavedReportSummary> = {}): SavedReportSummary => ({ id, url: "https://example.com/portfolio", role: "Marketing", createdAt: "2026-09-01T12:00:00Z", overall: 80, overallGrade: "B", ...patch });
const before = Date.parse("2026-09-06T12:00:00Z");
describe("previous report selection from an already authorized list", () => {
  it("selects the newest completed matching report, excluding this run and later data", () => {
    expect(selectPreviousReport([report("old"), report("current", { createdAt: "2026-09-06T12:00:00Z" }), report("last", { createdAt: "2026-09-05T12:00:00Z" })], "https://example.com/portfolio", "marketing", before)?.id).toBe("last");
  });
  it("does not mix another page, query, protocol or field into the reminder", () => {
    for (const patch of [{ url: "https://example.com/other" }, { url: "https://example.com/portfolio?new=1" }, { url: "http://example.com/portfolio" }, { role: "Photography" }, { createdAt: "not a date" }]) {
      expect(selectPreviousReport([report("wrong", patch)], "https://example.com/portfolio", "Marketing", before)).toBeNull();
    }
  });
  it("ignores a fragment but does not merge unrelated unknown fields into General", () => {
    expect(selectPreviousReport([report("last")], "https://example.com/portfolio#work", "Marketing", before)?.id).toBe("last");
    expect(selectPreviousReport([report("other", { role: "Architecture" })], "https://example.com/portfolio", "Creative", before)).toBeNull();
  });
  it("rejects invalid or non-web targets and empty history", () => {
    for (const url of ["not a url", "javascript:alert(1)"]) expect(selectPreviousReport([report("last")], url, "Marketing", before)).toBeNull();
    expect(selectPreviousReport([], "https://example.com/portfolio", "Marketing", before)).toBeNull();
  });
});
