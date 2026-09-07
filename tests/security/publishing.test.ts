import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { request as httpRequest } from "node:http";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  readdirSync,
} from "node:fs";
import { scryptSync } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";
import { load } from "cheerio";
vi.mock("@server/lib/firebaseAdmin.js", () => ({
  optionalAuth: (req: any, _res: any, next: () => void) => {
    const bearer = req.headers.authorization;
    if (bearer === "Bearer verified-alice") req.user = { uid: "alice" };
    if (bearer === "Bearer verified-bob") req.user = { uid: "bob" };
    next();
  },
}));
vi.mock("@server/lib/entitlements.js", () => ({
  isEntitled: () => {
    throw new Error("Real entitlement provider must not run");
  },
}));
const { resolveRuntime, isLocalRuntimeRequest } =
  await import("@server/lib/runtimeContext.js");
const { LocalPublishingStore, normalizePortfolioSlug } =
  await import("@server/lib/publishingStore.js");
const { createPortfoliosRouter, createPublishedPortfolioRouter } =
  await import("@server/routes/portfolios.js");
const { installPreviewGate } = await import("@server/lib/previewGate.js");
const { createEmptyPortfolioDraft, MAX_DRAFT_BYTES } =
  await import("@shared/portfolio.js");

const servers: Server[] = [];
const draft = () => ({
  ...createEmptyPortfolioDraft(),
  name: "Avery Example",
  headline: "Graphic designer",
  bio: "Only my own supplied facts.",
  email: "avery@example.com",
  projects: [
    {
      id: "project-one",
      title: "School poster",
      summary: "A poster created for a class brief.",
      role: "Designer",
      process: "Sketched three layouts.",
      outcome: "Delivered the poster.",
    },
  ],
});
const alice = { Authorization: "Bearer verified-alice" },
  bob = { Authorization: "Bearer verified-bob" };
async function harness(
  options: { hosted?: boolean; gate?: boolean; entitled?: boolean } = {},
) {
  const app = express(),
    directory = mkdtempSync(path.join(tmpdir(), "pg-publications-"));
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as { port: number }).port,
    base = `http://127.0.0.1:${port}`;
  const runtime = resolveRuntime(
    options.hosted
      ? {
          NODE_ENV: "production",
          PORT: String(port),
          PG_LOCAL_BOOTSTRAP: "1",
          PG_BIND_HOST: "127.0.0.1",
        }
      : {
          NODE_ENV: "development",
          PORT: String(port),
          PG_LOCAL_BOOTSTRAP: "1",
          PG_BIND_HOST: "127.0.0.1",
        },
    directory,
  );
  const store = new LocalPublishingStore(
    path.join(directory, "published-local"),
  );
  const entitled = vi.fn(async () => Boolean(options.entitled));
  if (options.gate) installPreviewGate(app, runtime);
  app.use(
    "/api/portfolios",
    express.json({ limit: MAX_DRAFT_BYTES + 16_384 }),
    createPortfoliosRouter({ runtime, store, isEntitled: entitled }),
  );
  app.use("/p", createPublishedPortfolioRouter({ runtime, store }));
  app.get("/", (_req, res) => res.send("APP_SECRET_CANARY"));
  app.get("/assets/app.js", (_req, res) => res.send("ASSET_SECRET_CANARY"));
  app.use((error: { status?: number }, _req: any, res: any, _next: any) =>
    res.status(error.status ?? 500).json({ error: "rejected_request" }),
  );
  // Native fetch normalizes Host. Raw loopback HTTP is required to actually
  // exercise a forged Host rather than accidentally testing the valid host.
  const raw = (
    method: string,
    route: string,
    headers: Record<string, string>,
    body?: string,
  ) =>
    new Promise<Response>((resolve, reject) => {
      const request = httpRequest(
        base + route,
        { method, headers },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          response.on("end", () =>
            resolve(
              new Response(Buffer.concat(chunks), {
                status: response.statusCode,
              }),
            ),
          );
        },
      );
      request.on("error", reject);
      request.end(body);
    });
  const get = (route: string, headers: Record<string, string> = {}) =>
    headers.Host
      ? raw("GET", route, headers)
      : fetch(base + route, { headers });
  const post = (
    route: string,
    body: unknown,
    headers: Record<string, string> = alice,
  ) =>
    headers.Host
      ? raw(
          "POST",
          route,
          { "Content-Type": "application/json", ...headers },
          JSON.stringify(body),
        )
      : fetch(base + route, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(body),
        });
  return { app, base, get, post, store, runtime, directory, entitled };
}
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  vi.unstubAllEnvs();
});

describe("explicit loopback runtime and hosted preview protection", () => {
  it("only enables local mode with both launcher and binding configuration", () => {
    expect(resolveRuntime({}).mode).toBe("hosted");
    expect(resolveRuntime({ PG_LOCAL_BOOTSTRAP: "1" }).mode).toBe("hosted");
    expect(
      resolveRuntime({ PG_LOCAL_BOOTSTRAP: "1", PG_BIND_HOST: "0.0.0.0" }).mode,
    ).toBe("hosted");
    expect(
      resolveRuntime({ PG_LOCAL_BOOTSTRAP: "1", PG_BIND_HOST: "127.0.0.1" })
        .mode,
    ).toBe("local");
  });
  it.each([
    "NODE_ENV",
    "RAILWAY_PROJECT_ID",
    "RAILWAY_ENVIRONMENT_ID",
    "VERCEL",
    "NETLIFY",
    "RENDER",
    "K_SERVICE",
    "AWS_LAMBDA_FUNCTION_NAME",
    "FLY_APP_NAME",
    "DYNO",
  ])("cannot activate local bypass in hosted marker %s", (key) => {
    const env = {
      PG_LOCAL_BOOTSTRAP: "1",
      PG_BIND_HOST: "127.0.0.1",
      [key]: key === "NODE_ENV" ? "production" : "hosted",
    };
    expect(resolveRuntime(env).mode).toBe("hosted");
    expect(resolveRuntime(env).publishingDirectory).toBeNull();
  });
  it("does not accept a loopback-looking Host or forwarded address without the real socket", () => {
    const runtime = resolveRuntime({
      PG_LOCAL_BOOTSTRAP: "1",
      PG_BIND_HOST: "127.0.0.1",
    });
    expect(
      isLocalRuntimeRequest(
        {
          headers: { host: "localhost:3000", "x-forwarded-for": "127.0.0.1" },
          socket: {
            localAddress: "127.0.0.1",
            remoteAddress: "203.0.113.4",
            localPort: 3000,
          },
        } as any,
        runtime,
      ),
    ).toBe(false);
    expect(
      isLocalRuntimeRequest(
        {
          headers: { host: "localhost:3000" },
          socket: {
            localAddress: "0.0.0.0",
            remoteAddress: "127.0.0.1",
            localPort: 3000,
          },
        } as any,
        runtime,
      ),
    ).toBe(false);
  });
  it("bypasses the password only for legitimate local requests, retaining Host/origin protection", async () => {
    vi.stubEnv(
      "PREVIEW_PASSWORD_HASH",
      "configured-local-value-must-not-prompt",
    );
    const h = await harness({ gate: true });
    expect((await h.get("/")).status).toBe(200);
    expect((await h.get("/assets/app.js")).status).toBe(200);
    expect(
      (
        await h.get("/", {
          Host: "attacker.example",
          "X-Forwarded-Host": "localhost:3000",
        })
      ).status,
    ).toBe(403);
    expect(
      (await h.get("/", { Origin: "https://attacker.example" })).status,
    ).toBe(403);
    expect((await h.get("/", { "Sec-Fetch-Site": "cross-site" })).status).toBe(
      403,
    );
  });
  it("hosted runtime remains password-gated even over a real loopback socket and spoofed local flags", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const h = await harness({ hosted: true, gate: true });
    const page = await h.get("/");
    expect(page.status).toBe(503);
    expect(await page.text()).not.toContain("APP_SECRET");
    expect((await h.get("/api/portfolios/capabilities")).status).toBe(401);
    expect((await h.get("/assets/app.js")).status).toBe(503);
  });
  it("hosted valid password still works while local mode requires no password", async () => {
    const salt = "ab".repeat(16);
    vi.stubEnv(
      "PREVIEW_PASSWORD_HASH",
      `${salt}:${scryptSync("test-only-credential", salt, 64).toString("hex")}`,
    );
    const h = await harness({ hosted: true, gate: true });
    expect((await h.get("/")).status).toBe(401);
    const response = await fetch(h.base + "/preview/login", {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "password=test-only-credential",
    });
    expect(response.status).toBe(303);
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    expect((await h.get("/", { Cookie: cookie })).status).toBe(200);
  });
});

describe("local publication ownership, snapshots and safe rendering", () => {
  it("publishes a real persistent snapshot with honest local and desired-domain URLs", async () => {
    const h = await harness(),
      value = draft();
    const result = await h.post("/api/portfolios/publish", {
      slug: " Avery-Example ",
      draft: value,
    });
    expect(result.status).toBe(201);
    const { publication } = await result.json();
    expect(publication).toMatchObject({
      slug: "avery-example",
      version: 1,
      status: "published",
      isPublicInternet: false,
      scope: "local-machine",
      desiredProductionUrl: "https://avery-example.portfoliograded.com",
    });
    expect(publication.localUrl).toBe(
      `${h.runtime.localOrigin}/p/avery-example`,
    );
    expect(h.entitled).not.toHaveBeenCalled();
    value.name = "Changed only in memory";
    const publicPage = await h.get("/p/avery-example");
    expect(publicPage.status).toBe(200);
    expect(await publicPage.text()).toContain("Avery Example");
    expect(
      new LocalPublishingStore(h.store.directory).owned(
        "avery-example",
        "user:alice",
      )?.version,
    ).toBe(1);
    const restored = await h.get("/api/portfolios/avery-example", alice);
    expect((await restored.json()).draft.name).toBe("Avery Example");
    expect(statSync(h.store.indexFile).mode & 0o777).toBe(0o600);
  });
  it("supports an unguessable browser owner without pretending the visitor bought Pro", async () => {
    const h = await harness();
    const response = await h.post(
      "/api/portfolios/publish",
      { slug: "visitor-site", draft: draft() },
      {},
    );
    expect(response.status).toBe(201);
    const rawCookie = response.headers.get("set-cookie")!;
    expect(rawCookie).toContain("HttpOnly");
    expect(rawCookie).toContain("SameSite=Lax");
    const cookie = rawCookie.split(";")[0];
    expect((await h.get("/api/portfolios/visitor-site")).status).toBe(404);
    expect(
      (await h.get("/api/portfolios/visitor-site", { Cookie: cookie })).status,
    ).toBe(200);
    expect(h.entitled).not.toHaveBeenCalled();
  });
  it("prevents cross-owner list/read/update/unpublish and exposes no ownership token in metadata", async () => {
    const h = await harness();
    await h.post("/api/portfolios/publish", {
      slug: "owned-site",
      draft: draft(),
    });
    const otherList = await (await h.get("/api/portfolios", bob)).json();
    expect(otherList.publications).toEqual([]);
    expect((await h.get("/api/portfolios/owned-site", bob)).status).toBe(404);
    expect(
      (
        await h.post(
          "/api/portfolios/publish",
          { slug: "owned-site", expectedVersion: 1, draft: draft() },
          bob,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await h.post(
          "/api/portfolios/owned-site/unpublish",
          { expectedVersion: 1 },
          bob,
        )
      ).status,
    ).toBe(404);
    const mine = await (await h.get("/api/portfolios", alice)).text();
    expect(mine).not.toContain("user:alice");
    expect(mine).not.toContain("ownerId");
    expect(mine).not.toContain("snapshotId");
    expect((await h.get("/p/owned-site")).status).toBe(200);
  });
  it("rejects stale updates, writes immutable snapshots and leaves current state unchanged until publishing", async () => {
    const h = await harness();
    const first = draft();
    await h.post("/api/portfolios/publish", {
      slug: "versioned-site",
      draft: first,
    });
    const old = h.store.owned("versioned-site", "user:alice")!,
      oldPath = path.join(
        h.store.snapshotsDirectory,
        `${old.currentSnapshotId}.html`,
      ),
      bytes = readFileSync(oldPath);
    const edited = {
      ...first,
      headline: "A new supplied headline",
      revision: 2,
    };
    expect(
      (
        await h.post("/api/portfolios/publish", {
          slug: "versioned-site",
          draft: edited,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await h.post("/api/portfolios/publish", {
          slug: "versioned-site",
          expectedVersion: 0,
          draft: edited,
        })
      ).status,
    ).toBe(409);
    const latest = await h.post("/api/portfolios/publish", {
      slug: "VERSIONED-SITE",
      expectedVersion: 1,
      draft: edited,
    });
    expect(latest.status).toBe(201);
    expect((await latest.json()).publication.version).toBe(2);
    expect(readFileSync(oldPath).equals(bytes)).toBe(true);
    expect(
      h.store.owned("versioned-site", "user:alice")!.snapshots,
    ).toHaveLength(2);
    expect(await (await h.get("/p/versioned-site")).text()).toContain(
      "A new supplied headline",
    );
  });
  it("unpublishes all public access without releasing the owner's slug or deleting snapshot history", async () => {
    const h = await harness();
    await h.post("/api/portfolios/publish", {
      slug: "retained-site",
      draft: draft(),
    });
    const response = await h.post("/api/portfolios/retained-site/unpublish", {
      expectedVersion: 1,
    });
    expect(response.status).toBe(200);
    expect((await response.json()).publication).toMatchObject({
      version: 2,
      status: "unpublished",
      localUrl: null,
    });
    expect((await h.get("/p/retained-site")).status).toBe(404);
    expect((await h.get("/p/retained-site?version=1")).status).toBe(404);
    expect(readdirSync(h.store.snapshotsDirectory)).toHaveLength(2);
    expect(
      (
        await h.post(
          "/api/portfolios/publish",
          { slug: "retained-site", draft: draft() },
          bob,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await h.post("/api/portfolios/publish", {
          slug: "retained-site",
          expectedVersion: 2,
          draft: draft(),
        })
      ).status,
    ).toBe(201);
  });
  it("keeps published text inert with strict URLs, a script-blocking CSP and no app-origin privileges", async () => {
    const h = await harness(),
      value = draft();
    value.name = '<script>alert("x")</script>';
    value.bio = "<img src=x onerror=alert(1)>";
    expect(
      (
        await h.post("/api/portfolios/publish", {
          slug: "safe-html",
          draft: value,
        })
      ).status,
    ).toBe(201);
    const response = await h.get("/p/safe-html"),
      html = await response.text(),
      $ = load(html);
    expect($("script,[onerror],iframe,form").length).toBe(0);
    expect($("h1").text()).toBe(value.name);
    expect(response.headers.get("content-security-policy")).toContain(
      "script-src 'none'",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "sandbox allow-popups",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    for (const link of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "file:///etc/passwd",
      "http://example.com",
      "https://user:pass@example.com",
      "https://",
    ]) {
      const invalid = {
        ...draft(),
        links: [{ id: "profile", label: "Profile", url: link }],
      };
      expect(
        (
          await h.post("/api/portfolios/publish", {
            slug: "invalid-html",
            draft: invalid,
          })
        ).status,
      ).toBe(400);
    }
    expect(h.store.owned("invalid-html", "user:alice")).toBeNull();
  });
  it("rejects extra/prototype fields, incomplete identity and oversized requests without mutating state", async () => {
    const h = await harness();
    for (const body of [
      { slug: "bad-input", draft: draft(), pro: true },
      { slug: "bad-input", draft: { ...draft(), email: "partial@" } },
      { slug: "bad-input", draft: { ...draft(), name: "" } },
      JSON.parse(
        JSON.stringify({ slug: "bad-input", draft: draft() }).replace(
          '"draft":',
          '"__proto__":{"polluted":true},"draft":',
        ),
      ),
    ])
      expect((await h.post("/api/portfolios/publish", body)).status).toBe(400);
    expect(
      (
        await h.post("/api/portfolios/publish", {
          slug: "huge-body",
          draft: draft(),
          padding: "x".repeat(MAX_DRAFT_BYTES + 20_000),
        })
      ).status,
    ).toBe(413);
    expect(existsSync(h.store.indexFile)).toBe(false);
    expect(({} as any).polluted).toBeUndefined();
  });
  it("rejects reserved/malformed/traversal slugs and reports local-only reservation scope", async () => {
    const h = await harness();
    for (const slug of [
      "../secret",
      "ab",
      "a--b",
      "-name",
      "name-",
      "a/b",
      "ümlaut",
      "a".repeat(41),
      "a.b",
      "__proto__",
    ])
      expect(() => normalizePortfolioSlug(slug)).toThrow();
    for (const slug of [
      "WWW",
      "admin",
      "api",
      "constructor",
      "prototype",
      "mail",
    ])
      expect(() => normalizePortfolioSlug(slug)).toThrow();
    expect(
      await (await h.get("/api/portfolios/availability?slug=admin")).json(),
    ).toMatchObject({
      available: false,
      reserved: true,
      scope: "local-machine",
    });
    expect(
      await (
        await h.get("/api/portfolios/availability?slug=new-person")
      ).json(),
    ).toMatchObject({ available: true, scope: "local-machine" });
  });
  it("rejects cross-origin writes and DNS-rebinding Hosts before any store write", async () => {
    const h = await harness();
    const body = { slug: "csrf-site", draft: draft() };
    expect(
      (
        await h.post("/api/portfolios/publish", body, {
          ...alice,
          Origin: "https://attacker.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await h.post("/api/portfolios/publish", body, {
          ...alice,
          "Sec-Fetch-Site": "cross-site",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await h.post("/api/portfolios/publish", body, {
          ...alice,
          Host: "attacker.example",
          "X-Forwarded-Host": "localhost",
        })
      ).status,
    ).toBe(403);
    expect(existsSync(h.store.indexFile)).toBe(false);
  });
  it("fails closed on corrupt storage without overwriting or exposing filesystem details", async () => {
    const h = await harness();
    await h.post("/api/portfolios/publish", {
      slug: "before-corrupt",
      draft: draft(),
    });
    writeFileSync(h.store.indexFile, "PRIVATE_INVALID_INDEX");
    const response = await h.post("/api/portfolios/publish", {
      slug: "after-corrupt",
      draft: draft(),
    });
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).not.toContain(h.directory);
    expect(body).not.toContain("PRIVATE_INVALID_INDEX");
    expect(readFileSync(h.store.indexFile, "utf8")).toBe(
      "PRIVATE_INVALID_INDEX",
    );
  });
});

describe("hosted publishing never falls back to local disk or client Pro flags", () => {
  it("requires verified account then real server entitlement and still refuses an absent hosting adapter", async () => {
    const h = await harness({ hosted: true });
    expect(
      await (await h.get("/api/portfolios/capabilities")).json(),
    ).toMatchObject({
      mode: "hosted-disabled",
      canPublish: false,
      requiresPro: true,
    });
    const input = {
      slug: "hosted-site",
      draft: draft(),
      pro: true,
      local: true,
    };
    expect((await h.post("/api/portfolios/publish", input, {})).status).toBe(
      401,
    );
    expect((await h.post("/api/portfolios/publish", input)).status).toBe(403);
    expect(h.entitled).toHaveBeenCalledWith("alice");
    h.entitled.mockResolvedValue(true);
    expect((await h.post("/api/portfolios/publish", input)).status).toBe(501);
    expect(existsSync(h.store.indexFile)).toBe(false);
    expect((await h.get("/p/hosted-site")).status).toBe(404);
  });
  it("fails closed if entitlement verification fails", async () => {
    const h = await harness({ hosted: true });
    h.entitled.mockRejectedValue(new Error("PRIVATE_FIREBASE_FAILURE"));
    const response = await h.post("/api/portfolios/publish", {
      slug: "hosted-site",
      draft: draft(),
    });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE_FIREBASE");
    expect(existsSync(h.store.indexFile)).toBe(false);
  });
});
