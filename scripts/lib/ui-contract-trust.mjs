import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

export const UI_SCANNER_SOURCE_PATHS = Object.freeze([
  "config/ui-contract-runtime/package.json",
  "config/ui-contract-runtime/package-lock.json",
  "scripts/run-trusted-ui-contract.mjs",
  "scripts/check-ui-contract.mjs",
  "scripts/lib/ui-contract.mjs",
  "scripts/lib/ui-contract-trust.mjs",
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

function assertScannerSourceClosure({ rootDir }) {
  const rootReal = realpathSync(rootDir);
  const listed = new Set(UI_SCANNER_SOURCE_PATHS);
  const importPatterns = [
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["'](\.[^"']+)["']/gu,
    /\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/gu,
  ];

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
    for (const pattern of importPatterns) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const importedPath = normalizeRepoPath(
          path.normalize(path.join(path.dirname(relativePath), match[1])),
        );
        if (!listed.has(importedPath)) {
          throw new ScannerTrustError("UI_SCANNER_SOURCE_UNLISTED");
        }
      }
    }
  }
}

function isDigest(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
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
    !Array.isArray(manifest.migrations)
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
  return manifest;
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
