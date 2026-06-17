import { existsSync, readdirSync, readFileSync } from "node:fs";
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

type WireframePageRoute = {
  iaCode: string;
  route: string;
};

function wireframePageRoutes(): WireframePageRoute[] {
  const root = join(process.cwd(), "docs", "Wireframe");

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, "functional-spec.md"))
    .filter((path) => existsSync(path))
    .map((path) => {
      const content = readFileSync(path, "utf8");
      const iaCode = content.match(
        /^#\s+([A-Z]-\d{2}|[A-Z]-M\d|X-\d{2})\b/m,
      )?.[1];
      const route = content.match(/^- Route:\s+`([^`]+)`/m)?.[1];
      const routeType = content.match(/^- Route type:\s+(.+)$/m)?.[1];

      if (!iaCode || !route || !routeType?.startsWith("page")) {
        return null;
      }

      return { iaCode, route };
    })
    .filter((route): route is WireframePageRoute => route !== null)
    .sort((a, b) => a.iaCode.localeCompare(b.iaCode));
}

describe("user-flow route contract", () => {
  it("covers every Wireframe page route in the central flow route registry", () => {
    const registryByIa = new Map(
      FLOW_ROUTE_SPECS.filter((spec) => spec.routeType.startsWith("page")).map(
        (spec) => [spec.iaCode, spec],
      ),
    );

    for (const expected of wireframePageRoutes()) {
      const actual = registryByIa.get(expected.iaCode);

      expect(
        actual,
        `${expected.iaCode} is missing from FLOW_ROUTE_SPECS`,
      ).toBeDefined();
      expect(actual?.pathPattern ?? actual?.path).toBe(expected.route);
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
    expect(sidebarKeys).not.toContain(APP_ROUTES.feedbackShort);
    expect(sidebarKeys).not.toContain(APP_ROUTES.feedbackLong);
    expect(sidebarKeys).not.toContain(APP_ROUTES.comparisonReport);
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
      APP_ROUTES.settingsLanguage,
      APP_ROUTES.settingsNotifications,
      APP_ROUTES.subscription,
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
