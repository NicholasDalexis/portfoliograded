/**
 * Centralized environment configuration for PortfolioGraded.
 *
 * All third-party platform credentials are read here so the rest of the
 * codebase never touches process.env directly. Missing values are surfaced
 * loudly at boot for the ones that are required in production.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[ENV] Missing required environment variable: ${name}`);
    }
    console.warn(`[ENV] ${name} is not set (ok in development, required in production)`);
    return "";
  }
  return value.trim();
}

export const ENV = {
  // Runtime
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT || "3000", 10),
  appUrl: process.env.APP_URL || "http://localhost:3000",

  // Database (Railway MySQL provides DATABASE_URL automatically)
  databaseUrl: process.env.DATABASE_URL ?? "",

  // Clerk authentication
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? "",

  // Anthropic (audit enrichment - Claude Opus 4.8)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",

  // Stripe (Pro subscription)
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePriceIdPro: process.env.STRIPE_PRICE_ID_PRO ?? "",

  // Owner (gets admin role on first sign-in) - Clerk user id or email
  ownerEmail: process.env.OWNER_EMAIL ?? "",
} as const;

/**
 * Call once at boot in production to fail fast on misconfiguration.
 */
export function assertProductionEnv() {
  if (!ENV.isProduction) return;
  required("DATABASE_URL", ENV.databaseUrl);
  required("CLERK_SECRET_KEY", ENV.clerkSecretKey);
  required("CLERK_PUBLISHABLE_KEY", ENV.clerkPublishableKey);
  required("ANTHROPIC_API_KEY", ENV.anthropicApiKey);
  required("STRIPE_SECRET_KEY", ENV.stripeSecretKey);
  required("STRIPE_WEBHOOK_SECRET", ENV.stripeWebhookSecret);
  required("STRIPE_PRICE_ID_PRO", ENV.stripePriceIdPro);
  required("APP_URL", process.env.APP_URL);
}
