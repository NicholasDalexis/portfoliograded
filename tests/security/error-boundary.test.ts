import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { expect, test } from "vitest";
import ErrorBoundary from "../../client/src/components/ErrorBoundary";

test("a failed screen offers recovery without exposing error content or a stack", () => {
  const boundary = new ErrorBoundary({ children: null });
  const error = new Error("Private report URL and internal details should not be rendered");
  error.stack = "internal/path.ts:42 request-token=private-example";
  boundary.state = ErrorBoundary.getDerivedStateFromError(error);
  const html = renderToStaticMarkup(boundary.render());
  const $ = load(html);
  expect(html).not.toContain(error.message);
  expect(html).not.toContain(error.stack);
  expect($("main h1").text()).toBe("This page couldn't open.");
  expect($("button").text()).toContain("Reload page");
  expect($("a[href='/']").text()).toBe("Back to grading");
});

test("a healthy screen's content passes through unchanged", () => {
  const boundary = new ErrorBoundary({ children: React.createElement("p", null, "Your saved report") });
  expect(renderToStaticMarkup(boundary.render())).toBe("<p>Your saved report</p>");
});
