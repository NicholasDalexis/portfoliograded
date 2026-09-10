/*
 * Firebase Admin — server-side identity + Firestore.
 * The service account JSON lives at <repo>/firebase-service-account.json
 * (git-ignored; on Railway it comes from the FIREBASE_SERVICE_ACCOUNT env
 * var as raw JSON). If neither exists the server still runs: auth-gated
 * routes report 503. Anonymous requests may continue, but supplied credentials
 * never silently fall back to an anonymous identity.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextFunction, Request, Response } from "express";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const KEY_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.resolve(process.cwd(), "firebase-service-account.json");

export interface AuthedUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  provider?: string;
}
/** The free feedback account flow is specifically verified Google sign-in.
 * Other valid Firebase providers may still use generic authenticated routes. */
export function isFreeFeedbackAccount(user?: AuthedUser | null): boolean {
  return Boolean(user && user.provider === "google.com" && user.emailVerified === true);
}

// Express request augmentation (kept local: routes import AuthedRequest).
export type AuthedRequest = Request & { user?: AuthedUser };

let app: App | null = null;
let initTried = false;

function getApp(): App | null {
  if (initTried) return app;
  initTried = true;
  try {
    let credJson: string | null = null;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) credJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    else if (existsSync(KEY_PATH)) credJson = readFileSync(KEY_PATH, "utf8");
    if (!credJson) {
      console.warn("[firebase] no service account found; auth disabled");
      return null;
    }
    const parsed = JSON.parse(credJson) as Record<string, string>;
    app = getApps()[0] ?? initializeApp({ credential: cert(parsed as never), projectId: parsed.project_id });
    console.log(`[firebase] admin ready (${parsed.project_id})`);
  } catch (err) {
    console.warn("[firebase] init failed:", err instanceof Error ? err.message : err);
    app = null;
  }
  return app;
}

export function authConfigured(): boolean {
  return getApp() !== null;
}

export function db(): Firestore | null {
  const a = getApp();
  return a ? getFirestore(a) : null;
}

/** Verify a Bearer token; null if absent/invalid/auth-disabled. */
export async function verifyBearer(req: Request): Promise<AuthedUser | null> {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !/^Bearer [^\s]+$/i.test(header)) return null;
  const token = header.slice(7);
  if (token.length > 4096) return null;
  const a = getApp();
  if (!a) return null;
  try {
    const decoded = await getAuth(a).verifyIdToken(token);
    if (typeof decoded.uid !== "string" || !decoded.uid || decoded.uid.length > 128) return null;
    return { uid: decoded.uid, email: decoded.email, emailVerified: decoded.email_verified === true,
      provider: typeof decoded.firebase?.sign_in_provider === "string" ? decoded.firebase.sign_in_provider : undefined };
  } catch {
    return null; // middleware distinguishes absent credentials from invalid ones
  }
}

/** Anonymous entry is allowed only when no Authorization header was supplied. */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  (req as AuthedRequest).user = undefined;
  if (req.headers.authorization === undefined) { next(); return; }
  res.setHeader("Cache-Control", "private, no-store");
  if (!authConfigured()) { res.status(503).json({ error: "auth_unavailable" }); return; }
  const user = await verifyBearer(req);
  if (!user) { res.status(401).json({ error: "invalid_auth" }); return; }
  (req as AuthedRequest).user = user;
  next();
}

/** 401 without a valid token; 503 if auth isn't configured yet. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  (req as AuthedRequest).user = undefined;
  res.setHeader("Cache-Control", "private, no-store");
  if (!authConfigured()) {
    res.status(503).json({ error: "auth_unavailable" });
    return;
  }
  const user = await verifyBearer(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  (req as AuthedRequest).user = user;
  next();
}
