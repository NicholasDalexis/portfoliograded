import { afterAll, beforeAll, describe, expect, it } from "vitest";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { measureRenderedPage } from "../../server/lib/renderedMetrics.js";
let browser: Browser;
beforeAll(async () => {
  browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, env: { PATH: process.env.PATH!, HOME: process.env.HOME!, TMPDIR: process.env.TMPDIR || '/tmp' }, args: ['--disable-background-networking', '--disable-quic', '--disable-sync', '--disable-component-update'] });
});
afterAll(async () => { await browser?.close(); });
async function inspect(html: string, options: { mobile?: boolean; before?: (page: Page) => Promise<void> } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await page.setRequestInterception(true);
    page.on('request', r => { void r.abort(); });
    await page.setViewport(options.mobile ? { width:390,height:844,isMobile:true,hasTouch:true } : { width:1440,height:900 });
    await page.setContent(html);
    if (options.before) await options.before(page);
    return await measureRenderedPage(page);
  } finally { await context.close(); }
}
const shell = (content: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#fff;color:#000;font:16px Arial}h1{font-size:32px}button{min-width:48px;min-height:48px}</style></head><body>${content}</body></html>`;
describe('real isolated Chromium first-viewport measurements', () => {
  it('measures visible heading/contact and a plain solid text contrast sample', async () => {
    const evidence = await inspect(shell('<h1>A real portfolio</h1><a style="display:inline-block;padding:20px" href="mailto:creator@example.org">Contact</a><p>Plain copy</p>'));
    expect(evidence.headings.examples.map(x => x.label)).toEqual(['A real portfolio']);
    expect(evidence.contact.visibleCandidates).toBe(1);
    expect(evidence.contrast.tested).toBeGreaterThanOrEqual(2);
    expect(evidence.contrast.belowThreshold).toBe(0);
    expect(evidence.horizontalOverflowPx).toBe(0);
  });
  it('measures responsive overflow on mobile without inventing it on desktop', async () => {
    const html=shell('<div style="width:800px;height:60px;background:red">Wide work</div>');
    const mobile=await inspect(html,{mobile:true}), web=await inspect(html);
    expect(mobile.layoutViewport.width).toBe(390);
    expect(mobile.horizontalOverflowPx).toBe(410);
    expect(web.horizontalOverflowPx).toBe(0);
  });
  it('reports mobile layout width when absent viewport metadata shrinks a desktop layout', async () => {
    const result=await inspect('<!doctype html><h1>Desktop-scaled page</h1>',{mobile:true});
    expect(result.layoutViewport.width).toBeGreaterThan(390);
  });
  it('excludes stylesheet-hidden, transparent and offscreen headings and links', async () => {
    const result=await inspect(shell('<style>.hidden{display:none}</style><h1 class="hidden">Hidden</h1><a style="opacity:0" href="mailto:hidden@example.org">Contact</a><h2 style="position:absolute;top:2000px">Below fold</h2><h3>Shown</h3>'));
    expect(result.headings.examples.map(x=>x.label)).toEqual(['Shown']);
    expect(result.contact.visibleCandidates).toBe(0);
  });
  it('does not count a heading/contact covered by an opaque modal', async () => {
    const result=await inspect(shell('<h1>Covered</h1><a href="mailto:x@example.org">Contact</a><div style="position:fixed;inset:0;background:#fff;z-index:99">Cookie choices</div>'));
    expect(result.headings.visible).toBe(0); expect(result.contact.visibleCandidates).toBe(0);
  });
  it('reports small controls as candidates and excludes disabled controls', async () => {
    const result=await inspect(shell('<a href="#work">Work</a><button>Large</button><button disabled>Disabled</button>'));
    expect(result.targets.visible).toBe(2); expect(result.targets.below44).toBe(1);
    expect(result.targets.examples[0].label).toBe('Work');
  });
  it('uses appropriate text contrast threshold with a bounded low-contrast example', async () => {
    const result=await inspect(shell('<p style="color:#aaa">Small pale copy</p><h1 style="color:#999">Pale title</h1>'));
    expect(result.contrast.belowThreshold).toBe(2);
    expect(result.contrast.examples.map(x=>x.requiredRatio)).toEqual([4.5,3]);
    expect(result.contrast.examples[0].ratio).toBeGreaterThan(2);
  });
  it('skips gradients, translucent ancestors and generated pseudo-element layers', async () => {
    const result=await inspect(shell('<p style="background:linear-gradient(white,black)">Gradient</p><section style="opacity:.5"><p>Translucent</p></section><style>.pseudo{position:relative}.pseudo::before{content:"";position:absolute;inset:0}</style><p class="pseudo">Layered</p>'));
    expect(result.contrast.tested).toBe(0); expect(result.contrast.skippedComplex).toBe(3);
  });
  it('skips a pointer-events-none image/paint layer behind or over text', async () => {
    const result=await inspect(shell('<p style="position:relative;z-index:2">Layered copy</p><div style="position:absolute;inset:0;background:#333;pointer-events:none"></div>'));
    expect(result.contrast.tested).toBe(0); expect(result.contrast.skippedComplex).toBe(1);
  });
  it('skips text-fill overrides instead of inventing visible contrast', async () => {
    const result=await inspect(shell('<p style="-webkit-text-fill-color:transparent">Invisible fill</p>'));
    expect(result.contrast.tested).toBe(0); expect(result.contrast.skippedComplex).toBe(1);
  });
  it('does not quote display-hidden heading children as visible text', async () => {
    const result=await inspect(shell('<h1>Visible<span style="display:none"> hidden copy</span></h1>'));
    expect(result.headings.examples[0].label).toBe('Visible');
  });
  it('skips unresolved system-dark canvas contrast', async () => {
    const result=await inspect('<!doctype html><style>html{color-scheme:dark}</style><p>System canvas</p>');
    expect(result.contrast.tested).toBe(0);expect(result.contrast.skippedComplex).toBe(1);
  });
  it('does not measure a known browser challenge title as the portfolio', async () => {
    await expect(inspect(shell('<title>Just a moment...</title><h1>Verify you are human</h1>'))).rejects.toThrow('measurement_failed');
  });
  it('does not let site JS replace isolated measurement functions', async () => {
    const result=await inspect(shell('<h1>Native observation</h1>'), { before: async page => { await page.evaluate(() => { window.getComputedStyle = (() => ({display:'none'})) as any; HTMLElement.prototype.getBoundingClientRect = (() => ({x:0,y:0,width:0,height:0})) as any; }); } });
    expect(result.headings.visible).toBe(1);
  });
  it('does not include nested iframe or shadow-root content', async () => {
    const result=await inspect(shell('<h1>Outer</h1><div id="shadow"></div><iframe srcdoc="&lt;h1&gt;Inner frame&lt;/h1&gt;"></iframe>'), { before: async page => { await page.evaluate(() => { document.getElementById('shadow')!.attachShadow({mode:'open'}).innerHTML='<h1>Shadow heading</h1>'; }); } });
    expect(result.headings.examples.map(x=>x.label)).toEqual(['Outer']);
  });
  it('caps adversarially large DOM sampling and bounds retained labels', async () => {
    const result=await inspect(shell(`<h1>${'X'.repeat(200)}</h1>${'<span></span>'.repeat(2100)}`));
    expect(result.elementsExamined).toBe(2000); expect(result.sampleTruncated).toBe(true);
    expect(result.headings.examples[0].label.length).toBe(100);
  });
});
