import type { RenderedReview } from "@shared/renderedEvidence";

/** Rendered browser observations are evidence alongside the grade, not a visual score. */
export function RenderedEvidence({ review, view }: { review?: RenderedReview; view: "web" | "mobile" }) {
  const device = review?.devices[view], observed = device?.observations;
  const mobileScaled = view === "mobile" && device?.capture && observed && observed.layoutViewport.width > device.capture.viewport.width + 2;
  return <section className="glass mt-5 rounded-3xl p-5 sm:p-6" aria-label="Browser observations">
    <p className="pg-brand-eyebrow">{view === "web" ? "Desktop" : "Phone-sized"} browser check</p>
    <h2 className="mt-2 font-display text-2xl font-bold">What the browser could see.</h2>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">We opened the page in Chromium and sampled its visible layout. These observations sit alongside your grade. They do not change its number or judge the quality of your design.</p>
    {!observed ? <p role="status" className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm">{!review ? "This older report has no saved browser measurements. A fresh review can try the current checks." : device?.reason === "disabled" || device?.reason === "browser_unavailable" ? "Browser measurements are unavailable in this environment. This report contains the homepage code review." : "We could not measure this view reliably. Missing measurements are not a pass or a failed portfolio."}</p> : <>
      {mobileScaled && <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm"><strong>The phone view may be shrinking a wider layout.</strong> The page used a {Math.round(observed.layoutViewport.width)}px layout in a {device!.capture!.viewport.width}px phone-sized window. Check your mobile layout setting, then read your page on a real phone.</p>}
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <Finding title="Sideways scrolling" value={observed.horizontalOverflowPx > 1 ? `${Math.round(observed.horizontalOverflowPx)}px beyond the window` : "None detected in this capture"} text={observed.horizontalOverflowPx > 1 ? "Look for a wide image, heading or section that spills off the edge. Check this view in your website editor." : "Other pages, pop-ups and interactions still need checking."} />
        <Finding title="Controls worth checking" value={`${observed.targets.below44} of ${observed.targets.visible} sampled controls`} text="These are smaller than a 44 × 44px comfort target. Give cramped controls more space where useful. This is a review cue, not an accessibility failure." />
        <Finding title="Text contrast" value={observed.contrast.tested ? `${observed.contrast.belowThreshold} of ${observed.contrast.tested} samples below the reference` : "No reliable simple-text samples"} text={`${observed.contrast.skippedComplex} complex samples were skipped. Text on images, gradients and layered backgrounds still needs a closer look.`} />
        <Finding title="Visible starting points" value={`${observed.headings.visible} headings · ${observed.contact.visibleCandidates} contact candidates`} text="Found in the opening view only. A contact label does not confirm that its link or form works." />
      </dl>
      <details className="mt-4 rounded-2xl border border-foreground/15 p-4"><summary className="cursor-pointer min-h-11 content-center text-sm font-semibold">Show the examples and limits</summary>
        <div className="mt-3 break-words space-y-4 text-sm leading-relaxed text-muted-foreground">
          {observed.targets.examples.length > 0 && <div><h3 className="font-semibold text-foreground">Small control examples</h3><ul className="mt-2 list-disc space-y-1 pl-5">{observed.targets.examples.map((item, index) => <li key={index}>{item.label || "Unlabelled control"} · {Math.round(item.bounds.width)} × {Math.round(item.bounds.height)}px</li>)}</ul></div>}
          {observed.contrast.examples.length > 0 && <div><h3 className="font-semibold text-foreground">Low contrast examples</h3><ul className="mt-2 list-disc space-y-1 pl-5">{observed.contrast.examples.map((item, index) => <li key={index}>“{item.label}” · {item.ratio.toFixed(1)}:1 measured, {item.requiredRatio}:1 reference. Try a darker text color or a plainer background.</li>)}</ul></div>}
          <p>{observed.elementsExamined} page elements sampled{observed.sampleTruncated ? "; the sample reached its limit" : ""}. Only the opening view is assessed. No full-page, keyboard, screen-reader, aesthetic or real loading-speed review was performed.</p>
          <p>Phone view uses a 390 × 844px Chromium emulation, not an actual iPhone or Safari. Desktop uses 1440 × 900px. The browser reads the layout and then takes the screenshot; a moving page can change between them.</p>
          <p>The text-contrast reference is 4.5:1, or 3:1 for large text. Complex paint is skipped, and control-size exceptions are not assessed. These samples cannot establish accessibility compliance.</p>
          {device?.capture?.imageChanged !== null && device?.capture?.imageChanged !== undefined && <p>{device.capture.imageChanged ? "The saved image bytes differ from the preceding capture for this URL." : "The saved image bytes match the preceding capture for this URL."} Animation, fonts or a consent dialog can change an image. This is not proof about changes to the whole website.</p>}
        </div>
      </details>
    </>}
    {device?.capture && <p className="mt-4 text-xs text-muted-foreground">Captured {new Date(device.capture.capturedAt).toLocaleString()}. These measurements stay with this report.</p>}
  </section>;
}
function Finding({ title, value, text }: { title: string; value: string; text: string }) {
  return <div className="rounded-xl bg-background p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</dt><dd className="mt-2 font-semibold">{value}</dd><dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</dd></div>;
}
