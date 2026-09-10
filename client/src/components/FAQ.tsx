import { Link } from "wouter";

export function FAQ({ contained = true }: { contained?: boolean }) {
  return <section id="faq" aria-labelledby="faq-title" className={`${contained ? "container " : ""}mt-24 scroll-mt-44 sm:mt-32`}>
    <div className="mx-auto max-w-3xl">
      <p className="pg-brand-eyebrow text-muted-foreground">FAQ</p>
      <h2 id="faq-title" className="mt-3 font-display text-3xl font-bold sm:text-4xl">Questions?</h2>
      <div className="mt-6 divide-y divide-amber-900/10 rounded-3xl border border-amber-900/10 bg-white/65 px-5 sm:px-7">
        <Question title="Do I need an account or a credit card?">Start with neither. New D-category details require free, verified Google sign-in. That saves this report and its checklist without rescanning; other guest reports stay in their original browser. Payments are off during the private preview.</Question>
        <Question title="What if my role is not on the list?">Choose Other. You can type your field or leave it blank. Unlisted fields use general portfolio guidelines.</Question>
        <Question title="Can I use Canva, a PDF or Google Drive?">You can submit a public Canva website. This preview cannot reliably grade PDFs, private Drive folders or sites behind a login. Submit a public website link.</Question>
        <Question title="What does my grade mean?">It scores your homepage text and structure for your chosen role. It does not verify visual quality, real phone usability or loading speed, or predict a hiring decision. <a href="/how-to#what-we-check" className="font-semibold underline">See what is checked</a>.</Question>
        <Question title="What do I do with my grade?">Open a category, pick a fix, make the edit, then check it off. Re-grade after you make changes. <Link href="/how-to" className="font-semibold underline">Read How to</Link>.</Question>
        <Question title="Can I reopen a report?">Yes. <Link href="/reports" className="font-semibold underline">My reports</Link> keeps your original grades, dates and fix lists. Opening one does not rescan your site. Its change check compares homepage code only; images, styles and other pages may still have changed.</Question>
        <Question title="What do you keep?">Your URL, selected role, optional builder answer, feedback and available screenshots. Nic may review them privately to improve the guidelines. Public featuring needs separate permission. Only submit work you own or have permission to submit. <Link href="/privacy#how-we-use-it" className="font-semibold underline">How we use it</Link> · <Link href="/privacy" className="font-semibold underline">Privacy and removal</Link>.</Question>
      </div>
    </div>
  </section>;
}
function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="group py-1"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-amber-700 sm:text-base">{title}<span aria-hidden className="text-xl text-amber-800 group-open:rotate-45">+</span></summary><div className="pb-5 text-sm leading-relaxed text-muted-foreground">{children}</div></details>;
}
