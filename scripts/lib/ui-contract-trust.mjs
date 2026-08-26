import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

export const UI_SCANNER_SOURCE_PATHS = Object.freeze([
  "config/ui-contract-runtime/package.json",
  "config/ui-contract-runtime/package-lock.json",
  "scripts/run-trusted-ui-contract.mjs",
  "scripts/check-ui-contract.mjs",
  "scripts/lib/ui-contract.mjs",
  "scripts/lib/ui-contract-trust.mjs",
]);

const FORBIDDEN_DYNAMIC_LOADING_NAMES = new Set([
  "require",
  "createRequire",
  "getBuiltinModule",
  "eval",
  "Function",
  "Reflect",
  "globalThis",
]);

const FORBIDDEN_DYNAMIC_LOADING_MEMBER_NAMES = new Set([
  "constructor",
  "binding",
  "_linkedBinding",
  "dlopen",
]);

// Security boundary: these sources, this external-module allowlist, and the runtime
// lockfile form a Code Owner-reviewed authority tuple. This AST pass is a
// defense-in-depth module-closure check, not a JavaScript sandbox. In particular,
// node:child_process remains required for the fixed Git and trusted-runner calls
// whose behavior is reviewed and covered by the scanner digest itself.
const ALLOWED_EXTERNAL_MODULES = new Set([
  "node:child_process",
  "node:crypto",
  "node:fs",
  "node:fs/promises",
  "node:path",
  "node:url",
  "postcss",
  "typescript",
]);

export class ScannerTrustError extends Error {
  constructor(code) {
    super(code);
    this.name = "ScannerTrustError";
    this.code = code;
  }
}

function normalizeRepoPath(value) {
  return value.split(path.sep).join("/");
}

function invokedName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression
  ) {
    return staticStringValue(expression.argumentExpression);
  }
  return null;
}

function staticStringValue(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticStringValue(node.left);
    const right = staticStringValue(node.right);
    return left === null || right === null ? null : `${left}${right}`;
  }
  return null;
}

function assertAllowedModuleSpecifier(specifier, { listed, relativePath }) {
  if (specifier === "module" || specifier === "node:module") {
    throw new ScannerTrustError("UI_SCANNER_DYNAMIC_LOADING_FORBIDDEN");
  }
  if (specifier.startsWith(".")) {
    const importedPath = normalizeRepoPath(
      path.normalize(path.join(path.dirname(relativePath), specifier)),
    );
    if (listed.has(importedPath)) return;
    throw new ScannerTrustError("UI_SCANNER_SOURCE_UNLISTED");
  }
  if (!ALLOWED_EXTERNAL_MODULES.has(specifier)) {
    throw new ScannerTrustError("UI_SCANNER_SOURCE_UNLISTED");
  }
}

function assertScannerModuleClosure(source, { listed, relativePath }) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    throw new ScannerTrustError("UI_SCANNER_SOURCE_INVALID");
  }

  const visit = (node) => {
    if (FORBIDDEN_DYNAMIC_LOADING_NAMES.has(invokedName(node))) {
      throw new ScannerTrustError("UI_SCANNER_DYNAMIC_LOADING_FORBIDDEN");
    }
    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      FORBIDDEN_DYNAMIC_LOADING_MEMBER_NAMES.has(invokedName(node))
    ) {
      throw new ScannerTrustError("UI_SCANNER_DYNAMIC_LOADING_FORBIDDEN");
    }

    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      if (!ts.isStringLiteralLike(node.moduleSpecifier)) {
        throw new ScannerTrustError("UI_SCANNER_DYNAMIC_LOADING_FORBIDDEN");
      }
      assertAllowedModuleSpecifier(node.moduleSpecifier.text, { listed, relativePath });
    }

    if (ts.isImportEqualsDeclaration(node)) {
      throw new ScannerTrustError("UI_SCANNER_DYNAMIC_LOADING_FORBIDDEN");
    }

    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments.length !== 1 || !ts.isStringLiteralLike(node.arguments[0])) {
          throw new ScannerTrustError("UI_SCANNER_DYNAMIC_LOADING_FORBIDDEN");
        }
        assertAllowedModuleSpecifier(node.arguments[0].text, { listed, relativePath });
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function assertScannerSourceClosure({ rootDir }) {
  const rootReal = realpathSync(rootDir);
  const listed = new Set(UI_SCANNER_SOURCE_PATHS);

  for (const relativePath of UI_SCANNER_SOURCE_PATHS) {
    const absolutePath = path.join(rootDir, ...relativePath.split("/"));
    const stat = lstatSync(absolutePath);
    const fileReal = realpathSync(absolutePath);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      (fileReal !== rootReal && !fileReal.startsWith(`${rootReal}${path.sep}`))
    ) {
      throw new ScannerTrustError("UI_SCANNER_SOURCE_INVALID");
    }
    if (!relativePath.endsWith(".mjs")) continue;

    const source = readFileSync(absolutePath, "utf8");
    assertScannerModuleClosure(source, { listed, relativePath });
  }
}

function isDigest(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

const BASELINE_TRANSITION_PATHS = Object.freeze([
  "src/styles/foundation.css",
  "src/styles/global.css",
]);
const BASELINE_TRANSITION_RULE_IDS = Object.freeze([
  "global-css.declaration-freeze",
  "global-css.selector-freeze",
]);

function hasExactValues(value, expected) {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    expected.every(
      (item, index) => Object.hasOwn(value, index) && value[index] === item,
    )
  );
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJson(value[key])]),
    );
  }
  return value;
}

export function computeBaselineApprovalDigest(baseline) {
  const semanticBaseline = {
    schemaVersion: baseline?.schemaVersion,
    scannerVersion: baseline?.scannerVersion,
    scannerDigest: baseline?.scannerDigest,
    fingerprints: baseline?.fingerprints,
    summaryByRule: baseline?.summaryByRule,
    summaryByPath: baseline?.summaryByPath,
  };
  return createHash("sha256")
    .update(JSON.stringify(stableJson(semanticBaseline)), "utf8")
    .digest("hex");
}

export function computeScannerDigest({ rootDir }) {
  assertScannerSourceClosure({ rootDir });
  const hash = createHash("sha256");
  for (const relativePath of UI_SCANNER_SOURCE_PATHS) {
    hash.update(relativePath, "utf8");
    hash.update("\0", "utf8");
    hash.update(readFileSync(path.join(rootDir, ...relativePath.split("/"))));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

export function validateScannerMigrationManifest(manifest) {
  if (
    !manifest ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.migrations) ||
    (manifest.baselineTransitions !== undefined &&
      !Array.isArray(manifest.baselineTransitions))
  ) {
    throw new ScannerTrustError("UI_SCANNER_MIGRATION_INVALID");
  }
  const keys = new Set();
  for (const migration of manifest.migrations) {
    if (
      !migration ||
      typeof migration !== "object" ||
      Array.isArray(migration) ||
      !Number.isInteger(migration.fromVersion) ||
      !Number.isInteger(migration.toVersion) ||
      migration.toVersion <= migration.fromVersion ||
      !isDigest(migration.fromDigest) ||
      !isDigest(migration.toDigest) ||
      !isDigest(migration.toBaselineDigest) ||
      typeof migration.approvedBy !== "string" ||
      migration.approvedBy.trim().length === 0 ||
      typeof migration.reason !== "string" ||
      migration.reason.trim().length < 12
    ) {
      throw new ScannerTrustError("UI_SCANNER_MIGRATION_INVALID");
    }
    const key = `${migration.fromVersion}:${migration.fromDigest}->${migration.toVersion}:${migration.toDigest}`;
    if (keys.has(key)) throw new ScannerTrustError("UI_SCANNER_MIGRATION_INVALID");
    keys.add(key);
  }

  const transitionKeys = new Set();
  for (const transition of manifest.baselineTransitions ?? []) {
    if (
      !transition ||
      typeof transition !== "object" ||
      Array.isArray(transition) ||
      !isDigest(transition.fromScannerDigest) ||
      !isDigest(transition.fromBaselineDigest) ||
      !isDigest(transition.toScannerDigest) ||
      !isDigest(transition.toBaselineDigest) ||
      transition.fromScannerDigest !== transition.toScannerDigest ||
      !hasExactValues(transition.paths, BASELINE_TRANSITION_PATHS) ||
      !hasExactValues(transition.ruleIds, BASELINE_TRANSITION_RULE_IDS) ||
      typeof transition.approvedBy !== "string" ||
      transition.approvedBy.trim().length === 0 ||
      typeof transition.reason !== "string" ||
      transition.reason.trim().length < 12
    ) {
      throw new ScannerTrustError("UI_SCANNER_MIGRATION_INVALID");
    }
    const key = [
      transition.fromScannerDigest,
      transition.fromBaselineDigest,
      transition.toScannerDigest,
      transition.toBaselineDigest,
    ].join(":");
    if (transitionKeys.has(key)) {
      throw new ScannerTrustError("UI_SCANNER_MIGRATION_INVALID");
    }
    transitionKeys.add(key);
  }
  return manifest;
}

export function selectApprovedBaselineTransition({
  baseManifest,
  baseBaseline,
  candidateBaseline,
  candidateScannerDigest,
}) {
  validateScannerMigrationManifest(baseManifest);
  if (
    !isDigest(candidateScannerDigest) ||
    baseBaseline?.scannerDigest !== candidateScannerDigest ||
    candidateBaseline?.scannerDigest !== candidateScannerDigest
  ) {
    return null;
  }

  const baseBaselineDigest = computeBaselineApprovalDigest(baseBaseline);
  const candidateBaselineDigest = computeBaselineApprovalDigest(candidateBaseline);
  return (
    baseManifest.baselineTransitions?.find(
      (transition) =>
        transition.fromScannerDigest === candidateScannerDigest &&
        transition.fromBaselineDigest === baseBaselineDigest &&
        transition.toScannerDigest === candidateScannerDigest &&
        transition.toBaselineDigest === candidateBaselineDigest,
    ) ?? null
  );
}

export function selectScannerAuthority({
  baseBaseline,
  candidateBaseline,
  candidateDigest,
  baseMigrations,
}) {
  validateScannerMigrationManifest(baseMigrations);
  if (
    !Number.isInteger(baseBaseline?.scannerVersion) ||
    !isDigest(baseBaseline?.scannerDigest) ||
    !Number.isInteger(candidateBaseline?.scannerVersion) ||
    !isDigest(candidateBaseline?.scannerDigest) ||
    !isDigest(candidateDigest)
  ) {
    throw new ScannerTrustError("UI_SCANNER_AUTHORITY_INVALID");
  }
  if (candidateBaseline.scannerDigest !== candidateDigest) {
    throw new ScannerTrustError("UI_SCANNER_DIGEST_MISMATCH");
  }
  if (
    baseBaseline.scannerDigest === candidateDigest &&
    baseBaseline.scannerVersion === candidateBaseline.scannerVersion
  ) {
    return "base";
  }

  const approved = baseMigrations.migrations.some(
    (migration) =>
      migration.fromVersion === baseBaseline.scannerVersion &&
      migration.fromDigest === baseBaseline.scannerDigest &&
      migration.toVersion === candidateBaseline.scannerVersion &&
      migration.toDigest === candidateDigest &&
      migration.toBaselineDigest === computeBaselineApprovalDigest(candidateBaseline),
  );
  if (!approved) throw new ScannerTrustError("UI_SCANNER_MIGRATION_NOT_APPROVED");
  return "candidate";
}
