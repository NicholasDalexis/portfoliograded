/*
 * Sunlit Glass. Audit results page
 * URL param: ?id=<auditId>
 * Flow:
 *   1. POST /api/audits (if no id yet. redirect from Home carries an id)
 *   2. GET /api/audits/:id to retrieve the report
 *   3. Real request status and pausable lessons while the fetch is in flight
 *   4. Reveal hero grade pill + headline + subhead
 *   5. Asymmetric layout: device preview left, top fixes / metrics right
 *   6. Category insight cards (initial details are free)
 *   7. Footer CTA to upgrade
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Zap,
  TrendingDown,
  Smartphone,
  MessageCircle,
  Monitor,
  RefreshCw,
  Download,
} from "lucide-react";
import { RenderedEvidence } from "@/components/RenderedEvidence";
import { ReportChangeCheck } from "@/components/ReportChangeCheck";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { GradePill } from "@/components/GradePill";
import { CategoryGrid } from "@/components/CategoryGrid";
import { FixList } from "@/components/FixList";
import { cn } from "@/lib/utils";
import { DevicePreview } from "@/components/DevicePreview";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { ReportAccessDialog } from "@/components/ReportAccessDialog";
import type { AuditReport } from "@/lib/audit";
import { rubricForRole } from "@shared/rubrics";
import { anchorAbove } from "@shared/anchors";
import { ROLE_PRESETS } from "@/lib/audit";
import { track } from "@/lib/track";
import { PortfolioLessons } from "@/components/PortfolioLessons";
import { PreviousReportCard } from "@/components/PreviousReportCard";
import { selectPreviousReport } from "@/lib/previousReport";
import type { BestAchieved, SavedReportSummary } from "@shared/reportHistory";
import { isProUser } from "@/lib/quota";
import {
  auth,
  getAuthHeader,
  signInWithGoogle,
  subscribeAuth,
} from "@/lib/firebase";
import {
  continueSavedReport,
  ReportContinuationError,
  reportSignInMessage,
} from "@/lib/reportContinuation";
import { confirmCheckout, fetchMe } from "@/lib/pro";
import { toast } from "sonner";

const ATMOSPHERE_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663468975365/JXRW8Prgas3RMo8cBvY8Y3/hero_gradient_bloom-HfQFaW3SyLJAbUW6xU4oJT.webp";

function useQuery() {
  const search = useSearch();
  return useMemo(() => new URLSearchParams(search), [search]);
}

interface AuditState {
  id: string;
  url: string;
  role: string;
  pro: boolean;
  report: AuditReport;
  ownerIdentity: string;
}

export default function Audit() {
  const params = useQuery();
  const auditId = params.get("id");
  const [identity, setIdentity] = useState<string | undefined>();
  const [accessIntent, setAccessIntent] = useState<{
    reportId: string;
    categoryKey: string;
    originIdentity: string;
  } | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [accessNeedsGoogle, setAccessNeedsGoogle] = useState(false);
  const [categoryToOpen, setCategoryToOpen] = useState<{
    reportId: string;
    key: string;
    nonce: number;
  } | null>(null);
  const accessGeneration = useRef(0);
  const accessOpener = useRef<HTMLElement | null>(null);
  const accessFlow = useRef<{
    reportId: string;
    controller: AbortController;
    accountUid: string | null;
  } | null>(null);
  const completedReports = useRef(new Map<string, string>());
  const continuedReport = useRef<{ id: string; owner: string } | null>(null);
  useEffect(
    () =>
      subscribeAuth(user => {
        const nextIdentity = user?.uid ?? "anonymous";
        const flow = accessFlow.current;
        if (flow?.accountUid && flow.accountUid !== nextIdentity) {
          flow.controller.abort();
          accessFlow.current = null;
          accessGeneration.current += 1;
          setAccessBusy(false);
          setAccessError(
            "Your account changed. Try again with the account you want to use for this report."
          );
        }
        setIdentity(nextIdentity);
      }),
    []
  );
  useEffect(
    () => () => {
      accessGeneration.current += 1;
      accessFlow.current?.controller.abort();
    },
    []
  );

  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem("portfoliograded:pro") === "1"; // cosmetic cache; server re-verifies
    } catch {
      return false;
    }
  });

  // REAL entitlement: ask the server (Firebase token → Stripe record).
  // Runs on mount and whenever sign-in state changes.
  useEffect(() => {
    let live = true;
    let request = 0;
    const sync = () => {
      const generation = ++request;
      setUnlocked(false);
      void fetchMe().then(me => {
        if (live && request === generation) setUnlocked(me.pro);
      });
    };
    sync();
    const unsub = subscribeAuth(sync);
    return () => {
      live = false;
      unsub();
    };
  }, []);

  // Back from Stripe: ?checkout=success&session_id=cs_... → confirm server-side.
  useEffect(() => {
    const sessionId = params.get("session_id");
    if (params.get("checkout") !== "success" || !sessionId) return;
    // Wait for Firebase to restore the session before confirming.
    const unsub = subscribeAuth(u => {
      if (!u) return;
      void confirmCheckout(sessionId).then(ok => {
        if (ok) {
          setUnlocked(true);
          toast.success("Welcome to Pro", {
            description: "Pro access confirmed. Re-grade when ready.",
          });
        } else {
          toast.error("We couldn't confirm the payment", {
            description: "If you were charged, refresh in a minute.",
          });
        }
        window.history.replaceState(
          null,
          "",
          window.location.pathname +
            window.location.search.replace(
              /[?&]checkout=[^&]*(&session_id=[^&]*)?/,
              ""
            )
        );
      });
      unsub();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [storedAudit, setAudit] = useState<AuditState | null>(null);
  const audit = storedAudit?.ownerIdentity === identity ? storedAudit : null;
  const [previous, setPrevious] = useState<{
    owner: string;
    report: SavedReportSummary;
  } | null>(null);
  const previousReport =
    previous && previous.owner === identity ? previous.report : null;
  const [showLessons, setShowLessons] = useState(Boolean(params.get("url")));
  const startedOwners = useRef(new Map<string, string>());
  const [scanning, setScanning] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [view, setView] = useState<"web" | "mobile">("web");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [, navigate] = useLocation();

  /** "Next time" pills: role-specific re-runs are FREE (Nic, Jul 11). */
  function handleRolePill(r: string) {
    const target = audit?.url ?? startUrl;
    if (!target) return;
    navigate(
      `/audit?url=${encodeURIComponent(target)}&role=${encodeURIComponent(r)}${isProUser() ? "&pro=1" : ""}`
    );
  }

  // Two entry modes:
  //  - ?id=...            → fetch a stored audit
  //  - ?url=...&role=...  → START the audit here, so the scanning screen
  //                         (device previews + rotating quotes) plays while
  //                         the real crawl + AI grading runs on the server.
  const startUrl = params.get("url");
  const startRole = params.get("role") || "Creative";
  const startPro = params.get("pro") === "1";
  const startBuilder = params.get("builder") || undefined;
  const runToken = params.get("run");

  useEffect(() => {
    if (identity === undefined) return;
    const requestKey = JSON.stringify([
      startUrl,
      startRole,
      startBuilder,
      runToken,
    ]);
    const readId = auditId ?? completedReports.current.get(requestKey);
    if (continuedReport.current) {
      const continued = continuedReport.current;
      continuedReport.current = null;
      if (continued.id === readId && continued.owner === identity) return;
    }
    if (accessFlow.current) {
      if (readId === accessFlow.current.reportId) {
        // The explicit claim flow owns this exact reload. Old private state
        // is invalidated without starting a second assessment for the account.
        setAudit(current =>
          current?.ownerIdentity === identity ? current : null
        );
        setPrevious(null);
        setScanning(false);
        return;
      }
      accessFlow.current.controller.abort();
      accessFlow.current = null;
      accessGeneration.current += 1;
      setAccessBusy(false);
      setAccessOpen(false);
    }
    setAudit(null);
    setPrevious(null);
    setFetchError(null);
    if (!readId && !startUrl) {
      setFetchError("No audit found. Start a new audit from the home page.");
      setScanning(false);
      return;
    }

    const controller = new AbortController();
    const startedAt = Date.now();
    // A changed account cancels this browser's continuation, not server work.
    // Never automatically charge another review to the new identity.
    if (!readId) {
      const owner = startedOwners.current.get(requestKey);
      if (owner && owner !== identity) {
        setFetchError(
          "Your account changed during this review. Open your saved reports in the browser or account that started it. A second review was not started."
        );
        setScanning(false);
        return;
      }
      startedOwners.current.set(requestKey, identity);
      setShowLessons(true);
    }
    setScanning(true);

    if (!readId && startUrl) {
      void getAuthHeader()
        .then(headers => {
          if (controller.signal.aborted) return null;
          return fetch("/api/audits", { headers, signal: controller.signal });
        })
        .then(async response =>
          response?.ok
            ? (response.json() as Promise<{ reports: SavedReportSummary[] }>)
            : null
        )
        .then(data => {
          if (controller.signal.aborted || !data) return;
          const match = selectPreviousReport(
            data.reports,
            startUrl,
            startRole,
            startedAt
          );
          if (match) setPrevious({ owner: identity, report: match });
        })
        .catch(() => {
          /* History is optional; never block the new review. */
        });
    }

    void (async () => {
      try {
        const headers = await getAuthHeader();
        if (controller.signal.aborted) return;
        let response = readId
          ? await fetch(`/api/audits/${encodeURIComponent(readId)}`, {
              headers,
              signal: controller.signal,
            })
          : await fetch("/api/audits", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...headers },
              body: JSON.stringify({
                url: startUrl,
                role: startRole,
                builder: startBuilder,
              }),
              signal: controller.signal,
            });
        if (response.status === 202 && !readId) {
          const queued = await response.json() as { jobId?: string };
          if (!queued.jobId || !/^[a-f0-9]{48}$/.test(queued.jobId)) throw new Error("The scan could not start. Please try again.");
          const deadline = Date.now() + 8 * 60_000;
          while (Date.now() < deadline) {
            await new Promise<void>((resolve,reject) => {
              const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted","AbortError")); };
              const timer = setTimeout(() => { controller.signal.removeEventListener("abort",abort); resolve(); },3000);
              if (controller.signal.aborted) abort();
              else controller.signal.addEventListener("abort",abort,{once:true});
            });
            response = await fetch(`/api/audits/jobs/${queued.jobId}`,{headers,signal:controller.signal});
            if (response.status === 202) continue;
            if (!response.ok) break;
            const completed = await response.json() as { reportId?: string };
            if (!completed.reportId || !/^[A-Za-z0-9_-]{24}$/.test(completed.reportId)) throw new Error("The report could not be opened. Check your saved reports.");
            response = await fetch(`/api/audits/${completed.reportId}`,{headers,signal:controller.signal});
            break;
          }
          if (response.status === 202) throw new Error("This scan is taking longer than expected. Check your saved reports shortly.");
        }
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as {
            reason?: string;
          };
          throw new Error(
            readId && response.status === 404
              ? "This review is not available in this browser or account. Open it where you created it, or start a new review."
              : (data.reason ??
                  "The review could not load. Your previous reports are still saved.")
          );
        }
        const data = (await response.json()) as AuditState;
        if (controller.signal.aborted) return;
        if (!readId && data.id)
          completedReports.current.set(requestKey, data.id);
        setAudit({
          ...data,
          url: data.url ?? data.report.url,
          role: data.role ?? data.report.role,
          pro: data.pro ?? startPro,
          ownerIdentity: identity,
        });
        setScanning(false);
        if (!auditId && data.id)
          window.history.replaceState(
            null,
            "",
            `/audit?id=${encodeURIComponent(data.id)}`
          );
      } catch (error) {
        if (controller.signal.aborted) return;
        setFetchError(
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again."
        );
        setScanning(false);
      }
    })();
    return () => controller.abort();
  }, [
    auditId,
    startUrl,
    startRole,
    startPro,
    startBuilder,
    identity,
    runToken,
  ]);

  function requireCategoryAccount(categoryKey: string) {
    if (!audit) return;
    accessOpener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    completedReports.current.set(
      JSON.stringify([startUrl, startRole, startBuilder, runToken]),
      audit.id
    );
    setAccessIntent({
      reportId: audit.id,
      categoryKey,
      originIdentity: identity ?? "anonymous",
    });
    setAccessNeedsGoogle(false);
    setAccessError("");
    setAccessOpen(true);
  }

  function closeReportAccess(open: boolean) {
    setAccessOpen(open);
    if (!open) {
      accessGeneration.current += 1;
      accessFlow.current?.controller.abort();
      accessFlow.current = null;
      setAccessBusy(false);
      // Keep the exact report/category intention so retry never becomes a scan.
    }
  }

  async function openAccountFeedback() {
    if (!accessIntent || accessBusy) return;
    const intent = accessIntent;
    const generation = ++accessGeneration.current;
    const controller = new AbortController();
    const flow = {
      reportId: intent.reportId,
      controller,
      accountUid: auth.currentUser?.uid ?? null,
    };
    accessFlow.current = flow;
    setAccessBusy(true);
    setAccessError("");
    try {
      const user =
        !accessNeedsGoogle && auth.currentUser
          ? auth.currentUser
          : await signInWithGoogle();
      if (generation !== accessGeneration.current || controller.signal.aborted)
        return;
      flow.accountUid = user.uid;
      const data = await continueSavedReport<AuditState>(
        {
          reportId: intent.reportId,
          accountUid: user.uid,
          canClaimGuestReport: intent.originIdentity === "anonymous",
          signal: controller.signal,
        },
        {
          currentUid: () => auth.currentUser?.uid ?? null,
          getHeaders: getAuthHeader,
          request: (input, init) => fetch(input, init),
        }
      );
      if (generation !== accessGeneration.current || controller.signal.aborted)
        return;
      if (
        data.report.categories.find(
          category => category.key === intent.categoryKey
        )?.access === "free-account-required"
      ) {
        throw new ReportContinuationError(
          "google_account_required",
          "Continue with a verified Google account to open this feedback."
        );
      }
      continuedReport.current = { id: intent.reportId, owner: user.uid };
      setIdentity(user.uid);
      setAudit({
        ...data,
        url: data.url ?? data.report.url,
        role: data.role ?? data.report.role,
        pro: data.pro === true,
        ownerIdentity: user.uid,
      });
      setFetchError(null);
      setScanning(false);
      setCategoryToOpen({
        reportId: intent.reportId,
        key: intent.categoryKey,
        nonce: generation,
      });
      setAccessOpen(false);
    } catch (error) {
      if (generation !== accessGeneration.current || controller.signal.aborted)
        return;
      if (
        error instanceof ReportContinuationError &&
        error.code === "google_account_required"
      )
        setAccessNeedsGoogle(true);
      setAccessError(reportSignInMessage(error));
    } finally {
      if (generation === accessGeneration.current) {
        accessFlow.current = null;
        setAccessBusy(false);
      }
    }
  }

  const reportAccessDialog = (
    <ReportAccessDialog
      open={accessOpen}
      onOpenChange={closeReportAccess}
      busy={accessBusy}
      error={accessError}
      onContinue={() => void openAccountFeedback()}
      signedIn={Boolean(
        identity && identity !== "anonymous" && !accessNeedsGoogle
      )}
      onReturnFocus={() => {
        if (!categoryToOpen && accessOpener.current?.isConnected)
          accessOpener.current.focus();
      }}
    />
  );

  // Real unlock happens via Stripe (UpgradeDialog handles checkout); this
  // stays as the dialog's legacy onConfirm no-op.
  function handleUnlock() {}

  function handleReaudit() {
    if (!audit || scanning) return;
    navigate(
      `/audit?url=${encodeURIComponent(audit.url)}&role=${encodeURIComponent(audit.role)}&run=${Date.now()}`
    );
  }

  function handleExport() {
    window.print();
  }

  const report = !scanning ? (audit?.report ?? null) : null;
  const url = audit?.url ?? "";

  // Fetch the immutable captures attached to this report. Reopening does not render again.
  const targetUrl = startUrl || audit?.url || "";
  const [shotErrors, setShotErrors] = useState<{
    web?: boolean | "unavailable";
    mobile?: boolean | "unavailable";
  }>({});
  const [shotAttempt, setShotAttempt] = useState(0);
  const [webShot, setWebShot] = useState<string | undefined>();
  const [mobileShot, setMobileShot] = useState<string | undefined>();
  useEffect(() => {
    const controller = new AbortController();
    const created: string[] = [];
    setShotErrors({});
    setWebShot(undefined);
    setMobileShot(undefined);
    if (!audit) return () => controller.abort();
    const setters = { web: setWebShot, mobile: setMobileShot } as const;
    for (const device of ["web", "mobile"] as const) {
      if (!audit.report.rendered?.devices[device].capture) {
        setShotErrors(errors => ({ ...errors, [device]: "unavailable" }));
        continue;
      }
      void getAuthHeader()
        .then(headers =>
          fetch(
            `/api/audits/${encodeURIComponent(audit.id)}/screenshot?device=${device}`,
            { headers, signal: controller.signal }
          )
        )
        .then(response => {
          if (!response.ok) throw new Error("saved_preview_unavailable");
          return response.blob();
        })
        .then(blob => {
          if (controller.signal.aborted) return;
          const image = URL.createObjectURL(blob);
          created.push(image);
          setters[device](image);
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setShotErrors(errors => ({ ...errors, [device]: true }));
        });
    }
    return () => {
      controller.abort();
      created.forEach(image => URL.revokeObjectURL(image));
    };
  }, [audit, shotAttempt]);

  const shots = { web: webShot, mobile: mobileShot };

  // ---- Suggestion history: past runs + persistent fix list for this URL ----
  const [historyRecord, setHistoryData] = useState<{
    ownerIdentity: string;
    auditId: string;
    runs: {
      id: string;
      at: string;
      overall: number;
      overallGrade: string;
      categories: { key: string; score: number }[];
    }[];
    suggestions: Record<
      string,
      import("@/components/FixList").HistorySuggestion
    >;
    bestAchieved?: BestAchieved;
  } | null>(null);

  const historyData =
    historyRecord &&
    historyRecord.ownerIdentity === identity &&
    historyRecord.auditId === audit?.id
      ? historyRecord
      : null;

  useEffect(() => {
    setHistoryData(null);
    if (!audit) return;
    let active = true;
    getAuthHeader()
      .then(headers =>
        fetch(
          `/api/history?url=${encodeURIComponent(audit.url)}&role=${encodeURIComponent(audit.role)}`,
          { headers }
        )
      )
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (active && data)
          setHistoryData({
            ...data,
            ownerIdentity: audit.ownerIdentity,
            auditId: audit.id,
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [audit]);

  // The run to compare against = latest run that isn't this one.
  const currentRunIndex =
    historyData?.runs.findIndex(run => run.id === audit?.id) ?? -1;
  const previousRun =
    currentRunIndex > 0 ? historyData!.runs[currentRunIndex - 1] : null;
  const overallDelta =
    previousRun && report ? report.overall - previousRun.overall : null;
  const prevScores: Record<string, number> = {};
  if (previousRun)
    for (const c of previousRun.categories) prevScores[c.key] = c.score;

  // Progress INSIDE a letter grade: points to the next letter, so a B → B
  // re-grade still feels like movement.
  const GRADE_STEPS: [number, string][] = [
    [67, "C-"],
    [70, "C"],
    [73, "C+"],
    [77, "B-"],
    [80, "B"],
    [83, "B+"],
    [87, "A-"],
    [90, "A"],
    [95, "A+"],
  ];
  const nextStep = report
    ? GRADE_STEPS.find(([t]) => report.overall < t)
    : undefined;
  const assessment = report?.assessment;
  const validDate = (value: string | undefined) =>
    value && Number.isFinite(Date.parse(value))
      ? new Date(value).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;
  const acceptedDate = validDate(assessment?.acceptedAt);
  const checkedDate = validDate(assessment?.checkedAt);
  const bestAchieved =
    historyData?.bestAchieved &&
    historyData.bestAchieved.methodVersion === assessment?.methodVersion
      ? historyData.bestAchieved
      : null;

  // Error state. no audit id or fetch failed
  if (!scanning && (fetchError || !report)) {
    return (
      <div className="relative min-h-screen overflow-x-hidden">
        <SiteHeader onUpgrade={() => setUpgradeOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="container pt-12 sm:pt-20"
        >
          <div className="glass-strong mx-auto flex max-w-2xl flex-col items-start gap-5 rounded-[2rem] p-6 sm:p-8">
            <p className="pg-brand-eyebrow">Your portfolio review</p>
            <h1 className="pg-page-title">
              {accessIntent
                ? "Your saved report is still here."
                : "We couldn’t open this report."}
            </h1>
            <p role="status" className="leading-relaxed text-muted-foreground">
              {fetchError ??
                (accessIntent
                  ? "Continue to open this report with your account. A new review will not be started."
                  : "Audit not found.")}
            </p>
            {accessIntent && (
              <button
                type="button"
                onClick={() => setAccessOpen(true)}
                className="pg-action"
              >
                Continue to my feedback
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="pg-action w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" /> Start a new audit
            </button>
            <a href="/reports" className="pg-action-secondary">
              Open saved reports
            </a>
          </div>
          {previousReport && (
            <PreviousReportCard
              report={previousReport}
              className="mx-auto mt-5 max-w-2xl"
            />
          )}
        </main>
        <SiteFooter />
        {reportAccessDialog}
        <UpgradeDialog
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          onConfirm={handleUnlock}
        />
      </div>
    );
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

      <main
        id="main-content"
        tabIndex={-1}
        className="container pt-10 sm:pt-14"
      >
        {/* Top bar with breadcrumb and actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="pg-action-secondary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> New audit
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleReaudit}
              disabled={scanning}
              className="pg-action-secondary"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Re-run
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={scanning}
              className="pg-action-secondary"
            >
              <Download className="h-3.5 w-3.5" /> Print / save PDF
            </button>
          </div>
        </div>

        {audit && !scanning && (
          <ReportChangeCheck
            key={audit.id}
            id={audit.id}
            createdAt={audit.report.generatedAt}
            onReview={() => void handleReaudit()}
          />
        )}

        {/* Hero grade card */}
        <section className="mt-6">
          <div className="glass-strong relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
            <div
              aria-hidden
              className="grad-flowerboy pointer-events-none absolute inset-x-10 top-0 h-[2px] rounded-full opacity-90"
            />
            <div className="grid items-center gap-8 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <p className="pg-brand-eyebrow">
                  {scanning
                    ? "Your portfolio review"
                    : `${report?.verification ? "Homepage preview" : "Saved report"} · ${new URL(url || "https://placeholder.com").hostname}`}
                </p>
                <h1
                  role={scanning ? "status" : undefined}
                  className="mt-3 break-words font-display text-[2.4rem] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-6xl"
                >
                  {scanning
                    ? auditId && !audit
                      ? "Opening your saved review…"
                      : "Scanning your portfolio…"
                    : report!.headline === "Your homepage preview is ready."
                      ? "Your grade is ready."
                      : report!.headline}
                </h1>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {scanning
                    ? auditId && !audit
                      ? "Restoring your saved feedback and checklist."
                      : "Checking your homepage and getting both previews. Your feedback will appear here."
                    : report!.subhead === "Your grades are visible. Sign in for the full feedback. No payment required."
                      ? "Sign in for full feedback. It’s free."
                      : report!.subhead}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-md">
                    Role:{" "}
                    <span className="text-foreground">
                      {(report?.role ?? startRole) === "Creative"
                        ? "General portfolio"
                        : (report?.role ?? startRole)}
                    </span>
                  </span>
                  {!scanning && overallDelta !== null && previousRun ? (
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-bold backdrop-blur-md",
                        overallDelta > 0
                          ? "bg-[oklch(0.78_0.16_140_/_0.2)] text-[oklch(0.35_0.1_140)]"
                          : overallDelta < 0
                            ? "bg-[oklch(0.7_0.18_30_/_0.15)] text-[oklch(0.45_0.14_30)]"
                            : "bg-white/70 text-muted-foreground"
                      )}
                    >
                      {overallDelta > 0
                        ? `▲ +${overallDelta}`
                        : overallDelta < 0
                          ? `▼ ${overallDelta}`
                          : "= same score"}{" "}
                      since{" "}
                      {new Date(previousRun.at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      {previousRun.overallGrade !== report?.overallGrade
                        ? ` (${previousRun.overallGrade} → ${report?.overallGrade})`
                        : ""}
                    </span>
                  ) : null}
                  {!scanning && report && nextStep ? (
                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-md">
                      {nextStep[0] - report.overall} point
                      {nextStep[0] - report.overall === 1 ? "" : "s"} from{" "}
                      <span className="text-foreground">{nextStep[1]}</span>
                    </span>
                  ) : null}
                  {unlocked ? (
                    <span className="foil rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[oklch(0.2_0.04_50)]">
                      Pro tier active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setUpgradeOpen(true)}
                      className="pg-action-secondary gap-1.5 px-3 py-2 text-xs uppercase tracking-wider"
                    >
                      <Sparkles className="h-3 w-3" /> About Pro
                    </button>
                  )}
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="flex items-center justify-center">
                  {scanning ? (
                    <div
                      aria-hidden="true"
                      className="grid h-44 w-44 place-items-center rounded-full bg-white/60 backdrop-blur-md sm:h-52 sm:w-52"
                    >
                      <div
                        className="h-32 w-32 motion-safe:animate-spin rounded-full border-[6px] border-transparent sm:h-40 sm:w-40"
                        style={{
                          borderTopColor: "oklch(0.86 0.16 75)",
                          borderRightColor: "oklch(0.82 0.14 55)",
                          borderBottomColor: "oklch(0.88 0.14 95)",
                        }}
                      />
                    </div>
                  ) : (
                    <div className="origin-center sm:scale-125 lg:scale-150">
                      <GradePill
                        grade={report!.overallGrade}
                        size="xl"
                        className="max-sm:px-8 max-sm:text-[5.5rem]"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {report && assessment && (
          <section
            aria-label="Assessment record"
            className="glass mt-4 rounded-2xl p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="pg-brand-eyebrow">Current assessment</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-2 font-display text-2xl font-bold">
                  {report.overallGrade}
                  <span className="font-sans text-sm font-medium text-muted-foreground">
                    {report.overall}/100
                  </span>
                </p>
                {acceptedDate && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Accepted {acceptedDate}
                  </p>
                )}
              </div>
              {bestAchieved && (
                <div>
                  <p className="pg-brand-eyebrow">Best achieved</p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-2 font-display text-2xl font-bold">
                    {bestAchieved.overallGrade}
                    <span className="font-sans text-sm font-medium text-muted-foreground">
                      {bestAchieved.overall}/100
                    </span>
                  </p>
                  {validDate(bestAchieved.at) && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {validDate(bestAchieved.at)} · same field and grading
                      method
                    </p>
                  )}
                </div>
              )}
            </div>
            {assessment.status !== "new" && acceptedDate && checkedDate && (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {assessment.status === "reused"
                  ? `The accepted assessment from ${acceptedDate} was reused after checking the supported homepage evidence on ${checkedDate}. This does not verify every page or interaction.`
                  : `The accepted assessment from ${acceptedDate} was kept because the evidence checked on ${checkedDate} was incomplete. A new grade was not substituted.`}
              </p>
            )}
          </section>
        )}

        {report && (
          <details
            className="glass mt-4 rounded-2xl px-5"
            aria-label="What this review checked"
          >
            <summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold leading-relaxed">
              {report.verification ? "Homepage preview" : "Historical report"} ·
              What we checked
            </summary>
            <div className="space-y-3 border-t border-foreground/10 py-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                {report.verification
                  ? `The grade uses homepage HTML signals. Rubric ${report.verification.rubricVersion} · ${report.verification.rubricKey}. ${report.verification.aiEnrichment === "succeeded" ? "AI helped write the feedback." : "Feedback uses basic rules; AI explanations were unavailable."}`
                  : "This older report has no verified review-scope record. A fresh review uses the current method."}
              </p>
              <p>
                Saved desktop and phone previews include opening-view browser
                observations when capture succeeds. Project pages, visual
                quality, complete usability and actual loading speed have not
                been verified.
              </p>
              <a
                href="/how-to#what-we-check"
                className="inline-flex min-h-11 items-center rounded-full font-semibold text-foreground underline underline-offset-4"
              >
                How the grading works
              </a>
            </div>
          </details>
        )}

        {showLessons && (
          <section className="mt-6" aria-label="While you review">
            {previousReport && (
              <PreviousReportCard report={previousReport} className="mb-5" />
            )}
            {!scanning && report && (
              <p
                role="status"
                className="mb-4 flex flex-wrap items-center gap-x-3 text-sm"
              >
                Your grade is ready. Keep reading, or jump in.
                <a href="#report-details" className="pg-action-secondary">
                  View your report{" "}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </p>
            )}
            <PortfolioLessons scanning={scanning} />
          </section>
        )}

        {report && (
          <p className="mt-5 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
            <MessageCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Need a word explained? Highlight it and choose{" "}
              <strong className="text-foreground">Explain this</strong>. Ask Nic
              opens with your question ready to review.
            </span>
          </p>
        )}

        {/* Device preview + key metrics */}
        {report && (
          <section
            id="report-details"
            className="mt-10 scroll-mt-28 grid gap-6 lg:grid-cols-12"
          >
            <div className="lg:col-span-7">
              <DevicePreview
                url={url || targetUrl}
                view={view}
                onView={setView}
                scanning={scanning}
                shots={shots}
                errors={shotErrors}
                onRetry={() => setShotAttempt(n => n + 1)}
                capturedAt={report?.rendered?.devices[view].capture?.capturedAt}
              />
              {report && !scanning && (
                <RenderedEvidence review={report.rendered} view={view} />
              )}
            </div>
            <div className="lg:col-span-5 grid gap-4 content-start">
              {!scanning && report && !rubricForRole(report.role) ? (
                <div
                  className="relative overflow-hidden rounded-3xl p-5"
                  style={{
                    background:
                      "linear-gradient(120deg, oklch(0.86 0.14 60), oklch(0.9 0.13 80), oklch(0.92 0.11 95))",
                    boxShadow:
                      "inset 0 1px 0 oklch(1 0 0 / 0.85), 0 14px 30px -14px oklch(0.7 0.16 65 / 0.55)",
                  }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[oklch(0.32_0.06_55)]">
                    Next time
                  </p>
                  <p className="mt-1.5 font-display text-lg font-bold leading-snug text-[oklch(0.2_0.04_50)]">
                    This review used general guidelines. Choose a field next
                    time to use its own grading rubric.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ROLE_PRESETS.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleRolePill(r)}
                        className="rounded-full bg-white/70 px-3 py-2.5 min-h-11 text-xs font-semibold text-[oklch(0.25_0.05_55)] transition hover:bg-white"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {/* Love / Next step / Keep in mind / Won't wait — expandable */}
              {report
                ? (() => {
                    const byScore = report.categories
                      .filter(c =>
                        c.access ? c.access === "open" : !c.premium || unlocked
                      )
                      .sort((a, b) => b.score - a.score);
                    if (byScore.length === 0) return null;
                    const best = byScore[0];
                    const worst = byScore[byScore.length - 1];
                    const mid =
                      [...byScore]
                        .sort((a, b) => a.score - b.score)
                        .find(c => c.key !== worst.key && c.score < 90) ??
                      worst;
                    const mobileCat = byScore.find(c => c.key === "mobile");
                    const cards = [
                      best && {
                        eyebrow: "What we love",
                        color: "oklch(0.78 0.16 140)",
                        title: best.title,
                        line: "A stronger signal in this initial scan. Check the evidence before deciding what to keep.",
                        details: best.details,
                      },
                      mid && {
                        eyebrow: "Your next step",
                        color: "oklch(0.86 0.16 85)",
                        title: mid.title,
                        line: mid.recommendation.split(".")[0] + ".",
                        details: mid.details,
                      },
                      {
                        eyebrow: "Keep in mind",
                        color: "oklch(0.75 0.15 55)",
                        title:
                          mobileCat && mobileCat.score < 85
                            ? "Phones come first"
                            : "Recruiters skim fast",
                        line:
                          mobileCat && mobileCat.score < 85
                            ? "Open the mobile preview: check readable text, easy navigation and images that fit the screen."
                            : "Make your role and strongest work easy to find on a quick first pass.",
                        details:
                          mobileCat && mobileCat.score < 85
                            ? mobileCat.details
                            : undefined,
                      },
                      worst.score < 80 &&
                        worst.key !== mid.key && {
                          eyebrow: "Also worth checking",
                          color: "oklch(0.7 0.18 30)",
                          title: worst.title,
                          line: worst.recommendation.split(".")[0] + ".",
                          details: worst.details,
                        },
                    ].filter(Boolean) as {
                      eyebrow: string;
                      color: string;
                      title: string;
                      line: string;
                      details?: {
                        label: string;
                        status: string;
                        note: string;
                      }[];
                    }[];
                    return cards.map(c => <TrioCard key={c.eyebrow} {...c} />);
                  })()
                : null}
            </div>
          </section>
        )}

        {/* Category breakdown */}
        {report && (
          <section className="mt-14">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="pg-brand-eyebrow">Your tier list</p>
                <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
                  Where every category ranks.
                </h2>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                  Click a category to see what the initial scan found and what
                  to improve next.
                </p>
                {(() => {
                  const rubric = report ? rubricForRole(report.role) : null;
                  const tier = report
                    ? report.overallGrade === "S"
                      ? ("S" as const)
                      : (report.overallGrade[0] as "A" | "B" | "C" | "D")
                    : ("D" as const);
                  const anchor = report ? anchorAbove(rubric?.key, tier) : null;
                  return anchor && rubric ? (
                    <a
                      href={anchor.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() =>
                        track("anchor_clicked", {
                          role: rubric.key,
                          tier: anchor.tier,
                        })
                      }
                      className="pg-action-secondary mt-3"
                    >
                      Explore a {rubric.label} example (editorial reference) →
                    </a>
                  ) : null;
                })()}
              </div>
              {!unlocked ? (
                <button
                  type="button"
                  onClick={() => setUpgradeOpen(true)}
                  className="pg-action-secondary hidden sm:inline-flex"
                >
                  <Zap className="h-4 w-4" /> About Pro
                </button>
              ) : null}
            </div>
            <div className="mt-8">
              <CategoryGrid
                categories={report.categories}
                unlocked={unlocked}
                onUpgrade={() => setUpgradeOpen(true)}
                prevScores={previousRun ? prevScores : undefined}
                standouts={report.standouts}
                onRequireAccount={requireCategoryAccount}
                resumeCategory={
                  categoryToOpen?.reportId === audit?.id ? categoryToOpen : null
                }
                onResumeConsumed={() => setCategoryToOpen(null)}
              />
            </div>
          </section>
        )}

        {/* Persistent fix list. check off suggestions between grades */}
        {report &&
          historyData &&
          Object.keys(historyData.suggestions ?? {}).length > 0 && (
            <section className="mt-10">
              <FixList
                key={`${audit?.id}:${identity}`}
                role={audit?.role || "Creative"}
                url={audit?.url ?? targetUrl}
                suggestions={Object.values(historyData.suggestions).filter(
                  s => {
                    if (!s.done && s.lastSeen !== historyData.runs.at(-1)?.at)
                      return false;
                    if (s.access !== "free-account-required") return true;
                    // Claiming this report cannot transfer another report's private
                    // feedback. Only offer its own D feedback in this continuation.
                    const currentAt = historyData.runs.find(
                      run => run.id === audit?.id
                    )?.at;
                    const belongsToCurrent = s.auditIds
                      ? s.auditIds.includes(audit?.id ?? "")
                      : s.lastSeen === currentAt;
                    return (
                      belongsToCurrent &&
                      report.categories.some(category => category.grade === "D")
                    );
                  }
                )}
                nextGrade={
                  nextStep && report
                    ? {
                        points: nextStep[0] - report.overall,
                        grade: nextStep[1],
                      }
                    : undefined
                }
                unlocked={unlocked}
                onUpgrade={() => setUpgradeOpen(true)}
                onRequireAccount={categoryKeys => {
                  const dCategories = report.categories.filter(
                    category => category.grade === "D"
                  );
                  const target =
                    dCategories.find(category =>
                      categoryKeys.includes(category.key)
                    ) ?? dCategories[0];
                  if (target) requireCategoryAccount(target.key);
                }}
              />
            </section>
          )}

        {/* Closing CTA */}
        {report && (
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
                      <>
                        Your next step is clear.{" "}
                        <span className="grad-text">Try the fixes.</span>
                      </>
                    ) : (
                      <>
                        Ready for a deeper review?{" "}
                        <span className="grad-text">
                          Pro is in development.
                        </span>
                      </>
                    )}
                  </h2>
                  <p className="mt-3 max-w-xl text-muted-foreground">
                    {unlocked
                      ? "Re-audit anytime as you ship changes. The score reflects the new scan, and may rise or fall."
                      : "Deeper project reviews are in development. Planned pricing is $9.99/month or $49.99/year. Payments are off during the preview."}
                  </p>
                </div>
                <div className="lg:col-span-4 flex justify-start lg:justify-end">
                  {unlocked ? (
                    <button
                      type="button"
                      onClick={handleReaudit}
                      className="pg-action w-full sm:w-auto"
                    >
                      <RefreshCw className="h-4 w-4" /> Re-run audit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setUpgradeOpen(true)}
                      className="pg-action w-full sm:w-auto"
                    >
                      <Sparkles className="h-4 w-4" /> About Pro
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
      {reportAccessDialog}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onConfirm={handleUnlock}
      />
    </div>
  );
}

/** Expandable love/next/mind/wait card. */
function TrioCard({
  eyebrow,
  color,
  title,
  line,
  details,
}: {
  eyebrow: string;
  color: string;
  title: string;
  line: string;
  details?: { label: string; status: string; note: string }[];
}) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(details && details.length);
  return (
    <button
      type="button"
      onClick={() => expandable && setOpen(v => !v)}
      aria-expanded={expandable ? open : undefined}
      className={cn(
        "glass relative overflow-hidden rounded-3xl p-5 text-left",
        expandable && "cursor-pointer"
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: color }}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </p>
        {expandable ? (
          <span className="text-xs font-bold text-muted-foreground">
            {open ? "−" : "+"}
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold tracking-tight">
        {title}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{line}</p>
      {open && details ? (
        <div className="mt-3 grid gap-1.5">
          {details.map(d => (
            <p key={d.label} className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{d.label}:</span>{" "}
              {d.note}
            </p>
          ))}
        </div>
      ) : null}
    </button>
  );
}
