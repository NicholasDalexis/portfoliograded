import { expect, test } from "vitest";
import { matchesPlannedPrice } from "@server/lib/priceContract";
const monthly = () => ({
  active: true,
  currency: "usd",
  unit_amount: 999,
  type: "recurring",
  billing_scheme: "per_unit",
  recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
});
const yearly = () => ({
  ...monthly(),
  unit_amount: 4999,
  recurring: { interval: "year", interval_count: 1, usage_type: "licensed" },
});
test("accepts the exact planned active USD999 monthly and USD4999 yearly subscriptions", () => {
  expect(matchesPlannedPrice(monthly(), "monthly")).toBe(true);
  expect(matchesPlannedPrice(yearly(), "yearly")).toBe(true);
});
test("rejects the superseded USD5000 yearly price and crossed plans", () => {
  expect(
    matchesPlannedPrice({ ...yearly(), unit_amount: 5000 }, "yearly"),
  ).toBe(false);
  expect(matchesPlannedPrice(monthly(), "yearly")).toBe(false);
  expect(matchesPlannedPrice(yearly(), "monthly")).toBe(false);
});
test("rejects inactive, wrong currency, one-off, tiered, metered and wrong-interval prices", () => {
  for (const plan of ["monthly", "yearly"] as const) {
    const p = plan === "monthly" ? monthly() : yearly();
    const bad = [
      {},
      { ...p, active: false },
      { ...p, currency: "eur" },
      { ...p, unit_amount: null },
      { ...p, type: "one_time" },
      { ...p, billing_scheme: "tiered" },
      { ...p, recurring: null },
      { ...p, recurring: { ...p.recurring, interval: "week" } },
      { ...p, recurring: { ...p.recurring, interval_count: 2 } },
      { ...p, recurring: { ...p.recurring, usage_type: "metered" } },
    ];
    for (const value of bad)
      expect(matchesPlannedPrice(value, plan)).toBe(false);
  }
});
