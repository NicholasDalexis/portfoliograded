import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { Router } from "wouter";
import { expect, test, vi } from "vitest";
vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("@/components/UpgradeDialog", () => ({ UpgradeDialog: () => null }));
import Pricing from "@/pages/Pricing";

const page = () => load(renderToStaticMarkup(React.createElement(Router, { ssrPath: "/pricing" }, React.createElement(Pricing))));

test("the free CTA grades and clearly discloses free D sign-in", () => {
  const $ = page();
  const free = $("#pricing-free").closest("section");
  expect(free.find("a").attr("href")).toBe("/");
  expect(free.text()).toContain("All nine category explanations; sign in free for D details");
  expect(free.text()).toContain("D-detail feedback asks for free Google sign-in");
  expect($("a[href='/build'], a[href='/portfolio']").length).toBe(0);
  expect($("main").text()).not.toMatch(/publish|hosting|templates|free domain/i);
});

test("annual arithmetic and commitment remain visible alongside a monthly choice", () => {
  const $ = page();
  const pro = $("#pricing-pro").closest("section");
  const text = pro.text();
  for (const fact of ["$49.99", "$4.17/month", "upfront for the year", "$119.88", "$69.89", "Save 58%", "$9.99", "each month", "Payments are off", "until canceled", "Deeper reviews planned"]) expect(text).toContain(fact);
  expect($("main").text()).toContain("costs less overall for five months or fewer");
  expect(text).not.toMatch(/seven.*free|7.*free|less than five|most popular|limited.time/i);
});

test("the search statistic keeps its outcome cohort, period and exclusion together", () => {
  const $ = page();
  const context = $("aside[aria-label='Job search context']");
  for (const fact of ["82 days", "Median", "first saved job", "recorded offer", "Q2 2026", "ongoing searches excluded", "not a forecast for graduates"]) expect(context.text()).toContain(fact);
  const source = context.find("a");
  expect(source.attr("href")).toBe("https://huntr.co/research/job-search-trends-q2-2026#time-to-first-offer");
  expect(source.attr("rel")).toContain("noopener");
  expect(context.closest("#pricing-pro").length).toBe(0);
});
