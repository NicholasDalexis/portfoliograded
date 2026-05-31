/**
 * Client-side mirror of the audit report types produced by the server
 * (server/auditEngine.ts). Kept as a thin re-export so the UI shares the exact
 * shapes the API returns.
 */
export type {
  GradeLetter,
  CategoryKey,
  InsightDetail,
  CategoryScore,
  AuditReport,
} from "../../../server/auditEngine";
