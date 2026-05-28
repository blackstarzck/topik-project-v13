#!/usr/bin/env node
import { loadManifest, maybeReadJson, resolveAuditDir, statusSummary, writeJson } from "./audit-setup/ia-audit-lib.mjs";

const auditDir = resolveAuditDir();
const manifest = loadManifest(auditDir);
const sourceMap = maybeReadJson(`${auditDir}/source-map-results.json`);
const docValidation = maybeReadJson(`${auditDir}/doc-receipt-validation-results.json`);

const sourceByCode = new Map((sourceMap?.rows ?? []).map((row) => [row.iaCode, row]));
const docByCode = new Map((docValidation?.rows ?? []).map((row) => [row.iaCode, row]));

function staticRow(entry) {
  const blockingReasons = [];
  const sourceRow = sourceByCode.get(entry.iaCode);
  const docRow = docByCode.get(entry.iaCode);

  if (!sourceMap) blockingReasons.push("missing source-map-results.json");
  if (!sourceRow) blockingReasons.push("missing source-map row");
  if (sourceRow?.status === "FAIL") blockingReasons.push(...sourceRow.blockingReasons);
  if (!docValidation) blockingReasons.push("missing doc-receipt-validation-results.json");
  if (!docRow) blockingReasons.push("missing document receipt validation row");
  if (docRow?.status !== "PASS") blockingReasons.push(...(docRow?.blockingReasons ?? ["document receipt validation not PASS"]));

  const hasFail = sourceRow?.status === "FAIL" || docRow?.status === "FAIL";
  const hasBlocked = blockingReasons.length > 0 || !sourceRow || !docRow;

  return {
    runId: manifest.runId,
    sourceCommit: manifest.sourceCommit,
    dirtyState: manifest.dirtyState,
    evidenceBundleId: manifest.evidenceBundleId,
    iaCode: entry.iaCode,
    screenName: entry.screenName,
    phase: "static",
    routeOrHostRoute: entry.routeOrHostRoute,
    routeType: entry.routeType,
    audience: entry.audience,
    docsConsulted: ["docs/sitemap.md", "docs/IA/README.md", entry.descriptionPath],
    extractedRequirements: [`${entry.iaCode} requires source-map and document-receipt evidence before static PASS.`],
    evidence: [
      { type: "source-map-row", status: sourceRow?.status ?? "missing" },
      { type: "doc-receipt-row", status: docRow?.status ?? "missing" },
    ],
    status: hasFail ? "FAIL" : hasBlocked ? "BLOCKED" : "PASS",
    blockingReasons,
    sourceFiles: sourceRow?.sourceFiles ?? [],
    generatedBy: "verify-ia-coverage.mjs",
    generatedAt: new Date().toISOString(),
  };
}

const rows = manifest.entries.map(staticRow);
const result = {
  runId: manifest.runId,
  sourceCommit: manifest.sourceCommit,
  dirtyState: manifest.dirtyState,
  evidenceBundleId: manifest.evidenceBundleId,
  generatedBy: "verify-ia-coverage.mjs",
  generatedAt: new Date().toISOString(),
  rows,
  summary: {
    totalIa: rows.length,
    statusCounts: statusSummary(rows),
  },
};

writeJson(`${auditDir}/static-results.json`, result);

if (rows.some((row) => row.status === "FAIL")) {
  console.error(`Static IA coverage has FAIL rows. See ${auditDir}/static-results.json.`);
  process.exit(1);
}

if (rows.some((row) => row.status === "BLOCKED")) {
  console.error(`Static IA coverage is BLOCKED. See ${auditDir}/static-results.json.`);
  process.exit(1);
}

console.log(`Static IA coverage PASS. Wrote ${auditDir}/static-results.json.`);
