import { describe, expect, it } from "vitest";
import { load } from "cheerio";
import {
  ACCENT_IDS, TEMPLATE_IDS, MAX_DRAFT_BYTES, MAX_IMAGE_BYTES,
  createEmptyPortfolioDraft, validatePortfolioDraft, importPortfolioJSON, serializePortfolioDraft,
  exportPortfolioHTML, isSafePortfolioURL, isSafePortfolioImage, type PortfolioDraft,
} from "../shared/portfolio";
import { loadPortfolioDraft, savePortfolioDraft, PORTFOLIO_STORAGE_KEY, type PortfolioStorage } from "../client/src/lib/portfolioStorage";

const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
const project = (id = "project-one") => ({ id, title: "User project", summary: "A description supplied by its author.", role: "Designer", process: "Asked questions, then iterated.", outcome: "Prototype completed.", image: { src: image, alt: "An author-supplied project preview" }, link: "https://example.com/project" });
const fixture = (): PortfolioDraft => ({ ...createEmptyPortfolioDraft(), name: "Avery Example", headline: "Selected design work", role: "Graphic Design", bio: "An author-written introduction.\nA second line.", email: "avery@example.com", location: "London", links: [{ id: "link-one", label: "Profile", url: "https://example.com/profile" }], projects: [project()] });
class MemoryStorage implements PortfolioStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("portfolio draft contract", () => {
  it("starts genuinely blank and round-trips without modifying typed text or revision", () => {
    const draft = createEmptyPortfolioDraft(); draft.bio = "  Keep my spacing.\n\nAnd line breaks.  ";
    expect(draft.projects).toEqual([]); expect(draft.name).toBe("");
    expect(importPortfolioJSON(serializePortfolioDraft(draft))).toEqual(draft);
  });
  it("preserves valid projects, images, accents, templates and author content", () => {
    const draft = fixture(); draft.template = "gallery"; draft.accent = "sage";
    expect(importPortfolioJSON(serializePortfolioDraft(draft))).toEqual(draft);
  });
  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "http://example.com", "//example.com", "https:example.com", "https://user:pass@example.com", "https://example.com\n.evil", "https://example.com\\@evil.com", "mailto:a@example.com"])("rejects unsafe project URL %s", url => {
    const draft = fixture(); draft.projects[0].link = url;
    expect(isSafePortfolioURL(url)).toBe(false); expect(() => validatePortfolioDraft(draft)).toThrow();
  });
  it("allows ordinary HTTPS URLs, fragments and blank links during editing", () => {
    for (const value of ["", "https://example.com", "https://example.com/project?q=design&view=full#work"]) expect(isSafePortfolioURL(value)).toBe(true);
  });
  it("rejects malformed, unknown-shape, prototype-key and oversized imports", () => {
    for (const json of ["{broken", "null", "[]", JSON.stringify({ ...fixture(), revision: 0 }), JSON.stringify({ ...fixture(), updatedAt: "yesterday" }), JSON.stringify({ ...fixture(), template: "<script>" }), JSON.stringify({ ...fixture(), extra: "not part of schema" }), JSON.stringify(fixture()).replace('{"id":', '{"__proto__":{"polluted":true},"id":')]) expect(() => importPortfolioJSON(json)).toThrow();
    expect(() => importPortfolioJSON(" ".repeat(MAX_DRAFT_BYTES + 1))).toThrow(/2 MB/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("enforces text, item, image-count, image-size and total byte bounds", () => {
    const draft = fixture();
    expect(() => validatePortfolioDraft({ ...draft, bio: "x".repeat(3001) })).toThrow();
    expect(() => validatePortfolioDraft({ ...draft, links: Array.from({ length: 9 }, (_, i) => ({ id: `l-${i}`, label: "", url: "" })) })).toThrow();
    expect(() => validatePortfolioDraft({ ...draft, projects: Array.from({ length: 13 }, (_, i) => ({ ...project(`p-${i}`), image: undefined })) })).toThrow();
    expect(() => validatePortfolioDraft({ ...draft, projects: Array.from({ length: 7 }, (_, i) => project(`p-${i}`)) })).toThrow(/six/);
    expect(isSafePortfolioImage(`data:image/jpeg;base64,${Buffer.concat([Buffer.from([255, 216, 255]), Buffer.alloc(MAX_IMAGE_BYTES)]).toString("base64")}`)).toBe(false);
    expect(() => validatePortfolioDraft({ ...draft, projects: [project(), project()] })).toThrow(/unique/);
    // Each image fits its individual budget; aggregate base64 JSON does not.
    const largeImage = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([255, 216, 255]), Buffer.alloc(MAX_IMAGE_BYTES - 3)]).toString("base64")}`;
    expect(isSafePortfolioImage(largeImage)).toBe(true);
    expect(() => validatePortfolioDraft({ ...draft, projects: Array.from({ length: 6 }, (_, i) => ({ ...project(`p-${i}`), image: { src: largeImage, alt: "" } })) })).toThrow(/2 MB/);
  });
  it.each(["data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "https://example.com/a.png", "data:image/png;base64,PHNjcmlwdD4=", "data:image/jpeg;base64,AA==", "data:image/webp;base64,AAAA", "data:image/png;base64,iVBORw0KGgo=\n"])("rejects unsafe or mismatched image %s", src => {
    expect(isSafePortfolioImage(src)).toBe(false);
    expect(() => validatePortfolioDraft({ ...fixture(), projects: [{ ...project(), image: { src, alt: "" } }] })).toThrow();
  });
  it("rejects header injection in email", () => {
    expect(() => validatePortfolioDraft({ ...fixture(), email: "a@example.com?subject=x&bcc=other@example.com" })).toThrow();
    expect(() => validatePortfolioDraft({ ...fixture(), email: "a@example.com\r\nBcc:x@example.com" })).toThrow();
  });
});

describe("safe responsive HTML export", () => {
  it.each(TEMPLATE_IDS)("renders %s with the same author data, semantic structure and mobile breakpoints", template => {
    const draft = fixture(); draft.template = template;
    const html = exportPortfolioHTML(draft); const $ = load(html);
    expect($("body").attr("class")).toBe(template); expect($("h1").text()).toBe(draft.name);
    expect($("main article h3").text()).toBe(draft.projects[0].title);
    expect($("main article img").attr("alt")).toBe(draft.projects[0].image!.alt);
    expect($("meta[name=viewport]").attr("content")).toBe("width=device-width, initial-scale=1");
    expect($("a.skip").attr("href")).toBe("#main"); expect($("main#main").length).toBe(1);
    expect(html).toContain("@media(max-width:900px)"); expect(html).toContain("@media(max-width:600px)");
    expect(html).toContain("prefers-reduced-motion"); expect(html).toContain(":focus-visible");
    expect($("script,iframe,object,embed,form,link").length).toBe(0);
    expect($("meta[http-equiv=Content-Security-Policy]").attr("content")).toContain("script-src 'none'");
    $("a[target]").each((_, node) => { expect($(node).attr("target")).toBe("_blank"); expect($(node).attr("rel")).toBe("noopener noreferrer"); });
    expect($("footer a").attr("href")).toBe("https://portfoliograded.com");
  });
  it.each(ACCENT_IDS)("uses only the fixed %s palette", accent => {
    const draft = fixture(); draft.accent = accent; expect(exportPortfolioHTML(draft)).toContain("--accent:");
  });
  it("keeps script, attribute and CSS payloads inert in every text field", () => {
    const draft = fixture(); const payload = '</style><script>alert("x")</script><img src=x onerror=alert(1)> & \' "';
    draft.name = payload; draft.headline = payload; draft.role = payload; draft.bio = payload; draft.location = payload;
    draft.links[0] = { id: "l", label: payload, url: 'https://example.com/?q="onmouseover="alert(1)' };
    draft.projects[0] = { ...project(), title: payload, summary: payload, role: payload, process: payload, outcome: payload, image: { src: image, alt: payload } };
    const html = exportPortfolioHTML(draft); const $ = load(html);
    expect($("script").length).toBe(0); expect($("img").length).toBe(1); expect($("h1").text()).toBe(payload);
    expect($("img").attr("alt")).toBe(payload); expect($("[onerror],[onmouseover]").length).toBe(0);
    expect($("style").length).toBe(1); expect($("style").text()).not.toContain("alert(");
    expect($(".contact-links a:not(.email-link)").first().attr("href")).toBe(draft.links[0].url);
  });
  it("exports a blank draft without inventing work, contact information, identity or outcomes", () => {
    const $ = load(exportPortfolioHTML(createEmptyPortfolioDraft()));
    expect($("h1").text()).toBe("Portfolio"); expect($("article,img,.about,.contact").length).toBe(0);
    expect($("a").length).toBe(2); // Skip link and clear product attribution only.
  });
});

describe("local persistence does not lose a draft silently", () => {
  it("round-trips without a network call, incrementing revisions or persisting an undo stack", () => {
    const storage = new MemoryStorage(); const draft = fixture();
    expect(loadPortfolioDraft(storage)).toBeNull(); savePortfolioDraft(draft, storage);
    expect(loadPortfolioDraft(storage)).toEqual(draft); expect(storage.values.size).toBe(1); expect(storage.values.has(PORTFOLIO_STORAGE_KEY)).toBe(true);
  });
  it("surfaces quota rejection while preserving the previous saved draft", () => {
    const storage = new MemoryStorage(); const previous = fixture(); savePortfolioDraft(previous, storage);
    storage.setItem = () => { throw new Error("QuotaExceededError"); };
    expect(() => savePortfolioDraft({ ...previous, name: "Unsaved change", revision: 2 }, storage)).toThrow(/JSON backup/);
    expect(loadPortfolioDraft(storage)).toEqual(previous);
  });
  it("does not overwrite a malformed imported or stored draft", () => {
    const storage = new MemoryStorage(); storage.values.set(PORTFOLIO_STORAGE_KEY, '{"corrupt":true}');
    expect(() => loadPortfolioDraft(storage)).toThrow(/not been overwritten/);
    expect(storage.getItem(PORTFOLIO_STORAGE_KEY)).toBe('{"corrupt":true}');
    expect(() => savePortfolioDraft({ ...fixture(), projects: [project(), project()] }, storage)).toThrow();
    expect(storage.getItem(PORTFOLIO_STORAGE_KEY)).toBe('{"corrupt":true}');
  });
});
