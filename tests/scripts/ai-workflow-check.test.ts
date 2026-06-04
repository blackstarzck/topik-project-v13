import { describe, expect, test } from "vitest";

// The checker is a plain .mjs script with no type declarations (tsconfig
// allowJs:false), so TS cannot resolve a typed import. The runtime export is
// exercised by every assertion below.
// prettier-ignore
// @ts-expect-error -- .mjs script has no .d.ts; runtime contract verified here
import { checkAppVarUsage, checkInlineAppVarDeclaration, checkRscCompoundRender, checkSmokeCoverage, checkInlineStyleNumbers, checkAntdDeprecations } from "../../scripts/ai-workflow-check.mjs";

// PLAN §Phase 1 (#7·#8) — CSS Variable Scoping Gate, allowlist arm.
// Only the approved 9 `--app-*` names may appear in source. Non-approved names
// such as `--app-bg` / `--app-border` are the dark-mode bug (they fall back to
// #fff because nothing injects them on <html>). The checker must flag them.

describe("checkAppVarUsage — --app-* allowlist", () => {
  test("returns no findings when only approved bridge vars are used", () => {
    const text = [
      "background: var(--app-color-bg-container);",
      "border: 1px solid var(--app-color-border);",
      "color: var(--app-color-text-secondary);",
      "border-radius: var(--app-radius);",
      "box-shadow: var(--app-shadow-elevated);",
      "font-family: var(--app-font-family);",
    ].join("\n");
    expect(checkAppVarUsage(text)).toEqual([]);
  });

  test("flags non-approved --app-* names", () => {
    const text = 'style={{ background: "var(--app-bg, #fff)" }}';
    expect(checkAppVarUsage(text)).toEqual(["--app-bg"]);
  });

  test("flags --app-border and de-duplicates repeated names", () => {
    const text = [
      "border-bottom: 1px solid var(--app-border, #f0f0f0);",
      "border-top: 1px solid var(--app-border);",
    ].join("\n");
    expect(checkAppVarUsage(text)).toEqual(["--app-border"]);
  });

  test("reports every distinct non-approved name", () => {
    const text = "var(--app-bg) var(--app-border) var(--app-color-primary)";
    expect(checkAppVarUsage(text).sort()).toEqual([
      "--app-bg",
      "--app-border",
    ]);
  });
});

// 08 Rule 1: --app-* must be declared on html/:root only — never via style={} on a
// component below html (portal-inheritance + SSR-flash hazard). Even an APPROVED
// name is a violation when DECLARED inline on a component. The allowlist (above)
// only guards names; this guards the declaration location. (codex review P2.)
describe("checkInlineAppVarDeclaration — Rule 1 (no --app-* declared on components)", () => {
  test("flags a quoted --app-* object key (inline style declaration)", () => {
    expect(
      checkInlineAppVarDeclaration('style={{ "--app-color-primary": "#fff" }}'),
    ).toEqual(["--app-color-primary"]);
  });

  test("does NOT flag var(--app-*) consumption (usage is allowed)", () => {
    expect(
      checkInlineAppVarDeclaration("background: var(--app-color-primary)"),
    ).toEqual([]);
  });

  test("flags single-quoted keys and de-duplicates", () => {
    expect(
      checkInlineAppVarDeclaration("{ '--app-bg': '#000', '--app-bg': '#111' }"),
    ).toEqual(["--app-bg"]);
  });
});

// M2: antd compound subcomponents rendered as JSX in a SERVER (RSC) file resolve
// to `undefined` via the client-reference proxy (e.g. <Skeleton.Button> in a
// server loading.tsx → "Element type is invalid"). This is the exact #5 defect.
// Hooks (.useX), type/config member access, plain <Antd/> render, and any file
// with "use client" must NOT be flagged.
describe("checkRscCompoundRender — antd compound render in a server file", () => {
  test("flags <Skeleton.Button> in a server file (no use client) — the #5 defect", () => {
    const text =
      'import { Skeleton } from "antd";\n' +
      "export default function L(){ return <Skeleton.Button active />; }";
    expect(checkRscCompoundRender(text)).toEqual(["Skeleton.Button"]);
  });

  test("does NOT flag when the file is a client component", () => {
    const text =
      '"use client";\n' +
      'import { Skeleton } from "antd";\n' +
      "export default function L(){ return <Skeleton.Button active />; }";
    expect(checkRscCompoundRender(text)).toEqual([]);
  });

  test("does NOT flag antd hooks or non-antd member renders", () => {
    const text =
      'import { Grid, App } from "antd";\n' +
      "const s = Grid.useBreakpoint();\n" +
      "const { message } = App.useApp();\n" +
      "return <Foo.Bar/>;";
    expect(checkRscCompoundRender(text)).toEqual([]);
  });

  test("does NOT flag a plain antd component render (only compound members)", () => {
    const text = 'import { Skeleton, Space } from "antd";\nreturn <Space><Skeleton active/></Space>;';
    expect(checkRscCompoundRender(text)).toEqual([]);
  });

  test("does NOT flag type-only imports", () => {
    const text =
      'import type { TableProps } from "antd";\n' +
      'const c: TableProps["columns"] = [];';
    expect(checkRscCompoundRender(text)).toEqual([]);
  });
});

// M3 — report = evidence. The dev-smoke (M1) artifact, not a hand-written claim,
// decides whether routes were verified. checkSmokeCoverage FAILs when the smoke
// did not boot, when a required route was not actually tested (coverage gap), or
// when the artifact is stale (built at a different commit than HEAD — a stale
// artifact cannot back a current "verified" claim). (PLAN.md §강제성 M3 +
// A0-(3)/(5) validate-the-validator.)
describe("checkSmokeCoverage — testedRoutes ⊇ requiredRoutes + fresh", () => {
  const fresh = (over = {}) => ({
    booted: true,
    headSha: "abc123",
    requiredRoutes: ["/", "/login", "/dashboard"],
    testedRoutes: ["/", "/login", "/dashboard"],
    ...over,
  });

  test("passes when all required routes were tested and the artifact is fresh", () => {
    const r = checkSmokeCoverage(fresh(), "abc123");
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  // validate-the-validator (master plan M3 example): a /dashboard-missing
  // artifact must FAIL.
  test("FAILs when a required route was not tested (the coverage defect)", () => {
    const r = checkSmokeCoverage(
      fresh({ testedRoutes: ["/", "/login"] }),
      "abc123",
    );
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/\/dashboard/);
  });

  test("FAILs when the smoke did not boot", () => {
    const r = checkSmokeCoverage(fresh({ booted: false }), "abc123");
    expect(r.ok).toBe(false);
  });

  // validate-the-validator (no unbacked claim): a stale artifact (built at a
  // different commit) cannot back a current verification claim.
  test("FAILs when the artifact is stale (headSha != current HEAD)", () => {
    const r = checkSmokeCoverage(fresh(), "different-sha");
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/stale/i);
  });

  // Cross-audit P1: vacuous-pass holes.
  test("FAILs when requiredRoutes is empty (nothing verified)", () => {
    const r = checkSmokeCoverage(
      fresh({ requiredRoutes: [], testedRoutes: [] }),
      "abc123",
    );
    expect(r.ok).toBe(false);
  });

  test("FAILs when the artifact has no headSha (freshness unverifiable)", () => {
    const r = checkSmokeCoverage(
      { booted: true, requiredRoutes: ["/"], testedRoutes: ["/"] },
      "abc123",
    );
    expect(r.ok).toBe(false);
  });

  test("FAILs when current HEAD is unknown (fail-closed)", () => {
    const r = checkSmokeCoverage(fresh(), null);
    expect(r.ok).toBe(false);
  });

  // Cross-audit P1: a route listed in testedRoutes but whose perRouteResult shows
  // a failure/fatal/500 must NOT count as verified.
  test("FAILs when a required route has a failing perRouteResult", () => {
    const r = checkSmokeCoverage(
      fresh({
        perRouteResult: [
          { route: "/dashboard", ok: false, fatal: true, status: 500 },
        ],
      }),
      "abc123",
    );
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/\/dashboard/);
  });

  test("strict booted: a non-true truthy value does not count as booted", () => {
    const r = checkSmokeCoverage(
      { booted: "false", headSha: "abc123", requiredRoutes: ["/"], testedRoutes: ["/"] },
      "abc123",
    );
    expect(r.ok).toBe(false);
  });

  test("normalizes trailing slashes when comparing coverage", () => {
    const r = checkSmokeCoverage(
      fresh({ requiredRoutes: ["/dashboard"], testedRoutes: ["/dashboard/"] }),
      "abc123",
    );
    expect(r.ok).toBe(true);
  });
});

// M4 — inline-style delta guard (PLAN.md §강제성 M4 + Phase 2 DoD). New inline
// numeric literals for layout/spacing props should be tokens/constants. Only
// the layout/spacing props are guarded; opacity/zIndex/flex* are exempt; string
// and token values are fine; a `// ai-check: allow-inline-number` comment on the
// line is an escape hatch. (Applied to diff-added lines so pre-existing inline
// styles are not flagged.)
describe("checkInlineStyleNumbers — guarded inline numeric literals", () => {
  // validate-the-validator: the defect — a new inline layout magic number.
  test("flags a bare numeric width", () => {
    expect(checkInlineStyleNumbers("style={{ width: 120 }}")).toEqual([
      "width:120",
    ]);
  });

  test("flags borderRadius and marginTop, ignores order", () => {
    expect(
      checkInlineStyleNumbers("const s = { borderRadius: 8, marginTop: 4 };").sort(),
    ).toEqual(["borderRadius:8", "marginTop:4"]);
  });

  test("does NOT flag exempt props (opacity, zIndex, flex)", () => {
    expect(
      checkInlineStyleNumbers("style={{ opacity: 0.5, zIndex: 10, flex: 1 }}"),
    ).toEqual([]);
  });

  test("does NOT flag string values (e.g. percentages)", () => {
    expect(checkInlineStyleNumbers('style={{ width: "100%" }}')).toEqual([]);
  });

  test("does NOT flag token/constant values", () => {
    expect(
      checkInlineStyleNumbers("style={{ padding: SPACING.md, gap: token.gap }}"),
    ).toEqual([]);
  });

  test("does NOT flag a JSX numeric attribute (width={400})", () => {
    expect(checkInlineStyleNumbers("<Chart width={400} height={300} />")).toEqual(
      [],
    );
  });

  test("escape hatch: allow-inline-number comment on the line suppresses it", () => {
    expect(
      checkInlineStyleNumbers(
        "style={{ width: 120 }} // ai-check: allow-inline-number nav rail",
      ),
    ).toEqual([]);
  });

  // Cross-audit P1: ternary/expression values were missed entirely — the exact
  // target (sidebar collapse width) hides there.
  test("catches numeric literals inside a ternary value", () => {
    const found = checkInlineStyleNumbers(
      "style={{ width: collapsed ? 64 : 240 }}",
    );
    expect(found).toContain("width:64");
    expect(found).toContain("width:240");
  });

  // Cross-audit P1: comments and string literals must not be flagged.
  test("does NOT flag a guarded prop inside a line comment", () => {
    expect(checkInlineStyleNumbers("// the old width: 50 was wrong")).toEqual([]);
  });

  test("does NOT flag a guarded prop inside a string literal", () => {
    expect(
      checkInlineStyleNumbers('const msg = "minWidth: 33 required";'),
    ).toEqual([]);
  });
});

describe("checkAntdDeprecations — M6 antd 6.x deprecation guard", () => {
  // validate-the-validator: the exact defect we just fixed on /dashboard.
  test("flags Space `direction` (the /dashboard defect) → orientation", () => {
    expect(
      checkAntdDeprecations('<Space direction="vertical" size="large">'),
    ).toEqual(["Space `direction` is deprecated → use `orientation`"]);
  });

  test("does NOT flag the migrated `orientation` form", () => {
    expect(checkAntdDeprecations('<Space orientation="vertical">')).toEqual([]);
  });

  // Steps legitimately keeps direction="vertical" — must not false-positive.
  test("does NOT flag direction on a non-Space component (Steps)", () => {
    expect(checkAntdDeprecations('<Steps direction="vertical" />')).toEqual([]);
  });

  test("flags bodyStyle / headStyle / TabPane / dropdownClassName", () => {
    expect(checkAntdDeprecations("<Card bodyStyle={{ padding: 0 }}>")).toEqual([
      "`bodyStyle` is deprecated → use `styles.body` (Card/Modal/Drawer)",
    ]);
    expect(checkAntdDeprecations("<Card headStyle={{}}>")).toEqual([
      "`headStyle` is deprecated → use `styles.header` (Card)",
    ]);
    expect(checkAntdDeprecations("<Tabs.TabPane tab='a' />")).toEqual([
      "`Tabs.TabPane` is removed → use the Tabs `items` prop",
    ]);
    expect(checkAntdDeprecations('<Select dropdownClassName="x" />')).toEqual([
      "`dropdownClassName` is deprecated → use `popupClassName`/`classNames`",
    ]);
  });

  test("escape hatch: allow-antd-deprecated comment suppresses it", () => {
    expect(
      checkAntdDeprecations(
        '<Space direction="vertical"> // ai-check: allow-antd-deprecated legacy shim',
      ),
    ).toEqual([]);
  });

  test("does NOT flag a deprecated token inside a line comment", () => {
    expect(checkAntdDeprecations("// old: <Space direction='vertical'>")).toEqual(
      [],
    );
  });
});
