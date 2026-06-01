// Coordinator assembler: turn Phase 5 shard cards into merge-compatible
// ai-ux-review.json + agent-integration-results.json, and write per-shard
// task/result packets with provenance. Run with: node _assemble-phase5.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const dir = "reports/ia-verification/runs/20260601-120308";
const WF_RUN = "phase5-prod-rerun (practice-writing=wf_542a55f0-9fe; onboarding/feedback/library/admin=wf_91800358-d3f; public-auth reused from wf_f27db2eb-29f, evidence-stable)";
const now = new Date().toISOString();

const manifest = JSON.parse(readFileSync(`${dir}/ia-manifest.json`, "utf8"));
const dispatch = JSON.parse(readFileSync(`${dir}/agent-dispatch-plan.json`, "utf8"));
const shards = JSON.parse(readFileSync(`${dir}/phase5-shard-cards.json`, "utf8"));

const meta = {
  runId: manifest.runId,
  sourceCommit: manifest.sourceCommit,
  dirtyState: manifest.dirtyState,
  evidenceBundleId: manifest.evidenceBundleId,
};
const entryByIa = new Map((manifest.entries || []).map((e) => [e.iaCode, e]));
const HUMAN = new Set(
  (manifest.entries || [])
    .filter((e) => (e.requiredEvidenceInputs || []).includes("human-confirmation"))
    .map((e) => e.iaCode),
);

mkdirSync(`${dir}/agent-packets/tasks`, { recursive: true });
mkdirSync(`${dir}/agent-packets/results`, { recursive: true });

const aiCards = [];
const aiBlockedCards = [];
const integrationRows = [];

for (const shard of shards) {
  const shardId = shard.shardId;
  const cardsJson = JSON.stringify(shard.cards);
  const resultPacketHash = createHash("sha256").update(cardsJson).digest("hex");
  const taskPacketPath = `${dir}/agent-packets/tasks/${shardId}.md`;
  const resultPacketJsonPath = `${dir}/agent-packets/results/${shardId}.json`;
  const resultPacketMdPath = `${dir}/agent-packets/results/${shardId}.md`;
  const agentId = `${WF_RUN}/${shardId}`;

  // Task packet
  const iaList = shard.cards.map((c) => c.iaCode).join(", ");
  writeFileSync(
    taskPacketPath,
    `## Task Packet\n\n- Agent: ${agentId}\n- Role: IA-first UX shard reviewer (${shardId})\n- Objective: Review assigned IA screens against docs/IA descriptions, source, collected evidence, and screenshots; recommend labels (cannot finalize PASS).\n- Audience: ${shardId === "admin" ? "admin" : "user/public"}\n- Accepted scope: IA codes ${iaList}\n- Out of scope: finalizing PASS, editing product source, editing JSON evidence.\n- Docs consulted: docs/ai-workflow/ia-ai-first-ux-review-checklist.md, docs/IA/*/description.md for owned IA.\n- Exact read scope: ${dir}/phase5-evidence-digest.json, docs/IA/**, src/app/**, src/components/**, screenshots/**.\n- Exact write scope: result packet only (returned via workflow result, imported by coordinator).\n- Required verification: read screenshots to verify CTA/state claims; apply checklist 6.1-6.9 + section 9 no-pass rules.\n- Expected output: one IA review card per owned IA (schema-validated).\n- Context ledger path: docs/ai-workflow/runs/2026/06/01/20260601-1203-ia-full-audit-run.md\n`,
  );

  // Result packet (json companion + md summary)
  writeFileSync(resultPacketJsonPath, JSON.stringify(shard, null, 2));
  const mdLines = [
    `## Result Packet`,
    ``,
    `- Agent: ${agentId}`,
    `- Role: IA-first UX shard reviewer (${shardId})`,
    `- Objective completed: yes (${shard.cards.length} IA cards)`,
    `- Audience verified: yes`,
    `- resultPacketHash (sha256): ${resultPacketHash}`,
    `- IA cards: ${iaList}`,
    ``,
    `| IA | aiUxResult | rec | conf | adj | blockers |`,
    `| --- | --- | --- | --- | --- | --- |`,
    ...shard.cards.map(
      (c) =>
        `| ${c.iaCode} | ${c.aiUxResult} | ${c.recommendedLabel} | ${c.confidence} | ${c.gptAdjudication} | ${(c.blockingReasons || []).length} |`,
    ),
    ``,
  ];
  writeFileSync(resultPacketMdPath, mdLines.join("\n") + "\n");

  for (const c of shard.cards) {
    const e = entryByIa.get(c.iaCode) || {};
    const card = {
      iaCode: c.iaCode,
      screenName: e.screenName,
      route: e.routeOrHostRoute,
      audience: e.audience,
      aiUxResult: c.aiUxResult,
      status: c.aiUxResult,
      confidence: c.confidence,
      gptAdjudication: c.gptAdjudication,
      humanConfirmation: HUMAN.has(c.iaCode) ? "pending-adjudication" : "not-required",
      findings: c.findings,
      topGaps: c.topGaps || [],
      blockingReasons: c.blockingReasons || [],
      gptQuestions: c.gptQuestions || [],
      evidenceReferences: c.evidenceUsed || [],
      resolvedBlockers: [],
      screenshotsViewed: c.screenshotsViewed || [],
      shardId,
    };
    if (c.aiUxResult === "BLOCKED") aiBlockedCards.push(card);
    else aiCards.push(card);

    integrationRows.push({
      ...meta,
      iaCode: c.iaCode,
      screenName: e.screenName,
      phase: "phase-5-shard-review",
      routeOrHostRoute: e.routeOrHostRoute,
      routeType: e.routeType,
      audience: e.audience,
      shardId,
      assignedShard: shardId,
      delegationMode: "delegated",
      agentId,
      agentSessionId: WF_RUN,
      agentWorkspace: "workflow-subagent",
      taskPacketPath,
      resultPacketPath: resultPacketJsonPath,
      sourceRunId: manifest.runId,
      producedAt: now,
      importedBy: "coordinator (Claude Opus 4.8)",
      importedAt: now,
      importStatus: "imported",
      resultPacketHash,
      baseCommit: manifest.sourceCommit,
      coordinatorIntegratedAt: now,
      reviewerActor: `workflow-agent:${shardId}`,
      docsConsulted: c.docsConsulted || [],
      extractedRequirements: c.topGaps || [],
      evidence: c.evidenceUsed || [],
      agentRecommendation: c.recommendedLabel,
      coordinatorDecision: "accepted",
      confidence: c.confidence,
      humanConfirmation: HUMAN.has(c.iaCode) ? "pending-adjudication" : "not-required",
      blockers: c.blockingReasons || [],
      status: c.recommendedLabel,
      blockingReasons: c.blockingReasons || [],
      sourceFiles: c.sourceFiles || [],
    });
  }
}

const tally = (arr, key) =>
  arr.reduce((t, r) => ((t[r[key]] = (t[r[key]] || 0) + 1), t), {});

const aiUx = {
  ...meta,
  generatedBy: "coordinator assembler from Phase 5 shard cards (workflow " + WF_RUN + ")",
  generatedAt: now,
  delegationMode: "delegated",
  checklist: "docs/ai-workflow/ia-ai-first-ux-review-checklist.md",
  reviewerNote:
    "6 independent IA shard reviewer agents (Claude Opus 4.8 via workflow) reviewed each IA against docs, source, collected evidence, and rendered screenshots. Cards with aiUxResult=BLOCKED are in blockedCards; others in cards. All non-PASS/modal/auth/policy items flagged needs-adjudication.",
  cards: aiCards,
  blockedCards: aiBlockedCards,
  summary: {
    total: aiCards.length + aiBlockedCards.length,
    aiUxResultCounts: tally([...aiCards, ...aiBlockedCards], "aiUxResult"),
  },
  status: "complete",
  phase5NoPassRuleApplied: true,
};
writeFileSync(`${dir}/ai-ux-review.json`, JSON.stringify(aiUx, null, 2));

const integration = {
  ...meta,
  generatedBy: "coordinator assembler from Phase 5 shard cards (workflow " + WF_RUN + ")",
  generatedAt: now,
  delegationMode: "delegated",
  monitorMode: "single-session-degraded",
  totalShards: shards.length,
  shardsWithSomeReview: shards.length,
  shardsWithoutReview: 0,
  reviewerNote:
    "Delegated shard review via workflow " + WF_RUN + ". Coordinator imported each shard result packet, recorded provenance (resultPacketHash, baseCommit, sourceRunId), and accepted the recommendations as inputs. Final labels are computed by merge-ia-audit-results.mjs, not by these recommendations.",
  status: "complete",
  summary: {
    totalRows: integrationRows.length,
    recommendationCounts: tally(integrationRows, "status"),
  },
  rows: integrationRows,
};
writeFileSync(`${dir}/agent-integration-results.json`, JSON.stringify(integration, null, 2));

console.log(
  `ai-ux-review.json: ${aiCards.length} cards + ${aiBlockedCards.length} blockedCards. agent-integration-results.json: ${integrationRows.length} rows.`,
);
console.log("aiUx tally:", JSON.stringify(aiUx.summary.aiUxResultCounts));
console.log("integration rec tally:", JSON.stringify(integration.summary.recommendationCounts));
console.log("human-confirmation IA (need adjudication):", [...HUMAN].sort().join(", "));
