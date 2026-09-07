import { AccountPreferencesSchema, type AccountPreferences } from "@shared/accountPreferences";
import { auth } from "./firebase";

export class PreferenceRequestError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}
async function request(uid: string, input?: { marketingEmails: boolean; expectedRevision: number }): Promise<AccountPreferences> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new PreferenceRequestError("Sign in again to manage your email preference.", "account_changed");
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== uid) throw new PreferenceRequestError("Your account changed. Open email preferences again.", "account_changed");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("/api/account/preferences", { method: input ? "PUT" : "GET", signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...(input ? { "Content-Type": "application/json" } : {}) },
      ...(input ? { body: JSON.stringify(input) } : {}) });
    if (auth.currentUser?.uid !== uid) throw new PreferenceRequestError("Your account changed. Open email preferences again.", "account_changed");
    const data = await res.json();
    if (!res.ok) throw new PreferenceRequestError(typeof data.reason === "string" ? data.reason : "Your email preference could not be saved.", typeof data.error === "string" ? data.error : "request_failed");
    return AccountPreferencesSchema.parse(data);
  } finally { window.clearTimeout(timeout); }
}
export const loadAccountPreferences = (uid: string) => request(uid);
export const saveAccountPreferences = (uid: string, marketingEmails: boolean, expectedRevision: number) => request(uid, { marketingEmails, expectedRevision });
