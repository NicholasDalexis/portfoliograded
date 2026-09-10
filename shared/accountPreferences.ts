import { z } from "zod";

export const MARKETING_SCOPE = "portfolio-graded-email-v1" as const;
export const MARKETING_CONSENT_TEXT = "Email me portfolio tips and Portfolio Graded updates.";
export const MarketingPreferenceInput = z.object({
  marketingEmails: z.boolean(),
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
}).strict();
export const AccountPreferencesSchema = z.object({
  marketingEmails: z.boolean(),
  revision: z.number().int().min(0),
  updatedAt: z.string().datetime().nullable(),
  scope: z.literal(MARKETING_SCOPE),
  emailVerified: z.boolean(),
  sendingEnabled: z.literal(false),
}).strict();
export type AccountPreferences = z.infer<typeof AccountPreferencesSchema>;
