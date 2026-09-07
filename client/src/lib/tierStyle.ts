export type TierKey = "S" | "A" | "B" | "C" | "D";

/** Flat label colors. our grade palette on the classic dark board. */
export const TIER_COLOR: Record<TierKey, { bg: string; text: string }> = {
  S: {
    bg: "linear-gradient(135deg, oklch(0.88 0.16 85), oklch(0.8 0.15 55))",
    text: "oklch(0.2 0.04 50)",
  },
  A: { bg: "oklch(0.85 0.13 70)", text: "oklch(0.22 0.05 55)" },
  B: { bg: "oklch(0.89 0.1 90)", text: "oklch(0.28 0.05 75)" },
  C: { bg: "oklch(0.92 0.06 95)", text: "oklch(0.32 0.03 75)" },
  D: { bg: "oklch(0.72 0.13 33)", text: "oklch(0.18 0.04 50)" },
};

