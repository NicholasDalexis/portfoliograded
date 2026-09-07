/*
 * Sunlit Glass. Grade Pill
 * The recurring hero motif: a liquid-glass capsule with a Flower Boy
 * gradient interior. Rendered in display serif (Fraunces). The "S" tier
 * gets a foil shimmer for premium.
 */
import { cn } from "@/lib/utils";
import type { GradeLetter } from "@/lib/audit";
import { gradeColorOklch } from "@/lib/audit";

interface Props {
  grade: GradeLetter;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  label?: string;
}

const SIZE: Record<NonNullable<Props["size"]>, { pad: string; text: string; pill: string }> = {
  sm: { pad: "px-3 py-1.5", text: "text-lg", pill: "min-w-12" },
  md: { pad: "px-5 py-2.5", text: "text-2xl", pill: "min-w-16" },
  lg: { pad: "px-8 py-4", text: "text-5xl", pill: "min-w-28" },
  xl: { pad: "px-12 py-7", text: "text-[7rem] leading-[0.9]", pill: "min-w-44" },
};

export function GradePill({ grade, size = "md", className, label }: Props) {
  const s = SIZE[size];
  const isS = grade === "S";
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-full select-none",
        "font-display font-extrabold tracking-tight text-[oklch(0.18_0.04_50)]",
        s.pad,
        s.text,
        s.pill,
        className,
      )}
      style={{
        background: gradeColorOklch(grade),
        boxShadow:
          "inset 0 1px 0 oklch(1 0 0 / 0.85), inset 0 -8px 24px oklch(0.6 0.18 60 / 0.18), 0 18px 40px -18px oklch(0.7 0.16 65 / 0.55), 0 4px 12px -4px oklch(0.7 0.16 65 / 0.35)",
        backgroundSize: isS ? "220% 100%" : "100% 100%",
      }}
    >
      {/* Glass shell highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "linear-gradient(180deg, oklch(1 0 0 / 0.55) 0%, oklch(1 0 0 / 0) 38%, oklch(1 0 0 / 0) 62%, oklch(1 0 0 / 0.18) 100%)",
        }}
      />
      <span className={cn(isS && "foil bg-clip-text text-transparent")}>{grade}</span>
      {label ? (
        <span className="ml-3 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.25_0.04_50)] opacity-80">
          {label}
        </span>
      ) : null}
    </div>
  );
}
