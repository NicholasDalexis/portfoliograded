/*
 * Sunlit Glass. Device Preview
 * Glass desktop frame with a phone tucked into the corner. The visual
 * conveys "we audit web AND mobile" without literally embedding the user's
 * site (which would require iframe permissions).
 */
import { Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  url: string;
  view: "web" | "mobile";
  onView: (v: "web" | "mobile") => void;
  scanning?: boolean;
  /** Real screenshots captured by the server; skeleton shows until they arrive. */
  shots?: { web?: string; mobile?: string };
  errors?: { web?: boolean | "unavailable"; mobile?: boolean | "unavailable" };
  capturedAt?: string;
  onRetry?: () => void;
}

export function DevicePreview({ url, view, onView, scanning = false, shots = {}, errors = {}, onRetry, capturedAt }: Props) {
  const cleanUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 max-w-full items-center gap-2 text-sm font-medium text-muted-foreground">
          <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full bg-foreground/40" />
          <span className="break-all">{cleanUrl || "your-portfolio.com"}</span>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-foreground/10 bg-white/60 p-1">
          <button
            type="button"
            onClick={() => onView("web")}
            aria-pressed={view === "web"}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition",
              view === "web" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Monitor aria-hidden className="h-4 w-4" /> Web
          </button>
          <button
            type="button"
            onClick={() => onView("mobile")}
            aria-pressed={view === "mobile"}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition",
              view === "mobile" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Smartphone aria-hidden className="h-4 w-4" /> Mobile
          </button>
        </div>
      </div>

      {errors[view] && !shots[view] ? <div role="status" className="my-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">{errors[view] === "unavailable" ? "No screenshot was saved with this report for this view. Your report is still available. A fresh review can try to capture the page." : <>The saved image could not be loaded or has expired. We have kept the report and its measurements.<button type="button" onClick={onRetry} className="pg-action-secondary mt-3 flex">Retry loading saved image</button></>}</div> : null}
      {!shots[view] && !errors[view] ? <p role="status" className="mb-3 text-sm text-muted-foreground">{scanning ? "Preparing this review and its device previews…" : "Loading the saved preview…"}</p> : null}
      <div className="relative" aria-hidden={Boolean(errors[view] && !shots[view])}>
        {view === "web" ? (
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-br from-[oklch(0.97_0.012_85)] to-[oklch(0.94_0.04_75)]">
            {shots.web ? (
              <img src={shots.web} alt={`Desktop view of ${cleanUrl}`} className="h-full w-full object-cover object-top" />
            ) : (
              <FakeSiteSkeleton />
            )}
            {scanning ? <div className="sweep-line" /> : null}
            <div className="absolute right-3 bottom-3 h-28 w-16 sm:right-4 sm:bottom-4 sm:h-44 sm:w-24 overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-xl">
              {shots.mobile ? (
                <img src={shots.mobile} alt={`Mobile view of ${cleanUrl}`} className="h-full w-full object-cover object-top" />
              ) : (
                <FakeSiteSkeleton compact />
              )}
              {scanning ? <div className="sweep-line" /> : null}
            </div>
          </div>
        ) : (
          <div className="relative mx-auto aspect-[9/16] w-[60%] overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-br from-[oklch(0.97_0.012_85)] to-[oklch(0.94_0.04_75)] shadow-xl sm:w-[44%]">
            {shots.mobile ? (
              <img src={shots.mobile} alt={`Mobile view of ${cleanUrl}`} className="h-full w-full object-cover object-top" />
            ) : (
              <FakeSiteSkeleton compact />
            )}
            {scanning ? <div className="sweep-line" /> : null}
          </div>
        )}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Saved preview of the top of the page. {capturedAt ? `Captured ${new Date(capturedAt).toLocaleString()}. ` : ""}Opening a report does not replace its image. Older images may expire from storage; the report is retained.</p>
    </div>
  );
}

function FakeSiteSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex h-full w-full flex-col gap-2 p-3", compact && "p-2 gap-1.5")}>
      <div className="h-2 w-1/3 rounded-full bg-white/80" />
      <div className="mt-2 h-3 w-2/3 rounded-full bg-foreground/15" />
      <div className="h-3 w-1/2 rounded-full bg-foreground/10" />
      <div className="mt-3 grid flex-1 grid-cols-2 gap-2">
        <div className="rounded-xl bg-gradient-to-br from-[oklch(0.86_0.16_75_/_0.55)] to-[oklch(0.82_0.14_55_/_0.45)]" />
        <div className="rounded-xl bg-white/70" />
        <div className="rounded-xl bg-white/70" />
        <div className="rounded-xl bg-gradient-to-br from-[oklch(0.88_0.14_95_/_0.5)] to-[oklch(0.86_0.16_75_/_0.4)]" />
      </div>
      <div className="mt-2 flex gap-1.5">
        <div className="h-2 w-12 rounded-full bg-foreground/15" />
        <div className="h-2 w-8 rounded-full bg-foreground/10" />
      </div>
    </div>
  );
}
