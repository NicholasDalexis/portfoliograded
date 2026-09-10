import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { getAuthHeader } from "@/lib/firebase";
import type { HomepageChangeCheck } from "@shared/reportHistory";

export function ReportChangeCheck({
  id,
  createdAt,
  onReview,
}: {
  id: string;
  createdAt: string;
  onReview: () => void;
}) {
  const request = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<HomepageChangeCheck | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setResult(null);
    setError("");
    setPending(false);
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [id]);
  async function check() {
    if (pending) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/audits/${encodeURIComponent(id)}/check`,
        {
          method: "POST",
          headers: await getAuthHeader(),
          signal: controller.signal,
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.reason ??
            "The change check could not finish. Your saved report is unchanged."
        );
      if (!controller.signal.aborted) setResult(data);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Change check unavailable."
        );
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }
  return (
    <section
      className="glass mt-5 rounded-3xl p-5 sm:p-6"
      aria-label="Saved report and change check"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Your saved review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <time dateTime={createdAt}>
              {new Date(createdAt).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>{" "}
            · No new scan
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/reports"
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold underline"
          >
            Previous reports
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => void check()}
            className="pg-action-secondary w-full sm:w-auto"
          >
            {pending ? "Checking homepage changes…" : "Check homepage changes"}
          </button>
        </div>
      </div>
      <details className="mt-2 text-sm text-muted-foreground">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold text-foreground">
          What does this check?
        </summary>
        <p className="max-w-3xl pb-2 leading-relaxed">
          It compares the homepage code saved for desktop and phone. No AI or
          new grade. Images, separate stylesheets, interactions and other pages
          can change independently. Opening a saved report does not start this
          check.
        </p>
      </details>
      {error && (
        <p role="status" className="mt-3 text-sm text-red-900">
          {error}
        </p>
      )}
      {result && (
        <div role="status" className="mt-4 rounded-2xl bg-amber-50 p-4">
          <p className="font-semibold">
            {result.status === "no-source-change"
              ? "No change in the homepage code we compared."
              : result.status === "source-changed"
                ? "The homepage code has changed."
                : "This older report has no comparison snapshot."}
          </p>
          <p className="mt-2 text-sm">
            {result.status === "no-source-change"
              ? "You can keep using this report. This does not confirm that the whole website or its appearance is unchanged."
              : result.status === "source-changed"
                ? "It may be your edits or automatically changing content. A fresh review can check the current signals; it does not guarantee a different grade."
                : "Open this report as usual, or run one fresh review to create a comparison snapshot."}
            {result.reportOutdated
              ? " The grading guidelines have also changed since this report."
              : ""}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Checked {new Date(result.checkedAt).toLocaleString()}
          </p>
          <button
            type="button"
            onClick={onReview}
            className="pg-action mt-3 w-full sm:w-auto"
          >
            Run a fresh review
          </button>
        </div>
      )}
    </section>
  );
}
