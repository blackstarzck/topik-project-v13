#!/usr/bin/env node
import { loadManifest, resolveAuditDir, writeJson } from "./ia-audit-lib.mjs";

const auditDir = resolveAuditDir();
const manifest = loadManifest(auditDir);

const shardDefinitions = [
  {
    shardId: "public-auth",
    name: "Public/Auth shard",
    iaCodes: ["X-01", "A-01", "A-02", "X-06", "X-11", "X-12"],
    roleFocus: "Public entry, authentication pages, auth callback support routes.",
    crossCuttingEvidenceLanes: ["security-navigation", "policy"],
  },
  {
    shardId: "onboarding-dashboard",
    name: "Onboarding/Dashboard shard",
    iaCodes: ["A-03", "B-01", "X-02"],
    roleFocus: "First-run onboarding, learning dashboard, growth dashboard.",
    crossCuttingEvidenceLanes: ["security-navigation"],
  },
  {
    shardId: "practice-writing",
    name: "Practice/Writing shard",
    iaCodes: ["C-01", "C-02", "C-03", "D-01", "D-02", "D-03", "D-04", "D-M1", "D-M2", "D-M3"],
    roleFocus: "Practice selection, writing surfaces, hosted writing modals and states.",
    crossCuttingEvidenceLanes: ["hosted-surface", "security-navigation", "ai-ux-review"],
  },
  {
    shardId: "feedback-reports-recommendations",
    name: "Feedback/Reports/Recommendations shard",
    iaCodes: ["E-01", "E-02", "R-01", "R-02", "X-07"],
    roleFocus: "Feedback, reports, AI recommendations, owner-bound result routes.",
    crossCuttingEvidenceLanes: ["security-navigation", "ai-ux-review"],
  },
  {
    shardId: "library-settings-billing",
    name: "Library/Settings/Billing shard",
    iaCodes: ["F-01", "F-M1", "G-01", "X-03", "X-04", "X-05", "X-09"],
    roleFocus: "Library, exports, profile/settings, deferred billing and notifications.",
    crossCuttingEvidenceLanes: ["hosted-surface", "policy", "security-navigation"],
  },
  {
    shardId: "admin",
    name: "Admin shard",
    iaCodes: ["H-01", "X-08", "X-10"],
    roleFocus: "Admin role boundaries, RBAC, audit-sensitive admin surfaces.",
    crossCuttingEvidenceLanes: ["security-navigation", "policy"],
  },
];

const entryByCode = new Map(manifest.entries.map((entry) => [entry.iaCode, entry]));
const assigned = new Set();

const shards = shardDefinitions.map((definition, index) => {
  for (const code of definition.iaCodes) assigned.add(code);
  return {
    runId: manifest.runId,
    sourceCommit: manifest.sourceCommit,
    dirtyState: manifest.dirtyState,
    evidenceBundleId: manifest.evidenceBundleId,
    shardId: definition.shardId,
    name: definition.name,
    iaCodes: definition.iaCodes,
    roleFocus: definition.roleFocus,
    exactReadScope: [
      "docs/ai-workflow/ia-page-implementation-verification.md",
      "docs/ai-workflow/ia-ai-first-ux-review-checklist.md",
      "docs/sitemap.md",
      "docs/flow/user-flow.md",
      "docs/prd.md",
      "assigned docs/IA/*/description.md files only",
      `${auditDir}/ia-manifest.json`,
      `${auditDir}/source-map-results.json`,
      `${auditDir}/static-results.json when available`,
      `${auditDir}/browser-results.json when available`,
      `${auditDir}/hosted-surface-results.json when available`,
      `${auditDir}/security-navigation-results.json when available`,
    ],
    exactWriteScope: [
      `${auditDir}/agent-packets/results/${manifest.runId}-${definition.shardId}-*.md`,
      `${auditDir}/agent-packets/results/${manifest.runId}-${definition.shardId}-*.json`,
    ],
    filesNotToTouch: ["src/**", "docs/IA/**", "reports/ia-verification/latest"],
    taskPacketPath: `${auditDir}/agent-packets/tasks/${manifest.runId}-${definition.shardId}.md`,
    resultPacketPath: `${auditDir}/agent-packets/results/${manifest.runId}-${definition.shardId}-result.md`,
    requiredJsonEvidenceInputs: [
      `${auditDir}/ia-manifest.json`,
      `${auditDir}/doc-receipts.json`,
      `${auditDir}/source-map-results.json`,
      `${auditDir}/static-results.json`,
      `${auditDir}/browser-results.json`,
      `${auditDir}/security-navigation-results.json`,
    ],
    concurrencyGroup: index < 6 ? 1 : 2,
    subagentEligible: {
      value: true,
      reason: "Shard review is read-only, bounded by IA codes, and writes only its result packet.",
    },
    primaryShardOwner: definition.name,
    crossCuttingEvidenceLanes: definition.crossCuttingEvidenceLanes,
    escalationTriggers: [
      "missing required JSON evidence",
      "doc conflict",
      "security blocker",
      "low confidence UX judgment",
      "hosted modal trigger evidence missing",
      "agent recommendation conflicts with JSON evidence",
    ],
    entries: definition.iaCodes.map((code) => entryByCode.get(code)).filter(Boolean),
    generatedBy: "build-agent-dispatch-plan.mjs",
    generatedAt: new Date().toISOString(),
  };
});

const missing = manifest.entries.map((entry) => entry.iaCode).filter((code) => !assigned.has(code));
const duplicateCount = shardDefinitions.flatMap((shard) => shard.iaCodes).length - assigned.size;

const dispatchPlan = {
  runId: manifest.runId,
  sourceCommit: manifest.sourceCommit,
  dirtyState: manifest.dirtyState,
  evidenceBundleId: manifest.evidenceBundleId,
  generatedBy: "build-agent-dispatch-plan.mjs",
  generatedAt: new Date().toISOString(),
  maxConcurrentChildAgents: 6,
  delegationMode: "planned",
  shards,
  supportSurfaceShard: {
    shardId: "public-auth",
    routeHandlers: manifest.supportSurfaces,
  },
  validation: {
    totalIa: manifest.entries.length,
    assignedIa: assigned.size,
    missingIa: missing,
    duplicateAssignments: duplicateCount,
    status: missing.length === 0 && duplicateCount === 0 ? "PASS" : "FAIL",
  },
};

writeJson(`${auditDir}/agent-dispatch-plan.json`, dispatchPlan);

if (dispatchPlan.validation.status !== "PASS") {
  console.error(`Dispatch plan validation failed. See ${auditDir}/agent-dispatch-plan.json.`);
  process.exit(1);
}

console.log(`Wrote ${auditDir}/agent-dispatch-plan.json.`);
