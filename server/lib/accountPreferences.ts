import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { MARKETING_SCOPE, MARKETING_CONSENT_TEXT } from "../../shared/accountPreferences.js";

import { currentStoreScope } from "./storeContext.js";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ACCOUNTS = 10_000;
const RecordSchema = z.object({
  marketingEmails: z.boolean(), revision: z.number().int().positive(),
  updatedAt: z.string().datetime(), scope: z.literal(MARKETING_SCOPE),
  consentText: z.literal(MARKETING_CONSENT_TEXT), source: z.literal("account-preferences"),
  email: z.string().email().max(254).nullable(),
  optedInAt: z.string().datetime().nullable(), withdrawnAt: z.string().datetime().nullable(),
}).strict().refine((record) => !record.marketingEmails || (record.email !== null && record.optedInAt !== null));
const DocumentSchema = z.object({ version: z.literal(1), accounts: z.record(z.string().regex(/^[a-f0-9]{64}$/), RecordSchema) }).strict();
export type MarketingRecord = z.infer<typeof RecordSchema>;
export class PreferenceConflict extends Error {}

/** One process/writer, a persistent PG_DATA_DIR, no mailing-list or showcase side effects. */
export class AccountPreferenceStore {
  readonly file: string;
  private state: z.infer<typeof DocumentSchema> | undefined;
  constructor(directory: string) { this.file = path.join(directory, "account-preferences-v1.json"); }
  private key(uid: string): string {
    if (!uid || uid.length > 128 || /[\u0000-\u001f\u007f]/.test(uid)) throw new Error("Invalid account");
    return createHash("sha256").update(uid).digest("hex");
  }
  private read() {
    const scope = currentStoreScope();
    if (scope) return DocumentSchema.parse(scope.document.accountPreferences ?? { version: 1, accounts: {} });
    if (!this.state) {
      if (!existsSync(this.file)) this.state = { version: 1, accounts: {} };
      else {
        if (statSync(this.file).size > MAX_BYTES) throw new Error("Preference store exceeds its limit");
        const parsed = DocumentSchema.parse(JSON.parse(readFileSync(this.file, "utf8")));
        if (Object.keys(parsed.accounts).length > MAX_ACCOUNTS) throw new Error("Preference store exceeds its account limit");
        this.state = parsed;
      }
    }
    return this.state;
  }
  get(uid: string): MarketingRecord | null {
    const record = this.read().accounts[this.key(uid)];
    return record ? structuredClone(record) : null;
  }
  set(uid: string, enabled: boolean, expectedRevision: number, verifiedEmail?: string): MarketingRecord | null {
    const key = this.key(uid);
    const current = this.get(uid);
    if (expectedRevision !== (current?.revision ?? 0)) throw new PreferenceConflict("Preference changed in another session");
    if (enabled && (!verifiedEmail || !z.string().email().max(254).safeParse(verifiedEmail).success)) throw new Error("A verified email is required");
    if (!enabled && !current) return null;
    if (current?.marketingEmails === enabled && (!enabled || current.email === verifiedEmail)) return current;
    const draft = structuredClone(this.read());
    if (!current && Object.keys(draft.accounts).length >= MAX_ACCOUNTS) throw new Error("Preference storage is full");
    const now = new Date().toISOString();
    const record: MarketingRecord = {
      marketingEmails: enabled, revision: (current?.revision ?? 0) + 1, updatedAt: now,
      scope: MARKETING_SCOPE, consentText: MARKETING_CONSENT_TEXT, source: "account-preferences",
      // Withdrawals retain the preference record while removing its mailing address.
      email: enabled ? verifiedEmail! : null,
      optedInAt: enabled ? now : current?.optedInAt ?? null,
      withdrawnAt: enabled ? current?.withdrawnAt ?? null : now,
    };
    draft.accounts[key] = record;
    const serialized = JSON.stringify(draft);
    if (Buffer.byteLength(serialized, "utf8") > MAX_BYTES) throw new Error("Preference storage is full");
    const scope = currentStoreScope();
    if (scope) {
      if (!scope.writable) throw new Error("read_only_storage_operation");
      scope.document.accountPreferences = draft; scope.changed = true;
      return structuredClone(record);
    }
    mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temp = `${this.file}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      writeFileSync(temp, serialized, { encoding: "utf8", mode: 0o600 });
      renameSync(temp, this.file);
    } finally { if (existsSync(temp)) rmSync(temp); }
    this.state = draft;
    return structuredClone(record);
  }
}
export const accountPreferenceStore = new AccountPreferenceStore(process.env.PG_DATA_DIR || path.resolve(process.cwd(), "data"));
