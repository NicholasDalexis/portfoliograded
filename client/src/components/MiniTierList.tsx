import { useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { TIER_COLOR, type TierKey } from "@/lib/tierStyle";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EXAMPLES: { tier: TierKey; title: string; next: string }[] = [
  { tier: "S", title: "Your standout", next: "S highlights a strength within your own portfolio. It doesn’t change your earned grade. Standout details are planned for Pro." },
  { tier: "A", title: "First impression", next: "Your role is easy to spot. Keep it up front, with your strongest project right below it." },
  { tier: "B", title: "Project story", next: "Show what you did. Add your role, one decision you made, and what changed because of it." },
  { tier: "C", title: "Phone layout", next: "Open your site on your phone. Check for cut-off work, tiny text, and buttons that are hard to tap." },
  { tier: "D", title: "Contact", next: "Make it easy to reach you. Add a clearly labeled contact link and check that it works." },
];

/** A fictional demonstration, with the same palette and click-to-fix pattern as the report. */
export function MiniTierList({ className = "" }: { className?: string }) {
  const opener = useRef<HTMLButtonElement | null>(null);
  const [selected, setSelected] = useState<(typeof EXAMPLES)[number] | null>(null);
  return <section aria-label="Example tier list" className={className}>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
      <h2 className="font-semibold">Example tier list</h2><span>Tap a category</span>
    </div>
    <div className="overflow-hidden rounded-xl bg-[oklch(0.2_0.012_60)] p-1.5 shadow-sm">
      {EXAMPLES.map(example => <div key={example.tier} className="flex min-h-11 gap-1 border-b border-white/10 last:border-0">
        <span className="flex w-11 shrink-0 items-center justify-center font-display text-xl font-extrabold" style={{ background: TIER_COLOR[example.tier].bg, color: TIER_COLOR[example.tier].text }}>{example.tier}</span>
        <div className="flex min-w-0 flex-1 items-center px-1.5">
          <button type="button" aria-haspopup="dialog" aria-label={`Example ${example.tier}: ${example.title}`} onClick={event => { opener.current = event.currentTarget; setSelected(example); }} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-[#fff8e9] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-200">
            {example.title}<ArrowUpRight aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-75" />
          </button>
        </div>
      </div>)}
    </div>
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent onCloseAutoFocus={event => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); } }} className="max-h-[90dvh] overflow-y-auto rounded-[2rem] border-white/80 bg-background p-6 sm:max-w-lg sm:p-8">
        <DialogHeader className="pr-8 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Example only · not your grade</p>
          <DialogTitle className="font-display text-3xl font-bold">{selected?.title}</DialogTitle>
          <DialogDescription className="mt-3 text-base leading-relaxed text-foreground">{selected?.next}</DialogDescription>
        </DialogHeader>
        <Link href="/how-to#tier-list" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">See how your tier list works →</Link>
      </DialogContent>
    </Dialog>
  </section>;
}
