/** Payments require an explicit enable flag and a complete verified configuration. */
export function billingEnabled(): boolean {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return process.env.BILLING_ENABLED === "true"
    && Boolean(key && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_PRICE_MONTHLY && process.env.STRIPE_PRICE_YEARLY && process.env.APP_URL)
    && (!key.startsWith("sk_live_") || process.env.BILLING_ALLOW_LIVE === "true");
}
export function isAdminUid(uid: string | undefined): boolean {
  return Boolean(uid && (process.env.PG_ADMIN_UIDS ?? "").split(",").map((entry) => entry.trim()).filter(Boolean).includes(uid));
}
