import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, MessageCircle, MousePointer2, Smartphone, Monitor } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FAQ } from "@/components/FAQ";
import { gradeColorOklch, type GradeLetter } from "@/lib/audit";
import { askNicAbout } from "@/components/HighlightAsk";

const EXAMPLES = [
  { id: "story", title: "Story & positioning", grade: "B", tier: "B", diagnosis: "Your projects are here. Your role is harder to find.", next: "Add one sentence under your opening: what you do, who it helps, and the kind of work you want." },
  { id: "phone", title: "Phone experience", grade: "C", tier: "C", diagnosis: "The work is strong, but the phone layout needs a second look.", next: "Open your site on your phone. Check that project titles stay readable and contact buttons are easy to tap." },
  { id: "visual", title: "Visual craft", grade: "A", tier: "A", diagnosis: "Your strongest work is easy to find.", next: "Keep that clear opening. Remove one weaker or repetitive image so the best work has room to stand out." },
];
const TIERS: GradeLetter[] = ["S", "A", "B", "C", "D"];

export default function HowTo() {
  const [selected, setSelected] = useState(EXAMPLES[0]);
  const [checked, setChecked] = useState(false);
  const [phone, setPhone] = useState(false);
  return <div className="relative min-h-screen">
    <SiteHeader />
    <main id="main-content" tabIndex={-1} className="container pt-12 sm:pt-20">
      <div className="mx-auto max-w-3xl text-center">
        <p className="pg-brand-eyebrow text-muted-foreground">How to</p>
        <h1 className="pg-page-title mt-4">Read your grade.<br /><span className="grad-text">Pick your next fix.</span></h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">Four steps to use your report.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/" className="pg-action">Grade my portfolio <ArrowRight className="h-4 w-4" /></Link><Link href="/reports" className="pg-action-secondary">My reports</Link></div>
      </div>
      <nav aria-label="How-to sections" className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-2 text-sm"><Jump href="#role">1. Choose your role</Jump><Jump href="#tier-list">2. Open a category</Jump><Jump href="#previews">3. Check both views</Jump><Jump href="#fix-list">4. Make one change</Jump><Jump href="#ask-nic">Ask Nic</Jump></nav>

      <section id="role" className="mx-auto mt-12 grid max-w-5xl scroll-mt-44 items-start gap-6 md:grid-cols-2">
        <Lesson number="01" title="Choose your role.">Choose the role you are applying for. We use that field’s grading guidelines. Choose Other for general portfolio guidance.</Lesson>
        <div className="rounded-3xl border border-amber-900/10 bg-white/70 p-6"><p className="text-sm font-semibold">Use a public link</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Class projects and personal work count. Explain your role in each project.</p><p className="mt-4 text-sm">Your site needs to open without a login.</p></div>
      </section>

      <section id="tier-list" className="mx-auto mt-16 grid max-w-5xl scroll-mt-44 gap-6 lg:grid-cols-2">
        <div><Lesson number="02" title="Open a category.">A shows stronger signals. B, C and D show where to improve. Open a category for the reason and a fix. New D details require free Google sign-in. S highlights strengths within your own portfolio without changing your earned grade.</Lesson><p className="mt-4 flex items-center gap-2 text-sm font-semibold text-amber-900"><MousePointer2 className="h-4 w-4" />Try a category.</p></div>
        <div className="rounded-3xl border border-amber-900/15 bg-white/65 p-4 sm:p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Interactive example · not a real grade</p>
          <div className="overflow-hidden rounded-xl border border-amber-950/10">{TIERS.map(tier => <div key={tier} className="flex min-h-14 border-b border-amber-950/10 last:border-0"><span style={{ background: gradeColorOklch(tier) }} className="flex w-12 shrink-0 items-center justify-center font-display text-xl font-bold text-foreground">{tier}</span><div className="flex flex-wrap items-center gap-2 bg-white/60 p-2">{EXAMPLES.filter(x => x.tier === tier).map(x => <button key={x.id} type="button" aria-pressed={x.id === selected.id} onClick={() => setSelected(x)} className={`min-h-11 rounded-lg border px-3 text-left text-sm font-semibold ${selected.id === x.id ? "border-amber-700 bg-amber-100" : "border-amber-900/15 bg-white"}`}>{x.title} <span aria-hidden>↗</span></button>)}{tier === "S" && <span className="px-1 text-sm text-muted-foreground">Standout details · Pro planned</span>}{tier === "D" && <span className="px-1 text-sm text-muted-foreground">Nothing here in this example</span>}</div></div>)}</div>
          <div aria-live="polite" className="mt-4 rounded-2xl bg-amber-50 p-4"><p className="font-semibold">{selected.title} · {selected.grade}</p><p className="mt-2 text-sm text-muted-foreground">{selected.diagnosis}</p><p className="mt-3 text-xs font-bold uppercase tracking-wider">Try this next</p><p className="mt-1 text-sm leading-relaxed">{selected.next}</p></div>
        </div>
      </section>

      <section id="previews" className="mx-auto mt-16 grid max-w-5xl scroll-mt-44 gap-6 md:grid-cols-2">
        <Lesson number="03" title="Check Web and Mobile.">Look for cropped projects, unreadable text and a missing contact link. Screenshots do not verify every detail or interaction. Open your real site on your phone too.</Lesson>
        <div className="rounded-3xl border border-amber-900/10 bg-white/65 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try both views</p><div className="flex gap-1 rounded-full border border-amber-900/15 p-1"><button type="button" aria-pressed={!phone} onClick={() => setPhone(false)} className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm ${!phone ? "bg-amber-200/70 font-semibold" : ""}`}><Monitor className="h-4 w-4" />Web</button><button type="button" aria-pressed={phone} onClick={() => setPhone(true)} className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm ${phone ? "bg-amber-200/70 font-semibold" : ""}`}><Smartphone className="h-4 w-4" />Mobile</button></div></div><div className={`mx-auto mt-5 overflow-hidden rounded-2xl border border-amber-900/20 bg-background p-4 transition-[max-width] ${phone ? "max-w-[180px]" : "max-w-full"}`}><div className="h-2 w-14 rounded-full bg-amber-300" /><p className="mt-4 font-display text-xl font-bold">Your name</p><p className="mt-2 text-sm text-muted-foreground">Your role and what you do.</p><div className={`mt-4 grid gap-2 ${phone ? "grid-cols-1" : "grid-cols-3"}`}>{[1,2,3].map(n => <div key={n} className="rounded-lg border border-amber-900/10 bg-gradient-to-br from-amber-100 to-orange-50 p-3 text-xs">Project {n}</div>)}</div><span className="mt-4 inline-block rounded-full bg-amber-200 px-3 py-2 text-xs">Contact</span></div><p className="mt-3 text-center text-sm text-muted-foreground">Illustration of a responsive layout.</p></div>
      </section>

      <section id="fix-list" className="mx-auto mt-16 grid max-w-5xl scroll-mt-44 gap-6 md:grid-cols-2">
        <Lesson number="04" title="Make a fix. Check it off.">Start with “Do these first.” Open a fix, edit your portfolio, then check the box. Your checklist saves your progress. Re-grade after your edits; checking a box alone does not raise the grade.</Lesson>
        <div className="rounded-3xl border border-amber-900/10 bg-amber-100/55 p-6"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Example checklist · no report changes</p><p className="mt-3 font-display text-2xl font-bold" aria-live="polite">{checked ? "Checked off." : "Try the checklist."}</p><button type="button" aria-pressed={checked} onClick={() => setChecked(!checked)} className="mt-5 flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white/85 p-3 text-left text-sm font-semibold"><span aria-hidden className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${checked ? "border-amber-700 bg-amber-200" : "border-amber-800/30 bg-white"}`}>{checked && <Check className="h-5 w-5" />}</span><span className={checked ? "line-through" : ""}>Explain my role in my strongest project.</span></button><p className="mt-3 text-sm text-muted-foreground">{checked ? "Your real report saves this progress." : "Check off the example fix."}</p></div>
      </section>

      <section id="ask-nic" className="mx-auto mt-16 max-w-5xl scroll-mt-44 rounded-[2rem] border border-amber-900/15 bg-gradient-to-br from-amber-100/75 to-white/75 p-6 sm:p-9">
        <div className="grid items-start gap-8 md:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Ask Nic</p><h2 className="mt-3 font-display text-3xl font-bold">Stuck on a word?</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Highlight a phrase, then tap “Explain this.” On a phone, press and hold to select text. You can also open Ask Nic directly.</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-amber-900">Try highlighting “case study” below</p><p className="mt-3 select-text rounded-2xl bg-white/80 p-5 text-lg leading-relaxed">A case study shows the problem, your role, what you tried, and what happened.</p><button type="button" onClick={() => askNicAbout("case study")} className="pg-action-secondary mt-4"><MessageCircle className="h-4 w-4" />Ask about case studies</button><p className="mt-3 text-sm text-muted-foreground">Ask Nic uses AI and can make mistakes. Your question stays unsent until you press Send.</p></div></div>
      </section>

      <section id="what-we-check" className="mx-auto mt-16 max-w-5xl scroll-mt-44"><h2 className="font-display text-3xl font-bold">How we do it.</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-3xl border border-amber-900/10 bg-white/65 p-6"><h3 className="font-semibold">What this preview checks</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Your homepage text and structure, scored using your role’s guidelines. When AI explains the findings, the report says so. Successful captures add previews and observations of sideways scrolling, small controls, sampled text contrast, headings and possible contact links. These observations do not affect the numerical grade. Saved reports reopen without scanning; a change check compares homepage code only.</p></div><div className="rounded-3xl border border-amber-900/10 bg-white/65 p-6"><h3 className="font-semibold">What still needs your eyes</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Visual quality, full project pages, phone interactions and loading speed remain unverified. Earned grades top out at A+. S marks personal strengths supported by available evidence; it does not certify untested visuals or phone behavior. Pro details and deeper reviews are in development.</p></div></div></section>
      <details className="mx-auto mt-10 max-w-5xl rounded-3xl border border-amber-900/10 bg-white/55 p-6"><summary className="cursor-pointer font-display text-2xl font-bold">Why Nic built this</summary><div className="mt-4 max-w-3xl space-y-3 text-sm leading-relaxed text-muted-foreground"><p>My first portfolio was a class project on Adobe Portfolio. Updating it was a pain. I moved to Squarespace and added photography, design, marketing and video. Too much of it.</p><p>In interviews, people waited for my images to load. They blamed the Wi-Fi. I knew the page was too heavy.</p><p className="font-semibold text-foreground">Your work has to load before someone can judge it. · Nic</p></div></details>
      <div className="mx-auto mt-12 flex max-w-5xl flex-wrap items-center justify-between gap-4"><Link href="/" className="pg-action">Grade my portfolio <ArrowRight className="h-4 w-4" /></Link><a href="#faq" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold underline">Read the FAQ</a></div>
    <FAQ contained={false} /></main><SiteFooter />
  </div>;
}
function Lesson({number,title,children}:{number:string;title:string;children:React.ReactNode}) { return <div><p className="font-mono text-xs font-medium tracking-widest text-amber-800">{number}</p><h2 className="mt-3 font-display text-3xl font-bold leading-tight">{title}</h2><p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{children}</p></div>; }
function Jump({href,children}:{href:string;children:React.ReactNode}) { return <a href={href} className="inline-flex min-h-11 items-center justify-center rounded-full border border-amber-900/15 bg-white/70 px-4 py-2 font-semibold hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">{children}</a>; }
