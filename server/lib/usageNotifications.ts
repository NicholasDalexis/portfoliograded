import { createHash } from "node:crypto";
import type { UsageMilestone, UsageTotals } from "./usageLedger.js";
function costs(t: UsageTotals): string {
  const model = Object.values(t.models).reduce((sum, value) => sum + value.estimatedUsd, 0);
  const unknown = Object.values(t.models).reduce((sum, value) => sum + value.unpricedCalls, 0);
  return `Model: $${model.toFixed(4)} estimated priced portion${unknown ? `; ${unknown} calls unpriced` : ""}. Browser: $${t.browserEstimatedUsd.toFixed(4)} estimated priced portion${t.unpricedBrowserCalls ? `; ${t.unpricedBrowserCalls} calls unpriced` : ""}.`;
}
/** Aggregate content only. No report URL, owner identifier, role free text or feedback. */
export function milestoneMessage(item: UsageMilestone): string {
  const t = item.period;
  const models = Object.values(t.models).map(m => `${m.provider}/${m.model}: ${m.calls} calls, ${m.input} input + ${m.output} output + ${m.cacheRead} cache-read + ${m.cacheWrite} cache-write tokens${m.missingUsage ? `; ${m.missingUsage} calls with unavailable usage` : ""}${m.blocked ? `; ${m.blocked} blocked before sending` : ""}`).join("\n") || "No model calls recorded.";
  return `Portfolio Graded: ${item.threshold} completed new assessments since activation.\nActivity included in this batch: ${item.from} to ${item.to}. Late recovered activity can overlap earlier date ranges.\nNew accepted reviews: ${t.completed}. Signed-in: ${t.accountReviews}; anonymous: ${t.anonymousReviews}. Unique reviewing accounts in this period: ${t.uniqueAccounts}.\nReused assessments: ${t.reused}; previous results preserved after incomplete checks: ${t.preserved}; partial previews: ${t.partial}; failed attempts: ${t.failed}; helper requests: ${t.helper}.\nBrowser work: ${(t.browserMs / 1000).toFixed(1)} seconds across ${t.browserCalls} calls (${t.browserFailures} failed).\n${models}\nRelease counts: ${JSON.stringify(t.releases)}. Methods: ${JSON.stringify(t.methods)}.\nPeriod cost: ${costs(t)}\n${item.month} month-to-date as recorded at this milestone: ${costs(item.monthToDate)}\nCosts are estimates from measured tokens/duration and configured rate versions, not invoices. Unavailable token usage, unconfigured rates, hosting, database, storage, auth, taxes and fixed plans are excluded. Failed attempts are included when metered. Saved-result opens and login events are not measured here. Milestone ID: ${item.id}`;
}
export function slackMilestoneSender(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): ((item: UsageMilestone) => Promise<string>) | undefined {
  if (!env.PG_USAGE_SLACK_BOT_TOKEN || !env.PG_USAGE_SLACK_CHANNEL_ID || env.PG_USAGE_SLACK_DESTINATION_VERIFIED !== "true") return undefined;
  if (!/^[CDG][A-Z0-9]{8,30}$/.test(env.PG_USAGE_SLACK_CHANNEL_ID)) throw new Error("invalid_usage_destination");
  const token = env.PG_USAGE_SLACK_BOT_TOKEN;
  const channel = env.PG_USAGE_SLACK_CHANNEL_ID;
  return async item => {
    const hash = createHash("sha256").update(item.id).digest("hex");
    const clientMsgId = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
    const response = await fetcher("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel, text: milestoneMessage(item), mrkdwn: false, unfurl_links: false, unfurl_media: false, client_msg_id: clientMsgId }), signal: AbortSignal.timeout(20_000) });
    const body = await response.json().catch(() => null) as { ok?: boolean; ts?: string; channel?: string } | null;
    if (!response.ok || body?.ok !== true || body.channel !== channel || typeof body.ts !== "string") throw new Error("delivery_unconfirmed");
    return `${channel}:${body.ts}`;
  };
}
