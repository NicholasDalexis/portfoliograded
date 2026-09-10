import { z } from "zod";

const count = z.number().int().min(0).max(2_000);
const dimension = z.number().finite().min(0).max(10_000_000);
const bounds = z.object({ x: z.number().finite().min(-10_000_000).max(10_000_000), y: z.number().finite().min(-10_000_000).max(10_000_000), width: dimension, height: dimension }).strict();
const example = z.object({ tag: z.string().max(20), label: z.string().max(100), bounds }).strict();
export const renderedObservationsSchema = z.object({
  layoutViewport: z.object({ width: dimension, height: dimension }).strict(),
  document: z.object({ width: dimension, height: dimension }).strict(),
  horizontalOverflowPx: dimension,
  elementsExamined: count,
  sampleTruncated: z.boolean(),
  headings: z.object({ visible: count, examples: z.array(example).max(6) }).strict(),
  contact: z.object({ visibleCandidates: count, examples: z.array(example).max(6) }).strict(),
  targets: z.object({ visible: count, below44: count, examples: z.array(example).max(6) }).strict(),
  contrast: z.object({ tested: count, belowThreshold: count, skippedComplex: count, examples: z.array(example.extend({ ratio: z.number().min(1).max(21), requiredRatio: z.union([z.literal(3), z.literal(4.5)]) }).strict()).max(6) }).strict(),
}).strict();
export type RenderedObservations = z.infer<typeof renderedObservationsSchema>;
export type RenderedDevice = "web" | "mobile";
export interface RenderedCapture {
  capturedAt: string;
  observedAt?: string;
  finalUrl: string;
  viewport: { width: number; height: number };
  imageSha256: string;
  /** Private disk identifier. Serve only through an owner-authorized report. */
  imageRef?: string;
  /** Exact encoded image difference only; never whole-site change detection. */
  imageChanged: boolean | null;
}
export interface RenderedDeviceResult {
  status: "captured" | "unavailable";
  reason?: "disabled" | "browser_unavailable" | "busy" | "capture_failed" | "measurement_failed";
  capture?: RenderedCapture;
  observations?: RenderedObservations;
}
export interface RenderedReview {
  version: "1";
  method: "chromium-dom";
  scope: "homepage-first-viewport";
  status: "complete" | "partial" | "unavailable";
  devices: Record<RenderedDevice, RenderedDeviceResult>;
  limitations: string[];
}
export const RENDERED_LIMITATIONS = [
  "Browser layout observations at 1440×900 desktop and 390×844 mobile emulation, after a short settle. This is Chromium, not a real iPhone or Safari test.",
  "Only the initial viewport and at most 2,000 document elements are sampled. Visibility uses computed styles, geometry and sampled hit tests; it is not a human visual review. Iframes, shadow trees, scrolled pages and interactions are not inspected.",
  "Contact matches are visible link-label or mail/tel candidates, not proof that a contact flow works. No headings or contacts observed means none found in this sample, not none on the site.",
  "Controls below 44×44 CSS pixels are review candidates. Inline/equivalent-control and other WCAG exceptions are not assessed; this is not an accessibility conformance result.",
  "Contrast is sampled only for plain leaf text with opaque computed colors on a reliably resolved solid background. Gradients, images, transparency, overlays, effects, pseudo-elements and other complex cases are skipped. No full accessibility, design quality, project-depth or real-user performance assessment was performed.",
  "These observations do not change the current HTML-based numerical grade. Dynamic content, consent dialogs, fonts, emulation and resource blocking can affect a capture. DOM measurement and the JPEG follow one another, not an atomic browser snapshot. Exact image differences do not prove the website meaningfully changed.",
];
