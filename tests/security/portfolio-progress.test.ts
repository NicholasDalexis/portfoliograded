import { describe, expect, it, vi } from "vitest";
import {
  progressLabelIndexes,
  progressSeries,
  progressTargets,
  progressUrl,
} from "@/lib/portfolioProgress";
import { readOwnedReportJson } from "@/lib/ownedReportRead";

const url = "https://example.org/portfolio?view=one";
const summary = (patch = {}) => ({
  id: "a".repeat(24),
  url,
  role: "Marketing",
  createdAt: "2026-09-06T12:00:00Z",
  overall: 70,
  overallGrade: "C",
  methodVersion: "method-two",
  ...patch,
});
const target = () => progressTargets([summary()])[0];
const run = (index: number, patch = {}) => ({
  id: index.toString().padStart(24, "0"),
  at: `2026-09-${String(index + 1).padStart(2, "0")}T12:00:00Z`,
  role: "Marketing",
  overall: 80,
  overallGrade: "B",
  methodVersion: "method-two",
  accepted: true,
  evidenceStatus: "complete",
  ...patch,
});
const history = (runs: unknown[], patch = {}) => ({
  url,
  role: "Marketing",
  runs,
  ...patch,
});

describe("comparable saved progress", () => {
  it("retains saved letters instead of deriving them from numbers, with readable small-series and endpoint labels", () => {
    const points = progressSeries(
      history([
        run(0, { overall: 50, overallGrade: "B" }),
        run(1, { overall: 50, overallGrade: "A" }),
        run(2, { overall: 50, overallGrade: "A+" }),
      ]),
      target()
    )[0].points;
    expect(points.map(point => point.grade)).toEqual(["B", "A", "A+"]);
    expect(progressLabelIndexes(points)).toEqual([0, 1, 2]);
    expect(progressLabelIndexes([points[0]])).toEqual([0]);
    expect(
      progressLabelIndexes(
        Array.from({ length: 8 }, (_, index) => ({
          ...points[0],
          at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
        }))
      )
    ).toEqual([0, 7]);
    const crowded = [
      { ...points[0], at: "2026-09-01T12:00:00Z" },
      { ...points[1], at: "2026-09-01T12:01:00Z" },
      { ...points[2], at: "2026-09-06T12:00:00Z" },
    ];
    expect(progressLabelIndexes(crowded)).toEqual([0, 2]);
  });
  it("groups only exact URLs and matching requested roles, preserving query, scheme, www and method discovery", () => {
    const choices = progressTargets([
      summary(),
      summary({ url: url + "#same", role: " marketing " }),
      summary({ role: "Photography" }),
      summary({ url: url.replace("one", "two") }),
      summary({ url: url.replace("https:", "http:") }),
      summary({ url: url.replace("example.org", "www.example.org") }),
    ]);
    expect(choices).toHaveLength(5);
    expect(progressUrl(url + "#same")).toBe(url);
    expect(
      progressTargets([
        null,
        summary({ url: "javascript:alert(1)" }),
        summary({ createdAt: "unknown" }),
      ] as any)
    ).toEqual([]);
  });
  it("keeps chronological numeric declines and separates methods without substituting the best score", () => {
    const value = history([
      run(2, { overall: 70, overallGrade: "C" }),
      run(0, { overall: 90, overallGrade: "A" }),
      run(1, {
        methodVersion: "older-method",
        overall: 99,
        overallGrade: "A+",
      }),
    ]);
    const before = structuredClone(value),
      series = progressSeries(value, target());
    expect(series.map(item => item.methodVersion)).toEqual([
      "method-two",
      "older-method",
    ]);
    expect(series[0].points.map(point => point.score)).toEqual([90, 70]);
    expect(series[1].points[0].score).toBe(99);
    expect(value).toEqual(before);
  });
  it("keeps all older history beyond the 50-report discovery list", () => {
    const runs = Array.from({ length: 70 }, (_, index) =>
      run(index, {
        at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
        overall: 100 - index,
      })
    );
    expect(progressSeries(history(runs), target())[0].points).toHaveLength(70);
    expect(
      progressSeries(history(runs), target())[0].points.at(-1)?.score
    ).toBe(31);
  });
  it("does not fabricate a trend for zero or one accepted point", () => {
    expect(progressSeries(null, target())).toEqual([]);
    expect(progressSeries(history([]), target())).toEqual([]);
    expect(progressSeries(history([run(0)]), target())[0].points).toHaveLength(
      1
    );
  });
  it("rejects another page or role's history and filters unrelated, partial, unversioned and invalid points", () => {
    expect(
      progressSeries(history([run(0)], { url: url + "&other=true" }), target())
    ).toEqual([]);
    expect(
      progressSeries(history([run(0)], { role: "Photography" }), target())
    ).toEqual([]);
    const patches = [
      { role: "Photography" },
      { accepted: false },
      { evidenceStatus: "partial" },
      { methodVersion: undefined },
      { methodVersion: "legacy-homepage-html-rubric-unknown" },
      { at: "not a date" },
      { overall: -1 },
      { overall: 101 },
      { overall: Number.NaN },
      { id: "../../private" },
      { overallGrade: "invented" },
    ];
    expect(
      progressSeries(
        history(patches.map((patch, index) => run(index, patch))),
        target()
      )
    ).toEqual([]);
    expect(progressSeries({ runs: "invalid" }, target())).toEqual([]);
  });
  it("deduplicates repeated immutable report IDs and retains explicit legacy method records", () => {
    const old = run(0, {
      methodVersion: "legacy-homepage-html-rubric-5",
      accepted: undefined,
      evidenceStatus: undefined,
    });
    expect(
      progressSeries(history([old, old]), target())[0].points
    ).toHaveLength(1);
  });
});

describe("owner-scoped report reads", () => {
  function context() {
    const state = { owner: "alice" as string | null },
      controller = new AbortController();
    const request = vi.fn(
      async () => new Response(JSON.stringify({ reports: [] }))
    );
    return {
      state,
      controller,
      request,
      options: {
        owner: "alice",
        currentOwner: () => state.owner,
        getHeaders: vi.fn(async () => ({ Authorization: "Bearer synthetic" })),
        signal: controller.signal,
        request: request as typeof fetch,
      },
    };
  }
  it("makes only an authenticated GET with an abort signal", async () => {
    const c = context();
    expect(await readOwnedReportJson("/api/audits", c.options)).toEqual({
      reports: [],
    });
    expect(c.request).toHaveBeenCalledWith("/api/audits", {
      method: "GET",
      headers: { Authorization: "Bearer synthetic" },
      signal: c.controller.signal,
    });
  });
  it("never starts a read after identity changes while the token waits", async () => {
    const c = context();
    c.options.getHeaders.mockImplementation(async () => {
      c.state.owner = "bob";
      return { Authorization: "Bearer synthetic" };
    });
    await expect(
      readOwnedReportJson("/api/history", c.options)
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(c.request).not.toHaveBeenCalled();
  });
  it("does not downgrade a signed-in read after an absent or failed token", async () => {
    for (const fail of [false, true]) {
      const c = context();
      c.options.getHeaders.mockImplementation(async () => {
        if (fail) throw new Error("Token unavailable");
        return {} as any;
      });
      await expect(
        readOwnedReportJson("/api/audits", c.options)
      ).rejects.toThrow();
      expect(c.request).not.toHaveBeenCalled();
    }
  });
  it("discards an old owner's response or parsed payload after sign-out", async () => {
    for (const duringJson of [false, true]) {
      const c = context();
      c.request.mockImplementation(async () => {
        if (!duringJson) c.state.owner = null;
        return {
          ok: true,
          json: async () => {
            c.state.owner = null;
            return { private: "OLD_OWNER" };
          },
        } as Response;
      });
      await expect(
        readOwnedReportJson("/api/history", c.options)
      ).rejects.toMatchObject({ name: "AbortError" });
    }
  });
  it("stops a cancelled request before fetch and rejects failed history responses", async () => {
    const c = context();
    c.controller.abort();
    await expect(
      readOwnedReportJson("/api/history", c.options)
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(c.request).not.toHaveBeenCalled();
    const failure = context();
    failure.request.mockResolvedValue(new Response("{}", { status: 403 }));
    await expect(
      readOwnedReportJson("/api/history", failure.options)
    ).rejects.toThrow("unavailable");
  });
});
