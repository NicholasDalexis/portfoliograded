/*
 * Pro state + checkout — the client side of the real paywall.
 * The server is the source of truth (/api/billing/me); localStorage keeps
 * only a cosmetic cache so the UI doesn't flash between loads. Faking the
 * cache changes pixels, not access: every premium byte is gated server-side.
 */
import { getAuthHeader, signInWithGoogle, auth } from "./firebase";
import { track } from "./track";

export interface MeState {
  signedIn: boolean;
  email?: string | null;
  pro: boolean;
  billingReady?: boolean;
  isAdmin?: boolean;
}

export async function fetchMe(): Promise<MeState> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch("/api/billing/me", { headers });
    if (!res.ok) return { signedIn: false, pro: false };
    const me = (await res.json()) as MeState;
    try {
      localStorage.setItem("portfoliograded:pro", me.pro ? "1" : "0");
    } catch {
      /* cosmetic cache only */
    }
    return me;
  } catch {
    return { signedIn: false, pro: false };
  }
}

/** Sign in (if needed) then hand off to Stripe Checkout. */
export async function startCheckout(plan: "monthly" | "yearly"): Promise<void> {
  if (!auth.currentUser) {
    await signInWithGoogle(); // popup; throws if dismissed
  }
  track("checkout_started", { plan });
  const headers = { "Content-Type": "application/json", ...(await getAuthHeader()) };
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify({ plan }),
  });
  const data = (await res.json()) as { url?: string; reason?: string };
  if (!res.ok || !data.url) throw new Error(data.reason ?? "Checkout could not start.");
  window.location.href = data.url;
}

/** Confirm a paid session after Stripe redirects back. */
export async function confirmCheckout(sessionId: string): Promise<boolean> {
  const headers = await getAuthHeader();
  const res = await fetch(`/api/billing/confirm?session_id=${encodeURIComponent(sessionId)}`, { headers });
  if (!res.ok) return false;
  track("checkout_confirmed", {});
  try {
    localStorage.setItem("portfoliograded:pro", "1");
  } catch {
    /* cosmetic */
  }
  return true;
}
