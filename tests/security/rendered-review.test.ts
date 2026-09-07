import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { collectRenderedReview } from '../../server/lib/renderedReview.js';
import { archiveShot, getArchivedShot } from '../../server/lib/shotArchive.js';
import { imageDifference } from '../../server/lib/screenshot.js';
import { renderedObservationsSchema } from '../../shared/renderedEvidence.js';
const observations = { layoutViewport:{width:1440,height:900}, document:{width:1440,height:900}, horizontalOverflowPx:0, elementsExamined:1,sampleTruncated:false,headings:{visible:0,examples:[]},contact:{visibleCandidates:0,examples:[]},targets:{visible:0,below44:0,examples:[]},contrast:{tested:0,belowThreshold:0,skippedComplex:0,examples:[]} };
const capture = { capturedAt:'2026-09-06T00:00:00.000Z',finalUrl:'https://example.org/',viewport:{width:1440,height:900},imageSha256:'a'.repeat(64),imageChanged:null };
const success=()=>({buf:Buffer.from('image'),changed:false,hadPrevious:false,capture,observations});
describe('rendered review failure and provenance contracts',()=>{
 it('does not launch any browser when disabled or unavailable',async()=>{
  const fn=vi.fn();
  for(const [enabled,available,reason] of [[false,true,'disabled'],[true,false,'browser_unavailable']] as const){
   const result=await collectRenderedReview('https://example.org/',{capture:fn,enabled:()=>enabled,available:()=>available});
   expect(result.status).toBe('unavailable');expect(result.devices.mobile.reason).toBe(reason);expect(result.devices.web.observations).toBeUndefined();
  }
  expect(fn).not.toHaveBeenCalled();
 });
 it('retains a successful device when the other browser capture fails',async()=>{
  const fn=vi.fn().mockResolvedValueOnce(success()).mockRejectedValueOnce(new Error('busy'));
  const result=await collectRenderedReview('https://example.org/',{capture:fn,enabled:()=>true,available:()=>true});
  expect(result.status).toBe('partial');expect(result.devices.web.capture).toEqual(capture);expect(result.devices.mobile.reason).toBe('busy');
 });
 it('does not turn a JPEG-only capture into measured or passing evidence',async()=>{
  const result=await collectRenderedReview('https://example.org/',{capture:vi.fn().mockResolvedValue({...success(),observations:undefined}),enabled:()=>true,available:()=>true});
  expect(result.status).toBe('partial');expect(result.devices.web.reason).toBe('measurement_failed');expect(result.devices.web.observations).toBeUndefined();
 });
 it('preserves two snapshots with explicit bounded method and limitations',async()=>{
  const result=await collectRenderedReview('https://example.org/',{capture:vi.fn().mockResolvedValue(success()),enabled:()=>true,available:()=>true});
  expect(result.status).toBe('complete');expect(result.scope).toBe('homepage-first-viewport');expect(result.limitations.join(' ')).toContain('do not change');
 });
 it('rejects malformed numeric evidence and unbounded injected output',()=>{
  expect(renderedObservationsSchema.safeParse({...observations,horizontalOverflowPx:Infinity}).success).toBe(false);
  expect(renderedObservationsSchema.safeParse({...observations,elementsExamined:2001}).success).toBe(false);
  expect(renderedObservationsSchema.safeParse({...observations,extra:'malicious'}).success).toBe(false);
 });
 it('distinguishes same-length changed bytes from an unchanged capture',()=>{
  expect(imageDifference(Buffer.from('aaa'))).toBeNull();
  expect(imageDifference(Buffer.from('aaa'),Buffer.from('aaa'))).toBe(false);
  expect(imageDifference(Buffer.from('aab'),Buffer.from('aaa'))).toBe(true);
 });
});
const previous=process.env.PG_DATA_DIR;let temporary='';
afterEach(()=>{if(temporary)rmSync(temporary,{recursive:true,force:true});temporary='';if(previous===undefined)delete process.env.PG_DATA_DIR;else process.env.PG_DATA_DIR=previous;});
describe('private immutable image archive',()=>{
 it('roundtrips an opaque content reference and rejects paths/hash mismatches',()=>{
  temporary=mkdtempSync(path.join(tmpdir(),'pg-rendered-'));process.env.PG_DATA_DIR=temporary;
  const bytes=Buffer.from('fixture jpeg');const ref=archiveShot(bytes)!;
  expect(ref).toMatch(/^[a-f0-9]{64}\.jpg$/);expect(getArchivedShot(ref)).toEqual(bytes);
  expect(getArchivedShot('../secret')).toBeNull();expect(getArchivedShot('/etc/passwd')).toBeNull();
  writeFileSync(path.join(temporary,'rendered-images-v1',ref),'tampered');expect(getArchivedShot(ref)).toBeNull();
 });
 it('bounds archive file retention and preserves the current capture',()=>{
  temporary=mkdtempSync(path.join(tmpdir(),'pg-rendered-'));process.env.PG_DATA_DIR=temporary;
  const dir=path.join(temporary,'rendered-images-v1');mkdirSync(dir);
  for(let i=0;i<515;i++)writeFileSync(path.join(dir,`${i.toString(16).padStart(64,'0')}.jpg`),'old');
  const bytes=Buffer.from('new capture');const ref=archiveShot(bytes)!;
  expect(readdirSync(dir).length).toBeLessThanOrEqual(512);expect(getArchivedShot(ref)).toEqual(bytes);
 });
 it('fails image retention honestly when private storage is unavailable',()=>{
  temporary=mkdtempSync(path.join(tmpdir(),'pg-rendered-'));const file=path.join(temporary,'not-directory');writeFileSync(file,'fixture');process.env.PG_DATA_DIR=file;
  expect(archiveShot(Buffer.from('capture'))).toBeUndefined();
 });
 it('refuses oversized image retention',()=>{ expect(archiveShot(Buffer.alloc(6_000_001))).toBeUndefined(); });
});
