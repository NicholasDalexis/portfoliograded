import { AsyncLocalStorage } from "node:async_hooks";
import type { StoreDocument } from "./secureStore.js";

export interface StoreScope { document: StoreDocument; writable: boolean; changed: boolean; }
export const storeContext = new AsyncLocalStorage<StoreScope>();
export const usesNetlifyDatabase = () => process.env.PG_STORAGE === "netlify-db";
export function currentStoreScope(): StoreScope | undefined {
  const scope = storeContext.getStore();
  if (usesNetlifyDatabase() && !scope) throw new Error("storage_operation_requires_transaction");
  return scope;
}
