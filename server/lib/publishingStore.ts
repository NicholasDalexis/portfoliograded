import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { exportPortfolioHTML, validatePortfolioDraft, MAX_DRAFT_BYTES, type PortfolioDraft } from "../../shared/portfolio.js";

export const RESERVED_PORTFOLIO_SLUGS = new Set(["www", "app", "api", "admin", "auth", "login", "logout", "signin", "signup", "register", "account", "accounts", "billing", "checkout", "pay", "pricing", "help", "support", "contact", "security", "privacy", "terms", "status", "healthz", "preview", "portfolio", "portfolios", "portfoliograded", "portfolio-graded", "mail", "email", "smtp", "imap", "pop", "pop3", "webmail", "ftp", "sftp", "ssh", "cdn", "assets", "static", "images", "image", "media", "blog", "docs", "dev", "test", "staging", "production", "internal", "localhost", "system", "root", "constructor", "prototype"]);
export class PublishingError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) { super(message); this.name = "PublishingError"; }
}
export function normalizePortfolioSlug(input: unknown): string {
  if (typeof input !== "string") throw new PublishingError("invalid_slug", 400, "Choose a name with 3 to 40 letters, numbers, or single hyphens.");
  const slug = input.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 40 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new PublishingError("invalid_slug", 400, "Use 3 to 40 letters, numbers, or single hyphens, with no spaces or edge hyphens.");
  if (RESERVED_PORTFOLIO_SLUGS.has(slug)) throw new PublishingError("reserved_slug", 409, "That address is reserved. Choose another name.");
  return slug;
}
const snapshotId = z.string().regex(/^[a-f0-9]{36}$/);
const version = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const snapshotReference = z.strictObject({ id: snapshotId, version, publishedAt: z.iso.datetime() });
const recordSchema = z.strictObject({
  slug: z.string().min(3).max(40), ownerId: z.string().min(1).max(300), version,
  status: z.enum(["published", "unpublished"]), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
  currentSnapshotId: snapshotId.nullable(), snapshots: z.array(snapshotReference).min(1).max(200),
});
const indexSchema = z.strictObject({ version: z.literal(1), records: z.record(z.string(), recordSchema) });
export type PublicationRecord = z.infer<typeof recordSchema>;
type PublicationIndex = z.infer<typeof indexSchema>;
export interface PublicationSnapshot { version: 1; snapshotId: string; slug: string; ownerId: string; publishedAt: string; draft: PortfolioDraft; }

/** A separate local-only, single-writer store; never writes the report/Firestore store. */
export class LocalPublishingStore {
  readonly indexFile: string;
  readonly snapshotsDirectory: string;
  constructor(readonly directory: string) { this.indexFile = path.join(directory, "publication-index-v1.json"); this.snapshotsDirectory = path.join(directory, "snapshots"); }
  private read(): PublicationIndex {
    if (!existsSync(this.indexFile)) return { version: 1, records: {} };
    if (statSync(this.indexFile).size > 512 * 1024) throw new Error("Publication index exceeds its storage limit.");
    const parsed = indexSchema.parse(JSON.parse(readFileSync(this.indexFile, "utf8")));
    if (Object.keys(parsed.records).length > 200) throw new Error("Too many publication records.");
    for (const [key, record] of Object.entries(parsed.records)) {
      if (normalizePortfolioSlug(key) !== key || record.slug !== key || (record.status === "published") !== Boolean(record.currentSnapshotId)) throw new Error("Invalid publication index.");
      if (record.currentSnapshotId && !record.snapshots.some(item => item.id === record.currentSnapshotId)) throw new Error("Invalid snapshot reference.");
    }
    return parsed;
  }
  private commit(index: PublicationIndex): void {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const temporary = `${this.indexFile}.${randomBytes(8).toString("hex")}.tmp`;
    writeFileSync(temporary, JSON.stringify(index), { encoding: "utf8", mode: 0o600, flag: "wx" });
    renameSync(temporary, this.indexFile);
  }
  availability(input: string, ownerId: string) {
    const slug = normalizePortfolioSlug(input), record = this.read().records[slug];
    return { slug, available: !record, ownedByYou: record?.ownerId === ownerId, reserved: false, scope: "local-machine" as const };
  }
  list(ownerId: string): PublicationRecord[] { return Object.values(this.read().records).filter(record => record.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  owned(input: string, ownerId: string): PublicationRecord | null { const record = this.read().records[normalizePortfolioSlug(input)]; return record?.ownerId === ownerId ? record : null; }
  publish(input: { slug: string; ownerId: string; draft: unknown; expectedVersion?: number }): PublicationRecord {
    const slug = normalizePortfolioSlug(input.slug), draft = validatePortfolioDraft(input.draft);
    if (!draft.name.trim() || !draft.headline.trim()) throw new PublishingError("incomplete_identity", 400, "Add your name and a short headline before publishing.");
    const html = exportPortfolioHTML(draft), index = this.read(), previous = index.records[slug];
    if (previous && previous.ownerId !== input.ownerId) throw new PublishingError("slug_unavailable", 409, "That address belongs to another portfolio. Choose another name.");
    if ((!previous && input.expectedVersion !== undefined && input.expectedVersion !== 0) || (previous && previous.version !== input.expectedVersion)) throw new PublishingError("publication_conflict", 409, "This publication changed. Refresh its saved status before publishing again.");
    if (!previous && this.list(input.ownerId).length >= 10) throw new PublishingError("publication_limit", 409, "This local account already has ten reserved addresses.");
    if ((!previous && Object.keys(index.records).length >= 200) || Object.values(index.records).reduce((sum, record) => sum + record.snapshots.length, 0) >= 200) throw new PublishingError("snapshot_limit", 409, "The local publishing snapshot limit has been reached.");
    const now = new Date().toISOString(), id = randomBytes(18).toString("hex"), nextVersion = (previous?.version ?? 0) + 1;
    const snapshot: PublicationSnapshot = { version: 1, snapshotId: id, slug, ownerId: input.ownerId, publishedAt: now, draft };
    const json = JSON.stringify(snapshot);
    if (Buffer.byteLength(json) > MAX_DRAFT_BYTES + 4096 || Buffer.byteLength(html) > MAX_DRAFT_BYTES + 512 * 1024) throw new PublishingError("snapshot_too_large", 413, "Reduce the portfolio's image sizes before publishing.");
    mkdirSync(this.snapshotsDirectory, { recursive: true, mode: 0o700 });
    // Immutable files are written before the index pointer changes. A failed write
    // cannot replace the current publication; unreferenced files stay private.
    writeFileSync(path.join(this.snapshotsDirectory, `${id}.json`), json, { encoding: "utf8", mode: 0o600, flag: "wx" });
    writeFileSync(path.join(this.snapshotsDirectory, `${id}.html`), html, { encoding: "utf8", mode: 0o600, flag: "wx" });
    const record: PublicationRecord = { slug, ownerId: input.ownerId, version: nextVersion, status: "published", createdAt: previous?.createdAt ?? now, updatedAt: now, currentSnapshotId: id, snapshots: [...(previous?.snapshots ?? []), { id, version: nextVersion, publishedAt: now }] };
    index.records[slug] = record; this.commit(index); return record;
  }
  unpublish(input: { slug: string; ownerId: string; expectedVersion: number }): PublicationRecord {
    const slug = normalizePortfolioSlug(input.slug), index = this.read(), record = index.records[slug];
    if (!record || record.ownerId !== input.ownerId) throw new PublishingError("not_found", 404, "This publication was not found.");
    if (record.version !== input.expectedVersion) throw new PublishingError("publication_conflict", 409, "This publication changed. Refresh its saved status first.");
    if (record.status === "unpublished") return record;
    record.status = "unpublished"; record.currentSnapshotId = null; record.version++; record.updatedAt = new Date().toISOString(); this.commit(index); return record;
  }
  currentHTML(input: string): { html: string; record: PublicationRecord } | null {
    const record = this.read().records[normalizePortfolioSlug(input)];
    if (!record?.currentSnapshotId || record.status !== "published") return null;
    const file = path.join(this.snapshotsDirectory, `${record.currentSnapshotId}.html`);
    if (statSync(file).size > MAX_DRAFT_BYTES + 512 * 1024) throw new Error("Invalid HTML snapshot.");
    return { html: readFileSync(file, "utf8"), record };
  }
  latestDraft(record: PublicationRecord): PortfolioDraft {
    const last = record.snapshots.at(-1)!;
    const file = path.join(this.snapshotsDirectory, `${last.id}.json`);
    if (statSync(file).size > MAX_DRAFT_BYTES + 4096) throw new Error("Invalid draft snapshot.");
    const data = JSON.parse(readFileSync(file, "utf8")) as PublicationSnapshot;
    if (data.version !== 1 || data.snapshotId !== last.id || data.ownerId !== record.ownerId || data.slug !== record.slug) throw new Error("Invalid draft snapshot.");
    return validatePortfolioDraft(data.draft);
  }
}
