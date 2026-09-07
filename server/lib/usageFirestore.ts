import type { Firestore } from "firebase-admin/firestore";
import type { UsageRepository, UsageTransaction } from "./usageLedger.js";
/** Server SDK only. Client Firestore rules must deny this entire namespace. */
export function firestoreUsageRepository(db: Firestore, activationId: string): UsageRepository {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(activationId)) throw new Error("invalid_usage_namespace");
  const root = db.collection("portfolioUsage").doc(activationId);
  return {
    transaction: work => db.runTransaction(async transaction => {
      const adapter: UsageTransaction = {
        get: async <T>(key: string) => { const snapshot = await transaction.get(root.collection(key.split("/")[0]!).doc(key.split("/")[1]!)); return snapshot.exists ? snapshot.data() as T : undefined; },
        set: (key, value) => { transaction.set(root.collection(key.split("/")[0]!).doc(key.split("/")[1]!), JSON.parse(JSON.stringify(value))); },
      };
      return work(adapter);
    }),
    due: async (now, limit) => (await root.collection("outbox").where("availableAt", "<=", now).orderBy("availableAt").limit(limit).get()).docs.map(doc => `outbox/${doc.id}`),
  };
}
