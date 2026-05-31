import dns from "node:dns/promises";
import net from "node:net";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";

export type GradeLetter =
  | "S"
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D";

export type CategoryKey =
  | "first_impression"
  | "narrative"
  | "case_studies"
  | "visual_craft"
  | "performance"
  | "mobile"
  | "accessibility"
  | "seo_discoverability"
  | "conversion";

export interface InsightDetail {
  label: string;
  status: "pass" | "warn" | "fail";
  note: string;
}

export interface CategoryScore {
  key: CategoryKey;
  title: string;
  blurb: string;
  score: number;
  grade: GradeLetter;
  premium: boolean;
  details: InsightDetail[];
  recommendation: string;
  recruiterNote?: string;
}

export interface AuditReport {
  url: string;
  role: string;
  generatedAt: string;
  overall: number;
  overallGrade: GradeLetter;
  headline: string;
  subhead: string;
  bounceEstimate: number;
  bounceTarget: number;
  loadDesktopMs: number;
  loadMobileMs: number;
  categories: CategoryScore[];
  topFixes: { title: string; impact: "High" | "Medium" | "Low"; description: string; premium: boolean }[];
}

type DeviceSignals = {
  requestedUrl: string;
  finalUrl: string;
  ok: boolean;
  status: number;
  elapsedMs: number;
  bytes: number;
  title: string;
  metaDescription: string;
  viewport: string;
  lang: string;
  h1: string[];
  headingsCount: number;
  wordCount: number;
  imageCount: number;
  imagesWithAlt: number;
  linkCount: number;
  buttonCount: number;
  formCount: number;
  scriptCount: number;
  styleCount: number;
  hasMain: boolean;
  hasNav: boolean;
  hasFooter: boolean;
  hasMediaQueries: boolean;
  hasOgTitle: boolean;
  hasOgImage: boolean;
  hasEmail: boolean;
  hasContactLink: boolean;
  hasLinkedIn: boolean;
  hasResume: boolean;
  hasCaseStudyLanguage: boolean;
  hasOutcomeLanguage: boolean;
  hasRoleLanguage: boolean;
  textSample: string;
};

type LlmCategory = {
  key: CategoryKey;
  score: number;
  recommendation: string;
  details: InsightDetail[];
  recruiterNote?: string;
};

type LlmAudit = {
  headline: string;
  subhead: string;
  categories: LlmCategory[];
  topFixes: { title: string; impact: "High" | "Medium" | "Low"; description: string; premium: boolean }[];
};

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 FolioGradeBot/1.0 Desktop";
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 FolioGradeBot/1.0 Mobile";

const CATEGORY_META: Record<CategoryKey, { title: string; blurb: string; premium: boolean }> = {
  first_impression: {
    title: "First Impression",
    blurb: "What a recruiter sees in the first 5 seconds — hero, hook, hierarchy.",
    premium: false,
  },
  narrative: {
    title: "Story & Positioning",
    blurb: "Whether your portfolio reads like a person, not a slideshow.",
    premium: false,
  },
  case_studies: {
    title: "Case Studies",
    blurb: "How well each project tells problem → approach → outcome.",
    premium: false,
  },
  visual_craft: {
    title: "Visual Craft",
    blurb: "Type, color, spacing, image quality — does the site itself prove your eye?",
    premium: false,
  },
  performance: {
    title: "Performance",
    blurb: "How quickly the page becomes useful on a real connection.",
    premium: false,
  },
  mobile: {
    title: "Mobile Experience",
    blurb: "What 60% of recruiters actually see first — your site on a phone.",
    premium: false,
  },
  accessibility: {
    title: "Accessibility",
    blurb: "Whether the site is usable for everyone, including assistive tech.",
    premium: true,
  },
  seo_discoverability: {
    title: "Discoverability",
    blurb: "Whether you'd actually surface in a recruiter's search or share.",
    premium: true,
  },
  conversion: {
    title: "Conversion Path",
    blurb: "How easily a hiring manager goes from impressed to inbox.",
    premium: true,
  },
};

const CATEGORY_KEYS = Object.keys(CATEGORY_META) as CategoryKey[];

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function scoreToGrade(score: number, premiumUnlocked = false): GradeLetter {
  if (premiumUnlocked && score >= 97) return "S";
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 87) return "A-";
  if (score >= 83) return "B+";
  if (score >= 80) return "B";
  if (score >= 77) return "B-";
  if (score >= 73) return "C+";
  if (score >= 70) return "C";
  if (score >= 67) return "C-";
  return "D";
}

function gradeTone(grade: GradeLetter): "excellent" | "great" | "good" | "okay" | "weak" {
  if (grade === "S" || grade === "A+" || grade === "A") return "excellent";
  if (grade === "A-" || grade === "B+") return "great";
  if (grade === "B" || grade === "B-") return "good";
  if (grade === "C+" || grade === "C") return "okay";
  return "weak";
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function textAttr(tag: string, attr: string) {
  const re = new RegExp(`${attr}\\s*=\\s*(["'])(.*?)\\1`, "i");
  return decodeEntities(tag.match(re)?.[2]?.trim() ?? "");
}

function countMatches(value: string, re: RegExp) {
  return Array.from(value.matchAll(re)).length;
}

function stripHtml(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function privateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 0)
    );
  }

  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
}

export async function normalizeAuditUrl(input: string) {
  const withProtocol = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid portfolio URL." });
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.')) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a public http or https URL." });
  }

  const host = parsed.hostname.toLowerCase();
  if (["localhost", "0.0.0.0"].includes(host) || host.endsWith(".local")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "FolioGrade can only audit public websites." });
  }

  if (net.isIP(host) && privateIp(host)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "FolioGrade can only audit public websites." });
  }

  try {
    const addresses = await dns.lookup(host, { all: true });
    if (addresses.some((entry) => privateIp(entry.address))) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "FolioGrade can only audit public websites." });
    }
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "BAD_REQUEST", message: "We could not resolve that portfolio URL." });
  }

  parsed.hash = "";
  return parsed.toString();
}

async function fetchHtml(url: string, userAgent: string): Promise<{ html: string; finalUrl: string; status: number; ok: boolean; bytes: number; elapsedMs: number }> {
  const started = Date.now();
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(14_000),
    headers: {
      "user-agent": userAgent,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "That URL did not return an HTML portfolio page." });
  }

  const buffer = await response.arrayBuffer();
  const bytes = buffer.byteLength;
  const html = new TextDecoder("utf-8").decode(buffer).slice(0, 700_000);

  return {
    html,
    finalUrl: response.url,
    status: response.status,
    ok: response.ok,
    bytes,
    elapsedMs: Date.now() - started,
  };
}

function extractSignals(url: string, fetchResult: Awaited<ReturnType<typeof fetchHtml>>): DeviceSignals {
  const { html, finalUrl, status, ok, bytes, elapsedMs } = fetchResult;
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "");
  const metaDescription = decodeEntities(
    html.match(/<meta[^>]+name=["']description["'][^>]+content=(["'])(.*?)\1/i)?.[2]?.trim() ??
      html.match(/<meta[^>]+content=(["'])(.*?)\1[^>]+name=["']description["']/i)?.[2]?.trim() ??
      "",
  );
  const viewport = decodeEntities(
    html.match(/<meta[^>]+name=["']viewport["'][^>]+content=(["'])(.*?)\1/i)?.[2]?.trim() ?? "",
  );
  const lang = decodeEntities(html.match(/<html[^>]+lang=(["'])(.*?)\1/i)?.[2]?.trim() ?? "");
  const h1 = Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi))
    .map((match) => stripHtml(match[1]).slice(0, 120))
    .filter(Boolean);
  const text = stripHtml(html);
  const imageTags = Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((match) => match[0]);
  const imagesWithAlt = imageTags.filter((tag) => textAttr(tag, "alt").length > 0).length;
  const lowerText = text.toLowerCase();
  const lowerHtml = html.toLowerCase();

  return {
    requestedUrl: url,
    finalUrl,
    ok,
    status,
    elapsedMs,
    bytes,
    title,
    metaDescription,
    viewport,
    lang,
    h1,
    headingsCount: countMatches(html, /<h[1-6]\b/gi),
    wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
    imageCount: imageTags.length,
    imagesWithAlt,
    linkCount: countMatches(html, /<a\b/gi),
    buttonCount: countMatches(html, /<button\b/gi) + countMatches(html, /role=["']button["']/gi),
    formCount: countMatches(html, /<form\b/gi),
    scriptCount: countMatches(html, /<script\b/gi),
    styleCount: countMatches(html, /<style\b|rel=["']stylesheet["']/gi),
    hasMain: /<main\b|role=["']main["']/i.test(html),
    hasNav: /<nav\b|role=["']navigation["']/i.test(html),
    hasFooter: /<footer\b/i.test(html),
    hasMediaQueries: /@media|srcset=|sizes=|picture\b/i.test(html),
    hasOgTitle: /property=["']og:title["']|name=["']twitter:title["']/i.test(html),
    hasOgImage: /property=["']og:image["']|name=["']twitter:image["']/i.test(html),
    hasEmail: /mailto:|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(html),
    hasContactLink: /contact|hire me|get in touch|book a call|work with me/i.test(lowerText) || /href=["'][^"']*(contact|mailto:)/i.test(html),
    hasLinkedIn: /linkedin\.com/i.test(html),
    hasResume: /resume|résumé|cv\b|curriculum vitae/i.test(lowerText),
    hasCaseStudyLanguage: /case stud|selected work|projects|portfolio|work archive|featured work/i.test(lowerText),
    hasOutcomeLanguage: /increased|reduced|launched|shipped|grew|improved|conversion|revenue|users|engagement|result|impact|outcome|%/i.test(lowerText),
    hasRoleLanguage: /designer|developer|engineer|artist|photographer|writer|strategist|marketer|creative|illustrator|architect|director/i.test(lowerText),
    textSample: text.slice(0, 8_000),
  };
}

function detail(label: string, ok: boolean, warnNote: string, passNote: string, failNote = warnNote): InsightDetail {
  return ok
    ? { label, status: "pass", note: passNote }
    : { label, status: "warn", note: warnNote || failNote };
}

function failDetail(label: string, state: "pass" | "warn" | "fail", notes: Record<"pass" | "warn" | "fail", string>): InsightDetail {
  return { label, status: state, note: notes[state] };
}

function scoreFromSignals(key: CategoryKey, desktop: DeviceSignals, mobile: DeviceSignals, role: string) {
  const titleClear = desktop.title.length >= 12 && desktop.title.length <= 80;
  const hasHero = desktop.h1.length === 1 && desktop.h1[0].length >= 8;
  const roleMentioned = desktop.hasRoleLanguage || desktop.textSample.toLowerCase().includes(role.toLowerCase().split(" ")[0] ?? "");
  const altRatio = desktop.imageCount ? desktop.imagesWithAlt / desktop.imageCount : 1;
  const loadDesktop = desktop.elapsedMs + Math.round(desktop.bytes / 850);
  const loadMobile = mobile.elapsedMs + Math.round(mobile.bytes / 520) + (desktop.hasMediaQueries ? 350 : 900);

  switch (key) {
    case "first_impression": {
      const score = 48 + (hasHero ? 18 : 0) + (titleClear ? 12 : 0) + (roleMentioned ? 12 : 0) + (desktop.hasContactLink ? 7 : 0) + (desktop.headingsCount >= 3 ? 5 : 0);
      return {
        score,
        details: [
          failDetail("Above-the-fold clarity", hasHero && roleMentioned ? "pass" : hasHero ? "warn" : "fail", {
            pass: "The first heading gives recruiters a clear starting point.",
            warn: "The hero exists, but it does not strongly name the role or value proposition.",
            fail: "No clear H1 was found, so the first five seconds may feel ambiguous.",
          }),
          detail("Headline hierarchy", desktop.h1.length === 1, "Multiple or missing H1 elements weaken the page hierarchy.", "A single H1 gives the page a clean primary message."),
          detail("Primary CTA", desktop.hasContactLink, "A clear contact or hire-me path was not prominent in the crawled page text.", "A contact-oriented next step is visible from the public page."),
        ],
        recommendation: hasHero ? "Make the opening line more specific to the work and clients you want next." : "Add one clear H1 that names what you do, who it helps, and why it matters.",
      };
    }
    case "narrative": {
      const about = /about|bio|based in|i'm|i am|we are/i.test(desktop.textSample);
      const score = 46 + (about ? 18 : 0) + (roleMentioned ? 14 : 0) + (desktop.hasOutcomeLanguage ? 14 : 0) + (desktop.wordCount > 350 ? 8 : 0);
      return {
        score,
        details: [
          failDetail("About / positioning", about && roleMentioned ? "pass" : about ? "warn" : "fail", {
            pass: "The page includes personal or studio context tied to a recognizable role.",
            warn: "There is some bio language, but it could position the work more sharply.",
            fail: "The crawler did not find a clear about or positioning statement.",
          }),
          detail("Voice & tone", desktop.wordCount > 250, "The public page is visually present, but has limited explanatory copy.", "There is enough text for recruiters to understand intent, context, and voice."),
          detail("Proof of impact", desktop.hasOutcomeLanguage, "Impact language or outcomes were sparse in the crawled text.", "The site includes outcome-oriented language recruiters can anchor on."),
        ],
        recommendation: "Add a concise positioning paragraph that connects your role, taste, and measurable impact.",
      };
    }
    case "case_studies": {
      const projectSignal = desktop.hasCaseStudyLanguage || desktop.linkCount >= 8;
      const score = 44 + (projectSignal ? 20 : 0) + (desktop.hasOutcomeLanguage ? 16 : 0) + (desktop.headingsCount >= 5 ? 10 : 0) + (desktop.imageCount >= 4 ? 8 : 0);
      return {
        score,
        details: [
          detail("Problem framing", projectSignal, "Project or selected-work language was limited on the crawled page.", "The page signals a project-based work section."),
          detail("Process visibility", desktop.headingsCount >= 5, "More project headings or section labels would make the work easier to scan.", "Section structure gives recruiters several scannable entry points."),
          detail("Outcome / result", desktop.hasOutcomeLanguage, "The crawler found few concrete outcomes, metrics, or launch signals.", "Outcome language is present and can lift perceived seniority."),
        ],
        recommendation: "For the strongest projects, surface problem, role, and outcome before the visual deep dive.",
      };
    }
    case "visual_craft": {
      const score = 52 + (desktop.styleCount > 0 ? 10 : 0) + (desktop.imageCount >= 3 ? 12 : 0) + (desktop.headingsCount >= 3 ? 8 : 0) + (desktop.bytes < 2_500_000 ? 8 : 0) + (titleClear ? 5 : 0);
      return {
        score,
        details: [
          detail("Typography system", desktop.headingsCount >= 3, "Heading structure is thin, so the typographic hierarchy may not be doing enough work.", "The page has enough heading structure to support a visible hierarchy."),
          detail("Image quality", desktop.imageCount >= 3, "Few meaningful images were found in the HTML, which may undersell visual work.", "The page exposes a healthy number of portfolio images."),
          detail("Whitespace & rhythm", desktop.bytes < 2_500_000, "The page payload is heavy; large assets can make an otherwise polished site feel slow.", "The initial HTML payload looks controlled enough to support a smooth first impression."),
        ],
        recommendation: "Keep the visual system tight: clear type hierarchy, consistent image treatment, and compressed showcase assets.",
      };
    }
    case "performance": {
      const score = 100 - Math.round(loadDesktop / 90) - Math.round(desktop.bytes / 140_000) - Math.max(0, desktop.scriptCount - 12);
      return {
        score,
        details: [
          failDetail("Largest Contentful Paint", loadDesktop < 2600 ? "pass" : loadDesktop < 4200 ? "warn" : "fail", {
            pass: `Desktop response and payload estimate landed near ${(loadDesktop / 1000).toFixed(1)}s.`,
            warn: `Desktop load estimate is ${(loadDesktop / 1000).toFixed(1)}s, which may feel slow on a recruiter pass.`,
            fail: `Desktop load estimate is ${(loadDesktop / 1000).toFixed(1)}s, likely delaying the first impression.`,
          }),
          failDetail("Asset weight", desktop.bytes < 1_500_000 ? "pass" : desktop.bytes < 3_000_000 ? "warn" : "fail", {
            pass: "The initial HTML response is reasonably light.",
            warn: "The initial response is moderately heavy before below-the-fold assets are considered.",
            fail: "The initial response is heavy enough to create speed risk.",
          }),
          detail("Render blocking", desktop.scriptCount < 18, "A high script count may delay interactivity or rendering.", "Script count is not excessive for a modern portfolio."),
        ],
        recommendation: "Compress large media, defer non-critical scripts, and lazy-load gallery assets below the first viewport.",
      };
    }
    case "mobile": {
      const responsive = Boolean(desktop.viewport) && /width=device-width/i.test(desktop.viewport);
      const score = 45 + (responsive ? 22 : 0) + (desktop.hasMediaQueries ? 13 : 0) + (loadMobile < 4500 ? 12 : 0) + (mobile.ok ? 6 : 0);
      return {
        score,
        details: [
          failDetail("Viewport & scaling", responsive ? "pass" : desktop.viewport ? "warn" : "fail", {
            pass: "A responsive viewport meta tag was detected.",
            warn: "A viewport tag exists, but it may not use the standard responsive width setting.",
            fail: "No responsive viewport meta tag was detected.",
          }),
          detail("Touch targets", desktop.buttonCount + desktop.linkCount > 2, "Few obvious links or buttons were detected for mobile navigation.", "The page exposes interactive elements that mobile visitors can use."),
          failDetail("Mobile performance", loadMobile < 3500 ? "pass" : loadMobile < 5500 ? "warn" : "fail", {
            pass: `Mobile load estimate is ${(loadMobile / 1000).toFixed(1)}s on the crawled page.`,
            warn: `Mobile load estimate is ${(loadMobile / 1000).toFixed(1)}s; image and script savings would help.`,
            fail: `Mobile load estimate is ${(loadMobile / 1000).toFixed(1)}s, which is high for a first recruiter pass.`,
          }),
        ],
        recommendation: responsive ? "Audit the first mobile viewport and make sure the best project appears before deep scrolling." : "Add a responsive viewport and test the hero at 390px wide before refining visual details.",
      };
    }
    case "accessibility": {
      const semantic = desktop.hasMain && desktop.hasNav;
      const score = 45 + (altRatio >= 0.8 ? 20 : altRatio >= 0.45 ? 10 : 0) + (semantic ? 15 : 0) + (desktop.lang ? 8 : 0) + (desktop.h1.length === 1 ? 8 : 0);
      return {
        score,
        details: [
          failDetail("Color contrast", desktop.styleCount > 0 ? "warn" : "fail", {
            pass: "Contrast appears strong from declared styling.",
            warn: "Contrast needs visual confirmation; run an AA pass on muted text and buttons.",
            fail: "No reliable style signal was found to infer contrast quality.",
          }),
          failDetail("Alt text coverage", altRatio >= 0.8 ? "pass" : altRatio >= 0.45 ? "warn" : "fail", {
            pass: "Most portfolio images include alt text.",
            warn: "Several images appear to be missing useful alt text.",
            fail: "Most images are missing descriptive alt text.",
          }),
          failDetail("Keyboard navigation", semantic ? "pass" : desktop.hasMain || desktop.hasNav ? "warn" : "fail", {
            pass: "Semantic main and navigation regions were detected.",
            warn: "Some semantic structure exists, but landmarks could be clearer.",
            fail: "The crawler did not find clear semantic landmarks for navigation and content.",
          }),
        ],
        recommendation: "Add descriptive alt text, visible focus states, and semantic landmarks before chasing smaller polish wins.",
      };
    }
    case "seo_discoverability": {
      const score = 42 + (titleClear ? 16 : 0) + (desktop.metaDescription.length >= 40 ? 18 : 0) + (desktop.hasOgImage ? 12 : 0) + (desktop.hasOgTitle ? 7 : 0) + (desktop.h1.length > 0 ? 5 : 0);
      return {
        score,
        details: [
          failDetail("Title & meta", titleClear && desktop.metaDescription.length >= 40 ? "pass" : titleClear || desktop.metaDescription ? "warn" : "fail", {
            pass: "Title and meta description give search and share previews useful context.",
            warn: "Title or meta description exists, but one of them could be more specific.",
            fail: "The crawler did not find a strong title and meta description pair.",
          }),
          detail("Social share preview", desktop.hasOgImage, "No custom Open Graph image was detected for LinkedIn or Slack shares.", "A social preview image is declared in the page metadata."),
          detail("Searchable name", desktop.h1.length > 0 || titleClear, "Name or role signals should appear in the title or H1.", "The title or H1 gives recruiters a searchable entry point."),
        ],
        recommendation: "Use a title like ‘Name — Role / Specialty’ plus a custom Open Graph image for recruiter shares.",
      };
    }
    case "conversion": {
      const score = 43 + (desktop.hasContactLink ? 22 : 0) + (desktop.hasEmail ? 12 : 0) + (desktop.hasLinkedIn ? 8 : 0) + (desktop.hasResume ? 8 : 0) + (desktop.formCount > 0 ? 4 : 0);
      return {
        score,
        details: [
          detail("Contact reachability", desktop.hasContactLink || desktop.hasEmail, "Contact information was not easy to identify in the crawled page.", "A contact path or email is visible in the public page."),
          detail("Availability signal", /available|open to|booking|freelance|hire/i.test(desktop.textSample), "Add a clear availability statement near the contact path.", "The site includes language that signals availability."),
          detail("Resume / next step", desktop.hasResume || desktop.hasLinkedIn, "Resume or LinkedIn was not prominent in the crawled HTML.", "Resume or LinkedIn gives recruiters a practical next step."),
        ],
        recommendation: "Make the next step unmistakable: direct email, LinkedIn or resume, and one line about availability.",
      };
    }
  }
}

async function askLlmForAudit(base: AuditReport, desktop: DeviceSignals, mobile: DeviceSignals): Promise<LlmAudit | null> {
  const htmlSummary = {
    desktop: { ...desktop, textSample: desktop.textSample.slice(0, 2_800) },
    mobile: { ...mobile, textSample: mobile.textSample.slice(0, 1_500) },
  };

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are FolioGrade, a friendly but rigorous portfolio website auditor inspired by Resume Worded. Return only JSON matching the schema. Keep language specific, concise, and actionable. Do not claim you visually rendered the site; use the provided crawl signals.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Improve this portfolio audit report using real crawl signals. Preserve the existing category keys and premium flags. Scores must be 0-100. Free users still receive all categories, but premium categories can be marked premium in fixes.",
            currentReport: base,
            crawlSignals: htmlSummary,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "foliograde_audit",
          strict: true,
          schema: {
            type: "object",
            properties: {
              headline: { type: "string" },
              subhead: { type: "string" },
              categories: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string", enum: CATEGORY_KEYS },
                    score: { type: "number" },
                    recommendation: { type: "string" },
                    details: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          label: { type: "string" },
                          status: { type: "string", enum: ["pass", "warn", "fail"] },
                          note: { type: "string" },
                        },
                        required: ["label", "status", "note"],
                        additionalProperties: false,
                      },
                    },
                    recruiterNote: { type: "string" },
                  },
                  required: ["key", "score", "recommendation", "details", "recruiterNote"],
                  additionalProperties: false,
                },
              },
              topFixes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    impact: { type: "string", enum: ["High", "Medium", "Low"] },
                    description: { type: "string" },
                    premium: { type: "boolean" },
                  },
                  required: ["title", "impact", "description", "premium"],
                  additionalProperties: false,
                },
              },
            },
            required: ["headline", "subhead", "categories", "topFixes"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return null;
    return JSON.parse(content) as LlmAudit;
  } catch (error) {
    console.warn("[Audit] LLM enrichment failed; using deterministic crawl scoring.", error);
    return null;
  }
}

function buildDeterministicReport(url: string, role: string, isPro: boolean, desktop: DeviceSignals, mobile: DeviceSignals): AuditReport {
  const loadDesktopMs = clamp(desktop.elapsedMs + Math.round(desktop.bytes / 850), 700, 8_000);
  const loadMobileMs = clamp(mobile.elapsedMs + Math.round(mobile.bytes / 520) + (desktop.hasMediaQueries ? 350 : 900), 1_200, 10_000);

  const categories: CategoryScore[] = CATEGORY_KEYS.map((key) => {
    const meta = CATEGORY_META[key];
    const base = scoreFromSignals(key, desktop, mobile, role);
    const score = clamp(Math.round(base.score), 35, 99);
    return {
      key,
      title: meta.title,
      blurb: meta.blurb,
      score,
      grade: scoreToGrade(score, isPro),
      premium: meta.premium,
      details: base.details,
      recommendation: base.recommendation,
      recruiterNote: meta.premium
        ? `For ${role || "creative"} roles, recruiters often treat this as a quiet trust signal rather than a nice-to-have.`
        : undefined,
    };
  });

  const freeWeights = categories.filter((c) => !c.premium);
  const premiumWeights = isPro ? categories.filter((c) => c.premium) : [];
  const weighted = [...freeWeights, ...premiumWeights];
  const overall = clamp(Math.round(weighted.reduce((acc, c) => acc + c.score, 0) / weighted.length), 40, 99);
  const overallGrade = scoreToGrade(overall, isPro);
  const tone = gradeTone(overallGrade);
  const headline =
    tone === "excellent"
      ? "This portfolio is already recruiter-ready."
      : tone === "great"
        ? "You are close to top-tier."
        : tone === "good"
          ? "Solid foundation, but the story can work harder."
          : tone === "okay"
            ? "There is a stronger portfolio inside this one."
            : "Recruiters may bounce before they meet the work.";
  const subhead =
    tone === "excellent"
      ? `The crawl found strong clarity, structure, and hiring signals for ${role}. The remaining wins are mostly refinement.`
      : tone === "great"
        ? `The site has a credible first pass for ${role}, with a few specific gaps holding it back from A territory.`
        : tone === "good"
          ? `Recruiters can understand the work, but clearer positioning, faster mobile loading, and sharper proof would lift confidence.`
          : tone === "okay"
            ? `The public page exposes enough signals to audit, but hierarchy, mobile readiness, and recruiter next steps need attention.`
            : `The crawl found missing fundamentals around clarity, speed, accessibility, or conversion. Fix those before polishing the edges.`;

  const topFixes = categories
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map((category, index) => ({
      title: category.recommendation.split(".")[0],
      impact: index < 2 ? ("High" as const) : index < 4 ? ("Medium" as const) : ("Low" as const),
      description: category.recommendation,
      premium: category.premium,
    }));

  const bounceEstimate = clamp(82 - Math.round((overall - 60) * 0.88) + (loadMobileMs > 5_000 ? 8 : 0), 18, 82);

  return {
    url,
    role,
    generatedAt: new Date().toISOString(),
    overall,
    overallGrade,
    headline,
    subhead,
    bounceEstimate,
    bounceTarget: 32,
    loadDesktopMs,
    loadMobileMs,
    categories,
    topFixes,
  };
}

function mergeLlmReport(base: AuditReport, llm: LlmAudit | null, isPro: boolean): AuditReport {
  if (!llm) return base;

  const categories = base.categories.map((category) => {
    const enriched = llm.categories.find((candidate) => candidate.key === category.key);
    if (!enriched) return category;
    const score = clamp(Math.round(enriched.score), 35, 99);
    const details = enriched.details.slice(0, 3);
    return {
      ...category,
      score,
      grade: scoreToGrade(score, isPro),
      recommendation: enriched.recommendation || category.recommendation,
      details: details.length === 3 ? details : category.details,
      recruiterNote: enriched.recruiterNote || category.recruiterNote,
    };
  });

  const overall = clamp(Math.round(categories.filter((c) => isPro || !c.premium).reduce((acc, c) => acc + c.score, 0) / (isPro ? categories.length : categories.filter((c) => !c.premium).length)), 40, 99);

  return {
    ...base,
    headline: llm.headline || base.headline,
    subhead: llm.subhead || base.subhead,
    categories,
    overall,
    overallGrade: scoreToGrade(overall, isPro),
    bounceEstimate: clamp(82 - Math.round((overall - 60) * 0.88) + (base.loadMobileMs > 5_000 ? 8 : 0), 18, 82),
    topFixes: llm.topFixes.length >= 3 ? llm.topFixes.slice(0, 6) : base.topFixes,
  };
}

export async function runPortfolioAudit(input: { url: string; role: string; isPro: boolean }): Promise<AuditReport> {
  const url = await normalizeAuditUrl(input.url);
  const role = input.role.trim().slice(0, 120) || "Creative";

  let desktopFetch: Awaited<ReturnType<typeof fetchHtml>>;
  let mobileFetch: Awaited<ReturnType<typeof fetchHtml>>;

  try {
    [desktopFetch, mobileFetch] = await Promise.all([fetchHtml(url, DESKTOP_UA), fetchHtml(url, MOBILE_UA)]);
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "BAD_REQUEST", message: "We could not crawl that portfolio. Check that it is public and try again." });
  }

  const desktop = extractSignals(url, desktopFetch);
  const mobile = extractSignals(url, mobileFetch);
  const base = buildDeterministicReport(url, role, input.isPro, desktop, mobile);
  const llm = await askLlmForAudit(base, desktop, mobile);
  return mergeLlmReport(base, llm, input.isPro);
}
