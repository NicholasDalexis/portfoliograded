import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { AuthedRequest } from "./firebaseAdmin.js";
export type OwnedRequest = AuthedRequest & { ownerId: string };
const COOKIE = "pg_visitor";
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
/** Read only a capability that arrived with this request. In particular, a
 * report claim must not create a new visitor identity after sign-in. Duplicate
 * cookies are ambiguous and are rejected instead of choosing an attacker-set one. */
export function existingVisitorOwner(req: Request): string | null {
  const values = (req.headers.cookie ?? "").split(";").map(part => part.trim())
    .filter(part => part.startsWith(`${COOKIE}=`)).map(part => part.slice(COOKIE.length + 1));
  if (values.length !== 1 || !TOKEN.test(values[0])) return null;
  return `visitor:${createHash("sha256").update(values[0]).digest("hex")}`;
}
/** The random HttpOnly cookie is the anonymous owner capability. No login needed. */
export function identifyOwner(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "private, no-store");
  let visitorOwner = existingVisitorOwner(req);
  if (!visitorOwner) {
    const token = randomBytes(32).toString("base64url");
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: req.secure || process.env.NODE_ENV === "production", path: "/", maxAge: 180 * 86400_000 });
    visitorOwner = `visitor:${createHash("sha256").update(token).digest("hex")}`;
  }
  (req as OwnedRequest).ownerId = (req as AuthedRequest).user ? `user:${(req as AuthedRequest).user!.uid}` : visitorOwner;
  next();
}
export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : `${req.protocol}://${req.get("host")}`;
  if (req.headers["sec-fetch-site"] === "cross-site" || (origin && origin !== expected)) { res.status(403).json({ error: "cross_site_request" }); return; }
  next();
}
