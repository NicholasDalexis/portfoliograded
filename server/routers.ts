import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { runPortfolioAudit } from "./auditEngine";
import { enforce } from "./_core/rateLimit";
import { createBillingPortalSession, createCheckoutSession } from "./_core/stripe";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    /** Current user + derived Pro status. Null when signed out. */
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      return {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        role: ctx.user.role,
        isPro: db.isUserPro(ctx.user),
        proExpiresAt: ctx.user.proExpiresAt,
      };
    }),
  }),

  audit: router({
    /**
     * Run a portfolio audit. Pro status is determined SERVER-SIDE from the
     * authenticated user's subscription — never trusted from the client.
     * Rate limited per IP (anon), per user (free), and generously for Pro.
     */
    run: publicProcedure
      .input(
        z.object({
          url: z.string().min(3).max(2_048),
          role: z.string().trim().min(1).max(160).default("Creative"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const isPro = db.isUserPro(ctx.user);

        enforce(ctx.req, ctx.user, isPro, "audit", {
          anonLimit: 2, // anonymous: 2 audits / hour / IP
          freeLimit: 5, // signed-in free: 5 / hour
          proLimit: 60, // pro: effectively unlimited for real use
          windowMs: 60 * 60_000,
        });

        const report = await runPortfolioAudit({ ...input, isPro });

        // Persist, linking to the user when signed in.
        try {
          await db.createAudit({
            userId: ctx.user?.id ?? null,
            url: report.url,
            role: report.role,
            overall: report.overall,
            overallGrade: report.overallGrade,
            scores: report.categories.map(({ key, score, grade, premium }) => ({ key, score, grade, premium })),
            insights: report.topFixes,
            report,
            isPro,
          });
        } catch (error) {
          console.warn("[Audit] Failed to persist completed report", error);
        }

        return report;
      }),

    /** A signed-in user's saved audit history (most recent first). */
    history: protectedProcedure.query(async ({ ctx }) => {
      const rows = await db.getAuditsForUser(ctx.user.id);
      return rows.map((row) => ({
        id: row.id,
        url: row.url,
        role: row.role,
        overall: row.overall,
        overallGrade: row.overallGrade,
        isPro: row.isPro,
        createdAt: row.createdAt,
      }));
    }),

    /** Fetch one saved audit's full report (ownership enforced). */
    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const row = await db.getAuditByIdForUser(input.id, ctx.user.id);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Audit not found." });
        return row.report;
      }),
  }),

  billing: router({
    /** Start a Stripe Checkout session for Pro. Returns a hosted URL to redirect to. */
    createCheckout: protectedProcedure.mutation(async ({ ctx }) => {
      if (db.isUserPro(ctx.user)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You're already on Pro." });
      }
      return createCheckoutSession({
        clerkId: ctx.user.clerkId,
        email: ctx.user.email,
        existingCustomerId: ctx.user.stripeCustomerId,
      });
    }),

    /** Open the Stripe billing portal to manage/cancel a subscription. */
    createPortal: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user.stripeCustomerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No billing account yet." });
      }
      return createBillingPortalSession(ctx.user.stripeCustomerId);
    }),
  }),
});

export type AppRouter = typeof appRouter;
