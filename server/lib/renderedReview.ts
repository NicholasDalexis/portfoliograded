import { captureAndStore, chromeAvailable } from "./screenshot.js";
import { RENDERED_LIMITATIONS, type RenderedReview, type RenderedDeviceResult, type RenderedDevice } from "../../shared/renderedEvidence.js";
type Dependencies = { capture: typeof captureAndStore; available: () => boolean; enabled: () => boolean };
/** No model calls. Caller stores the result inside its owner-scoped AuditReport. */
export async function collectRenderedReview(url: string, dependencies: Partial<Dependencies> = {}): Promise<RenderedReview> {
  const deps = { capture: captureAndStore, available: chromeAvailable, enabled: () => process.env.SCREENSHOTS_ENABLED !== "false", ...dependencies };
  const unavailable = (reason: RenderedDeviceResult["reason"]): RenderedDeviceResult => ({ status: "unavailable", reason });
  const review: RenderedReview = { version: "1", method: "chromium-dom", scope: "homepage-first-viewport", status: "unavailable", devices: { web: unavailable("capture_failed"), mobile: unavailable("capture_failed") }, limitations: [...RENDERED_LIMITATIONS] };
  if (!deps.enabled() || !deps.available()) {
    const reason = !deps.enabled() ? "disabled" : "browser_unavailable";
    review.devices = { web: unavailable(reason), mobile: unavailable(reason) }; return review;
  }
  // Sequential: do not reserve both global capture slots for a single user.
  for (const device of ["web", "mobile"] as RenderedDevice[]) {
    try {
      const captured = await deps.capture(url, device);
      review.devices[device] = { status: "captured", capture: captured.capture, observations: captured.observations, ...(!captured.observations ? { reason: "measurement_failed" as const } : {}) };
    } catch (error) { review.devices[device] = unavailable(error instanceof Error && error.message === "busy" ? "busy" : "capture_failed"); }
  }
  const measured = Object.values(review.devices).filter(device => device.observations).length;
  const captured = Object.values(review.devices).filter(device => device.capture).length;
  review.status = measured === 2 ? "complete" : captured > 0 ? "partial" : "unavailable";
  return review;
}
