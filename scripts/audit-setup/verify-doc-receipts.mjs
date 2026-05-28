#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadManifest,
  maybeReadJson,
  REPO_ROOT,
  resolveAuditDir,
  statusSummary,
  writeJson,
} from "./ia-audit-lib.mjs";

const auditDir = resolveAuditDir();
const manifest = loadManifest(auditDir);
const receiptsDoc = maybeReadJson(`${auditDir}/doc-receipts.json`);
const receipts = Array.isArray(receiptsDoc) ? receiptsDoc : receiptsDoc?.receipts;

function isAuthRelated(entry) {
  return entry.packs.some((pack) => ["AUTH", "SESSION", "EMAIL", "TOKEN", "SECURITY", "RATE-LIMIT"].includes(pack));
}

function isBackendSensitive(entry) {
  return entry.packs.some((pack) =>
    ["OWNER-CHECK", "ADMIN", "RBAC", "ORG-SCOPE", "PRIVILEGE", "STORAGE", "PII"].includes(pack),
  );
}

function validateReceipt(entry) {
  const receipt = receipts?.find((candidate) => candidate.iaCode === entry.iaCode);
  const blockingReasons = [];

  if (!receipt) {
    return {
      iaCode: entry.iaCode,
      screenName: entry.screenName,
      routeOrHostRoute: entry.routeOrHostRoute,
      routeType: entry.routeType,
      audience: entry.audience,
      status: "BLOCKED",
      blockingReasons: [`Missing document receipt for ${entry.iaCode}.`],
    };
  }

  const docsConsulted = receipt.docsConsulted ?? [];
  const extractedRequirements = receipt.extractedRequirements ?? [];

  for (const requiredDoc of [entry.descriptionPath, "docs/sitemap.md", "docs/flow/user-flow.md", "docs/prd.md"]) {
    if (!docsConsulted.includes(requiredDoc)) blockingReasons.push(`Receipt missing ${requiredDoc}.`);
  }

  if (isAuthRelated(entry) && !docsConsulted.includes("docs/development/auth-overview.md")) {
    blockingReasons.push("Auth-related receipt missing docs/development/auth-overview.md.");
  }

  if (isBackendSensitive(entry) && !docsConsulted.includes("docs/development/backend-auth.md")) {
    blockingReasons.push("Backend-sensitive receipt missing docs/development/backend-auth.md.");
  }

  if (docsConsulted.some((doc) => doc === "docs/user-flow.md") && !docsConsulted.includes("docs/flow/user-flow.md")) {
    blockingReasons.push("Receipt uses legacy docs/user-flow.md without active docs/flow/user-flow.md.");
  }

  if (extractedRequirements.length === 0) {
    blockingReasons.push("Receipt has empty extractedRequirements.");
  }

  if (!receipt.wireframe || !["present", "missing", "not-applicable"].includes(receipt.wireframe.status)) {
    blockingReasons.push("Receipt missing valid wireframe status.");
  }

  return {
    runId: manifest.runId,
    sourceCommit: manifest.sourceCommit,
    dirtyState: manifest.dirtyState,
    evidenceBundleId: manifest.evidenceBundleId,
    iaCode: entry.iaCode,
    screenName: entry.screenName,
    phase: "doc-receipts",
    routeOrHostRoute: entry.routeOrHostRoute,
    routeType: entry.routeType,
    audience: entry.audience,
    docsConsulted,
    extractedRequirements,
    evidence: [
      { type: "document-receipt", id: receipt.id ?? `${manifest.runId}-${entry.iaCode}` },
      { type: "description", path: entry.descriptionPath, exists: existsSync(join(REPO_ROOT, entry.descriptionPath)) },
    ],
    status: blockingReasons.length > 0 ? "FAIL" : "PASS",
    blockingReasons,
    sourceFiles: [],
    generatedBy: "verify-doc-receipts.mjs",
    generatedAt: new Date().toISOString(),
  };
}

const rows = manifest.entries.map(validateReceipt);
const result = {
  runId: manifest.runId,
  sourceCommit: manifest.sourceCommit,
  dirtyState: manifest.dirtyState,
  evidenceBundleId: manifest.evidenceBundleId,
  generatedBy: "verify-doc-receipts.mjs",
  generatedAt: new Date().toISOString(),
  status: rows.some((row) => row.status === "BLOCKED") ? "BLOCKED" : rows.some((row) => row.status === "FAIL") ? "FAIL" : "PASS",
  rows,
  summary: {
    totalIa: rows.length,
    statusCounts: statusSummary(rows),
  },
};

writeJson(`${auditDir}/doc-receipt-validation-results.json`, result);

if (result.status !== "PASS") {
  console.error(`Document receipt validation ${result.status}. See ${auditDir}/doc-receipt-validation-results.json.`);
  process.exit(1);
}

console.log(`Document receipt validation PASS. Wrote ${auditDir}/doc-receipt-validation-results.json.`);
