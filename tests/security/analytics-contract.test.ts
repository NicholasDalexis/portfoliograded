import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENTS, sanitizeAnalytics } from "../../shared/analytics";

const cases: [string, Record<string, unknown>, Record<string, unknown>][] = [
  ["audit_started", {role:"UX/UI Design",builder:"Adobe Portfolio",pro:false}, {role:"ux_ui",builder:"adobe_portfolio",pro:false}],
  ["role_pill_selected", {role:"Fashion Design"}, {role:"fashion_design"}],
  ["builder_selected", {builder:"Claude / AI builder"}, {builder:"ai_builder"}],
  ["anchor_clicked", {role:"marketing",tier:"S"}, {role:"marketing",tier:"S"}],
  ["asknic_question", {length:220}, {length:220}],
  ["asknic_opened", {}, {}], ["signed_in", {}, {}],
  ["highlight_ask", {length:10}, {length:10}],
  ["fix_toggled", {id:"PRIVATE_SUGGESTION",done:true}, {done:true}],
  ["game_started", {}, {}],
  ["paywall_shown", {variant:"upgrade"}, {variant:"upgrade"}],
  ["paywall_confirmed", {variant:"publish",plan:"yearly"}, {variant:"publish",plan:"yearly"}],
  ["checkout_started", {plan:"monthly"}, {plan:"monthly"}],
  ["checkout_confirmed", {}, {}],
];
describe("existing event compatibility", () => {
  it.each(cases)("%s retains only declared properties", (event, props, expected) => {
    const clean = sanitizeAnalytics({event,props});
    expect(clean).toEqual({event,props:expected});
    expect(sanitizeAnalytics(clean)).toEqual(clean);
  });
  it("covers every allowed event exactly once", () => expect(cases.map(c=>c[0]).sort()).toEqual([...ANALYTICS_EVENTS].sort()));
});
describe("data minimization", () => {
  it("drops free-text Other answer, user identity, URL, query, question and top-level metadata", () => {
    const secret = "PRIVATE@example.test https://portfolio.test/?private=query";
    const clean = sanitizeAnalytics({event:"audit_started",props:{role:secret,builder:secret,pro:true,email:secret,url:secret,query:secret,text:secret,question:secret,reportId:secret,nested:{password:secret}},email:secret,at:secret});
    expect(clean).toEqual({event:"audit_started",props:{role:"general",builder:"other",pro:true}});
    expect(JSON.stringify(clean)).not.toContain("PRIVATE");
  });
  it("does not store arbitrary paywall headline text", () => {
    expect(sanitizeAnalytics({event:"paywall_confirmed",props:{variant:"Your portfolio https://private.test needs help",plan:"yearly"}})).toEqual({event:"paywall_confirmed",props:{variant:"custom",plan:"yearly"}});
  });
  it("keeps known builder options and categorizes typed custom values", () => {
    for(const b of ["Framer","Squarespace","Wix","Canva","Webflow","Cargo","WordPress","Adobe Portfolio","Manus","Claude / AI builder","Coded it myself"])
      expect(sanitizeAnalytics({event:"builder_selected",props:{builder:b}})?.props.builder).not.toBe("other");
    expect(sanitizeAnalytics({event:"builder_selected",props:{builder:""}})?.props.builder).toBe("unanswered");
    expect(sanitizeAnalytics({event:"builder_selected",props:{builder:"__other"}})?.props.builder).toBe("other");
  });
  it.each([NaN,Infinity,-1,1.2,10001,"220",null])("rejects invalid length %s instead of coercing it", length => {
    expect(sanitizeAnalytics({event:"asknic_question",props:{length}})?.props).toEqual({});
  });
  it("does not preserve malformed booleans, tiers or payment-plan text", () => {
    expect(sanitizeAnalytics({event:"fix_toggled",props:{done:"false",id:"SECRET"}})?.props).toEqual({});
    expect(sanitizeAnalytics({event:"anchor_clicked",props:{role:"Marketing",tier:"PRIVATE"}})?.props).toEqual({role:"marketing"});
    expect(sanitizeAnalytics({event:"checkout_started",props:{plan:"someone@example.test"}})?.props).toEqual({});
  });
  it("does not preserve prototype keys or interpret them as named choices", () => {
    const input = JSON.parse('{"event":"audit_started","props":{"role":"constructor","builder":"__proto__","__proto__":{"email":"SECRET"},"constructor":"SECRET"}}');
    expect(sanitizeAnalytics(input)).toEqual({event:"audit_started",props:{role:"general",builder:"other"}});
    expect(({} as {email?:string}).email).toBeUndefined();
  });
  it.each([undefined,null,[],true,3,"question",{},{event:"new_secret_event"},{event:"https://private.test"},{event:"signed_in",props:[]},{event:"signed_in",props:null}])("rejects invalid event envelope %#", input => {
    expect(sanitizeAnalytics(input)).toBeNull();
  });
  it("accepts event-only requests without allowing inherited properties", () => {
    expect(sanitizeAnalytics({event:"signed_in"})).toEqual({event:"signed_in",props:{}});
    expect(sanitizeAnalytics(Object.create({event:"signed_in"}))).toBeNull();
  });
});

