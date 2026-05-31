/*
 * Sunlit Glass — Home / landing & onboarding
 * Asymmetric editorial layout: huge serif headline left, glass intake card
 * right. Below: how-it-works, sample grade card, recruiter testimonial,
 * pricing teaser. The form posts to /audit?url=...&role=...
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Sparkles, Globe, Smartphone, Eye, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RoleField } from "@/components/RoleField";
import { GradePill } from "@/components/GradePill";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { useUpgrade } from "@/lib/useUpgrade";
import { toast } from "sonner";

const HERO_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663468975365/JXRW8Prgas3RMo8cBvY8Y3/hero_gradient_bloom-HfQFaW3SyLJAbUW6xU4oJT.webp";

const ATMOSPHERE_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663468975365/JXRW8Prgas3RMo8cBvY8Y3/device_mockup_atmosphere-6Xc9ga4yQJ6pLq6nHbG5Zt.webp";

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProtocol);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export default function Home() {
  const [, navigate] = useLocation();
  const [url, setUrl] = useState("");
  const [role, setRole] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { startUpgrade } = useUpgrade();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      toast.error("That doesn't look like a valid URL.", {
        description: "Try something like yourname.com or your-portfolio.webflow.io",
      });
      return;
    }
    const params = new URLSearchParams({ url: normalized, role: role || "Creative" });
    navigate(`/audit?${params.toString()}`);
  }

  function handleUnlockPro() {
    void startUpgrade();
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Ambient atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${HERO_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "top left",
          opacity: 0.85,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.98 0.012 85 / 0.55) 0%, oklch(0.98 0.012 85 / 0.95) 60%, oklch(0.98 0.012 85) 100%)",
        }}
      />

      <SiteHeader onUpgrade={() => setUpgradeOpen(true)} />

      {/* HERO */}
      <section className="container pt-12 sm:pt-20 lg:pt-28">
        <div className="grid items-start gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="rise inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[oklch(0.32_0.06_55)] backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.86_0.16_75)]" />
              The portfolio audit recruiters wish you'd run
            </div>
            <h1 className="rise mt-6 font-display text-[2.6rem] font-bold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[5rem]">
              Your portfolio gets <span className="grad-text">five seconds.</span>
              <br />
              We tell you what they see.
            </h1>
            <p className="rise mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Paste your link. Tell us the work you want. FolioGrade audits the web and mobile experience, gives you a letter grade from <span className="font-semibold text-foreground">D to A+</span> (and an <span className="font-semibold text-foreground">S</span> for Pro perfection), and hands you the exact fixes that turn portfolio bounces into recruiter replies.
            </p>

            <ul className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
              <ValueRow icon={<Globe className="h-4 w-4" />} label="Web + mobile audited" />
              <ValueRow icon={<Eye className="h-4 w-4" />} label="Recruiter-grade insights" />
              <ValueRow icon={<Smartphone className="h-4 w-4" />} label="Instant letter grade" />
              <ValueRow icon={<ShieldCheck className="h-4 w-4" />} label="No login. No spam." />
            </ul>
          </div>

          {/* Intake card */}
          <div className="lg:col-span-5">
            <form
              onSubmit={handleSubmit}
              className="glass-strong rise relative overflow-hidden rounded-[2rem] p-6 sm:p-7"
              style={{ animationDelay: "120ms" }}
            >
              <div
                aria-hidden
                className="grad-flowerboy pointer-events-none absolute inset-x-6 top-0 h-[2px] rounded-full opacity-90"
              />
              <p className="font-display text-2xl font-bold">Run a free audit</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Takes about 30 seconds. Nothing to install.
              </p>

              <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Portfolio URL
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[oklch(0.22_0.02_60_/_0.12)] bg-white/70 px-4 py-3 focus-within:border-[oklch(0.78_0.16_70_/_0.6)] focus-within:ring-4 focus-within:ring-[oklch(0.86_0.16_75_/_0.18)]">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="yourname.com"
                  className="w-full bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/70"
                  autoComplete="url"
                  inputMode="url"
                />
              </div>

              <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                What do you want to be hired for?
              </label>
              <div className="mt-2">
                <RoleField value={role} onChange={setRole} />
              </div>

              <button
                type="submit"
                className="group mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[oklch(0.18_0.04_50)] px-5 py-3.5 text-sm font-bold text-[oklch(0.97_0.04_85)] transition hover:scale-[1.01]"
                style={{
                  boxShadow:
                    "inset 0 1px 0 oklch(1 0 0 / 0.18), 0 18px 40px -20px oklch(0.18 0.04 50 / 0.55)",
                }}
              >
                Grade my portfolio
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Free forever. Pro unlocks the S-tier and the deep drill-downs.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* SAMPLE / SOCIAL PROOF */}
      <section className="container mt-24 sm:mt-32">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
              The grade is the headline
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">
              A letter you can <span className="grad-text">act on.</span>
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Every audit returns a single overall grade, plus a grade per category. No confusing 0–100 score, no vanity gauges. If a recruiter would think it's an A, we tell you it's an A.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <GradePill grade="S" size="sm" label="Pro tier" />
              <GradePill grade="A+" size="sm" />
              <GradePill grade="B" size="sm" />
              <GradePill grade="C" size="sm" />
              <GradePill grade="D" size="sm" />
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="glass-strong relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
              <div
                aria-hidden
                className="grad-flowerboy pointer-events-none absolute inset-x-8 top-0 h-[2px] rounded-full opacity-90"
              />
              <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Sample audit · maya-osei.studio
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold leading-tight">
                    Strong, but losing recruiters on mobile.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Hero loads in 4.2s on 4G — half of visitors bounce.
                  </p>
                </div>
                <GradePill grade="B+" size="lg" />
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <Mini grade="A" label="Visual craft" />
                <Mini grade="A-" label="Story" />
                <Mini grade="C" label="Mobile perf" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        className="container mt-24 sm:mt-32 relative"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full opacity-70"
          style={{
            backgroundImage: `url(${ATMOSPHERE_BG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            mask: "linear-gradient(180deg, transparent 0%, black 25%, black 80%, transparent 100%)",
          }}
        />
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
          How it works
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold leading-tight sm:text-5xl">
          Three steps. <span className="grad-text">No fluff.</span>
        </h2>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <Step
            num="01"
            title="Drop your link"
            body="Paste any portfolio URL — Cargo, Webflow, Framer, Squarespace, custom. We read the public site only."
          />
          <Step
            num="02"
            title="Tell us the role"
            body="Graphic design, marketing, photography, creative tech, artist — we weight the audit to that field's hiring norms."
          />
          <Step
            num="03"
            title="Get your letter grade"
            body="Overall grade, category grades, top fixes ranked by impact, and a bounce-rate forecast you can take to your designer."
          />
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="container mt-24 sm:mt-32">
        <div className="glass-strong relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-1 opacity-90"
            style={{
              background:
                "radial-gradient(60% 60% at 100% 0%, oklch(0.86 0.16 75 / 0.4), transparent 60%), radial-gradient(50% 60% at 0% 100%, oklch(0.82 0.14 55 / 0.32), transparent 60%)",
            }}
          />
          <div className="relative grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[oklch(0.32_0.06_55)]">
                <Sparkles className="h-3 w-3" /> FolioGrade Pro
              </div>
              <h2 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
                Free is great. <span className="grad-text">Pro is the interview.</span>
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground">
                Pro unlocks the three premium categories that recruiters quietly weigh hardest — accessibility, discoverability, conversion path — plus the S-tier ceiling and a recruiter-ready PDF export.
              </p>
            </div>
            <div className="lg:col-span-5">
              <button
                type="button"
                onClick={() => setUpgradeOpen(true)}
                className="foil inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-bold text-[oklch(0.2_0.04_50)] shadow-[inset_0_1px_0_oklch(1_0_0_/_0.85),0_18px_36px_-18px_oklch(0.7_0.16_65_/_0.6)]"
              >
                <Sparkles className="h-4 w-4" />
                See what Pro unlocks
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                $12 / mo · cancel anytime · demo paywall
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onConfirm={handleUnlockPro}
      />
    </div>
  );
}

function ValueRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white/55 px-4 py-3 backdrop-blur-md">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[oklch(0.86_0.16_75_/_0.2)] text-[oklch(0.4_0.08_55)]">
        {icon}
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </li>
  );
}

function Step({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="glass lift relative overflow-hidden rounded-3xl p-6">
      <div
        aria-hidden
        className="grad-flowerboy absolute inset-x-0 top-0 h-[2px] opacity-90"
      />
      <p className="font-mono text-xs font-bold tracking-widest text-[oklch(0.5_0.1_60)]">{num}</p>
      <h3 className="mt-3 font-display text-xl font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Mini({ grade, label }: { grade: import("@/lib/audit").GradeLetter; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/55 px-4 py-3 backdrop-blur-md">
      <span className="text-sm font-semibold">{label}</span>
      <GradePill grade={grade} size="sm" />
    </div>
  );
}
