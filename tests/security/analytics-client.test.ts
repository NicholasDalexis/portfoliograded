import { afterEach, expect, it, vi } from "vitest";
import { track } from "../../client/src/lib/track";
afterEach(()=>vi.unstubAllGlobals());
it("strips free text before the Beacon leaves the browser", async () => {
  const beacon=vi.fn(()=>true);
  vi.stubGlobal("navigator",{sendBeacon:beacon});
  track("audit_started",{role:"Photography",builder:"PRIVATE@example.test",url:"https://PRIVATE.test"});
  expect(beacon).toHaveBeenCalledOnce();
  const [url,blob]=beacon.mock.calls[0] as unknown as [string,Blob];
  expect(url).toBe("/api/track");
  expect(JSON.parse(await blob.text())).toEqual({event:"audit_started",props:{role:"photography",builder:"other"}});
});
it("sanitizes the fallback request and handles network failure without an unhandled rejection", async () => {
  vi.stubGlobal("navigator",{});
  const send=vi.fn(()=>Promise.reject(Error("offline")));
  vi.stubGlobal("fetch",send);
  track("fix_toggled",{id:"PRIVATE",done:false});
  await new Promise(resolve=>setTimeout(resolve,0));
  const [url,options]=send.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe("/api/track");
  expect(JSON.parse(options.body as string)).toEqual({event:"fix_toggled",props:{done:false}});
});
it("does not transmit a bypassed unknown event or break when browser transport throws", () => {
  const beacon=vi.fn(()=>{throw Error("blocked");});
  vi.stubGlobal("navigator",{sendBeacon:beacon});
  track("unknown_PRIVATE" as never,{});
  expect(beacon).not.toHaveBeenCalled();
  expect(()=>track("signed_in",{})).not.toThrow();
});

