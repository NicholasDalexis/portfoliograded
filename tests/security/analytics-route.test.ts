import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { createTrackRouter } from "../../server/routes/track";
import type { AnalyticsRecord } from "../../shared/analytics";

const servers: Server[] = [];
afterEach(async () => { for(const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())); } });
async function appFor(write: (record: AnalyticsRecord) => void) {
  const app = express();
  app.use(express.json({limit:"16kb"}));
  app.use("/api/track", createTrackRouter(write));
  const server=await new Promise<Server>(resolve=>{ const s=app.listen(0,"127.0.0.1",()=>resolve(s)); });
  servers.push(server);
  const address=server.address();
  if(!address || typeof address==="string") throw Error("No test address");
  return async (body: unknown,headers:Record<string,string>={}) => fetch("http://127.0.0.1:"+address.port+"/api/track",{method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body)});
}
describe("actual HTTP boundary", () => {
  it("writes a server timestamp and allowed stats only, excluding request and body identifiers", async () => {
    const records: AnalyticsRecord[]=[];
    const post=await appFor(r=>records.push(r));
    const res=await post({event:"audit_started",props:{role:"Marketing",builder:"https://SECRET.test",email:"SECRET@example.test",pro:true,url:"SECRET"},at:"SECRET",ip:"SECRET"},{"User-Agent":"SECRET","X-Forwarded-For":"203.0.113.42","Authorization":"Bearer SECRET"});
    expect(res.status).toBe(200);
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({event:"audit_started",props:{role:"marketing",builder:"other",pro:true},at:expect.stringMatching(/^\d{4}-\d\d-\d\dT/)});
    expect(JSON.stringify(records)).not.toMatch(/SECRET|203\.0\.113|authorization|user.agent|email/i);
  });
  it("rejects unknown events and malformed envelopes without any write", async () => {
    const records: AnalyticsRecord[]=[];
    const post=await appFor(r=>records.push(r));
    for(const input of [{event:"url=PRIVATE"},{event:"signed_in",props:[]},[],{}, {event:"fix_toggled",props:"PRIVATE"}]) expect((await post(input)).status).toBe(400);
    expect(records).toEqual([]);
  });
  it("still limits stored events to 60 per minute for an address", async () => {
    const records: AnalyticsRecord[]=[];
    const post=await appFor(r=>records.push(r));
    for(let i=0;i<60;i++) expect((await post({event:"signed_in"})).status).toBe(200);
    expect((await post({event:"signed_in"})).status).toBe(429);
    expect(records).toHaveLength(60);
  });
  it("reports an unavailable store without leaking a file path or pretending it saved", async () => {
    const post=await appFor(()=>{ throw Error("/private/SECRET/path"); });
    const res=await post({event:"signed_in"});
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ok:false});
  });
});

