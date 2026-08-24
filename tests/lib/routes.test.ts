import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as routes from "../../src/lib/routes";
import type {
  AppRouteSpec,
  AppRouteType,
  FlowRouteSpec,
  FlowRouteType,
  ProtectedRouteCase,
  RouteMiddleware,
  SidebarGroup,
  SidebarItem,
  SidebarLeaf,
  SidebarLockMap,
} from "../../src/lib/routes";

const { APP_ROUTES, computeSidebarLocks } = routes;

type FacadeTypeExports = [
  AppRouteSpec,
  AppRouteType,
  FlowRouteSpec,
  FlowRouteType,
  ProtectedRouteCase,
  RouteMiddleware,
  SidebarGroup,
  SidebarItem,
  SidebarLeaf,
  SidebarLockMap,
];

const facadeTypeExports: FacadeTypeExports | undefined = undefined;
void facadeTypeExports;

const routeLeafModules = ["paths", "flow", "app-specs", "sidebar"] as const;
const routesDirectory = join(process.cwd(), "src", "lib", "routes");

describe("route module boundaries", () => {
  it("re-exports every existing public route symbol through the facade", () => {
    expect(Object.keys(routes).sort()).toEqual(
      [
        "APP_ROUTES",
        "APP_ROUTE_SPECS",
        "AUTH_ENTRY_PATHS",
        "FLOW_ROUTE_SPECS",
        "PROTECTED_ROUTE_CASES",
        "PUBLIC_PATHS",
        "SIDEBAR_ITEMS",
        "WRITING_ROUTE_PATHS_BY_QUESTION",
        "WRITING_ROUTE_SEGMENTS_BY_QUESTION",
        "computeSidebarLocks",
      ].sort(),
    );
  });

  it("keeps leaf modules present and independent from the facade", () => {
    const facadeImportPattern =
      /(?:\bfrom\s+|\bimport\s*\(\s*)["'](?:@\/lib\/routes|src\/lib\/routes|\.{1,2}\/routes)["']/;

    for (const moduleName of routeLeafModules) {
      const modulePath = join(routesDirectory, `${moduleName}.ts`);
      expect(existsSync(modulePath), `${moduleName}.ts must exist`).toBe(true);

      if (!existsSync(modulePath)) continue;

      expect(readFileSync(modulePath, "utf8")).not.toMatch(facadeImportPattern);
    }
  });
});

describe("computeSidebarLocks", () => {
  it("locks writing route leaves for unavailable question types", () => {
    const locks = computeSidebarLocks({
      role: "learner",
      planLabel: null,
      lockedWritingTypes: new Set([51, 54]),
    });

    expect(locks[APP_ROUTES.writing51]).toBe("writingTypeLocked");
    expect(locks[APP_ROUTES.writing54]).toBe("writingTypeLocked");
    expect(locks[APP_ROUTES.writing52]).toBeUndefined();
    expect(locks[APP_ROUTES.practiceProblems]).toBeUndefined();
  });
});
