import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, History } from "lucide-react";
import { auth, getAuthHeader, subscribeAuth } from "@/lib/firebase";
import { readOwnedReportJson } from "@/lib/ownedReportRead";
import { GradePill } from "@/components/GradePill";
import { SignInDialog } from "@/components/SignInDialog";
import type { GradeLetter } from "@/lib/audit";
import type { SavedReportSummary } from "@shared/reportHistory";

export function SavedReports({ compact = false }: { compact?: boolean }) {
  const [reports, setReports] = useState<SavedReportSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [signedIn, setSignedIn] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const signInTrigger = useRef<HTMLButtonElement>(null);
  const [reportOwner, setReportOwner] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let request = 0;
    let disposed = false;
    let pending: AbortController | undefined;
    const unsub = subscribeAuth(user => {
      pending?.abort();
      const ownRequest = ++request;
      const owner = user?.uid ?? null,
        controller = new AbortController();
      pending = controller;
      setSignedIn(Boolean(user));
      setReportOwner(owner);
      setReports([]);
      setStatus("loading");
      void readOwnedReportJson<{ reports: SavedReportSummary[] }>(
        "/api/audits",
        {
          owner,
          currentOwner: () => auth.currentUser?.uid ?? null,
          getHeaders: getAuthHeader,
          signal: controller.signal,
        }
      )
        .then(data => {
          if (!Array.isArray(data.reports))
            throw new Error("Invalid report list");
          if (
            !disposed &&
            !controller.signal.aborted &&
            request === ownRequest
          ) {
            setReports(data.reports);
            setStatus("ready");
          }
        })
        .catch(() => {
          if (!disposed && !controller.signal.aborted && request === ownRequest)
            setStatus("error");
        });
    });
    return () => {
      disposed = true;
      ++request;
      pending?.abort();
      unsub();
    };
  }, [attempt]);
  const ownedReports =
    reportOwner === (auth.currentUser?.uid ?? null) ? reports : [];
  const visible = compact ? ownedReports.slice(0, 2) : ownedReports;
  return (
    <section
      aria-label="Your saved reports"
      className="glass rounded-[2rem] p-6 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          <History aria-hidden className="h-5 w-5 shrink-0" />
          Your saved reports
        </h2>
        {compact && (
          <Link href="/reports" className="pg-action-secondary">
            View all <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        )}
      </div>
      {!compact && (
        <p className="mt-2 text-sm text-muted-foreground">
          {signedIn
            ? "Saved to this account. Open a report without running another scan."
            : "Saved for this browser. Reports created while signed in stay with that account."}
        </p>
      )}
      {status === "loading" && (
        <p role="status" className="mt-4 text-sm">
          Finding your reports…
        </p>
      )}
      {status === "error" && (
        <div role="status" className="mt-4 text-sm">
          <p>Your reports could not load. Nothing was removed.</p>
          <button
            type="button"
            onClick={() => setAttempt(value => value + 1)}
            className="pg-action-secondary mt-2"
          >
            Try again
          </button>
        </div>
      )}
      {status === "ready" && !visible.length && (
        <div className="mt-4 rounded-xl bg-background p-4 text-sm leading-relaxed">
          {signedIn ? (
            <p>Your first report will appear here.</p>
          ) : (
            <>
              <p>Sign in to keep your reports together.</p>
              <p className="mt-1 text-muted-foreground">
                New reports will be saved to your account.
              </p>
              <button
                ref={signInTrigger}
                type="button"
                onClick={() => setSignInOpen(true)}
                className="pg-action-secondary mt-3"
              >
                Sign in <ArrowRight aria-hidden className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      )}
      {visible.length > 0 && (
        <ul className="mt-4 space-y-2">
          {visible.map((report, index) => (
            <li key={report.id}>
              <Link
                href={`/audit?id=${encodeURIComponent(report.id)}`}
                className="flex min-h-16 items-center gap-3 rounded-xl border border-foreground/10 bg-white/60 p-3 transition hover:border-foreground/30 hover:bg-white/90"
              >
                <GradePill
                  grade={report.overallGrade as GradeLetter}
                  size="sm"
                  className="shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-all text-sm font-semibold">
                    {report.url.replace(/^https?:\/\//, "")}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {index === 0 ? "Latest · " : ""}
                    {report.role === "Creative"
                      ? "General portfolio"
                      : report.role}{" "}
                    ·{" "}
                    {new Date(report.createdAt).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </span>
                <ArrowRight aria-hidden className="h-4 w-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!compact && ownedReports.length === 50 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing your 50 most recent reports.
        </p>
      )}
      <SignInDialog
        open={signInOpen}
        onOpenChange={setSignInOpen}
        returnFocusRef={signInTrigger}
      />
    </section>
  );
}
