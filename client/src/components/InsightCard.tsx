/*
 * Sunlit Glass. Insight Card
 * Glass card per audit category. Collapsed by default; click anywhere on the
 * card row to expand a detailed drill-down. Premium-locked categories are
 * blurred behind a frosted overlay with an "Unlock" CTA.
 */
import { useId, useState } from "react";
import { ChevronDown, Lock, Sparkles } from "lucide-react";
import { GradePill } from "./GradePill";
import { cn } from "@/lib/utils";
import type { CategoryScore } from "@/lib/audit";

interface Props {
  category: CategoryScore;
  unlocked: boolean;
  onUpgrade: () => void;
}

const STATUS_DOT: Record<CategoryScore["details"][number]["status"], string> = {
  pass: "bg-[oklch(0.78_0.16_140)]",
  warn: "bg-[oklch(0.86_0.16_85)]",
  fail: "bg-[oklch(0.7_0.18_30)]",
};

export function InsightCard({ category, unlocked, onUpgrade }: Props) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const locked = category.premium && !unlocked;

  return (
    <div className={cn("glass lift relative overflow-hidden rounded-3xl")}>
      {/* Top accent stroke in brand gradient */}
      <div
        className="grad-flowerboy absolute inset-x-0 top-0 h-[2px] opacity-90"
        aria-hidden
      />
      <button
        type="button"
        onClick={() => !locked && setOpen((v) => !v)}
        aria-expanded={locked ? undefined : open}
        aria-controls={!locked && open ? detailId : undefined}
        className={cn(
          "flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-7 sm:py-6",
          locked && "cursor-default",
        )}
      >
        <div className="flex min-w-0 items-center gap-4">
          <GradePill grade={category.grade} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-bold sm:text-2xl">{category.title}</h3>
              {category.premium ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.86_0.16_75_/_0.18)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[oklch(0.32_0.06_55)]">
                  <Sparkles className="h-3 w-3" />
                  Pro
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{category.blurb}</p>
          </div>
        </div>
        {!locked ? (
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
              open && "rotate-180",
            )}
          />
        ) : (
          <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Expanded drill-down */}
      {!locked && open ? (
        <div id={detailId} className="rise px-5 pb-6 sm:px-7">
          <div className="mb-5 grid gap-2">
            {category.details.map((d) => (
              <div
                key={d.label}
                className="flex items-start gap-3 rounded-2xl bg-white/55 px-4 py-3 backdrop-blur-md"
              >
                <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", STATUS_DOT[d.status])} /><span className="sr-only">{d.status === "pass" ? "Positive signal" : d.status === "warn" ? "Worth checking" : "Needs attention"}:</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{d.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{d.note}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-[oklch(0.78_0.16_70_/_0.25)] bg-[oklch(0.86_0.16_75_/_0.1)] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[oklch(0.4_0.08_55)]">
              Recommendation
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{category.recommendation}</p>
          </div>
        </div>
      ) : null}

      {/* Premium lock overlay */}
      {locked ? (
        <div className="px-5 pb-6 sm:px-7">
          <div className="relative overflow-hidden rounded-2xl border border-[oklch(0.78_0.16_70_/_0.3)] bg-white/40 px-5 py-5 backdrop-blur-xl">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-1 opacity-60"
              style={{
                background:
                  "radial-gradient(60% 60% at 80% 0%, oklch(0.88 0.14 95 / 0.35), transparent 60%), radial-gradient(50% 60% at 0% 100%, oklch(0.82 0.14 55 / 0.3), transparent 60%)",
              }}
            />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-md">
                <p className="text-xs font-bold uppercase tracking-wider text-[oklch(0.4_0.08_55)]">
                  Planned for Pro
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  Deeper evidence and project checks are in development. The initial review and its next steps stay free.
                </p>
              </div>
              <button
                type="button"
                onClick={onUpgrade}
                className="foil inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-[oklch(0.2_0.04_50)] shadow-[inset_0_1px_0_oklch(1_0_0_/_0.85),0_12px_28px_-14px_oklch(0.7_0.16_65_/_0.6)]"
              >
                <Sparkles className="h-4 w-4" />
                See planned Pro features
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
