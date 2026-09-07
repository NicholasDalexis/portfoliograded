import { JobSearchContext } from "@/components/JobSearchContext";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Layers3, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { fetchMe, startCheckout } from "@/lib/pro";
import { track } from "@/lib/track";
import { FREE_GRADING_FEATURES, PRICE_LABELS, PRO_GRADING_FEATURES } from "@shared/pricing";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  /** Kept for existing callers. Entitlement always comes from the server. */
  onConfirm?: () => void;
  headline?: string;
  subline?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  intent?: "upgrade" | "publish";
  /** Set only when this deployment can serve a real published portfolio. */
  publishingAvailable?: boolean;
}

function FeatureList({ items }: { items: readonly string[] }) {
  return <ul className="space-y-3">{items.map((item) => <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" /><span>{item}</span></li>)}</ul>;
}

export function UpgradeDialog({ open, onOpenChange, headline, subline, secondaryLabel, onSecondary, intent = "upgrade" }: Props) {
  const opener = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState<"monthly" | "yearly" | null>(null);
  const [billingReady, setBillingReady] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setBillingReady(false);
    void fetchMe().then((me) => { if (active) setBillingReady(me.billingReady === true); }).catch(() => { if (active) setBillingReady(false); });
    return () => { active = false; };
  }, [open]);
  useEffect(() => { if (open) track("paywall_shown", { variant: headline ?? intent }); }, [open, headline, intent]);

  async function checkout(plan: "monthly" | "yearly") {
    if (busy || !billingReady) return;
    setBusy(plan);
    track("paywall_confirmed", { variant: headline ?? intent, plan });
    try { await startCheckout(plan); }
    catch (error) {
      toast.error("Checkout didn't start", { description: error instanceof Error ? error.message : "Try again in a moment." });
    } finally { setBusy(null); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      showCloseButton={false}
      onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
      onCloseAutoFocus={(event) => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); } }}
      className="max-h-[90dvh] w-[min(94vw,1100px)] max-w-[1100px] overflow-y-auto rounded-3xl border border-white/80 bg-[#fffaf0] p-0 shadow-xl sm:max-w-[1100px]"
    >
      <DialogClose aria-label="Close plans" className="pg-action-icon absolute right-3 top-3 z-10"><X aria-hidden="true" className="h-5 w-5" /></DialogClose>
      <div className="relative p-5 sm:p-8 lg:p-10">
        <DialogHeader className="max-w-3xl space-y-3 pr-10 text-left">
          <p className="pg-brand-eyebrow flex items-center gap-2 text-amber-900"><Sparkles aria-hidden="true" className="h-4 w-4" /> Portfolio Graded Pro</p>
          <DialogTitle className="font-display text-3xl font-bold leading-tight sm:text-4xl">{headline ?? "Start with a free grade. Go deeper with Pro."}</DialogTitle>
          <DialogDescription className="max-w-2xl text-base leading-relaxed text-muted-foreground">{subline ?? "See what's working and what to improve. All initial grades stay visible. Sign in free for D-detail feedback. Pro is planned for a closer look at the work behind your homepage."}</DialogDescription>
        </DialogHeader>

        <JobSearchContext />

        <div className="mt-7 grid items-start gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <section aria-labelledby="free-plan-heading" className="order-2 rounded-2xl border border-stone-200/80 bg-white/65 p-5 sm:p-6 lg:order-1">
            <div className="flex items-baseline justify-between gap-3"><h3 id="free-plan-heading" className="font-display text-2xl font-bold">Free</h3><span className="text-2xl font-bold">$0</span></div>
            <p className="mb-5 mt-2 text-sm leading-relaxed text-muted-foreground">A useful first review, with clear next steps. No card needed.</p>
            <FeatureList items={FREE_GRADING_FEATURES} />
            <p className="mt-5 border-t border-stone-200 pt-4 text-sm leading-relaxed text-muted-foreground">Every initial category is included. Open B and other category feedback directly; D details ask for free Google sign-in. No card needed.</p>
          </section>

          <section aria-labelledby="pro-plan-heading" className="order-1 min-w-0 rounded-2xl border border-amber-300/80 bg-gradient-to-br from-[#fff0c8] to-[#fff9eb] p-5 sm:p-6 lg:order-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="pro-plan-heading" className="font-display text-2xl font-bold">Pro</h3><span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 text-xs font-semibold text-amber-950"><Layers3 aria-hidden="true" className="h-3.5 w-3.5" /> Deeper reviews planned</span></div>
            <p className="mb-5 mt-2 text-sm leading-relaxed text-muted-foreground">For the details beyond a first impression. These deeper checks are being prepared and are not included in the current review.</p>
            <FeatureList items={PRO_GRADING_FEATURES} />

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="min-w-0 rounded-2xl border-2 border-amber-700/65 bg-white/80 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-900">Yearly <span className="normal-case tracking-normal">· Save {PRICE_LABELS.savings}</span></p>
                <p className="mt-3"><span className="text-4xl font-bold tracking-tight">{PRICE_LABELS.yearly}</span><span className="text-sm text-muted-foreground"> / year</span></p>
                <p className="mt-2 text-sm font-medium">About {PRICE_LABELS.yearlyMonthlyEquivalent}/month. Billed {PRICE_LABELS.yearly} upfront for the year.</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">About five months’ price for a full year. Save {PRICE_LABELS.yearlySavings} compared with 12 monthly payments ({PRICE_LABELS.twelveMonthlyTotal}).</p>
                <button type="button" disabled={busy !== null || !billingReady} onClick={() => void checkout("yearly")} className="pg-action mt-4 w-full px-3">{busy === "yearly" && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}Choose yearly</button>
              </div>
              <div className="min-w-0 rounded-2xl border border-stone-300 bg-white/60 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monthly <span className="normal-case tracking-normal">· More flexibility</span></p>
                <p className="mt-3"><span className="text-4xl font-bold tracking-tight">{PRICE_LABELS.monthly}</span><span className="text-sm text-muted-foreground"> / month</span></p>
                <p className="mt-2 text-sm font-medium">Billed {PRICE_LABELS.monthly} each month.</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">A smaller first payment if you prefer to go month by month.</p>
                <button type="button" disabled={busy !== null || !billingReady} onClick={() => void checkout("monthly")} className="pg-action-secondary mt-4 min-h-12 w-full">{busy === "monthly" && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}Choose monthly</button>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{billingReady ? "Prices in USD. Your plan renews at the displayed yearly or monthly price until canceled. Cancel before renewal to avoid the next charge." : "Payments are off in this preview. Planned subscriptions renew at the displayed yearly or monthly price until canceled. Your initial grade and category explanations stay free; D details need Google sign-in."}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Paying never buys a higher numerical grade. The separate S row highlights personal standout strengths supported by the evidence. It is relative to your portfolio, and no grade or standout guarantees an interview or a job.</p>
          </section>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-amber-900/10 pt-5">
          <button type="button" onClick={secondaryLabel && onSecondary ? onSecondary : () => onOpenChange(false)} className="pg-action-secondary">{secondaryLabel && onSecondary ? secondaryLabel : "Keep using Free"}</button>
          <Link href="/pricing" onClick={() => onOpenChange(false)} className="pg-action-secondary">See more about plans →</Link>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
