import type Stripe from "stripe";
export interface SubscriptionDecision { eligible: boolean; expiresAtMs: number; customerId: string; subscriptionId: string; plan?: string; }
/** Pure policy. Both confirm and webhook use a freshly retrieved subscription. */
export function subscriptionDecision(sub: Stripe.Subscription, uid: string, priceIds: { monthly: string; yearly: string }, now = Date.now()): SubscriptionDecision {
  const item = sub.items.data.find((item) => item.price.id === priceIds.monthly || item.price.id === priceIds.yearly);
  const expiresAtMs = item ? item.current_period_end * 1000 : 0;
  return { eligible: sub.metadata.uid === uid && ["active", "trialing"].includes(sub.status) && Boolean(item) && expiresAtMs > now,
    expiresAtMs, customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    subscriptionId: sub.id, plan: item?.price.id === priceIds.yearly ? "yearly" : "monthly" };
}
export function completedCheckoutOwned(session: Stripe.Checkout.Session, uid: string): boolean {
  return session.mode === "subscription" && session.status === "complete" && session.client_reference_id === uid
    && ["paid", "no_payment_required"].includes(session.payment_status) && Boolean(session.subscription);
}
