import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  APP_ROUTES,
  APP_ROUTE_SPECS,
  FLOW_ROUTE_SPECS,
  PROTECTED_ROUTE_CASES,
  PUBLIC_PATHS,
  SIDEBAR_ITEMS,
  type SidebarGroup,
  type SidebarItem,
} from "@/lib/routes";

describe("user-flow route contract", () => {
  it("keeps central flow route ids and IA codes unique", () => {
    const ids = FLOW_ROUTE_SPECS.map((spec) => spec.id);
    const iaCodes = FLOW_ROUTE_SPECS.map((spec) => spec.iaCode);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(iaCodes).size).toBe(iaCodes.length);
  });

  it("maps every page flow to an executable App Router route contract", () => {
    const appPaths = new Set(
      APP_ROUTE_SPECS.map((spec) => spec.pathPattern ?? spec.path),
    );

    for (const flow of FLOW_ROUTE_SPECS.filter((spec) =>
      spec.routeType.startsWith("page"),
    )) {
      expect(
        appPaths.has(flow.pathPattern ?? flow.path),
        `${flow.iaCode} is missing from APP_ROUTE_SPECS`,
      ).toBe(true);
    }
  });

  it("points every real App Router route spec to an existing file", () => {
    for (const route of APP_ROUTE_SPECS) {
      expect(
        existsSync(join(process.cwd(), route.appPath)),
        `${route.id} appPath does not exist: ${route.appPath}`,
      ).toBe(true);
    }
  });

  it("derives middleware public and protected route lists from real route specs", () => {
    const expectedPublic = APP_ROUTE_SPECS.filter(
      (route) => route.middleware === "public",
    ).map((route) => route.path);
    const expectedProtected = APP_ROUTE_SPECS.filter(
      (route) => route.middleware === "protected",
    ).map((route) => route.samplePath ?? route.path);

    expect(PUBLIC_PATHS).toEqual(expectedPublic);
    expect(PROTECTED_ROUTE_CASES.map((route) => route.path)).toEqual(
      expectedProtected,
    );
    expect(PROTECTED_ROUTE_CASES.map((route) => route.path)).toContain(
      APP_ROUTES.libraryProblems,
    );
  });

  it("keeps the learner sidebar on the SHARE-03 fixed top-level menu contract", () => {
    expect(SIDEBAR_ITEMS.map((item) => item.labelKey)).toEqual([
      "dashboard",
      "practice",
      "writing",
      "library",
      "growth",
      "settings",
    ]);

    expect(SIDEBAR_ITEMS).toHaveLength(6);
    expect(SIDEBAR_ITEMS.map((item) => item.key)).not.toContain(
      APP_ROUTES.profile,
    );
  });

  it("places contextual sitemap routes outside direct sidebar menu entries", () => {
    const sidebarKeys = collectSidebarKeys(SIDEBAR_ITEMS);

    expect(sidebarKeys).not.toContain(APP_ROUTES.practiceNext);
    expect(sidebarKeys).not.toContain(APP_ROUTES.paywall);
    // 구독 관리(X-04)는 사이드바에서 숨기고 페이월 CTA 흐름으로만 진입한다.
    expect(sidebarKeys).not.toContain(APP_ROUTES.subscription);
    expect(sidebarKeys).not.toContain(APP_ROUTES.feedbackShort);
    expect(sidebarKeys).not.toContain(APP_ROUTES.feedbackLong);
    expect(sidebarKeys).not.toContain(APP_ROUTES.comparisonReport);
    expect(sidebarKeys).not.toContain(APP_ROUTES.libraryProblems);
  });

  it("groups user-flow workspace routes under the sidebar section that owns the flow", () => {
    expect(groupChildren("practice").map((item) => item.key)).toEqual([
      APP_ROUTES.practiceRecommendations,
      APP_ROUTES.practiceProblems,
    ]);

    expect(groupChildren("writing").map((item) => item.key)).toEqual([
      APP_ROUTES.writing51,
      APP_ROUTES.writing52,
      APP_ROUTES.writing53,
      APP_ROUTES.writing54,
    ]);

    expect(groupChildren("growth").map((item) => item.key)).toEqual([
      APP_ROUTES.growth,
      APP_ROUTES.practiceWeakness,
    ]);

    expect(groupChildren("settings").map((item) => item.key)).toEqual([
      APP_ROUTES.profile,
      APP_ROUTES.settingsLearning,
      APP_ROUTES.settingsAccount,
      APP_ROUTES.settingsLanguage,
      APP_ROUTES.settingsNotifications,
    ]);
  });
});

function collectSidebarKeys(items: readonly SidebarItem[]) {
  return items.flatMap((item) =>
    "children" in item
      ? [item.key, ...item.children.map((child) => child.key)]
      : [item.key],
  );
}

function groupChildren(key: string) {
  const group = SIDEBAR_ITEMS.find(
    (item): item is SidebarGroup => item.key === key && "children" in item,
  );

  expect(group, `${key} sidebar group is missing`).toBeDefined();

  return group?.children ?? [];
}
