import NIC_PHOTO from "@/assets/nic-siriusxm.jpg";
import { JobSearchContext } from "@/components/JobSearchContext";
import { useState } from "react";
import { Link } from "wouter";
import { Check, Layers3, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { FREE_GRADING_FEATURES, PRICE_LABELS, PRO_GRADING_FEATURES } from "@shared/pricing";

export default function Pricing() {
  const [open, setOpen] = useState(false);
  return <div className="relative min-h-screen overflow-x-hidden bg-background">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[650px] bg-[radial-gradient(ellipse_at_top_right,#f7dfa166,transparent_65%)]" />
    <SiteHeader onUpgrade={() => setOpen(true)} />
    <main id="main-content" tabIndex={-1} className="container relative pb-4 pt-14 sm:pt-20">
      <div className="max-w-3xl">
        <p className="pg-brand-eyebrow text-muted-foreground">Pricing</p>
        <h1 className="pg-page-title mt-3">Free to start.<br /><span className="grad-text">Pro is in development.</span></h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg text-muted-foreground">All nine initial grades are visible. Sign in free for D-detail feedback.</p>
        <p className="mt-4 inline-block rounded-2xl border border-amber-200 bg-white/75 px-4 py-3 text-sm text-amber-950">Private preview. Payments are off.</p>
      </div>

      <div className="mt-8 max-w-3xl"><JobSearchContext /></div>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section aria-labelledby="pricing-free" className="glass-strong rounded-[2rem] border border-white/80 p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-3"><h2 id="pricing-free" className="font-display text-3xl font-bold">Free</h2><p className="text-3xl font-bold">$0</p></div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Your homepage grade and next steps. No card needed.</p>
          <FeatureList items={FREE_GRADING_FEATURES} />
          <Link href="/" className="pg-action mt-7 w-full">Grade my portfolio</Link>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">D-detail feedback asks for free Google sign-in. Your report and checklist stay with your account.</p>
        </section>

        <section aria-labelledby="pricing-pro" className="min-w-0 rounded-[2rem] border border-amber-300 bg-gradient-to-br from-[#fff0c8] to-[#fffaf0] p-6 shadow-[0_30px_70px_-45px_#9a6500] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="pricing-pro" className="font-display text-3xl font-bold">Pro</h2><p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold"><Layers3 aria-hidden="true" className="h-4 w-4" /> Deeper reviews planned</p></div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Planned checks beyond your homepage. Not available yet.</p>
          <FeatureList items={PRO_GRADING_FEATURES} />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-2xl border-2 border-amber-700/60 bg-white/80 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-900">Yearly · Save {PRICE_LABELS.savings}</p>
              <p className="mt-3"><span className="text-4xl font-bold">{PRICE_LABELS.yearly}</span><span className="text-sm text-muted-foreground"> / year</span></p>
              <p className="mt-2 text-sm font-medium">About {PRICE_LABELS.yearlyMonthlyEquivalent}/month. Billed {PRICE_LABELS.yearly} upfront for the year.</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">A full year for about five monthly payments. Save {PRICE_LABELS.yearlySavings} compared with 12 monthly payments totaling {PRICE_LABELS.twelveMonthlyTotal}.</p>
            </div>
            <div className="rounded-2xl border border-stone-300 bg-white/60 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monthly · More flexibility</p>
              <p className="mt-3"><span className="text-4xl font-bold">{PRICE_LABELS.monthly}</span><span className="text-sm text-muted-foreground"> / month</span></p>
              <p className="mt-2 text-sm font-medium">Billed {PRICE_LABELS.monthly} each month.</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">A smaller first payment, with no annual commitment.</p>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="pg-action mt-6 w-full"><Sparkles aria-hidden="true" className="h-4 w-4" /> See Pro options</button>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Planned prices in USD. Payments are off in this preview. Subscriptions renew at {PRICE_LABELS.yearly}/year or {PRICE_LABELS.monthly}/month until canceled. Cancel before renewal to avoid the next charge.</p>
        </section>
      </div>

      <section aria-labelledby="founder-heading" className="mt-14 flex flex-col items-start gap-6 rounded-3xl border border-amber-900/10 bg-white/70 p-6 sm:flex-row sm:p-8">
        <img src={NIC_PHOTO} alt="Nic speaking at SiriusXM" width={160} height={160} loading="lazy" className="h-32 w-32 shrink-0 rounded-full border-4 border-amber-100 object-cover object-[20%_center] sm:h-40 sm:w-40" />
        <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-wider text-amber-900">Why I built this</p><h2 id="founder-heading" className="mt-2 font-display text-2xl font-bold sm:text-3xl">My portfolio was too slow.</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">I filled my Squarespace portfolio with photography, design and video. In interviews, people waited for the images to load. They blamed the Wi-Fi. I knew I'd made the page too heavy.</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Portfolio Graded helps you spot what needs work before you share the link.</p><a href="https://nicholasalexis.com/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center font-semibold underline">Meet Nic · opens in a new tab</a></div>
      </section>

      <section aria-labelledby="pricing-faq" className="mt-16 sm:mt-20">
        <p className="pg-brand-eyebrow text-muted-foreground">Plan questions</p>
        <h2 id="pricing-faq" className="mt-3 font-display text-3xl font-bold sm:text-4xl">What’s included?</h2>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <Faq q="What is free?" a="Your homepage grade, all nine category explanations and the fix checklist. New D-detail feedback requires a verified free Google account, not a paid plan." />
          <Faq q="What will Pro add?" a="Deeper project-page, visual, accessibility and performance reviews are planned. These checks are not available in the current grader. We will verify them before opening Pro." />
          <Faq q="Should I choose yearly or monthly?" a={`Yearly is ${PRICE_LABELS.yearly} upfront and saves ${PRICE_LABELS.savings} compared with twelve monthly payments. Monthly is ${PRICE_LABELS.monthly} and costs less overall for five months or fewer.`} />
          <Faq q="What happens if I cancel?" a="The planned subscription renews until canceled. Cancel before renewal to avoid the next charge. Your initial grade and explanations stay free. We will verify payment and cancellation controls before Pro opens." />
          <Faq q="Does paying improve my grade?" a="No. The same evidence gets the same numeric grade. S highlights strengths within your own portfolio; it does not raise your score. No grade or subscription guarantees an interview or job." />
          <Faq q="What can the free grader inspect now?" a="Your public homepage text and structure, using your role’s guidelines. Screenshot availability depends on the preview. The report lists its evidence and limits; screenshots alone do not verify visual quality or loading speed." />
        </div>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground"><Link href="/terms" className="font-semibold underline underline-offset-4">Terms</Link> · <Link href="/privacy" className="font-semibold underline underline-offset-4">Privacy policy</Link></p>
      </section>
    </main>
    <SiteFooter />
    <UpgradeDialog open={open} onOpenChange={setOpen} />
  </div>;
}

function FeatureList({ items }: { items: readonly string[] }) {
  return <ul className="mt-6 space-y-3">{items.map((item) => <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" /><span>{item}</span></li>)}</ul>;
}

function Faq({ q, a }: { q: string; a: string }) {
  return <div className="rounded-2xl border border-stone-200/75 bg-white/65 p-5 sm:p-6"><h3 className="font-display text-xl font-bold">{q}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p></div>;
}
