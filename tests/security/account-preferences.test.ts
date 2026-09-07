import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
vi.mock("@server/lib/firebaseAdmin", () => ({ requireAuth: (req: any, res: any, next: () => void) => {
  const id = req.headers.authorization?.replace("Bearer ", "");
  if (!["alice", "bob", "unverified", "alice-unverified"].includes(id)) { res.status(401).json({ error: "unauthenticated" }); return; }
  req.user = { uid: id === "alice-unverified" ? "alice" : id, email: `${id}@example.test`, emailVerified: !id.includes("unverified") }; next();
} }));
import { AccountPreferenceStore, PreferenceConflict } from "@server/lib/accountPreferences";
import { createAccountRouter } from "@server/routes/account";
const dirs: string[] = [];
const directory = () => { const dir = mkdtempSync(path.join(tmpdir(), "pg-preferences-test-")); dirs.push(dir); return dir; };
const store = new AccountPreferenceStore(directory());
let server: Server; let origin: string;
beforeAll(async () => { const app = express(); app.use(express.json({ limit: "2kb" })); app.use("/api/account", createAccountRouter(store)); server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });
const call = (user?: string, input?: unknown, extra: Record<string, string> = {}) => fetch(`${origin}/api/account/preferences`, { method: input === undefined ? "GET" : "PUT", headers: { ...(user ? { Authorization: `Bearer ${user}` } : {}), ...(input !== undefined ? { "Content-Type": "application/json" } : {}), ...extra }, ...(input !== undefined ? { body: JSON.stringify(input) } : {}) });

test("signed-out users cannot read or change preferences", async () => {
  expect((await call()).status).toBe(401); expect((await call(undefined, {marketingEmails:true,expectedRevision:0})).status).toBe(401);
});
test("a fresh account defaults to no marketing and no email delivery", async () => {
  const res = await call("alice"); expect(res.headers.get("cache-control")).toContain("no-store");
  expect(await res.json()).toEqual({ marketingEmails:false, revision:0, updatedAt:null, scope:"portfolio-graded-email-v1", emailVerified:true, sendingEnabled:false });
});
test("verified opt-in is durable, scoped and isolated by UID", async () => {
  const res = await call("alice", {marketingEmails:true,expectedRevision:0}); expect(res.status).toBe(200);
  const saved = await res.json(); expect(saved.marketingEmails).toBe(true); expect(saved.revision).toBe(1);
  expect(saved.email).toBeUndefined(); expect(saved.sendingEnabled).toBe(false);
  const reopened = new AccountPreferenceStore(path.dirname(store.file)); const record = reopened.get("alice")!;
  expect(record.email).toBe("alice@example.test"); expect(record.optedInAt).toBeTruthy(); expect(record.consentText).toContain("Portfolio Graded");
  expect(reopened.get("bob")).toBeNull(); expect((await (await call("bob")).json()).marketingEmails).toBe(false);
  expect(statSync(store.file).mode & 0o777).toBe(0o600);
});
test("server rejects forged ownership, email, showcase and revision inputs", async () => {
  for (const input of [{marketingEmails:true,expectedRevision:0,uid:"alice"},{marketingEmails:true,expectedRevision:0,email:"target@example.test"},{marketingEmails:true,expectedRevision:0,showcase:true},{marketingEmails:"true",expectedRevision:0},{marketingEmails:true,expectedRevision:-1},{marketingEmails:true},{marketingEmails:true,expectedRevision:0.5}]) expect((await call("bob",input)).status).toBe(400);
});
test("cross-origin writes are rejected before mutation", async () => {
  const res = await call("bob",{marketingEmails:true,expectedRevision:0},{Origin:"https://attacker.test","Sec-Fetch-Site":"cross-site"}); expect(res.status).toBe(403); expect(store.get("bob")).toBeNull();
});
test("unverified email cannot opt in, but opting out remains available", async () => {
  expect((await call("unverified",{marketingEmails:true,expectedRevision:0})).status).toBe(403);
  expect((await call("unverified",{marketingEmails:false,expectedRevision:0})).status).toBe(200);
});
test("stale tabs cannot undo a withdrawal, and withdrawal removes stored email", async () => {
  expect((await call("alice-unverified",{marketingEmails:false,expectedRevision:1})).status).toBe(200);
  expect(store.get("alice")?.email).toBeNull(); expect(store.get("alice")?.withdrawnAt).toBeTruthy();
  expect((await call("alice",{marketingEmails:true,expectedRevision:1})).status).toBe(409);
  const reopened = new AccountPreferenceStore(path.dirname(store.file)); expect(reopened.get("alice")?.marketingEmails).toBe(false);
});
test("repeat identical saves do not rewrite or advance revision", () => {
  const s = new AccountPreferenceStore(directory()); const first=s.set("repeat",true,0,"repeat@example.test")!;
  const raw=readFileSync(s.file,"utf8"); const same=s.set("repeat",true,first.revision,"repeat@example.test")!;
  expect(same).toEqual(first); expect(readFileSync(s.file,"utf8")).toBe(raw);
});
test("store conflicts and invalid email inputs preserve the previous preference", () => {
  const s = new AccountPreferenceStore(directory());s.set("owner",true,0,"owner@example.test");
  expect(()=>s.set("owner",false,0)).toThrow(PreferenceConflict);
  expect(()=>s.set("owner",true,1,"not-an-email")).toThrow();expect(s.get("owner")?.marketingEmails).toBe(true);
});
test("corrupt durable data is never overwritten with a blank store", () => {
  const s = new AccountPreferenceStore(directory());writeFileSync(s.file,'{"version":999}');
  expect(()=>s.get("owner")).toThrow();expect(()=>s.set("owner",true,0,"owner@example.test")).toThrow();expect(readFileSync(s.file,"utf8")).toBe('{"version":999}');
});
test("copying returned records cannot mutate consent", () => {
  const s = new AccountPreferenceStore(directory());const record=s.set("owner",true,0,"owner@example.test")!;record.marketingEmails=false;
  const copy=s.get("owner")!;copy.email="changed@example.test";expect(s.get("owner")?.email).toBe("owner@example.test");expect(s.get("owner")?.marketingEmails).toBe(true);
});
test("opt-in write limits do not prevent withdrawal", async () => {
  let revision=0;
  for(let n=0;n<12;n++) { const res=await call("bob",{marketingEmails:true,expectedRevision:revision}); expect(res.status).toBe(200);revision=(await res.json()).revision; }
  expect((await call("bob",{marketingEmails:true,expectedRevision:revision})).status).toBe(429);
  expect((await call("bob",{marketingEmails:false,expectedRevision:revision})).status).toBe(200);expect(store.get("bob")?.marketingEmails).toBe(false);
});
