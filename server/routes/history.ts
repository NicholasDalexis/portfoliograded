import { Router } from "express";
import { getHistory, redactPremium, toggleSuggestion } from "../lib/historyStore.js";
import { optionalAuth, isFreeFeedbackAccount } from "../lib/firebaseAdmin.js";
import { isEntitled } from "../lib/entitlements.js";
import { identifyOwner, requireSameOrigin, type OwnedRequest } from "../lib/owner.js";
export const historyRouter = Router();
historyRouter.get("/", optionalAuth, identifyOwner, async (req, res) => {
  const { url, role } = req.query;
  if (typeof url !== "string" || !url || url.length > 2048 || (role !== undefined && typeof role !== "string")) { res.status(400).json({ error: "validation_failed" }); return; }
  try {
    const owner = req as OwnedRequest;
    const entitled = await isEntitled(owner.user?.uid);
    res.json(redactPremium(getHistory(url, owner.ownerId, typeof role === "string" ? role.slice(0, 100) : "Creative"), entitled, isFreeFeedbackAccount(owner.user)));
  } catch { res.status(503).json({ error: "storage_unavailable" }); }
});
historyRouter.post("/toggle", requireSameOrigin, optionalAuth, identifyOwner, async (req, res) => {
  const { url, id, done, role } = req.body as { url?: unknown; id?: unknown; done?: unknown; role?: unknown };
  if (typeof url !== "string" || url.length > 2048 || typeof id !== "string" || id.length > 100 || typeof done !== "boolean" || (role !== undefined && typeof role !== "string")) { res.status(400).json({ error: "validation_failed" }); return; }
  try {
    const owner = req as OwnedRequest;
    const entitled = await isEntitled(owner.user?.uid);
    const visibleBefore = redactPremium(getHistory(url, owner.ownerId, typeof role === "string" ? role.slice(0, 100) : "Creative"), entitled, isFreeFeedbackAccount(owner.user));
    const suggestion = visibleBefore?.suggestions[id];
    if (!suggestion) { res.status(404).json({ error: "not_found" }); return; }
    if ((suggestion.access && suggestion.access !== "open") || (suggestion.premium && !entitled)) {
      res.status(403).json({ error: suggestion.access === "free-account-required" ? "free_account_required" : "pro_required", reason: "Open this feedback before marking the change as complete." }); return;
    }
    const result = toggleSuggestion(url, id, done, owner.ownerId, typeof role === "string" ? role.slice(0, 100) : "Creative");
    if (!result) { res.status(404).json({ error: "not_found" }); return; }
    const visible = redactPremium(getHistory(url, owner.ownerId, typeof role === "string" ? role.slice(0, 100) : "Creative"), entitled, isFreeFeedbackAccount(owner.user));
    res.json(visible?.suggestions[id] ?? { error: "not_found" });
  } catch { res.status(503).json({ error: "storage_unavailable" }); }
});
