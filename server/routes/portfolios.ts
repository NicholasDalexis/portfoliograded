import { Router } from "express";
import { z } from "zod";
import { optionalAuth } from "../lib/firebaseAdmin.js";
import { identifyOwner, requireSameOrigin, type OwnedRequest } from "../lib/owner.js";
import { isEntitled } from "../lib/entitlements.js";
import { PortfolioValidationError } from "../../shared/portfolio.js";
import { LocalPublishingStore, PublishingError, normalizePortfolioSlug, type PublicationRecord } from "../lib/publishingStore.js";
import { requireLocalRuntimeRequest, type RuntimeContext } from "../lib/runtimeContext.js";

const publishSchema = z.strictObject({ slug: z.string().max(80), draft: z.unknown(), expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional() });
const unpublishSchema = z.strictObject({ expectedVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) });
function unsafeKeys(value: unknown): boolean {
  const pending = [value]; let count = 0;
  while (pending.length) {
    const item = pending.pop(); if (!item || typeof item !== "object") continue;
    if (++count > 150) return true;
    for (const [key, child] of Object.entries(item)) { if (["__proto__", "prototype", "constructor"].includes(key)) return true; pending.push(child); }
  }
  return false;
}
type Dependencies = { runtime: RuntimeContext; store?: LocalPublishingStore; isEntitled?: typeof isEntitled };
function metadata(record: PublicationRecord, runtime: RuntimeContext) {
  return { slug: record.slug, version: record.version, status: record.status, publishedAt: record.snapshots.at(-1)!.publishedAt, updatedAt: record.updatedAt,
    localUrl: record.status === "published" ? `${runtime.localOrigin}/p/${record.slug}` : null,
    desiredProductionUrl: `https://${record.slug}.portfoliograded.com`, isPublicInternet: false, scope: "local-machine", snapshotCount: record.snapshots.length };
}
function sendFailure(res: import("express").Response, error: unknown): void {
  if (error instanceof PublishingError) { res.status(error.status).json({ error: error.code, reason: error.message }); return; }
  if (error instanceof PortfolioValidationError) { res.status(400).json({ error: "invalid_portfolio", reason: error.message }); return; }
  res.status(503).json({ error: "publishing_storage_unavailable", reason: "Publishing could not finish. Your previously published page was not replaced unless its saved status confirms the update." });
}
export function createPortfoliosRouter(deps: Dependencies) {
  const router = Router(), runtime = deps.runtime;
  const store = runtime.mode === "local" && runtime.publishingDirectory ? deps.store ?? new LocalPublishingStore(runtime.publishingDirectory) : null;
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
  router.get("/capabilities", (req, res) => {
    if (runtime.mode === "local") { requireLocalRuntimeRequest(runtime)(req, res, () => res.json({ mode: "local-preview", canPublish: true, requiresPro: false, hostedRequiresPro: true, chargesEnabled: false, scope: "local-machine", domain: "portfoliograded.com", localOrigin: runtime.localOrigin })); return; }
    res.json({ mode: "hosted-disabled", canPublish: false, requiresPro: true, hostedRequiresPro: true, chargesEnabled: false, scope: "unavailable", domain: "portfoliograded.com", reason: "Hosted publishing is not configured. Editing and downloads remain available." });
  });
  router.use((req, res, next) => {
    if (runtime.mode === "local") { requireLocalRuntimeRequest(runtime)(req, res, next); return; }
    // No disk fallback is permitted on a hosted server, regardless of request
    // body flags or local-looking Host headers. Even a verified Pro account
    // cannot publish until a real hosting adapter has been integrated.
    requireSameOrigin(req, res, () => { void optionalAuth(req, res, async () => {
      const uid = (req as unknown as OwnedRequest).user?.uid;
      if (!uid) { res.status(401).json({ error: "sign_in_required", requiresPro: true }); return; }
      try {
        if (!await (deps.isEntitled ?? isEntitled)(uid)) { res.status(403).json({ error: "pro_required", requiresPro: true, reason: "Hosted publishing will require a verified Pro account. Payments are not enabled by this endpoint." }); return; }
      } catch { res.status(503).json({ error: "entitlement_unavailable" }); return; }
      res.status(501).json({ error: "hosted_publishing_unavailable", requiresPro: true, reason: "Hosted publishing is not configured. No payment or public deployment was attempted." });
    }); });
  });
  router.use(optionalAuth, identifyOwner);
  router.get("/availability", (req, res) => {
    try { res.json(store!.availability(String(req.query.slug ?? ""), (req as unknown as OwnedRequest).ownerId)); }
    catch (error) { if (error instanceof PublishingError && error.code === "reserved_slug") { res.json({ slug: String(req.query.slug ?? "").trim().toLowerCase(), available: false, reserved: true, ownedByYou: false, scope: "local-machine" }); return; } sendFailure(res, error); }
  });
  router.get("/", (req, res) => { try { res.json({ publications: store!.list((req as unknown as OwnedRequest).ownerId).map(record => metadata(record, runtime)), scope: "local-machine" }); } catch (error) { sendFailure(res, error); } });
  router.post("/publish", (req, res) => {
    if (unsafeKeys(req.body)) { res.status(400).json({ error: "invalid_request", reason: "Remove unsupported publication fields." }); return; }
    const parsed = publishSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "invalid_request", reason: "Send an address, portfolio draft, and expected publication version." }); return; }
    try { res.status(201).json({ publication: metadata(store!.publish({ ...parsed.data, ownerId: (req as unknown as OwnedRequest).ownerId }), runtime) }); } catch (error) { sendFailure(res, error); }
  });
  router.post("/:slug/unpublish", (req, res) => {
    const parsed = !unsafeKeys(req.body) && unpublishSchema.safeParse(req.body);
    if (!parsed || !parsed.success) { res.status(400).json({ error: "invalid_request", reason: "Send the expected publication version." }); return; }
    try { res.json({ publication: metadata(store!.unpublish({ slug: String(req.params.slug), ownerId: (req as unknown as OwnedRequest).ownerId, expectedVersion: parsed.data.expectedVersion }), runtime) }); } catch (error) { sendFailure(res, error); }
  });
  router.get("/:slug", (req, res) => {
    try { const record = store!.owned(String(req.params.slug), (req as unknown as OwnedRequest).ownerId); if (!record) { res.status(404).json({ error: "not_found" }); return; } res.json({ publication: metadata(record, runtime), draft: store!.latestDraft(record) }); } catch (error) { sendFailure(res, error); }
  });
  return router;
}
/** Public local route serves the last immutable snapshot, never editable input. */
export function createPublishedPortfolioRouter(deps: Dependencies) {
  const router = Router(), runtime = deps.runtime;
  const store = runtime.mode === "local" && runtime.publishingDirectory ? deps.store ?? new LocalPublishingStore(runtime.publishingDirectory) : null;
  router.get("/:slug", (req, res) => {
    if (!store) { res.status(404).send("Portfolio not found."); return; }
    requireLocalRuntimeRequest(runtime)(req, res, () => {
      try {
        const result = store.currentHTML(normalizePortfolioSlug(String(req.params.slug)));
        if (!result) { res.status(404).send("Portfolio not found."); return; }
        res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Robots-Tag", "noindex, nofollow");
        res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'; sandbox allow-popups allow-popups-to-escape-sandbox");
        res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "no-referrer"); res.type("html").send(result.html);
      } catch (error) { if (error instanceof PublishingError) { res.status(404).send("Portfolio not found."); return; } res.status(503).send("This local portfolio is temporarily unavailable."); }
    });
  });
  return router;
}
