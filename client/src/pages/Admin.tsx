import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { auth, getAuthHeader, subscribeAuth } from "@/lib/firebase";
type Submission = {
  id: string;
  url: string;
  role: string;
  builder: string | null;
  createdAt: string;
  status: string;
  grade: string | null;
  enrichment: string;
  reason?: string;
};
type UsageOverview = {
  enabled: boolean;
  activation: { activatedAt: string } | null;
  transportConfigured: boolean;
  pendingHandoffs: number;
  lastFlushAt: string | null;
  lastError: string | null;
  state: {
    totals: {
      completed: number;
      partial: number;
      reused: number;
      preserved: number;
      failed: number;
      helper: number;
      accountReviews: number;
      anonymousReviews: number;
      uniqueAccounts: number;
    };
  } | null;
  unsupportedRoleDemand: {
    label: string;
    count: number;
    appliedRubric: string;
    firstAt: string;
    lastAt: string;
  }[];
  boundary: string;
};
type SubmissionIndex = {
  submissions: Submission[];
  nextOffset: number | null;
  total: number;
};
const AUTH_MESSAGE =
  "Sign in with Nic’s authorized Google account to view this private workspace.";
export default function Admin() {
  const [identity, setIdentity] = useState<string | null | undefined>();
  const owner = useRef<string | null | undefined>(undefined);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const [index, setIndex] = useState<
    (SubmissionIndex & { owner: string }) | null
  >(null);
  const [usageRecord, setUsage] = useState<{
    owner: string;
    value: UsageOverview;
  } | null>(null);
  const rows = index && index.owner === identity ? index.submissions : [];
  const nextOffset =
    index && index.owner === identity ? index.nextOffset : null;
  const total = index && index.owner === identity ? index.total : 0;
  const usage =
    usageRecord && usageRecord.owner === identity ? usageRecord.value : null;
  const [error, setError] = useState("");
  const [usageError, setUsageError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  async function refresh(offset = 0) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const request = ++generation.current;
    const requestOwner = owner.current;
    const current = () =>
      !controller.signal.aborted &&
      request === generation.current &&
      requestOwner === owner.current &&
      requestOwner === auth.currentUser?.uid;
    if (!requestOwner) {
      setIndex(null);
      setUsage(null);
      setError(AUTH_MESSAGE);
      setUsageError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setUsageError("");
    try {
      const headers = await getAuthHeader();
      if (!current()) return;
      if (!headers.Authorization) throw new Error(AUTH_MESSAGE);
      const read = async <T,>(path: string): Promise<T> => {
        const response = await fetch(path, {
          headers,
          signal: controller.signal,
        });
        if (!response.ok)
          throw Object.assign(
            new Error(
              response.status === 401 || response.status === 403
                ? AUTH_MESSAGE
                : "This part of the workspace is unavailable. Try refreshing."
            ),
            { status: response.status }
          );
        return response.json() as Promise<T>;
      };
      const [submissions, overview] = await Promise.allSettled([
        read<SubmissionIndex>(
          `/api/admin/submissions?limit=100&offset=${offset}`
        ),
        read<UsageOverview>("/api/admin/usage"),
      ]);
      if (!current()) return;
      if (
        [submissions, overview].some(
          result =>
            result.status === "rejected" &&
            [401, 403].includes(result.reason?.status)
        )
      ) {
        setIndex(null);
        setUsage(null);
        setError(AUTH_MESSAGE);
        return;
      }
      if (submissions.status === "fulfilled") {
        setIndex(previous => ({
          ...submissions.value,
          owner: requestOwner,
          submissions:
            offset && previous?.owner === requestOwner
              ? [...previous.submissions, ...submissions.value.submissions]
              : submissions.value.submissions,
        }));
      } else {
        setIndex(null);
        setError("The submissions index is unavailable. Try refreshing.");
      }
      if (overview.status === "fulfilled")
        setUsage({ owner: requestOwner, value: overview.value });
      else {
        setUsage(null);
        setUsageError("Usage information is unavailable. Try refreshing.");
      }
    } catch (failure) {
      if (!current()) return;
      setIndex(null);
      setUsage(null);
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not load this private workspace."
      );
    } finally {
      if (current()) setLoading(false);
    }
  }
  useEffect(() => {
    const unsubscribe = subscribeAuth(user => {
      const nextOwner = user?.uid ?? null;
      owner.current = nextOwner;
      generation.current += 1;
      pending.current?.abort();
      setIdentity(nextOwner);
      setIndex(null);
      setUsage(null);
      setQuery("");
      setError("");
      setUsageError("");
      void refresh();
    });
    return () => {
      generation.current += 1;
      pending.current?.abort();
      unsubscribe();
    };
  }, []);
  const filtered = rows.filter(row =>
    `${row.url} ${row.role} ${row.builder ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="container py-12 sm:py-16"
      >
        <p className="pg-brand-eyebrow">Private workspace</p>
        <h1 className="pg-page-title mt-3">Portfolio submissions</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Review submissions by role, builder and outcome. This index includes
          failed attempts and is available only to your authorized account.
        </p>
        {usage && <UsagePanel usage={usage} />}
        {!error && usageError && (
          <p role="alert" className="glass mt-6 rounded-2xl p-5 text-sm">
            {usageError}
          </p>
        )}
        <div className="my-8 flex flex-wrap items-end gap-3">
          <div className="w-full max-w-md">
            <label
              htmlFor="submission-filter"
              className="mb-2 block text-sm font-semibold"
            >
              Filter loaded submissions
            </label>
            <input
              id="submission-filter"
              placeholder="Search link, category or builder"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="min-h-12 w-full rounded-full border border-foreground/20 bg-white/80 px-5 text-base outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100"
            />
          </div>
          <button
            disabled={loading}
            onClick={() => void refresh()}
            className="pg-action-secondary min-h-12"
          >
            Refresh
          </button>
        </div>
        {error ? (
          <p
            role="alert"
            className="rounded-[1.5rem] border border-foreground/15 bg-accent p-5 leading-relaxed"
          >
            {error}
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground" role="status">
              {loading
                ? "Loading submissions…"
                : `${filtered.length} shown · ${total} total`}
            </p>
            <div
              role="region"
              aria-label="Portfolio submissions table, scroll horizontally for more columns"
              tabIndex={0}
              className="glass-strong overflow-x-auto rounded-[2rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
            >
              <table className="w-full text-left text-sm leading-relaxed">
                <caption className="sr-only">
                  Loaded portfolio submissions and their review outcomes
                </caption>
                <thead className="bg-accent">
                  <tr>
                    {[
                      "Submitted",
                      "Portfolio",
                      "Category",
                      "Builder",
                      "Result",
                      "AI review",
                    ].map(label => (
                      <th scope="col" key={label} className="p-4 font-semibold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="whitespace-nowrap p-4">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="max-w-xs break-words p-4">
                        {/^https?:\/\//i.test(row.url) ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold underline underline-offset-4"
                          >
                            {row.url}
                          </a>
                        ) : (
                          row.url
                        )}
                      </td>
                      <td className="p-4">{row.role}</td>
                      <td className="p-4">{row.builder || "Not supplied"}</td>
                      <td className="p-4">
                        {row.grade ?? row.status}
                        {row.reason && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {row.reason}
                          </p>
                        )}
                      </td>
                      <td className="p-4">{row.enrichment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && !loading && (
              <p className="mt-6 leading-relaxed">
                No submissions yet. Grade a portfolio to create the first
                record.
              </p>
            )}
            {!!rows.length && !filtered.length && !loading && (
              <p className="mt-6 leading-relaxed">
                No loaded submissions match that search. Try another link,
                category or builder.
              </p>
            )}
            {nextOffset !== null && (
              <button
                disabled={loading}
                onClick={() => void refresh(nextOffset)}
                className="pg-action-secondary mt-6"
              >
                Load more
              </button>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function UsagePanel({ usage }: { usage: UsageOverview }) {
  const totals = usage.enabled ? usage.state?.totals : null;
  const number = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? value.toLocaleString()
      : "Unavailable";
  const when = (value: string | null | undefined) =>
    value && Number.isFinite(Date.parse(value))
      ? new Date(value).toLocaleString()
      : "Not recorded";
  const counts = totals
    ? ([
        ["New accepted reviews", totals.completed],
        ["Partial previews", totals.partial],
        ["Reused assessments", totals.reused],
        ["Previous assessments preserved", totals.preserved],
        ["Failed attempts", totals.failed],
        ["Helper requests", totals.helper],
      ] as const)
    : [];
  return (
    <section
      aria-label="Private usage overview"
      className="glass-strong mt-8 rounded-[2rem] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="pg-brand-eyebrow">Usage since activation</p>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            Reviews and activity.
          </h2>
        </div>
        <span className="rounded-full bg-accent px-4 py-2 text-sm font-semibold">
          {usage.enabled ? "Metering activated" : "Not activated"}
        </span>
      </div>
      {!usage.enabled ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Production metering has not been activated. This is not a zero-usage
          report; local preview activity is not counted here.
        </p>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Activated {when(usage.activation?.activatedAt)}. Only new accepted
          assessments count toward the completed-review milestone. Reused
          results, partial previews and failed attempts are listed separately.
        </p>
      )}
      {counts.length > 0 ? (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {counts.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white/70 p-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-2 font-display text-3xl font-bold">
                {number(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : usage.enabled ? (
        <p role="status" className="mt-4 text-sm">
          Usage totals are unavailable.
        </p>
      ) : null}
      {totals && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Accepted reviews: {number(totals.accountReviews)} signed in ·{" "}
          {number(totals.anonymousReviews)} anonymous ·{" "}
          {number(totals.uniqueAccounts)} unique reviewing accounts. These are
          review counts, not sign-ins or saved-report views.
        </p>
      )}
      <div className="mt-5 rounded-2xl border border-foreground/15 p-4 text-sm leading-relaxed">
        <p>
          <strong>Milestone delivery:</strong>{" "}
          {usage.transportConfigured
            ? "Transport configured. Live delivery is not verified by this status."
            : "Not configured. No milestone delivery is active."}
        </p>
        <p className="mt-2 text-muted-foreground">
          Pending usage handoffs: {number(usage.pendingHandoffs)} · Last sync:{" "}
          {when(usage.lastFlushAt)}
        </p>
        {usage.lastError && (
          <p className="mt-2 text-foreground">
            The last usage sync did not complete. Pending activity remains
            queued.
          </p>
        )}
        <p className="mt-2 text-muted-foreground">{usage.boundary}</p>
      </div>
      <details className="mt-5 rounded-2xl border border-foreground/15 px-4">
        <summary className="min-h-12 cursor-pointer content-center py-3 text-sm font-semibold">
          Other fields requested
        </summary>
        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
          Private demand signals from submitted fields outside the current
          categories. These submissions use the general portfolio rubric.
        </p>
        {usage.unsupportedRoleDemand.length ? (
          <ul className="mb-4 grid gap-2 sm:grid-cols-2">
            {usage.unsupportedRoleDemand.map(item => (
              <li
                key={item.label}
                className="min-w-0 rounded-xl bg-white/70 p-3 text-sm"
              >
                <span className="break-words font-semibold">{item.label}</span>
                <span className="ml-2">
                  {number(item.count)} request{item.count === 1 ? "" : "s"}
                </span>
                <span className="mt-1 block break-words text-muted-foreground">
                  Applied rubric: {item.appliedRubric} · Last received{" "}
                  {when(item.lastAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">
            No requests recorded for other fields.
          </p>
        )}
      </details>
    </section>
  );
}
