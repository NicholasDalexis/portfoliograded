/** Planned USD prices. The server must verify its Stripe prices before enabling checkout. */
export const PRO_PRICE = {
  currency: "USD",
  monthlyCents: 999,
  yearlyCents: 4999,
} as const;

export const PRO_YEARLY_MONTHLY_EQUIVALENT = PRO_PRICE.yearlyCents / 12 / 100;
export const PRO_YEARLY_SAVINGS_PERCENT = Math.floor(
  (1 - PRO_PRICE.yearlyCents / (PRO_PRICE.monthlyCents * 12)) * 100,
);
export const PRO_TWELVE_MONTHLY_TOTAL = PRO_PRICE.monthlyCents * 12 / 100;
export const PRO_YEARLY_SAVINGS_CENTS = PRO_PRICE.monthlyCents * 12 - PRO_PRICE.yearlyCents;

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const PRICE_LABELS = {
  monthly: usd(PRO_PRICE.monthlyCents),
  yearly: usd(PRO_PRICE.yearlyCents),
  yearlyMonthlyEquivalent: `$${PRO_YEARLY_MONTHLY_EQUIVALENT.toFixed(2)}`,
  twelveMonthlyTotal: `$${PRO_TWELVE_MONTHLY_TOTAL.toFixed(2)}`,
  savings: `${PRO_YEARLY_SAVINGS_PERCENT}%`,
  yearlySavings: usd(PRO_YEARLY_SAVINGS_CENTS),
} as const;

export const FREE_GRADING_FEATURES = [
  "An initial grade for your public portfolio homepage",
  "All nine category explanations; sign in free for D details",
  "Role-specific guidance and a practical fix checklist",
  "Desktop and phone previews when capture is available",
] as const;

/** Proposed scope only. Do not enable checkout until these deeper checks are verified. */
export const PRO_GRADING_FEATURES = [
  "Deeper reviews across your project and case-study pages",
  "Visual feedback based on rendered desktop and phone pages",
  "Expanded accessibility and performance checks",
  "Personal standout strengths, separate from your earned grades",
] as const;

/** Cohort context, not a graduate forecast or a reason to require an annual plan. */
export const JOB_SEARCH_CONTEXT = {
  medianDays: 82,
  period: "Q2 2026",
  sourceLabel: "Huntr, Q2 2026",
  sourceUrl: "https://huntr.co/research/job-search-trends-q2-2026#time-to-first-offer",
  description: "Median from the first saved job to the first offer among Huntr searches with a recorded offer.",
  limitation: "A tech-skewed user sample, with ongoing searches excluded. This is not a forecast for graduates or for your search.",
} as const;
