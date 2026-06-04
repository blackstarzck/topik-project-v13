import { describe, expect, test } from "vitest";

// C1 — derive the routes a dev-mode smoke (M1) must cover, from a git diff.
// (PLAN.md §강제성 게이트 표 C1.) Two pure pieces:
//   routeForSpecialFile: a route special file path → its URL segment + kind.
//   deriveRequiredRoutes: changed files (+ page list + reverse-ref map) → the
//     set of visitable routes that must be smoke-tested.
// validate-the-validator: a changed SHARED COMPONENT must pull in every route
// that (transitively) renders it — the exact "hand-picked routes" defect C1 fixes.
//
// .mjs has no .d.ts (tsconfig allowJs:false); runtime contract verified here.
// prettier-ignore
// @ts-expect-error -- .mjs script has no .d.ts
import { routeForSpecialFile, deriveRequiredRoutes, parseImportSpecifiers } from "../../scripts/derive-smoke-routes.mjs";

// Cross-audit P1: a side-effect import like `import "../styles/global.css"` (no
// `from`) was not captured, so global.css fell out of the reverse-ref graph and
// CSS-only changes derived 0 routes (vacuous smoke pass). The specifier parser
// must catch side-effect, from, dynamic, and re-export forms.
describe("parseImportSpecifiers — capture every import form", () => {
  test("captures a side-effect import (no `from`)", () => {
    expect(parseImportSpecifiers('import "../styles/global.css";')).toContain(
      "../styles/global.css",
    );
  });
  test("captures a named `from` import", () => {
    expect(
      parseImportSpecifiers('import { AppCard } from "@/components/shared/AppCard";'),
    ).toContain("@/components/shared/AppCard");
  });
  test("captures dynamic import() and re-export", () => {
    const specs = parseImportSpecifiers(
      'const m = await import("./lazy");\nexport { y } from "./re-exported";',
    );
    expect(specs).toContain("./lazy");
    expect(specs).toContain("./re-exported");
  });
});

describe("routeForSpecialFile — special file path → route segment", () => {
  test("root page → /", () => {
    expect(routeForSpecialFile("src/app/page.tsx")).toEqual({
      segment: "/",
      special: "page",
    });
  });

  test("nested page → its path", () => {
    expect(routeForSpecialFile("src/app/login/page.tsx")).toEqual({
      segment: "/login",
      special: "page",
    });
  });

  test("route group is stripped and loading.tsx is recognized", () => {
    expect(
      routeForSpecialFile("src/app/(workspace)/dashboard/loading.tsx"),
    ).toEqual({ segment: "/dashboard", special: "loading" });
  });

  test("deeper non-grouped page keeps its path", () => {
    expect(
      routeForSpecialFile("src/app/dev-preview/dashboard/page.tsx"),
    ).toEqual({ segment: "/dev-preview/dashboard", special: "page" });
  });

  test("group-level layout maps to the stripped segment", () => {
    expect(routeForSpecialFile("src/app/(workspace)/layout.tsx")).toEqual({
      segment: "/",
      special: "layout",
    });
  });

  test("non-route file → null", () => {
    expect(routeForSpecialFile("src/components/shared/AppCard.tsx")).toBeNull();
  });
});

describe("deriveRequiredRoutes — changed files → required smoke routes", () => {
  const pageRoutes = ["/", "/login", "/dashboard"];

  test("a changed route special file yields its own route", () => {
    const result = deriveRequiredRoutes({
      changedFiles: ["src/app/(workspace)/dashboard/loading.tsx"],
      pageRoutes,
      reverseRefs: {},
    });
    expect(result.requiredRoutes).toContain("/dashboard");
  });

  // validate-the-validator: the defect C1 exists to fix — a shared component
  // change must surface EVERY route that renders it, not a hand-picked subset.
  test("a changed shared component pulls in every route that renders it", () => {
    const result = deriveRequiredRoutes({
      changedFiles: ["src/components/shared/AppCard.tsx"],
      pageRoutes,
      reverseRefs: {
        "src/components/shared/AppCard.tsx": ["/dashboard", "/login"],
      },
    });
    expect(result.requiredRoutes).toEqual(["/dashboard", "/login"]);
  });

  test("a changed ROOT layout over-approximates to all page routes and flags it", () => {
    const result = deriveRequiredRoutes({
      changedFiles: ["src/app/(workspace)/layout.tsx"],
      pageRoutes,
      reverseRefs: {},
    });
    expect(result.requiredRoutes).toEqual(["/", "/dashboard", "/login"]);
    expect(result.overApproximated).toBe(true);
  });

  // Cross-audit P2: a nested non-group layout must scope to its OWN subtree, not
  // all routes. An admin layout change → only /admin/* → then admin-frozen → [].
  test("a changed nested layout scopes to its subtree (admin → frozen → empty)", () => {
    const result = deriveRequiredRoutes({
      changedFiles: ["src/app/(workspace)/admin/layout.tsx"],
      pageRoutes: ["/", "/login", "/dashboard", "/admin", "/admin/users"],
      reverseRefs: {},
    });
    expect(result.requiredRoutes).toEqual([]); // /admin subtree excluded as frozen
    expect(result.requiredRoutes).not.toContain("/login");
    expect(result.overApproximated).toBe(false);
  });

  test("de-duplicates and sorts when the same route is hit twice", () => {
    const result = deriveRequiredRoutes({
      changedFiles: [
        "src/app/(workspace)/dashboard/loading.tsx",
        "src/app/(workspace)/dashboard/page.tsx",
      ],
      pageRoutes,
      reverseRefs: {},
    });
    expect(result.requiredRoutes).toEqual(["/dashboard"]);
  });

  test("ignores changed files that map to no visitable route", () => {
    const result = deriveRequiredRoutes({
      changedFiles: ["README.md", "src/lib/unused-helper.ts"],
      pageRoutes,
      reverseRefs: {},
    });
    expect(result.requiredRoutes).toEqual([]);
  });

  // Admin is frozen (PLAN.md scope) — even when a root layout change reaches it,
  // it must NOT be a smoke target. Exclusion is recorded, never silent.
  test("excludes admin routes (frozen) and records the reason", () => {
    const result = deriveRequiredRoutes({
      changedFiles: ["src/app/layout.tsx"],
      pageRoutes: ["/", "/login", "/dashboard", "/admin", "/admin/users"],
      reverseRefs: {},
    });
    expect(result.requiredRoutes).toEqual(["/", "/dashboard", "/login"]);
    expect(result.excludedRoutes).toEqual(
      expect.arrayContaining([
        { route: "/admin", reason: "admin-frozen" },
        { route: "/admin/users", reason: "admin-frozen" },
      ]),
    );
  });

  // Dynamic segments aren't directly visitable without param fixtures
  // (expansion-tier) — excluded with a reason, not silently dropped.
  test("excludes dynamic-segment routes and records the reason", () => {
    const result = deriveRequiredRoutes({
      changedFiles: ["src/app/layout.tsx"],
      pageRoutes: ["/", "/writing/[questionId]"],
      reverseRefs: {},
    });
    expect(result.requiredRoutes).toEqual(["/"]);
    expect(result.excludedRoutes).toContainEqual({
      route: "/writing/[questionId]",
      reason: "dynamic-segment",
    });
  });
});
