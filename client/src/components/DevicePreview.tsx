/*
 * DevicePreview — a web/mobile frame that shows the audited URL in an iframe,
 * with a toggle between desktop and mobile widths and a scanning shimmer.
 */
import { cn } from "@/lib/utils";
import { Monitor, Smartphone } from "lucide-react";

interface Props {
  url: string;
  view: "web" | "mobile";
  onView: (v: "web" | "mobile") => void;
  scanning: boolean;
}

export function DevicePreview({ url, view, onView, scanning }: Props) {
  const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return (
    <div className="glass rounded-[1.5rem] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="truncate text-xs font-semibold text-muted-foreground">{safeUrl}</p>
        <div className="inline-flex items-center gap-1 rounded-full bg-white/60 p-1">
          <button
            type="button"
            onClick={() => onView("web")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition",
              view === "web" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <Monitor className="h-3.5 w-3.5" /> Web
          </button>
          <button
            type="button"
            onClick={() => onView("mobile")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition",
              view === "mobile" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <Smartphone className="h-3.5 w-3.5" /> Mobile
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white">
        <div className={cn("mx-auto transition-all duration-500", view === "mobile" ? "max-w-[380px]" : "max-w-full")}>
          <div className="relative" style={{ aspectRatio: view === "mobile" ? "9 / 16" : "16 / 10" }}>
            {scanning ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-sm">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[oklch(0.8_0.13_75)] border-t-transparent" />
              </div>
            ) : null}
            <iframe
              src={safeUrl}
              title="Portfolio preview"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin"
              className="h-full w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
