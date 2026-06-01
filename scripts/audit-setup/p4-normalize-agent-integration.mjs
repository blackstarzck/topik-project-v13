#!/usr/bin/env node
// P4 정리 — agent-integration-results.json 을 plan §11 / §14 정합으로 정규화.
//
// 직전 상태 (회색): status="DEFERRED" + rows: [] placeholder.
// 정합 상태: delegationMode="single-session" + 34 IA 각각에 row + 6 public 은
// cross-audit + codex 위임 결과 인용, 28 user/admin 은 single-session review
// 미실시로 BLOCKED 명시.
//
// Plan §11 L969-974 + §14 L1314-1316 정합. child-agent provenance 필드는
// "not-applicable" 로 표기.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = process.cwd();
const RUN_DIR = join(REPO, "reports/ia-verification/runs/20260528-141731");
const MANIFEST = JSON.parse(readFileSync(join(RUN_DIR, "ia-manifest.json"), "utf8"));
const DISPATCH = JSON.parse(readFileSync(join(RUN_DIR, "agent-dispatch-plan.json"), "utf8"));
const MANUAL = JSON.parse(readFileSync(join(RUN_DIR, "manual-review.json"), "utf8"));

// shardId → IA codes 매핑
const shardByIa = new Map();
for (const s of DISPATCH.shards ?? []) {
  for (const c of s.iaCodes ?? []) shardByIa.set(c, s.shardId);
}

// manual-review.json 의 6 public 행 매핑 (codex 위임 결과 인용 소스)
const manualByIa = new Map();
for (const r of MANUAL.rows ?? []) manualByIa.set(r.iaCode, r);

const now = new Date().toISOString();
const rows = [];

for (const entry of MANIFEST.entries ?? []) {
  const iaCode = entry.iaCode;
  const shardId = shardByIa.get(iaCode) ?? "unknown";
  const manualRow = manualByIa.get(iaCode);

  // single-session row schema (plan §3 + §11 정합).
  // child-agent 안 썼으므로 agentId / agentSessionId / taskPacketPath /
  // resultPacketPath / sourceRunId / producedAt / importedBy / importedAt /
  // resultPacketHash / baseCommit 같은 delegated provenance 필드는 "not-applicable".
  const baseRow = {
    runId: MANIFEST.runId,
    sourceCommit: MANIFEST.sourceCommit,
    dirtyState: MANIFEST.dirtyState,
    evidenceBundleId: MANIFEST.evidenceBundleId,
    iaCode,
    screenName: entry.screenName,
    phase: "phase-5-shard-review",
    routeOrHostRoute: entry.routeOrHostRoute,
    routeType: entry.routeType,
    audience: entry.audience,
    shardId,
    assignedShard: shardId,
    delegationMode: "single-session",
    // delegated provenance — single-session 이므로 모두 not-applicable
    agentId: "not-applicable",
    agentSessionId: "not-applicable",
    agentWorkspace: "not-applicable",
    taskPacketPath: "not-applicable",
    resultPacketPath: "not-applicable",
    sourceRunId: "not-applicable",
    producedAt: "not-applicable",
    importedBy: "single-session-coordinator",
    importedAt: now,
    importStatus: "not-applicable",
    resultPacketHash: "not-applicable",
    baseCommit: MANIFEST.sourceCommit,
    coordinatorIntegratedAt: now,
    generatedBy: "p4-normalize-agent-integration.mjs",
    generatedAt: now,
  };

  if (manualRow) {
    // 6 public IA — cross-audit + codex 위임 결과를 single-session row 로 인용.
    rows.push({
      ...baseRow,
      reviewerActor: "coordinator (single-session) with cross-audit by 2 sub-agents + codex delegation",
      docsConsulted: [
        `docs/Wireframe/${entry.iaCode}-*/description.md`,
        "manual-review.json (cross-audit + codex delegated decisions)",
      ],
      extractedRequirements: "see manual-review.json " + iaCode + " row",
      evidence: {
        crossAuditReviewerA: manualRow.reviewerAResponseSummary ?? "absent",
        crossAuditReviewerB: manualRow.reviewerBResponseSummary ?? "absent",
        consolidatedRecommendedLabel: manualRow.consolidatedRecommendedLabel ?? "unknown",
        codexDelegatedDecisions: (manualRow.codexDelegatedDecisions ?? []).map((d) => ({
          id: d.id,
          verdict: d.verdict,
          followUp: d.followUp,
          artifact: d.artifact,
        })),
      },
      agentRecommendation: manualRow.consolidatedRecommendedLabel ?? "PARTIAL",
      coordinatorDecision: "accepted",
      confidence: "medium",
      humanConfirmation: manualRow.confirmationStatus ?? "candidate-note-only",
      blockers: manualRow.blockingReasons ?? [],
      // 정직성: cross-audit 의 consolidatedRecommendedLabel ("PARTIAL") 이 PASS 가 아니라
      // 면 그 권고를 그대로 반영. blockingReasons 가 비어 있다고 PASS 자동 promote 하지
      // 말 것 (plan §11 L1163: child-agent recommendations do not become final labels
      // until coordinator merge accepts them).
      status: (manualRow.consolidatedRecommendedLabel === "PASS") ? "PASS" : (manualRow.consolidatedRecommendedLabel ?? "PARTIAL"),
      blockingReasons: manualRow.blockingReasons ?? [],
      sourceFiles: [`reports/ia-verification/runs/20260528-141731/manual-review.json#${iaCode}`],
    });
  } else {
    // 28 user/admin IA — single-session review 미실시. BLOCKED 명시.
    rows.push({
      ...baseRow,
      reviewerActor: "none",
      docsConsulted: [],
      extractedRequirements: "not-collected",
      evidence: {
        note: "single-session shard review not performed for this IA in current pass",
      },
      agentRecommendation: "not-applicable",
      coordinatorDecision: "deferred",
      confidence: "not-applicable",
      humanConfirmation: "not-applicable",
      blockers: [
        `single-session review not performed for shard ${shardId} (${iaCode}) — plan §14 L1316 requires every IA item reviewed by shard even in single-session mode`,
      ],
      status: "BLOCKED",
      blockingReasons: [
        `single-session shard review not performed (shard=${shardId})`,
      ],
      sourceFiles: [],
    });
  }
}

const integration = {
  runId: MANIFEST.runId,
  sourceCommit: MANIFEST.sourceCommit,
  dirtyState: MANIFEST.dirtyState,
  evidenceBundleId: MANIFEST.evidenceBundleId,
  generatedBy: "p4-normalize-agent-integration.mjs (2026-05-29 plan 정합 정규화)",
  generatedAt: now,
  delegationMode: "single-session",
  monitorMode: "single-session-degraded",
  totalShards: (DISPATCH.shards ?? []).length,
  shardsWithSomeReview: ["public-auth"],
  shardsWithoutReview: ["onboarding-dashboard", "practice-writing", "feedback-reports-recommendations", "library-settings-billing", "admin"],
  reviewerNote: "Plan §11 L969-974 + §14 L1314-1316 정합. child-agent 안 썼으므로 delegationMode='single-session', child-agent provenance 필드는 'not-applicable'. 6 public IA 는 cross-audit (2 sub-agent reviewer A+B) + codex 위임 결과를 single-session coordinator 가 통합. 28 user/admin IA 는 single-session 또는 multi-agent shard review 가 이번 pass 에서 안 일어났으므로 explicit BLOCKED. 이전 status='DEFERRED' placeholder 는 plan 외 워크플로우였음 — 본 파일이 plan 정합 형태로 대체.",
  status: "BLOCKED",
  summary: {
    totalRows: rows.length,
    statusCounts: rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {}),
    perShardStatus: (DISPATCH.shards ?? []).map((s) => {
      const shardRows = rows.filter((r) => r.shardId === s.shardId);
      return {
        shardId: s.shardId,
        iaCount: s.iaCodes.length,
        rowsPresent: shardRows.length,
        passCount: shardRows.filter((r) => r.status === "PASS").length,
        partialCount: shardRows.filter((r) => r.status === "PARTIAL").length,
        blockedCount: shardRows.filter((r) => r.status === "BLOCKED").length,
      };
    }),
  },
  rows,
};

writeFileSync(join(RUN_DIR, "agent-integration-results.json"), JSON.stringify(integration, null, 2) + "\n", "utf8");
console.log(`Wrote single-session agent-integration-results.json — ${rows.length} rows, ${rows.filter((r) => r.status === "PASS").length} PASS / ${rows.filter((r) => r.status === "PARTIAL").length} PARTIAL / ${rows.filter((r) => r.status === "BLOCKED").length} BLOCKED.`);
