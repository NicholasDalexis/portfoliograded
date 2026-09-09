import { createReviewJobsRouter } from "./routes/reviewJobs.js";
import { usesNetlifyDatabase } from "./lib/storeContext.js";
import express from "express";
import { reportClaimsRouter } from "./routes/reportClaims.js";
import { startUsageWorker } from "./lib/usageRuntime.js";
import { createAccountRouter } from "./routes/account.js";

import path from "path";
import { fileURLToPath } from "url";
import { auditsRouter } from "./routes/audits.js";
import { screenshotsRouter } from "./routes/screenshots.js";
import { askNicRouter } from "./routes/askNic.js";
import { historyRouter } from "./routes/history.js";
import { trackRouter } from "./routes/track.js";
import { billingRouter, stripeWebhook } from "./routes/billing.js";
import { adminRouter } from "./routes/admin.js";
import { composeRouter } from "./routes/compose.js";
import { builderRouter } from "./routes/builder.js";
import { installPreviewGate } from "./lib/previewGate.js";
import { RELEASE_VERSION } from "../shared/release.js";
import { MAX_DRAFT_BYTES } from "../shared/portfolio.js";
import { resolveRuntime } from "./lib/runtimeContext.js";
import { createPortfoliosRouter, createPublishedPortfolioRouter } from "./routes/portfolios.js";

const appFile = fileURLToPath(import.meta.url);
const appDirectory = path.dirname(appFile);

export function createApp(staticDirectory?: string) {
  const runtime = resolveRuntime();
  const app = express();


  app.set("trust proxy", runtime.mode === "local" ? 0 : Number(process.env.TRUST_PROXY_HOPS || 0));
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app.get("/healthz", (_req, res) => res.json({ ok: true, version: RELEASE_VERSION }));

  // Stripe webhook needs the RAW body for signature verification — mount
  // before the JSON parser touches it.
  app.post("/api/billing/webhook", express.raw({ type: "application/json" }), stripeWebhook);
  installPreviewGate(app, runtime);

  app.use("/api/portfolios", express.json({ limit: MAX_DRAFT_BYTES + 16_384 }), createPortfoliosRouter({ runtime }));
  app.use("/p", createPublishedPortfolioRouter({ runtime }));
  if (runtime.mode === "local") app.use("/api/builder", express.json({ limit: "48kb" }), builderRouter, composeRouter);
  else app.use("/api/builder", (_req, res) => { res.status(404).json({ error: "builder_preview_unavailable" }); });
  app.use(express.json({ limit: "16kb" }));

  // API routes — must come before static serving so /api/* never falls
  // through to index.html.
  app.use("/api/account", createAccountRouter());
  app.use("/api/report-claims", reportClaimsRouter);
  if (usesNetlifyDatabase()) app.use("/api/audits", createReviewJobsRouter());
  app.use("/api/audits", auditsRouter);
  // Current reports use the owner-authorized archive route. Keep the retired
  // URL-only live/cached capture endpoint inside the local prototype.
  if (runtime.mode === "local") app.use("/api/screenshot", screenshotsRouter);
  else app.use("/api/screenshot", (_req, res) => { res.status(404).json({ error: "legacy_preview_unavailable" }); });
  app.use("/api/ask-nic", askNicRouter);
  app.use("/api/history", historyRouter);
  app.use("/api/track", trackRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/admin", adminRouter);

  // Catch-all for unknown /api/* paths — return JSON, not HTML.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  // Serve static files from dist/public in production
  const staticPath = staticDirectory ?? (
    process.env.NODE_ENV === "production"
      ? path.resolve(appDirectory, "public")
      : path.resolve(appDirectory, "..", "dist", "public"));

  app.use(express.static(staticPath));

  // Handle client-side routing — serve index.html for all remaining routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  return app;
}
