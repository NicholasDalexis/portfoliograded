import { Router } from "express";
import { AccountPreferencesSchema, MARKETING_SCOPE, MarketingPreferenceInput } from "../../shared/accountPreferences.js";
import { requireAuth, type AuthedRequest } from "../lib/firebaseAdmin.js";
import { requireSameOrigin } from "../lib/owner.js";
import { accountPreferenceStore, AccountPreferenceStore, PreferenceConflict } from "../lib/accountPreferences.js";

export function createAccountRouter(store: AccountPreferenceStore = accountPreferenceStore) {
  const router = Router();
  const changes = new Map<string, { start: number; count: number }>();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
  const response = (user: NonNullable<AuthedRequest["user"]>) => {
    const record = store.get(user.uid);
    return AccountPreferencesSchema.parse({ marketingEmails: record?.marketingEmails ?? false,
      revision: record?.revision ?? 0, updatedAt: record?.updatedAt ?? null,
      scope: MARKETING_SCOPE, emailVerified: user.emailVerified === true, sendingEnabled: false });
  };
  router.get("/preferences", requireAuth, (req, res) => {
    try { res.json(response((req as AuthedRequest).user!)); }
    catch { res.status(503).json({ error: "storage_unavailable", reason: "Your email preference could not be loaded. Please try again." }); }
  });
  router.put("/preferences", requireSameOrigin, requireAuth, (req, res) => {
    const input = MarketingPreferenceInput.safeParse(req.body);
    if (!input.success) { res.status(400).json({ error: "validation_failed" }); return; }
    const user = (req as AuthedRequest).user!;
    if (input.data.marketingEmails && (!user.email || user.emailVerified !== true)) {
      res.status(403).json({ error: "verified_email_required", reason: "Verify your account email before opting in." }); return;
    }
    // Never rate-limit withdrawal. No email is sent by this endpoint.
    if (input.data.marketingEmails) {
      const now = Date.now();
      for (const [key, value] of changes) if (now - value.start >= 600_000) changes.delete(key);
      const current = changes.get(user.uid) ?? { start: now, count: 0 };
      if (current.count >= 12 || (!changes.has(user.uid) && changes.size >= 10_000)) { res.status(429).json({ error: "rate_limited", reason: "Please wait before changing this preference again." }); return; }
      changes.set(user.uid, { ...current, count: current.count + 1 });
    }
    try {
      store.set(user.uid, input.data.marketingEmails, input.data.expectedRevision, user.emailVerified ? user.email : undefined);
      res.json(response(user));
    } catch (error) {
      if (error instanceof PreferenceConflict) { res.status(409).json({ error: "preference_conflict", reason: "Your preference changed in another session. Reload it before saving." }); return; }
      res.status(503).json({ error: "storage_unavailable", reason: "Your preference was not saved. Please try again." });
    }
  });
  return router;
}
