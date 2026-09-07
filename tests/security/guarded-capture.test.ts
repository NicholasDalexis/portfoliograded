import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const state = vi.hoisted(()=>({ pages: [] as any[], contexts: [] as any[], buffer: Buffer.from('abc'), failPage: false, launch: vi.fn() }));
vi.mock('puppeteer-core',()=>({default:{launch:state.launch}}));
vi.mock('../../server/lib/renderedMetrics.js',()=>({measureRenderedPage:vi.fn().mockResolvedValue(undefined)}));
vi.mock('../../server/lib/publicNetwork.js',async importActual => ({...await importActual<any>(),browserProxyPort:vi.fn().mockResolvedValue(12345)}));
let captureAndStore: typeof import('../../server/lib/screenshot.js').captureAndStore;
let getArchivedShot: typeof import('../../server/lib/screenshot.js').getArchivedShot;
let temporary='';
beforeAll(async()=>{
 temporary=mkdtempSync(path.join(tmpdir(),'pg-capture-'));vi.stubEnv('PG_DATA_DIR',temporary);vi.stubEnv('PG_EXAMPLE_SECRET','not-a-real-secret');
 state.launch.mockResolvedValue({on:vi.fn(),createBrowserContext:vi.fn(async()=>{
  const page:any={setBypassServiceWorker:vi.fn(),setRequestInterception:vi.fn(),on:vi.fn(),setUserAgent:vi.fn(),setViewport:vi.fn(),goto:vi.fn().mockResolvedValue({ok:()=>true}),url:()=> 'https://example.org/',screenshot:vi.fn(async()=>state.buffer)};
  state.pages.push(page);
  const context={close:vi.fn().mockResolvedValue(undefined),newPage:vi.fn(async()=>{if(state.failPage){state.failPage=false;throw new Error('closed');}return page;})};state.contexts.push(context);return context;
 })});
 ({captureAndStore,getArchivedShot}=await import('../../server/lib/screenshot.js'));
});
afterAll(()=>{vi.unstubAllEnvs();rmSync(temporary,{recursive:true,force:true});});
describe('guarded capture integration without external traffic',()=>{
 it('retains an exact immutable JPEG identity and uses public proxy plus Chrome sandbox',async()=>{
  const result=await captureAndStore('https://example.org/','web');
  expect(result.capture.imageChanged).toBeNull();expect(result.capture.imageRef).toMatch(/^[a-f0-9]{64}\.jpg$/);
  expect(getArchivedShot(result.capture.imageRef!)).toEqual(state.buffer);
  const options=state.launch.mock.calls[0][0];
  expect(options.args).toContain('--proxy-server=http://127.0.0.1:12345');expect(options.args).toContain('--proxy-bypass-list=<-loopback>');expect(options.args).not.toContain('--no-sandbox');
  expect(options.env.PG_EXAMPLE_SECRET).toBeUndefined();expect(state.contexts[0].close).toHaveBeenCalled();
 });
 it('identifies same-length encoded differences but does not claim meaningful page edits',async()=>{
  state.buffer=Buffer.from('abd');const changed=await captureAndStore('https://example.org/','web');
  expect(changed.changed).toBe(true);expect(changed.capture.imageChanged).toBe(true);
  const unchanged=await captureAndStore('https://example.org/','web');expect(unchanged.capture.imageChanged).toBe(false);
 });
 it('aborts private/scheme/mutating requests and caps page request count',()=>{
  const onRequest=state.pages[0].on.mock.calls.find((x:any[])=>x[0]==='request')[1];
  for(const [url,method] of [['http://127.0.0.1/','GET'],['file:///etc/passwd','GET'],['https://example.org/','POST'],['ws://example.org/','GET']]){
   const req={url:()=>url,method:()=>method,abort:vi.fn(),continue:vi.fn()};onRequest(req);expect(req.abort).toHaveBeenCalled();expect(req.continue).not.toHaveBeenCalled();
  }
  const req={url:()=> 'https://example.org/a',method:()=> 'GET',abort:vi.fn(),continue:vi.fn()};
  for(let i=0;i<161;i++)onRequest(req);
  expect(req.continue.mock.calls.length).toBeLessThanOrEqual(160);expect(req.abort).toHaveBeenCalled();
 });
 it('releases context and capture capacity when opening a page fails',async()=>{
  state.failPage=true;await expect(captureAndStore('https://example.org/','mobile')).rejects.toThrow('closed');
  expect(state.contexts.at(-1).close).toHaveBeenCalled();
  const recovered=await captureAndStore('https://example.org/','mobile');expect(recovered.capture.viewport).toEqual({width:390,height:844});
 });
 it('rejects unsafe initial URLs before opening a browser context',async()=>{
  const count=state.contexts.length;await expect(captureAndStore('http://127.0.0.1/','web')).rejects.toThrow();expect(state.contexts.length).toBe(count);
 });
});
