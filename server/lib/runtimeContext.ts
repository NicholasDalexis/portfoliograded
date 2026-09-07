import path from "node:path";
import type { NextFunction, Request, Response } from "express";

export interface RuntimeContext {
  readonly mode: "local" | "hosted";
  readonly bindHost: "127.0.0.1" | "0.0.0.0";
  readonly port: number;
  readonly localOrigin: string | null;
  readonly publishingDirectory: string | null;
}
const CLOUD_MARKERS = ["RAILWAY_PROJECT_ID", "RAILWAY_ENVIRONMENT_ID", "RAILWAY_SERVICE_ID", "VERCEL", "NETLIFY", "RENDER", "K_SERVICE", "AWS_LAMBDA_FUNCTION_NAME", "FLY_APP_NAME", "DYNO"];
export function cloudRuntimeDetected(env: NodeJS.ProcessEnv = process.env): boolean {
  return CLOUD_MARKERS.some(key => Boolean(env[key]));
}
/** Only the local launcher establishes this mode; no request/header can select it. */
export function resolveRuntime(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): RuntimeContext {
  const port = Number(env.PORT || 3000);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535.");
  const local = env.PG_LOCAL_BOOTSTRAP === "1" && env.PG_BIND_HOST === "127.0.0.1" && env.NODE_ENV !== "production" && !cloudRuntimeDetected(env);
  return Object.freeze({
    mode: local ? "local" : "hosted", bindHost: local ? "127.0.0.1" : "0.0.0.0", port,
    localOrigin: local ? `http://localhost:${port}` : null,
    publishingDirectory: local ? path.resolve(cwd, "data", "published-local") : null,
  });
}
function loopback(address: string | undefined): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
/** Binding + actual socket + exact origin/Host, never proxy-forwarded identity. */
export function isLocalRuntimeRequest(req: Request, runtime: RuntimeContext): boolean {
  if (runtime.mode !== "local" || runtime.bindHost !== "127.0.0.1") return false;
  if (!loopback(req.socket.localAddress) || !loopback(req.socket.remoteAddress) || req.socket.localPort !== runtime.port) return false;
  const hosts = new Set([`localhost:${runtime.port}`, `127.0.0.1:${runtime.port}`]);
  if (!hosts.has((req.headers.host ?? "").toLowerCase())) return false;
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  return !origin || origin === `http://localhost:${runtime.port}` || origin === `http://127.0.0.1:${runtime.port}`;
}
export function requireLocalRuntimeRequest(runtime: RuntimeContext) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isLocalRuntimeRequest(req, runtime)) { res.status(403).json({ error: "local_runtime_required", reason: "Open this local build directly on localhost." }); return; }
    next();
  };
}
