vi.mock("@server/lib/shotArchive.js", () => ({ getPortableArchivedShot: mocks.archive }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { createHash } from "node:crypto";
import type { AuditReport } from "@shared/audit.js";

const mocks = vi.hoisted(() => ({ publicFetch: vi.fn(), llm: vi.fn(), archive: vi.fn() }));
vi.mock("@server/lib/firebaseAdmin.js", () => ({ optionalAuth: (req: any, res: any, next: () => void) => {
  if (req.headers.authorization === "Bearer verified-alice") req.user = { uid: "alice", emailVerified: true, provider: "google.com" };
  else if (req.headers.authorization === "Bearer verified-bob") req.user = { uid: "bob", emailVerified: true, provider: "google.com" };
  else if (req.headers.authorization) { res.status(401).json({error:"invalid_auth"}); return; }
  next();
}, isFreeFeedbackAccount: (user: any) => Boolean(user?.emailVerified === true && user?.provider === "google.com") }));
vi.mock("@server/lib/entitlements.js", () => ({ isEntitled: () => { throw new Error("Real entitlement provider prohibited in regression"); } }));
vi.mock("@server/lib/anthropic.js", () => ({ invokeClaudeJSON: mocks.llm, llmConfigured: () => false }));
vi.mock("@server/lib/screenshot.js", () => ({ getArchivedShot: mocks.archive, chromeAvailable: () => false, captureAndStore: () => { throw new Error("Real capture prohibited in API regression"); } }));
vi.mock("@server/lib/publicNetwork.js", async importActual => ({ ...await importActual<any>(), publicFetch: mocks.publicFetch, resolvePublic: vi.fn().mockResolvedValue({address:"93.184.216.34",family:4}) }));
const { createAuditsRouter } = await import("@server/routes/audits.js");
const { createAudit, getAudit } = await import("@server/lib/auditStore.js");
const { secureStore } = await import("@server/lib/secureStore.js");
const { getHistory, recordAudit, toggleSuggestion, historyKey } = await import("@server/lib/historyStore.js");
const { redactReport, LOCKED } = await import("@server/lib/reportAccess.js");
const { readHomepageSource } = await import("@server/lib/auditEngine.js");
const { fingerprintSource, sameHomepageSource } = await import("@server/lib/sourceFingerprint.js");
const { RUBRIC_VERSION } = await import("@shared/rubrics.js");
const keys = ['first_impression','narrative','case_studies','visual_craft','performance','mobile','accessibility','seo_discoverability','conversion'] as const;
const source = () => ({ version:1 as const,capturedAt:'2026-09-06T00:00:00.000Z',desktop:{finalUrl:'https://example.org/',sha256:'a'.repeat(64)},mobile:{finalUrl:'https://example.org/',sha256:'b'.repeat(64)} });
function report(options: { deep?: boolean; baseline?: boolean; gradeS?: boolean } = {}): AuditReport {
 return {url:'https://example.org/',role:'Photography',generatedAt:'2026-09-06T00:00:00.000Z',overall:95,overallGrade:options.gradeS?'S':'A+',headline:'Fixture report',subhead:'Synthetic observations',bounceEstimate:0,bounceTarget:0,loadDesktopMs:0,loadMobileMs:0,
  categories:keys.map((key,index)=>({key,title:key,blurb:'Fixture',score:95,grade:options.gradeS?'S':'A+',premium:index>=6,details:[{label:'Observed source',status:'pass',note:`Evidence ${key}`}],recommendation:`Fix ${key}`,recruiterNote:'PRIVATE_DEEP_NOTE'})),
  topFixes:[{title:'Specific initial fix',description:'Keep this useful initial guidance',impact:'High',premium:true}],
  verification:{mode:'homepage-html',rubricKey:'photography',rubricVersion:RUBRIC_VERSION,pageCount:1,pages:[],visualReview:false,mobileLayoutReviewed:false,performanceMeasured:false,deepReviewVerified:Boolean(options.deep),aiEnrichment:'not-configured',limitations:[]},
  ...(options.baseline===false?{}:{sourceSnapshot:source()})};
}
const alice={Authorization:'Bearer verified-alice'},bob={Authorization:'Bearer verified-bob'};
const servers:Server[]=[];
async function harness(sourceReader=vi.fn(async()=>source()), runner=vi.fn(async()=>report()), entitled=false) {
 const app=express(), server=app.listen(0,'127.0.0.1');servers.push(server);
 await new Promise<void>(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 app.use('/api/audits',express.json({limit:'48kb'}),createAuditsRouter(runner,async()=>entitled,sourceReader));
 const get=(route:string,headers:Record<string,string>=alice)=>fetch(base+'/api/audits'+route,{headers});
 const post=(route:string,headers:Record<string,string>=alice,body:unknown={})=>fetch(base+'/api/audits'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...headers},body:JSON.stringify(body)});
 return {get,post,sourceReader,runner,base};
}
const seed=(ownerId='user:alice',value=report())=>createAudit({ownerId,url:value.url,role:value.role,pro:false,report:value});
beforeEach(()=>{
 secureStore.update(state=>{state.audits={};state.histories={};state.quotas={};state.submissions={};});
 mocks.publicFetch.mockReset();mocks.llm.mockReset();mocks.archive.mockReset();
 mocks.llm.mockImplementation(()=>{throw new Error('Paid model calls prohibited');});
});
afterEach(async()=>{for(const server of servers.splice(0)){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}});

describe('private saved-report library and source-check API',()=>{
 it('lists and retrieves only the verified owner, without raw fingerprints or owner IDs',async()=>{
  const own=seed(),other=seed('user:bob');const h=await harness();
  const response=await h.get('/');expect(response.headers.get('cache-control')).toContain('no-store');
  const value=await response.json();expect(value.reports.map((x:any)=>x.id)).toEqual([own.id]);
  expect(JSON.stringify(value)).not.toContain('ownerId');expect(JSON.stringify(value)).not.toContain('sha256');
  expect((await h.get('/'+other.id)).status).toBe(404);
  const read=await(await h.get('/'+own.id)).json();expect(read.report.sourceSnapshot).toBeUndefined();
  expect(h.runner).not.toHaveBeenCalled();expect(h.sourceReader).not.toHaveBeenCalled();expect(secureStore.read().quotas).toEqual({});
 });
 it('retains signed-device access with private cookie scope and denies another visitor',async()=>{
  const token='V'.repeat(43),other='W'.repeat(43),owner='visitor:'+createHash('sha256').update(token).digest('hex');const own=seed(owner);const h=await harness();
  expect((await(await h.get('/',{Cookie:`pg_visitor=${token}`})).json()).reports.map((r:any)=>r.id)).toEqual([own.id]);
  expect((await(await h.get('/',{Cookie:`pg_visitor=${other}`})).json()).reports).toEqual([]);
  const anonymous=await h.get('/',{});expect(anonymous.headers.get('set-cookie')).toContain('HttpOnly');
 });
 it('bounds the library to the latest 50 owner records',async()=>{
  for(let i=0;i<54;i++)seed();seed('user:bob');const h=await harness();
  const list=(await(await h.get('/')).json()).reports;
  expect(list).toHaveLength(50);expect(list.map((r:any)=>r.createdAt)).toEqual([...list.map((r:any)=>r.createdAt)].sort().reverse());
 });
 it('denies foreign ID, forged owner input and cross-origin checks before spending or fetching',async()=>{
  const own=seed();const h=await harness();
  expect((await h.post(`/${own.id}/check`,bob,{ownerId:'user:alice',url:'https://attacker.example/'})).status).toBe(404);
  expect((await h.post(`/${own.id}/check`,{...alice,Origin:'https://other.example'})).status).toBe(403);
  expect((await h.post(`/${own.id}/check`,{Authorization:'Bearer forged-alice'})).status).toBe(401);
  expect(h.sourceReader).not.toHaveBeenCalled();expect(h.runner).not.toHaveBeenCalled();expect(secureStore.read().quotas).toEqual({});
 });
 it('returns a missing baseline without a crawl, a new audit or quota consumption',async()=>{
  const own=seed('user:alice',report({baseline:false}));const h=await harness();const count=Object.keys(secureStore.read().audits).length;
  const value=await(await h.post(`/${own.id}/check`)).json();expect(value.status).toBe('baseline-missing');
  expect(h.sourceReader).not.toHaveBeenCalled();expect(h.runner).not.toHaveBeenCalled();expect(secureStore.read().quotas).toEqual({});expect(Object.keys(secureStore.read().audits)).toHaveLength(count);
 });
 it('reports exact unchanged source while preserving the stored report and history',async()=>{
  const own=seed();const before=JSON.stringify(getAudit(own.id,'user:alice'));const h=await harness();
  const value=await(await h.post(`/${own.id}/check`,alice,{url:'https://attacker.example/'})).json();expect(value.status).toBe('no-source-change');
  expect(h.sourceReader).toHaveBeenCalledWith(own.url);expect(h.runner).not.toHaveBeenCalled();expect(mocks.llm).not.toHaveBeenCalled();
  expect(JSON.stringify(getAudit(own.id,'user:alice'))).toBe(before);expect(secureStore.read().histories).toEqual({});expect(secureStore.read().quotas['source-checks:global'].count).toBe(1);
 });
 it('detects mobile-only content changes and redirect changes separately',async()=>{
  const own=seed();const mobile=source();mobile.mobile.sha256='c'.repeat(64);const redirected=source();redirected.desktop.finalUrl='https://example.org/new';
  const reader=vi.fn().mockResolvedValueOnce(mobile).mockResolvedValueOnce(redirected);const h=await harness(reader);
  for(let i=0;i<2;i++)expect((await(await h.post(`/${own.id}/check`)).json()).status).toBe('source-changed');expect(h.runner).not.toHaveBeenCalled();
 });
 it('does not conflate unreadable source with an unchanged page and releases concurrency',async()=>{
  const own=seed();const reader=vi.fn().mockRejectedValueOnce(new Error('BLOCKED_REMOTE_CANARY')).mockResolvedValueOnce(source());const h=await harness(reader);
  const failed=await h.post(`/${own.id}/check`);expect(failed.status).toBe(502);expect(await failed.text()).not.toContain('BLOCKED_REMOTE_CANARY');
  expect((await(await h.post(`/${own.id}/check`)).json()).status).toBe('no-source-change');expect(h.runner).not.toHaveBeenCalled();
 });
 it('rejects the thirteenth owner check without consuming more global budget',async()=>{
  const own=seed();const h=await harness();for(let i=0;i<12;i++)expect((await h.post(`/${own.id}/check`)).status).toBe(200);
  const before=structuredClone(secureStore.read().quotas);expect((await h.post(`/${own.id}/check`)).status).toBe(429);expect(secureStore.read().quotas).toEqual(before);expect(h.sourceReader).toHaveBeenCalledTimes(12);
 });
 it('caps simultaneous checks and does not spend budget for a busy rejection',async()=>{
  const own=seed();const waiting:((value:ReturnType<typeof source>)=>void)[]=[];const reader=vi.fn(()=>new Promise<ReturnType<typeof source>>(resolve=>waiting.push(resolve)));const h=await harness(reader);
  const first=h.post(`/${own.id}/check`),second=h.post(`/${own.id}/check`);
  try {await vi.waitFor(()=>expect(waiting.length).toBe(2));const before=structuredClone(secureStore.read().quotas);expect((await h.post(`/${own.id}/check`)).status).toBe(429);expect(secureStore.read().quotas).toEqual(before);}
  finally {waiting.forEach(resolve=>resolve(source()));await Promise.all([first,second]);}
 });
 it('serves only the stored image ref after owner authorization, never a query-supplied ref',async()=>{
  const value=report();value.rendered={version:'1',method:'chromium-dom',scope:'homepage-first-viewport',status:'partial',limitations:[],devices:{web:{status:'captured',capture:{capturedAt:value.generatedAt,finalUrl:value.url,viewport:{width:1440,height:900},imageSha256:'a'.repeat(64),imageRef:'a'.repeat(64)+'.jpg',imageChanged:null}},mobile:{status:'unavailable'}}};
  const own=seed('user:alice',value);mocks.archive.mockReturnValue(Buffer.from('SYNTHETIC_JPEG'));const h=await harness();
  expect((await h.get(`/${own.id}/screenshot?device=web`,bob)).status).toBe(404);expect(mocks.archive).not.toHaveBeenCalled();
  const image=await h.get(`/${own.id}/screenshot?device=web&imageRef=../../secret`);expect(image.status).toBe(200);expect(image.headers.get('cache-control')).toContain('no-store');expect(mocks.archive).toHaveBeenCalledWith('a'.repeat(64)+'.jpg');
  expect((await h.get(`/${own.id}/screenshot?device=mobile`)).status).toBe(404);
  const saved=await(await h.get('/'+own.id)).json();
  expect(saved.report.rendered.devices.web.capture.imageRef).toBeUndefined();
  expect(saved.report.rendered.devices.web.capture.capturedAt).toBe(value.generatedAt);
  expect(getAudit(own.id,'user:alice')!.report.rendered!.devices.web.capture!.imageRef).toBe('a'.repeat(64)+'.jpg');
 });
});

describe('initial free grading and explicit future deep-review boundaries',()=>{
 it('keeps all nine initial categories and specific fixes free without inventing S',()=>{
  const original=report({gradeS:true}),before=structuredClone(original);
  for(const entitled of [false,true]){
   const result=redactReport(original,entitled);expect(result.overallGrade).toBe('A+');expect(result.categories).toHaveLength(9);
   for(const category of result.categories){expect(category.premium).toBe(false);expect(category.details).toHaveLength(1);expect(category.recommendation).toBe(`Fix ${category.key}`);expect(category.grade).toBe('A+');expect(category.recruiterNote).toBeUndefined();}
   expect(result.topFixes[0]).toMatchObject({premium:false,title:'Specific initial fix',description:'Keep this useful initial guidance'});expect(result.sourceSnapshot).toBeUndefined();
  }
  expect(original).toEqual(before);
 });
 it('does not discard the paywall policy for an explicitly verified future deep report',()=>{
  const original=report({deep:true,gradeS:true});const free=redactReport(original,false),paid=redactReport(original,true);
  expect(free.overallGrade).toBe('A+');expect(free.categories.find(c=>c.key==='accessibility')).toMatchObject({details:[],recommendation:LOCKED});expect(free.topFixes[0].description).toBe(LOCKED);
  expect(paid.overallGrade).toBe('S');expect(paid.categories.find(c=>c.key==='accessibility')?.recommendation).toBe('Fix accessibility');expect(paid.sourceSnapshot).toBeUndefined();
 });
 it('exposes the initial free evidence through the actual saved-report route',async()=>{
  const own=seed();const h=await harness();const body=await(await h.get('/'+own.id)).json();
  expect(body.report.categories.every((c:any)=>!c.premium&&c.details.length===1&&c.recommendation.startsWith('Fix '))).toBe(true);expect(body.report.topFixes[0].premium).toBe(false);
 });
});

describe('complete source fingerprint regression',()=>{
 it('uses the full supplied buffer digest rather than its already truncated scoring HTML',()=>{
  const base={finalUrl:'https://example.org/',html:'identical truncated scoring prefix',sourceSha256:'a'.repeat(64)};
  expect(sameHomepageSource(fingerprintSource(base,base),fingerprintSource({...base,sourceSha256:'b'.repeat(64)},base))).toBe(false);
 });
 it('detects a real fetched change beyond the 700,000-character scoring cut without AI',async()=>{
  const prefix='<!doctype html><html><head><title>Portfolio</title></head><body><h1>My real work</h1><p>Photography projects and contact details.</p>'+' '.repeat(700_010);
  let tail='original';mocks.publicFetch.mockImplementation(async()=>new Response(prefix+tail+'</body></html>',{status:200,headers:{'content-type':'text/html'}}));
  const first=await readHomepageSource('https://example.org/');tail='updated';const second=await readHomepageSource('https://example.org/');
  expect(sameHomepageSource(first,second)).toBe(false);expect(mocks.publicFetch).toHaveBeenCalledTimes(4);expect(mocks.llm).not.toHaveBeenCalled();
 });
});


describe('exact page history identity and conservative legacy recovery',()=>{
 const legacyKey=(owner:string,url:string,role:string)=>createHash('sha256').update(JSON.stringify([owner,historyKey(url),role.trim().toLowerCase()])).digest('hex');
 const remember=(url:string,owner='user:alice',role='Photography')=>{
  const value=report();value.url=url;value.role=role;const saved=seed(owner,value);
  return {saved,history:recordAudit(saved.id,value,{ownerId:owner})};
 };
 it('separates scheme, www, query, trailing path, owner and role checklist states',()=>{
  const urls=['https://example.org/?view=a','https://example.org/?view=b','http://example.org/?view=a','https://www.example.org/?view=a','https://example.org/path/','https://example.org/path'];
  const entries=urls.map(url=>remember(url));
  const otherOwner=remember(urls[0],'user:bob'),otherRole=remember(urls[0],'user:alice','Marketing');
  const suggestion=Object.keys(entries[0].history.suggestions)[0];
  expect(toggleSuggestion(urls[0],suggestion,true,'user:alice','Photography')?.done).toBe(true);
  entries.forEach((entry,i)=>{const h=getHistory(urls[i],'user:alice','Photography')!;expect(h.runs.map(run=>run.id)).toEqual([entry.saved.id]);expect(h.suggestions[suggestion].done).toBe(i===0);});
  expect(getHistory(urls[0],'user:bob','Photography')!.runs[0].id).toBe(otherOwner.saved.id);
  expect(getHistory(urls[0],'user:alice','Marketing')!.runs[0].id).toBe(otherRole.saved.id);
  expect(getHistory(urls[0]+'#ignored-fragment','user:alice','Photography')!.suggestions[suggestion].done).toBe(true);
 });
 it('recovers an exact-owner exact-page legacy history without altering the preserved entry',()=>{
  const url='https://example.org/?view=a',entry=remember(url),key=legacyKey('user:alice',url,'Photography');
  secureStore.update(state=>{state.histories={[key]:entry.history};});
  expect(getHistory(url,'user:alice','Photography')!.runs[0].id).toBe(entry.saved.id);
  const suggestion=Object.keys(entry.history.suggestions)[0];
  expect(toggleSuggestion(url,suggestion,true,'user:alice','Photography')!.done).toBe(true);
  expect((secureStore.read().histories[key] as typeof entry.history).suggestions[suggestion].done).toBe(false);
  expect(Object.keys(secureStore.read().histories)).toHaveLength(2);
 });
 it('rejects mixed-page or foreign-owner legacy runs and starts a separate safe current history',()=>{
  const url='https://example.org/?view=a',entry=remember(url),other=remember('https://example.org/?view=b'),key=legacyKey('user:alice',url,'Photography');
  const mixed=structuredClone(entry.history);mixed.runs.push(other.history.runs[0]);
  secureStore.update(state=>{state.histories={[key]:mixed};});
  expect(getHistory(url,'user:alice','Photography')).toBeNull();expect(getHistory(other.saved.url,'user:alice','Photography')).toBeNull();
  const fresh=remember(url);expect(fresh.history.runs.map(run=>run.id)).toEqual([fresh.saved.id]);expect((secureStore.read().histories[key] as typeof mixed).runs).toHaveLength(2);
  const foreign=remember(url,'user:bob');const tainted=structuredClone(entry.history);tainted.runs=[foreign.history.runs[0]];
  secureStore.update(state=>{state.histories={[key]:tainted};});expect(getHistory(url,'user:alice','Photography')).toBeNull();
 });
});
