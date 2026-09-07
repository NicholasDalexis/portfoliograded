import { z } from "zod";

export const TEMPLATE_IDS = ["editorial", "gallery", "studio"] as const;
export const ACCENT_IDS = ["gold", "sage", "rose"] as const;
export const PORTFOLIO_ROLES = ["Marketing", "Social Media", "Creative Technology", "Photography", "Copywriting", "Graphic Design", "Videography", "UX/UI Design", "Web Development", "Fashion Design", "General portfolio"] as const;
export const MAX_DRAFT_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 300 * 1024;
export const MAX_IMAGES = 6;
export const MAX_PROJECTS = 12;
export const MAX_LINKS = 8;
export const PORTFOLIO_TEXT_LIMITS = {
  name: 100, headline: 180, role: 120, bio: 3000, email: 254, location: 120,
  linkLabel: 80, url: 2048, title: 160, summary: 1200, projectRole: 180,
  process: 2000, outcome: 1500, imageAlt: 300,
} as const;

const byteLength = (text: string): number => new TextEncoder().encode(text).byteLength;
const text = (limit: number) => z.string().max(limit).refine(value => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value), "Remove unsupported control characters.");
const id = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/, "Use a valid draft or item ID.");

/** Empty links are valid while editing. Nothing fetches or follows these URLs. */
export function isSafePortfolioURL(value: string): boolean {
  if (value === "") return true;
  if (!/^https:\/\//i.test(value) || value.length > PORTFOLIO_TEXT_LIMITS.url || /[\u0000-\u0020\u007F\\]/u.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}
const safeURL = z.string().max(PORTFOLIO_TEXT_LIMITS.url).refine(isSafePortfolioURL, "Use a full https:// link without credentials or spaces.");

/** Accept only bounded, base64 raster images with the matching file signature. */
export function isSafePortfolioImage(value: string): boolean {
  if (value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 32) return false;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const encoded = match[2];
  if (encoded.length % 4 !== 0) return false;
  const size = encoded.length / 4 * 3 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
  if (size > MAX_IMAGE_BYTES || size < 3) return false;
  try {
    const prefix = atob(encoded.slice(0, 24));
    if (match[1] === "jpeg") return prefix.charCodeAt(0) === 255 && prefix.charCodeAt(1) === 216 && prefix.charCodeAt(2) === 255;
    if (match[1] === "png") return prefix.startsWith("\x89PNG\r\n\x1a\n");
    return prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP";
  } catch { return false; }
}

export const PortfolioImageSchema = z.strictObject({
  src: z.string().refine(isSafePortfolioImage, "Use a JPEG, PNG, or WebP image no larger than 300 KB."),
  alt: text(PORTFOLIO_TEXT_LIMITS.imageAlt),
});
export const PortfolioProjectSchema = z.strictObject({
  id,
  title: text(PORTFOLIO_TEXT_LIMITS.title),
  summary: text(PORTFOLIO_TEXT_LIMITS.summary),
  role: text(PORTFOLIO_TEXT_LIMITS.projectRole),
  process: text(PORTFOLIO_TEXT_LIMITS.process),
  outcome: text(PORTFOLIO_TEXT_LIMITS.outcome),
  image: PortfolioImageSchema.optional(),
  link: safeURL.optional(),
});
export const PortfolioDraftSchema = z.strictObject({
  id,
  revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  updatedAt: z.iso.datetime(),
  template: z.enum(TEMPLATE_IDS),
  accent: z.enum(ACCENT_IDS),
  name: text(PORTFOLIO_TEXT_LIMITS.name),
  headline: text(PORTFOLIO_TEXT_LIMITS.headline),
  role: text(PORTFOLIO_TEXT_LIMITS.role),
  bio: text(PORTFOLIO_TEXT_LIMITS.bio),
  email: z.union([z.literal(""), z.email().max(PORTFOLIO_TEXT_LIMITS.email)]),
  location: text(PORTFOLIO_TEXT_LIMITS.location),
  links: z.array(z.strictObject({ id, label: text(PORTFOLIO_TEXT_LIMITS.linkLabel), url: safeURL })).max(MAX_LINKS),
  projects: z.array(PortfolioProjectSchema).max(MAX_PROJECTS),
}).superRefine(checkDraftCollections);

function checkDraftCollections(draft: { projects: { id: string; image?: unknown }[]; links: { id: string }[] }, ctx: z.RefinementCtx) {
  if (draft.projects.filter(project => project.image).length > MAX_IMAGES) ctx.addIssue({ code: "custom", path: ["projects"], message: "Use at most six project images." });
  for (const key of ["links", "projects"] as const) {
    const ids = draft[key].map(item => item.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: [key], message: "Each item needs a unique ID." });
  }
}

/** Contact text is inert editor/backup data until strict rendering validates it.
 * Keeping partial or invalid pasted addresses here prevents losing unrelated
 * edits. Never use this schema's contact values directly as hrefs or fetch URLs.
 */
export const EditablePortfolioDraftSchema = z.strictObject({
  ...PortfolioDraftSchema.shape,
  email: text(PORTFOLIO_TEXT_LIMITS.email),
  links: z.array(z.strictObject({ id, label: text(PORTFOLIO_TEXT_LIMITS.linkLabel), url: text(PORTFOLIO_TEXT_LIMITS.url) })).max(MAX_LINKS),
  projects: z.array(PortfolioProjectSchema.extend({ link: text(PORTFOLIO_TEXT_LIMITS.url).optional() })).max(MAX_PROJECTS),
}).superRefine(checkDraftCollections);
export type PortfolioDraft = z.infer<typeof PortfolioDraftSchema>;
export type PortfolioProject = z.infer<typeof PortfolioProjectSchema>;
export type PortfolioImage = z.infer<typeof PortfolioImageSchema>;

export class PortfolioValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PortfolioValidationError"; }
}

function validateDraftData(value: unknown, editable: boolean): PortfolioDraft {
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { throw new PortfolioValidationError("The portfolio must contain plain JSON data."); }
  if (typeof serialized !== "string") throw new PortfolioValidationError("Choose a portfolio JSON object.");
  if (byteLength(serialized) > MAX_DRAFT_BYTES) throw new PortfolioValidationError("This draft exceeds 2 MB. Reduce image sizes or remove an image.");
  let plain: unknown;
  try {
    plain = JSON.parse(serialized, (key, item: unknown) => {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Unsupported property.");
      return item;
    });
  } catch { throw new PortfolioValidationError("The portfolio contains unsupported object properties."); }
  const result = (editable ? EditablePortfolioDraftSchema : PortfolioDraftSchema).safeParse(plain);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new PortfolioValidationError(`${issue.path.length ? `${issue.path.join(".")}: ` : ""}${issue.message}`);
  }
  return result.data;
}

/** Required gate before HTML output or any usable external/contact link. */
export function validatePortfolioDraft(value: unknown): PortfolioDraft {
  return validateDraftData(value, false);
}

/** Bounded editable state. It can contain unfinished contact text, never active links. */
export function validateEditablePortfolioDraft(value: unknown): PortfolioDraft {
  return validateDraftData(value, true);
}

export function createEmptyPortfolioDraft(template: PortfolioDraft["template"] = "editorial"): PortfolioDraft {
  return validatePortfolioDraft({
    id: crypto.randomUUID(), revision: 1, updatedAt: new Date().toISOString(), template, accent: "gold",
    name: "", headline: "", role: "", bio: "", email: "", location: "", links: [], projects: [],
  });
}

export function serializePortfolioDraft(draft: PortfolioDraft): string {
  // Compact output keeps backups inside the same size budget accepted on import.
  return JSON.stringify(validateEditablePortfolioDraft(draft));
}

export function importPortfolioJSON(json: string): PortfolioDraft {
  if (typeof json !== "string" || byteLength(json) > MAX_DRAFT_BYTES) throw new PortfolioValidationError("Choose a portfolio JSON file no larger than 2 MB.");
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new PortfolioValidationError("This file is not valid JSON. Choose a Portfolio Graded backup."); }
  return validateEditablePortfolioDraft(parsed);
}

export function escapePortfolioHTML(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

const PALETTES = {
  gold: { pale: "#eee1c3", accent: "#deb65c", deep: "#74551d", studio: "#eed071", soft: "#e4d5ad" },
  sage: { pale: "#e2e8dc", accent: "#adc19c", deep: "#445c38", studio: "#cee2ae", soft: "#c4d0b7" },
  rose: { pale: "#ecdcd7", accent: "#cf9f91", deep: "#7b493e", studio: "#f0b7a2", soft: "#d9b7ad" },
} as const;
const external = (url: string, label: string, className = "") => `<a${className ? ` class="${className}"` : ""} href="${escapePortfolioHTML(url)}" target="_blank" rel="noopener noreferrer">${escapePortfolioHTML(label)}</a>`;
const paragraph = (value: string, className = "") => value.trim() ? `<p${className ? ` class="${className}"` : ""}>${escapePortfolioHTML(value)}</p>` : "";
const arrow = '<span aria-hidden="true" class="arrow">↗</span>';

/** Decorative cover treatment, not an invented screenshot or project image. */
function projectCover(project: PortfolioProject, index: number): string {
  if (project.image) return `<div class="project-visual uploaded"><img class="project-image" src="${escapePortfolioHTML(project.image.src)}" alt="${escapePortfolioHTML(project.image.alt.trim() || project.title.trim() || "Project image")}" loading="lazy" decoding="async"></div>`;
  return `<div class="project-visual cover cover-${index % 4}" aria-hidden="true"><div class="cover-grid"></div><div class="cover-orbit"></div><div class="cover-block"></div><div class="cover-line"></div><span class="cover-label">PROJECT ${String(index + 1).padStart(2, "0")}</span><span class="cover-title">${escapePortfolioHTML(project.title.trim() || "Work in progress")}</span><span class="cover-foot">A closer look <span>↗</span></span></div>`;
}
function caseDetails(project: PortfolioProject): string {
  if (![project.role, project.process, project.outcome].some(value => value.trim())) return "";
  return `<details class="case-details"><summary>Inside the project <span aria-hidden="true">+</span></summary><div class="case-body">${project.role.trim() ? `<div class="detail"><h4>My role</h4>${paragraph(project.role)}</div>` : ""}${project.process.trim() ? `<div class="detail"><h4>Process</h4>${paragraph(project.process)}</div>` : ""}${project.outcome.trim() ? `<div class="detail"><h4>Outcome</h4>${paragraph(project.outcome)}</div>` : ""}</div></details>`;
}
function projectCard(project: PortfolioProject, index: number): string {
  return `<article class="project" id="project-${escapePortfolioHTML(project.id)}" data-pg-project="${escapePortfolioHTML(project.id)}" aria-labelledby="project-title-${index}">${projectCover(project, index)}<div class="project-copy"><div class="project-kicker"><span class="project-number">${String(index + 1).padStart(2, "0")}</span><span>Selected project</span></div><h3 id="project-title-${index}">${escapePortfolioHTML(project.title.trim() || "Untitled project")}</h3>${paragraph(project.summary, "summary")}${caseDetails(project)}${project.link ? external(project.link, "Explore the project ↗", "project-link") : ""}</div></article>`;
}
function identityArt(draft: PortfolioDraft): string {
  const initials = draft.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "P";
  return `<div class="identity-art" aria-hidden="true"><div class="art-halo"></div><div class="art-sheet"><span class="art-sheet-label">A POINT OF VIEW</span><span class="art-initials">${escapePortfolioHTML(initials)}</span><span class="art-sheet-footer">Ideas made visible.</span></div><div class="art-disc"></div><div class="art-rule"></div><span class="art-caption">The work. The thinking. The person.</span></div>`;
}
function getStyles(draft: PortfolioDraft): string {
  const p = PALETTES[draft.accent];
  return `
:root{color-scheme:light;--paper:#f7f4eb;--surface:#fffdf8;--ink:#292b26;--muted:#66695e;--line:#d9d9cd;--accent:${p.accent};--accent-pale:${p.pale};--accent-deep:${p.deep};--soft:${p.soft};--serif:"Iowan Old Style","Baskerville","Palatino Linotype",Georgia,serif;--sans:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:32px}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased}::selection{background:var(--accent-pale);color:#292b26}a{color:inherit;text-underline-offset:5px;overflow-wrap:anywhere}a:hover{text-decoration-thickness:2px}a:focus-visible,summary:focus-visible{outline:3px solid var(--accent-deep);outline-offset:5px;border-radius:4px}button,a,summary{-webkit-tap-highlight-color:transparent}h1,h2,h3,h4,p{margin:0;overflow-wrap:anywhere}h1,h2,h3{font-family:var(--serif);font-weight:400;line-height:1.08;letter-spacing:-.045em}p{white-space:pre-wrap}img{display:block;max-width:100%}.wrap{width:min(1240px,calc(100% - 112px));margin-inline:auto}.skip{position:absolute;left:20px;top:-90px;z-index:10;background:var(--surface);color:var(--ink);padding:12px 18px;border:1px solid var(--line)}.skip:focus{top:16px}.masthead{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:112px;border-bottom:1px solid var(--line)}.wordmark{display:flex;align-items:center;gap:12px;min-width:0;font-size:14px;font-weight:650;letter-spacing:-.015em}.brand-dot{height:18px;width:18px;border-radius:50%;background:var(--accent);box-shadow:inset -5px -4px 0 #0000000b;flex-shrink:0}.site-nav{display:flex;align-items:center;gap:30px;flex-wrap:wrap;justify-content:flex-end}.site-nav a{min-height:44px;display:inline-flex;align-items:center;text-decoration:none;font-size:12px;letter-spacing:.02em}.site-nav a:hover{color:var(--accent-deep)}.hero{position:relative;padding:86px 0 84px}.eyebrow{font-size:10px;font-weight:650;letter-spacing:.18em;text-transform:uppercase;color:var(--accent-deep);display:flex;align-items:center;gap:12px;margin-bottom:27px}.eyebrow:before{content:"";width:28px;height:1px;background:currentColor}.hero h1{font-size:clamp(52px,7.2vw,106px);max-width:850px}.headline{font-family:var(--serif);font-size:clamp(23px,2.6vw,37px);line-height:1.35;letter-spacing:-.025em;max-width:700px;margin-top:24px;color:var(--muted)}.hero-actions{display:flex;align-items:center;gap:26px;flex-wrap:wrap;margin-top:36px}.hero-link,.project-link{display:inline-flex;align-items:center;justify-content:space-between;gap:24px;min-height:44px;padding:11px 0;border-bottom:1px solid var(--ink);font-size:12px;font-weight:600;text-decoration:none}.hero-link .arrow{font-size:19px;font-weight:400}.hero-location{font-size:11px;color:var(--muted);max-width:220px}.identity-art{position:relative;min-height:350px;height:100%;max-height:500px;isolation:isolate;overflow:hidden;border-radius:1px}.art-halo{position:absolute;width:85%;aspect-ratio:1;left:4%;top:9%;border-radius:50%;background:var(--accent-pale)}.art-sheet{position:absolute;width:65%;height:74%;left:18%;top:14%;background:var(--surface);border:1px solid #ffffff;box-shadow:0 18px 35px -25px #38382370;transform:rotate(-9deg);padding:26px;display:flex;flex-direction:column;justify-content:space-between}.art-sheet-label{font-size:7px;letter-spacing:.17em;color:var(--muted)}.art-initials{font-family:var(--serif);font-size:clamp(65px,10vw,150px);font-style:italic;line-height:1;letter-spacing:-.09em;color:var(--accent-deep);align-self:center}.art-sheet-footer{font-family:var(--serif);font-size:13px;letter-spacing:-.025em}.art-disc{position:absolute;width:25%;aspect-ratio:1;border-radius:50%;right:5%;top:3%;background:var(--accent);box-shadow:inset -12px -14px 0 #00000008}.art-rule{position:absolute;height:1px;width:72%;background:var(--accent-deep);left:14%;bottom:21%;transform:rotate(-36deg);opacity:.4}.art-caption{position:absolute;bottom:0;left:0;width:100%;text-align:center;text-transform:uppercase;font-size:7px;letter-spacing:.16em;color:var(--muted)}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:32px}.section-heading h2{font-size:clamp(32px,4vw,53px)}.section-note{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}.work{padding:58px 0 84px;border-top:1px solid var(--line)}.projects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:40px;row-gap:64px}.project{min-width:0}.project-visual{position:relative;background:var(--accent-pale);aspect-ratio:1.35;min-width:0;overflow:hidden}.project-visual.uploaded{display:flex;align-items:center;justify-content:center;padding:22px}.project-image{width:100%;height:100%;object-fit:contain;max-height:660px}.project-copy{padding:25px 0 0}.project-kicker{display:flex;align-items:center;gap:10px;font-size:9px;font-weight:500;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-bottom:12px}.project-number{color:var(--accent-deep)}.project h3{font-size:clamp(25px,2.7vw,38px);margin-bottom:14px}.summary{font-size:14px;line-height:1.75;max-width:60ch;color:var(--muted)}.project-link{margin-top:21px;color:var(--accent-deep);border-bottom-color:var(--accent-deep)}.case-details{margin-top:23px;border-top:1px solid var(--line);max-width:70ch}.case-details summary{cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:48px;font-size:11px;font-weight:550;list-style:none}.case-details summary::-webkit-details-marker{display:none}.case-details summary span{font-size:18px;font-weight:400}.case-details[open] summary span{transform:rotate(45deg)}.case-body{padding:8px 0 2px;display:grid;gap:21px}.detail h4{font-size:9px;text-transform:uppercase;letter-spacing:.13em;font-weight:650;margin-bottom:8px;color:var(--accent-deep)}.detail p{font-size:14px;color:var(--muted);line-height:1.75}.cover{isolation:isolate;display:flex;flex-direction:column;justify-content:space-between;padding:34px;background:#e4e8d8;color:#35432e}.cover-grid{position:absolute;inset:0;z-index:-3;background-image:linear-gradient(#4853420c 1px,transparent 1px),linear-gradient(90deg,#4853420c 1px,transparent 1px);background-size:28px 28px}.cover-orbit{position:absolute;z-index:-2;right:-10%;top:9%;width:70%;aspect-ratio:1;border:1px solid currentColor;border-radius:50%;opacity:.2;box-shadow:0 0 0 28px #ffffff20,0 0 0 58px #ffffff25}.cover-block{position:absolute;z-index:-1;width:37%;height:62%;right:16%;top:21%;border:1px solid #ffffff66;background:#eef0e6;transform:rotate(22deg);box-shadow:12px 20px 35px -30px #1d251db0}.cover-line{position:absolute;inset:23% 0 auto;height:1px;background:currentColor;transform:rotate(-25deg);opacity:.14}.cover-label{font-size:8px;font-weight:550;letter-spacing:.18em}.cover-title{position:relative;font-family:var(--serif);font-size:clamp(32px,4.7vw,66px);letter-spacing:-.045em;line-height:1.05;max-width:78%;white-space:pre-wrap;overflow-wrap:anywhere}.cover-foot{display:flex;align-items:center;justify-content:space-between;font-size:8px;letter-spacing:.06em}.cover-foot span{font-size:22px;font-weight:300}.cover-1{background:#ead9cd;color:#6b4433}.cover-1 .cover-grid{display:none}.cover-1 .cover-orbit{border:0;background:#d2a58d;width:80%;left:-24%;top:24%;box-shadow:0 0 0 25px #efdcd0}.cover-1 .cover-block{background:#f9efe5;right:15%;top:10%;height:76%;width:42%;transform:rotate(-16deg);border:0}.cover-1 .cover-title{font-style:italic}.cover-2{background:#e9dfae;color:#544b24}.cover-2 .cover-grid{background-size:18px 18px}.cover-2 .cover-orbit{background:#b5ba80;opacity:.8;border:0;right:-30%;top:-25%;width:95%;box-shadow:none}.cover-2 .cover-block{background:#fff4d5;right:11%;top:29%;height:50%;width:60%;transform:rotate(10deg)}.cover-3{background:#d7dedf;color:#37474e}.cover-3 .cover-orbit{border-radius:0;border-width:18px;transform:rotate(30deg);right:0;top:8%;width:58%;box-shadow:none}.cover-3 .cover-block{background:#f0f1e9;transform:rotate(-12deg);width:46%;right:12%;height:74%;top:14%}.about{position:relative;padding:62px;border-top:1px solid var(--line);background:var(--accent-pale);display:grid;grid-template-columns:.6fr 1.4fr;gap:50px;margin-bottom:84px}.about h2{font-size:clamp(30px,3vw,43px);max-width:240px}.about-label{font-size:9px;letter-spacing:.15em;text-transform:uppercase;margin-bottom:20px;color:var(--accent-deep)}.about-copy{font-family:var(--serif);font-size:clamp(20px,2.2vw,29px);line-height:1.5;letter-spacing:-.018em;max-width:780px}.contact{padding:0 0 70px}.contact-inner{border-top:1px solid var(--line);padding-top:55px;display:grid;grid-template-columns:1fr 1fr;gap:35px;align-items:start}.contact h2{font-size:clamp(35px,4.6vw,64px);max-width:540px}.contact-intro{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--accent-deep);margin-bottom:20px}.contact-links{display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:flex-end}.contact-links a{display:inline-flex;align-items:center;min-height:44px;font-size:12px;max-width:100%}.email-link{font-family:var(--serif);font-size:clamp(19px,2.2vw,30px)!important;line-height:1.25;text-decoration:none;padding-bottom:14px;border-bottom:1px solid var(--line);width:100%;justify-content:flex-end}.contact-location{width:100%;text-align:right;font-size:11px;color:var(--muted);margin-top:12px}footer{border-top:1px solid var(--line);padding:24px 0 30px;display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:9px;color:var(--muted);letter-spacing:.02em}footer a{min-height:44px;display:inline-flex;align-items:center;text-decoration:none}footer .footer-credit{display:flex;align-items:center;gap:5px}.footer-dot{height:7px;width:7px;display:inline-block;background:var(--accent);border-radius:50%;margin-right:6px}.editorial .hero{display:grid;grid-template-columns:1.35fr .65fr;gap:50px;align-items:center}.editorial .hero h1{max-width:740px}.editorial .project:first-child{grid-column:1/-1;display:grid;grid-template-columns:1.2fr .8fr;gap:46px;align-items:center}.editorial .project:first-child .project-copy{padding:15px 0}.editorial .project:first-child .project-visual{aspect-ratio:1.3}.editorial .project:first-child h3{font-size:clamp(33px,3.6vw,52px)}
/* Gallery: centered identity, an asymmetric collection, quiet captions. */
.gallery{--paper:#f3f2ee;--surface:#fffdfa;--line:#d2d3cc;--muted:#63665e}.gallery .masthead{min-height:100px;border-bottom:0}.gallery .wordmark{text-transform:uppercase;letter-spacing:.13em;font-size:10px}.gallery .brand-dot{height:11px;width:11px}.gallery .site-nav{gap:26px}.gallery .hero{padding:48px 0 63px;text-align:center;max-width:1000px;margin:auto}.gallery .eyebrow{justify-content:center;margin-bottom:22px}.gallery .eyebrow:before{display:none}.gallery .hero h1{font-size:clamp(54px,9.2vw,130px);margin:auto;letter-spacing:-.065em}.gallery .headline{font-family:var(--sans);font-size:clamp(15px,1.55vw,20px);max-width:570px;letter-spacing:-.015em;margin:22px auto 0;line-height:1.7}.gallery .hero-actions{justify-content:center;margin-top:22px}.gallery .hero-link{border:0;font-size:10px;letter-spacing:.1em;text-transform:uppercase}.gallery .identity-art{display:none}.gallery .work{padding-top:28px;border-top:0}.gallery .section-heading{border-top:1px solid var(--line);padding-top:24px;margin-bottom:32px}.gallery .section-heading h2{font-family:var(--sans);font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:550}.gallery .projects{grid-template-columns:repeat(6,minmax(0,1fr));gap:48px 24px;align-items:start}.gallery .project{grid-column:span 3}.gallery .project:nth-child(4n+1){grid-column:span 4}.gallery .project:nth-child(4n+2){grid-column:span 2}.gallery .project:nth-child(4n+3){grid-column:span 2}.gallery .project:nth-child(4n){grid-column:span 4}.gallery .project-visual{aspect-ratio:1.15}.gallery .project:nth-child(4n+2) .project-visual,.gallery .project:nth-child(4n+3) .project-visual{aspect-ratio:.7}.gallery .project h3{font-size:26px;margin-bottom:12px}.gallery .project-copy{padding:22px 1px 0}.gallery .project-kicker{margin-bottom:9px}.gallery .summary{font-size:12px}.gallery .project-visual.uploaded{padding:12px;background:#e7e6df}.gallery .cover{padding:30px}.gallery .cover-title{font-size:clamp(36px,4.5vw,65px)}.gallery .project:nth-child(4n+2) .cover-title,.gallery .project:nth-child(4n+3) .cover-title{font-size:clamp(30px,3.2vw,43px);max-width:100%}.gallery .about{background:transparent;border-block:1px solid var(--line);padding:52px 0;margin-bottom:55px;grid-template-columns:1fr 2fr}.gallery .about h2{font-family:var(--sans);font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:550}.gallery .about-label{display:none}.gallery .about-copy{font-size:26px;max-width:760px}.gallery .contact-inner{padding-top:0;border:0}.gallery .contact h2{font-size:clamp(52px,6.5vw,88px)}.gallery .contact-links{padding-top:20px}.gallery .email-link{font-family:var(--sans);font-size:17px!important}.gallery footer{padding-top:18px}
/* Studio: bold identity, dark bento projects, contrasting about panel. */
.studio{color-scheme:dark;--paper:#20261f;--surface:#293127;--ink:#f4f0e3;--muted:#b9bdae;--line:#444d3f;--accent:${p.studio};--accent-pale:#364030;--accent-deep:${p.studio};--soft:#505f40}.studio h1,.studio h2,.studio h3{font-family:var(--sans);font-weight:650;letter-spacing:-.065em}.studio .brand-dot{border-radius:3px;transform:rotate(-12deg)}.studio .masthead{border-bottom-color:#f5f1e21c;min-height:104px}.studio .hero{display:grid;grid-template-columns:1.3fr .7fr;gap:60px;align-items:center;padding:76px 0 86px}.studio .hero h1{font-size:clamp(54px,8vw,114px);font-weight:700;line-height:.98}.studio .eyebrow{font-size:9px}.studio .eyebrow:before{width:7px;height:7px;border-radius:50%}.studio .headline{font-family:var(--sans);font-size:clamp(18px,2vw,27px);line-height:1.55;letter-spacing:-.025em}.studio .hero-link{background:var(--accent);color:#24291e;border:0;border-radius:999px;min-height:50px;padding:12px 23px;font-size:11px}.studio .identity-art{height:380px;min-height:320px;border-radius:22px;background:var(--accent);overflow:hidden}.studio .art-halo{width:92%;left:14%;top:34%;border:1px solid #2c332639;background:transparent;box-shadow:0 0 0 24px #2c332612,0 0 0 48px #2c33260d}.studio .art-sheet{width:58%;height:65%;left:21%;top:15%;background:#283125;transform:rotate(-13deg);border:0;box-shadow:23px 29px 0 -10px #68724b45}.studio .art-sheet-label,.studio .art-sheet-footer{color:var(--accent)}.studio .art-initials{font-family:var(--sans);font-weight:700;font-style:normal;color:var(--accent);font-size:100px}.studio .art-disc{background:#f9f2d8;width:22%;right:8%;top:6%;box-shadow:none}.studio .art-rule{background:#22301f;bottom:18%;opacity:.5}.studio .art-caption{color:#293022;bottom:15px;font-size:6px;letter-spacing:.12em}.studio .work{padding-top:45px}.studio .section-heading h2{font-size:clamp(32px,4vw,49px);font-weight:600}.studio .projects{gap:24px}.studio .project{border:1px solid #56604c;background:var(--surface);border-radius:20px;overflow:hidden;display:flex;flex-direction:column}.studio .project-visual{aspect-ratio:1.65;flex-shrink:0}.studio .project-copy{padding:30px}.studio .project h3{font-size:32px;line-height:1.12}.studio .project:first-child{grid-column:1/-1;display:grid;grid-template-columns:1.13fr .87fr;align-items:stretch}.studio .project:first-child .project-visual{aspect-ratio:auto;min-height:430px}.studio .project:first-child .project-copy{align-self:center;padding:38px}.studio .project:first-child h3{font-size:42px}.studio .cover{font-family:var(--sans)}.studio .cover-title{font-family:var(--sans);font-weight:650;letter-spacing:-.065em}.studio .cover-0{background:#bdc9a1;color:#26321e}.studio .cover-0 .cover-block{background:#edf0d2;transform:rotate(-12deg)}.studio .cover-1{background:#dbbe73;color:#3d331e}.studio .cover-1 .cover-title{font-style:normal}.studio .cover-1 .cover-block{background:#f4e8bc;transform:rotate(13deg)}.studio .cover-2{background:#b1c4bd;color:#203a34}.studio .cover-2 .cover-orbit{background:#78988a}.studio .cover-2 .cover-block{background:#d7e6da}.studio .project-visual.uploaded{background:#c8ceb8;padding:24px}.studio .project-link{margin-top:22px;border-bottom-color:#eed07160}.studio .about{background:var(--accent);color:#293022;border:0;border-radius:20px;padding:52px;margin-top:0;margin-bottom:70px;grid-template-columns:.7fr 1.3fr;gap:50px}.studio .about-label{color:#445033}.studio .about h2{font-size:40px}.studio .about-copy{font-family:var(--sans);font-size:23px;line-height:1.6;font-weight:400;letter-spacing:-.025em}.studio .contact-inner{padding-top:28px}.studio .contact h2{font-size:clamp(39px,5vw,67px)}.studio .email-link{font-family:var(--sans);font-size:23px!important}.studio footer{font-size:9px}.studio a:focus-visible,.studio summary:focus-visible{outline-color:var(--accent)}
@media(max-width:900px){.wrap{width:calc(100% - 64px)}.masthead,.studio .masthead{min-height:92px}.site-nav{gap:19px}.hero,.studio .hero{padding-top:58px;padding-bottom:62px}.editorial .hero,.studio .hero{grid-template-columns:1.25fr .75fr;gap:24px}.hero h1{font-size:clamp(47px,8vw,80px)}.identity-art{min-height:280px}.studio .identity-art{height:310px;min-height:280px}.art-sheet{padding:18px}.studio .art-initials{font-size:70px}.hero-location{max-width:160px}.projects{gap:44px 24px}.editorial .project:first-child{gap:28px}.project-copy{padding-top:20px}.project-kicker{font-size:8px}.cover{padding:24px}.cover-title{font-size:clamp(33px,5.6vw,56px)}.about,.studio .about{padding:38px;gap:30px}.about-copy,.studio .about-copy{font-size:21px}.contact-inner{gap:24px}.gallery .projects{grid-template-columns:repeat(2,minmax(0,1fr));gap:38px 24px}.gallery .project,.gallery .project:nth-child(n){grid-column:auto}.gallery .project:nth-child(n) .project-visual{aspect-ratio:1}.gallery .project:nth-child(n) .cover-title{font-size:42px}.studio .project:first-child .project-visual{min-height:380px}.studio .project-copy,.studio .project:first-child .project-copy{padding:26px}.studio .project:first-child h3{font-size:34px}}
@media(max-width:600px){html{scroll-padding-top:20px}.wrap{width:calc(100% - 40px)}body{font-size:15px}.masthead,.gallery .masthead,.studio .masthead{min-height:82px;gap:12px}.wordmark{font-size:11px;gap:8px;max-width:52%;line-height:1.35}.brand-dot{width:13px;height:13px}.site-nav,.gallery .site-nav{gap:13px}.site-nav a{font-size:10px}.hero,.studio .hero{padding:40px 0 48px}.editorial .hero,.studio .hero{grid-template-columns:1fr;gap:30px}.eyebrow{font-size:9px;margin-bottom:21px}.hero h1,.studio .hero h1{font-size:clamp(47px,12.3vw,70px);letter-spacing:-.055em}.headline{font-size:25px;margin-top:18px}.hero-actions{margin-top:24px;gap:20px}.hero-location{max-width:155px;font-size:10px}.hero-link{font-size:11px}.identity-art{min-height:240px;height:280px;max-width:330px;width:100%;justify-self:center}.art-halo{width:73%;left:12%;top:0}.art-sheet{width:52%;height:79%;left:24%;top:7%;padding:20px}.art-initials{font-size:87px}.art-disc{width:23%;right:10%;top:2%}.art-rule{bottom:29%}.art-caption{font-size:6px}.work{padding:32px 0 48px}.section-heading{margin-bottom:24px;gap:14px}.section-heading h2,.studio .section-heading h2{font-size:32px}.section-note{font-size:8px;letter-spacing:.1em;max-width:95px;text-align:right}.projects,.gallery .projects,.studio .projects{grid-template-columns:minmax(0,1fr);gap:34px}.editorial .project:first-child{grid-column:auto;display:block}.editorial .project:first-child .project-visual,.project-visual{aspect-ratio:1.14}.editorial .project:first-child .project-copy{padding-top:22px}.project-copy{padding-top:22px}.project-kicker{font-size:8px}.project h3,.editorial .project:first-child h3{font-size:29px}.summary{font-size:14px;line-height:1.75}.case-details{margin-top:18px}.case-details summary{min-height:48px;font-size:12px}.detail p{font-size:14px}.project-link{font-size:12px;margin-top:16px}.cover{padding:24px}.cover-title{font-size:clamp(36px,11vw,49px);max-width:85%}.cover-label,.cover-foot{font-size:7px}.project-visual.uploaded{padding:12px}.about,.studio .about{grid-template-columns:1fr;padding:28px;gap:25px;margin-bottom:48px}.about h2,.studio .about h2{font-size:31px;max-width:none}.about-label{font-size:8px;margin-bottom:12px}.about-copy,.studio .about-copy{font-size:20px;line-height:1.55}.contact{padding-bottom:36px}.contact-inner{grid-template-columns:1fr;gap:25px;padding-top:35px}.contact h2,.studio .contact h2{font-size:39px}.contact-intro{font-size:9px;margin-bottom:14px}.contact-links{justify-content:flex-start;gap:5px 22px}.email-link{justify-content:flex-start;font-size:23px!important;padding-bottom:10px}.contact-location{text-align:left;font-size:10px}.contact-links a{font-size:12px}footer{padding:18px 0 24px;gap:12px;align-items:flex-start;font-size:8px}footer .footer-credit{justify-content:flex-end;flex-wrap:wrap;gap:0 3px;text-align:right}footer a{min-height:44px}.gallery .hero{padding:32px 0 39px}.gallery .hero h1{font-size:clamp(48px,13vw,69px)}.gallery .headline{font-size:15px;line-height:1.65}.gallery .hero-actions{margin-top:18px}.gallery .work{padding-top:0}.gallery .section-heading{padding-top:20px}.gallery .section-heading h2{font-size:10px}.gallery .projects{gap:36px}.gallery .project:nth-child(n) .project-visual{aspect-ratio:1.1}.gallery .project:nth-child(n) .cover-title{font-size:clamp(32px,10.3vw,43px);max-width:100%}.gallery .project-copy{padding-top:18px}.gallery .project h3{font-size:27px}.gallery .about{grid-template-columns:1fr;padding:32px 0;gap:20px;margin-bottom:38px}.gallery .about h2{font-size:10px}.gallery .about-copy{font-size:23px}.gallery .contact-inner{gap:18px}.gallery .contact h2{font-size:54px}.gallery .contact-links{padding-top:0}.gallery .email-link{font-size:17px!important}.studio .hero .headline{font-size:20px;line-height:1.5}.studio .identity-art{height:270px;min-height:270px;max-width:none;border-radius:16px}.studio .art-sheet{width:46%;height:73%;left:28%;top:11%;padding:18px}.studio .art-initials{font-size:81px}.studio .art-halo{top:18%;width:76%}.studio .art-disc{width:19%;right:16%}.studio .work{padding-top:30px}.studio .project,.studio .project:first-child{grid-column:auto;display:block;border-radius:16px}.studio .project:first-child .project-visual{aspect-ratio:1.15;min-height:0}.studio .project-visual{aspect-ratio:1.15}.studio .project-copy,.studio .project:first-child .project-copy{padding:25px}.studio .project h3,.studio .project:first-child h3{font-size:29px}.studio .about{border-radius:16px}.studio .contact-inner{padding-top:30px}.studio .email-link{font-size:20px!important}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{transition:none!important}}@media print{body,.studio{--paper:#fff;--surface:#fff;--ink:#111;--muted:#333;--line:#bbb;--accent-deep:#111;background:#fff;color:#111}.wrap{width:100%}.hero,.studio .hero,.gallery .hero{padding-top:30px}.identity-art,.site-nav,.skip{display:none}.hero,.editorial .hero,.studio .hero{display:block}.projects,.editorial .projects,.gallery .projects,.studio .projects{display:block}.project,.editorial .project:first-child,.studio .project:first-child{display:block;break-inside:avoid;margin-bottom:30px}.project-visual{max-height:300px}.project-image{max-height:300px}.about,.studio .about{background:#f5f5f2;color:#111;padding:25px}.case-details:not([open]) .case-body{display:block}.contact{break-inside:avoid}a{color:inherit}}
`;
}

/** Strict, standalone, script-free output. Editor-only interactions must be
 * added outside this function and never persisted as the exported portfolio.
 */
export function exportPortfolioHTML(input: PortfolioDraft): string {
  const draft = validatePortfolioDraft(input);
  const projects = draft.projects.filter(project => [project.title, project.summary, project.role, project.process, project.outcome, project.link].some(value => value?.trim()) || project.image);
  const validLinks = draft.links.filter(link => link.url);
  const hasContact = Boolean(draft.email || validLinks.length);
  const name = draft.name.trim() || "Portfolio";
  const nav = [projects.length ? '<a href="#work">Work</a>' : "", draft.bio.trim() ? '<a href="#about">About</a>' : "", hasContact ? '<a href="#contact">Contact ↗</a>' : ""].join("");
  const links = validLinks.map(link => external(link.url, link.label.trim() || new URL(link.url).hostname));
  const contactTitle = draft.template === "gallery" ? "Let’s talk." : draft.template === "studio" ? "Good things start<br>with a conversation." : "Have something<br><em>in mind?</em>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'"><meta name="referrer" content="no-referrer"><title>${escapePortfolioHTML(draft.name.trim() ? `${name} | Portfolio` : "Portfolio")}</title><style>${getStyles(draft)}</style></head><body class="${draft.template}"><a class="skip" href="#main">Skip to portfolio</a><div class="wrap">
<header class="masthead"><div class="wordmark"><span class="brand-dot" aria-hidden="true"></span><span>${escapePortfolioHTML(name)}</span></div>${nav ? `<nav class="site-nav" aria-label="Portfolio navigation">${nav}</nav>` : ""}</header>
<main id="main" tabindex="-1"><section class="hero" data-pg-section="about" aria-label="Introduction"><div class="hero-copy">${draft.role.trim() ? paragraph(draft.role,"eyebrow") : ""}<h1>${escapePortfolioHTML(name)}</h1>${paragraph(draft.headline,"headline")}${projects.length || draft.location.trim() ? `<div class="hero-actions">${projects.length ? `<a href="#work" class="hero-link">View selected work ${arrow}</a>` : ""}${paragraph(draft.location,"hero-location")}</div>` : ""}</div>${draft.template === "gallery" ? "" : identityArt(draft)}</section>
${projects.length ? `<section class="work" id="work" data-pg-section="work" aria-labelledby="work-heading"><div class="section-heading"><h2 id="work-heading">Selected work</h2><p class="section-note">${String(projects.length).padStart(2,"0")} ${projects.length === 1 ? "project" : "projects"} · A closer look</p></div><div class="projects">${projects.map(projectCard).join("\n")}</div></section>` : ""}
${draft.bio.trim() ? `<section class="about" id="about" data-pg-section="about" aria-labelledby="about-heading"><div><p class="about-label">Behind the work</p><h2 id="about-heading">A little<br><em>about me.</em></h2></div>${paragraph(draft.bio,"about-copy")}</section>` : ""}
${hasContact ? `<section class="contact" id="contact" data-pg-section="contact" aria-labelledby="contact-heading"><div class="contact-inner"><div><p class="contact-intro">Get in touch</p><h2 id="contact-heading">${contactTitle}</h2></div><div class="contact-links">${draft.email ? external(`mailto:${encodeURIComponent(draft.email)}`,draft.email,"email-link") : ""}${links.join("\n")}${paragraph(draft.location,"contact-location")}</div></div></section>` : ""}</main>
<footer><span><span class="footer-dot" aria-hidden="true"></span>${escapePortfolioHTML(name)}</span><span class="footer-credit">Made with ${external("https://portfoliograded.com","Portfolio Graded")}</span></footer></div></body></html>`;
}
