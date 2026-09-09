import { netlifyRequest } from "./netlifyRequest.js";
import { RELEASE_VERSION } from "../../shared/release.js";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import express, { type Express, type Request } from "express";
import { requireLocalRuntimeRequest, resolveRuntime, type RuntimeContext } from "./runtimeContext.js";

const secret = process.env.PREVIEW_COOKIE_SECRET || randomBytes(32);
const expiresIn = 7 * 86400_000;
const hits = new Map<string, number[]>();
let passwordChecks = 0;
let globalAttempts: number[] = [];
const cookieName = "pg_preview";
function signature(value: string): string { return createHmac("sha256", secret).update(value).digest("base64url"); }
function authorized(req: Request): boolean {
  const value = (req.headers.cookie ?? "").split(";").map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!value) return false;
  const [expires, sig] = value.split(".");
  if (!/^\d{13}$/.test(expires ?? "") || Number(expires) < Date.now() || !/^[A-Za-z0-9_-]{43}$/.test(sig ?? "")) return false;
  const expected = signature(expires);
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
const page = (failed = false) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Portfolio Graded · Private preview</title><style>body{margin:0;background:#faf5e9;color:#292116;font:16px/1.5 system-ui;display:grid;min-height:100dvh;place-items:center}main{box-sizing:border-box;width:min(92vw,460px);padding:32px;background:#fffdf8;border:1px solid #e2c883;border-radius:28px;box-shadow:0 20px 60px #81612418}h1{font-size:32px;line-height:1.1}label{display:block;font-weight:600;margin-top:24px}input,button{box-sizing:border-box;width:100%;font:inherit;min-height:48px;border-radius:14px;margin-top:8px;padding:12px}input{border:1px solid #b99a56;background:white}button{border:0;background:#f0c777;color:#292116;font-weight:700;cursor:pointer}small{display:block;margin-top:24px;color:#736451}.error{color:#9e2720}</style></head><body><main><small>PORTFOLIO GRADED · v${RELEASE_VERSION}</small><h1>A better portfolio starts here.</h1><p>This is a private preview. Enter the password shared with you to explore it.</p>${failed ? '<p class="error" role="alert">That password did not match. Try again.</p>' : ''}<form action="/preview/login" method="post"><label for="password">Preview password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" autofocus><button type="submit">Open the preview</button></form><small>Preview feedback is saved to help improve the grader.</small></main></body></html>`;

/** Server-side protection includes assets and API routes, before static files. */
export function installPreviewGate(app: Express, runtime: RuntimeContext = resolveRuntime()): void {
  if (runtime.mode === "local") {
    // Bootstrap establishes the binding; the request must also originate from
    // its actual loopback socket. A forged Host/X-Forwarded-Host is insufficient.
    app.use(requireLocalRuntimeRequest(runtime));
    return;
  }
  if (process.env.PG_STORAGE === "netlify-db" && !/^[a-f0-9]{64}$/.test(process.env.PREVIEW_COOKIE_SECRET ?? "")) throw new Error("preview_cookie_secret_required");
  const configured = process.env.PREVIEW_PASSWORD_HASH;
  const [salt, expected] = (configured ?? "").split(":");
  app.use((_req, res, next) => { res.setHeader("X-Robots-Tag", "noindex, nofollow"); res.setHeader("Cache-Control", "private, no-store"); next(); });
  app.post("/preview/login", express.urlencoded({ extended: false, limit: "2kb" }), async (req, res) => {
    if (!/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(expected ?? "")) { res.status(503).send("Private preview is being configured."); return; }
    const origin = req.headers.origin;
    const expectedOrigin = netlifyRequest.getStore()?.origin ?? (process.env.APP_URL ? new URL(process.env.APP_URL).origin : `${req.protocol}://${req.get("host")}`);
    if (req.headers["sec-fetch-site"] === "cross-site" || (origin && origin !== expectedOrigin)) { res.status(403).send("Open the preview directly to sign in."); return; }
    const now = Date.now(), ip = req.ip ?? "unknown";
    for (const [key, times] of hits) if (!times.some(t => now - t < 600_000)) hits.delete(key);
    const recent = (hits.get(ip) ?? []).filter(t => now - t < 600_000);
    if (recent.length >= 8) { res.setHeader("Retry-After", "600"); res.status(429).send("Too many attempts. Try again in ten minutes."); return; }
    hits.set(ip, [...recent, now]);
    globalAttempts = globalAttempts.filter(t => now - t < 60_000);
    if (passwordChecks >= 4 || globalAttempts.length >= 60) { res.status(429).send("The preview is busy. Please try again shortly."); return; }
    globalAttempts.push(now);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (password.length > 256) { res.status(400).send("Password is too long."); return; }
    passwordChecks++;
    let supplied: Buffer;
    try { supplied = await new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key))); }
    catch { res.status(503).send("Please try again shortly."); return; }
    finally { passwordChecks--; }
    if (!timingSafeEqual(supplied, Buffer.from(expected, "hex"))) { res.status(401).type("html").send(page(true)); return; }
    hits.delete(ip);
    const expires = String(now + expiresIn);
    res.cookie(cookieName, `${expires}.${signature(expires)}`, { httpOnly: true, secure: runtime.mode === "hosted" || req.secure, sameSite: "lax", path: "/", maxAge: expiresIn });
    res.redirect(303, "/");
  });
  app.use((req, res, next) => {
    if (authorized(req)) { next(); return; }
    if (req.path.startsWith("/api/")) { res.status(401).json({ error: "preview_password_required" }); return; }
    if (!salt || !expected) { res.status(503).send("Private preview is being configured."); return; }
    res.status(401).type("html").send(page());
  });
}
