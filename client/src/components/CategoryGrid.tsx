/*
 * TierBoard. near-identical to the classic ranking-video tier list:
 * dark board, flat colored tier squares on the left (S → D), title-only
 * cards in each row. Our two changes: box colors follow OUR grade palette
 * (gold = good, clay = fix it), and cards open a drill-down popup:
 * TL;DR → next steps → "See more" for the full context.
 * Rows only render when they have cards, so the board adapts per portfolio.
 */
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CirclePlus, Lock, Sparkles } from "lucide-react";
import { GradePill } from "./GradePill";
import { ADVICE } from "@/lib/adviceContent";
import { TIER_COLOR, type TierKey } from "@/lib/tierStyle";
import { cn } from "@/lib/utils";
import type { CategoryScore, GradeLetter, ReportStandouts } from "@/lib/audit";

interface Props {
  categories: CategoryScore[];
  unlocked: boolean;
  onUpgrade: () => void;
  /** Previous run's scores by category key. shows ▲/▼ deltas on cards. */
  prevScores?: Record<string, number>;
  standouts?: ReportStandouts;
  onRequireAccount?: (categoryKey: string) => void;
  resumeCategory?: { key: string; nonce: number } | null;
  onResumeConsumed?: () => void;
}

const STATUS_DOT: Record<CategoryScore["details"][number]["status"], string> = {
  pass: "bg-[oklch(0.78_0.16_140)]",
  warn: "bg-[oklch(0.86_0.16_85)]",
  fail: "bg-[oklch(0.7_0.18_30)]",
};

const TIER_ORDER: TierKey[] = ["S", "A", "B", "C", "D"];

function tierOf(grade: GradeLetter): TierKey {
  if (grade === "S") return "S";
  if (grade.startsWith("A")) return "A";
  if (grade.startsWith("B")) return "B";
  if (grade.startsWith("C")) return "C";
  return "D";
}


export function CategoryGrid({
  categories,
  unlocked,
  onUpgrade,
  prevScores,
  standouts,
  onRequireAccount,
  resumeCategory,
  onResumeConsumed,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [standoutKey, setStandoutKey] = useState<string | null>(null);
  const [seeMore, setSeeMore] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const categoryButtons = useRef(new Map<string, HTMLButtonElement>());
  const accessOf = (category: CategoryScore) =>
    category.access ??
    (category.premium && !unlocked ? "pro-required" : "open");
  const selectedCandidate = categories.find(
    category => category.key === selectedKey
  );
  const selected =
    selectedCandidate && accessOf(selectedCandidate) !== "free-account-required"
      ? selectedCandidate
      : null;
  const selectedLocked = selected ? accessOf(selected) !== "open" : false;
  const selectedStandout =
    standouts?.status === "available"
      ? standouts.items.find(item => item.categoryKey === standoutKey)
      : undefined;

  useEffect(() => {
    if (!resumeCategory) return;
    const category = categories.find(item => item.key === resumeCategory.key);
    if (!category || (category.access ?? "open") !== "open") return;
    opener.current = categoryButtons.current.get(category.key) ?? null;
    setSeeMore(false);
    setSelectedKey(category.key);
    onResumeConsumed?.();
  }, [resumeCategory, categories, onResumeConsumed]);

  const rows = TIER_ORDER.map(t => ({
    tier: t,
    cards: categories
      .filter(c => tierOf(c.grade) === t)
      .sort((a, b) => b.score - a.score),
  }));

  function open(c: CategoryScore, returnFocus?: HTMLElement) {
    opener.current =
      returnFocus ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    if (accessOf(c) === "free-account-required") {
      onRequireAccount?.(c.key);
      return;
    }
    setSeeMore(false);
    setSelectedKey(c.key);
  }

  return (
    <>
      {/* The board. dark, flat, unmistakably a tier list */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: "oklch(0.19 0.008 60)" }}
      >
        {rows.map(({ tier, cards }, i) => (
          <div
            key={tier}
            className="flex items-stretch gap-[3px]"
            style={{
              borderTop: i > 0 ? "3px solid oklch(0.12 0.005 60)" : undefined,
            }}
          >
            {/* Tier square */}
            <div
              className="flex w-14 shrink-0 items-center justify-center py-5 sm:w-24"
              style={{
                background: TIER_COLOR[tier].bg,
                color: TIER_COLOR[tier].text,
              }}
            >
              <span className="font-display text-4xl font-extrabold sm:text-5xl">
                {tier}
              </span>
            </div>

            {/* Title-only cards */}
            <div className="flex min-w-0 flex-1 flex-wrap content-center items-center gap-2 p-3">
              {tier === "S" && standouts ? (
                standouts.status === "pro-required" ? (
                  <button
                    type="button"
                    onClick={onUpgrade}
                    aria-label="Unlock standout feedback. About Pro"
                    className="pg-action-secondary gap-3 px-4 py-3 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    <span aria-hidden className="select-none blur-[3px]">
                      Unlock
                    </span>
                    <Lock aria-hidden className="h-4 w-4" />
                    <span>Unlock</span>
                  </button>
                ) : standouts.status === "available" &&
                  standouts.items.length > 0 ? (
                  standouts.items.map(item => (
                    <button
                      key={item.categoryKey}
                      type="button"
                      onClick={() => {
                        opener.current =
                          document.activeElement instanceof HTMLElement
                            ? document.activeElement
                            : null;
                        setStandoutKey(item.categoryKey);
                      }}
                      aria-label={`${item.title}, personal standout, actual grade ${item.grade}`}
                      className="flex min-h-11 max-w-full items-center gap-2 rounded-xl bg-[oklch(0.9_0.13_80)] px-3 py-3 text-left font-display text-sm font-bold text-[oklch(0.22_0.05_50)] focus-visible:ring-2 focus-visible:ring-white sm:text-lg"
                    >
                      {item.title}
                      <Sparkles aria-hidden className="h-4 w-4 shrink-0" />
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-sm leading-relaxed text-stone-200">
                    Standouts have not been assessed for this report.
                  </p>
                )
              ) : null}
              {!(tier === "S" && standouts) && cards.length === 0 ? (
                <p className="px-2 py-2 text-xs text-stone-300">
                  {tier === "S"
                    ? "Reserved for verified deep reviews"
                    : "No categories in this tier"}
                </p>
              ) : null}
              {(tier === "S" && standouts ? [] : cards).map(c => {
                const access = accessOf(c);
                const locked = access !== "open";
                const gold = tier === "S" || tier === "A";
                return (
                  <button
                    key={c.key}
                    ref={element => {
                      if (element) categoryButtons.current.set(c.key, element);
                      else categoryButtons.current.delete(c.key);
                    }}
                    type="button"
                    aria-label={`${c.title}, grade ${c.grade}${access === "free-account-required" ? ", sign in free to read your full feedback" : locked ? ", view available guidance" : ", view evidence and next steps"}`}
                    onClick={() => open(c)}
                    className={cn(
                      "group flex min-h-11 max-w-full items-center gap-2 rounded-xl px-3 py-3 text-left font-display text-sm font-bold transition hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-white sm:text-lg"
                    )}
                    style={
                      gold
                        ? {
                            background:
                              "linear-gradient(120deg, oklch(0.87 0.13 62), oklch(0.92 0.11 90))",
                            color: "oklch(0.22 0.05 50)",
                          }
                        : tier === "D"
                          ? {
                              background: "oklch(0.32 0.06 33)",
                              color: "oklch(0.95 0.02 60)",
                            }
                          : {
                              background: "oklch(0.29 0.012 70)",
                              color: "oklch(0.95 0.015 85)",
                            }
                    }
                  >
                    {c.title}
                    {prevScores?.[c.key] !== undefined &&
                    prevScores[c.key] !== c.score ? (
                      <span
                        className="text-xs"
                        aria-label="Change from previous audit"
                      >
                        {c.score > prevScores[c.key] ? "+" : ""}
                        {c.score - prevScores[c.key]}
                      </span>
                    ) : null}

                    {c.premium ? (
                      <Sparkles className="h-3.5 w-3.5 opacity-70" />
                    ) : null}
                    {locked ? (
                      <Lock className="h-3.5 w-3.5 opacity-70" />
                    ) : (
                      <CirclePlus className="h-4 w-4 opacity-60 transition group-hover:opacity-100" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Choose a category for its evidence and next steps. Select “See more” for
        a closer look.
        {standouts
          ? " S highlights your portfolio’s relative strengths; the category grades below stay unchanged."
          : ""}
      </p>

      {/* Drill-down popup: TL;DR → next steps → see more */}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={v => !v && setSelectedKey(null)}
      >
        <DialogContent
          onCloseAutoFocus={event => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
          className="max-h-[90dvh] w-[94vw] max-w-[680px] overflow-y-auto rounded-3xl border border-white/70 bg-background p-0 shadow-xl sm:max-w-[680px]"
        >
          {selected ? (
            <div className="rounded-3xl p-5 sm:p-8">
              <DialogHeader className="space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-3 pr-9">
                  <GradePill grade={selected.grade} size="md" />
                  <DialogTitle className="font-display text-2xl font-bold leading-tight sm:text-3xl">
                    {selected.title}
                  </DialogTitle>
                </div>
                <DialogDescription className="sr-only">
                  {selected.blurb}
                </DialogDescription>
              </DialogHeader>

              {/* TL;DR */}
              <div className="mt-4 rounded-2xl border border-[oklch(0.78_0.16_70_/_0.25)] bg-[oklch(0.86_0.16_75_/_0.1)] px-4 py-3">
                <p className="pg-brand-eyebrow">Try this next</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {selectedLocked
                    ? ADVICE[selected.key].steps[0]
                    : selected.recommendation}
                </p>
              </div>

              {/* Next steps */}
              <div className="mt-4">
                <p className="pg-brand-eyebrow">
                  {selectedLocked
                    ? "General guidance"
                    : "Evidence from this scan"}
                </p>
                <ul className="mt-2 space-y-2">
                  {(selectedLocked
                    ? [ADVICE[selected.key].meaning]
                    : [...selected.details]
                        .sort(
                          (a, b) =>
                            Number(a.status === "pass") -
                            Number(b.status === "pass")
                        )
                        .map(d => d.note)
                        .slice(0, 3)
                  ).map(s => (
                    <li
                      key={s}
                      className="flex items-start gap-2.5 rounded-2xl bg-white/65 px-4 py-3 text-sm leading-relaxed text-foreground"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[oklch(0.82_0.14_65)]" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* See more. bottom right */}
              {selectedLocked ? (
                <div className="mt-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {accessOf(selected) === "unavailable"
                      ? "This category was not assessed. These suggestions are general guidance, not findings about your portfolio."
                      : "This is a general starting point. Detailed evidence and deeper checks for this category are planned for Pro."}
                  </p>
                  {accessOf(selected) === "pro-required" && (
                    <button
                      type="button"
                      className="pg-action-secondary mt-3"
                      onClick={() => {
                        setSelectedKey(null);
                        onUpgrade();
                      }}
                    >
                      About Pro
                    </button>
                  )}
                </div>
              ) : !seeMore ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSeeMore(true)}
                    className="pg-action"
                  >
                    See more
                  </button>
                </div>
              ) : (
                <div className="rise mt-5 space-y-4">
                  <div>
                    <p className="pg-brand-eyebrow">What we checked</p>
                    <div className="mt-2 grid gap-2">
                      {selected.details.map(d => (
                        <div
                          key={d.label}
                          className="flex items-start gap-3 rounded-2xl bg-white/65 px-4 py-3"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                              STATUS_DOT[d.status]
                            )}
                          />
                          <span className="sr-only">
                            {d.status === "pass"
                              ? "Positive signal"
                              : d.status === "warn"
                                ? "Worth checking"
                                : "Needs attention"}
                            :
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {d.label}
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {d.note}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="pg-brand-eyebrow">
                      General guidance for this category
                    </p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {ADVICE[selected.key].meaning}
                    </p>
                    <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                      {ADVICE[selected.key].steps.map(s => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  {selected.recruiterNote ? (
                    <p className="text-sm italic leading-relaxed text-muted-foreground">
                      "{selected.recruiterNote}"
                    </p>
                  ) : null}
                  {ADVICE[selected.key].template ? (
                    <div>
                      <p className="pg-brand-eyebrow">Try this template</p>
                      <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-white/70 p-3 font-sans text-sm leading-relaxed text-foreground">
                        {ADVICE[selected.key].template}
                      </pre>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selectedStandout)}
        onOpenChange={open => {
          if (!open) setStandoutKey(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={event => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
          className="max-h-[90dvh] w-[94vw] max-w-[680px] overflow-y-auto rounded-3xl border border-white/70 bg-background p-5 shadow-xl sm:max-w-[680px] sm:p-8"
        >
          {selectedStandout && (
            <>
              <DialogHeader className="space-y-3 text-left">
                <p className="pg-brand-eyebrow">Your personal standout</p>
                <DialogTitle className="pr-8 font-display text-2xl font-bold leading-tight sm:text-3xl">
                  {selectedStandout.title}
                </DialogTitle>
                <DialogDescription className="leading-relaxed">
                  A relative strength in your portfolio, based on the homepage
                  HTML reviewed.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/65 p-4">
                <GradePill grade={selectedStandout.grade} size="md" />
                <p className="text-sm">
                  Actual category grade · {selectedStandout.score}/100
                </p>
              </div>
              <p className="text-sm leading-relaxed">
                {selectedStandout.explanation}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {selectedStandout.remainingIssues
                  ? "There are still things to improve in this category. Its full feedback remains available in your tier list."
                  : "A standout is a useful strength to build on, not a promise of an interview or a job."}
              </p>
              <button
                type="button"
                className="pg-action"
                onClick={() => {
                  const category = categories.find(
                    item => item.key === selectedStandout.categoryKey
                  );
                  setStandoutKey(null);
                  if (category)
                    open(category, categoryButtons.current.get(category.key));
                }}
              >
                Read this category’s feedback
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
