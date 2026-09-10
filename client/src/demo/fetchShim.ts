/*
 * Demo-mode fetch shim (VITE_DEMO=1 builds only. localhost design review).
 * Intercepts the two /api/audits calls and answers them in the browser using
 * the shared mock engine (buildAudit), so the site runs fully static with no
 * server, keys, or install. No-op in normal builds.
 */
import { buildAudit } from "@shared/audit";

type StoredAudit = {
  id: string;
  url: string;
  role: string;
  pro: boolean;
  report: unknown;
  createdAt: string;
};

const KEY = (id: string) => `fg_demo_audit_${id}`;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.env.VITE_DEMO === "1") {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (!url.startsWith("/api/audits")) return realFetch(input, init);

    const method = (init?.method ?? "GET").toUpperCase();

    // POST /api/audits. run a "scan" and store it for the redirect.
    if (method === "POST") {
      await delay(1200); // let the scanning animation breathe
      let body: { url?: string; role?: string; pro?: boolean } = {};
      try {
        body = JSON.parse((init?.body as string) ?? "{}");
      } catch {
        /* ignore */
      }
      const targetUrl = body.url?.trim() || "https://your-portfolio.com";
      const role = body.role?.trim() || "Creative";
      const pro = body.pro === true;
      const report = buildAudit(targetUrl, role, pro);
      const id = Math.random().toString(36).slice(2, 10);
      const stored: StoredAudit = {
        id,
        url: targetUrl,
        role,
        pro,
        report,
        createdAt: new Date().toISOString(),
      };
      window.sessionStorage.setItem(KEY(id), JSON.stringify(stored));
      return json({ id, status: "complete", report }, 201);
    }

    // GET /api/audits/:id
    const id = url.slice(url.lastIndexOf("/") + 1).split("?")[0];
    const saved = window.sessionStorage.getItem(KEY(id));
    if (saved) return json(JSON.parse(saved));

    // Unknown id (fresh tab, direct link): deterministic fallback report.
    const report = buildAudit("https://your-portfolio.com", "Creative", false);
    return json({
      id,
      url: "https://your-portfolio.com",
      role: "Creative",
      pro: false,
      report,
      createdAt: new Date().toISOString(),
    });
  };
}

export {};
