import type { RenderedReview } from "./renderedEvidence";
/**
 * portfolio graded. audit types, grade helpers, and mock engine (fallback only).
 * The real audit pipeline lives in server/lib/. This file exports the shared
 * types and CATEGORY_META used by both client and server.
 */

import type { HomepageSourceSnapshot } from "./reportHistory.js";

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

export type CategoryAccess = "open" | "free-account-required" | "pro-required" | "unavailable";
export const ACCOUNT_ACCESS_POLICY = "account-standouts-v1" as const;
export interface PortfolioStandout {
  categoryKey: CategoryKey;
  title: string;
  score: number;
  grade: GradeLetter;
  explanation: string;
  evidenceScope: "homepage-html";
  remainingIssues: boolean;
}
export interface ReportStandouts {
  version: "relative-v1";
  status: "available" | "pro-required" | "unavailable";
  items: PortfolioStandout[];
  teaser?: "Unlock";
}
export interface AssessmentState {
  methodVersion: string;
  status: "new" | "reused" | "previous-preserved";
  evidenceStatus: "complete" | "partial";
  acceptedAt: string;
  checkedAt: string;
  previousReportId?: string;
}
export interface AcceptedAssessmentEvidence {
  version: 1;
  methodVersion: string;
  scope: "homepage-html-and-first-viewport";
  rubricKey: string;
  rubricVersion: string;
  roleKey: string;
  url: string;
  fingerprint: string;
}

export interface CategoryScore {
  key: CategoryKey;
  title: string;
  blurb: string;
  score: number; // 0 - 100
  grade: GradeLetter;
  premium: boolean; // requires upgrade for full drill-down
  details: InsightDetail[];
  recommendation: string;
  recruiterNote?: string; // premium only
  access?: CategoryAccess;
}

export interface AuditVerification {
  /** The initial review reads source HTML, not a rendered website. */
  mode: "homepage-html";
  rubricKey: string;
  rubricVersion: string;
  pageCount: number;
  pages: { url: string; status: number; device: "desktop-user-agent" | "mobile-user-agent" }[];
  visualReview: false;
  mobileLayoutReviewed: false;
  performanceMeasured: false;
  deepReviewVerified: boolean;
  aiEnrichment: "succeeded" | "not-configured" | "unavailable" | "invalid-response";
  limitations: string[];
}

export interface AuditReport {
  url: string;
  role: string;
  generatedAt: string;
  overall: number;
  overallGrade: GradeLetter;
  headline: string;
  subhead: string;
  bounceEstimate: number; // percent
  bounceTarget: number; // percent recruiters expect
  loadDesktopMs: number;
  loadMobileMs: number;
  categories: CategoryScore[];
  topFixes: { title: string; impact: "High" | "Medium" | "Low"; description: string; premium: boolean; categoryKey?: CategoryKey; access?: CategoryAccess }[];
  /** Only new reports opt into account access; historical reports stay on their saved policy. */
  accessPolicy?: typeof ACCOUNT_ACCESS_POLICY;
  standouts?: ReportStandouts;
  assessment?: AssessmentState;
  /** Complete accepted evidence fingerprint; private and removed from outbound reports. */
  acceptedEvidence?: AcceptedAssessmentEvidence;
  /** Optional only for compatibility with historical reports and demo data. */
  verification?: AuditVerification;
  /** Bounded browser observations stored alongside, not inside, the numerical grade. */
  rendered?: RenderedReview;
  /** Server-retained source comparison baseline; omitted from public report responses. */
  sourceSnapshot?: HomepageSourceSnapshot;
}

/**
 * The beta six (locked Jul 1 2026). Pills are DERIVED from the rubrics in
 * ./rubrics.ts so a pill can never exist without its grading rubric attached.
 */
import { RUBRIC_ROLE_LABELS } from "./rubrics";
export const ROLE_PRESETS = RUBRIC_ROLE_LABELS;

/* Deterministic hash so the same URL produces the same grade in the demo. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function pick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length];
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function scoreToGrade(score: number, _premiumUnlocked = false): GradeLetter {
  // The current engine cannot verify a deep review. Payment alone must never
  // award S. Add S back only with a separately validated review contract.
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

export function gradeTone(grade: GradeLetter): "excellent" | "great" | "good" | "okay" | "weak" {
  if (grade === "S" || grade === "A+" || grade === "A") return "excellent";
  if (grade === "A-" || grade === "B+") return "great";
  if (grade === "B" || grade === "B-") return "good";
  if (grade === "C+" || grade === "C") return "okay";
  return "weak";
}

interface Pool {
  recommendation: string[];
  details: { label: string; ok: string; warn: string; fail: string }[];
}

const POOLS: Record<CategoryKey, { title: string; blurb: string; pool: Pool; premium: boolean }> = {
  first_impression: {
    title: "First Impression",
    blurb: "What a recruiter sees in the first 5 seconds. hero, hook, hierarchy.",
    premium: false,
    pool: {
      recommendation: [
        "Lead with one sentence that names what you do and who you do it for.",
        "Move your strongest project above the fold so it's the first thing scrolled into.",
        "Tighten the hero. drop the second tagline and keep one clear value statement.",
      ],
      details: [
        {
          label: "Above-the-fold clarity",
          ok: "Hero communicates role and value within 5 seconds.",
          warn: "Hero is pretty but doesn't clearly say what you do.",
          fail: "Visitors land on a logo or animation with no context.",
        },
        {
          label: "Headline hierarchy",
          ok: "One dominant H1, supporting subline, clear next step.",
          warn: "Two competing headlines fight for attention.",
          fail: "No headline. relies on imagery alone.",
        },
        {
          label: "Primary CTA",
          ok: "Visible CTA leads to work or contact within one click.",
          warn: "CTA exists but is buried below the fold.",
          fail: "No clear CTA. recruiters have to hunt.",
        },
      ],
    },
  },
  narrative: {
    title: "Story & Positioning",
    blurb: "Whether your portfolio reads like a person, not a slideshow.",
    premium: false,
    pool: {
      recommendation: [
        "Write a 2-3 sentence about that names the work you want more of.",
        "Add one specific outcome to your bio (a metric, a launch, a client tier).",
        "Cut filler adjectives. Lead with verbs and proof.",
      ],
      details: [
        {
          label: "About / positioning",
          ok: "About section is specific, sharp, and points to your niche.",
          warn: "About is generic. could describe any designer.",
          fail: "No about section, or only 'creative based in [city]'.",
        },
        {
          label: "Voice & tone",
          ok: "Writing sounds like a person with a point of view.",
          warn: "Reads as polite filler. neither warm nor confident.",
          fail: "Buzzword soup; no personality detected.",
        },
        {
          label: "Proof of impact",
          ok: "Concrete outcomes (clients, metrics, launches) appear early.",
          warn: "Outcomes hidden inside long case study bodies.",
          fail: "No measurable proof anywhere on the site.",
        },
      ],
    },
  },
  case_studies: {
    title: "Case Studies",
    blurb: "Project context on your homepage: the problem, your role and the outcome.",
    premium: false,
    pool: {
      recommendation: [
        "Add a one-line problem statement at the top of your top 3 projects.",
        "Pull the outcome to the top of each case study, not the bottom.",
        "Trim from 6 projects to your 3 strongest. quality reads as confidence.",
      ],
      details: [
        {
          label: "Problem framing",
          ok: "Each project opens with the problem and constraint in one paragraph.",
          warn: "Problem is mentioned but buried under process imagery.",
          fail: "No framing. projects read as image dumps.",
        },
        {
          label: "Process visibility",
          ok: "Process is shown selectively, not exhaustively.",
          warn: "Too much process; final work gets lost.",
          fail: "Process replaces outcome entirely.",
        },
        {
          label: "Outcome / result",
          ok: "Each project ends with a clear result (qualitative or quantitative).",
          warn: "Some projects end abruptly without resolution.",
          fail: "No outcomes documented anywhere.",
        },
      ],
    },
  },
  visual_craft: {
    title: "Visual Craft",
    blurb: "Homepage image and structure clues. Your visual design still needs a closer look.",
    premium: false,
    pool: {
      recommendation: [
        "Standardize spacing on an 8px scale across sections.",
        "Pick one display font and one body font. drop the third.",
        "Re-export hero images at 2x; current ones look soft on retina.",
      ],
      details: [
        {
          label: "Typography system",
          ok: "Two-font pairing with clear hierarchy and consistent weights.",
          warn: "Three or more fonts; weights inconsistent across pages.",
          fail: "System default fonts only. no typographic point of view.",
        },
        {
          label: "Image quality",
          ok: "Crisp, well-cropped, consistent treatment across the grid.",
          warn: "Mixed resolutions and crops; some thumbnails feel rushed.",
          fail: "Low-res or stretched imagery undermines the work.",
        },
        {
          label: "Whitespace & rhythm",
          ok: "Generous, intentional whitespace; sections breathe.",
          warn: "Cramped sections; hierarchy fights for room.",
          fail: "No rhythm. content stacks edge-to-edge.",
        },
      ],
    },
  },
  performance: {
    title: "Performance",
    blurb: "Homepage resource clues. Actual visitor loading speed is not measured.",
    premium: false,
    pool: {
      recommendation: [
        "Compress hero imagery. current LCP image is over 1.2MB.",
        "Lazy-load below-the-fold images to cut initial payload.",
        "Move heavy fonts to swap rendering to avoid invisible text on load.",
      ],
      details: [
        {
          label: "Largest Contentful Paint",
          ok: "LCP under 2.5s on a simulated 4G connection.",
          warn: "LCP between 2.5s and 4s. recruiters wait.",
          fail: "LCP over 4s; the page feels broken before it appears.",
        },
        {
          label: "Asset weight",
          ok: "Initial payload under 1.5MB.",
          warn: "Initial payload between 1.5-3MB.",
          fail: "Initial payload exceeds 3MB.",
        },
        {
          label: "Render blocking",
          ok: "No render-blocking scripts above the fold.",
          warn: "1-2 render-blocking resources detected.",
          fail: "Multiple blocking scripts delay first paint.",
        },
      ],
    },
  },
  mobile: {
    title: "Mobile Experience",
    blurb: "What 60% of recruiters actually see first. your site on a phone.",
    premium: false,
    pool: {
      recommendation: [
        "Increase mobile body text to at least 16px to avoid auto-zoom.",
        "Stack the hero on mobile. currently the headline truncates.",
        "Make tap targets at least 44×44px; nav links are too tight.",
      ],
      details: [
        {
          label: "Viewport & scaling",
          ok: "Layout adapts cleanly down to 360px wide.",
          warn: "Some sections require horizontal scroll on small screens.",
          fail: "Site forces desktop layout on mobile.",
        },
        {
          label: "Touch targets",
          ok: "All interactive elements meet 44×44px minimum.",
          warn: "Some links and buttons are below the touch threshold.",
          fail: "Critical CTAs are unreachable or mis-tappable.",
        },
        {
          label: "Mobile performance",
          ok: "Mobile LCP under 3s on simulated 4G.",
          warn: "Mobile LCP between 3s-5s.",
          fail: "Mobile LCP over 5s. most visitors won't wait.",
        },
      ],
    },
  },
  accessibility: {
    title: "Accessibility",
    blurb: "Homepage descriptions and structure that support accessible use.",
    premium: true,
    pool: {
      recommendation: [
        "Lift body text contrast to at least 4.5:1 against the cream background.",
        "Add descriptive alt text to portfolio thumbnails. currently empty.",
        "Add a visible focus state on nav links for keyboard users.",
      ],
      details: [
        {
          label: "Color contrast",
          ok: "All body text meets WCAG AA contrast ratios.",
          warn: "A handful of secondary text fails AA.",
          fail: "Multiple primary text elements fall below AA.",
        },
        {
          label: "Alt text coverage",
          ok: "Every meaningful image has descriptive alt text.",
          warn: "Half of portfolio images are missing alt text.",
          fail: "Almost no alt text present.",
        },
        {
          label: "Keyboard navigation",
          ok: "All interactive elements reachable and focus-visible.",
          warn: "Focus states are removed or invisible.",
          fail: "Custom components trap focus or skip elements.",
        },
      ],
    },
  },
  seo_discoverability: {
    title: "Discoverability",
    blurb: "Homepage information that helps describe your site in links and search.",
    premium: true,
    pool: {
      recommendation: [
        "Write a unique meta description that names your role and city.",
        "Add a custom Open Graph image. current shares show a blank card.",
        "Set the page title to your name + role, not the template default.",
      ],
      details: [
        {
          label: "Title & meta",
          ok: "Page title and meta describe you and your work clearly.",
          warn: "Title is generic ('Home' or 'Portfolio').",
          fail: "Default template title still in place.",
        },
        {
          label: "Social share preview",
          ok: "Custom OG image and description render on Twitter/LinkedIn.",
          warn: "OG tags exist but image is auto-generated or low-res.",
          fail: "Shares show a blank or broken preview.",
        },
        {
          label: "Searchable name",
          ok: "Your name appears in the page title and an H1.",
          warn: "Your name is only in the footer.",
          fail: "Your name doesn't appear at all.",
        },
      ],
    },
  },
  conversion: {
    title: "Conversion Path",
    blurb: "Contact paths mentioned on your homepage.",
    premium: true,
    pool: {
      recommendation: [
        "Move contact above the footer. a sticky 'Get in touch' CTA helps.",
        "Replace the contact form with a direct email link; recruiters prefer it.",
        "Add a one-line availability statement near your contact info.",
      ],
      details: [
        {
          label: "Contact reachability",
          ok: "Email or contact form is one click from any page.",
          warn: "Contact buried in footer or behind a separate page.",
          fail: "No contact information found.",
        },
        {
          label: "Availability signal",
          ok: "Clear statement of availability (open to work, booking now, etc.).",
          warn: "Status implied but not explicit.",
          fail: "No indication of whether you're hireable.",
        },
        {
          label: "Resume / next step",
          ok: "Resume or LinkedIn linked prominently next to contact.",
          warn: "Resume linked but hard to find.",
          fail: "No resume, no LinkedIn, no next step.",
        },
      ],
    },
  },
};

/* Headlines tuned to the overall grade. */
const HEADLINES: Record<"excellent" | "great" | "good" | "okay" | "weak", { title: string; sub: string }[]> = {
  excellent: [
    { title: "This is hiring-grade work.", sub: "Your portfolio holds up to the toughest recruiter pass. We have a few small refinements to push it further." },
    { title: "Recruiters won't bounce.", sub: "Your hero, story, and craft are aligned. The remaining wins are in the margins." },
  ],
  great: [
    { title: "You're close to top-tier.", sub: "Strong foundation with a few specific moments holding it back. Address them and you'll move into A territory." },
  ],
  good: [
    { title: "Solid, but forgettable in places.", sub: "The site works. It just doesn't argue hard enough for you. We've flagged the moments to sharpen." },
  ],
  okay: [
    { title: "There's a great portfolio inside this one.", sub: "Your work is here. the framing, hierarchy, and mobile experience aren't doing it justice yet." },
  ],
  weak: [
    { title: "Recruiters are bouncing before they meet you.", sub: "Several fundamentals are getting in the way of the work. The good news: every one of these is fixable this week." },
  ],
};

const ROLE_FLAVOR: Record<string, string> = {
  "Graphic Design": "Hiring leads in graphic design weight visual craft and case study clarity above almost everything else.",
  "Marketing": "Marketing managers scan for outcomes and metrics first. qualitative wins matter, but numbers close interviews.",
  "Photography": "Photo directors will judge image quality, sequencing, and load speed of the gallery itself before reading a word.",
  "Creative Technologist": "Hiring teams here look for evidence of taste *and* technical chops. performance and polish both count.",
  "Artist": "Galleries and labels read your portfolio as a body of work; cohesion of voice matters more than feature variety.",
  "UX / Product Design": "Recruiters scan for problem framing, decision rationale, and one shipped outcome per case study.",
  "Front-End Engineer": "Engineering managers will judge your portfolio site's own performance and accessibility as a code sample.",
  "Content / Copywriter": "Content leads read for voice and concrete impact. They'll bounce from generic headlines fast.",
  "Illustration": "ADs scan thumbnails first. grid quality, range, and consistency matter as much as any individual piece.",
  "Brand Strategy": "Strategy leads will look for sharp positioning and crisp case studies that show thinking, not just artifacts.",
  "Film & Motion": "Reel-first. If your homepage video doesn't autoplay clean and load fast, the rest doesn't get a chance.",
  "Architecture": "Project diversity, photographic quality, and clarity of role on each project carry the most weight.",
};

/** Static per-category metadata shared between the mock engine and the real pipeline. */
export const CATEGORY_META: Record<CategoryKey, { title: string; blurb: string; premium: boolean }> = {
  first_impression:    { title: "First Impression",    blurb: "The introduction and work context on your homepage.",                   premium: false },
  narrative:           { title: "Story & Positioning", blurb: "Whether your portfolio reads like a person, not a slideshow.",                             premium: false },
  case_studies:        { title: "Case Studies",        blurb: "Project context on your homepage: the problem, your role and the outcome.",                               premium: false },
  visual_craft:        { title: "Visual Craft",        blurb: "Homepage image and structure clues. Your visual design still needs a closer look.",               premium: false },
  performance:         { title: "Performance",         blurb: "Homepage resource clues. Actual visitor loading speed is not measured.",                                premium: false },
  mobile:              { title: "Mobile Experience",   blurb: "How the homepage supports someone visiting on a phone.",                       premium: false },
  accessibility:       { title: "Accessibility",       blurb: "Homepage descriptions and structure that support accessible use.",                       premium: false  },
  seo_discoverability: { title: "Discoverability",     blurb: "Homepage information that helps describe your site in links and search.",                        premium: false  },
  conversion:          { title: "Conversion Path",     blurb: "Contact paths mentioned on your homepage.",                               premium: false  },
};

export function buildAudit(rawUrl: string, rawRole: string, premiumUnlocked: boolean): AuditReport {
  const url = rawUrl.trim() || "https://your-portfolio.com";
  const role = rawRole.trim() || "Creative";
  const seed = hash(url + "::" + role.toLowerCase());

  /* Anchor a base score in the 64-94 band with a small premium nudge. */
  const base = 64 + (seed % 31); // 64..94
  const premiumBoost = premiumUnlocked && base >= 92 ? 4 : 0;

  const categoryKeys: CategoryKey[] = [
    "first_impression",
    "narrative",
    "case_studies",
    "visual_craft",
    "performance",
    "mobile",
    "accessibility",
    "seo_discoverability",
    "conversion",
  ];

  const categories: CategoryScore[] = categoryKeys.map((k, i) => {
    const meta = POOLS[k];
    const variance = ((seed >> (i * 2)) & 0x1f) - 15; // -15..16
    const raw = clamp(base + variance + (premiumUnlocked ? 1 : 0), 35, 99);
    const grade = scoreToGrade(raw, premiumUnlocked);
    const detailStatuses: ("pass" | "warn" | "fail")[] =
      raw >= 88 ? ["pass", "pass", "pass"]
      : raw >= 80 ? ["pass", "pass", "warn"]
      : raw >= 72 ? ["pass", "warn", "warn"]
      : raw >= 64 ? ["warn", "warn", "fail"]
      : ["warn", "fail", "fail"];

    const details: InsightDetail[] = meta.pool.details.map((d, di) => ({
      label: d.label,
      status: detailStatuses[di],
      note: detailStatuses[di] === "pass" ? d.ok : detailStatuses[di] === "warn" ? d.warn : d.fail,
    }));

    return {
      key: k,
      title: meta.title,
      blurb: meta.blurb,
      score: raw,
      grade,
      premium: meta.premium,
      details,
      recommendation: pick(meta.pool.recommendation, seed, i),
      recruiterNote: meta.premium
        ? "Premium recruiters in this field weigh this category roughly 2x more than the public benchmark. addressing it tends to convert on the first pass."
        : undefined,
    };
  });

  const overall = clamp(
    Math.round(categories.reduce((acc, c) => acc + c.score, 0) / categories.length) + premiumBoost,
    40,
    99,
  );
  const overallGrade = scoreToGrade(overall, premiumUnlocked);
  const tone = gradeTone(overallGrade);
  const head = pick(HEADLINES[tone], seed);

  const flavor = ROLE_FLAVOR[role] ?? `For roles like ${role.toLowerCase()}, recruiters scan for clarity of work and an obvious next step.`;

  const bounceEstimate = clamp(82 - Math.round((overall - 60) * 0.9), 18, 78);
  const bounceTarget = 32;

  const loadDesktopMs = clamp(900 + ((seed >> 4) % 2400), 700, 4200);
  const loadMobileMs = clamp(loadDesktopMs + 800 + ((seed >> 6) % 1800), 1500, 6500);

  const fixPool = [
    { title: "Rewrite the hero in one sentence", impact: "High" as const, premium: false, description: "Recruiters give your hero five seconds. Lead with role + niche + outcome. Skip the wordmark animation." },
    { title: "Promote your top project above the fold", impact: "High" as const, premium: false, description: "Move your strongest case study into the first viewport. Quality reads as confidence; quantity reads as filler." },
    { title: "Cut from six projects to three", impact: "Medium" as const, premium: false, description: "Three sharp projects beat six average ones. Recruiters skim. make every tile earn its slot." },
    { title: "Add measurable outcomes to each case study", impact: "High" as const, premium: true, description: "One concrete result per project (a metric, a launch, a tier of client) raises perceived seniority instantly." },
    { title: "Compress hero imagery & lazy-load thumbnails", impact: "Medium" as const, premium: false, description: "Your largest contentful paint is dragged down by an uncompressed hero. A 60% reduction is achievable in an hour." },
    { title: "Add a recruiter-friendly contact path", impact: "Medium" as const, premium: true, description: "Direct email + availability statement near the top of contact. Forms add friction recruiters won't fight through." },
    { title: "Custom Open Graph card for shares", impact: "Low" as const, premium: true, description: "Recruiters share portfolios in Slack and DMs. A blank or default OG card costs you the second look." },
  ];

  const topFixes = [0, 1, 2, 3, 4, 5].map((i) => fixPool[(seed + i) % fixPool.length]);

  return {
    url,
    role,
    generatedAt: new Date().toISOString(),
    overall,
    overallGrade,
    headline: head.title,
    subhead: `${head.sub} ${flavor}`,
    bounceEstimate,
    bounceTarget,
    loadDesktopMs,
    loadMobileMs,
    categories,
    topFixes,
  };
}

export function gradeColorOklch(grade: GradeLetter) {
  switch (grade) {
    case "S":
      return "linear-gradient(120deg, oklch(0.86 0.14 80), oklch(0.95 0.06 90), oklch(0.78 0.18 60), oklch(0.95 0.06 90), oklch(0.86 0.14 80))";
    case "A+":
    case "A":
      return "linear-gradient(120deg, oklch(0.82 0.14 55), oklch(0.86 0.16 75), oklch(0.88 0.14 95))";
    case "A-":
    case "B+":
      return "linear-gradient(120deg, oklch(0.84 0.13 60), oklch(0.86 0.14 80), oklch(0.86 0.12 95))";
    case "B":
    case "B-":
      return "linear-gradient(120deg, oklch(0.84 0.10 65), oklch(0.86 0.10 85), oklch(0.86 0.08 95))";
    case "C+":
    case "C":
      return "linear-gradient(120deg, oklch(0.80 0.08 50), oklch(0.84 0.07 75))";
    default:
      return "linear-gradient(120deg, oklch(0.78 0.07 45), oklch(0.78 0.07 55))";
  }
}
