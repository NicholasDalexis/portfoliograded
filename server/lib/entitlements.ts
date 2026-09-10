import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebaseAdmin.js";
import { billingEnabled } from "./billingConfig.js";
import type { SubscriptionDecision } from "./subscriptionPolicy.js";
const cache = new Map<string, { pro: boolean; expiresAtMs: number; at: number }>();
export async function isEntitled(uid: string | undefined): Promise<boolean> {
  if (!uid || !billingEnabled()) return false;
  const now = Date.now(), hit = cache.get(uid);
  if (hit && now - hit.at < 60_000) return hit.pro && hit.expiresAtMs > now;
  try {
    const store = db(); if (!store) return false;
    const snap = await store.collection("users").doc(uid).get();
    const expiresAtMs = Number(snap.get("proExpiresAtMs"));
    const pro = snap.exists && snap.get("pro") === true && Number.isFinite(expiresAtMs) && expiresAtMs > now;
    cache.set(uid, { pro, expiresAtMs, at: now });
    return pro;
  } catch { return false; }
}
/** Write only decisions from a currently retrieved Stripe subscription. Legacy boolean grants fail closed. */
export async function setSubscriptionEntitlement(uid: string, email: string | undefined, decision: SubscriptionDecision): Promise<void> {
  const store = db(); if (!store) throw new Error("firestore_unavailable");
  const ref = store.collection("users").doc(uid);
  await store.runTransaction(async (transaction) => {
    const previous = await transaction.get(ref);
    // An old canceled subscription must not revoke a newer subscription on the account.
    if (!decision.eligible && previous.exists && previous.get("stripeSubscriptionId") !== decision.subscriptionId) return;
    transaction.set(ref, { pro: decision.eligible, proExpiresAtMs: decision.eligible ? decision.expiresAtMs : 0,
      email: email ?? previous.get("email") ?? null, stripeCustomerId: decision.customerId,
      stripeSubscriptionId: decision.subscriptionId, plan: decision.plan ?? null,
      updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  cache.delete(uid);
}
