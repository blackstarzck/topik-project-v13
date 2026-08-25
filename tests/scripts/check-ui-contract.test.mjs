import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = join(fileURLToPath(new URL("../..", import.meta.url)));

import {
  collectUiSources,
  readBaseContractTuple,
  resolveBaseRef,
  runUiContractCli as runUiContractCliRaw,
} from "../../scripts/check-ui-contract.mjs";

import {
  computeBaselineApprovalDigest,
} from "../../scripts/lib/ui-contract-trust.mjs";

import {
  UI_CONTRACT_SCANNER_VERSION,
  applyUiContractExceptions,
  assertCandidateMatchesCurrent,
  compareAgainstBase,
  createUiContractBaseline,
  createViolation,
  formatUiContractReport,
  normalizeRepoPath,
  parseUiSource,
  scanUiContract,
  validateApprovalManifest,
  validateExceptionManifest,
  validateUiContractBaseline,
} from "../../scripts/lib/ui-contract.mjs";

function source(path, content) {
  return { path, content };
}

function ruleIds(result) {
  return result.violations.map((violation) => violation.ruleId);
}

function fingerprintsFor(result, ruleId) {
  return result.violations
    .filter((violation) => violation.ruleId === ruleId)
    .map((violation) => violation.fingerprint)
    .sort();
}

function runUiContractCli(argv, options = {}) {
  return runUiContractCliRaw(argv, {
    computeScannerDigestImpl: () => "0".repeat(64),
    ...options,
  });
}

const temporaryRoots = [];

function temporaryRoot(prefix = "v13-ui-contract-") {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("UI contract parser foundation", () => {
  it("selects the parser kind from the source extension", () => {
    expect(parseUiSource(source("src/example.ts", "export const value = 1;")).scriptKind).toBe(
      "TS",
    );
    expect(
      parseUiSource(source("src/example.tsx", "export const view = <div />;"))
        .scriptKind,
    ).toBe("TSX");
    expect(parseUiSource(source("src/example.js", "export const value = 1;")).scriptKind).toBe(
      "JS",
    );
    expect(
      parseUiSource(source("src/example.jsx", "export const view = <div />;"))
        .scriptKind,
    ).toBe("JSX");
    expect(parseUiSource(source("src/styles/example.css", ".card { color: red; }"))).toMatchObject({
      kind: "css",
      scriptKind: null,
    });
  });

  it("fails closed on malformed TypeScript and CSS", () => {
    expect(() => parseUiSource(source("src/example.tsx", "export const view = <div>;"))).toThrow(
      expect.objectContaining({ code: "UI_CONTRACT_PARSE_ERROR" }),
    );
    expect(() => parseUiSource(source("src/styles/example.css", ".card { color: red;"))).toThrow(
      expect.objectContaining({ code: "UI_CONTRACT_PARSE_ERROR" }),
    );
  });

  it("does not treat comments or ordinary strings as UI violations", () => {
    const result = scanUiContract([
      source(
        "src/example.tsx",
        `
          // <main style={{ color: "#fff" }} className="bg-[#fff]" />
          const prose = '<main style={{ color: "#fff" }}>bg-[#fff]</main>';
          export function Example() { return <div>{prose}</div>; }
        `,
      ),
      source(
        "src/styles/example.css",
        `
          /* .ant-btn:hover { color: #fff; } */
          .safe { color: var(--app-text-primary); }
        `,
      ),
    ]);

    expect(result.violations).toEqual([]);
  });
});

describe("UI contract normalization", () => {
  it("normalizes Windows and POSIX repository paths deterministically", () => {
    expect(normalizeRepoPath("src\\폴더\\Example.tsx")).toBe("src/폴더/Example.tsx");
    expect(
      normalizeRepoPath("C:\\Repo Root\\src\\폴더\\Example.tsx", "c:\\repo root"),
    ).toBe("src/폴더/Example.tsx");
    expect(normalizeRepoPath("/repo root/src/example.ts", "/repo root")).toBe("src/example.ts");
  });

  it("rejects paths outside the repository root", () => {
    expect(() => normalizeRepoPath("C:\\outside\\example.ts", "C:\\repo root")).toThrow(
      expect.objectContaining({ code: "UI_SOURCE_OUTSIDE_ROOT" }),
    );
    expect(() => normalizeRepoPath("../outside/example.ts")).toThrow(
      expect.objectContaining({ code: "UI_SOURCE_OUTSIDE_ROOT" }),
    );
  });

  it("keeps fingerprints stable across line numbers, separators, and harmless whitespace", () => {
    const left = createViolation({
      ruleId: "react.static-inline-style",
      path: "src\\폴더\\Example.tsx",
      line: 2,
      semanticKey: "style : color = #fff",
      lexeme: "style={{ color: '#fff' }}",
    });
    const right = createViolation({
      ruleId: "react.static-inline-style",
      path: "src/폴더/Example.tsx",
      line: 200,
      semanticKey: "  style : color = #fff  ",
      lexeme: "style={{ color: '#fff' }}",
    });

    expect(UI_CONTRACT_SCANNER_VERSION).toBe(4);
    expect(left.fingerprint).toBe(right.fingerprint);
    expect(left.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("bounds and escapes public lexemes", () => {
    const violation = createViolation({
      ruleId: "visual.raw-color",
      path: "src/example.tsx",
      line: 1,
      semanticKey: "color:#fff",
      lexeme: `${"x".repeat(200)}\nsecret`,
    });

    expect(violation.lexeme.length).toBeLessThanOrEqual(160);
    expect(violation.lexeme).not.toContain("\n");
  });
});

describe("UI contract TSX rules", () => {
  it("detects raw visual colors in JSX attributes and identifier bindings", () => {
    const result = scanUiContract([
      source(
        "src/components/example/RawVisual.tsx",
        `
          const red = "#ff0000";
          const visual = { color: red };
          export function RawVisual() {
            return <svg color={red} fill="#00ff00" stroke={red} data-visual={visual.color} />;
          }
        `,
      ),
    ]);

    expect(ruleIds(result).filter((id) => id === "visual.raw-color")).toHaveLength(4);
  });

  it("detects raw colors through object properties, JSX shorthand spreads, concatenation, and local imports", () => {
    const result = scanUiContract([
      source(
        "src/components/example/RawVisualBypasses.tsx",
        `
          import { importedDanger } from "./raw-palette";

          const palette = { danger: "#f00" };
          const color = "#0f0";
          const objectVisual = { color: palette.danger };
          const concatenatedVisual = { fill: "#" + "00f" };
          const importedVisual = { stroke: importedDanger };

          export function RawVisualBypasses() {
            return <svg {...{ color }} />;
          }
        `,
      ),
      source(
        "src/components/example/raw-palette.ts",
        `export const importedDanger = "rgb(255 0 0)";`,
      ),
    ]);

    const rawColors = result.violations.filter(
      (violation) => violation.ruleId === "visual.raw-color",
    );
    expect(rawColors).toHaveLength(4);
    expect(rawColors.map((violation) => violation.path)).toEqual(
      Array(4).fill("src/components/example/RawVisualBypasses.tsx"),
    );
    expect(rawColors.map((violation) => violation.line).sort((left, right) => left - right)).toEqual([
      6, 7, 8, 11,
    ]);
    expect(rawColors.map((violation) => violation.lexeme).sort()).toEqual([
      "color:#0f0",
      "color:#f00",
      "fill:#00f",
      "stroke:rgb(255 0 0)",
    ]);
  });

  it("detects raw colors through object spreads, template interpolation, and destructuring aliases", () => {
    const result = scanUiContract([
      source(
        "src/components/example/MoreRawVisualBypasses.tsx",
        `
          const base = { danger: "#f00" };
          const palette = { ...base };
          const interpolated = \`#\${"f00"}\`;
          const { danger: destructured } = base;
          export function MoreRawVisualBypasses() {
            return <svg fill={palette.danger} stroke={interpolated} color={destructured} />;
          }
        `,
      ),
    ]);

    const rawColors = result.violations.filter(
      (violation) => violation.ruleId === "visual.raw-color",
    );
    expect(rawColors).toHaveLength(3);
    expect(rawColors.map((violation) => violation.lexeme).sort()).toEqual([
      "color:#f00",
      "fill:#f00",
      "stroke:#f00",
    ]);
  });

  it("detects raw colors through default, namespace, and barrel imports", () => {
    const result = scanUiContract([
      source(
        "src/components/example/ImportedRawVisuals.tsx",
        `
          import defaultDanger from "./default-palette";
          import * as palette from "./named-palette";
          import { danger as barrelDanger } from "./palette-barrel";
          export function ImportedRawVisuals() {
            return <svg fill={defaultDanger} stroke={palette.danger} color={barrelDanger} />;
          }
        `,
      ),
      source(
        "src/components/example/default-palette.ts",
        `const danger = "#f00"; export default danger;`,
      ),
      source(
        "src/components/example/named-palette.ts",
        `export const danger = "rgb(255 0 0)";`,
      ),
      source(
        "src/components/example/palette-barrel.ts",
        `export { danger } from "./named-palette";`,
      ),
    ]);

    const rawColors = result.violations.filter(
      (violation) => violation.ruleId === "visual.raw-color",
    );
    expect(rawColors).toHaveLength(3);
    expect(rawColors.map((violation) => violation.lexeme).sort()).toEqual([
      "color:rgb(255 0 0)",
      "fill:#f00",
      "stroke:rgb(255 0 0)",
    ]);
  });

  it("tracks namespace aliases, namespace exports, and imported default forwarding", () => {
    const result = scanUiContract([
      source(
        "src/components/example/ForwardedRawVisuals.tsx",
        `
          import * as raw from "./forward-palette";
          import { palette } from "./namespace-barrel";
          import defaultDanger from "./default-forward";
          const alias = raw;
          const { danger } = raw;
          export function ForwardedRawVisuals() {
            return <svg fill={alias.danger} stroke={danger} color={palette.danger} floodColor={defaultDanger} />;
          }
        `,
      ),
      source(
        "src/components/example/forward-palette.ts",
        `export const danger = "#f00";`,
      ),
      source(
        "src/components/example/namespace-barrel.ts",
        `export * as palette from "./forward-palette";`,
      ),
      source(
        "src/components/example/default-forward.ts",
        `import { danger } from "./forward-palette"; export default danger;`,
      ),
    ]);

    const rawColors = result.violations.filter(
      (violation) => violation.ruleId === "visual.raw-color",
    );
    expect(rawColors).toHaveLength(4);
    expect(rawColors.map((violation) => violation.lexeme).sort()).toEqual([
      "color:#f00",
      "fill:#f00",
      "floodColor:#f00",
      "stroke:#f00",
    ]);
  });

  it("evaluates frozen objects, constant conditionals, and static array indexes", () => {
    const result = scanUiContract([
      source(
        "src/components/example/StaticExpressionRawVisuals.tsx",
        `
          const palette = Object.freeze({ danger: "#f00" });
          const enabled = true;
          const choice = enabled ? "#0f0" : "#00f";
          const colors = ["rgb(1 2 3)"] as const;
          export function StaticExpressionRawVisuals() {
            return <svg fill={palette.danger} stroke={choice} color={colors[0]} />;
          }
        `,
      ),
    ]);

    const rawColors = result.violations.filter(
      (violation) => violation.ruleId === "visual.raw-color",
    );
    expect(rawColors).toHaveLength(3);
    expect(rawColors.map((violation) => violation.lexeme).sort()).toEqual([
      "color:rgb(1 2 3)",
      "fill:#f00",
      "stroke:#0f0",
    ]);
  });

  it("detects raw values in every statically known runtime conditional branch", () => {
    const result = scanUiContract([
      source(
        "src/components/example/RuntimeConditionalRawVisuals.tsx",
        `
          declare const enabled: boolean;
          const color = enabled ? "#f00" : "#0f0";
          const visual = { fill: enabled ? "#00f" : "rgb(1 2 3)" };
          export function RuntimeConditionalRawVisuals() {
            return <svg stroke={color} color={enabled ? "#f0f" : "#ff0"} {...visual} />;
          }
        `,
      ),
    ]);

    expect(
      result.violations.filter((violation) => violation.ruleId === "visual.raw-color"),
    ).toHaveLength(3);
  });

  it("detects logical raw branches, array destructuring, and computed properties", () => {
    const result = scanUiContract([
      source(
        "src/components/example/MoreStaticRawVisuals.tsx",
        `
          declare const color: string | undefined;
          declare const active: boolean;
          const [danger] = ["#f00"] as const;
          const palette = { ["danger"]: "#0f0" };
          const [fallbackArray = "#0ff"] = [] as string[];
          const { fallbackObject = "#f80" } = {} as { fallbackObject?: string };
          declare const input: { dynamicDefault?: string };
          const { dynamicDefault = "#808" } = input;
          const { undefinedDefault = "#880" } = { undefinedDefault: undefined } as const;
          const key = "danger";
          const computedPalette = { [key]: "#08f" };
          export function MoreStaticRawVisuals() {
            return <svg fill={color ?? "#00f"} stroke={color || "#f0f"} color={active && "#ff0"} floodColor={danger} lightingColor={palette.danger} stopColor={fallbackArray} borderColor={fallbackObject} outlineColor={computedPalette.danger} textDecorationColor={dynamicDefault} columnRuleColor={undefinedDefault} />;
          }
        `,
      ),
    ]);
    expect(
      result.violations
        .filter((violation) => violation.ruleId === "visual.raw-color")
        .map((violation) => violation.lexeme)
        .sort(),
    ).toEqual([
      "borderColor:#f80",
      "color:#ff0",
      "columnRuleColor:#880",
      "fill:#00f",
      "floodColor:#f00",
      "lightingColor:#0f0",
      "outlineColor:#08f",
      "stopColor:#0ff",
      "stroke:#f0f",
      "textDecorationColor:#808",
    ]);
  });

  it("keeps canonical theme tokens and DifficultyMeter raw palette values allowed", () => {
    const result = scanUiContract([
      source(
        "src/components/example/ThemeConsumer.tsx",
        `
          import { semanticDanger } from "@/theme/semantic-colors";
          const visual = { color: semanticDanger };
          export function ThemeConsumer() { return <span>{visual.color}</span>; }
        `,
      ),
      source(
        "src/theme/semantic-colors.ts",
        `export const semanticDanger = "#ef4444";`,
      ),
      source(
        "src/components/practice/DifficultyMeter.tsx",
        `
          const difficultyColor = "#f97316";
          const difficultyVisual = { color: difficultyColor };
          export function DifficultyMeter() { return <svg {...{ fill: difficultyColor }} />; }
        `,
      ),
    ]);

    expect(ruleIds(result)).not.toContain("visual.raw-color");
  });

  it("does not treat mutable or cyclic bindings as stable static values", () => {
    const result = scanUiContract([
      source(
        "src/components/example/MutableVisual.tsx",
        `
          let mutableColor = "#f00";
          mutableColor = getRuntimeColor();
          const first = second;
          const second = first;
          const mutableVisual = { color: mutableColor };
          const cyclicVisual = { fill: first };
          export function MutableVisual() {
            return <span>{mutableVisual.color}{cyclicVisual.fill}</span>;
          }
        `,
      ),
    ]);

    expect(ruleIds(result)).not.toContain("visual.raw-color");
  });

  it("detects project-authored style and AntD styles props through the AST", () => {
    const result = scanUiContract([
      source(
        "src/components/example/InlineStyle.tsx",
        `
          const cardStyle = { color: "#ff0000" };
          export function InlineStyle() {
            return (
              <>
                <div style={{ paddingTop: 12 }} />
                <Card styles={{ body: cardStyle }} />
                <div style={cardStyle} />
              </>
            );
          }
        `,
      ),
    ]);

    expect(ruleIds(result).filter((id) => id === "react.static-inline-style")).toHaveLength(3);
  });

  it("does not detect unrelated object literals, comments, or strings as inline styles", () => {
    const result = scanUiContract([
      source(
        "src/components/example/AllowedObject.tsx",
        `
          // <div style={{ color: "#fff" }} />
          const copy = "style={{ color: '#fff' }}";
          const payload = { styles: { color: "#fff" }, style: "formal" };
          export function AllowedObject() { return <div>{copy}{payload.style}</div>; }
        `,
      ),
    ]);

    expect(ruleIds(result)).not.toContain("react.static-inline-style");
  });

  it("changes inline-style fingerprints when a referenced const initializer changes", () => {
    const scan = (padding) =>
      scanUiContract([
        source(
          "src/components/example/InlineBinding.tsx",
          `
            const visual = { padding: ${padding} };
            export function InlineBinding() { return <div style={visual} />; }
          `,
        ),
      ]);

    expect(fingerprintsFor(scan(8), "react.static-inline-style")).not.toEqual(
      fingerprintsFor(scan(80), "react.static-inline-style"),
    );
  });

  it("changes inline-style fingerprints when local helpers or repo imports change", () => {
    const scanHelper = (padding) =>
      scanUiContract([
        source(
          "src/components/example/InlineHelper.tsx",
          `
            function makeVisual() { return { padding: ${padding} }; }
            export function InlineHelper() { return <div style={makeVisual()} />; }
          `,
        ),
      ]);
    const scanImport = (padding) =>
      scanUiContract([
        source(
          "src/components/example/ImportedVisual.tsx",
          `
            import { visual } from "./visual";
            export function ImportedVisual() { return <div style={visual} />; }
          `,
        ),
        source(
          "src/components/example/visual.ts",
          `export const visual = { padding: ${padding} };`,
        ),
      ]);

    expect(fingerprintsFor(scanHelper(8), "react.static-inline-style")).not.toEqual(
      fingerprintsFor(scanHelper(80), "react.static-inline-style"),
    );
    expect(fingerprintsFor(scanImport(8), "react.static-inline-style")).not.toEqual(
      fingerprintsFor(scanImport(80), "react.static-inline-style"),
    );
  });

  it("resolves inline-style bindings from the nearest lexical scope", () => {
    const scan = (padding) =>
      scanUiContract([
        source(
          "src/components/example/ShadowedInline.tsx",
          `
            const visual = { padding: ${padding} };
            export function ShadowedInline() { return <div style={visual} />; }
            function UnrelatedScope() {
              const visual = { padding: 999 };
              return visual;
            }
          `,
        ),
      ]);

    expect(fingerprintsFor(scan(8), "react.static-inline-style")).not.toEqual(
      fingerprintsFor(scan(80), "react.static-inline-style"),
    );
  });

  it("resolves inline-style bindings declared by a loop initializer", () => {
    const scan = (padding) =>
      scanUiContract([
        source(
          "src/components/example/LoopInline.tsx",
          `
            export function LoopInline({ ready }) {
              for (const visual = { padding: ${padding} }; ready; ) {
                return <div style={visual} />;
              }
              return null;
            }
          `,
        ),
      ]);

    expect(fingerprintsFor(scan(8), "react.static-inline-style")).not.toEqual(
      fingerprintsFor(scan(80), "react.static-inline-style"),
    );
  });

  it("detects arbitrary visual Tailwind tokens in class expressions and project helpers", () => {
    const result = scanUiContract([
      source(
        "src/components/example/ArbitraryClasses.tsx",
        `
          const cardClasses = "rounded-[13px] shadow-[0_1px_2px_#000]";
          export function ArbitraryClasses({ active }) {
            return (
              <div
                className={classNames(
                  cardClasses,
                  ["bg-[#fff]", active && \`text-[#111] max-w-[641px]\`].join(" "),
                )}
              />
            );
          }
        `,
      ),
    ]);

    expect(ruleIds(result).filter((id) => id === "tailwind.arbitrary-visual")).toHaveLength(5);
  });

  it("detects raw visual values only in recognized property contexts", () => {
    const result = scanUiContract([
      source(
        "src/components/example/RawValues.tsx",
        `
          const visual = {
            color: "#ff0000",
            borderRadius: "13px",
            boxShadow: "0 1px 2px rgb(0 0 0 / 20%)",
            fontFamily: "Comic Sans MS",
          };
          const prose = "Use #ff0000 in the design guide";
          export function RawValues() { return <div>{prose}{visual.color}</div>; }
        `,
      ),
    ]);

    expect(ruleIds(result).filter((id) => id === "visual.raw-color")).toHaveLength(1);
    expect(
      ruleIds(result).filter((id) => id === "visual.raw-radius-shadow-font"),
    ).toHaveLength(3);
  });

  it("allows semantic Tailwind utilities and canonical theme visual values", () => {
    const result = scanUiContract([
      source(
        "src/components/example/SemanticClasses.tsx",
        `
          const prose = "Use #ff0000 in prose only";
          export function SemanticClasses() {
            return <div className="flex max-w-screen-md rounded-lg bg-surface text-text-primary">{prose}</div>;
          }
        `,
      ),
      source(
        "src/theme/tokens.ts",
        `export const tokens = { color: "#ff0000", borderRadius: "13px" };`,
      ),
    ]);

    expect(ruleIds(result)).not.toContain("tailwind.arbitrary-visual");
    expect(ruleIds(result)).not.toContain("visual.raw-color");
    expect(ruleIds(result)).not.toContain("visual.raw-radius-shadow-font");
  });

  it("detects protected AntD imports, aliases, namespace use, and re-exports", () => {
    const result = scanUiContract([
      source(
        "src/components/example/RawAntd.tsx",
        `
          import { Card, Modal as Dialog, Button } from "antd";
          import * as Antd from "antd";
          export { Drawer } from "antd";
          export function RawAntd() {
            return <><Card /><Dialog /><Antd.Drawer /><Button /></>;
          }
        `,
      ),
    ]);

    expect(ruleIds(result).filter((id) => id === "antd.shared-wrapper-bypass")).toHaveLength(4);
  });

  it("allows project wrappers, type imports, and unrelated dynamic imports", () => {
    const result = scanUiContract([
      source(
        "src/components/example/ProjectCard.tsx",
        `
          import type { CardProps } from "antd";
          import { Card } from "@/components/example/Card";
          export async function ProjectCard() {
            await import("./lazy-helper");
            return <Card />;
          }
        `,
      ),
      source(
        "src/components/shared/AppCard.tsx",
        `import { Card } from "antd"; export const AppCard = Card;`,
      ),
    ]);

    expect(ruleIds(result)).not.toContain("antd.shared-wrapper-bypass");
  });

  it("allows inline type-only imports and exports from protected AntD subpaths", () => {
    const result = scanUiContract([
      source(
        "src/components/example/AntdTypes.ts",
        `
          import { type CardProps } from "antd/es/card";
          export { type DrawerProps } from "antd/es/drawer";
          export type { ModalProps } from "antd/lib/modal";
          export type Props = CardProps;
        `,
      ),
    ]);

    expect(ruleIds(result)).not.toContain("antd.shared-wrapper-bypass");
  });

  it("fails closed on dynamic AntD imports", () => {
    expect(() =>
      scanUiContract([
        source(
          "src/components/example/DynamicAntd.tsx",
          `export async function loadCard() { return import("antd"); }`,
        ),
      ]),
    ).toThrow(expect.objectContaining({ code: "UI_CONTRACT_UNSUPPORTED_DYNAMIC_ANTD_IMPORT" }));
  });

  it("detects protected AntD subpaths and fails closed on star or CommonJS access", () => {
    const subpaths = scanUiContract([
      source(
        "src/components/example/SubpathAntd.tsx",
        `
          import Card from "antd/es/card";
          import Drawer from "antd/lib/drawer";
          export function SubpathAntd() { return <><Card /><Drawer /></>; }
        `,
      ),
    ]);
    expect(
      ruleIds(subpaths).filter((id) => id === "antd.shared-wrapper-bypass"),
    ).toHaveLength(2);

    for (const content of [
      `export * from "antd";`,
      `export * as Antd from "antd";`,
      `import Antd from "antd"; export const Raw = Antd;`,
      `const { Card } = require("antd"); export const Raw = Card;`,
    ]) {
      expect(() =>
        scanUiContract([source("src/components/example/UnsupportedAntd.tsx", content)]),
      ).toThrow(expect.objectContaining({ code: "UI_CONTRACT_UNSUPPORTED_ANTD_ACCESS" }));
    }
  });

  it("detects extra main landmarks and workspace pages without a body recipe", () => {
    const result = scanUiContract([
      source(
        "src/app/(workspace)/example/page.tsx",
        `export default function Page() { return <main><div /></main>; }`,
      ),
    ]);

    expect(ruleIds(result)).toEqual(
      expect.arrayContaining(["workspace.extra-main", "workspace.missing-body-recipe"]),
    );
  });

  it("checks JavaScript workspace page extensions for the body recipe", () => {
    const result = scanUiContract([
      source(
        "src/app/(workspace)/javascript/page.jsx",
        `export default function Page() { return <div />; }`,
      ),
    ]);

    expect(
      result.violations.some(
        (violation) =>
          violation.ruleId === "workspace.missing-body-recipe" &&
          violation.path === "src/app/(workspace)/javascript/page.jsx",
      ),
    ).toBe(true);
  });

  it("accepts a direct WorkspaceBody recipe", () => {
    const result = scanUiContract([
      source(
        "src/app/(workspace)/direct/page.tsx",
        `
          import { WorkspaceBody } from "@/components/app/WorkspaceBody";
          export default function Page() { return <WorkspaceBody variant="form" />; }
        `,
      ),
    ]);

    expect(ruleIds(result)).not.toContain("workspace.missing-body-recipe");
  });

  it("follows bounded local component and render-function delegation", () => {
    const result = scanUiContract([
      source(
        "src/app/(workspace)/delegated/page.tsx",
        `
          import { DelegatedScreen } from "@/components/example/DelegatedScreen";
          export default function Page() { return <DelegatedScreen />; }
        `,
      ),
      source(
        "src/components/example/DelegatedScreen.tsx",
        `
          import { WorkspaceBody } from "@/components/app/WorkspaceBody";
          export function DelegatedScreen() { return <WorkspaceBody variant="task" />; }
        `,
      ),
      source(
        "src/app/(workspace)/rendered/page.tsx",
        `
          import { renderScreen } from "./render-screen";
          export default function Page() { return renderScreen(); }
        `,
      ),
      source(
        "src/app/(workspace)/rendered/render-screen.tsx",
        `
          import { WorkspaceBody } from "@/components/app/WorkspaceBody";
          export function renderScreen() { return <WorkspaceBody variant="wide" />; }
        `,
      ),
    ]);

    const missingPaths = result.violations
      .filter((violation) => violation.ruleId === "workspace.missing-body-recipe")
      .map((violation) => violation.path);
    expect(missingPaths).toEqual([]);
  });

  it("does not accept an unused import or raw workspace-body class as a recipe", () => {
    const result = scanUiContract([
      source(
        "src/app/(workspace)/manual/page.tsx",
        `
          import { UnusedScreen } from "./unused";
          export default function Page() { return <div className="app-workspace-body" />; }
        `,
      ),
      source(
        "src/app/(workspace)/manual/unused.tsx",
        `
          import { WorkspaceBody } from "@/components/app/WorkspaceBody";
          export function UnusedScreen() { return <WorkspaceBody />; }
        `,
      ),
    ]);

    expect(
      result.violations.some(
        (violation) =>
          violation.ruleId === "workspace.missing-body-recipe" &&
          violation.path === "src/app/(workspace)/manual/page.tsx",
      ),
    ).toBe(true);
  });
});

describe("UI contract CSS rules", () => {
  it("detects raw CSS colors, radius, shadow, and font values", () => {
    const result = scanUiContract([
      source(
        "src/styles/component.css",
        `
          .card {
            color: #ff0000;
            border-radius: 13px;
            box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
            font-family: "Comic Sans MS";
          }
        `,
      ),
    ]);

    expect(ruleIds(result).filter((id) => id === "visual.raw-color")).toHaveLength(1);
    expect(
      ruleIds(result).filter((id) => id === "visual.raw-radius-shadow-font"),
    ).toHaveLength(3);
  });

  it("detects named CSS colors while allowing semantic color keywords", () => {
    const result = scanUiContract([
      source(
        "src/styles/named-colors.css",
        `
          .raw { color: red; }
          :root { --page-color: rebeccapurple; }
          .semantic { color: currentColor; border-color: transparent; fill: none; }
        `,
      ),
    ]);

    expect(ruleIds(result).filter((id) => id === "visual.raw-color")).toHaveLength(2);
  });

  it("detects modern color functions, gradient named colors, and non-app variables", () => {
    const result = scanUiContract([
      source(
        "src/styles/modern-colors.css",
        `
          .modern {
            color: lab(50% 40 30);
            border-color: hwb(120 10% 20%);
            background: color-mix(in srgb, red 40%, blue);
            background-image: linear-gradient(red, blue);
          }
          :root { --page-color: var(--rogue-color); }
          .rogue { color: var(--rogue-color); }
          .semantic { color: var(--app-color-text); }
        `,
      ),
    ]);

    expect(ruleIds(result).filter((id) => id === "visual.raw-color")).toHaveLength(6);
  });

  it("ignores color-looking tokens inside CSS strings and URLs", () => {
    const result = scanUiContract([
      source(
        "src/styles/image-urls.css",
        `
          .quoted { background-image: url("/assets/red/color(#fff).svg"); }
          .bare { background-image: url(/assets/blue/icon.svg); }
          .string { background-image: "linear-gradient(red, blue)"; }
        `,
      ),
    ]);

    expect(ruleIds(result)).not.toContain("visual.raw-color");
  });

  it("allows semantic app variables in the Tailwind bridge", () => {
    const result = scanUiContract([
      source(
        "src/styles/bridge.css",
        `
          @theme inline {
            --color-background: var(--app-color-bg-layout);
            --radius-default: var(--app-radius);
            --shadow-elevated: var(--app-shadow-elevated);
            --font-sans: var(--app-font-family);
          }
        `,
      ),
    ]);

    expect(ruleIds(result)).not.toContain("visual.raw-color");
    expect(ruleIds(result)).not.toContain("visual.raw-radius-shadow-font");
  });

  it("detects raw visual custom properties outside the canonical bridge", () => {
    const result = scanUiContract([
      source(
        "src/styles/component.css",
        `:root { --page-color: #fff; --page-radius: 12px; --font-body: "Comic Sans MS"; }`,
      ),
    ]);

    expect(ruleIds(result).filter((id) => id === "visual.raw-color")).toHaveLength(1);
    expect(
      ruleIds(result).filter((id) => id === "visual.raw-radius-shadow-font"),
    ).toHaveLength(2);
  });

  it("detects broad AntD state overrides through PostCSS rules", () => {
    const result = scanUiContract([
      source(
        "src/styles/component.css",
        `
          .page .ant-btn:hover { color: var(--app-color-text); }
          .ant-menu-item-selected,
          .ant-input:focus-visible { outline: none; }
          .project-button:hover { color: var(--app-color-text); }
        `,
      ),
    ]);

    expect(ruleIds(result).filter((id) => id === "antd.broad-state-override")).toHaveLength(
      2,
    );
  });

  it("fingerprints global selectors and declarations independent of formatting and order", () => {
    const left = scanUiContract([
      source(
        "src/styles/global.css",
        `.card, .panel > .title { color: var(--app-color-text); padding: 8px 16px; }`,
      ),
    ]);
    const right = scanUiContract([
      source(
        "src/styles/global.css",
        `
          .card,.panel>.title {
            padding: 8px   16px;
            /* formatting-only comment */
            color: var(--app-color-text);
          }
        `,
      ),
    ]);

    expect(fingerprintsFor(left, "global-css.selector-freeze")).toEqual(
      fingerprintsFor(right, "global-css.selector-freeze"),
    );
    expect(fingerprintsFor(left, "global-css.declaration-freeze")).toEqual(
      fingerprintsFor(right, "global-css.declaration-freeze"),
    );
  });

  it("freezes selectors and declarations in the two global CSS owners only", () => {
    const css = `.card { color: var(--app-color-text); }`;
    const result = scanUiContract([
      source("src/styles/global.css", css),
      source("src/styles/foundation.css", css),
      source("src/styles/component.css", css),
    ]);
    const freezePaths = (ruleId) =>
      result.violations
        .filter((violation) => violation.ruleId === ruleId)
        .map((violation) => violation.path)
        .sort();

    expect(freezePaths("global-css.selector-freeze")).toEqual([
      "src/styles/foundation.css",
      "src/styles/global.css",
    ]);
    expect(freezePaths("global-css.declaration-freeze")).toEqual([
      "src/styles/foundation.css",
      "src/styles/global.css",
    ]);
    expect(UI_CONTRACT_SCANNER_VERSION).toBe(4);
  });

  it("canonicalizes comma-selector order and freezes direct at-rule declarations", () => {
    const ordered = scanUiContract([
      source(
        "src/styles/global.css",
        `.card, .panel { color: var(--app-color-text); }`,
      ),
    ]);
    const reordered = scanUiContract([
      source(
        "src/styles/global.css",
        `.panel,.card { color: var(--app-color-text); }`,
      ),
    ]);
    const atRule = scanUiContract([
      source(
        "src/styles/global.css",
        `@theme inline { --page-color: #fff; --color-safe: var(--app-color-text); }`,
      ),
    ]);

    expect(fingerprintsFor(ordered, "global-css.selector-freeze")).toEqual(
      fingerprintsFor(reordered, "global-css.selector-freeze"),
    );
    expect(fingerprintsFor(ordered, "global-css.declaration-freeze")).toEqual(
      fingerprintsFor(reordered, "global-css.declaration-freeze"),
    );
    expect(fingerprintsFor(atRule, "global-css.declaration-freeze")).toHaveLength(2);
    expect(ruleIds(atRule).filter((id) => id === "visual.raw-color")).toHaveLength(1);
  });

  it("changes declaration fingerprints when an existing selector gains or changes debt", () => {
    const baseline = scanUiContract([
      source("src/styles/global.css", `.card { color: var(--app-color-text); }`),
    ]);
    const added = scanUiContract([
      source(
        "src/styles/global.css",
        `.card { color: var(--app-color-text); padding: 12px; }`,
      ),
    ]);
    const changed = scanUiContract([
      source("src/styles/global.css", `.card { color: #ff0000; }`),
    ]);

    expect(fingerprintsFor(added, "global-css.declaration-freeze")).toHaveLength(2);
    expect(fingerprintsFor(changed, "global-css.declaration-freeze")).not.toEqual(
      fingerprintsFor(baseline, "global-css.declaration-freeze"),
    );
  });
});

describe("UI contract baseline authority", () => {
  function violation(ruleId, sourcePath, semanticKey) {
    return createViolation({
      ruleId,
      path: sourcePath,
      line: 1,
      semanticKey,
      lexeme: ruleId,
    });
  }

  const existingA = violation("visual.raw-color", "src/a.tsx", "color:#fff");
  const existingB = violation("workspace.extra-main", "src/b.tsx", "main");
  const addedC = violation("tailwind.arbitrary-visual", "src/c.tsx", "bg-[#fff]");

  it("creates and validates an exact fingerprint multiset baseline", () => {
    const baseline = createUiContractBaseline([existingA, existingA, existingB], {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });

    expect(validateUiContractBaseline(baseline)).toBe(baseline);
    expect(baseline.fingerprints[existingA.fingerprint]).toBe(2);
    expect(baseline.summaryByRule).toEqual({
      "visual.raw-color": 2,
      "workspace.extra-main": 1,
    });
    expect(baseline.summaryByPath).toEqual({ "src/a.tsx": 2, "src/b.tsx": 1 });
  });

  it("orders non-ASCII baseline paths with a locale-independent comparator", () => {
    const baseline = createUiContractBaseline([
      violation("visual.raw-color", "src/나.tsx", "color:#222"),
      violation("visual.raw-color", "src/가.tsx", "color:#111"),
      violation("visual.raw-color", "src/Z.tsx", "color:#000"),
    ]);

    expect(Object.keys(baseline.summaryByPath)).toEqual([
      "src/Z.tsx",
      "src/가.tsx",
      "src/나.tsx",
    ]);
    expect(validateUiContractBaseline(baseline)).toEqual(baseline);
  });

  it("rejects malformed, unknown, negative, and version-mismatched baselines", () => {
    const valid = createUiContractBaseline([existingA], {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });

    expect(() => validateUiContractBaseline({ ...valid, extra: true })).toThrow(
      expect.objectContaining({ code: "UI_BASELINE_INVALID" }),
    );
    expect(() =>
      validateUiContractBaseline({
        ...valid,
        fingerprints: { [existingA.fingerprint]: -1 },
      }),
    ).toThrow(expect.objectContaining({ code: "UI_BASELINE_INVALID" }));
    expect(() =>
      validateUiContractBaseline({
        ...valid,
        scannerVersion: UI_CONTRACT_SCANNER_VERSION + 1,
      }),
    ).toThrow(
      expect.objectContaining({ code: "UI_BASELINE_VERSION_MISMATCH" }),
    );
  });

  it("rejects candidate undercut, overcount, summary drift, and same-total swaps", () => {
    const current = [existingA, existingB];
    const undercut = createUiContractBaseline([existingA], {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    const overcount = createUiContractBaseline([existingA, existingB, existingB], {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    const swapped = createUiContractBaseline([existingA, addedC], {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    const drifted = {
      ...createUiContractBaseline(current, { generatedAt: "2026-07-10T00:00:00.000Z" }),
      summaryByRule: { "visual.raw-color": 1, "workspace.extra-main-drift": 1 },
    };

    for (const candidate of [undercut, overcount, swapped, drifted]) {
      expect(() => assertCandidateMatchesCurrent(current, candidate)).toThrow(
        expect.objectContaining({ code: "UI_BASELINE_CURRENT_MISMATCH" }),
      );
    }
  });

  it("allows debt reduction but reports new and increased fingerprints against base", () => {
    const base = createUiContractBaseline([existingA, existingA, existingB], {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });

    expect(compareAgainstBase([existingA, existingB], base).newViolations).toEqual([]);
    expect(compareAgainstBase([existingA, existingA, existingB, addedC], base).newViolations).toEqual([
      addedC,
    ]);
    expect(
      compareAgainstBase([existingA, existingA, existingA, existingB], base).newViolations,
    ).toHaveLength(1);
  });

  it("preserves generatedAt only when semantic baseline content is unchanged", () => {
    const first = createUiContractBaseline([existingA], {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    const unchanged = createUiContractBaseline([existingA], {
      generatedAt: "2026-07-11T00:00:00.000Z",
      previousBaseline: first,
    });
    const changed = createUiContractBaseline([existingA, existingB], {
      generatedAt: "2026-07-11T00:00:00.000Z",
      previousBaseline: first,
    });

    expect(unchanged.generatedAt).toBe("2026-07-10T00:00:00.000Z");
    expect(changed.generatedAt).toBe("2026-07-11T00:00:00.000Z");
  });
});

describe("UI contract exceptions and redaction", () => {
  const today = "2026-07-10";
  const geometryViolation = createViolation({
    ruleId: "react.static-inline-style",
    path: "src/components/editor/MeasuredEditor.tsx",
    line: 12,
    semanticKey: "style:height:measuredHeight",
    lexeme: "style={{ height: secret-token-value }}",
  });

  function approval(overrides = {}) {
    return {
      id: "measured-editor-height",
      path: geometryViolation.path,
      ruleId: geometryViolation.ruleId,
      fingerprint: geometryViolation.fingerprint,
      owner: "writing-editor",
      reason: "The height comes from a ResizeObserver runtime measurement.",
      createdDate: "2026-07-10",
      expiresDate: "2026-08-01",
      removalCondition: "Remove when the editor exposes a CSS sizing contract.",
      regressionEvidence: "tests/components/editor/MeasuredEditor.test.tsx",
      ...overrides,
    };
  }

  function approvals(items) {
    return { schemaVersion: 1, approvals: items };
  }

  function exceptions(items) {
    return { schemaVersion: 1, exceptions: items };
  }

  const activeException = { id: "measured-editor-height", approvalId: "measured-editor-height" };

  it("validates exact approval and exception schemas", () => {
    expect(validateApprovalManifest(approvals([approval()]), { today, role: "candidate" })).toEqual(
      approvals([approval()]).approvals,
    );
    expect(validateExceptionManifest(exceptions([activeException]))).toEqual([activeException]);

    expect(() =>
      validateApprovalManifest(approvals([approval({ path: "../outside.tsx" })]), {
        today,
        role: "candidate",
      }),
    ).toThrow(expect.objectContaining({ code: "UI_APPROVAL_INVALID" }));
    expect(() =>
      validateApprovalManifest(
        approvals([approval({ reason: "token=SECRET_VALUE_SHOULD_NOT_LEAK" })]),
        { today, role: "candidate" },
      ),
    ).toThrow(expect.objectContaining({ code: "UI_APPROVAL_SECRET_LIKE" }));
    expect(() =>
      validateExceptionManifest(exceptions([{ ...activeException, extra: true }])),
    ).toThrow(expect.objectContaining({ code: "UI_EXCEPTION_INVALID" }));
  });

  it("suppresses exactly one violation with identical base and candidate approval", () => {
    const manifest = approvals([approval()]);
    const result = applyUiContractExceptions([geometryViolation], {
      mode: "ci",
      today,
      baseApprovals: manifest,
      candidateApprovals: manifest,
      candidateExceptions: exceptions([activeException]),
    });

    expect(result.violations).toEqual([]);
    expect(result.suppressedViolations).toEqual([geometryViolation]);
    expect(result.policyErrors).toEqual([]);
  });

  it("rejects same-PR CI approval but allows an explicitly marked local preview", () => {
    const candidateApprovals = approvals([approval()]);
    const candidateExceptions = exceptions([activeException]);
    const ci = applyUiContractExceptions([geometryViolation], {
      mode: "ci",
      today,
      baseApprovals: approvals([]),
      candidateApprovals,
      candidateExceptions,
    });
    const local = applyUiContractExceptions([geometryViolation], {
      mode: "local",
      today,
      candidateApprovals,
      candidateExceptions,
    });

    expect(ci.violations).toEqual([geometryViolation]);
    expect(ci.policyErrors).toEqual([
      { code: "UI_EXCEPTION_UNAUTHORIZED", id: activeException.id },
    ]);
    expect(local.violations).toEqual([]);
    expect(local.marker).toBe("LOCAL_NOT_BASE_AUTHORITY");
  });

  it("requires approval continuity and rejects zero or duplicate matches", () => {
    const baseApprovals = approvals([approval()]);
    const removedCandidate = applyUiContractExceptions([geometryViolation], {
      mode: "ci",
      today,
      baseApprovals,
      candidateApprovals: approvals([]),
      candidateExceptions: exceptions([activeException]),
    });
    const duplicate = applyUiContractExceptions([geometryViolation, geometryViolation], {
      mode: "ci",
      today,
      baseApprovals,
      candidateApprovals: baseApprovals,
      candidateExceptions: exceptions([activeException]),
    });

    expect(removedCandidate.policyErrors[0]?.code).toBe("UI_EXCEPTION_UNAUTHORIZED");
    expect(duplicate.policyErrors[0]?.code).toBe("UI_EXCEPTION_CARDINALITY");
  });

  it("allows expired base cleanup but rejects expired candidate retention and suppression", () => {
    const expiredBase = approvals([
      approval({ createdDate: "2026-06-15", expiresDate: "2026-07-09" }),
    ]);
    const cleanup = applyUiContractExceptions([], {
      mode: "ci",
      today,
      baseApprovals: expiredBase,
      candidateApprovals: approvals([]),
      candidateExceptions: exceptions([]),
    });
    expect(cleanup.policyErrors).toEqual([]);

    expect(() =>
      applyUiContractExceptions([], {
        mode: "ci",
        today,
        baseApprovals: expiredBase,
        candidateApprovals: expiredBase,
        candidateExceptions: exceptions([]),
      }),
    ).toThrow(expect.objectContaining({ code: "UI_APPROVAL_EXPIRED" }));

    const suppression = applyUiContractExceptions([geometryViolation], {
      mode: "ci",
      today,
      baseApprovals: expiredBase,
      candidateApprovals: approvals([approval()]),
      candidateExceptions: exceptions([activeException]),
    });
    expect(suppression.policyErrors[0]?.code).toBe("UI_EXCEPTION_UNAUTHORIZED");
  });

  it("redacts source lexemes and free-form metadata from text and JSON reports", () => {
    const reportData = {
      marker: "LOCAL_NOT_BASE_AUTHORITY",
      violations: [geometryViolation],
      policyErrors: [
        { code: "UI_EXCEPTION_UNAUTHORIZED", id: "safe-id" },
        { code: "UI_EXCEPTION_UNAUTHORIZED", id: "token=SECRET_POLICY_ID" },
      ],
    };
    const text = formatUiContractReport(reportData, { format: "text" });
    const json = formatUiContractReport(reportData, { format: "json" });

    for (const output of [text, json]) {
      expect(output).not.toContain("secret-token-value");
      expect(output).not.toContain("ResizeObserver runtime measurement");
      expect(output).not.toContain("SECRET_POLICY_ID");
      expect(output).toContain(geometryViolation.fingerprint.slice(0, 12));
      expect(output).toContain("UI_EXCEPTION_UNAUTHORIZED");
      expect(output).toContain("invalid");
    }
  });
});

describe("UI contract collector, Git base, and CLI", () => {
  const emptyApprovals = { schemaVersion: 1, approvals: [] };
  const emptyExceptions = { schemaVersion: 1, exceptions: [] };
  const emptyMigrations = { schemaVersion: 1, migrations: [] };
  const baseRef = "a".repeat(40);

  function writeJson(filePath, value) {
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  function createProject(files = {}) {
    const root = temporaryRoot();
    for (const scannerPath of [
      "scripts/check-ui-contract.mjs",
      "scripts/lib/ui-contract.mjs",
    ]) {
      const scannerTarget = join(root, ...scannerPath.split("/"));
      mkdirSync(join(scannerTarget, ".."), { recursive: true });
      writeFileSync(
        scannerTarget,
        readFileSync(join(repoRoot, ...scannerPath.split("/"))),
      );
    }
    mkdirSync(join(root, "src", "폴더 with space"), { recursive: true });
    for (const [relativePath, content] of Object.entries(files)) {
      const target = join(root, ...relativePath.split("/"));
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, content, "utf8");
    }
    return root;
  }

  function writeCandidateTuple(
    root,
    baseline,
    {
      approvals = emptyApprovals,
      exceptions = emptyExceptions,
      migrations = emptyMigrations,
    } = {},
  ) {
    mkdirSync(join(root, "config"), { recursive: true });
    writeJson(join(root, "config", "ui-contract-baseline.json"), baseline);
    writeJson(join(root, "config", "ui-contract-exception-approvals.json"), approvals);
    writeJson(join(root, "config", "ui-contract-exceptions.json"), exceptions);
    writeJson(join(root, "config", "ui-contract-scanner-migrations.json"), migrations);
  }

  function baseTupleFiles(
    baseline,
    {
      approvals = emptyApprovals,
      exceptions = emptyExceptions,
      migrations = emptyMigrations,
    } = {},
  ) {
    return new Map([
      ["config/ui-contract-baseline.json", JSON.stringify(baseline)],
      ["config/ui-contract-exception-approvals.json", JSON.stringify(approvals)],
      ["config/ui-contract-exceptions.json", JSON.stringify(exceptions)],
      ["config/ui-contract-scanner-migrations.json", JSON.stringify(migrations)],
    ]);
  }

  function fakeGitTuple(files) {
    return (_command, args) => {
      if (args[0] === "cat-file" && args[1] === "-e" && args[2] === `${baseRef}^{commit}`) {
        return { status: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "cat-file" && args[1] === "-e") {
        const objectPath = args[2].slice(baseRef.length + 1);
        return files.has(objectPath)
          ? { status: 0, stdout: "", stderr: "" }
          : { status: 128, stdout: "", stderr: "not printed SECRET_GIT_STDERR" };
      }
      if (args[0] === "show") {
        const objectPath = args[1].slice(baseRef.length + 1);
        return files.has(objectPath)
          ? { status: 0, stdout: files.get(objectPath), stderr: "" }
          : { status: 128, stdout: "", stderr: "not printed SECRET_GIT_STDERR" };
      }
      return { status: 1, stdout: "", stderr: "unexpected" };
    };
  }

  it("collects deterministic UTF-8 regular sources with POSIX paths", async () => {
    const root = createProject({
      "src/폴더 with space/B.tsx": "export const B = <div />;",
      "src/a.ts": "export const a = 1;",
      "src/image.png": "ignored",
    });

    const sources = await collectUiSources(root);
    expect(sources.map((item) => item.path)).toEqual([
      "src/a.ts",
      "src/폴더 with space/B.tsx",
    ]);
  });

  it("rejects invalid UTF-8 and filesystem links without following them", async (context) => {
    const invalidRoot = createProject();
    writeFileSync(join(invalidRoot, "src", "invalid.ts"), Buffer.from([0xc3, 0x28]));
    await expect(collectUiSources(invalidRoot)).rejects.toMatchObject({
      code: "UI_SOURCE_UTF8_INVALID",
    });

    const linkRoot = createProject({ "src/real.ts": "export const real = 1;" });
    try {
      symlinkSync(join(linkRoot, "src", "real.ts"), join(linkRoot, "src", "linked.ts"), "file");
    } catch {
      context.skip("filesystem link creation is unavailable in this environment");
      return;
    }
    await expect(collectUiSources(linkRoot)).rejects.toMatchObject({
      code: "UI_SOURCE_LINK_FORBIDDEN",
    });
  });

  it("resolves env-only base refs and fails closed on CI mismatch or absence", () => {
    expect(resolveBaseRef(null, { CI: "true", UI_CONTRACT_BASE_REF: baseRef }, "diff-block")).toBe(
      baseRef,
    );
    expect(() => resolveBaseRef("b".repeat(40), { CI: "true", UI_CONTRACT_BASE_REF: baseRef }, "diff-block")).toThrow(
      expect.objectContaining({ code: "UI_BASE_REF_MISMATCH" }),
    );
    expect(() => resolveBaseRef(null, { CI: "true" }, "diff-block")).toThrow(
      expect.objectContaining({ code: "UI_BASE_REF_REQUIRED" }),
    );
    expect(resolveBaseRef(null, {}, "diff-block")).toBe(null);
  });

  it("accepts error mode and fails on existing actionable violations despite an exact baseline", async () => {
    const content = `export const Example = () => <div style={{ color: "#fff" }} />;`;
    const root = createProject({ "src/example.tsx": content });
    const current = scanUiContract([source("src/example.tsx", content)]);
    writeCandidateTuple(
      root,
      createUiContractBaseline(current.violations, {
        generatedAt: "2026-07-10T00:00:00.000Z",
      }),
    );

    const result = await runUiContractCli(["--mode", "error", "--format", "json"], {
      cwd: root,
      env: {},
      clock: () => new Date("2026-07-10T12:00:00.000Z"),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("react.static-inline-style");
  });

  it("allows exact-baseline structural freeze fingerprints in local error mode", async () => {
    const content = `.card { color: var(--app-color-text); }`;
    const root = createProject({ "src/styles/global.css": content });
    const current = scanUiContract([source("src/styles/global.css", content)]);
    writeCandidateTuple(
      root,
      createUiContractBaseline(current.violations, {
        generatedAt: "2026-07-10T00:00:00.000Z",
      }),
    );

    const result = await runUiContractCli(["--mode", "error", "--format", "json"], {
      cwd: root,
      env: {},
      clock: () => new Date("2026-07-10T12:00:00.000Z"),
    });

    expect(result).toMatchObject({ exitCode: 0, stderr: "" });
    expect(JSON.parse(result.stdout)).toMatchObject({ totalViolations: 0 });
  });

  it("blocks structural freeze fingerprints added relative to the CI base", async () => {
    const baseContent = `.card { color: var(--app-color-text); }`;
    const candidateContent = `.card { color: var(--app-color-text); padding: 12px; }`;
    const root = createProject({ "src/styles/global.css": candidateContent });
    const current = scanUiContract([source("src/styles/global.css", candidateContent)]);
    const base = scanUiContract([source("src/styles/global.css", baseContent)]);
    const candidateBaseline = createUiContractBaseline(current.violations, {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    const baseBaseline = createUiContractBaseline(base.violations, {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    writeCandidateTuple(root, candidateBaseline);

    const result = await runUiContractCli(["--mode", "error", "--format", "json"], {
      cwd: root,
      env: { CI: "true", UI_CONTRACT_BASE_REF: baseRef },
      clock: () => new Date("2026-07-10T12:00:00.000Z"),
      spawnSyncImpl: fakeGitTuple(baseTupleFiles(baseBaseline)),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("global-css.declaration-freeze");
    expect(JSON.parse(result.stdout)).toMatchObject({ totalViolations: 1 });
  });

  it("requires a base ref for error mode in CI", () => {
    expect(() => resolveBaseRef(null, { CI: "true" }, "error")).toThrow(
      expect.objectContaining({ code: "UI_BASE_REF_REQUIRED" }),
    );
  });

  it.each([
    {
      name: "same-PR approval",
      baseApprovals: emptyApprovals,
      candidateHasApproval: true,
    },
    {
      name: "removed candidate approval",
      baseApprovals: null,
      candidateHasApproval: false,
    },
  ])("keeps $name unauthorized in CI error mode", async ({ baseApprovals, candidateHasApproval }) => {
    const content = `export const Example = () => <div style={{ color: "#fff" }} />;`;
    const root = createProject({ "src/example.tsx": content });
    const current = scanUiContract([source("src/example.tsx", content)]);
    const target = current.violations.find(
      (violation) => violation.ruleId === "react.static-inline-style",
    );
    const approval = {
      id: "existing-inline-style",
      path: target.path,
      ruleId: target.ruleId,
      fingerprint: target.fingerprint,
      owner: "test-owner",
      reason: "Exercise existing exception authority in error mode.",
      createdDate: "2026-07-10",
      expiresDate: "2026-08-01",
      removalCondition: "Remove with this focused fixture.",
      regressionEvidence: "tests/scripts/check-ui-contract.test.mjs",
    };
    const approvedManifest = { schemaVersion: 1, approvals: [approval] };
    const candidateApprovals = candidateHasApproval ? approvedManifest : emptyApprovals;
    const candidateExceptions = {
      schemaVersion: 1,
      exceptions: [{ id: approval.id, approvalId: approval.id }],
    };
    const baseline = createUiContractBaseline(current.violations, {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    writeCandidateTuple(root, baseline, {
      approvals: candidateApprovals,
      exceptions: candidateExceptions,
    });
    const authoritativeBaseApprovals = baseApprovals ?? approvedManifest;

    const result = await runUiContractCli(["--mode", "error", "--format", "json"], {
      cwd: root,
      env: { CI: "true", UI_CONTRACT_BASE_REF: baseRef },
      clock: () => new Date("2026-07-10T12:00:00.000Z"),
      spawnSyncImpl: fakeGitTuple(
        baseTupleFiles(baseline, { approvals: authoritativeBaseApprovals }),
      ),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("UI_EXCEPTION_UNAUTHORIZED");
  });

  it("classifies all-absent bootstrap, rejects partial tuples, and reads all-present tuples", () => {
    const baseline = createUiContractBaseline([], {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    const allPresent = new Map([
      ["config/ui-contract-baseline.json", JSON.stringify(baseline)],
      ["config/ui-contract-exception-approvals.json", JSON.stringify(emptyApprovals)],
      ["config/ui-contract-exceptions.json", JSON.stringify(emptyExceptions)],
      ["config/ui-contract-scanner-migrations.json", JSON.stringify(emptyMigrations)],
    ]);

    expect(
      readBaseContractTuple({
        rootDir: process.cwd(),
        baseRef,
        today: "2026-07-10",
        spawnSyncImpl: fakeGitTuple(new Map()),
      }).bootstrap,
    ).toBe(true);
    expect(() =>
      readBaseContractTuple({
        rootDir: process.cwd(),
        baseRef,
        today: "2026-07-10",
        spawnSyncImpl: fakeGitTuple(
          new Map([["config/ui-contract-baseline.json", JSON.stringify(baseline)]]),
        ),
      }),
    ).toThrow(expect.objectContaining({ code: "UI_BOOTSTRAP_STATE_INVALID" }));
    expect(
      readBaseContractTuple({
        rootDir: process.cwd(),
        baseRef,
        today: "2026-07-10",
        spawnSyncImpl: fakeGitTuple(allPresent),
      }),
    ).toMatchObject({ bootstrap: false, baseline });
  });

  it("uses the base baseline in env-only CI even when candidate is regenerated", async () => {
    const root = createProject({
      "src/example.tsx": `export const Example = () => <div style={{ color: "#fff" }} />;`,
    });
    const raw = scanUiContract([
      source(
        "src/example.tsx",
        `export const Example = () => <div style={{ color: "#fff" }} />;`,
      ),
    ]);
    const candidate = createUiContractBaseline(raw.violations, {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    const base = createUiContractBaseline([], {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    mkdirSync(join(root, "config"), { recursive: true });
    writeJson(join(root, "config", "ui-contract-baseline.json"), candidate);
    writeJson(join(root, "config", "ui-contract-exception-approvals.json"), emptyApprovals);
    writeJson(join(root, "config", "ui-contract-exceptions.json"), emptyExceptions);
    writeJson(join(root, "config", "ui-contract-scanner-migrations.json"), emptyMigrations);
    const files = new Map([
      ["config/ui-contract-baseline.json", JSON.stringify(base)],
      ["config/ui-contract-exception-approvals.json", JSON.stringify(emptyApprovals)],
      ["config/ui-contract-exceptions.json", JSON.stringify(emptyExceptions)],
      ["config/ui-contract-scanner-migrations.json", JSON.stringify(emptyMigrations)],
    ]);

    const result = await runUiContractCli(["--mode", "diff-block", "--format", "json"], {
      cwd: root,
      env: { CI: "true", UI_CONTRACT_BASE_REF: baseRef },
      clock: () => new Date("2026-07-10T12:00:00.000Z"),
      spawnSyncImpl: fakeGitTuple(files),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("react.static-inline-style");
    expect(result.stdout).not.toContain("SECRET_GIT_STDERR");
  });

  it("runs an exact version-increasing scanner migration approved on base", async () => {
    const root = createProject({
      "src/example.tsx": `export const Example = () => <div style={{ color: "#fff" }} />;`,
    });
    const raw = scanUiContract([
      source(
        "src/example.tsx",
        `export const Example = () => <div style={{ color: "#fff" }} />;`,
      ),
    ]);
    const candidate = createUiContractBaseline(raw.violations, {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    const baseDigest = "a".repeat(64);
    const base = {
      ...createUiContractBaseline([], {
        generatedAt: "2026-07-10T00:00:00.000Z",
      }),
      scannerVersion: UI_CONTRACT_SCANNER_VERSION - 1,
      scannerDigest: baseDigest,
      fingerprints: Object.fromEntries(
        Object.values(candidate.fingerprints).map((count, index) => [
          (index + 1).toString(16).padStart(64, "0"),
          count,
        ]),
      ),
      summaryByRule: candidate.summaryByRule,
      summaryByPath: candidate.summaryByPath,
    };
    const approvedMigration = {
      schemaVersion: 1,
      migrations: [
        {
          fromVersion: base.scannerVersion,
          fromDigest: baseDigest,
          toVersion: candidate.scannerVersion,
          toDigest: candidate.scannerDigest,
          toBaselineDigest: computeBaselineApprovalDigest(candidate),
          approvedBy: "@blackstarzck",
          reason: "Exercise the reviewed migration path.",
        },
      ],
    };
    mkdirSync(join(root, "config"), { recursive: true });
    writeJson(join(root, "config", "ui-contract-baseline.json"), candidate);
    writeJson(join(root, "config", "ui-contract-exception-approvals.json"), emptyApprovals);
    writeJson(join(root, "config", "ui-contract-exceptions.json"), emptyExceptions);
    writeJson(join(root, "config", "ui-contract-scanner-migrations.json"), emptyMigrations);
    const files = new Map([
      ["config/ui-contract-baseline.json", JSON.stringify(base)],
      ["config/ui-contract-exception-approvals.json", JSON.stringify(emptyApprovals)],
      ["config/ui-contract-exceptions.json", JSON.stringify(emptyExceptions)],
      ["config/ui-contract-scanner-migrations.json", JSON.stringify(approvedMigration)],
    ]);

    const result = await runUiContractCli(["--mode", "diff-block", "--format", "json"], {
      cwd: root,
      env: { CI: "true", UI_CONTRACT_BASE_REF: baseRef },
      clock: () => new Date("2026-07-10T12:00:00.000Z"),
      spawnSyncImpl: fakeGitTuple(files),
    });

    expect(result).toMatchObject({ exitCode: 0, stderr: "" });
  });

  it("uses base scanner semantics for an approved migration in the trusted runner", async () => {
    const root = createProject({
      "src/example.tsx": `export const Example = () => <div style={{ color: "#fff" }} />;`,
    });
    const raw = scanUiContract([
      source(
        "src/example.tsx",
        `export const Example = () => <div style={{ color: "#fff" }} />;`,
      ),
    ]);
    const candidate = createUiContractBaseline(raw.violations, {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    const baseDigest = "a".repeat(64);
    const base = {
      ...createUiContractBaseline([], { generatedAt: "2026-07-10T00:00:00.000Z" }),
      scannerVersion: UI_CONTRACT_SCANNER_VERSION - 1,
      scannerDigest: baseDigest,
    };
    const approvedMigration = {
      schemaVersion: 1,
      migrations: [
        {
          fromVersion: base.scannerVersion,
          fromDigest: baseDigest,
          toVersion: candidate.scannerVersion,
          toDigest: candidate.scannerDigest,
          toBaselineDigest: computeBaselineApprovalDigest(candidate),
          approvedBy: "@blackstarzck",
          reason: "Exercise trusted base semantics.",
        },
      ],
    };
    mkdirSync(join(root, "config"), { recursive: true });
    writeJson(join(root, "config", "ui-contract-baseline.json"), candidate);
    writeJson(join(root, "config", "ui-contract-exception-approvals.json"), emptyApprovals);
    writeJson(join(root, "config", "ui-contract-exceptions.json"), emptyExceptions);
    writeJson(join(root, "config", "ui-contract-scanner-migrations.json"), emptyMigrations);
    const files = new Map([
      ["config/ui-contract-baseline.json", JSON.stringify(base)],
      ["config/ui-contract-exception-approvals.json", JSON.stringify(emptyApprovals)],
      ["config/ui-contract-exceptions.json", JSON.stringify(emptyExceptions)],
      ["config/ui-contract-scanner-migrations.json", JSON.stringify(approvedMigration)],
    ]);

    const result = await runUiContractCli(["--mode", "diff-block", "--format", "json"], {
      cwd: root,
      env: {
        CI: "true",
        UI_CONTRACT_BASE_REF: baseRef,
        UI_TRUSTED_MIGRATION_BASE_SCAN: "1",
      },
      clock: () => new Date("2026-07-10T12:00:00.000Z"),
      spawnSyncImpl: fakeGitTuple(files),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("react.static-inline-style");
  });

  it("keeps read-only report independent from stale baseline freshness", async () => {
    const root = createProject({ "src/example.tsx": "export const Example = () => <div />;" });
    mkdirSync(join(root, "config"), { recursive: true });
    writeJson(join(root, "config", "ui-contract-baseline.json"), { stale: true });
    writeJson(join(root, "config", "ui-contract-exception-approvals.json"), emptyApprovals);
    writeJson(join(root, "config", "ui-contract-exceptions.json"), emptyExceptions);
    writeJson(join(root, "config", "ui-contract-scanner-migrations.json"), emptyMigrations);

    const result = await runUiContractCli(["--mode", "report", "--format", "json"], {
      cwd: root,
      env: {},
      clock: () => new Date("2026-07-10T12:00:00.000Z"),
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("LOCAL_NOT_BASE_AUTHORITY");
  });

  it("redacts invalid manifest identifiers from CLI errors", async () => {
    const secretId = "token=SECRET_DO_NOT_PRINT";
    const root = createProject({ "src/example.tsx": "export const Example = 1;" });
    mkdirSync(join(root, "config"), { recursive: true });
    writeJson(join(root, "config", "ui-contract-exception-approvals.json"), {
      schemaVersion: 1,
      approvals: [
        {
          id: secretId,
          path: "src/example.tsx",
          ruleId: "visual.raw-color",
          fingerprint: "a".repeat(64),
          owner: "test-owner",
          reason: "Invalid identifier redaction fixture.",
          createdDate: "2026-07-10",
          expiresDate: "2026-08-01",
          removalCondition: "Remove with the fixture.",
          regressionEvidence: "tests/scripts/check-ui-contract.test.mjs",
        },
      ],
    });
    writeJson(join(root, "config", "ui-contract-exceptions.json"), emptyExceptions);
    writeJson(join(root, "config", "ui-contract-scanner-migrations.json"), emptyMigrations);

    const result = await runUiContractCli(["--mode", "report"], {
      cwd: root,
      env: {},
      clock: () => new Date("2026-07-10T12:00:00.000Z"),
    });

    expect(result).toMatchObject({ exitCode: 2, stderr: "UI_APPROVAL_INVALID\n" });
    expect(result.stderr).not.toContain(secretId);
    expect(result.stdout).not.toContain(secretId);
  });

  it("does not rewrite the baseline when exception policy errors exist", async () => {
    const root = createProject({ "src/example.tsx": "export const Example = 1;" });
    mkdirSync(join(root, "config"), { recursive: true });
    const absentViolation = createViolation({
      ruleId: "react.static-inline-style",
      path: "src/example.tsx",
      line: 1,
      semanticKey: "missing-inline-style",
      lexeme: "style",
    });
    const staleBaseline = createUiContractBaseline([absentViolation], {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    const baselinePath = join(root, "config", "ui-contract-baseline.json");
    writeJson(baselinePath, staleBaseline);
    const approved = {
      id: "missing-style",
      path: absentViolation.path,
      ruleId: absentViolation.ruleId,
      fingerprint: absentViolation.fingerprint,
      owner: "test-owner",
      reason: "Cardinality failure must not mutate the baseline.",
      createdDate: "2026-07-10",
      expiresDate: "2026-08-01",
      removalCondition: "Remove when the fixture is deleted.",
      regressionEvidence: "tests/scripts/check-ui-contract.test.mjs",
    };
    writeJson(join(root, "config", "ui-contract-exception-approvals.json"), {
      schemaVersion: 1,
      approvals: [approved],
    });
    writeJson(join(root, "config", "ui-contract-exceptions.json"), {
      schemaVersion: 1,
      exceptions: [{ id: approved.id, approvalId: approved.id }],
    });
    writeJson(join(root, "config", "ui-contract-scanner-migrations.json"), emptyMigrations);
    const before = readFileSync(baselinePath, "utf8");

    const result = await runUiContractCli(
      [
        "--mode",
        "report",
        "--write-baseline",
        "config/ui-contract-baseline.json",
      ],
      {
        cwd: root,
        env: {},
        clock: () => new Date("2026-07-10T12:00:00.000Z"),
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("UI_EXCEPTION_CARDINALITY");
    expect(readFileSync(baselinePath, "utf8")).toBe(before);
  });

  it("maps policy mismatch/cardinality to exit 1 and malformed config to exit 2", async () => {
    const root = createProject({ "src/example.tsx": "export const Example = () => <div />;" });
    mkdirSync(join(root, "config"), { recursive: true });
    const absentViolation = createViolation({
      ruleId: "react.static-inline-style",
      path: "src/example.tsx",
      line: 1,
      semanticKey: "style:missing",
      lexeme: "style",
    });
    const staleBaseline = createUiContractBaseline([absentViolation], {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    writeJson(join(root, "config", "ui-contract-baseline.json"), staleBaseline);
    writeJson(join(root, "config", "ui-contract-exception-approvals.json"), emptyApprovals);
    writeJson(join(root, "config", "ui-contract-exceptions.json"), emptyExceptions);
    writeJson(join(root, "config", "ui-contract-scanner-migrations.json"), emptyMigrations);

    const mismatch = await runUiContractCli(["--mode", "diff-block"], {
      cwd: root,
      env: {},
      clock: () => new Date("2026-07-10T12:00:00.000Z"),
    });
    expect(mismatch).toMatchObject({ exitCode: 1, stderr: "UI_BASELINE_CURRENT_MISMATCH\n" });

    const exactBaseline = createUiContractBaseline([], {
      generatedAt: "2026-07-10T00:00:00.000Z",
    });
    writeJson(join(root, "config", "ui-contract-baseline.json"), exactBaseline);
    writeJson(join(root, "config", "ui-contract-exception-approvals.json"), {
      schemaVersion: 1,
      approvals: [
        {
          id: "missing-style",
          path: absentViolation.path,
          ruleId: absentViolation.ruleId,
          fingerprint: absentViolation.fingerprint,
          owner: "test-owner",
          reason: "Runtime-only fixture for exit-code verification.",
          createdDate: "2026-07-10",
          expiresDate: "2026-08-01",
          removalCondition: "Remove after the exit mapping is covered elsewhere.",
          regressionEvidence: "tests/scripts/check-ui-contract.test.mjs",
        },
      ],
    });
    writeJson(join(root, "config", "ui-contract-exceptions.json"), {
      schemaVersion: 1,
      exceptions: [{ id: "missing-style", approvalId: "missing-style" }],
    });
    writeJson(join(root, "config", "ui-contract-scanner-migrations.json"), emptyMigrations);
    const cardinality = await runUiContractCli(["--mode", "diff-block"], {
      cwd: root,
      env: {},
      clock: () => new Date("2026-07-10T12:00:00.000Z"),
    });
    expect(cardinality.exitCode).toBe(1);
    expect(cardinality.stdout).toContain("UI_EXCEPTION_CARDINALITY");

    writeJson(join(root, "config", "ui-contract-exception-approvals.json"), { malformed: true });
    const malformed = await runUiContractCli(["--mode", "report"], {
      cwd: root,
      env: {},
      clock: () => new Date("2026-07-10T12:00:00.000Z"),
    });
    expect(malformed.exitCode).toBe(2);
    expect(malformed.stderr).toContain("UI_APPROVAL_INVALID");
  });
});
