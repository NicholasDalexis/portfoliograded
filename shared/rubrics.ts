/*
 * portfolio graded. ten role rubrics plus the general portfolio fallback.
 * Structured version of Rasputin/JobHunt/Portfolio-Graded-Rubrics.md (the
 * cited source of truth). Each pill on the homepage maps 1:1 to a rubric here
 * via ROLE_PRESETS. The audit engine uses: weights for scoring, checks for
 * the deep dive, dealbreakers for grade caps, sTier for the premium ceiling.
 * Rule: rubric edits happen in the vault doc first, then get mirrored here.
 */
import type { CategoryKey } from "./audit";

export interface Dealbreaker {
  /** What the engine detected. */
  rule: string;
  /** Category whose grade gets capped. */
  category: CategoryKey;
  /** Maximum score (0-100) that category can receive when tripped. */
  capScore: number;
}

export interface RoleRubric {
  key: string;
  /** Exact pill label shown on the homepage. */
  label: string;
  /** What this role's grading cares about, one line, shown in the report. */
  focus: string;
  /** Category weights, must sum to 100. Used for the overall score. */
  weights: Record<CategoryKey, number>;
  /** Role-specific criteria the deep dive verifies (premium). */
  checks: string[];
  /** Detected problems that cap a category's grade. */
  dealbreakers: Dealbreaker[];
  /** Signals required for the S ceiling (premium only). */
  sTier: string[];
  /** Photography only: grade against the detected archetype. */
  archetypes?: { key: string; signal: string; extraChecks: string[] }[];
}

export const RUBRIC_VERSION = "1.1";

/**
 * Explicit version of the existing equal-weight fallback. It is intentionally
 * separate from the ten profession pills and does not assume a hiring field.
 * Fractional weights preserve the previous arithmetic mean without introducing
 * a new, uncalibrated weighting scheme.
 */
export const GENERAL_RUBRIC: RoleRubric = {
  key: "general",
  label: "General portfolio",
  focus: "Clear work, useful context, readable content, and a clear next step, without assuming a profession.",
  weights: {
    first_impression: 100 / 9,
    narrative: 100 / 9,
    case_studies: 100 / 9,
    visual_craft: 100 / 9,
    performance: 100 / 9,
    mobile: 100 / 9,
    accessibility: 100 / 9,
    seo_discoverability: 100 / 9,
    conversion: 100 / 9,
  },
  checks: [
    "The page clearly identifies whose work is shown and gives useful context",
    "Work examples identify the person's contribution where relevant",
    "Contact or the intended next step is clearly identified",
    "Only judge facts visible in the reviewed content; mark unsupported checks unverified",
  ],
  dealbreakers: [],
  sTier: [],
};

export const ROLE_RUBRICS: RoleRubric[] = [
  {
    key: "marketing",
    label: "Marketing",
    focus: "Case studies with receipts: challenge, role, approach, measurable outcome.",
    weights: {
      case_studies: 25,
      narrative: 20,
      conversion: 15,
      first_impression: 15,
      visual_craft: 10,
      performance: 5,
      mobile: 5,
      seo_discoverability: 3,
      accessibility: 2,
    },
    checks: [
      "Every case study states a quantified outcome, not a task description",
      "3-5 strong case studies rather than many weak ones",
      "Before/after baseline context on every result",
      "Specific personal contribution named per project; collaborators credited",
      "Work organized by channel or goal",
      "Testimonials with names, titles, and outcome specifics",
      "Mock campaigns clearly labeled, with research and hypothetical KPIs",
      "Tools shown in action inside projects, not a certification logo wall",
      "About page: human, brief, industries + achievements + personality",
    ],
    dealbreakers: [
      { rule: "Single deliverable from a campaign with no process shown", category: "case_studies", capScore: 68 },
      { rule: "Big-name brand claims with no breakdown of the actual role", category: "narrative", capScore: 68 },
      { rule: "No visible contact path", category: "conversion", capScore: 55 },
      { rule: "Work appears 5+ years old with nothing recent", category: "first_impression", capScore: 74 },
    ],
    sTier: [
      "The portfolio is itself a marketing artifact (ranks, converts, proves the skill by existing)",
      "Every project reads challenge → hypothesis → fix → measured outcome",
      "Human presence: real photo or video intro, distinct voice, named-brand proof",
    ],
  },
  {
    key: "social_media",
    label: "Social Media",
    focus: "Proof of attention: strategy written out, numbers tied to business outcomes.",
    weights: {
      case_studies: 25,
      narrative: 20,
      mobile: 15,
      conversion: 15,
      visual_craft: 10,
      first_impression: 10,
      performance: 2,
      seo_discoverability: 2,
      accessibility: 1,
    },
    checks: [
      "Case studies follow goal → strategy → execution → result",
      "Numbers on every project, tied to business outcomes (not vanity counts alone)",
      "Strategic reasoning written out: why it worked, not just that it did",
      "Analytics screenshots as receipts (own accounts count)",
      "Platform-specific range: video, carousel, static, copy in native formats",
      "Before/after baseline per account",
      "Candidate's own profiles are intentional and polished",
      "Full job breadth: strategy, content, community, reporting; NDA work told with credit",
      "Grown-from-zero niche accounts count as real proof for students",
    ],
    dealbreakers: [
      { rule: "Highlight-reel portfolio: aesthetics with zero strategy", category: "case_studies", capScore: 72 },
      { rule: "Spec or fantasy-client work presented as real client work", category: "narrative", capScore: 55 },
      { rule: "Credit taken for accounts the candidate didn't lead", category: "narrative", capScore: 68 },
      { rule: "No metrics anywhere on the site", category: "case_studies", capScore: 74 },
      { rule: "Broken on a phone", category: "mobile", capScore: 55 },
    ],
    sTier: [
      "Story + stat on every project: challenge, hypothesis, fix, measured outcome",
      "A short highlight reel of best visual work",
      "Process transparency: real workflow or strategy docs shown",
      "Curation aimed at the work they want next",
    ],
  },
  {
    key: "creative_technology",
    label: "Creative Technology",
    focus: "The site itself is exhibit A: live builds that work, process that shows thinking.",
    weights: {
      case_studies: 20,
      performance: 20,
      visual_craft: 20,
      first_impression: 15,
      narrative: 10,
      mobile: 10,
      seo_discoverability: 2,
      accessibility: 2,
      conversion: 1,
    },
    checks: [
      "The portfolio site itself demonstrates interaction craft, motion, performance",
      "Live working demos, not just repository links; every demo link resolves",
      "Case studies show process: problem → thinking → exploration → solution",
      "Tech stack named per project",
      "At least one AI-integrated build beyond API calls, with architecture decisions documented",
      "Role attribution on team projects with 2-3 sentences of context",
      "Impact stated per project, measurable or qualitative",
      "About 5 stellar projects with a coherent point of view",
      "One memorable WOW project that could carry an interview",
      "Build-process or GitHub visibility backing the site",
    ],
    dealbreakers: [
      { rule: "Projects with no context or explanation", category: "case_studies", capScore: 68 },
      { rule: "Dead demo links or broken builds", category: "performance", capScore: 68 },
      { rule: "Generic tutorial/template projects with no original angle", category: "narrative", capScore: 74 },
      { rule: "Clumsy navigation on the portfolio itself", category: "visual_craft", capScore: 72 },
    ],
    sTier: [
      "The site is itself an experience (benchmark: bruno-simon.com)",
      "Builds framed as business outcomes: partner, not executor",
      "Documented architecture decisions that AI-generated demos can't fake",
    ],
  },
  {
    key: "photography",
    label: "Photography",
    focus: "Images are the argument: curation, consistency, sequencing. graded per archetype.",
    weights: {
      visual_craft: 30,
      first_impression: 20,
      conversion: 15,
      performance: 12,
      mobile: 10,
      case_studies: 5,
      narrative: 4,
      seo_discoverability: 2,
      accessibility: 2,
    },
    checks: [
      "15-30 images total, tightly curated (20-30 per Magnum guidance)",
      "Coherent visual identity: consistent color, light, production value",
      "Genre separation: multi-genre means separate pages, never one mixed scroll",
      "Sequencing: opens strongest, closes second-strongest, no valleys",
      "Real About page with a photo of the photographer",
      "Refreshed within the last 6 months",
      "Invisible template: the images are remembered, not the website",
    ],
    dealbreakers: [
      { rule: "Everything-portfolio: many genres mixed with no specialty", category: "narrative", capScore: 68 },
      { rule: "Snapshot-grade filler images among strong work", category: "visual_craft", capScore: 76 },
      { rule: "Slow, heavy galleries (LCP well past 2.5s)", category: "performance", capScore: 68 },
      { rule: "Book-me site with no pricing anywhere", category: "conversion", capScore: 72 },
      { rule: "Broken mobile experience", category: "mobile", capScore: 55 },
    ],
    sTier: [
      "One deliberate body of work: ruthless subtraction, intentional sequencing",
      "An About presence that wins the who-do-we-want-on-set tiebreak",
      "Real-shooting proof: full galleries, BTS content, AI-use disclosed if any",
    ],
    archetypes: [
      {
        key: "hire_me",
        signal: "Genre galleries + credits aimed at editors/recruiters; no service pricing",
        extraChecks: [
          "Portfolio matches the target job or publication style",
          "Personal projects included only if commissionable",
        ],
      },
      {
        key: "book_me",
        signal: "Service niche + pricing/booking language (packages, deposits, sessions)",
        extraChecks: [
          "Visible pricing in starting-at format",
          "Full galleries from single real shoots proving consistency",
          "Story-driven About + testimonials tied to the shoots behind them",
          "Frictionless inquiry path with a clear next step",
          "One specialty per site",
        ],
      },
    ],
  },
  {
    key: "copywriting",
    label: "Copywriting",
    focus: "Every sentence is a work sample. the site's own copy is graded hardest.",
    weights: {
      narrative: 30,
      case_studies: 20,
      first_impression: 15,
      conversion: 10,
      visual_craft: 10,
      mobile: 10,
      performance: 2,
      seo_discoverability: 2,
      accessibility: 1,
    },
    checks: [
      "The site's own copy: hooks, rhythm, zero filler",
      "Name + the actual title 'Copywriter' in the hero, no invented titles",
      "4-6 strong projects (reviews happen in under two minutes)",
      "Each project opens with the idea in one snappy line, then brief → insight → executions",
      "Campaign thinking: ideas scale across channels",
      "Voice range across different brands and audiences",
      "Rich samples with context, never bare links or naked screenshots",
      "Format coverage matching demand: email, landing pages, blog, social",
      "Copy displayed as readable text at full size",
      "Spec work clearly labeled",
      "The strip test: the words stand without the art direction",
    ],
    dealbreakers: [
      { rule: "Any typo anywhere on the site", category: "narrative", capScore: 74 },
      { rule: "Portfolio site with no visible work samples", category: "case_studies", capScore: 55 },
      { rule: "Link-dumping with zero context", category: "case_studies", capScore: 68 },
      { rule: "Generic AI-voice copy on the site itself", category: "narrative", capScore: 72 },
      { rule: "Headlines without strategy; layouts without a concept", category: "case_studies", capScore: 74 },
    ],
    sTier: [
      "Ideas start from a human insight or tension",
      "A distinct personal voice woven through the writer's own site",
      "Results per piece, or a compelling problem-solution story where NDA'd",
      "Original point of view AI can't fake",
    ],
  },
  {
    key: "graphic_design",
    label: "Graphic Design",
    focus: "The portfolio's own type, spacing, and hierarchy are graded as work.",
    weights: {
      visual_craft: 30,
      case_studies: 25,
      first_impression: 15,
      narrative: 10,
      mobile: 10,
      performance: 5,
      seo_discoverability: 2,
      accessibility: 2,
      conversion: 1,
    },
    checks: [
      "The site's own typography, spacing, hierarchy are consistent",
      "4-10 curated projects (4 strong beat 10 average)",
      "Every project states problem, audience, and why",
      "Process visible: sketches, iterations, work-in-progress",
      "Case-study format: context → role → process → decisions → outcome → reflection",
      "Work legible at full size; mockups are garnish, not the meal",
      "Individual role explicit on team or class projects",
      "Range tailored to the target job; near-duplicates cut",
      "Self-initiated projects grounded in a real problem",
      "Downloadable, correctly named resume PDF",
      "AI-generated elements labeled with the workflow explained",
    ],
    dealbreakers: [
      { rule: "Only final screens with no explanation", category: "case_studies", capScore: 68 },
      { rule: "No role clarity on team projects", category: "narrative", capScore: 72 },
      { rule: "Visual inconsistency on the portfolio itself", category: "visual_craft", capScore: 68 },
      { rule: "Dead links or stale profiles", category: "conversion", capScore: 74 },
      { rule: "Template-generated AI-site look (identical bento grids, stock dark gradients)", category: "visual_craft", capScore: 76 },
    ],
    sTier: [
      "Case studies that read as stories with stakes and outcomes",
      "Measured impact, not just aesthetics",
      "Honest reflection including failures and lessons learned",
    ],
  },
  {
    key: "videography",
    label: "Videography",
    focus: "The reel is the resume: best work in the first 10 seconds, your role on every project.",
    weights: {
      visual_craft: 25,
      case_studies: 20,
      performance: 15,
      first_impression: 15,
      mobile: 10,
      conversion: 10,
      narrative: 3,
      seo_discoverability: 1,
      accessibility: 1,
    },
    checks: [
      "Showreel above the fold, 60-90 seconds, not buried behind an About page",
      "Best work inside the first 10 seconds (nobody watches past that to decide)",
      "3-5 project pages after the reel: the brief, YOUR contribution, the outcome",
      "Role labeled on every project (Editor, Colorist, Motion Graphics)",
      "4-8 works categorized by type (commercial, music video, corporate)",
      "Vimeo/YouTube embeds, not self-hosted video files (speed + clean player)",
      "Royalty-free or licensed music only",
      "Editing reels show sustained chunks of single projects, not just quick cuts",
      "Reel tailored to the industry being applied to",
    ],
    dealbreakers: [
      { rule: "Copyrighted music in the reel", category: "visual_craft", capScore: 72 },
      { rule: "Reel over ~2 minutes padded with filler", category: "first_impression", capScore: 72 },
      { rule: "No labels for what the candidate actually did on group work", category: "case_studies", capScore: 68 },
      { rule: "Heavy self-hosted video slowing the page", category: "performance", capScore: 68 },
      { rule: "Trendy effects stacked on everything", category: "visual_craft", capScore: 76 },
    ],
    sTier: [
      "Project pages tell challenge → solution, proving complete products, not just highlights",
      "The site itself has a distinct visual identity that makes the work pop",
      "A reel cut per industry/job instead of one generic reel",
    ],
  },
  {
    key: "ux_ui",
    label: "UX/UI Design",
    focus: "Case studies that show the messy middle and what changed because of the work.",
    weights: {
      case_studies: 30,
      narrative: 15,
      first_impression: 15,
      visual_craft: 15,
      mobile: 8,
      conversion: 7,
      performance: 4,
      accessibility: 4,
      seo_discoverability: 2,
    },
    checks: [
      "About 3 case studies on the homepage (the recruiter-preferred number)",
      "A 2-3 sentence intro that instantly states role + domain",
      "Process visible in every case study, including the messy middle and tradeoffs",
      "Problem → solution → outcome framing, never artifact dumps",
      "Measurable impact numbers (conversion, task completion, adoption)",
      "Project thumbnails that name the problem ('Cut checkout drop-off 18%'), not the artifact",
      "Systems thinking: features shown as part of a product, not isolated screens",
      "The portfolio site itself is flawless (a designer's site IS a work sample)",
      "AI-tool judgment made visible: where it helped, where it was rejected",
    ],
    dealbreakers: [
      { rule: "Case studies opening with empathy maps / textbook double-diamond", category: "case_studies", capScore: 72 },
      { rule: "No metrics anywhere; success claimed without proof", category: "case_studies", capScore: 74 },
      { rule: "Final screens only, no journey shown", category: "case_studies", capScore: 68 },
      { rule: "Typos or layout errors on the portfolio itself", category: "visual_craft", capScore: 68 },
      { rule: "AI-generated sameness: polished screens, no sketches or iteration", category: "narrative", capScore: 72 },
    ],
    sTier: [
      "Proves what CHANGED because of the work: business outcomes + strategic judgment",
      "Niche depth (fintech, health, design systems) instead of generalist spread",
      "One consistent voice across projects, like one mind made it",
    ],
  },
  {
    key: "web_development",
    label: "Web Development",
    focus: "Live demos that work, code you can explain, and a site that is itself the proof.",
    weights: {
      case_studies: 25,
      performance: 20,
      visual_craft: 15,
      narrative: 10,
      first_impression: 10,
      conversion: 8,
      mobile: 7,
      accessibility: 3,
      seo_discoverability: 2,
    },
    checks: [
      "3-5 polished projects, not 10 basic ones",
      "Every project: live demo + repo link + a write-up of the decisions",
      "Deployed, working apps (not just repositories)",
      "Stack matches the target role",
      "Clear READMEs: context, setup, decisions",
      "Specific descriptions ('drag-and-drop, real-time sync, offline support'), never 'Todo app built with React'",
      "Original problems solved, or tutorials extended with unique features",
      "Groomed GitHub: pinned repos, profile README, real activity",
      "At least one collaborative project",
      "AI usage articulated: how Copilot/Cursor is used and where it isn't",
    ],
    dealbreakers: [
      { rule: "Tutorial-clone-only portfolio (the todo-app graveyard)", category: "case_studies", capScore: 68 },
      { rule: "No live demos, repos only", category: "case_studies", capScore: 72 },
      { rule: "Broken links or stale repos", category: "conversion", capScore: 68 },
      { rule: "Typos and inconsistent styling on the portfolio itself", category: "visual_craft", capScore: 72 },
    ],
    sTier: [
      "The site is itself the demo (benchmark: bruno-simon.com, joshwcomeau.com)",
      "Architecture choices defended with business outcomes",
      "Teaching in public: posts or docs that prove communication",
    ],
  },
  {
    key: "fashion_design",
    label: "Fashion Design",
    focus: "Concept to garment: the full process on the page, curated to the brand you want.",
    weights: {
      visual_craft: 30,
      case_studies: 25,
      first_impression: 15,
      narrative: 10,
      mobile: 8,
      performance: 5,
      conversion: 4,
      seo_discoverability: 2,
      accessibility: 1,
    },
    checks: [
      "Full process per project: brief, mood board, fabric + color story, sketches, flats, finished garment",
      "Technical flats with multiple views (proves you can spec, not just illustrate)",
      "Tech-pack/construction detail visible",
      "5-10 projects; curated, never a dump",
      "Curated toward the target brand's aesthetic and market level",
      "Customer/market defined per collection",
      "Software proficiency visible in the work (Illustrator, CLO3D-class tools)",
      "High-quality photography of finished garments",
      "A website AND an interview-ready PDF version both maintained",
    ],
    dealbreakers: [
      { rule: "Pretty finals with zero process shown", category: "case_studies", capScore: 68 },
      { rule: "Uncurated dump including weak filler work", category: "narrative", capScore: 70 },
      { rule: "Inconsistent margins/fonts/typos in the presentation", category: "visual_craft", capScore: 68 },
      { rule: "No explanation of creative choices", category: "case_studies", capScore: 72 },
    ],
    sTier: [
      "A signature design handwriting: one confident point of view through all work",
      "You can feel the designer thinking on the page: questioning, experimenting",
      "Curated per application, brand by brand, not one static book",
    ],
  },
];

/** Pill labels, derived so the pills and rubrics can never drift apart. */
export const RUBRIC_ROLE_LABELS = ROLE_RUBRICS.map((r) => r.label);

/** Common typed variants that should still hit a rubric. */
const ALIASES: Record<string, string> = {
  "creative technologist": "creative_technology",
  "creative tech": "creative_technology",
  copywriter: "copywriting",
  "content writer": "copywriting",
  "graphic designer": "graphic_design",
  "social media manager": "social_media",
  "social media marketing": "social_media",
  photographer: "photography",
  marketer: "marketing",
  videographer: "videography",
  "video editor": "videography",
  "ux designer": "ux_ui",
  "ui designer": "ux_ui",
  "ux/ui designer": "ux_ui",
  "ui/ux designer": "ux_ui",
  "ux ui designer": "ux_ui",
  "ui ux designer": "ux_ui",
  "ui/ux design": "ux_ui",
  "user experience designer": "ux_ui",
  "user interface designer": "ux_ui",
  "web developer": "web_development",
  "frontend developer": "web_development",
  "front-end developer": "web_development",
  "front end developer": "web_development",
  "fashion designer": "fashion_design",
};

/**
 * Match a typed role to a rubric. Conservative on purpose: no pill / generic
 * words ("Creative") = NO rubric = the generic universal audit. A wrong-rubric
 * grade is worse than a generic one.
 */
export function rubricForRole(role: string): RoleRubric | null {
  const q = role.trim().toLowerCase();
  if (!q || ["creative", "general", "general portfolio", "other"].includes(q)) return null;

  const exact = ROLE_RUBRICS.find((r) => r.label.toLowerCase() === q || r.key === q);
  if (exact) return exact;

  const alias = ALIASES[q];
  if (alias) return ROLE_RUBRICS.find((r) => r.key === alias) ?? null;

  // Only match when the typed role CONTAINS a full rubric label
  // ("senior marketing manager" → Marketing). Never label-contains-query.
  return ROLE_RUBRICS.find((r) => q.includes(r.label.toLowerCase())) ?? null;
}
