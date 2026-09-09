import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createHmac } from "node:crypto";
import { adaptApp } from "@server/lib/netlifyAdapter.js";
import { secureStore } from "@server/lib/secureStore.js";
import { storeContext } from "@server/lib/storeContext.js";
import { queueReview, startJob, finishJob, readJob, validJobSignature } from "@server/lib/reviewJobs.js";
import gate from "../../netlify/edge-functions/preview-gate.js";
const empty = () => ({version:2 as const,audits:{},histories:{},quotas:{}});
beforeEach(()=>{secureStore.update(state=>{Object.assign(state,empty());state.jobs={};});vi.stubEnv("PG_JOB_SECRET","a".repeat(64));});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("Netlify request and privacy boundaries",()=>{
 it("keeps binary bytes and separate cookies while rejecting forwarded IP spoofing",async()=>{
  const app=express();app.set("trust proxy",1);
  app.get("/image",(req,res)=>{res.cookie("one","1");res.cookie("two","2");res.set("x-fixture-ip",req.ip!);res.type("image/jpeg").send(Buffer.from([255,216,0,128,255,217]));});
  const response=await adaptApp(app)(new Request("https://preview.example/image",{headers:{"x-forwarded-for":"attacker","x-forwarded-host":"evil.example"}}),"198.51.100.8");
  expect(response.headers.getSetCookie()).toHaveLength(2);expect(response.headers.get("x-fixture-ip")).toBe("198.51.100.8");
  expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([255,216,0,128,255,217]);
 });
 it("does not expose a guest job or result to another browser or account",async()=>{
  const job=await queueReview("visitor:alice",undefined,"198.51.100.8",{url:"https://example.com/work",role:"Marketing"});
  expect(await readJob(job.id,"visitor:bob")).toBeNull();expect(await readJob(job.id,"user:alice")).toBeNull();
  expect((await readJob(job.id,"visitor:alice"))?.state).toBe("queued");
 });
 it("deduplicates a repeated scan and lets only one worker start it",async()=>{
  const first=await queueReview("visitor:alice",undefined,"1",{url:"https://example.com/work",role:"Marketing"});
  const duplicate=await queueReview("visitor:alice",undefined,"1",{url:"https://example.com/work",role:"Marketing"});
  expect(duplicate.id).toBe(first.id);
  expect(await startJob(first.id)).not.toBeNull();expect(await startJob(first.id)).toBeNull();
  await finishJob(first.id,{reportId:"A".repeat(24)});await finishJob(first.id,{error:"late duplicate"});
  expect((await readJob(first.id,"visitor:alice"))?.state).toBe("complete");
 });
 it("bounds work across identities and rejects private URLs before queueing",async()=>{
  await expect(queueReview("visitor:a",undefined,"1",{url:"http://127.0.0.1/"})).rejects.toMatchObject({status:400});
  await queueReview("visitor:a",undefined,"1",{url:"https://example.com/a"});
  await queueReview("visitor:b",undefined,"2",{url:"https://example.com/b"});
  await expect(queueReview("visitor:c",undefined,"3",{url:"https://example.com/c"})).rejects.toMatchObject({status:429});
 });
 it("cannot mutate a read-only snapshot or leak it into another request",()=>{
  const state=empty();
  expect(()=>storeContext.run({document:state,writable:false,changed:false},()=>secureStore.update(s=>{s.quotas.bad={start:0,count:1};}))).toThrow("read_only_storage_operation");
  expect(state.quotas).toEqual({});expect(secureStore.read().quotas).toEqual({});
 });
 it("requires the signed internal job identifier",()=>{
  const id="b".repeat(48);const sig=createHmac("sha256","a".repeat(64)).update(`portfolio-review:${id}`).digest("hex");
  expect(validJobSignature(id,sig)).toBe(true);expect(validJobSignature("c".repeat(48),sig)).toBe(false);expect(validJobSignature(id,"bad")).toBe(false);
 });
 it("protects assets and API routes with the same cookie on fresh edge instances",async()=>{
  vi.stubGlobal("Netlify",{env:{get:()=>"d".repeat(64)}});
  const next=vi.fn(async()=>new Response("private asset"));
  const context={next} as never;
  const asset=await gate(new Request("https://preview.example/assets/main.js"),context);expect(asset.status).toBe(302);expect(next).not.toHaveBeenCalled();
  const api=await gate(new Request("https://preview.example/api/audits"),context);expect(api.status).toBe(401);
  const expires=String(Date.now()+100_000);const sig=createHmac("sha256","d".repeat(64)).update(expires).digest("base64url");
  const valid=new Request("https://preview.example/assets/main.js",{headers:{cookie:`pg_preview=${expires}.${sig}`}});
  expect((await gate(valid,context)).status).toBe(200);expect(next).toHaveBeenCalledOnce();
  expect((await gate(new Request(valid.url,{headers:{cookie:`pg_preview=${expires}.${sig}; pg_preview=wrong`}}),context)).status).toBe(302);
 });
});
