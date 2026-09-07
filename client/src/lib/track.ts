import { sanitizeAnalytics, type AnalyticsEvent } from "@shared/analytics";

/** Optional first-party analytics; discard free text before it leaves the browser. */
export function track(event: AnalyticsEvent, props: Record<string, string | number | boolean> = {}) {
  try {
    const clean = sanitizeAnalytics({ event, props });
    if (!clean) return;
    const body = JSON.stringify(clean);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Optional analytics must never interrupt the product.
  }
}

