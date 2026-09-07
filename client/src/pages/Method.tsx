/*
 * Sunlit Glass. Method page
 * Explains how the audit thinks, who it's for, and the editorial point of
 * view behind the grade. Editorial layout, generous whitespace.
 */
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const ATMOSPHERE_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663468975365/JXRW8Prgas3RMo8cBvY8Y3/device_mockup_atmosphere-6Xc9ga4yQJ6pLq6nHbG5Zt.webp";

export default function Method() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${ATMOSPHERE_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "left top",
          opacity: 0.5,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.98 0.012 85 / 0.7) 0%, oklch(0.98 0.012 85 / 0.96) 60%, oklch(0.98 0.012 85) 100%)",
        }}
      />
      <SiteHeader />
      <main className="container pt-14 sm:pt-20">
        <div className="grid gap-10 lg:grid-cols-12">
          <aside className="lg:col-span-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Method
            </p>
            <h1 className="mt-3 font-display text-5xl font-extrabold leading-[1.05] sm:text-6xl">
              How we read your <span className="grad-text">portfolio.</span>
            </h1>
            <p className="mt-4 text-muted-foreground">
              A useful review explains what it found and what it could not check. Version 1.1 is an initial homepage review. It helps you choose your next edit, with the scope clearly marked.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[oklch(0.18_0.04_50)] px-4 py-2.5 text-sm font-bold text-[oklch(0.97_0.04_85)]"
            >
              Run an audit <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>

          <article className="lg:col-span-8 space-y-6">
            <Block
              num="01"
              title="One grade, with evidence."
              body="Your overall grade combines category scores using the selected role’s weights. The tier list groups those categories from A to D. Click a card to see the evidence, a next step, and general guidance. Switching the screenshot changes the preview, not the grade."
            />
            <Block
              num="02"
              title="Recruiters open portfolios on phones."
              body="Free includes desktop and mobile screenshots. The initial scan checks available mobile HTML signals. Screenshots let you inspect the layout yourself; this version does not yet score rendered layouts, tap targets or actual phone loading performance."
            />
            <Block
              num="03"
              title="A rubric for your kind of work."
              body="Marketing, Social Media, Creative Technology, Photography, Copywriting, Graphic Design, Videography, UX/UI Design, Web Development and Fashion Design each have their own guidelines and weights. Leave the role blank or use an unlisted role for general portfolio guidance. Keywords alone cannot demonstrate the quality of your work."
            />
            <Block
              num="04"
              title="Know what was checked."
              body="The report identifies whether AI assisted the homepage analysis or only the basic rules ran. Project pages, image quality, videos, rendered accessibility, measured speed and complete case-study outcomes still need a deeper review. A site that cannot be read should receive a clear error, not a confident grade."
            />
            <Block
              num="05"
              title="The S grade is rare on purpose."
              body="S is reserved for verified deeper evidence. The initial scan tops out at A+ for everyone. A future Pro review will assess more evidence; payment itself will never improve a score. Grades offer direction, not a hiring guarantee."
            />

            {/* The founder story. why this product exists */}
            <div className="glass-strong mt-4 rounded-3xl p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Why this exists
              </p>
              <h3 className="mt-3 font-display text-2xl font-bold leading-snug sm:text-3xl">
                A portfolio has to work when someone opens it.
              </h3>
              <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
                <p>
                  My first portfolio was an Adobe Portfolio class project. It got the work online, but adding more projects became convoluted. Squarespace made building easier, so I added photography, design, marketing and video. Then I added too much.
                </p>
                <p>
                  In interviews, people would open the site and wait for the images. They blamed the Wi-Fi. I knew the page was heavy. That is why this product pairs the work with the experience: a clear opening, a phone-friendly layout, fewer heavy assets, and a path to contact you.
                </p>
                <p className="font-semibold text-foreground">
                  Start with one improvement: resize your images, open the page on your phone, or make your strongest project easier to find. · Nic
                </p>
              </div>
            </div>
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Block({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="glass lift relative overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="grad-flowerboy absolute inset-x-0 top-0 h-[2px] opacity-90" />
      <p className="font-mono text-xs font-bold tracking-widest text-[oklch(0.5_0.1_60)]">{num}</p>
      <h3 className="mt-3 font-display text-2xl font-bold leading-tight">{title}</h3>
      <p className="mt-2 text-muted-foreground">{body}</p>
    </div>
  );
}
