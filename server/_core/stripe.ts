/**
 * Stripe integration for PortfolioGraded Pro.
 *
 * Two entry points are used by the app:
 *  - createCheckoutSession / createBillingPortalSession  (from the tRPC router)
 *  - handleWebhookEvent                                  (from the raw webhook route)
 *
 * Subscription state is mirrored onto the local `users` row so Pro gating never
 * needs a synchronous Stripe call on the hot path.
 */
import Stripe from "stripe";
import * as db from "../db";
import { ENV } from "./env";

let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!ENV.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!_stripe) {
    _stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2025-10-29.clover" });
  }
  return _stripe;
}

/**
 * Create (or reuse) a Stripe customer for a user, then open a Checkout session
 * for the monthly Pro price. Returns the hosted checkout URL.
 */
export async function createCheckoutSession(params: {
  clerkId: string;
  email: string | null;
  existingCustomerId: string | null;
}): Promise<{ url: string }> {
  const s = stripe();

  let customerId = params.existingCustomerId ?? undefined;
  if (!customerId) {
    const customer = await s.customers.create({
      email: params.email ?? undefined,
      metadata: { clerkId: params.clerkId },
    });
    customerId = customer.id;
    await db.updateUserSubscription(params.clerkId, { stripeCustomerId: customerId });
  }

  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: ENV.stripePriceIdPro, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${ENV.appUrl}/audit?upgraded=1`,
    cancel_url: `${ENV.appUrl}/pricing?canceled=1`,
    metadata: { clerkId: params.clerkId },
    subscription_data: { metadata: { clerkId: params.clerkId } },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url };
}

/** Open the Stripe billing portal so a user can manage/cancel their plan. */
export async function createBillingPortalSession(customerId: string): Promise<{ url: string }> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${ENV.appUrl}/audit`,
  });
  return { url: session.url };
}

/**
 * Verify and process a Stripe webhook. The raw body + signature are required
 * for signature verification, so the Express route must NOT json-parse first.
 */
export async function handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
  const s = stripe();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(rawBody, signature, ENV.stripeWebhookSecret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${(err as Error).message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clerkId = session.metadata?.clerkId;
      if (clerkId && session.subscription) {
        const sub = await s.subscriptions.retrieve(session.subscription as string);
        await syncSubscription(clerkId, sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const clerkId = sub.metadata?.clerkId ?? (await resolveClerkIdFromCustomer(sub.customer as string));
      if (clerkId) await syncSubscription(clerkId, sub);
      break;
    }
    default:
      // Ignore unrelated events.
      break;
  }
}

async function resolveClerkIdFromCustomer(customerId: string): Promise<string | null> {
  const user = await db.getUserByStripeCustomerId(customerId);
  return user?.clerkId ?? null;
}

async function syncSubscription(clerkId: string, sub: Stripe.Subscription): Promise<void> {
  const periodEnd = sub.items.data[0]?.current_period_end ?? null;
  await db.updateUserSubscription(clerkId, {
    stripeCustomerId: sub.customer as string,
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status,
    proExpiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
  });
}
