import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function NotFound() {
  return <div className="min-h-screen">
    <SiteHeader />
    <main id="main-content" tabIndex={-1} className="container py-16 sm:py-24">
      <section className="glass-strong mx-auto max-w-2xl rounded-[2rem] p-6 sm:p-10">
        <p className="pg-brand-eyebrow">Page not found · 404</p>
        <h1 className="pg-page-title mt-4">Let's find your next step.</h1>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
          This link doesn't lead to a page. You can return to grading or open your saved reports.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="pg-action"><ArrowLeft aria-hidden className="h-4 w-4" />Back to grading</Link>
          <Link href="/reports" className="pg-action-secondary">My reports</Link>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
