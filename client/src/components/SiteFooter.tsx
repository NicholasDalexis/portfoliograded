/*
 * Sunlit Glass. Footer
 * Minimal, warm, brand-consistent. Lives at the bottom of every page.
 */
import { Link } from "wouter";
import { RELEASE_VERSION } from "@shared/release";

export function SiteFooter() {
  return (
    <footer className="container mt-24 pb-24 sm:pb-20">
      <div className="glass flex flex-col items-start justify-between gap-6 rounded-3xl px-6 py-6 lg:flex-row lg:items-start sm:px-8">
        <div className="flex max-w-sm items-start gap-3">
          <span
            aria-hidden
            className="grad-flowerboy mt-1 block h-5 w-5 shrink-0 rounded-full ring-1 ring-white/70"
          />
          <p className="text-sm text-muted-foreground">
            <span className="font-display font-bold text-foreground">portfolio graded</span>
            <span className="mt-1 block leading-relaxed">See what works. Find your next improvement.</span>
          </p>
        </div>
        <div className="flex max-w-2xl flex-col items-start gap-2 lg:items-end">
          <p className="pg-brand-eyebrow">
            Built for creatives. Made for your next step.
          </p>
          <nav aria-label="Footer navigation" className="pg-footer-links flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground lg:justify-end">
            <Link href="/pricing">Pricing</Link>
            <Link href="/how-to">How to</Link>
            <a href="/#faq">FAQ</a>
            <Link href="/reports">My reports</Link>
            <a
              href="https://stillunemployed.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-foreground"
            >
              Find jobs → StillUnemployed.com
            </a>
            <a
              href="https://jobhuntrecipe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-foreground"
            >
              The Job Hunt Recipe (newsletter)
            </a>
            <Link href="/terms" className="transition hover:text-foreground">
              Terms of service
            </Link>
            <Link href="/privacy" className="transition hover:text-foreground">
              Privacy policy
            </Link>
          </nav>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Built by Nic, from lessons learned rebuilding his own portfolio.
          </p>
          <p className="font-mono text-xs text-muted-foreground" aria-label={`Version ${RELEASE_VERSION}`}>
            v{RELEASE_VERSION} · Preview
          </p>
        </div>
      </div>
    </footer>
  );
}
