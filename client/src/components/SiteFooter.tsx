/*
 * Sunlit Glass — Footer
 * Minimal, warm, brand-consistent. Lives at the bottom of every page.
 */
export function SiteFooter() {
  return (
    <footer className="container mt-24 pb-10">
      <div className="glass flex flex-col items-start justify-between gap-4 rounded-3xl px-6 py-6 sm:flex-row sm:items-center sm:px-8">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grad-flowerboy block h-5 w-5 rounded-full ring-1 ring-white/70"
          />
          <p className="text-sm text-muted-foreground">
            <span className="font-display font-bold text-foreground">FolioGrade</span> — portfolio audits that help you get hired.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Built for creatives. Read by recruiters.
        </p>
      </div>
    </footer>
  );
}
