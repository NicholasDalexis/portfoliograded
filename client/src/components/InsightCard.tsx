/*
 * InsightCard — one audit category.
 * Shows the category grade, the three detail checks (pass/warn/fail), and the
 * recommendation. Premium categories render locked unless `unlocked` is true,
 * with a CTA that opens the upgrade dialog.
 */
import type { CategoryScore } from "@/lib/audit";
import { GradePill } from "@/components/GradePill";
import { cn } from "@/lib/utils";
import { Check, Lock, AlertTriangle, Minus, Sparkles } from "lucide-react";

interface Props {
  category: CategoryScore;
  unlocked: boolean;
  onUpgrade: () => void;
}

const STATUS_ICON = {
  pass: { Icon: Check, color: "oklch(0.55 0.14 150)" },
  warn: { Icon: AlertTriangle, color: "oklch(0.62 0.13 70)" },
  fail: { Icon: Minus, color: "oklch(0.58 0.18 28)" },
} as const;

export function InsightCard({ category, unlocked, onUpgrade }: Props) {
  const locked = category.premium && !unlocked;

  return (
    <div className="glass relative overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-bold">{category.title}</h3>
            {category.premium ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[oklch(0.4_0.08_60)]">
                <Sparkles className="h-3 w-3" /> Pro
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{category.blurb}</p>
        </div>
        <GradePill grade={locked ? "B" : category.grade} size="md" className={cn(locked && "opacity-40 blur-[2px]")} />
      </div>

      {locked ? (
        <div className="mt-5 rounded-2xl border border-white/60 bg-white/50 p-5 text-center">
          <Lock className="mx-auto h-5 w-5 text-[oklch(0.5_0.08_60)]" />
          <p className="mt-2 text-sm font-semibold">Unlock this category with Pro</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Accessibility, discoverability, and conversion path are where recruiters quietly judge — and where most portfolios lose points.
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[oklch(0.2_0.04_50)] transition hover:scale-[1.02]"
            style={{
              background: "linear-gradient(120deg, oklch(0.86 0.14 60), oklch(0.9 0.13 80), oklch(0.92 0.11 95))",
              boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.85), 0 10px 24px -12px oklch(0.7 0.16 65 / 0.55)",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" /> See what Pro unlocks
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-2.5">
            {category.details.map((d, i) => {
              const { Icon, color } = STATUS_ICON[d.status];
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: "oklch(1 0 0 / 0.7)" }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{d.label}</p>
                    <p className="text-xs text-muted-foreground">{d.note}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 rounded-2xl bg-white/50 p-3.5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[oklch(0.45_0.06_60)]">Recommendation</p>
            <p className="mt-1 text-sm">{category.recommendation}</p>
            {category.recruiterNote ? (
              <p className="mt-2 text-xs italic text-muted-foreground">{category.recruiterNote}</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
