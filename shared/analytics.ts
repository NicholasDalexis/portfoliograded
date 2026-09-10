/**
 * Bounded first-party event contract. Never preserve arbitrary caller text,
 * URLs, questions, account identifiers, report IDs or suggestion IDs.
 * The server repeats this check; browser validation is only data minimization.
 */
export const ANALYTICS_EVENTS = [
  "audit_started", "role_pill_selected", "builder_selected", "anchor_clicked",
  "asknic_question", "asknic_opened", "signed_in", "highlight_ask", "fix_toggled",
  "game_started", "paywall_shown", "paywall_confirmed", "checkout_started",
  "checkout_confirmed",
] as const;
export type AnalyticsEvent = typeof ANALYTICS_EVENTS[number];
export type SafeAnalytics = { event: AnalyticsEvent; props: Record<string, string | number | boolean> };
export type AnalyticsRecord = SafeAnalytics & { at: string };

const roles: Readonly<Record<string, string>> = {
  general: "general", creative: "general", "general portfolio": "general",
  marketing: "marketing", "social media": "social_media", social_media: "social_media",
  "creative technology": "creative_technology", creative_technology: "creative_technology",
  photography: "photography", copywriting: "copywriting",
  "graphic design": "graphic_design", graphic_design: "graphic_design",
  videography: "videography", "ux/ui design": "ux_ui", ux_ui: "ux_ui",
  "web development": "web_development", web_development: "web_development",
  "fashion design": "fashion_design", fashion_design: "fashion_design",
};
const builders: Readonly<Record<string, string>> = {
  framer: "framer", squarespace: "squarespace", wix: "wix", canva: "canva",
  webflow: "webflow", cargo: "cargo", wordpress: "wordpress",
  "adobe portfolio": "adobe_portfolio", adobe_portfolio: "adobe_portfolio",
  manus: "manus", "claude / ai builder": "ai_builder", ai_builder: "ai_builder",
  "coded it myself": "coded", coded: "coded",
  "": "unanswered", unanswered: "unanswered", __other: "other", other: "other",
};
function bucket(value: unknown, choices: Readonly<Record<string, string>>, fallback: string): string {
  if (typeof value !== "string" || value.length > 100) return fallback;
  const key = value.trim().toLowerCase();
  return Object.hasOwn(choices, key) ? choices[key] : fallback;
}
function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
export function sanitizeAnalytics(input: unknown): SafeAnalytics | null {
  if (!plainObject(input) || !Object.hasOwn(input, "event") ||
      typeof input.event !== "string" ||
      !(ANALYTICS_EVENTS as readonly string[]).includes(input.event)) return null;
  const raw = Object.hasOwn(input, "props") ? input.props : {};
  if (!plainObject(raw)) return null;
  const value = (key: string) => Object.hasOwn(raw, key) ? raw[key] : undefined;
  const event = input.event as AnalyticsEvent;
  const props: SafeAnalytics["props"] = {};
  const role = () => { props.role = bucket(value("role"), roles, "general"); };
  const builder = () => { props.builder = bucket(value("builder"), builders, "other"); };
  const plan = () => { if (value("plan") === "monthly" || value("plan") === "yearly") props.plan = value("plan") as string; };
  const variant = () => { props.variant = value("variant") === "upgrade" || value("variant") === "publish" ? value("variant") as string : "custom"; };
  switch (event) {
    case "audit_started":
      role(); builder();
      if (typeof value("pro") === "boolean") props.pro = value("pro") as boolean;
      break;
    case "role_pill_selected": role(); break;
    case "builder_selected": builder(); break;
    case "anchor_clicked":
      role();
      if (["S", "A", "B"].includes(value("tier") as string)) props.tier = value("tier") as string;
      break;
    case "asknic_question":
    case "highlight_ask": {
      const length = value("length");
      if (typeof length === "number" && Number.isInteger(length) && length >= 0 && length <= 10_000) props.length = length;
      break;
    }
    case "fix_toggled":
      if (typeof value("done") === "boolean") props.done = value("done") as boolean;
      break;
    case "paywall_shown": variant(); break;
    case "paywall_confirmed": variant(); plan(); break;
    case "checkout_started": plan(); break;
  }
  return { event, props };
}
