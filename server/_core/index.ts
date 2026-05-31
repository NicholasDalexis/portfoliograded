import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { assertProductionEnv, ENV } from "./env";
import { handleWebhookEvent } from "./stripe";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  assertProductionEnv();

  const app = express();
  const server = createServer(app);

  // Behind Railway's proxy: trust X-Forwarded-* so req.ip and secure cookies work.
  app.set("trust proxy", 1);

  // Stripe webhook MUST receive the raw body for signature verification, so it
  // is registered BEFORE the JSON body parser.
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];
      if (!signature || typeof signature !== "string") {
        res.status(400).send("Missing stripe-signature header");
        return;
      }
      try {
        await handleWebhookEvent(req.body as Buffer, signature);
        res.json({ received: true });
      } catch (error) {
        console.error("[Stripe] Webhook error:", error);
        res.status(400).send(`Webhook Error: ${(error as Error).message}`);
      }
    },
  );

  // Standard parsers for everything else.
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext }),
  );

  if (ENV.isProduction) {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  server.listen(ENV.port, () => {
    console.log(`PortfolioGraded running on http://localhost:${ENV.port}/`);
  });
}

startServer().catch((err) => {
  console.error("[Boot] Fatal startup error:", err);
  process.exit(1);
});
