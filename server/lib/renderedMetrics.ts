import type { Page } from "puppeteer-core";
import { renderedObservationsSchema, type RenderedObservations } from "../../shared/renderedEvidence.js";

/** Executed in an isolated Chrome world, not the site's JS realm. Keep self-contained. */
export function sampleRenderedDocument(): RenderedObservations {
  if (/^(?:just a moment|attention required|access denied|security verification|verify you are human|checking your browser)\b/i.test(document.title.trim())) throw new Error("measurement_failed");
  const root = document.documentElement;
  const vw = root.clientWidth, vh = root.clientHeight;
  const result: RenderedObservations = {
    layoutViewport: { width: vw, height: vh },
    document: { width: Math.max(root.scrollWidth, document.body?.scrollWidth ?? 0), height: Math.max(root.scrollHeight, document.body?.scrollHeight ?? 0) },
    horizontalOverflowPx: Math.max(0, Math.max(root.scrollWidth, document.body?.scrollWidth ?? 0) - vw),
    elementsExamined: 0, sampleTruncated: false,
    headings: { visible: 0, examples: [] }, contact: { visibleCandidates: 0, examples: [] },
    targets: { visible: 0, below44: 0, examples: [] },
    contrast: { tested: 0, belowThreshold: 0, skippedComplex: 0, examples: [] },
  };
  const styles = new WeakMap<Element, CSSStyleDeclaration>();
  const style = (el: Element) => { let value = styles.get(el); if (!value) { value = getComputedStyle(el); styles.set(el, value); } return value; };
  const label = (el: Element) => ((el instanceof HTMLElement ? el.innerText : el.textContent) || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 100);
  const box = (el: Element) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 }; };
  const sample = (el: Element) => ({ tag: el.tagName.toLowerCase().slice(0, 20), label: label(el), bounds: box(el) });
  function visible(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= vh || rect.left >= vw) return false;
    let p: Element | null = el, depth = 0;
    while (p && depth++ < 64) {
      const s = style(p);
      if (s.display === "none" || ["hidden", "collapse"].includes(s.visibility) || Number(s.opacity) <= .01 || s.contentVisibility === "hidden") return false;
      p = p.parentElement;
    }
    if (p) return false;
    const l = Math.max(0, rect.left), r = Math.min(vw, rect.right), t = Math.max(0, rect.top), b = Math.min(vh, rect.bottom);
    const points = [[(l+r)/2,(t+b)/2],[l+.1,t+.1],[r-.1,t+.1],[l+.1,b-.1],[r-.1,b-.1]];
    return points.some(([x,y]) => { const top = document.elementFromPoint(x,y); return !!top && (top === el || el.contains(top)); });
  }
  function rgb(value: string): number[] | null {
    const m = value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
    if (!m || (m[4] !== undefined && Number(m[4]) !== 1)) return null;
    const out = m.slice(1,4).map(Number);
    return out.every(n => Number.isFinite(n) && n >= 0 && n <= 255) ? out : null;
  }
  function plainColors(el: Element): { fg: number[]; bg: number[] } | null {
    const fg = rgb(style(el).color); if (!fg) return null;
    let bg: number[] | null = null, p: Element | null = el, depth = 0;
    while (p && depth++ < 64) {
      const s = style(p);
      if (Number(s.opacity) !== 1 || s.backgroundImage !== "none" || s.mixBlendMode !== "normal" || s.filter !== "none" || s.backdropFilter !== "none" || s.transform !== "none" || s.textShadow !== "none" || s.maskImage !== "none") return null;
      // Pseudo-element decoration can supply an unobserved layer over/behind text.
      for (const pseudo of ["::before", "::after"]) { const ps = getComputedStyle(p, pseudo); if (ps.content !== "none" && ps.content !== "normal" && ps.display !== "none") return null; }
      if ((s.getPropertyValue("-webkit-text-fill-color") && s.getPropertyValue("-webkit-text-fill-color") !== s.color) || !["", "0px"].includes(s.getPropertyValue("-webkit-text-stroke-width")) || !["", "1", "normal"].includes(s.getPropertyValue("zoom"))) return null;
      const color = s.backgroundColor;
      if (!bg && color !== "rgba(0, 0, 0, 0)" && color !== "transparent") { bg = rgb(color); if (!bg) return null; }
      p = p.parentElement;
    }
    if (p) return null;
    if (!bg && !["normal", "light"].includes(style(root).colorScheme)) return null;
    return { fg, bg: bg ?? [255,255,255] }; // Chromium's unstyled canvas background.
  }
  const luminance = (c: number[]) => c.map(n => { const s = n / 255; return s <= .04045 ? s / 12.92 : Math.pow((s+.055)/1.055,2.4); }).reduce((sum,n,i) => sum + n * [.2126,.7152,.0722][i], 0);
  const contrastCandidates: Element[] = [];
  const possibleLayers: Element[] = [];
  const walker = document.createTreeWalker(document.body ?? root, NodeFilter.SHOW_ELEMENT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (result.elementsExamined === 2_000) { result.sampleTruncated = true; break; }
    result.elementsExamined++;
    const el = node as Element;
    const layerStyle = style(el);
    if (el.matches("img,video,canvas,svg,iframe") || layerStyle.backgroundImage !== "none" || (["absolute", "fixed", "sticky"].includes(layerStyle.position) && layerStyle.backgroundColor !== "rgba(0, 0, 0, 0)")) possibleLayers.push(el);
    if (!(el instanceof HTMLElement) || !visible(el)) continue;
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag) && el.innerText.trim()) { result.headings.visible++; if (result.headings.examples.length < 6) result.headings.examples.push(sample(el)); }
    const interactive = el.matches('a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"]') && !el.matches(':disabled,[aria-disabled="true"]');
    if (interactive) {
      result.targets.visible++;
      const rect = el.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) { result.targets.below44++; if (result.targets.examples.length < 6) result.targets.examples.push(sample(el)); }
      const href = el.getAttribute("href") ?? "";
      if (/^(mailto:|tel:)/i.test(href) || /\b(contact|get in touch|hire me|book a call)\b/i.test(label(el))) { result.contact.visibleCandidates++; if (result.contact.examples.length < 6) result.contact.examples.push(sample(el)); }
    }
    // Text inside inputs is private interaction state, not public page copy.
    if (el.children.length || ["input","textarea","select","option","script","style","noscript"].includes(tag) || !el.textContent?.trim()) continue;
    if (contrastCandidates.length < 120) contrastCandidates.push(el);
  }
  for (const el of contrastCandidates) {
    const rect = el.getBoundingClientRect();
    const overlapped = possibleLayers.some(layer => {
      if (layer === el || layer.contains(el) || el.contains(layer)) return false;
      const box = layer.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top;
    });
    // Unknown later elements could paint over sampled text. Fail closed on a truncated DOM.
    const colors = !overlapped && !result.sampleTruncated ? plainColors(el) : null;
    if (!colors) { result.contrast.skippedComplex++; continue; }
    const a = luminance(colors.fg), b = luminance(colors.bg);
    const ratio = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const s = style(el), size = parseFloat(s.fontSize), weight = parseInt(s.fontWeight,10);
    const requiredRatio = size >= 24 || (size >= 18.6667 && weight >= 700) ? 3 : 4.5;
    result.contrast.tested++;
    if (ratio < requiredRatio) {
      result.contrast.belowThreshold++;
      if (result.contrast.examples.length < 6) result.contrast.examples.push({ ...sample(el), ratio: Math.max(1, Math.floor(ratio * 100)/100), requiredRatio });
    }
  }
  return result;
}

export async function measureRenderedPage(page: Page): Promise<RenderedObservations> {
  const session = await page.createCDPSession();
  try {
    const { frameTree } = await session.send("Page.getFrameTree");
    const { executionContextId } = await session.send("Page.createIsolatedWorld", { frameId: frameTree.frame.id, worldName: "pg-rendered-observations-v1" });
    // tsx/esbuild keepNames can insert __name calls inside this serialized
    // function. Recreate only that naming helper in the isolated realm. The
    // literal must not itself be serialized/transformed by the bundler.
    const nameHelper = 'const __name = (target, value) => Object.defineProperty(target, "name", { value, configurable: true });';
    const expression = `(function () { ${nameHelper} return (${sampleRenderedDocument.toString()})(); })()`;
    const result = await session.send("Runtime.evaluate", { expression, contextId: executionContextId, returnByValue: true, timeout: 2_000 });
    if (result.exceptionDetails || !result.result.value) throw new Error("measurement_failed");
    return renderedObservationsSchema.parse(result.result.value);
  } finally { await session.detach().catch(() => {}); }
}
