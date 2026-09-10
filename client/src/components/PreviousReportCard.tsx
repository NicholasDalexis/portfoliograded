import { ArrowUpRight } from "lucide-react";
import type { SavedReportSummary } from "@shared/reportHistory";
import type { GradeLetter } from "@/lib/audit";
import { GradePill } from "@/components/GradePill";
import { cn } from "@/lib/utils";

export function PreviousReportCard({ report, className }: { report: SavedReportSummary; className?: string }) {
  return <aside aria-label="Previous completed report" className={cn("glass rounded-[2rem] p-5 sm:p-6", className)}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <GradePill grade={report.overallGrade as GradeLetter} size="sm" className="shrink-0" />
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold">Your previous completed report</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground"><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time> · {report.role === "Creative" ? "General portfolio" : report.role}</p>
        </div>
      </div>
      <a href={`/audit?id=${encodeURIComponent(report.id)}`} target="_blank" rel="noopener noreferrer" className="pg-action-secondary">
        Open previous report <ArrowUpRight aria-hidden className="h-4 w-4" /><span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">This is your saved result from that date. It is separate from the new review.</p>
  </aside>;
}
