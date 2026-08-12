import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PUBLIC_SERVER_MODULE = "src/lib/supabase/server.ts";
const PRIVILEGED_MODULE = "src/lib/supabase/service-role.server.ts";
const PRIVILEGED_HELPER = "createSupabaseServiceRoleClient";
const TYPES_MODULE = "src/lib/supabase/types.ts";
const PRIVILEGED_ENV_KEYS = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
// Transitional notification exceptions. The notification ownership task must
// move both routes behind the shared server-only helper and remove them here.
const ALLOWED_PRIVILEGED_ENV_READERS = [
  "src/app/api/notifications/dispatch-email/route.ts",
  "src/app/api/notifications/unsubscribe/route.ts",
  PRIVILEGED_MODULE,
].sort();
const ALLOWED_PRIVILEGED_IMPORTERS = [
  "src/app/api/export/pdf/print/route.ts",
  "src/app/api/export/pdf/route.ts",
  "src/app/api/system-reports/route.ts",
  "src/app/api/writing/evaluation-status/route.ts",
  "src/lib/writing/server-actions.ts",
].sort();

function source(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function listSourceFiles(directory = "src"): string[] {
  return readdirSync(resolve(ROOT, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const relativePath = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return listSourceFiles(relativePath);
      return entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name)
        ? [relativePath]
        : [];
    },
  );
}

function parseSource(content: string): ts.SourceFile {
  return ts.createSourceFile(
    "service-role-boundary.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function staticPropertyName(node: ts.Node | undefined): string | null {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return null;
}

function isProcessEnvExpression(node: ts.Expression | undefined): boolean {
  if (!node) return false;

  if (ts.isPropertyAccessExpression(node)) {
    return (
      ts.isIdentifier(node.expression) &&
      node.expression.text === "process" &&
      node.name.text === "env"
    );
  }

  return (
    ts.isElementAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "process" &&
    staticPropertyName(node.argumentExpression) === "env"
  );
}

function privilegedEnvReferences(content: string): Set<string> {
  const references = new Set<string>();
  const privilegedKeys = new Set<string>(PRIVILEGED_ENV_KEYS);

  function record(propertyName: string | null): void {
    if (propertyName && privilegedKeys.has(propertyName)) {
      references.add(propertyName);
    }
  }

  function visit(node: ts.Node): void {
    if (
      ts.isPropertyAccessExpression(node) &&
      isProcessEnvExpression(node.expression)
    ) {
      record(node.name.text);
    } else if (
      ts.isElementAccessExpression(node) &&
      isProcessEnvExpression(node.expression)
    ) {
      record(staticPropertyName(node.argumentExpression));
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      isProcessEnvExpression(node.initializer)
    ) {
      for (const element of node.name.elements) {
        record(staticPropertyName(element.propertyName ?? element.name));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(parseSource(content));
  return references;
}

function isPrivilegedModuleSpecifier(
  moduleSpecifier: ts.Expression | undefined,
): moduleSpecifier is ts.StringLiteralLike {
  return (
    moduleSpecifier !== undefined &&
    ts.isStringLiteralLike(moduleSpecifier) &&
    /(?:^|\/)service-role\.server(?:\.[cm]?[jt]sx?)?$/u.test(
      moduleSpecifier.text,
    )
  );
}

function isPrivilegedModuleLoaderCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
    isPrivilegedModuleSpecifier(node.arguments[0])
  );
}

function isPrivilegedModuleReference(node: ts.Node): boolean {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    isPrivilegedModuleSpecifier(node.moduleSpecifier)
  ) {
    return true;
  }

  if (isPrivilegedModuleLoaderCall(node)) return true;

  return (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    isPrivilegedModuleSpecifier(node.moduleReference.expression)
  );
}

function referencesPrivilegedModule(content: string): boolean {
  const sourceFile = parseSource(content);
  let found = false;

  function visit(node: ts.Node): void {
    if (found) return;
    if (isPrivilegedModuleReference(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function privilegedImportBindings(sourceFile: ts.SourceFile): Set<string> {
  const bindings = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      isPrivilegedModuleSpecifier(statement.moduleReference.expression)
    ) {
      bindings.add(statement.name.text);
      continue;
    }

    if (
      !ts.isImportDeclaration(statement) ||
      !isPrivilegedModuleSpecifier(statement.moduleSpecifier)
    ) {
      continue;
    }

    const importClause = statement.importClause;
    if (!importClause) continue;
    if (importClause.name) bindings.add(importClause.name.text);

    const namedBindings = importClause.namedBindings;
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      bindings.add(namedBindings.name.text);
      continue;
    }

    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        if (importedName === PRIVILEGED_HELPER) {
          bindings.add(element.name.text);
        }
      }
    }
  }

  return bindings;
}

function collectBindingNames(
  bindingName: ts.BindingName,
  bindings: Set<string>,
): void {
  if (ts.isIdentifier(bindingName)) {
    bindings.add(bindingName.text);
    return;
  }

  for (const element of bindingName.elements) {
    if (!ts.isOmittedExpression(element)) {
      collectBindingNames(element.name, bindings);
    }
  }
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isAwaitExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function isPrivilegedModuleValue(expression: ts.Expression): boolean {
  const current = unwrapExpression(expression);
  if (isPrivilegedModuleLoaderCall(current)) return true;

  if (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current)
  ) {
    return isPrivilegedModuleValue(current.expression);
  }

  return false;
}

function privilegedModuleBindings(sourceFile: ts.SourceFile): Set<string> {
  const bindings = privilegedImportBindings(sourceFile);

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (
        declaration.initializer &&
        isPrivilegedModuleValue(declaration.initializer)
      ) {
        collectBindingNames(declaration.name, bindings);
      }
    }
  }

  return bindings;
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    ? (ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
        false)
    : false;
}

function referencesPrivilegedBinding(
  expression: ts.Expression,
  bindings: Set<string>,
): boolean {
  const current = unwrapExpression(expression);

  if (ts.isIdentifier(current)) return bindings.has(current.text);
  if (ts.isPropertyAccessExpression(current)) {
    return referencesPrivilegedBinding(current.expression, bindings);
  }

  return false;
}

function reExportsPrivilegedHelper(content: string): boolean {
  const sourceFile = parseSource(content);
  const bindings = privilegedModuleBindings(sourceFile);

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (isPrivilegedModuleSpecifier(statement.moduleSpecifier)) return true;

      if (
        !statement.moduleSpecifier &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.some((element) =>
          bindings.has(element.propertyName?.text ?? element.name.text),
        )
      ) {
        return true;
      }
    }

    if (
      ts.isExportAssignment(statement) &&
      (referencesPrivilegedBinding(statement.expression, bindings) ||
        isPrivilegedModuleValue(statement.expression))
    ) {
      return true;
    }

    if (
      ts.isVariableStatement(statement) &&
      hasExportModifier(statement) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          declaration.initializer &&
          (referencesPrivilegedBinding(declaration.initializer, bindings) ||
            isPrivilegedModuleValue(declaration.initializer)),
      )
    ) {
      return true;
    }
  }

  return false;
}

describe("Supabase service-role module boundary", () => {
  it("detects every fixed privileged env key through direct and computed access", () => {
    const unsafeSource = `
      const role = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const secret = process.env["SUPABASE_SECRET_KEY"];
      const access = process["env"][\`SUPABASE_ACCESS_TOKEN\`];
    `;

    expect([...privilegedEnvReferences(unsafeSource)].sort()).toEqual(
      [...PRIVILEGED_ENV_KEYS].sort(),
    );
  });

  it("allows direct privileged env reads only in the helper and two transitional notification routes", () => {
    const readers = listSourceFiles()
      .filter(
        (relativePath) =>
          privilegedEnvReferences(source(relativePath)).size > 0,
      )
      .sort();

    expect(readers).toEqual(ALLOWED_PRIVILEGED_ENV_READERS);
  });

  it("detects a privileged helper re-export appended to the real server-actions module", () => {
    const unsafeSource = `${source(
      "src/lib/writing/server-actions.ts",
    )}\nexport { createSupabaseServiceRoleClient };\n`;

    expect(reExportsPrivilegedHelper(unsafeSource)).toBe(true);
  });

  it("detects an aliased privileged helper re-export after unrelated imports", () => {
    const unsafeSource = `
      import { unrelated } from "./unrelated";
      import {
        createSupabaseServiceRoleClient as systemClient
      } from "@/lib/supabase/service-role.server";

      export { systemClient };
    `;

    expect(reExportsPrivilegedHelper(unsafeSource)).toBe(true);
  });

  it("detects a direct privileged module re-export", () => {
    const unsafeSource = `
      export {
        createSupabaseServiceRoleClient
      } from "@/lib/supabase/service-role.server";
    `;

    expect(reExportsPrivilegedHelper(unsafeSource)).toBe(true);
  });

  it("detects a string-literal dynamic import in a client module", () => {
    const unsafeSource = `
      "use client";

      export async function loadSystemClient() {
        return import("@/lib/supabase/service-role.server");
      }
    `;

    expect(referencesPrivilegedModule(unsafeSource)).toBe(true);
  });

  it("detects a no-substitution template dynamic import in a shared module", () => {
    const unsafeSource = `
      export const loadSystemClient = () =>
        import(\`@/lib/supabase/service-role.server\`);
    `;

    expect(referencesPrivilegedModule(unsafeSource)).toBe(true);
  });

  it("detects CommonJS and TypeScript import-equals privileged references", () => {
    const commonJsSource = `
      const systemClient = require("@/lib/supabase/service-role.server");
    `;
    const importEqualsSource = `
      import systemClient = require("@/lib/supabase/service-role.server");
    `;

    expect(referencesPrivilegedModule(commonJsSource)).toBe(true);
    expect(referencesPrivilegedModule(importEqualsSource)).toBe(true);
  });

  it("detects a bound dynamic-import result re-export without flagging unrelated exports", () => {
    const unsafeSource = `
      const systemModule = await import(
        "@/lib/supabase/service-role.server"
      );
      export { systemModule };
    `;
    const safeSource = `
      const publicModule = await import("@/lib/supabase/server");
      export { publicModule };
    `;

    expect(reExportsPrivilegedHelper(unsafeSource)).toBe(true);
    expect(reExportsPrivilegedHelper(safeSource)).toBe(false);
  });

  it("does not export privileged credentials from the ordinary server client module", () => {
    expect(source(PUBLIC_SERVER_MODULE)).not.toContain(
      "createSupabaseServiceRoleClient",
    );
    expect(existsSync(resolve(ROOT, PRIVILEGED_MODULE))).toBe(true);
  });

  it("allows the privileged helper only in the five audited system entrypoints", () => {
    const importers = listSourceFiles()
      .filter(
        (relativePath) =>
          relativePath !== PRIVILEGED_MODULE &&
          referencesPrivilegedModule(source(relativePath)),
      )
      .sort();

    expect(importers).toEqual(ALLOWED_PRIVILEGED_IMPORTERS);
    for (const relativePath of importers) {
      const content = source(relativePath);
      expect(content.startsWith('"use client"')).toBe(false);
      expect(
        relativePath.startsWith("src/app/api/") ||
          (relativePath.startsWith("src/lib/") &&
            content.startsWith('"use server"')),
      ).toBe(true);
    }
  });

  it("rejects every direct or imported privileged-helper re-export", () => {
    const reExporters = listSourceFiles()
      .filter((relativePath) => relativePath !== PRIVILEGED_MODULE)
      .filter((relativePath) => reExportsPrivilegedHelper(source(relativePath)))
      .sort();

    expect(reExporters).toEqual([]);
  });

  it("keeps the forward account-state RPC type aligned with the P0 migration", () => {
    expect(source(TYPES_MODULE)).toContain(
      'Returns: "active" | "blocked" | "deleted" | null;',
    );
  });
});
