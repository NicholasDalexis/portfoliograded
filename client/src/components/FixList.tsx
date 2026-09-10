/*
 * FixList v2. the persistent suggestion checklist (the retention core).
 * Top undone fixes live in a gold "Do these first" cluster tied to the next
 * letter grade ("knock these out and push for A-"), the rest collapse into
 * a tidy list with expandable "why" details. Check-offs persist per URL.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Lock } from "lucide-react";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";
import { auth, getAuthHeader } from "@/lib/firebase";
import type { CategoryAccess, CategoryKey } from "@shared/audit";
import { toast } from "sonner";

export interface HistorySuggestion {
  id: string;
  title: string;
  description: string;
  impact: string;
  premium: boolean;
  firstSeen: string;
  lastSeen: string;
  done: boolean;
  doneAt?: string;
  access?: CategoryAccess;
  categoryKeys?: CategoryKey[];
  auditIds?: string[];
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

const IMPACT_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

function Row({
  s,
  gold,
  onToggle,
  defaultOpen,
  pending,
}: {
  s: HistorySuggestion;
  gold?: boolean;
  onToggle: (id: string, done: boolean) => void;
  defaultOpen?: boolean;
  pending?: boolean;
}) {
  const [openWhy, setOpenWhy] = useState(Boolean(defaultOpen));
  const detailId = useId();
  return (
    <div
      className={cn(
        "flex w-full flex-col items-start gap-3 rounded-2xl px-4 py-3 transition sm:flex-row",
        s.done
          ? "bg-white/40"
          : gold
            ? "bg-white/80"
            : "bg-white/65 backdrop-blur-md"
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(s.id, !s.done)}
        aria-label={`${s.done ? "Mark as not done" : "Mark as done"}: ${s.title}`}
        aria-pressed={s.done}
        disabled={pending}
        aria-busy={pending}
        className={cn(
          "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition hover:scale-110",
          s.done
            ? "border-transparent text-[oklch(0.25_0.05_55)]"
            : "border-[oklch(0.75_0.08_70)] bg-white"
        )}
        style={
          s.done
            ? {
                background:
                  "linear-gradient(120deg, oklch(0.86 0.14 60), oklch(0.92 0.11 95))",
              }
            : undefined
        }
      >
        {s.done ? <Check className="h-4 w-4" /> : null}
      </button>
      <div className="w-full min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpenWhy(v => !v)}
          aria-expanded={openWhy}
          aria-controls={openWhy ? detailId : undefined}
          className="flex min-h-11 w-full flex-col items-start gap-2 text-left sm:flex-row sm:items-center sm:justify-between"
        >
          <span
            className={cn(
              "text-sm font-semibold text-foreground",
              s.done && "line-through"
            )}
          >
            {s.title}
            <span
              className={cn(
                "ml-2 inline-block rounded-full px-2 py-0.5 align-middle text-xs font-bold uppercase tracking-wider",
                s.impact === "High"
                  ? "bg-[oklch(0.7_0.18_30_/_0.15)] text-[oklch(0.45_0.14_30)]"
                  : "bg-white/70 text-muted-foreground"
              )}
            >
              {s.impact}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {openWhy ? "Hide" : "Why?"}
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition", openWhy && "rotate-180")}
            />
          </span>
        </button>
        {openWhy ? (
          <div id={detailId} className="mt-1.5">
            <p className="text-sm text-muted-foreground">{s.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.done && s.doneAt
                ? `Checked off ${fmtDate(s.doneAt)}`
                : `First flagged ${fmtDate(s.firstSeen)}`}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FixList({
  url,
  role,
  suggestions,
  nextGrade,
  unlocked = false,
  onUpgrade,
  onRequireAccount,
}: {
  url: string;
  role: string;
  suggestions: HistorySuggestion[];
  nextGrade?: { points: number; grade: string };
  unlocked?: boolean;
  onUpgrade?: () => void;
  onRequireAccount?: (categoryKeys: CategoryKey[]) => void;
}) {
  const [items, setItems] = useState(suggestions);
  const pendingIds = useRef(new Set<string>());
  const [savingIds, setSavingIds] = useState(new Set<string>());
  const live = useRef(true);
  const requests = useRef(new Set<AbortController>());
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      requests.current.forEach(controller => controller.abort());
    };
  }, []);

  const accessOf = (s: HistorySuggestion): CategoryAccess =>
    s.access ?? (s.premium && !unlocked ? "pro-required" : "open");
  const available = items.filter(s => accessOf(s) === "open");
  const accountRequired = items.filter(
    s => accessOf(s) === "free-account-required"
  );
  const accountCategoryKeys = [
    ...new Set(accountRequired.flatMap(s => s.categoryKeys ?? [])),
  ];
  const doneCount = available.filter(s => s.done).length;
  const undone = available
    .filter(s => !s.done)
    .sort(
      (a, b) => (IMPACT_ORDER[a.impact] ?? 3) - (IMPACT_ORDER[b.impact] ?? 3)
    );
  const sTierLocked = items.filter(
    s => !s.done && accessOf(s) === "pro-required"
  );
  const doFirst = undone.slice(0, Math.min(3, undone.length));
  const rest = [
    ...undone.slice(doFirst.length),
    ...available.filter(s => s.done),
  ];

  async function toggle(id: string, done: boolean) {
    if (pendingIds.current.has(id)) return;
    const previous = items.find(s => s.id === id);
    if (!previous || accessOf(previous) !== "open") return;
    const ownerUid = auth.currentUser?.uid ?? null;
    const controller = new AbortController();
    requests.current.add(controller);
    pendingIds.current.add(id);
    setSavingIds(new Set(pendingIds.current));
    setItems(arr =>
      arr.map(s =>
        s.id === id
          ? { ...s, done, doneAt: done ? new Date().toISOString() : undefined }
          : s
      )
    );
    try {
      const headers = await getAuthHeader();
      if (
        !live.current ||
        controller.signal.aborted ||
        (auth.currentUser?.uid ?? null) !== ownerUid
      )
        return;
      track("fix_toggled", { id, done });
      const response = await fetch("/api/history/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ url, role, id, done }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Could not save");
    } catch {
      if (!live.current || controller.signal.aborted) return;
      setItems(arr => arr.map(s => (s.id === id ? previous : s)));
      toast.error("That change was not saved. Please try again.");
    } finally {
      requests.current.delete(controller);
      pendingIds.current.delete(id);
      if (live.current) setSavingIds(new Set(pendingIds.current));
    }
  }

  if (!items.length) return null;

  return (
    <div
      aria-label="Your fix list"
      className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-8"
    >
      <div
        className="grad-flowerboy absolute inset-x-0 top-0 h-[2px] opacity-90"
        aria-hidden
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="pg-brand-eyebrow">Your fix list</p>
          <h3 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            {available.length === 0
              ? accountRequired.length
                ? "Your next steps are ready."
                : "Your saved suggestion checklist."
              : doneCount === available.length
                ? accountRequired.length
                  ? "Your available suggestions are checked off."
                  : "Everything checked off. Re-grade to check your changes."
                : `${doneCount} of ${available.length} available suggestions done.`}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved for this site and role in your browser or signed-in account.
            Tap a title for the why; check it off when it's fixed.
          </p>
        </div>
        {available.length > 0 && (
          <div className="w-full sm:w-56">
            <div
              role="progressbar"
              aria-label="Suggestions completed"
              aria-valuemin={0}
              aria-valuemax={available.length}
              aria-valuenow={doneCount}
              className="h-2.5 w-full overflow-hidden rounded-full bg-white/60"
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${available.length ? Math.round((doneCount / available.length) * 100) : 0}%`,
                  background:
                    "linear-gradient(90deg, oklch(0.86 0.14 60), oklch(0.92 0.11 95))",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Gold cluster: the shortest path to the next letter */}
      {doFirst.length > 0 ? (
        <div
          className="mt-6 rounded-3xl p-4 sm:p-5"
          style={{
            background:
              "linear-gradient(120deg, oklch(0.88 0.13 62 / 0.5), oklch(0.93 0.1 90 / 0.45))",
            boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.7)",
          }}
        >
          <p className="font-display text-lg font-extrabold text-[oklch(0.25_0.05_55)]">
            Do these first
            {nextGrade
              ? `: you're ${nextGrade.points} point${nextGrade.points === 1 ? "" : "s"} from ${nextGrade.grade}`
              : ""}
            .
          </p>
          <div className="mt-3 grid gap-2">
            {doFirst.map((s, i) => (
              <Row
                pending={savingIds.has(s.id)}
                key={s.id}
                s={s}
                gold
                onToggle={toggle}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        </div>
      ) : null}

      {rest.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {rest.map(s => (
            <Row
              pending={savingIds.has(s.id)}
              key={s.id}
              s={s}
              onToggle={toggle}
            />
          ))}
        </div>
      ) : null}

      {accountRequired.length > 0 && (
        <div className="mt-5 rounded-3xl border border-foreground/15 bg-white/60 p-4 sm:p-5">
          <p className="flex items-start gap-2 font-display text-lg font-bold">
            <Lock aria-hidden className="mt-1 h-4 w-4 shrink-0" /> Read the rest
            of your feedback. It’s free.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sign in with Google to see these next steps and add them to your
            checklist. Your saved report stays the same.
          </p>
          <button
            type="button"
            className="pg-action mt-4 w-full sm:w-auto"
            onClick={() => onRequireAccount?.(accountCategoryKeys)}
          >
            Read my full feedback
          </button>
        </div>
      )}

      {/* S-tier fixes: visible, named, locked. The nudge, not a wall. */}
      {sTierLocked.length > 0 ? (
        <div className="mt-5 rounded-3xl border border-[oklch(0.8_0.14_70_/_0.45)] bg-white/40 p-4 sm:p-5">
          <p className="font-display text-lg font-extrabold text-[oklch(0.25_0.05_55)]">
            More detailed suggestions are planned for Pro.
          </p>
          <div className="mt-3 grid gap-2">
            {sTierLocked.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={onUpgrade}
                className="pg-action-secondary w-full flex-col items-start justify-between gap-3 px-4 py-3 text-left sm:flex-row sm:items-center"
              >
                <span className="text-sm font-semibold text-foreground">
                  {s.title}
                </span>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[oklch(0.25_0.05_55)]"
                  style={{
                    background:
                      "linear-gradient(120deg, oklch(0.86 0.14 60), oklch(0.92 0.11 95))",
                  }}
                >
                  S-tier · Pro
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
