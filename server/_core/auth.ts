/**
 * Clerk-based authentication for PortfolioGraded.
 *
 * The Clerk React frontend attaches a
 * short-lived session JWT as a Bearer token on every tRPC request; here we
 * verify it server-side, then lazily sync the Clerk user into our own MySQL
 * `users` table so the rest of the app can join audits to a local user id.
 */
import { createClerkClient, verifyToken } from "@clerk/backend";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const clerk = ENV.clerkSecretKey
  ? createClerkClient({ secretKey: ENV.clerkSecretKey })
  : null;

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  // Clerk also sets a __session cookie; fall back to it if present.
  const cookie = req.headers.cookie ?? "";
  const match = cookie.match(/__session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Verify the incoming request and return the matching local user, or null.
 * Never throws for unauthenticated requests — public procedures rely on null.
 */
export async function authenticateRequest(req: Request): Promise<User | null> {
  if (!clerk || !ENV.clerkSecretKey) return null;

  const token = bearerToken(req);
  if (!token) return null;

  let clerkUserId: string;
  try {
    const claims = await verifyToken(token, { secretKey: ENV.clerkSecretKey });
    clerkUserId = claims.sub;
  } catch {
    return null;
  }
  if (!clerkUserId) return null;

  // Fast path: already synced.
  const existing = await db.getUserByClerkId(clerkUserId);
  if (existing) {
    // Touch lastSignedIn without blocking the request meaningfully.
    db.touchUser(clerkUserId).catch(() => {});
    return existing;
  }

  // First time we've seen this Clerk user — pull their profile and upsert.
  try {
    const profile = await clerk.users.getUser(clerkUserId);
    const primaryEmail =
      profile.emailAddresses.find(
        (e) => e.id === profile.primaryEmailAddressId,
      )?.emailAddress ?? profile.emailAddresses[0]?.emailAddress ?? null;

    const name =
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      profile.username ||
      null;

    const isOwner =
      ENV.ownerEmail.length > 0 &&
      primaryEmail?.toLowerCase() === ENV.ownerEmail.toLowerCase();

    await db.upsertUser({
      clerkId: clerkUserId,
      name,
      email: primaryEmail,
      role: isOwner ? "admin" : "user",
      lastSignedIn: new Date(),
    });

    return (await db.getUserByClerkId(clerkUserId)) ?? null;
  } catch (error) {
    console.error("[Auth] Failed to sync Clerk user:", error);
    return null;
  }
}
