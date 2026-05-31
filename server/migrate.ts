/**
 * Standalone migration runner invoked by Railway's start command
 * (`pnpm db:migrate`) before the server boots. Safe to run repeatedly —
 * drizzle tracks applied migrations in __drizzle_migrations.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { ENV } from "./_core/env";

async function run() {
  if (!ENV.databaseUrl) {
    console.warn("[Migrate] DATABASE_URL not set — skipping migrations.");
    return;
  }
  const connection = await mysql.createConnection({ uri: ENV.databaseUrl, multipleStatements: true });
  const db = drizzle(connection);
  console.log("[Migrate] Applying migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[Migrate] Done.");
  await connection.end();
}

run().catch((err) => {
  console.error("[Migrate] Failed:", err);
  process.exit(1);
});
