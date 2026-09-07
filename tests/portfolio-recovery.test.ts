import { describe, expect, it } from "vitest";
import { createEmptyPortfolioDraft, validatePortfolioDraft, validateEditablePortfolioDraft, serializePortfolioDraft, importPortfolioJSON, exportPortfolioHTML, MAX_IMAGES, MAX_DRAFT_BYTES, PORTFOLIO_TEXT_LIMITS, type PortfolioDraft } from "../shared/portfolio";
import { loadPortfolioDraft, savePortfolioDraft, PORTFOLIO_STORAGE_KEY, type PortfolioStorage } from "../client/src/lib/portfolioStorage";
function fixture(): PortfolioDraft {
  return { ...createEmptyPortfolioDraft(), name: "Jordan", headline: "Graphic designer", email: "jordan@example.com", links: [{ id: "social", label: "Profile", url: "https://example.com" }], projects: [{ id: "p1", title: "Film posters", summary: "Work for a neighborhood film event.", role: "Designer", process: "", outcome: "", link: "https://example.com/project" }] };
}
function storage() {
  const map = new Map<string, string>();
  const api: PortfolioStorage = { getItem: key => map.get(key) ?? null, setItem: (key,value) => { map.set(key,value); }, removeItem: key => { map.delete(key); } };
  return api;
}
const tinyJpeg = { src: "data:image/jpeg;base64,/9j/", alt: "Test image" };

describe("editable draft recovery without weakening output", () => {
  it("saves unrelated edits made after an incomplete email, then restores all fields", () => {
    const saved = storage(); const original = fixture(); savePortfolioDraft(original, saved);
    const edited = { ...original, email: "jordan@", name: "Jordan Lee", revision: original.revision + 2, projects: original.projects.map(project => ({ ...project, summary: "New description typed after the incomplete contact field." })) };
    savePortfolioDraft(edited, saved);
    expect(loadPortfolioDraft(saved)).toEqual(edited);
    expect(() => exportPortfolioHTML(edited)).toThrow();
  });
  it.each(["", "h", "https://", "linkedin.com/in/jordan", " https://example.com", "http://example.com"])('roundtrips unfinished or invalid link text %j in editable JSON only', url => {
    const draft = fixture(); draft.links[0].url = url; draft.projects[0].link = url;
    expect(importPortfolioJSON(serializePortfolioDraft(draft))).toEqual(draft);
    if (url) expect(() => exportPortfolioHTML(draft)).toThrow();
  });
  it.each(["j", "jordan@", "jordan@example", "a b@example.com"])("roundtrips incomplete email %j without allowing an exported mail link", email => {
    const draft = { ...fixture(), email };
    expect(validateEditablePortfolioDraft(draft).email).toBe(email);
    expect(importPortfolioJSON(serializePortfolioDraft(draft))).toEqual(draft);
    expect(() => validatePortfolioDraft(draft)).toThrow();
    expect(() => exportPortfolioHTML(draft)).toThrow();
  });
  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "https://name:password@example.com"])("keeps %j inert in recovery and rejects every active link output", url => {
    const draft = fixture(); draft.links[0].url = url; draft.projects[0].link = url;
    const reloaded = importPortfolioJSON(serializePortfolioDraft(draft));
    expect(reloaded.links[0].url).toBe(url);
    expect(() => validatePortfolioDraft(reloaded)).toThrow();
    expect(() => exportPortfolioHTML(reloaded)).toThrow();
  });
  it("exports corrected contact information after recovering an unfinished draft", () => {
    const draft = fixture(); draft.email = "jordan@"; draft.projects[0].link = "https://";
    const restored = importPortfolioJSON(serializePortfolioDraft(draft));
    restored.email = "jordan@example.com"; restored.projects[0].link = "https://example.com/new";
    expect(exportPortfolioHTML(restored)).toContain('href="https://example.com/new"');
    expect(exportPortfolioHTML(restored)).toContain('mailto:jordan%40example.com');
  });
  it("still escapes all text when valid contact data permits HTML export", () => {
    const draft = fixture(); draft.name = '<script>alert("name")</script>'; draft.links[0].label = '<img src=x onerror=alert(1)>';
    const html = exportPortfolioHTML(importPortfolioJSON(serializePortfolioDraft(draft)));
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img src=x'); expect(html).toContain('&lt;script&gt;');
  });
  it.each(["email", "social", "project"])("keeps the text-size boundary for %s", target => {
    const draft = fixture();
    if (target === "email") draft.email = "x".repeat(PORTFOLIO_TEXT_LIMITS.email + 1);
    if (target === "social") draft.links[0].url = "x".repeat(PORTFOLIO_TEXT_LIMITS.url + 1);
    if (target === "project") draft.projects[0].link = "x".repeat(PORTFOLIO_TEXT_LIMITS.url + 1);
    expect(() => validateEditablePortfolioDraft(draft)).toThrow();
  });
  it.each(["email", "social", "project"])("rejects unsupported control characters for %s", target => {
    const draft = fixture();
    if (target === "email") draft.email = "part\u0000address";
    if (target === "social") draft.links[0].url = "part\u001baddress";
    if (target === "project") draft.projects[0].link = "part\u007faddress";
    expect(() => serializePortfolioDraft(draft)).toThrow();
  });
  it("retains strict structure, IDs, duplicate and image checks in editable state", () => {
    const draft = fixture(); draft.email = "partial@";
    expect(() => validateEditablePortfolioDraft({ ...draft, unexpected: true })).toThrow();
    expect(() => validateEditablePortfolioDraft({ ...draft, projects: [...draft.projects, ...draft.projects] })).toThrow();
    expect(() => validateEditablePortfolioDraft({ ...draft, links: [...draft.links, ...draft.links] })).toThrow();
    expect(() => validateEditablePortfolioDraft({ ...draft, projects: [{ ...draft.projects[0], image: { src: 'data:image/svg+xml,<svg/>', alt: '' } }] })).toThrow();
    expect(() => validateEditablePortfolioDraft({ ...draft, projects: Array.from({ length: MAX_IMAGES + 1 }, (_, i) => ({ ...draft.projects[0], id: `p${i}`, image: tinyJpeg })) })).toThrow();
  });
  it("rejects prototype properties and oversized JSON before recovery", () => {
    const draft = fixture();
    const injected = JSON.stringify(draft).replace('"name":"Jordan"', '"name":"Jordan","__proto__":{"polluted":true}');
    expect(() => importPortfolioJSON(injected)).toThrow();
    expect(() => importPortfolioJSON(" ".repeat(MAX_DRAFT_BYTES + 1))).toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("preserves prior storage on a real quota failure and keeps the new editable backup usable", () => {
    const saved = storage(); const original = fixture(); savePortfolioDraft(original, saved);
    const blocked: PortfolioStorage = { ...saved, setItem() { throw new Error("QuotaExceededError"); } };
    const edited = { ...original, email: "partial@", name: "Latest valid identity" };
    expect(() => savePortfolioDraft(edited, blocked)).toThrow();
    expect(loadPortfolioDraft(saved)).toEqual(original);
    expect(importPortfolioJSON(serializePortfolioDraft(edited))).toEqual(edited);
  });
  it("loads pre-change backups without migration or ID changes", () => {
    const original = fixture(); const saved = storage(); saved.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(original));
    expect(loadPortfolioDraft(saved)).toEqual(original);
    expect(validatePortfolioDraft(loadPortfolioDraft(saved))).toEqual(original);
  });
});
