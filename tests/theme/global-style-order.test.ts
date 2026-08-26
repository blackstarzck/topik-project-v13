import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import postcss from "postcss";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const EXPECTED_LAYOUT_STYLES = [
  "../styles/global.css",
  "../styles/workspace-layout.css",
] as const;

const EXPECTED_GLOBAL_IMPORTS = [
  "tailwindcss",
  "swiper/css",
  "swiper/css/free-mode",
  "swiper/css/navigation",
  "swiper/css/grid",
] as const;

function layoutStyleOrderViolations(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    "src/app/layout.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const imports = sourceFile.statements
    .filter(ts.isImportDeclaration)
    .map((statement) =>
      ts.isStringLiteralLike(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : "",
    );
  const indexes = EXPECTED_LAYOUT_STYLES.map((specifier) =>
    imports.indexOf(specifier),
  );

  return indexes[0] >= 0 && indexes[1] >= 0 && indexes[0] < indexes[1]
    ? []
    : ["layout.stylesheet-import-order"];
}

function cssImportSpecifier(params: string): string | null {
  const match = params.trim().match(/^(?:"([^"]+)"|'([^']+)')$/u);
  return match?.[1] ?? match?.[2] ?? null;
}

function globalCssImportOrderViolations(
  source: string,
  localImportExists: (specifier: string) => boolean = () => true,
): string[] {
  const nodes = postcss
    .parse(source, { from: "src/styles/global.css" })
    .nodes.filter((node) => node.type !== "comment");
  const leadingImports = nodes.slice(0, EXPECTED_GLOBAL_IMPORTS.length);
  const externalImportsAreOrdered =
    leadingImports.length === EXPECTED_GLOBAL_IMPORTS.length &&
    leadingImports.every(
      (node, index) =>
        node.type === "atrule" &&
        node.name.toLowerCase() === "import" &&
        cssImportSpecifier(node.params) === EXPECTED_GLOBAL_IMPORTS[index],
    );
  const foundationImport = nodes[EXPECTED_GLOBAL_IMPORTS.length];
  const foundationSpecifier =
    foundationImport?.type === "atrule" &&
    foundationImport.name.toLowerCase() === "import"
      ? cssImportSpecifier(foundationImport.params)
      : null;
  const foundationImportIsValid =
    foundationSpecifier === "./foundation.css" &&
    localImportExists(foundationSpecifier);
  const remainingCssHasNoImports = nodes
    .slice(EXPECTED_GLOBAL_IMPORTS.length + 1)
    .every(
      (node) => node.type !== "atrule" || node.name.toLowerCase() !== "import",
    );

  return externalImportsAreOrdered &&
    foundationImportIsValid &&
    remainingCssHasNoImports
    ? []
    : ["global-css.external-import-order"];
}

describe("global stylesheet order contract", () => {
  test("keeps global.css before workspace-layout.css in the root layout", () => {
    const layoutSource = readFileSync(
      fileURLToPath(new URL("../../src/app/layout.tsx", import.meta.url)),
      "utf8",
    );

    expect(layoutStyleOrderViolations(layoutSource)).toEqual([]);
  });

  test("keeps the five global external imports first and in their current order", () => {
    const globalCssUrl = new URL(
      "../../src/styles/global.css",
      import.meta.url,
    );
    const globalCssSource = readFileSync(fileURLToPath(globalCssUrl), "utf8");

    expect(
      globalCssImportOrderViolations(globalCssSource, (specifier) =>
        existsSync(fileURLToPath(new URL(specifier, globalCssUrl))),
      ),
    ).toEqual([]);
  });

  test("rejects a root layout fixture with the two stylesheet imports reversed", () => {
    const reversedLayout = `
      import "../styles/workspace-layout.css";
      import "../styles/global.css";
    `;

    expect(layoutStyleOrderViolations(reversedLayout)).toEqual([
      "layout.stylesheet-import-order",
    ]);
  });

  test("rejects global CSS fixtures with a reversed or moved external import", () => {
    const orderedImports = EXPECTED_GLOBAL_IMPORTS.map(
      (specifier) => `@import "${specifier}";`,
    );
    const reversedImports = [...orderedImports];
    [reversedImports[1], reversedImports[2]] = [
      reversedImports[2],
      reversedImports[1],
    ];
    const movedImport = [
      ...orderedImports.slice(0, 4),
      ".page { color: var(--app-color-text); }",
      orderedImports[4],
    ];

    expect(globalCssImportOrderViolations(reversedImports.join("\n"))).toEqual([
      "global-css.external-import-order",
    ]);
    expect(globalCssImportOrderViolations(movedImport.join("\n"))).toEqual([
      "global-css.external-import-order",
    ]);
  });

  test("requires the foundation split at its exact local path", () => {
    const orderedImports = EXPECTED_GLOBAL_IMPORTS.map(
      (specifier) => `@import "${specifier}";`,
    );
    const leadingLocalImport = [
      ...orderedImports,
      '@import "./foundation.css";',
      ".page { color: var(--app-color-text); }",
    ];
    const wrongLocalImport = [
      ...orderedImports,
      '@import "./global/foundation.css";',
      ".page { color: var(--app-color-text); }",
    ];

    expect(
      globalCssImportOrderViolations(leadingLocalImport.join("\n")),
    ).toEqual([]);
    expect(globalCssImportOrderViolations(wrongLocalImport.join("\n"))).toEqual(
      ["global-css.external-import-order"],
    );
  });

  test("rejects the foundation import when its target file is missing", () => {
    const source = [
      ...EXPECTED_GLOBAL_IMPORTS.map((specifier) => `@import "${specifier}";`),
      '@import "./foundation.css";',
    ].join("\n");

    expect(globalCssImportOrderViolations(source, () => false)).toEqual([
      "global-css.external-import-order",
    ]);
  });
});
