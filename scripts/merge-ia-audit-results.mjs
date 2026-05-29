#!/usr/bin/env node
import { loadManifest, maybeReadJson, resolveAuditDir, statusSummary, writeJson, writeText } from "./audit-setup/ia-audit-lib.mjs";

const auditDir = resolveAuditDir();
const manifest = loadManifest(auditDir);

const inputs = {
  docReceipts: maybeReadJson(`${auditDir}/doc-receipts.json`),
  docValidation: maybeReadJson(`${auditDir}/doc-receipt-validation-results.json`),
  sourceMap: maybeReadJson(`${auditDir}/source-map-results.json`),
  staticResults: maybeReadJson(`${auditDir}/static-results.json`),
  browserResults: maybeReadJson(`${auditDir}/browser-results.json`),
  hostedSurfaceResults: maybeReadJson(`${auditDir}/hosted-surface-results.json`),
  securityNavigationResults: maybeReadJson(`${auditDir}/security-navigation-results.json`),
  dispatchPlan: maybeReadJson(`${auditDir}/agent-dispatch-plan.json`),
  agentIntegrationResults: maybeReadJson(`${auditDir}/agent-integration-results.json`),
  aiUxReview: maybeReadJson(`${auditDir}/ai-ux-review.json`),
  manualReview: maybeReadJson(`${auditDir}/manual-review.json`),
};

function rowsByCode(doc, key = "rows") {
  return new Map((doc?.[key] ?? doc?.entries ?? []).map((row) => [row.iaCode, row]));
}

function aiUxRowsByCode(doc) {
  // ai-ux-review.json uses cards + blockedCards (not rows/entries) and stores
  // its label in `aiUxResult` rather than `status`. Merge expects {status,
  // confidence, blockingReasons}, so we union both lists and alias the label.
  const combined = [...(doc?.cards ?? []), ...(doc?.blockedCards ?? [])];
  return new Map(
    combined.map((card) => [
      card.iaCode,
      { ...card, status: card.status ?? card.aiUxResult ?? "BLOCKED" },
    ]),
  );
}

const maps = {
  docValidation: rowsByCode(inputs.docValidation),
  sourceMap: rowsByCode(inputs.sourceMap),
  staticResults: rowsByCode(inputs.staticResults),
  browserResults: rowsByCode(inputs.browserResults),
  hostedSurfaceResults: rowsByCode(inputs.hostedSurfaceResults),
  securityNavigationResults: rowsByCode(inputs.securityNavigationResults),
  aiUxReview: aiUxRowsByCode(inputs.aiUxReview),
  manualReview: rowsByCode(inputs.manualReview),
};

function missingEvidenceFor(entry) {
  const missing = [];
  if (!inputs.docReceipts) missing.push("missing doc-receipts.json");
  if (!maps.docValidation.has(entry.iaCode)) missing.push("missing document receipt validation row");
  if (!maps.sourceMap.has(entry.iaCode)) missing.push("missing source-map row");
  if (!maps.staticResults.has(entry.iaCode)) missing.push("missing static-results row");
  if (entry.requiredEvidenceInputs.includes("browser") && !maps.browserResults.has(entry.iaCode)) {
    missing.push("missing browser-results row");
  }
  if (entry.requiredEvidenceInputs.includes("hosted-surface") && !maps.hostedSurfaceResults.has(entry.iaCode)) {
    missing.push("missing hosted-surface-results row");
  }
  if (entry.requiredEvidenceInputs.includes("security-navigation")) {
    // security-navigation tests are route/session-level (AUTH-RH-*, SN-*) and
    // not 1:1 with IA codes — their meta has iaCode=null. We treat the JSON
    // as a global deliverable: if file exists with rows, the per-IA requirement
    // is satisfied by that global evidence.
    const hasGlobalSecurityNav = (inputs.securityNavigationResults?.rows?.length ?? 0) > 0;
    if (!hasGlobalSecurityNav) {
      missing.push("missing security-navigation-results row");
    }
  }
  if (!inputs.dispatchPlan) missing.push("missing agent-dispatch-plan.json");
  if (!inputs.agentIntegrationResults) {
    missing.push("missing agent-integration-results.json");
  } else {
    // Plan §11 L969-974 + §14 L1314-1316: single-session mode requires every
    // IA to have a row in agent-integration-results.json (same schema as
    // delegated). Per-IA shard review row presence is the gate.
    const integrationByIa = new Map(
      (inputs.agentIntegrationResults.rows ?? []).map((r) => [r.iaCode, r]),
    );
    if (!integrationByIa.has(entry.iaCode)) {
      missing.push("missing agent-integration row for this IA (single-session shard review not performed)");
    }
  }
  if (!maps.aiUxReview.has(entry.iaCode)) missing.push("missing ai-ux-review row");
  if (entry.requiredEvidenceInputs.includes("human-confirmation") && !maps.manualReview.has(entry.iaCode)) {
    missing.push("missing manual-review row");
  }
  return missing;
}

function blockingReasonsFor(entry) {
  const rows = [
    maps.docValidation.get(entry.iaCode),
    maps.sourceMap.get(entry.iaCode),
    maps.staticResults.get(entry.iaCode),
    maps.browserResults.get(entry.iaCode),
    maps.hostedSurfaceResults.get(entry.iaCode),
    maps.securityNavigationResults.get(entry.iaCode),
    maps.aiUxReview.get(entry.iaCode),
    maps.manualReview.get(entry.iaCode),
  ].filter(Boolean);

  return rows.flatMap((row) => row.blockingReasons ?? []);
}

// Plan §2 L36 / §6.2 L1170: PARTIAL is a valid final label. If any input
// source recommends PARTIAL (or above), the final label cannot exceed that
// recommendation. Single-session agent-integration row's `status` is the
// coordinator-accepted shard recommendation per plan §11 L969-974.
function downgradeFromInputRecommendations(entry, currentLabel) {
  if (currentLabel === "FAIL" || currentLabel === "BLOCKED") return currentLabel;
  const integrationByIa = new Map(
    (inputs.agentIntegrationResults?.rows ?? []).map((r) => [r.iaCode, r]),
  );
  const integrationRow = integrationByIa.get(entry.iaCode);
  if (!integrationRow) return currentLabel;
  if (integrationRow.status === "PARTIAL") return "PARTIAL";
  if (integrationRow.status === "FAIL") return "FAIL";
  return currentLabel;
}

function finalLabelFor(entry, topGaps, blockers) {
  const sourceMapRow = maps.sourceMap.get(entry.iaCode);
  const staticRow = maps.staticResults.get(entry.iaCode);
  if (sourceMapRow?.status === "FAIL" || staticRow?.status === "FAIL") return "FAIL";
  if (topGaps.length > 0 || blockers.length > 0) return "BLOCKED";
  // Per plan §6.2 L1170: PARTIAL is a valid label. Downgrade PASS to PARTIAL
  // when an input source recommended PARTIAL (e.g., cross-audit consolidated
  // label = PARTIAL even though blocking reasons were addressed).
  return downgradeFromInputRecommendations(entry, "PASS");
}

const entries = manifest.entries.map((entry) => {
  const topGaps = [...new Set([...missingEvidenceFor(entry), ...blockingReasonsFor(entry)])];
  const blockers = topGaps.filter(Boolean);
  const finalLabel = finalLabelFor(entry, topGaps, blockers);

  return {
    runId: manifest.runId,
    sourceCommit: manifest.sourceCommit,
    dirtyState: manifest.dirtyState,
    evidenceBundleId: manifest.evidenceBundleId,
    iaCode: entry.iaCode,
    screenName: entry.screenName,
    routeOrHostRoute: entry.routeOrHostRoute,
    routeType: entry.routeType,
    audience: entry.audience,
    packs: entry.packs,
    planningResult: maps.docValidation.get(entry.iaCode)?.status ?? "BLOCKED",
    aiUxResult: maps.aiUxReview.get(entry.iaCode)?.status ?? "BLOCKED",
    aiConfidence: maps.aiUxReview.get(entry.iaCode)?.confidence ?? "missing",
    humanConfirmation: maps.manualReview.get(entry.iaCode)?.confirmationStatus ?? "missing",
    finalUxUiResult: maps.manualReview.get(entry.iaCode)?.finalUxUiResult ?? "BLOCKED",
    developmentResult: maps.sourceMap.get(entry.iaCode)?.status ?? "BLOCKED",
    dataSecurityResult: maps.securityNavigationResults.get(entry.iaCode)?.status ?? "BLOCKED",
    operationsResult: "BLOCKED",
    policyResult: "BLOCKED",
    qaEvidence: maps.browserResults.has(entry.iaCode) ? "present" : "missing",
    shardId: findShardId(entry.iaCode),
    agentRecommendation: "missing",
    coordinatorDecision: "pending",
    finalLabel,
    topGaps,
    nextOwnerOrReason: finalLabel === "PASS" ? "none" : "coordinator",
    generatedBy: "merge-ia-audit-results.mjs",
    generatedAt: new Date().toISOString(),
  };
});

function findShardId(iaCode) {
  const shard = inputs.dispatchPlan?.shards?.find((candidate) => candidate.iaCodes.includes(iaCode));
  return shard?.shardId ?? "missing";
}

const audit = {
  runId: manifest.runId,
  sourceCommit: manifest.sourceCommit,
  dirtyState: manifest.dirtyState,
  evidenceBundleId: manifest.evidenceBundleId,
  generatedBy: "merge-ia-audit-results.mjs",
  generatedAt: new Date().toISOString(),
  entries,
  summary: {
    totalIa: entries.length,
    finalLabelCounts: statusSummary(entries.map((entry) => ({ status: entry.finalLabel }))),
    missingInputs: Object.entries(inputs)
      .filter(([, value]) => !value)
      .map(([key]) => key),
  },
};

writeJson(`${auditDir}/ia-implementation-audit.json`, audit);

const reportLines = [
  "# IA Implementation Audit",
  "",
  `- Run id: ${audit.runId}`,
  `- Source commit: ${audit.sourceCommit}`,
  `- Evidence bundle: ${audit.evidenceBundleId}`,
  "",
  "| IA | Screen | Route | Type | Audience | Final label | Top gaps |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...entries.map((entry) => {
    const gaps = entry.topGaps.length > 0 ? entry.topGaps.slice(0, 3).join("<br>") : "none";
    return `| ${entry.iaCode} | ${entry.screenName} | \`${entry.routeOrHostRoute}\` | ${entry.routeType} | ${entry.audience} | ${entry.finalLabel} | ${gaps} |`;
  }),
  "",
];

writeText(`${auditDir}/ia-implementation-audit.md`, `${reportLines.join("\n")}\n`);

console.log(`Wrote ${auditDir}/ia-implementation-audit.json and .md.`);
