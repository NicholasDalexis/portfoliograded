import type { Config, Context } from "@netlify/functions";
import path from "node:path";
import { createApp } from "../../server/app.js";
import { adaptApp } from "../../server/lib/netlifyAdapter.js";
import { netlifyRequest } from "../../server/lib/netlifyRequest.js";
let handler: ReturnType<typeof adaptApp>;
export default async (request: Request, context: Context) => {
  const origin = new URL(request.url).origin;
  const allowed = (Netlify.env.get("PG_ALLOWED_ORIGINS") ?? "").split(",");
  const deployOrigin = `https://${context.deploy.id}--portfoliograded.netlify.app`;
  if (!allowed.includes(origin) && origin !== deployOrigin) return new Response("Unknown preview address", { status: 421 });
  if (Netlify.env.get("PG_STORAGE") !== "netlify-db") return new Response("Preview storage is being configured",{status:503});
  if (Netlify.env.get("PG_USAGE_ENABLED") === "true") return new Response("Usage metering requires a serverless worker before activation", {status:503});
  handler ??= adaptApp(createApp(path.join(process.cwd(),"dist/public")));
  return netlifyRequest.run({ origin, workerOrigin: deployOrigin, ip: context.ip || "unknown" }, () => handler(request, context.ip || "unknown"));
};
export const config: Config = { path: ["/api/*", "/healthz", "/preview/*", "/robots.txt", "/sitemap.xml"] };
