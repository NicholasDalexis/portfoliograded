import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
  },
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({ choices: [{ message: { content: "" } }] })),
}));

import { normalizeAuditUrl, runPortfolioAudit, scoreToGrade } from "./auditEngine";

const sampleHtml = `<!doctype html>
<html lang="en">
<head>
  <title>Jordan Lee — Product Designer Portfolio</title>
  <meta name="description" content="Product designer creating measurable SaaS onboarding and growth experiences." />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta property="og:title" content="Jordan Lee Portfolio" />
  <meta property="og:image" content="/preview.jpg" />
  <style>@media (max-width: 640px) { body { font-size: 16px; } }</style>
</head>
<body>
  <nav><a href="#work">Work</a><a href="mailto:jordan@example.com">Contact</a></nav>
  <main>
    <h1>Product designer for SaaS growth teams</h1>
    <section id="about"><h2>About</h2><p>I am a designer focused on onboarding, conversion, and measurable product outcomes.</p></section>
    <section id="work"><h2>Selected work</h2><article><h3>Case study: activation redesign</h3><p>Improved conversion by 24% and reduced drop-off for 80,000 users.</p><img src="/case.jpg" alt="Activation dashboard case study" /></article></section>
    <a href="https://linkedin.com/in/jordan">LinkedIn</a>
    <a href="/resume.pdf">Resume</a>
  </main>
  <footer>Get in touch for design leadership and product strategy.</footer>
  <script type="module" src="/app.js"></script>
</body>
</html>`;

function mockHtmlFetch(html = sampleHtml) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    ),
  );
}

describe("auditEngine", () => {
  beforeEach(() => {
    mockHtmlFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("normalizes public portfolio URLs and rejects local targets", async () => {
    await expect(normalizeAuditUrl("example.com/work#intro")).resolves.toBe("https://example.com/work");
    await expect(normalizeAuditUrl("localhost:3000")).rejects.toThrow("public http or https URL");
    await expect(normalizeAuditUrl("http://127.0.0.1:8080")).rejects.toThrow("public websites");
  });

  it("maps scores to the same grade scale used by the frontend", () => {
    expect(scoreToGrade(97, true)).toBe("S");
    expect(scoreToGrade(95, false)).toBe("A+");
    expect(scoreToGrade(80, false)).toBe("B");
    expect(scoreToGrade(66, false)).toBe("D");
  });

  it("builds a complete audit report from real crawled HTML signals", async () => {
    const report = await runPortfolioAudit({
      url: "https://example.com",
      role: "Product Design",
      isPro: false,
    });

    expect(report.url).toBe("https://example.com/");
    expect(report.role).toBe("Product Design");
    expect(report.overall).toBeGreaterThanOrEqual(40);
    expect(report.overallGrade).toMatch(/^(S|A\+|A|A-|B\+|B|B-|C\+|C|C-|D)$/);
    expect(report.categories).toHaveLength(9);
    expect(report.categories.map((category) => category.key)).toContain("mobile");
    expect(report.categories.map((category) => category.key)).toContain("accessibility");
    expect(report.topFixes.length).toBeGreaterThanOrEqual(3);
    expect(report.loadDesktopMs).toBeGreaterThan(0);
    expect(report.loadMobileMs).toBeGreaterThan(report.loadDesktopMs);
  });
});
