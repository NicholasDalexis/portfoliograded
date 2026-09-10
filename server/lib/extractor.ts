import { load } from "cheerio";

export interface SiteData {
  url: string;
  title: string | null;
  metaDescription: string | null;
  og: {
    title: string | null;
    description: string | null;
    image: string | null;
  };
  h1s: string[];
  h2s: string[];
  bodyText: string; // first 3 000 chars of visible text
  imageCount: number;
  imagesWithAlt: number;
  imagesWithoutAlt: number;
  internalLinks: number;
  externalLinks: number;
  mailtoLinks: string[];
  hasContactForm: boolean;
  hasNav: boolean;
  metaViewport: boolean;
  canonical: string | null;
  approxWordCount: number;
}

export function extractSiteData(html: string, url: string): SiteData {
  const $ = load(html);
  let baseHostname = "";
  try {
    baseHostname = new URL(url).hostname;
  } catch {}

  // Strip noise before extracting text
  $("script, style, noscript, head").remove();

  const title = $("title").first().text().trim() || null;

  // Reload with full HTML to access head tags for meta/OG
  const $full = load(html);
  const metaDescription =
    $full('meta[name="description"]').attr("content")?.trim() || null;
  const og = {
    title: $full('meta[property="og:title"]').attr("content")?.trim() || null,
    description:
      $full('meta[property="og:description"]').attr("content")?.trim() || null,
    image: $full('meta[property="og:image"]').attr("content")?.trim() || null,
  };
  const metaViewport = $full('meta[name="viewport"]').length > 0;
  const canonical =
    $full('link[rel="canonical"]').attr("href")?.trim() || null;

  const h1s = $full("h1")
    .map((_, el) => $full(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 3);

  const h2s = $full("h2")
    .map((_, el) => $full(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 6);

  // Visible body text — collapse whitespace, cap at 3 000 chars
  const bodyText = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);

  const approxWordCount = bodyText.split(/\s+/).filter(Boolean).length;

  // Images
  const imgs = $full("img");
  let imagesWithAlt = 0;
  let imagesWithoutAlt = 0;
  imgs.each((_, el) => {
    const alt = $full(el).attr("alt")?.trim();
    if (alt && alt.length > 0) imagesWithAlt++;
    else imagesWithoutAlt++;
  });

  // Links
  let internalLinks = 0;
  let externalLinks = 0;
  const mailtoLinks: string[] = [];

  $full("a[href]").each((_, el) => {
    const href = $full(el).attr("href") ?? "";
    if (href.startsWith("mailto:")) {
      const address = href.replace(/^mailto:/i, "").split("?")[0].trim();
      if (address) mailtoLinks.push(address);
      return;
    }
    try {
      const parsed = new URL(href, url);
      if (parsed.hostname === baseHostname) internalLinks++;
      else externalLinks++;
    } catch {
      internalLinks++; // relative links count as internal
    }
  });

  const hasContactForm =
    $full("form").length > 0 ||
    $full('[class*="contact"i], [id*="contact"i]').length > 0;

  const hasNav =
    $full("nav").length > 0 ||
    $full('[role="navigation"]').length > 0;

  return {
    url,
    title,
    metaDescription,
    og,
    h1s,
    h2s,
    bodyText,
    imageCount: imgs.length,
    imagesWithAlt,
    imagesWithoutAlt,
    internalLinks,
    externalLinks,
    mailtoLinks,
    hasContactForm,
    hasNav,
    metaViewport,
    canonical,
    approxWordCount,
  };
}
