import { boolean, index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing the Clerk auth flow.
 * `clerkId` is the stable Clerk user id (e.g. "user_2abc..."). We keep our own
 * row so audits and subscriptions can foreign-key to a local numeric id.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Clerk user id returned from session verification. Unique per user. */
  clerkId: varchar("clerkId", { length: 191 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),

  // Stripe / Pro subscription state
  stripeCustomerId: varchar("stripeCustomerId", { length: 191 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 191 }),
  /** "active" | "trialing" | "past_due" | "canceled" | null */
  subscriptionStatus: varchar("subscriptionStatus", { length: 32 }),
  /** When the current paid period ends; used to gate Pro access. */
  proExpiresAt: timestamp("proExpiresAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const audits = mysqlTable(
  "audits",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Nullable FK: anonymous audits leave this null; signed-in users get their history linked. */
    userId: int("userId"),
    url: text("url").notNull(),
    role: varchar("role", { length: 160 }).notNull(),
    overall: int("overall").notNull(),
    overallGrade: varchar("overallGrade", { length: 8 }).notNull(),
    scores: json("scores").$type<unknown>().notNull(),
    insights: json("insights").$type<unknown>().notNull(),
    report: json("report").$type<unknown>().notNull(),
    isPro: boolean("isPro").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("audits_userId_idx").on(table.userId),
  }),
);

export type Audit = typeof audits.$inferSelect;
export type InsertAudit = typeof audits.$inferInsert;
