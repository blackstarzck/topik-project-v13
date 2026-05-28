#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  generatedAt,
  loadManifest,
  maybeReadJson,
  REPO_ROOT,
  resolveAuditDir,
  writeJson,
} from "./ia-audit-lib.mjs";

const auditDir = resolveAuditDir();
const manifest = loadManifest(auditDir);
const dispatchPlan = maybeReadJson(`${auditDir}/agent-dispatch-plan.json`);

// Optional coordinator-filled receipt content per Plan §6 Step 0.5.1 reviewer-fill.
// When this module is present AND IA_AUDIT_SKELETON_ONLY is unset, real
// extractedRequirements + sitemap/user-flow/prd summaries replace the TODO
// defaults. When absent OR skeleton-only mode is on, the builder emits pure
// skeletons (extractedRequirements=[]) and the validator MUST fail by design.
const skeletonOnly =
  process.env.IA_AUDIT_SKELETON_ONLY === "1" || process.argv.includes("--skeleton-only");
let coordinatorContent = {};
if (!skeletonOnly) {
  try {
    ({ iaReceiptContent: coordinatorContent } = await import("./ia-receipt-content.mjs"));
  } catch (importError) {
    if (importError?.code !== "ERR_MODULE_NOT_FOUND") {
      throw importError;
    }
  }
}

const shardByCode = new Map();
if (Array.isArray(dispatchPlan?.shards)) {
  for (const shard of dispatchPlan.shards) {
    for (const code of shard.iaCodes ?? []) {
      shardByCode.set(code, shard.shardId);
    }
  }
}

function isAuthRelated(entry) {
  return entry.packs.some((pack) => ["AUTH", "SESSION", "EMAIL", "TOKEN", "SECURITY", "RATE-LIMIT"].includes(pack));
}

function isBackendSensitive(entry) {
  return entry.packs.some((pack) =>
    ["OWNER-CHECK", "ADMIN", "RBAC", "ORG-SCOPE", "PRIVILEGE", "STORAGE", "PII"].includes(pack),
  );
}

function isDeferredScopeSensitive(entry) {
  return entry.packs.some((pack) =>
    ["DEFERRED-BILLING", "TRANSPORT-DEFERRED", "POLICY", "BILLING", "NOTIFICATION"].includes(pack),
  );
}

function requiredActiveDocs(entry) {
  const docs = [
    entry.descriptionPath,
    "docs/sitemap.md",
    "docs/flow/user-flow.md",
    "docs/prd.md",
    "docs/spec.md",
  ];
  if (isAuthRelated(entry)) docs.push("docs/development/auth-overview.md");
  if (isBackendSensitive(entry)) docs.push("docs/development/backend-auth.md");
  if (isDeferredScopeSensitive(entry)) docs.push("docs/development/deferred-scope.md");
  return [...new Set(docs)];
}

function buildReceipt(entry) {
  const assignedShard = shardByCode.get(entry.iaCode) ?? "unassigned";
  const wireframeExists = existsSync(join(REPO_ROOT, entry.wireframePath));
  const consulted = requiredActiveDocs(entry);
  const filled = coordinatorContent[entry.iaCode];
  return {
    id: `${manifest.runId}-${entry.iaCode}`,
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
    descriptionPath: entry.descriptionPath,
    wireframe: {
      path: entry.wireframePath,
      status: wireframeExists ? "present" : "missing",
    },
    requiredActiveDocs: consulted,
    docsConsulted: consulted,
    sitemapRequirement:
      filled?.sitemapRequirement ?? `TODO — extract route/notes row for ${entry.iaCode} from docs/sitemap.md`,
    userFlowContext: filled?.userFlowContext ?? {
      previous: `TODO — previous step in docs/flow/user-flow.md for ${entry.iaCode}`,
      next: `TODO — next step in docs/flow/user-flow.md for ${entry.iaCode}`,
    },
    prdRequirement:
      filled?.prdRequirement ?? `TODO — extract relevant section for ${entry.iaCode} from docs/prd.md`,
    extractedRequirements: filled?.extractedRequirements ?? [],
    docConflicts: filled?.docConflicts ?? "none",
    deferredScopeNotes: isDeferredScopeSensitive(entry)
      ? filled?.deferredScopeNotes ?? "TODO — confirm deferred-scope boundary in docs/development/deferred-scope.md"
      : filled?.deferredScopeNotes ?? "n/a",
    receiptOwner: "Coordinator (single-session-degraded)",
    assignedShard,
    assignedAgentId: "not-applicable (single-session)",
    taskPacketPath: "not-applicable (single-session)",
    resultPacketPath: "not-applicable (single-session)",
    receiptStatus: filled ? "filled" : "skeleton",
    generatedBy: "build-doc-receipts.mjs",
    generatedAt: generatedAt(),
  };
}

const receipts = manifest.entries.map(buildReceipt);
const pendingReviewerFill = receipts.filter((r) => r.extractedRequirements.length === 0).length;
const output = {
  runId: manifest.runId,
  sourceCommit: manifest.sourceCommit,
  dirtyState: manifest.dirtyState,
  evidenceBundleId: manifest.evidenceBundleId,
  generatedBy: "build-doc-receipts.mjs",
  generatedAt: generatedAt(),
  builderNotes: {
    intent: "Skeleton-only. Reviewer must fill extractedRequirements from active docs before validator can PASS.",
    rule: "Plan §6 Step 0.5.1 — builder must not invent extractedRequirements; validator MUST fail until reviewer fills them.",
    nextStep: "Fill extractedRequirements per IA item; then re-run pnpm test:ia:docs.",
  },
  summary: {
    totalSkeletons: receipts.length,
    receiptsWithFilledRequirements: receipts.length - pendingReviewerFill,
    pendingReviewerFill,
  },
  receipts,
};

writeJson(`${auditDir}/doc-receipts.json`, output);
const mode = skeletonOnly
  ? "skeleton-only"
  : Object.keys(coordinatorContent).length > 0
    ? "coordinator-filled"
    : "skeleton (no ia-receipt-content.mjs)";
console.log(
  `Wrote ${auditDir}/doc-receipts.json with ${receipts.length} receipts (${mode}). extractedRequirements TODO for ${pendingReviewerFill} items.`,
);
