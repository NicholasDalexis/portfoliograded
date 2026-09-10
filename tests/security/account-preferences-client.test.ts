import { afterEach, beforeEach, expect, test, vi } from "vitest";
const fixture = vi.hoisted(() => ({ auth: { currentUser: null as any, authStateReady: vi.fn(async () => {}) } }));
vi.mock("@/lib/firebase", () => fixture);
import { loadAccountPreferences, saveAccountPreferences } from "@/lib/accountPreferences";
const result = { marketingEmails:false,revision:0,updatedAt:null,scope:"portfolio-graded-email-v1",emailVerified:true,sendingEnabled:false };
let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fixture.auth.currentUser = { uid:"alice", getIdToken:vi.fn(async()=>"fixture-token") };
  request = vi.fn(async () => new Response(JSON.stringify(result), {status:200,headers:{"Content-Type":"application/json"}}));
  vi.stubGlobal("fetch",request);vi.stubGlobal("window",{setTimeout,clearTimeout});
});
afterEach(()=>vi.unstubAllGlobals());
test("preference writes send a token and only choice/revision, never a client email or owner",async()=>{
  await saveAccountPreferences("alice",true,0);
  expect(request).toHaveBeenCalledOnce();
  const [url,options]=request.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe("/api/account/preferences");expect(options.method).toBe("PUT");
  expect(JSON.parse(String(options.body))).toEqual({marketingEmails:true,expectedRevision:0});
  expect(options.headers).toEqual({Authorization:"Bearer fixture-token","Content-Type":"application/json"});
});
test("a changed account before token acquisition makes no request",async()=>{
  fixture.auth.currentUser={uid:"bob",getIdToken:vi.fn()};
  await expect(loadAccountPreferences("alice")).rejects.toMatchObject({code:"account_changed"});expect(request).not.toHaveBeenCalled();
});
test("a changed account while acquiring a token makes no request",async()=>{
  fixture.auth.currentUser.getIdToken=async()=>{fixture.auth.currentUser={uid:"bob"};return "fixture-token";};
  await expect(loadAccountPreferences("alice")).rejects.toMatchObject({code:"account_changed"});expect(request).not.toHaveBeenCalled();
});
test("a response for an old account is not displayed as the new account preference",async()=>{
  request.mockImplementation(async()=>{fixture.auth.currentUser={uid:"bob"};return new Response(JSON.stringify(result));});
  await expect(loadAccountPreferences("alice")).rejects.toMatchObject({code:"account_changed"});
});
test("a conflict is surfaced without silently replaying a stale consent",async()=>{
  request.mockResolvedValue(new Response(JSON.stringify({error:"preference_conflict",reason:"Reload first"}),{status:409}));
  await expect(saveAccountPreferences("alice",true,0)).rejects.toMatchObject({code:"preference_conflict"});expect(request).toHaveBeenCalledOnce();
});
test("malformed success responses do not count as saved preferences",async()=>{
  request.mockResolvedValue(new Response(JSON.stringify({...result,sendingEnabled:true})));
  await expect(saveAccountPreferences("alice",true,0)).rejects.toThrow();
});
