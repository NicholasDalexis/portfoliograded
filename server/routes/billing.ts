import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { authConfigured, requireAuth, optionalAuth, type AuthedRequest } from "../lib/firebaseAdmin.js";
import { isEntitled, setSubscriptionEntitlement } from "../lib/entitlements.js";
import { billingEnabled, isAdminUid } from "../lib/billingConfig.js";
import { completedCheckoutOwned, subscriptionDecision } from "../lib/subscriptionPolicy.js";
import { requireSameOrigin } from "../lib/owner.js";
import { matchesPlannedPrice } from "../lib/priceContract.js";
let stripe: Stripe | null = null;
export function getStripe(): Stripe | null {
  if (!billingEnabled()) return null;
  return stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
}
const prices = () => ({ monthly: process.env.STRIPE_PRICE_MONTHLY!, yearly: process.env.STRIPE_PRICE_YEARLY! });
let priceCheck: {key:string;expires:number;ready:boolean}|null=null;
export async function checkoutPricesReady(force=false):Promise<boolean> {
 const s=getStripe(); if(!s)return false;
 const configured=prices();const key=`${configured.monthly}:${configured.yearly}`;
 if(!force&&priceCheck?.key===key&&priceCheck.expires>Date.now())return priceCheck.ready;
 try{const [monthly,yearly]=await Promise.all([s.prices.retrieve(configured.monthly),s.prices.retrieve(configured.yearly)]);const ready=matchesPlannedPrice(monthly,"monthly")&&matchesPlannedPrice(yearly,"yearly");priceCheck={key,expires:Date.now()+60000,ready};return ready;}catch{return false;}
}
export const billingRouter = Router();
billingRouter.get("/me", optionalAuth, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const user = (req as AuthedRequest).user;
  res.json({ signedIn: Boolean(user), email: user?.email ?? null, pro: await isEntitled(user?.uid), authReady: authConfigured(),
    billingReady: await checkoutPricesReady(), billingEnabled: billingEnabled(), isAdmin: isAdminUid(user?.uid) });
});
const checkoutHits = new Map<string, number[]>();
function checkoutLimited(uid: string) {
  const now = Date.now();
  for (const [key, times] of checkoutHits) if (!times.some((time) => now - time < 600_000)) checkoutHits.delete(key);
  const recent = (checkoutHits.get(uid) ?? []).filter((time) => now - time < 600_000);
  if (recent.length >= 6) return true;
  checkoutHits.set(uid, [...recent, now]); return false;
}
billingRouter.post("/checkout", requireSameOrigin, requireAuth, async (req, res) => {
  const s = getStripe();
  if (!s) { res.status(503).json({ error: "billing_unavailable", reason: "Payments are disabled for this preview." }); return; }
  const user = (req as AuthedRequest).user!;
  if (checkoutLimited(user.uid)) { res.status(429).json({ error: "rate_limited" }); return; }
  const { plan } = req.body as { plan?: unknown };
  if (plan !== "monthly" && plan !== "yearly") { res.status(400).json({ error: "validation_failed" }); return; }
  try {
    if (!await checkoutPricesReady(true)) { res.status(503).json({ error: "price_configuration_mismatch", reason: "The planned prices are being connected. No payment was started." }); return; }
    const session = await s.checkout.sessions.create({ mode: "subscription", line_items: [{ price: prices()[plan], quantity: 1 }],
      allow_promotion_codes: plan === "yearly" ? true : undefined, client_reference_id: user.uid, customer_email: user.email,
      metadata: { uid: user.uid, plan }, subscription_data: { metadata: { uid: user.uid } },
      success_url: `${process.env.APP_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${process.env.APP_URL}/?checkout=cancelled` });
    res.json({ url: session.url });
  } catch { res.status(502).json({ error: "checkout_failed", reason: "Checkout could not start." }); }
});
billingRouter.get("/confirm", requireSameOrigin, requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const s = getStripe(); if (!s) { res.status(503).json({ error: "billing_unavailable" }); return; }
  const user = (req as AuthedRequest).user!;
  const sessionId = req.query.session_id;
  if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]{1,250}$/.test(sessionId)) { res.status(400).json({ error: "validation_failed" }); return; }
  try {
    const session = await s.checkout.sessions.retrieve(sessionId);
    if (!completedCheckoutOwned(session, user.uid)) { res.status(402).json({ error: "not_paid" }); return; }
    const id = typeof session.subscription === "string" ? session.subscription : session.subscription!.id;
    const sub = await s.subscriptions.retrieve(id);
    const decision = subscriptionDecision(sub, user.uid, prices());
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (sub.metadata.uid !== user.uid || customerId !== decision.customerId || session.livemode !== sub.livemode) { res.status(403).json({ error: "subscription_mismatch" }); return; }
    await setSubscriptionEntitlement(user.uid, user.email, decision);
    if (!decision.eligible) { res.status(402).json({ error: "subscription_inactive" }); return; }
    res.json({ pro: true });
  } catch { res.status(502).json({ error: "confirm_failed" }); }
});
/** RAW body mounted before JSON middleware. Signature required; preview billing is disabled by default. */
export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  const s = getStripe(); if (!s) { res.status(503).json({ error: "billing_unavailable" }); return; }
  let event: Stripe.Event;
  try { event = s.webhooks.constructEvent(req.body as Buffer, req.headers["stripe-signature"] as string, process.env.STRIPE_WEBHOOK_SECRET!); }
  catch { res.status(400).json({ error: "bad_signature" }); return; }
  try {
    let subscriptionId: string | undefined, uid: string | undefined, email: string | undefined;
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      uid = session.client_reference_id ?? undefined;
      if (!uid || !completedCheckoutOwned(session, uid)) { res.json({ received: true }); return; }
      subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      email = session.customer_details?.email ?? undefined;
    } else if (["customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.created"].includes(event.type)) {
      const sub = event.data.object as Stripe.Subscription;
      subscriptionId = sub.id; uid = sub.metadata.uid;
    }
    if (subscriptionId && uid) {
      // Retrieve current state even for old/retried events; an old 'complete' event cannot resurrect Pro.
      const current = await s.subscriptions.retrieve(subscriptionId);
      if (current.metadata.uid !== uid) { res.status(400).json({ error: "subscription_mismatch" }); return; }
      await setSubscriptionEntitlement(uid, email, subscriptionDecision(current, uid, prices()));
    }
    res.json({ received: true });
  } catch { res.status(500).json({ error: "webhook_failed" }); }
}
