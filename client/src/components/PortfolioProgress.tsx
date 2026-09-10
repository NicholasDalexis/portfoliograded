import { useEffect, useId, useState } from "react";
import { Link } from "wouter";
import { auth, getAuthHeader, subscribeAuth } from "@/lib/firebase";
import { readOwnedReportJson } from "@/lib/ownedReportRead";
import { GradePill } from "@/components/GradePill";
import type { GradeLetter } from "@/lib/audit";
import {
  progressLabelIndexes,
  progressMethodLabel,
  progressSeries,
  progressTargets,
  type ProgressSeries,
  type ProgressTarget,
} from "@/lib/portfolioProgress";
import type { SavedReportSummary } from "@shared/reportHistory";

const ownerNow = () => auth.currentUser?.uid ?? null;
const reportLink = (id: string) => `/audit?id=${encodeURIComponent(id)}`;
const date = (at: string) =>
  new Date(at).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const fullDate = (at: string) =>
  new Date(at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const field = (role: string) =>
  role.toLowerCase() === "creative" ? "General portfolio" : role;
const label = (target: ProgressTarget) =>
  `${field(target.role)} · ${target.url.replace(/^https?:\/\//, "")}`;

export function PortfolioProgress({ className = "" }: { className?: string }) {
  const id = useId();
  const [owner, setOwner] = useState<string | null>(null);
  const [targets, setTargets] = useState<ProgressTarget[]>([]);
  const [targetKey, setTargetKey] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [attempt, setAttempt] = useState(0);
  const [method, setMethod] = useState("");
  const [record, setRecord] = useState<{
    owner: string;
    target: string;
    series: ProgressSeries[];
    status: "loading" | "ready" | "error";
  } | null>(null);
  const target = targets.find(item => item.key === targetKey);

  useEffect(() => {
    let active = true,
      generation = 0;
    let pending: AbortController | undefined;
    const unsubscribe = subscribeAuth(user => {
      pending?.abort();
      const request = ++generation,
        uid = user?.uid ?? null;
      setOwner(uid);
      setTargets([]);
      setTargetKey("");
      setRecord(null);
      setMethod("");
      setStatus("loading");
      if (!uid) return;
      const controller = new AbortController();
      pending = controller;
      void readOwnedReportJson<{ reports: SavedReportSummary[] }>(
        "/api/audits",
        {
          owner: uid,
          currentOwner: ownerNow,
          getHeaders: getAuthHeader,
          signal: controller.signal,
        }
      )
        .then(data => {
          if (
            !active ||
            controller.signal.aborted ||
            request !== generation ||
            ownerNow() !== uid
          )
            return;
          if (!Array.isArray(data.reports))
            throw new Error("Invalid report list");
          const choices = progressTargets(data.reports);
          setTargets(choices);
          setTargetKey(choices[0]?.key ?? "");
          setStatus("ready");
        })
        .catch(() => {
          if (
            active &&
            !controller.signal.aborted &&
            request === generation &&
            ownerNow() === uid
          )
            setStatus("error");
        });
    });
    return () => {
      active = false;
      ++generation;
      pending?.abort();
      unsubscribe();
    };
  }, [attempt]);

  useEffect(() => {
    if (!owner || !target || ownerNow() !== owner) return;
    const controller = new AbortController();
    setRecord({ owner, target: target.key, series: [], status: "loading" });
    setMethod("");
    void readOwnedReportJson<unknown>(
      `/api/history?url=${encodeURIComponent(target.url)}&role=${encodeURIComponent(target.role)}`,
      {
        owner,
        currentOwner: ownerNow,
        getHeaders: getAuthHeader,
        signal: controller.signal,
      }
    )
      .then(data => {
        if (controller.signal.aborted || ownerNow() !== owner) return;
        setRecord({
          owner,
          target: target.key,
          series: progressSeries(data, target),
          status: "ready",
        });
      })
      .catch(() => {
        if (!controller.signal.aborted && ownerNow() === owner)
          setRecord({ owner, target: target.key, series: [], status: "error" });
      });
    return () => controller.abort();
  }, [owner, target]);

  if (!owner || ownerNow() !== owner) return null;
  const current =
    record?.owner === owner && record.target === targetKey ? record : null;
  const series = current?.series ?? [];
  const selected =
    series.find(item => item.methodVersion === method) ?? series[0];
  const points = selected?.points ?? [],
    latest = points.at(-1);
  const loading =
    status === "loading" ||
    (Boolean(target) && (!current || current.status === "loading"));
  const error = status === "error" || current?.status === "error";
  const firstTime = points.length ? Date.parse(points[0].at) : 0,
    span = latest ? Date.parse(latest.at) - firstTime : 0;
  const x = (index: number) =>
    points.length === 1
      ? 50
      : 5 +
        90 *
          (span
            ? (Date.parse(points[index].at) - firstTime) / span
            : index / (points.length - 1));
  const y = (score: number) => 162 - score * 1.44;
  const labeledPoints = new Set(progressLabelIndexes(points));
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`glass min-w-0 rounded-[2rem] p-6 sm:p-7 ${className}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-title`} className="font-display text-2xl font-bold">
          Your progress
        </h2>
        {latest && (
          <div className="flex items-center gap-2">
            <GradePill
              grade={latest.grade as GradeLetter}
              size="sm"
              className="shrink-0"
            />
            <Link
              href={reportLink(latest.id)}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-display text-2xl font-bold underline decoration-foreground/25 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {latest.score}
              <span className="font-sans text-sm font-medium text-muted-foreground">
                /100
              </span>
              <span className="sr-only">
                , latest assessment, {fullDate(latest.at)}
              </span>
            </Link>
          </div>
        )}
      </div>
      {targets.length > 1 ? (
        <>
          <label htmlFor={`${id}-portfolio`} className="sr-only">
            Portfolio and field
          </label>
          <select
            id={`${id}-portfolio`}
            value={targetKey}
            onChange={event => setTargetKey(event.target.value)}
            className="mt-3 min-h-11 w-full min-w-0 rounded-xl border border-foreground/20 bg-white/75 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {targets.map(item => (
              <option key={item.key} value={item.key}>
                {label(item)}
              </option>
            ))}
          </select>
        </>
      ) : target ? (
        <p className="mt-2 break-all text-sm text-muted-foreground">
          {label(target)}
        </p>
      ) : null}
      {series.length > 1 ? (
        <>
          <label htmlFor={`${id}-method`} className="sr-only">
            Grading method
          </label>
          <select
            id={`${id}-method`}
            value={selected?.methodVersion}
            onChange={event => setMethod(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-white/75 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {series.map((item, index) => (
              <option key={item.methodVersion} value={item.methodVersion}>
                {progressMethodLabel(item.methodVersion, index)}
              </option>
            ))}
          </select>
        </>
      ) : selected ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {progressMethodLabel(selected.methodVersion, 0)}
        </p>
      ) : null}
      {loading && (
        <p role="status" className="mt-5 text-sm text-muted-foreground">
          Loading your assessments…
        </p>
      )}
      {error && (
        <div role="status" className="mt-5">
          <p className="text-sm">Progress could not load.</p>
          <button
            type="button"
            className="pg-action-secondary mt-3"
            onClick={() => setAttempt(value => value + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {!loading && !error && !points.length && (
        <p className="mt-5 text-sm text-muted-foreground">
          No comparable saved assessments yet.
        </p>
      )}
      {!loading && !error && latest && (
        <>
          <div className="mt-4 flex gap-2">
            <div
              aria-hidden
              className="flex h-[180px] w-6 shrink-0 flex-col justify-between py-[10px] text-right text-xs text-muted-foreground"
            >
              <span>100</span>
              <span>50</span>
              <span>0</span>
            </div>
            <svg
              role="group"
              aria-label="Dated assessment scores, from 0 to 100"
              width="100%"
              height="180"
              className="min-w-0 overflow-visible"
            >
              {[0, 50, 100].map(score => (
                <line
                  key={score}
                  x1="0"
                  x2="100%"
                  y1={y(score)}
                  y2={y(score)}
                  stroke="currentColor"
                  strokeOpacity="0.12"
                />
              ))}
              {points.slice(1).map((point, index) => (
                <line
                  key={point.id}
                  x1={`${x(index)}%`}
                  x2={`${x(index + 1)}%`}
                  y1={y(points[index].score)}
                  y2={y(point.score)}
                  stroke="oklch(0.61 0.17 50)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ))}
              {points.map((point, index) => (
                <a
                  key={point.id}
                  href={reportLink(point.id)}
                  aria-label={`${fullDate(point.at)}, ${point.grade}, ${point.score} out of 100. Open saved report.`}
                  className="group outline-none"
                >
                  <title>
                    {fullDate(point.at)} · {point.grade} · {point.score}/100
                  </title>
                  <circle
                    cx={`${x(index)}%`}
                    cy={y(point.score)}
                    r="12"
                    fill="transparent"
                    className="group-focus-visible:stroke-foreground"
                    strokeWidth="2"
                  />
                  <circle
                    cx={`${x(index)}%`}
                    cy={y(point.score)}
                    r="5"
                    fill="oklch(0.86 0.16 75)"
                    stroke="oklch(0.38 0.08 50)"
                    strokeWidth="2"
                  />
                  {labeledPoints.has(index) && (
                    <text
                      aria-hidden="true"
                      x={`${x(index)}%`}
                      y={
                        y(point.score) < 38
                          ? y(point.score) + 23
                          : y(point.score) - 13
                      }
                      textAnchor={
                        points.length === 1
                          ? "middle"
                          : index === 0
                            ? "start"
                            : index === points.length - 1
                              ? "end"
                              : "middle"
                      }
                      fill="currentColor"
                      className="font-display text-sm font-bold"
                    >
                      {point.grade}
                    </text>
                  )}
                </a>
              ))}
            </svg>
          </div>
          <div
            aria-hidden
            className="ml-8 flex justify-between gap-3 text-xs text-muted-foreground"
          >
            <span>{date(points[0].at)}</span>
            {points.length > 1 && (
              <span className="text-right">{date(latest.at)}</span>
            )}
          </div>
          <details className="mt-4 border-t border-foreground/10 pt-1">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
              {points.length} saved{" "}
              {points.length === 1 ? "assessment" : "assessments"}
            </summary>
            <ol className="max-h-64 overflow-y-auto">
              {points.map(point => (
                <li key={point.id}>
                  <Link
                    href={reportLink(point.id)}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                  >
                    <span>{fullDate(point.at)}</span>
                    <span className="shrink-0 font-semibold">
                      {point.grade} · {point.score}/100
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </section>
  );
}
