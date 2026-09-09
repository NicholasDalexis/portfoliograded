import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import type { AuditReport } from '@shared/audit.js';
import { RUBRIC_VERSION } from '@shared/rubrics.js';
const sql = vi.hoisted(() => ({ document: {} as any, writes: 0 }));
vi.mock('@netlify/database', () => ({ getDatabase: () => ({ pool: { connect: async () => ({
  query: async (query: string, params?: string[]) => {
    if (query.startsWith('SELECT')) return { rows: [{ document: structuredClone(sql.document) }] };
    if (query.startsWith('UPDATE')) { sql.document = JSON.parse(params![0]); sql.writes++; }
    return { rows: [] };
  }, release() {}
}) } }) }));
vi.mock('@server/lib/firebaseAdmin.js', () => ({
  optionalAuth: (req: any, _res: any, next: () => void) => { req.user = { uid: req.headers['x-test-owner'] || 'alice', emailVerified: true, provider: 'google.com' }; next(); },
  isFreeFeedbackAccount: () => true, db: () => null
}));
vi.mock('@server/lib/entitlements.js', () => ({ isEntitled: async () => false }));
import { createAuditsRouter } from '@server/routes/audits.js';
import { historyRouter } from '@server/routes/history.js';
import { adaptApp } from '@server/lib/netlifyAdapter.js';
const keys = ['first_impression','narrative','case_studies','visual_craft','performance','mobile','accessibility','seo_discoverability','conversion'] as const;
const source = () => ({ version:1 as const,capturedAt:'2026-09-06T00:00:00.000Z',desktop:{finalUrl:'https://example.org/',sha256:'a'.repeat(64)},mobile:{finalUrl:'https://example.org/',sha256:'b'.repeat(64)} });
function report(options: { deep?: boolean; baseline?: boolean; gradeS?: boolean } = {}): AuditReport {
 return {url:'https://example.org/',role:'Photography',generatedAt:'2026-09-06T00:00:00.000Z',overall:95,overallGrade:options.gradeS?'S':'A+',headline:'Fixture report',subhead:'Synthetic observations',bounceEstimate:0,bounceTarget:0,loadDesktopMs:0,loadMobileMs:0,
  categories:keys.map((key,index)=>({key,title:key,blurb:'Fixture',score:95,grade:options.gradeS?'S':'A+',premium:index>=6,details:[{label:'Observed source',status:'pass',note:`Evidence ${key}`}],recommendation:`Fix ${key}`,recruiterNote:'PRIVATE_DEEP_NOTE'})),
  topFixes:[{title:'Specific initial fix',description:'Keep this useful initial guidance',impact:'High',premium:true}],
  verification:{mode:'homepage-html',rubricKey:'photography',rubricVersion:RUBRIC_VERSION,pageCount:1,pages:[],visualReview:false,mobileLayoutReviewed:false,performanceMeasured:false,deepReviewVerified:Boolean(options.deep),aiEnrichment:'not-configured',limitations:[]},
  ...(options.baseline===false?{}:{sourceSnapshot:source()})};
}

beforeEach(() => {
  vi.stubEnv('PG_STORAGE', 'netlify-db'); vi.stubEnv('PG_USAGE_ENABLED', 'false');
  sql.document = { version: 2, audits: {}, histories: {}, quotas: {} }; sql.writes = 0;
});
afterEach(() => vi.unstubAllEnvs());
it('saves and returns a report, reopens private history, and persists a checked fix in database mode', async () => {
  const app = express(); app.use(express.json());
  const runner = vi.fn(async () => report());
  app.use('/api/audits', createAuditsRouter(runner, async () => false));
  app.use('/api/history', historyRouter);
  const handle = adaptApp(app);
  const call = (path: string, body?: unknown, owner = 'alice') => handle(new Request('https://preview.example' + path, {
    method: body ? 'POST' : 'GET', headers: { origin: 'https://preview.example', 'content-type': 'application/json', 'x-test-owner': owner },
    ...(body ? { body: JSON.stringify(body) } : {})
  }), '198.51.100.8');
  const created = await call('/api/audits', { url: 'https://example.org/', role: 'Photography' });
  expect(created.status).toBe(201);
  const payload = await created.json(); expect(payload.history.runs).toHaveLength(1);
  expect(Object.keys(sql.document.audits)).toEqual([payload.id]);
  const query = '/api/history?url=https%3A%2F%2Fexample.org%2F&role=Photography';
  const history = await call(query); expect(history.status).toBe(200);
  const saved = await history.json(); const id = Object.keys(saved.suggestions)[0];
  expect((await call('/api/audits/' + payload.id, undefined, 'bob')).status).toBe(404);
  expect(await (await call(query, undefined, 'bob')).json()).toBeNull();
  const updated = await call('/api/history/toggle', { url: 'https://example.org/', role: 'Photography', id, done: true });
  expect(updated.status).toBe(200); expect((await updated.json()).done).toBe(true);
  expect((await (await call(query)).json()).suggestions[id].done).toBe(true);
  expect(runner).toHaveBeenCalledOnce(); expect(sql.writes).toBeGreaterThan(0);
});
