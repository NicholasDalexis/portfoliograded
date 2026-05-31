/*
 * Sunlit Glass — Audit results page
 * URL params: ?url=...&role=...
 * Flow:
 *   1. 2.4s scanning animation over the device preview
 *   2. Reveal hero grade pill + headline + subhead
 *   3. Asymmetric layout: device preview left, top fixes / metrics right
 *   4. Category insight cards (free + locked Pro)
 *   5. Footer CTA to upgrade
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Sparkles, Zap, TrendingDown, Smartphone, Monitor, RefreshCw, Download } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { GradePill } from "@/components/GradePill";
import { InsightCard } from "@/components/InsightCard";
import { DevicePreview } from "@/components/DevicePreview";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import type { AuditReport } from "@/lib/audit";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useUpgrade } from "@/lib/useUpgrade";
import { toast } from "sonner";

const ATMOSPHERE_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663468975365/JXRW8Prgas3RMo8cBvY8Y3/hero_gradient_bloom-HfQFaW3SyLJAbUW6xU4oJT.webp";

function useQuery() {
  const [location] = useLocation();
  return useMemo(() => {
    const qIdx = location.indexOf("?");
    const search = qIdx >= 0 ? location.slice(qIdx + 1) : window.location.search.replace(/^\?/, "");
    return new URLSearchParams(search);
  }, [location]);
}

function hostnameFromUrl(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return value.replace(/^https?:\/\//i, "").split("/")[0] || "portfolio";
  }
}

export default function Audit() {
  const params = useQuery();
  const url = params.get("url") || "https://your-portfolio.com";
  const role = params.get("role") || "Creative";

  const { isPro: unlocked } = useAuth();
  const { startUpgrade, upgrading } = useUpgrade();
  const [scanning, setScanning] = useState(true);
  const [view, setView] = useState<"web" | "mobile">("web");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [, navigate] = useLocation();
  const auditMutation = trpc.audit.run.useMutation();

  useEffect(() => {
    let cancelled = false;
    setScanning(true);
    setReport(null);

    auditMutation.mutate(
      { url, role },
      {
        onSuccess: (nextReport) => {
          if (cancelled) return;
          setReport(nextReport);
          setScanning(false);
        },
        onError: (error) => {
          if (cancelled) return;
          setScanning(false);
          toast.error("Audit could not run", {
            description: error.message || "Check that the portfolio URL is public and try again.",
          });
        },
      },
    );

    return () => {
      cancelled = true;
    };
  }, [url, role, unlocked]);

  function handleUnlock() {
    void startUpgrade();
  }

  function handleReaudit() {
    setScanning(true);
    setReport(null);
    auditMutation.mutate(
      { url, role },
      {
        onSuccess: (nextReport) => {
          setReport(nextReport);
          setScanning(false);
          toast.success("Audit refreshed", { description: "Fresh portfolio signals are in." });
        },
        onError: (error) => {
          setScanning(false);
          toast.error("Audit could not run", {
            description: error.message || "Check that the portfolio URL is public and try again.",
          });
        },
      },
    );
  }

  function handleExport() {
    if (!unlocked) {
      setUpgradeOpen(true);
      return;
    }
    toast.success("Export queued", {
      description: "Recruiter-ready PDF will land in your inbox shortly. (Demo)",
    });
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${ATMOSPHERE_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "top right",
          opacity: 0.55,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.98 0.012 85 / 0.7) 0%, oklch(0.98 0.012 85 / 0.96) 50%, oklch(0.98 0.012 85) 100%)",
        }}
      />

      <SiteHeader onUpgrade={() => setUpgradeOpen(true)} />

      <main className="container pt-10 sm:pt-14">
        {/* Top bar with breadcrumb and actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> New audit
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReaudit}
              className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-md hover:bg-white/80"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Re-run
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-md hover:bg-white/80"
            >
              <Download className="h-3.5 w-3.5" /> {unlocked ? "Export PDF" : "Export PDF (Pro)"}
            </button>
          </div>
        </div>

        {/* Hero grade card */}
        <section className="mt-6">
          <div className="glass-strong relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
            <div
              aria-hidden
              className="grad-flowerboy pointer-events-none absolute inset-x-10 top-0 h-[2px] rounded-full opacity-90"
            />
            <div className="grid items-center gap-8 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  {report ? "Audit complete" : auditMutation.isError ? "Audit needs attention" : "Audit running"} · {hostnameFromUrl(url)}
                </p>
                <h1 className="mt-3 font-display text-[2.4rem] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-6xl">
                  {scanning || !report ? "Scanning your portfolio…" : report.headline}
                </h1>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {scanning
                    ? "Reading the hero, parsing the case studies, and replaying the mobile experience on simulated 4G."
                    : report?.subhead ?? "We could not complete the audit. Try a public portfolio URL or start a new audit."}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-md">
                    Role: <span className="text-foreground">{report?.role ?? role}</span>
                  </span>
                  {unlocked ? (
                    <span className="foil rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[oklch(0.2_0.04_50)]">
                      Pro tier active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setUpgradeOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.86_0.16_75_/_0.18)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[oklch(0.32_0.06_55)] hover:bg-[oklch(0.86_0.16_75_/_0.28)]"
                    >
                      <Sparkles className="h-3 w-3" /> Unlock S-tier
                    </button>
                  )}
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="flex items-center justify-center">
                  {scanning || !report ? (
                    <div className="grid h-44 w-44 place-items-center rounded-full bg-white/60 backdrop-blur-md sm:h-52 sm:w-52">
                      <div
                        className="h-32 w-32 animate-spin rounded-full border-[6px] border-transparent sm:h-40 sm:w-40"
                        style={{
                          borderTopColor: "oklch(0.86 0.16 75)",
                          borderRightColor: "oklch(0.82 0.14 55)",
                          borderBottomColor: "oklch(0.88 0.14 95)",
                        }}
                      />
                    </div>
                  ) : (
                    <GradePill grade={report.overallGrade} size="xl" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Device preview + key metrics */}
        <section className="mt-10 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <DevicePreview url={url} view={view} onView={setView} scanning={scanning} />
          </div>
          <div className="lg:col-span-5 grid gap-4 content-start">
            <MetricCard
              icon={<TrendingDown className="h-4 w-4" />}
              label="Estimated bounce rate"
              value={report ? `${report.bounceEstimate}%` : "—"}
              hint={report ? `Recruiter portfolios in this field land near ${report.bounceTarget}%.` : "Calculating recruiter bounce risk from public page signals."}
              tone={!report || report.bounceEstimate > 50 ? "warn" : report.bounceEstimate > 35 ? "ok" : "good"}
            />
            <MetricCard
              icon={<Monitor className="h-4 w-4" />}
              label="Desktop load time"
              value={report ? `${(report.loadDesktopMs / 1000).toFixed(1)}s` : "—"}
              hint="Desktop response and payload estimate from a real crawl."
              tone={!report || report.loadDesktopMs > 3500 ? "warn" : report.loadDesktopMs > 2500 ? "ok" : "good"}
            />
            <MetricCard
              icon={<Smartphone className="h-4 w-4" />}
              label="Mobile load time"
              value={report ? `${(report.loadMobileMs / 1000).toFixed(1)}s` : "—"}
              hint="Mobile crawl uses a phone user agent plus conservative payload weighting."
              tone={!report || report.loadMobileMs > 5000 ? "warn" : report.loadMobileMs > 3500 ? "ok" : "good"}
            />
          </div>
        </section>

        {/* Top fixes ranked */}
        <section className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Top fixes, ranked
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
                Do these, in this order.
              </h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {!report ? (
              <div className="glass lift relative overflow-hidden rounded-3xl p-6 md:col-span-2">
                <div className="grad-flowerboy absolute inset-x-0 top-0 h-[2px] opacity-90" />
                <p className="font-mono text-xs font-bold tracking-widest text-[oklch(0.5_0.1_60)]">LIVE CRAWL</p>
                <h3 className="mt-3 font-display text-xl font-bold leading-tight">Building your ranked fixes…</h3>
                <p className="mt-2 text-sm text-muted-foreground">FolioGrade is reading the public page, comparing desktop and mobile signals, and ranking the fixes by recruiter impact.</p>
              </div>
            ) : null}
            {(report?.topFixes ?? []).map((fix, i) => {
              const locked = fix.premium && !unlocked;
              return (
                <div
                  key={`${fix.title}-${i}`}
                  className="glass lift relative overflow-hidden rounded-3xl p-6"
                >
                  <div className="grad-flowerboy absolute inset-x-0 top-0 h-[2px] opacity-90" />
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-mono text-xs font-bold tracking-widest text-[oklch(0.5_0.1_60)]">
                      #{i + 1}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        fix.impact === "High"
                          ? "bg-[oklch(0.7_0.18_30_/_0.18)] text-[oklch(0.4_0.14_30)]"
                          : fix.impact === "Medium"
                          ? "bg-[oklch(0.86_0.16_85_/_0.22)] text-[oklch(0.4_0.1_80)]"
                          : "bg-[oklch(0.78_0.16_140_/_0.18)] text-[oklch(0.35_0.1_140)]"
                      }`}
                    >
                      {fix.impact} impact
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-bold leading-tight">
                    {fix.title}
                  </h3>
                  {locked ? (
                    <div className="mt-3">
                      <p className="line-clamp-2 text-sm text-muted-foreground blur-[3px] select-none">
                        {fix.description}
                      </p>
                      <button
                        type="button"
                        onClick={() => setUpgradeOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[oklch(0.86_0.16_75_/_0.18)] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[oklch(0.32_0.06_55)]"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Unlock fix
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">{fix.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Category breakdown */}
        <section className="mt-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Category breakdown
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
                Tap any card to drill in.
              </h2>
            </div>
            {!unlocked ? (
              <button
                type="button"
                onClick={() => setUpgradeOpen(true)}
                className="hidden items-center gap-2 rounded-full bg-white/60 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur-md hover:bg-white/80 sm:inline-flex"
              >
                <Zap className="h-4 w-4" /> Unlock 3 Pro categories
              </button>
            ) : null}
          </div>
          <div className="mt-6 grid gap-4">
            {!report ? (
              <div className="glass relative overflow-hidden rounded-3xl p-6">
                <div className="grad-flowerboy absolute inset-x-0 top-0 h-[2px] opacity-90" />
                <p className="font-display text-xl font-bold">Category analysis in progress</p>
                <p className="mt-2 text-sm text-muted-foreground">The backend is scoring clarity, content, performance, mobile readiness, accessibility, discoverability, and conversion strength.</p>
              </div>
            ) : null}
            {(report?.categories ?? []).map((c) => (
              <InsightCard
                key={c.key}
                category={c}
                unlocked={unlocked}
                onUpgrade={() => setUpgradeOpen(true)}
              />
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mt-16">
          <div className="glass-strong relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-1 opacity-90"
              style={{
                background:
                  "radial-gradient(60% 60% at 100% 0%, oklch(0.86 0.16 75 / 0.4), transparent 60%), radial-gradient(50% 60% at 0% 100%, oklch(0.82 0.14 55 / 0.32), transparent 60%)",
              }}
            />
            <div className="relative grid items-center gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
                  {unlocked ? (
                    <>You've got the full audit. <span className="grad-text">Ship the fixes.</span></>
                  ) : (
                    <>Want the rest of the story? <span className="grad-text">Pro shows it.</span></>
                  )}
                </h2>
                <p className="mt-3 max-w-xl text-muted-foreground">
                  {unlocked
                    ? "Re-audit anytime as you ship changes. The grade updates instantly."
                    : "Three locked categories, every drill-down, the S-tier ceiling, and the recruiter-ready PDF — all $12/mo."}
                </p>
              </div>
              <div className="lg:col-span-4 flex justify-start lg:justify-end">
                {unlocked ? (
                  <button
                    type="button"
                    onClick={handleReaudit}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[oklch(0.18_0.04_50)] px-5 py-3 text-sm font-bold text-[oklch(0.97_0.04_85)]"
                  >
                    <RefreshCw className="h-4 w-4" /> Re-run audit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setUpgradeOpen(true)}
                    className="foil inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-[oklch(0.18_0.04_50)] shadow-[inset_0_1px_0_oklch(1_0_0_/_0.85),0_18px_36px_-18px_oklch(0.7_0.16_65_/_0.6)] sm:w-auto"
                  >
                    <Sparkles className="h-4 w-4" /> Unlock the full audit
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onConfirm={handleUnlock}
      />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: "good" | "ok" | "warn";
}) {
  const dot =
    tone === "good"
      ? "bg-[oklch(0.78_0.16_140)]"
      : tone === "ok"
      ? "bg-[oklch(0.86_0.16_85)]"
      : "bg-[oklch(0.7_0.18_30)]";
  return (
    <div className="glass relative overflow-hidden rounded-3xl p-5">
      <div className="grad-flowerboy absolute inset-x-0 top-0 h-[2px] opacity-90" />
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/70 text-[oklch(0.4_0.08_55)]">
            {icon}
          </span>
          {label}
        </span>
        <span className={`h-2 w-2 rounded-full ${dot}`} />
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
