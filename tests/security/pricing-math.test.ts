import { expect, test } from "vitest";
import { PRICE_LABELS, PRO_PRICE, PRO_YEARLY_SAVINGS_PERCENT, PRO_YEARLY_SAVINGS_CENTS } from "@shared/pricing";
import { matchesPlannedPrice } from "@server/lib/priceContract";

test("annual display math matches the amount accepted by the server", () => {
  expect(PRO_PRICE.monthlyCents).toBe(999);
  expect(PRO_PRICE.yearlyCents).toBe(4999);
  expect(PRICE_LABELS.monthly).toBe("$9.99");
  expect(PRICE_LABELS.yearly).toBe("$49.99");
  expect(PRICE_LABELS.yearlyMonthlyEquivalent).toBe("$4.17");
  expect(PRICE_LABELS.twelveMonthlyTotal).toBe("$119.88");
  expect(PRO_YEARLY_SAVINGS_CENTS).toBe(6989);
  expect(PRICE_LABELS.yearlySavings).toBe("$69.89");
  expect(PRO_YEARLY_SAVINGS_PERCENT).toBe(58);
  const exactSavings = (1 - PRO_PRICE.yearlyCents / (12 * PRO_PRICE.monthlyCents)) * 100;
  expect(PRO_YEARLY_SAVINGS_PERCENT).toBeLessThanOrEqual(exactSavings);
  expect(exactSavings).toBeLessThan(PRO_YEARLY_SAVINGS_PERCENT + 1);
});

test("monthly costs less for up to five months and annual saves from the sixth", () => {
  for (let months = 1; months <= 12; months++) {
    expect(PRO_PRICE.monthlyCents * months < PRO_PRICE.yearlyCents).toBe(months <= 5);
  }
  // The four-cent gap is why the copy says about five months, never seven free.
  expect(PRO_PRICE.yearlyCents - 5 * PRO_PRICE.monthlyCents).toBe(4);
});

test("a one-cent drift, rounded-equivalent amount or old price cannot start either plan", () => {
  for (const plan of ["monthly", "yearly"] as const) {
    const amount = plan === "monthly" ? 999 : 4999;
    const p = { active: true, currency: "usd", type: "recurring", billing_scheme: "per_unit", unit_amount: amount,
      recurring: { interval: plan === "monthly" ? "month" : "year", interval_count: 1, usage_type: "licensed" } };
    expect(matchesPlannedPrice(p, plan)).toBe(true);
    for (const unit_amount of [amount - 1, amount + 1, 417, 5000, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(matchesPlannedPrice({ ...p, unit_amount }, plan)).toBe(false);
    }
  }
});
