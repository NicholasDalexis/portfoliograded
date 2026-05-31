/*
 * Pricing — "Free is real. Pro is the leverage."
 * Mirrors the live marketing copy. The Pro CTA now triggers a real Stripe
 * checkout via the billing router (falls back to opening the upgrade dialog
 * for signed-out users).
 */
import { useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { useLocation } from "wouter";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { GradePill } from "@/components/GradePill";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const FREE = [
  "Letter grade across 6 core categories",
  "Top 3 fixes ranked by impact",
  "Web + mobile preview",
  "Bounce-rate estimate",
];
const FREE_LOCKED = ["S-tier ceiling", "Three Pro categories", "Recruiter PDF"];
const PRO = [
  "Everything in Free",
  "All 9 categories — Accessibility, Discoverability, Conversion path",
  "Recruiter context per category",
  "S-tier ceiling unlocked at 97+",
  "Detailed drill-downs (3 checks per category)",
  "Unlimited re-audits for 30 days",
  "Recruiter-ready PDF export",
];

const FAQ = [
  { q: "Is the free audit actually useful?", a: "Yes. The grade and the top three fixes run on the same engine Pro uses — Pro just adds three more categories, the per-check drill-downs, and the S-tier ceiling." },
  { q: "What does Pro see that Free doesn't?", a: "Accessibility, discoverability, and conversion path — the categories that most quietly cost interviews. Plus three drill-down checks per category and the S-tier grade." },
  { q: "Will my portfolio actually rank S?", a: "S is reserved for portfolios that score 97 or higher with Pro active. It's rare on purpose — recruiters should know what an S looks like." },
  { q: "Do you store my portfolio?", a: "No login required for a free audit. We read the public page only and don't keep a copy. Signed-in users can opt to save their scan history." },
];

export default function Pricing() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [, navigate] = useLocation();
  const checkout = trpc.billing.createCheckout.useMutation();

  function startCheckout() {
    checkout.mutate(undefined, {
      onSuccess: ({ url }) => { window.location.href = url; },
      onError: (e) => toast.error("Couldn't start checkout", { description: e.message }),
    });
  }

  return (
    <div className="sunlit-bg min-h-screen">
      <SiteHeader onUpgrade={() => navigate("/pricing")} />
      <main className="container py-12 sm:py-16">
        <header className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[oklch(0.5_0.07_60)]">Pricing</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            Free is real. <span className="grad-text">Pro is the leverage.</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            We built the free audit so it could stand on its own — your grade, the highlights, the obvious fixes. Pro exists for the moment you decide your portfolio is the bottleneck and you want every recruiter signal we can find.
          </p>
        </header>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {/* Free */}
          <div className="glass rounded-[1.75rem] p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Free</h2>
              <GradePill grade="A+" size="md" />
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">$0 — forever</p>
            <p className="mt-3 text-sm text-muted-foreground">The fastest portfolio gut-check on the internet. Real grade, real insights, no card.</p>
            <ul className="mt-5 space-y-2.5">
              {FREE.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-[oklch(0.55_0.14_150)]" /> {f}
                </li>
              ))}
              {FREE_LOCKED.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground/60">
                  <X className="h-4 w-4" /> {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-6 w-full rounded-full bg-[oklch(0.2_0.02_60)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[oklch(0.28_0.02_60)]"
            >
              Run a free audit
            </button>
          </div>

          {/* Pro */}
          <div
            className="relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8"
            style={{
              background: "linear-gradient(160deg, oklch(0.96 0.04 85), oklch(0.93 0.06 70))",
              border: "2px solid oklch(0.85 0.12 75)",
            }}
          >
            <span className="absolute right-5 top-5 rounded-full bg-[oklch(0.2_0.04_50)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
              Recommended
            </span>
            <h2 className="font-display text-2xl font-bold">Pro</h2>
            <p className="mt-1 font-mono text-sm text-muted-foreground">$12 / mo · cancel anytime</p>
            <p className="mt-3 text-sm text-muted-foreground">For the week you decide to make it a real portfolio. Everything we look at, every drill-down, S-tier ceiling.</p>
            <ul className="mt-5 space-y-2.5">
              {PRO.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-[oklch(0.55_0.14_150)]" /> {f}
                </li>
              ))}
            </ul>
            <SignedIn>
              <button
                type="button"
                onClick={startCheckout}
                disabled={checkout.isPending}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-[oklch(0.2_0.04_50)] transition hover:scale-[1.01] disabled:opacity-60"
                style={{
                  background: "linear-gradient(120deg, oklch(0.86 0.14 60), oklch(0.9 0.13 80), oklch(0.92 0.11 95))",
                  boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.85), 0 10px 24px -12px oklch(0.7 0.16 65 / 0.55)",
                }}
              >
                <Sparkles className="h-4 w-4" /> {checkout.isPending ? "Starting checkout…" : "Upgrade to Pro"}
              </button>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-[oklch(0.2_0.04_50)] transition hover:scale-[1.01]"
                  style={{
                    background: "linear-gradient(120deg, oklch(0.86 0.14 60), oklch(0.9 0.13 80), oklch(0.92 0.11 95))",
                    boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.85), 0 10px 24px -12px oklch(0.7 0.16 65 / 0.55)",
                  }}
                >
                  <Sparkles className="h-4 w-4" /> Sign in to upgrade
                </button>
              </SignInButton>
            </SignedOut>
            <p className="mt-2 text-center text-xs text-muted-foreground">Secure checkout via Stripe · cancel anytime</p>
          </div>
        </div>

        {/* FAQ */}
        <section className="mt-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[oklch(0.5_0.07_60)]">Common questions</p>
          <h2 className="mt-2 font-display text-3xl font-bold">What people ask before upgrading</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q} className="glass rounded-2xl p-5">
                <h3 className="font-display text-base font-bold">{item.q}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
