/*
 * GradePill — a letter-grade medallion.
 * Color is derived from the grade tier; sizes scale from inline chips (sm)
 * to the hero verdict (xl). Used on Home, Audit, and inside InsightCard.
 */
import type { GradeLetter } from "@/lib/audit";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

interface Props {
  grade: GradeLetter;
  size?: Size;
  label?: string;
  className?: string;
}

function tier(grade: GradeLetter): "top" | "high" | "mid" | "low" {
  if (grade === "S" || grade === "A+" || grade === "A") return "top";
  if (grade === "A-" || grade === "B+" || grade === "B") return "high";
  if (grade === "B-" || grade === "C+" || grade === "C") return "mid";
  return "low";
}

const TIER_STYLE: Record<ReturnType<typeof tier>, string> = {
  top: "linear-gradient(135deg, oklch(0.84 0.15 145), oklch(0.88 0.13 130))",
  high: "linear-gradient(135deg, oklch(0.86 0.14 80), oklch(0.9 0.13 95))",
  mid: "linear-gradient(135deg, oklch(0.85 0.13 60), oklch(0.88 0.12 50))",
  low: "linear-gradient(135deg, oklch(0.78 0.16 30), oklch(0.82 0.15 35))",
};

const TIER_TEXT: Record<ReturnType<typeof tier>, string> = {
  top: "oklch(0.28 0.08 150)",
  high: "oklch(0.3 0.07 70)",
  mid: "oklch(0.3 0.07 55)",
  low: "oklch(0.3 0.09 30)",
};

const SIZES: Record<Size, { box: string; text: string }> = {
  sm: { box: "h-9 min-w-9 px-2", text: "text-sm" },
  md: { box: "h-12 min-w-12 px-2.5", text: "text-lg" },
  lg: { box: "h-16 min-w-16 px-3", text: "text-2xl" },
  xl: { box: "h-24 min-w-24 px-4", text: "text-5xl" },
};

export function GradePill({ grade, size = "md", label, className }: Props) {
  const t = tier(grade);
  const s = SIZES[size];
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-2xl font-display font-extrabold tracking-tight ring-1 ring-white/70",
          s.box,
          s.text,
        )}
        style={{
          background: TIER_STYLE[t],
          color: TIER_TEXT[t],
          boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.85), 0 12px 28px -16px oklch(0.6 0.12 65 / 0.6)",
        }}
      >
        {grade}
      </span>
      {label ? (
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      ) : null}
    </div>
  );
}
