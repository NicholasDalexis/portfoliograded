import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
export interface StoreDocument { version: 2; audits: Record<string, unknown>; histories: Record<string, unknown>; submissions?: Record<string, unknown>; usageAttempts?: Record<string, unknown>; roleDemand?: Record<string, unknown>; quotas: Record<string, { start: number; count: number }>; }
/** Durable single-process preview store. Production requires one writer and a persistent volume. */
export class SecureStore {
  private state: StoreDocument | undefined;
  readonly file: string;
  constructor(directory: string) { this.file = path.join(directory, "portfolio-store-v2.json"); }
  read(): StoreDocument {
    if (!this.state) {
      if (existsSync(this.file)) {
        const parsed = JSON.parse(readFileSync(this.file, "utf8")) as StoreDocument;
        if (parsed.version !== 2 || !parsed.audits || !parsed.histories || !parsed.quotas) throw new Error("Unsupported portfolio store; refusing to overwrite it.");
        this.state = parsed;
      } else this.state = { version: 2, audits: {}, histories: {}, quotas: {} };
    }
    return this.state;
  }
  update<T>(change: (draft: StoreDocument) => T): T {
    const draft = structuredClone(this.read());
    const result = change(draft);
    mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.${randomBytes(8).toString("hex")}.tmp`;
    writeFileSync(temporary, JSON.stringify(draft), { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, this.file);
    this.state = draft;
    return result;
  }
}
export const secureStore = new SecureStore(process.env.PG_DATA_DIR || path.resolve(process.cwd(), "data"));
