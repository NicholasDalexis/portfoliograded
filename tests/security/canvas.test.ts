import { expect, test } from "vitest";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import {
  createEmptyPortfolioDraft,
  exportPortfolioHTML,
} from "@shared/portfolio";
import { editorPortfolioHTML } from "@/components/PortfolioCanvas";

test("canvas runs only its fixed editor script and untrusted text cannot inject executable markup", () => {
  const draft = createEmptyPortfolioDraft();
  const payload =
    '</script><script>parent.fetch("https://evil.example")</script><img src=x onerror=alert(1)>';
  draft.name = payload.slice(0, 100);
  draft.bio = payload;
  draft.email = "unfinished@";
  draft.links = [{ id: "bad", label: "unsafe", url: "javascript:alert(1)" }];
  draft.projects = [
    {
      id: "safe-project",
      title: "Project",
      summary: payload,
      role: "",
      process: "",
      outcome: "",
      link: "http://127.0.0.1:3000/private",
    },
  ];
  const $ = load(editorPortfolioHTML(draft));
  expect($("script").length).toBe(1);
  const script = $("script").text();
  expect(script).not.toContain("evil.example");
  expect(script).toContain("pg-edit-section");
  expect($("[onerror],iframe,object,embed,form").length).toBe(0);
  expect($("a[href^='javascript:'],a[href^='http:']").length).toBe(0);
  expect($(".email-link").length).toBe(0);
  const policy = $("meta[http-equiv=Content-Security-Policy]").attr("content")!;
  expect(policy).toContain("default-src 'none'");
  expect(policy).toContain("connect-src 'none'");
  expect(policy).not.toContain("script-src 'unsafe-inline'");
  expect(policy).toContain(
    `script-src 'sha256-${createHash("sha256").update(script).digest("base64")}'`,
  );
  // Exercise the trusted script in a minimal DOM adapter. This is behavioral:
  // restoration is accepted only from the parent, finite numbers are required,
  // and offsets are clamped before they reach scrollTo. No browser or network.
  const callbacks = new Map<string, (event?: any) => void>();
  const messages: unknown[] = [];
  const scrollCalls: Array<{ top: number }> = [];
  const parent = { postMessage: (message: unknown) => messages.push(message) };
  runInNewContext(
    script,
    {
      document: {
        addEventListener: () => {},
        documentElement: { scrollHeight: 2000 },
      },
      window: {
        addEventListener: (type: string, fn: (event?: any) => void) =>
          callbacks.set(type, fn),
      },
      parent,
      scrollY: 345,
      scrollTo: (options: { top: number }) => scrollCalls.push(options),
    },
    { timeout: 100 },
  );
  const restore = callbacks.get("message")!;
  restore({ source: {}, data: { type: "pg-canvas-restore", y: 10 } });
  for (const y of [NaN, Infinity, -Infinity, "12", null])
    restore({ source: parent, data: { type: "pg-canvas-restore", y } });
  expect(scrollCalls).toHaveLength(0);
  restore({ source: parent, data: { type: "pg-canvas-restore", y: -20 } });
  restore({ source: parent, data: { type: "pg-canvas-restore", y: 5000 } });
  restore({ source: parent, data: { type: "pg-canvas-restore", y: 120 } });
  expect(scrollCalls.map((call) => call.top)).toEqual([0, 2000, 120]);
  callbacks.get("scroll")!();
  expect(messages).toEqual([{ type: "pg-canvas-scroll", y: 345 }]);
  const strict = {
    ...draft,
    email: "",
    links: [],
    projects: draft.projects.map((p) => ({ ...p, link: "" })),
  };
  expect(load(exportPortfolioHTML(strict))("script").length).toBe(0);
  expect(
    load(exportPortfolioHTML(strict))(
      "meta[http-equiv=Content-Security-Policy]",
    ).attr("content"),
  ).toContain("script-src 'none'");
});
