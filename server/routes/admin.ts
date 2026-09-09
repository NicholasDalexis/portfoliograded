import { withStore } from "../lib/withStore.js";
import { usageStatus, flushUsage } from "../lib/usageRuntime.js";
import { requireSameOrigin } from "../lib/owner.js";
import type { RoleDemand } from "../lib/roleDemand.js";
import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../lib/firebaseAdmin.js";
import { isAdminUid } from "../lib/billingConfig.js";
import { secureStore } from "../lib/secureStore.js";
import type { StoredAudit } from "../lib/auditStore.js";
import type { UrlHistory } from "../lib/historyStore.js";
import type { Submission } from "../lib/submissions.js";
export const adminRouter = Router();
adminRouter.get("/submissions", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!isAdminUid((req as AuthedRequest).user?.uid)) {
        res.status(403).json({ error: "forbidden" });
        return;
    }
    try {
        const state = await withStore(() => secureStore.read());
        const builders = new Map((Object.values(state.histories) as UrlHistory[]).flatMap((history) => history.runs.map((run) => [run.id, run.builder] as const)));
        const audits = Object.values(state.audits) as StoredAudit[];
        const attempts = Object.values(state.submissions ?? {}) as Submission[];
        const indexedIds = new Set(attempts.map(record => record.auditId));
        const records: Submission[] = [...attempts, ...audits.filter(record => !indexedIds.has(record.id)).map(record => ({ id: record.id, auditId: record.id, url: record.url, role: record.role, builder: builders.get(record.id), createdAt: record.createdAt, status: "completed" as const }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 100));
        const offset = Math.max(0, Math.min(records.length, Math.floor(Number(req.query.offset) || 0)));
        const submissions = records.slice(offset, offset + limit).map(record => {
            const audit = record.auditId ? state.audits[record.auditId] as StoredAudit | undefined : undefined;
            return { id: record.id, url: record.url, role: record.role, appliedRubric: record.appliedRubric ?? null, builder: record.builder ?? null, createdAt: record.createdAt, status: record.status, reason: record.reason,
                overall: audit?.report.overall ?? null, grade: audit?.report.overallGrade ?? null, enrichment: audit?.report.verification?.aiEnrichment ?? "unknown" };
        });
        res.json({ submissions, total: records.length, nextOffset: offset + limit < records.length ? offset + limit : null });
    }
    catch {
        res.status(503).json({ error: "storage_unavailable" });
    }
});
// Read-only operational overview. No credentials, raw owner IDs or private feedback in the usage response.
adminRouter.get("/usage", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!isAdminUid((req as AuthedRequest).user?.uid)) {
        res.status(403).json({ error: "forbidden" });
        return;
    }
    try {
        res.json({ ...await usageStatus(), unsupportedRoleDemand: (Object.values((await withStore(() => secureStore.read())).roleDemand ?? {}) as RoleDemand[]).sort((a, b) => b.count - a.count) });
    }
    catch {
        res.status(503).json({ error: "usage_unavailable" });
    }
});
adminRouter.post("/usage/sweep", requireSameOrigin, requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!isAdminUid((req as AuthedRequest).user?.uid)) {
        res.status(403).json({ error: "forbidden" });
        return;
    }
    await flushUsage();
    try {
        res.json(await usageStatus());
    }
    catch {
        res.status(503).json({ error: "usage_unavailable" });
    }
});
