import { readFile } from "node:fs/promises";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as facade from "../../../src/lib/library/dashboard";
import * as builderModule from "../../../src/lib/library/dashboard-builder";
import {
  buildLibraryDashboardFromRows as builder,
  type LibraryDashboardRows as BuilderRows,
} from "../../../src/lib/library/dashboard-builder";
import * as review from "../../../src/lib/library/dashboard-review";
import * as query from "../../../src/lib/library/dashboard-query";
import * as timeline from "../../../src/lib/library/dashboard-timeline";
import type { LibraryDashboardRows as FacadeRows } from "../../../src/lib/library/dashboard";

function importSourceSpecifiers(source: string): string[] {
  return Array.from(
    source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)(["'])([^"']+)\1/g),
    (match) => match[2],
  );
}

describe("library dashboard module boundary", () => {
  it("keeps the existing facade delegated to the pure builder", () => {
    expect(facade.buildLibraryDashboardFromRows).toBe(builder);
    expect(facade.getLibraryDashboard).toBeTypeOf("function");
    expect(facade.getLibraryDashboard).toHaveLength(1);
    expect(Object.keys(facade).sort()).toEqual([
      "buildLibraryDashboardFromRows",
      "getLibraryDashboard",
    ]);
    expectTypeOf<FacadeRows>().toEqualTypeOf<BuilderRows>();
  });

  it("exposes one runtime entry point from the review rules module", () => {
    expect(Object.keys(review).sort()).toEqual(["buildLibraryDashboardReview"]);
  });

  it("exposes one runtime entry point from the query module", () => {
    expect(Object.keys(query).sort()).toEqual(["queryLibraryDashboardRows"]);
  });

  it("keeps the builder and timeline runtime surfaces narrow", () => {
    expect(Object.keys(builderModule).sort()).toEqual([
      "buildLibraryDashboardFromRows",
    ]);
    expect(Object.keys(timeline).sort()).toEqual([
      "TIMELINE_EVENT_TYPES",
      "parseLibraryDashboardTimelineEvent",
    ]);
  });

  it("keeps timeline imports independent from dashboard and data access modules", async () => {
    const source = await readFile(
      new URL(
        "../../../src/lib/library/dashboard-timeline.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const forbiddenImports = importSourceSpecifiers(source).filter(
      (specifier) =>
        specifier === "./dashboard" ||
        specifier === "./dashboard-builder" ||
        specifier.includes("/supabase/") ||
        specifier.endsWith("/supabase") ||
        specifier.includes("/server") ||
        /(?:^|\/)(?:db|database|queries?)(?:\/|$)/.test(specifier),
    );

    expect(forbiddenImports).toEqual([]);
  });

  it("keeps the query module independent from the dashboard facade", async () => {
    const source = await readFile(
      new URL("../../../src/lib/library/dashboard-query.ts", import.meta.url),
      "utf8",
    );

    expect(importSourceSpecifiers(source)).not.toContain("./dashboard");
  });
});
