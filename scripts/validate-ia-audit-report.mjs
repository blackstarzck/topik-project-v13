#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { maybeReadJson, resolveAuditDir, resolvePath, writeJson } from "./audit-setup/ia-audit-lib.mjs";

const auditDir = resolveAuditDir();
const audit = maybeReadJson(`${auditDir}/ia-implementation-audit.json`);
const reportPath = resolvePath(join(auditDir, "ia-implementation-audit.md"));
const errors = [];

if (!audit) {
  errors.push("missing ia-implementation-audit.json");
}

if (!existsSync(reportPath)) {
  errors.push("missing ia-implementation-audit.md");
}

const report = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : "";

for (const entry of audit?.entries ?? []) {
  if (!report.includes(entry.iaCode)) {
    errors.push(`report missing ${entry.iaCode}`);
  }

  if (entry.finalLabel === "PASS") {
    if (entry.topGaps.length > 0) errors.push(`${entry.iaCode} PASS has top gaps`);
    if (entry.planningResult !== "PASS") errors.push(`${entry.iaCode} PASS without document receipt PASS`);
    if (entry.developmentResult !== "PASS") errors.push(`${entry.iaCode} PASS without source/development PASS`);
    if (entry.qaEvidence !== "present") errors.push(`${entry.iaCode} PASS without QA evidence`);
    if (entry.dataSecurityResult !== "PASS" && entry.audience !== "public") {
      errors.push(`${entry.iaCode} PASS without protected-route security evidence`);
    }
    if (entry.humanConfirmation === "missing" && requiresHuman(entry)) {
      errors.push(`${entry.iaCode} PASS without required human confirmation`);
    }
  }
}

function requiresHuman(entry) {
  return entry.packs.some((pack) =>
    ["MODAL", "FORM", "AUTH", "ADMIN", "POLICY", "DEFERRED-BILLING", "TRANSPORT-DEFERRED", "RECOMMENDATION"].includes(pack),
  );
}

const validation = {
  runId: audit?.runId ?? "unknown",
  generatedBy: "validate-ia-audit-report.mjs",
  generatedAt: new Date().toISOString(),
  status: errors.length > 0 ? "FAIL" : "PASS",
  errors,
};

writeJson(`${auditDir}/ia-implementation-audit-validation.json`, validation);

if (errors.length > 0) {
  console.error(`IA audit validation FAIL. See ${auditDir}/ia-implementation-audit-validation.json.`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`IA audit validation PASS. Wrote ${auditDir}/ia-implementation-audit-validation.json.`);
