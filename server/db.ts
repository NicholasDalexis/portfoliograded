import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { audits, InsertAudit, InsertUser, User, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Lazily create a pooled drizzle instance. Using a mysql2 pool (instead of a
 * single connection) is important on Railway where idle connections get
 * recycled — the pool transparently reconnects.
 */
export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      // Pass the connection string directly; drizzle's mysql2 driver creates
      // and manages a pool internally, which avoids promise/callback Pool type
      // clashes and reconnects transparently on Railway.
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/* ----------------------------- Users ----------------------------- */

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.clerkId) throw new Error("User clerkId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { clerkId: user.clerkId };
  const updateSet: Record<string, unknown> = {};

  const assign = <K extends keyof InsertUser>(field: K) => {
    if (user[field] === undefined) return;
    const normalized = (user[field] ?? null) as InsertUser[K];
    values[field] = normalized;
    updateSet[field as string] = normalized;
  };

  (["name", "email", "role", "stripeCustomerId", "stripeSubscriptionId", "subscriptionStatus", "proExpiresAt", "lastSignedIn"] as const).forEach(assign);

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByClerkId(clerkId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return result[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
  return result[0];
}

export async function touchUser(clerkId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.clerkId, clerkId));
}

/** Update subscription columns from a Stripe webhook event. */
export async function updateUserSubscription(
  clerkId: string,
  fields: Partial<Pick<User, "stripeCustomerId" | "stripeSubscriptionId" | "subscriptionStatus" | "proExpiresAt">>,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(fields).where(eq(users.clerkId, clerkId));
}

/** True if the user currently has an active, unexpired Pro subscription. */
export function isUserPro(user: User | null | undefined): boolean {
  if (!user) return false;
  const statusOk = user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";
  if (!statusOk) return false;
  if (!user.proExpiresAt) return true; // active with no explicit end
  return user.proExpiresAt.getTime() > Date.now();
}

/* ----------------------------- Audits ----------------------------- */

export async function createAudit(values: InsertAudit) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create audit: database not available");
    return undefined;
  }
  const result = await db.insert(audits).values(values).$returningId();
  return result[0];
}

export async function getAuditsForUser(userId: number, limit = 25) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(audits)
    .where(eq(audits.userId, userId))
    .orderBy(desc(audits.createdAt))
    .limit(limit);
}

export async function getAuditByIdForUser(auditId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(audits)
    .where(and(eq(audits.id, auditId), eq(audits.userId, userId)))
    .limit(1);
  return result[0];
}
