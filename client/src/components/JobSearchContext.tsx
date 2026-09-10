import { JOB_SEARCH_CONTEXT } from "@shared/pricing";

export function JobSearchContext() {
  return <aside aria-label="Job search context" className="mt-6 rounded-2xl border border-stone-200 bg-white/65 px-5 py-4">
    <p className="text-sm leading-relaxed text-muted-foreground"><strong className="font-display text-xl text-foreground">{JOB_SEARCH_CONTEXT.medianDays} days.</strong> {JOB_SEARCH_CONTEXT.description} <a href={JOB_SEARCH_CONTEXT.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">{JOB_SEARCH_CONTEXT.sourceLabel}</a>.</p>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{JOB_SEARCH_CONTEXT.limitation}</p>
  </aside>;
}
