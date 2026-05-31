/*
 * Method — "How we read your portfolio."
 * Mirrors the live marketing copy: an opinionated, recruiter-lens grading
 * philosophy laid out as five numbered principles.
 */
import { useLocation } from "wouter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const PRINCIPLES = [
  {
    n: "01",
    title: "A grade should be a verdict, not a vibe.",
    body: "A 78/100 doesn't help you. A B+ with three named fixes does. Every audit produces one overall letter, one per category, and a ranked fix list — that's it.",
  },
  {
    n: "02",
    title: "Recruiters open portfolios on phones.",
    body: "Mobile is the default audit, not an afterthought. Anything that falls apart on a phone fails the audit, no matter how nice the desktop layout looks.",
  },
  {
    n: "03",
    title: "Craft and clarity are weighted equally.",
    body: "A beautiful site that doesn't say what you do gets the same penalty as a clear site that looks rushed. The grade rewards the rare combination of both.",
  },
  {
    n: "04",
    title: "Pro exists for the categories that quietly cost interviews.",
    body: "Accessibility, discoverability, and conversion path don't show up on most portfolio reviews — and they're often what separates an A- from an A. Pro surfaces them.",
  },
  {
    n: "05",
    title: "The S grade is rare on purpose.",
    body: "S is reserved for portfolios that score 97+ with Pro active. We hold it back so it actually means something when you see it.",
  },
];

export default function Method() {
  const [, navigate] = useLocation();
  return (
    <div className="sunlit-bg min-h-screen">
      <SiteHeader onUpgrade={() => navigate("/pricing")} />
      <main className="container py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Left rail */}
          <header className="lg:col-span-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[oklch(0.5_0.07_60)]">Method</p>
            <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight sm:text-5xl">
              How we read your <span className="grad-text">portfolio.</span>
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              PortfolioGraded is opinionated on purpose. We grade like a hiring lead would, not like a Lighthouse score. Speed matters, but so does the first sentence of your hero.
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[oklch(0.2_0.02_60)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[oklch(0.28_0.02_60)]"
            >
              Run an audit
            </button>
          </header>

          {/* Principles */}
          <div className="space-y-4 lg:col-span-8">
            {PRINCIPLES.map((p) => (
              <div key={p.n} className="glass rounded-[1.5rem] p-6 sm:p-7">
                <p className="font-mono text-xs font-bold tracking-[0.2em] text-[oklch(0.6_0.1_70)]">{p.n}</p>
                <h2 className="mt-2 font-display text-xl font-bold sm:text-2xl">{p.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
