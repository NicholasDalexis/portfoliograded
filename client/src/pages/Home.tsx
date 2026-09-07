/*
 * Sunlit Glass. Two-column introduction and intake, with account
 * progress beside the form on desktop. Audit owns the actual review.
 */
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Sparkles, Globe, Eye, Smartphone, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RoleField } from "@/components/RoleField";
import { GradePill } from "@/components/GradePill";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { isProUser } from "@/lib/quota";
import { track } from "@/lib/track";
import { toast } from "sonner";
import { Link } from "wouter";
import { SavedReports } from "@/components/SavedReports";
import { FAQ } from "@/components/FAQ";
import { MiniTierList } from "@/components/MiniTierList";
import { SubmissionNotice } from "@/components/SubmissionNotice";
import { PortfolioProgress } from "@/components/PortfolioProgress";

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
  const [builder, setBuilder] = useState("");
  const [builderOther, setBuilderOther] = useState("");
  const submissionTrigger = useRef<HTMLButtonElement>(null);
  const [submissionOpen, setSubmissionOpen] = useState(false);

  function startAudit(withRole: string, pro: boolean) {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    const builtWith = builder === "__other" ? builderOther.trim() : builder;
    track("audit_started", { role: withRole, pro, builder: builtWith || "unanswered" });
    navigate(
      `/audit?url=${encodeURIComponent(normalized)}&role=${encodeURIComponent(withRole)}${pro ? "&pro=1" : ""}${builtWith ? `&builder=${encodeURIComponent(builtWith)}` : ""}`,
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      toast.error("That doesn't look like a valid URL.", {
        description: "Try something like yourname.com or your-portfolio.webflow.io",
      });
      return;
    }

    const pro = isProUser();
    // Role-specific grading is FREE (Nic, Jul 11): never paywall the pills.
    // Conversion happens at the S-moment and after repeated audits, not the front door.

    // Hand off to the audit page immediately. it runs the audit and owns the
    // scanning screen with device previews and illustrated lessons.
    startAudit(role || "Creative", pro);
  }

  // (weekly role-run gate lives in @/lib/quota. shared with the results page)

  // UpgradeDialog owns availability; local payments remain disabled.
  function handleUnlockPro() {}

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
      <main id="main-content" tabIndex={-1}><section className="container pt-12 sm:pt-16 lg:pt-20">
        <div className="grid items-start gap-8 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-10">
          <div className="lg:col-span-7 lg:col-start-1 lg:row-start-1">
            <div className="rise inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[oklch(0.32_0.06_55)] backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.86_0.16_75)]" />
              A clearer portfolio starts here
            </div>
            <h1 className="rise mt-6 font-display text-[2.6rem] font-bold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[5rem]">
              Grade your <span className="grad-text">portfolio.</span>
            </h1>
            <p className="rise mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              See what’s working. Know what to fix.
            </p>
            <a href="#grade-form" className="mt-5 inline-flex min-h-12 items-center font-semibold underline underline-offset-4 lg:hidden">Get my grade ↓</a>
            <ul className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
              <ValueRow icon={<Globe className="h-4 w-4" />} label="Web + mobile previews" />
              <ValueRow icon={<Eye className="h-4 w-4" />} label="Role-specific guidance" />
              <ValueRow icon={<Smartphone className="h-4 w-4" />} label="An initial letter grade" />
              <ValueRow icon={<ShieldCheck className="h-4 w-4" />} label="No login. No spam." />
            </ul>
            <p className="rise mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Your portfolio should work wherever someone opens it. Check the phone preview for cramped text, cropped work, and buttons that are hard to tap.
            </p>
            <MiniTierList className="mt-5 max-w-xl" />
          </div>

          {/* Intake card */}
          <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2">
            <form
              id="grade-form"
              onSubmit={handleSubmit}
              className="glass-strong rise scroll-mt-40 relative overflow-hidden rounded-[2rem] p-6 sm:p-7"
              style={{ animationDelay: "120ms" }}
            >
              <div
                aria-hidden
                className="grad-flowerboy pointer-events-none absolute inset-x-6 top-0 h-[2px] rounded-full opacity-90"
              />
              <h2 className="sr-only">Your portfolio details</h2>

              <label htmlFor="portfolio-url" className="block text-sm font-semibold text-foreground">
                Portfolio URL
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[oklch(0.22_0.02_60_/_0.12)] bg-white/70 px-4 py-3 focus-within:border-[oklch(0.78_0.16_70_/_0.6)] focus-within:ring-4 focus-within:ring-[oklch(0.86_0.16_75_/_0.18)]">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  id="portfolio-url"
                  required
                  maxLength={2048}
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="yourname.com"
                  className="w-full bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/70"
                  autoComplete="url"
                  inputMode="url"
                />
              </div>

              <fieldset className="mt-5 min-w-0">
                <legend className="text-sm font-semibold text-foreground">
                  What do you want to be hired for?
                </legend>
                <RoleField
                  className="mt-2"
                  value={role}
                  onChange={(r) => {
                    setRole(r);
                    track("role_pill_selected", { role: r });
                  }}
                />
              </fieldset>

              {/* Optional analytics question. where the portfolio was built */}
              <div className="mt-5">
                <label htmlFor="portfolio-builder" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                  Where did you build it? <span className="rounded-full border border-foreground/15 bg-white/70 px-2.5 py-1 text-xs font-semibold normal-case tracking-normal text-muted-foreground">Optional</span>
                </label>
                
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <select
                    id="portfolio-builder"
                    value={builder}
                    onChange={(e) => {
                      setBuilder(e.target.value);
                      if (e.target.value !== "__other") setBuilderOther("");
                      track("builder_selected", { builder: e.target.value });
                    }}
                    className="min-h-12 w-full appearance-none rounded-xl border-0 bg-transparent px-1 py-3 pr-7 text-base outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235c5147' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
                  >
                    <option value="">Skip / Not sure</option>
                    <option>Framer</option>
                    <option>Squarespace</option>
                    <option>Wix</option>
                    <option>Canva</option>
                    <option>Webflow</option>
                    <option>Cargo</option>
                    <option>WordPress</option>
                    <option>Adobe Portfolio</option>
                    <option>Manus</option>
                    <option>Claude / AI builder</option>
                    <option>Coded it myself</option>
                    <option value="__other">Other…</option>
                  </select>
                  {builder === "__other" ? (
                    <input
                      aria-label="Other portfolio builder"
                      value={builderOther}
                      onChange={(e) => setBuilderOther(e.target.value)}
                      placeholder="Which builder did you use?"
                      maxLength={40}
                      className="min-h-12 w-full min-w-0 rounded-xl border border-amber-900/35 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-700"
                    />
                  ) : null}
                </div>
              </div>

              <button
                type="submit"
                className="pg-action pg-action-primary group mt-6 w-full"
              >
                Grade my portfolio
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <nav aria-label="Submission information" className="mt-3 flex flex-wrap items-center justify-center gap-x-4 text-sm text-muted-foreground">
                <button ref={submissionTrigger} type="button" onClick={() => setSubmissionOpen(true)} aria-haspopup="dialog" className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800">How we use submissions</button>
                <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-4">Privacy</Link>
                <Link href="/terms" className="inline-flex min-h-11 items-center underline underline-offset-4">Terms</Link>
              </nav>
            </form>
            <div className="mt-5"><SavedReports compact /></div>
          </div>
          <PortfolioProgress className="lg:col-span-7 lg:col-start-1 lg:row-start-2" />
        </div>
      </section>

      {/* SAMPLE / SOCIAL PROOF */}
      <section className="container mt-24 sm:mt-32">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Your report
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">
              The good. The gaps. <span className="grad-text">The next move.</span>
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              See your grade. Open a category. Pick your next fix.
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
                    Example report
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold leading-tight">
                    Strong work. Give the phone layout another look.
                  </p>
                </div>
                <GradePill grade="B+" size="lg" />
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <Mini grade="A" label="Visual craft" />
                <Mini grade="A-" label="Story" />
                <Mini grade="C" label="Phone experience" />
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
            body="Your public portfolio. Any platform."
          />
          <Step
            num="02"
            title="Tell us the role"
            body="Choose your field, or pick Other."
          />
          <Step
            num="03"
            title="Get your letter grade"
            body="See what’s working and what to fix next."
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
                <Sparkles className="h-3 w-3" /> portfolio graded pro
              </div>
              <h2 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
                Want a <span className="grad-text">closer look?</span>
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground">
                Deeper project reviews and personal standout feedback are coming to Pro.
              </p>
            </div>
            <div className="lg:col-span-5">
              <button
                type="button"
                onClick={() => setUpgradeOpen(true)}
                className="pg-action w-full"
              >
                <Sparkles className="h-4 w-4" />
                About Pro
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                $9.99/month or $49.99/year planned. Payments aren’t open yet.
              </p>
            </div>
          </div>
        </div>
      </section>

      <FAQ />
      </main>
      <SiteFooter />

      <SubmissionNotice open={submissionOpen} onOpenChange={setSubmissionOpen} returnFocusRef={submissionTrigger} />
      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onConfirm={handleUnlockPro}
      />


    </div>
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

