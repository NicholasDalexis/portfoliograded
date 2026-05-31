/*
 * Sunlit Glass — Upgrade dialog
 * A friendly, persuasive paywall sheet. Two plans: Free vs. Pro. The CTA is
 * a mock: clicking "Upgrade" toggles the unlocked state for the demo.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}

const FREE = [
  "Letter grade across 6 core categories",
  "Top 3 fixes ranked by impact",
  "Web + mobile preview",
  "Bounce-rate estimate",
];

const PRO = [
  "All 9 categories — including Accessibility, Discoverability, Conversion",
  "Recruiter-grade context for every category",
  "S-tier letter grade unlocked at 97+",
  "Detailed drill-down on every check (3 per category)",
  "Re-audit unlimited times for 30 days",
  "Custom export as a recruiter-ready PDF",
];

export function UpgradeDialog({ open, onOpenChange, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[calc(100vw-1.5rem)] overflow-hidden p-0 sm:!max-w-4xl lg:!max-w-5xl sm:rounded-3xl",
          "border border-white/70 bg-transparent shadow-none",
        )}
      >
        <div className="glass-strong relative overflow-hidden rounded-3xl">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-1 opacity-90"
            style={{
              background:
                "radial-gradient(60% 60% at 100% 0%, oklch(0.86 0.16 75 / 0.45), transparent 60%), radial-gradient(50% 60% at 0% 100%, oklch(0.82 0.14 55 / 0.35), transparent 60%)",
            }}
          />
          <div className="relative max-h-[88vh] overflow-y-auto p-6 sm:p-8 lg:p-10">
            <DialogHeader className="space-y-3 text-left">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[oklch(0.32_0.06_55)]">
                <Sparkles className="h-3 w-3" /> FolioGrade Pro
              </div>
              <DialogTitle className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
                Get the audit recruiters wish they could write.
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground">
                Pro turns your free grade into a working brief: the three drill-downs per category, the recruiter context, and the S-tier ceiling unlocked.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-7 grid gap-5 md:grid-cols-2 lg:gap-6">
              <div className="rounded-2xl border border-white/70 bg-white/55 p-5 sm:p-6 backdrop-blur-md">
                <div className="flex items-baseline justify-between">
                  <p className="font-display text-xl font-bold">Free</p>
                  <p className="font-mono text-sm text-muted-foreground">$0</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Your grade, the highlights, the hook.</p>
                <ul className="mt-4 space-y-2.5">
                  {FREE.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.6_0.1_140)]" />
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-sm opacity-50">
                    <X className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>S-tier grade & full drill-downs</span>
                  </li>
                </ul>
              </div>

              <div
                className="relative rounded-2xl border border-[oklch(0.78_0.16_70_/_0.4)] p-5 sm:p-6"
                style={{
                  background:
                    "linear-gradient(140deg, oklch(0.96 0.06 80 / 0.85), oklch(0.94 0.05 65 / 0.75))",
                  boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.7), 0 30px 60px -30px oklch(0.7 0.16 65 / 0.45)",
                }}
              >
                <div className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-[oklch(0.18_0.04_50)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[oklch(0.96_0.06_80)]">
                  <Sparkles className="h-3 w-3" /> Recommended
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="font-display text-xl font-bold">Pro</p>
                  <p className="font-mono text-sm">
                    <span className="text-base font-bold text-foreground">$12</span>
                    <span className="text-muted-foreground"> / mo</span>
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Everything Free, plus the S-tier ceiling.</p>
                <ul className="mt-4 space-y-2.5">
                  {PRO.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.55_0.16_60)]" />
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    onConfirm();
                    onOpenChange(false);
                  }}
                  className="foil mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-[oklch(0.18_0.04_50)] shadow-[inset_0_1px_0_oklch(1_0_0_/_0.85),0_18px_36px_-18px_oklch(0.7_0.16_65_/_0.6)]"
                >
                  <Sparkles className="h-4 w-4" />
                  Unlock Pro audit
                </button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Demo paywall — no card needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
