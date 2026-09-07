import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { exportPortfolioHTML, type PortfolioDraft } from "@shared/portfolio";
import {
  loadPortfolioDraft,
  downloadPortfolioHTML,
  PORTFOLIO_STORAGE_KEY,
} from "@/lib/portfolioStorage";

export default function PortfolioPreview() {
  const { id } = useParams<{ id: string }>();
  const [draft, setDraft] = useState<PortfolioDraft | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    function read() {
      try {
        const value = loadPortfolioDraft();
        setDraft(value?.id === id ? value : null);
        setError("");
      } catch (error) {
        setDraft(null);
        setError(
          error instanceof Error
            ? error.message
            : "The local draft could not be opened.",
        );
      }
      setLoaded(true);
    }
    function storage(event: StorageEvent) {
      if (event.key === PORTFOLIO_STORAGE_KEY || event.key === null) read();
    }
    read();
    window.addEventListener("storage", storage);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", read);
    };
  }, [id]);
  const preview = useMemo(() => {
    try { return { html: draft ? exportPortfolioHTML(draft) : "", error: "" }; }
    catch (error) { return { html: "", error: error instanceof Error ? error.message : "Complete the contact fields before viewing your website." }; }
  }, [draft]);
  const html = preview.html;
  function download() {
    if (!draft) return;
    try {
      downloadPortfolioHTML(draft);
      setNotice(
        "HTML download started. The file includes your portfolio and images; upload it to a website host when you're ready for a public link.",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Download could not start.",
      );
    }
  }
  if (!loaded)
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="container py-16">
          <p role="status">Opening your local portfolio…</p>
        </main>
      </div>
    );
  if (!draft || !html)
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="container py-16">
          <div className="glass mx-auto max-w-xl rounded-3xl p-8">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-800">
              Local portfolio
            </p>
            <h1 className="mt-3 font-display text-4xl">
              {draft ? "Your draft needs a small fix." : "This draft isn't here."}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-stone-600">
              {draft ? "Your editable draft is still saved in this browser. Finish incomplete email or website addresses in the builder, then open your portfolio again." : "Local portfolio addresses work only in the browser where the draft is saved. If you moved devices or cleared browser data, restore a saved copy in the builder settings."}
            </p>
            {(error || preview.error) && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
              >
                {error || preview.error}
              </p>
            )}
            <Link
              href="/build"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-amber-200 px-5 py-3 text-sm font-semibold"
            >
              <ArrowLeft size={16} /> Back to My portfolio
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  return (
    <div className="min-h-screen bg-[#fffdf7]">
      <div className="border-b border-stone-200 bg-amber-50 px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-800">
              Local portfolio preview
            </p>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-stone-600">
              Only available in this browser. This address is not a public or
              shareable website.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/build"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold"
            >
              <ArrowLeft size={15} /> Edit portfolio
            </Link>

          </div>
        </div>
        {notice && (
          <p
            role="status"
            className="mx-auto mt-3 max-w-7xl text-xs leading-relaxed text-stone-700"
          >
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mx-auto mt-3 max-w-7xl text-xs text-red-800"
          >
            {error}
          </p>
        )}
      </div>
      <main id="main-content" tabIndex={-1}>
        <iframe
          title={`${draft.name || "Your"} portfolio`}
          srcDoc={html}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          className="block min-h-[85dvh] w-full border-0 bg-white"
          style={{ height: "calc(100dvh - 112px)" }}
        />
      </main>
      <p className="border-t border-stone-200 px-4 py-2 text-center text-xs text-stone-500">
        <ExternalLink size={12} className="mr-1 inline" />
        Portfolio links open in a new tab. Your draft updates here when you save
        in the builder.
      </p>
    </div>
  );
}
