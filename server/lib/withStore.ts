import { getDatabase } from "@netlify/database";
import { storeContext, usesNetlifyDatabase, type StoreScope } from "./storeContext.js";
import type { StoreDocument } from "./secureStore.js";

const MAX_BYTES = 32 * 1024 * 1024;
export function validateStore(value: unknown): StoreDocument {
  const state = value as StoreDocument;
  if (state?.version !== 2 || !state.audits || !state.histories || !state.quotas ||
      [state.audits, state.histories, state.quotas].some(x => typeof x !== "object" || Array.isArray(x)))
    throw new Error("invalid_storage_document");
  return state;
}
/** Short database operations only. Never hold the row lock across a crawl, model
 * call, authentication, or HTTP response. Existing report + history + claim
 * operations commit atomically; local development retains its private file. */
export async function withStore<T>(operation: () => T, writable = false): Promise<T> {
  if (!usesNetlifyDatabase()) return operation();
  if (storeContext.getStore()) throw new Error("nested_storage_transaction");
  const database = getDatabase();
  const client = await database.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '8s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const { rows } = await client.query(`SELECT document FROM portfolio_state WHERE id = 'primary'${writable ? " FOR UPDATE" : ""}`);
    if (rows.length !== 1) throw new Error("storage_not_initialized");
    const scope: StoreScope = { document: validateStore(rows[0].document), writable, changed: false };
    const result = storeContext.run(scope, operation);
    // Async callbacks could leak a snapshot or keep the transaction open.
    if (result && typeof (result as { then?: unknown }).then === "function") throw new Error("async_storage_callback");
    if (scope.changed) {
      const serialized = JSON.stringify(validateStore(scope.document));
      if (Buffer.byteLength(serialized) > MAX_BYTES) throw new Error("storage_capacity_reached");
      await client.query("UPDATE portfolio_state SET document = $1::jsonb, updated_at = now() WHERE id = 'primary'", [serialized]);
    }
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}
