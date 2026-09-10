import { browserProxyPort, parsePublicUrl } from "./publicNetwork.js";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { measureRenderedPage } from "./renderedMetrics.js";
import { archivePortableShot } from "./shotArchive.js";
import type { RenderedCapture, RenderedObservations } from "../../shared/renderedEvidence.js";
import { recordBrowserUsage } from "./usageTracking.js";
export { getArchivedShot } from "./shotArchive.js";

/*
 * SSRF guard for the headless browser (fix Jul 11): page.goto follows
 * redirects internally, so a hostile site could 302 Chrome into
 * 127.0.0.1 / 169.254.169.254 (cloud credentials) / the LAN. We intercept
 * EVERY document request and re-validate its destination before it loads.
 * Critical for Railway: the metadata endpoint is real there.
 */
async function guardPage(page: Page): Promise<void> {
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  let requests = 0;
  page.on("request", req => {
    try {
      if (++requests > 160) { void req.abort(); return; }
      if (/^(data:|blob:)/.test(req.url())) { void req.continue(); return; }
      parsePublicUrl(req.url());
      if (!["GET", "HEAD"].includes(req.method())) { void req.abort(); return; }
      void req.continue();
    } catch { void req.abort(); }
  });
}

const SHOT_DIR = path.join(process.env.PG_DATA_DIR || path.resolve(process.cwd(), "data"), "shots-v2");

const CHROME_PATHS = [
  ...(process.env.CHROME_PATH ? [process.env.CHROME_PATH] : []),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const SETTLE_MS = 1_000; // Nic's rule: wait a second for the page to finish, then shoot

let browserPromise: Promise<Browser> | null = null;
let inFlight = 0;
const MAX_CONCURRENT = 2;

export function chromeAvailable(): boolean {
  return process.env.PG_NETLIFY_CAPTURE === "true" || CHROME_PATHS.some((p) => existsSync(p));
}

export function browserEnvironment(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const allowed = ["PATH", "LANG", "LC_ALL", "TZ", "DISPLAY", "XDG_RUNTIME_DIR", "HOME", "TMPDIR"];
  return Object.fromEntries(allowed.flatMap(key => typeof source[key] === "string" && source[key] ? [[key, source[key]!]] : []));
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const lambda = process.env.PG_NETLIFY_CAPTURE === "true" ? (await import("@sparticuz/chromium")).default : undefined;
    const executablePath = lambda ? await lambda.executablePath() : CHROME_PATHS.find((p) => existsSync(p));
    if (!executablePath) throw new Error("no_chrome");
    browserPromise = (async () => {
    const proxyPort = await browserProxyPort();
    return puppeteer.launch({
      executablePath,
      headless: true,
      timeout: 12_000,
      protocolTimeout: 30_000,
      env: { ...browserEnvironment(), ...(lambda ? { LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH || "/tmp/al2023/lib", FONTCONFIG_PATH: process.env.FONTCONFIG_PATH || "/tmp/fonts" } : {}) },
      args: [...(lambda ? lambda.args.filter(arg => !arg.startsWith("--proxy") && !arg.startsWith("--host-resolver") && !arg.includes("disable-web-security") && !arg.includes("allow-running-insecure-content") && arg !== "--single-process") : []), "--disable-gpu", "--hide-scrollbars", "--mute-audio", "--disable-quic", "--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp", `--proxy-server=http://127.0.0.1:${proxyPort}`, "--proxy-bypass-list=<-loopback>"],
    });
    })();
    browserPromise.then((b) => b.on("disconnected", () => (browserPromise = null))).catch(() => (browserPromise = null));
  }
  return browserPromise;
}

export function imageDifference(current: Buffer, previous?: Buffer): boolean | null {
  return previous ? createHash("sha256").update(current).digest("hex") !== createHash("sha256").update(previous).digest("hex") : null;
}

/** Safe filename for a URL+device pair. */
function shotBase(url: string, device: "web" | "mobile"): string {
  const key = createHash("sha256").update(url).digest("hex");
  return path.join(SHOT_DIR, `${key}__${device}`);
}

/** The saved shot from a previous visit — the "instant" path. */
export function getStoredShot(url: string, device: "web" | "mobile"): Buffer | null {
  const latest = `${shotBase(url, device)}__latest.jpg`;
  const prev = `${shotBase(url, device)}__prev.jpg`;
  try {
    if (existsSync(latest)) return readFileSync(latest);
    if (existsSync(prev)) return readFileSync(prev); // fallback if latest ever corrupts
  } catch {
    /* fall through */
  }
  return null;
}

/** Live capture and bounded observations share one guarded page and viewport.
 * `changed` means an exact JPEG hash differs, never a meaningful site edit.
 */
export async function captureAndStore(
  url: string,
  device: "web" | "mobile",
): Promise<{ buf: Buffer; changed: boolean; hadPrevious: boolean; capture: RenderedCapture; observations?: RenderedObservations }> {
  parsePublicUrl(url);
  if (inFlight >= MAX_CONCURRENT) throw new Error("busy");
  inFlight++;
  const started = Date.now();
  let succeeded = false;
  try {
    const browser = await getBrowser();
    const context = await browser.createBrowserContext();
    const deadline = setTimeout(() => { void context.close().catch(() => {}); }, 32_000);
    try {
      const page = await context.newPage();
      await guardPage(page);
      const viewport = device === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
      if (device === "mobile") {
        await page.setUserAgent(MOBILE_UA);
        await page.setViewport({ ...viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      } else {
        await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
      }
      const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 20_000 });
      if (!response || !response.ok()) throw new Error("page_unavailable");
      const finalUrl = parsePublicUrl(page.url()).toString();
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      let observations: RenderedObservations | undefined;
      let observedAt: string | undefined;
      try { observations = await measureRenderedPage(page); observedAt = new Date().toISOString(); } catch { /* Capture can succeed while observation coverage is unavailable. */ }
      const buf = Buffer.from(await page.screenshot({ type: "jpeg", quality: 72 }));
      const capturedAt = new Date().toISOString();
      const imageSha256 = createHash("sha256").update(buf).digest("hex");
      const imageRef = await archivePortableShot(buf);
      let changed = false, hadPrevious = false;
      try {
        mkdirSync(SHOT_DIR, { recursive: true, mode: 0o700 });
        const latest = `${shotBase(url, device)}__latest.jpg`;
        const prev = `${shotBase(url, device)}__prev.jpg`;
        if (existsSync(latest)) {
          changed = imageDifference(buf, readFileSync(latest)) === true;
          hadPrevious = true;
          renameSync(latest, prev);
        }
        writeFileSync(latest, buf, { mode: 0o600 });
      } catch { /* Missing cache must not invent change or fail a successful capture. */ }
      succeeded = true;
      return { buf, changed, hadPrevious, observations, capture: { capturedAt, observedAt, finalUrl, viewport, imageSha256, imageRef, imageChanged: hadPrevious ? changed : null } };
    } finally {
      clearTimeout(deadline);
      await context.close().catch(() => {});
    }
  } finally { inFlight--; recordBrowserUsage({ durationMs: Date.now() - started, status: succeeded ? "succeeded" : "failed" }); }
}
