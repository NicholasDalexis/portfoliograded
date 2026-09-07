import { Link } from "wouter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SavedReports } from "@/components/SavedReports";

export default function Reports() {
  return <><SiteHeader /><main id="main-content" tabIndex={-1} className="container pt-12 sm:pt-20"><div className="mx-auto max-w-3xl"><p className="pg-brand-eyebrow">Pick up where you left off</p><h1 className="pg-page-title mt-3">Your work. Your progress.</h1><p className="mt-4 leading-relaxed text-muted-foreground">Your original grade and date stay on each report. Revisit your fix list, check the homepage for changes, or run a fresh review when you are ready.</p><div className="mt-7"><SavedReports /></div><Link href="/" className="pg-action mt-6 w-full sm:w-auto">Grade a portfolio</Link></div></main><SiteFooter /></>;
}
