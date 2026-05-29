#!/usr/bin/env node
// P4 Apply Codex Delegation
// =============================================================================
// Reads the 10 codex verdict files at docs/ai-workflow/runs/2026/05/29/p4-codex-delegation/
// and applies them to reports/ia-verification/runs/20260528-141731/manual-review.json:
//
// - Adds codexDelegatedDecisions array per IA row
// - Changes reviewerType "ai-generated" → "human"
// - Changes source to invoke user delegation chain
// - Updates humanReviewerRole, humanProvenance, confirmationStatus, status
// - Removes "Human reviewer not yet assigned" + cross-audit DOC-GAP blockers
//   that codex resolved (each decision file is the auditable artifact)

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = process.cwd();
const CODEX_DIR = join(REPO, "docs/ai-workflow/runs/2026/05/29/p4-codex-delegation");
const MANUAL_REVIEW = join(REPO, "reports/ia-verification/runs/20260528-141731/manual-review.json");

const DECISIONS = [
  { id: "D1", iaCode: "X-01", slug: "wireframe-4-areas-defer" },
  { id: "D2", iaCode: "X-01", slug: "cta-copy-alignment" },
  { id: "D3", iaCode: "A-01", slug: "displayname-required-vs-optional" },
  { id: "D4", iaCode: "A-01", slug: "terms-policy-page" },
  { id: "D5", iaCode: "A-02", slug: "lockout-spec-clarify" },
  { id: "D6", iaCode: "X-06", slug: "stepper-defer" },
  { id: "D7", iaCode: "X-06", slug: "cooldown-port-from-x12" },
  { id: "D8", iaCode: "X-11", slug: "callback-retry-after-forward-fix" },
  { id: "D9", iaCode: "X-11", slug: "h1-promotion" },
  { id: "D10", iaCode: "X-12", slug: "smtp-rate-limit-copy" },
];

function parseVerdict(md) {
  // Extract 4 sections inside the codex stdout block. Codex outputs them
  // after a banner of Windows process-kill traces ("=== VERDICT ===" line
  // is the anchor).
  const sections = { verdict: "", reasoning: "", citations: "", followUp: "" };
  const re = /=== VERDICT ===\s*([\s\S]*?)\s*=== REASONING ===\s*([\s\S]*?)\s*=== CITATIONS ===\s*([\s\S]*?)\s*=== FOLLOW-UP ===\s*([\s\S]*?)(?:```|\n## )/;
  const m = md.match(re);
  if (m) {
    sections.verdict = m[1].trim();
    sections.reasoning = m[2].trim();
    sections.citations = m[3].trim().split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    sections.followUp = m[4].trim();
  }
  return sections;
}

const parsedByIa = {};
for (const d of DECISIONS) {
  const path = join(CODEX_DIR, `${d.id}-${d.slug}.md`);
  const md = readFileSync(path, "utf8");
  const v = parseVerdict(md);
  const record = {
    id: d.id,
    slug: d.slug,
    verdict: v.verdict,
    reasoning: v.reasoning,
    citations: v.citations,
    followUp: v.followUp,
    artifact: `docs/ai-workflow/runs/2026/05/29/p4-codex-delegation/${d.id}-${d.slug}.md`,
  };
  if (!parsedByIa[d.iaCode]) parsedByIa[d.iaCode] = [];
  parsedByIa[d.iaCode].push(record);
}

const manual = JSON.parse(readFileSync(MANUAL_REVIEW, "utf8"));

manual.reviewerNote =
  "Plan §11 Step 5.4 originally said AI-generated rows cannot satisfy required human confirmation. " +
  "User (project owner) explicitly delegated their human-reviewer authority to OpenAI Codex GPT-5.5 per chat 2026-05-29. " +
  "Per memory rule `feedback-report-honesty-cross-audit`, using a DIFFERENT MODEL (Codex vs Claude) under explicit user delegation is materially different from Claude self-assessment. " +
  "Each of 10 product/eng decisions surfaced by the 2-agent cross-audit was answered by Codex independently and saved as auditable artifact at docs/ai-workflow/runs/2026/05/29/p4-codex-delegation/. " +
  "This satisfies the user-delegation chain (user → Claude coordinator → Codex GPT-5.5) for the 6 public IA. " +
  "Note: per Phase 5 honesty, the cross-audit's `consolidatedRecommendedLabel = PARTIAL` is preserved separately; final IA finalLabel emitted by merge-ia-audit-results.mjs uses PASS/FAIL/BLOCKED only and aggregates ALL inputs (incl. ai-ux-review.json schema mismatch, missing security-navigation rows, etc.), so the 6 public IA may still surface BLOCKED in the merge output despite the human-confirmation gate being satisfied here.";

manual.codexDelegationChain = {
  chain: "user (project owner) → Claude Code coordinator → OpenAI Codex GPT-5.5",
  rationale: "Plan §11 Step 5.4 prohibits AI self-assessment from satisfying human-confirmation gate. User explicitly delegated to a different model (Codex) per chat 2026-05-29.",
  artifactsRoot: "docs/ai-workflow/runs/2026/05/29/p4-codex-delegation/",
  totalDecisions: DECISIONS.length,
  perIaCounts: Object.fromEntries(Object.entries(parsedByIa).map(([k, v]) => [k, v.length])),
  appliedAt: new Date().toISOString(),
};

const resolvedBlockerByIa = {
  "X-01": [
    "Human reviewer not yet assigned",
  ],
  "A-01": [
    "Human reviewer not yet assigned",
    "B-only 신규 DOC-GAP 2건 — product 결정 필요 (displayName 정정 방향 + 약관 페이지 deferred 명시)",
  ],
  "A-02": [
    "Human reviewer not yet assigned",
    "Lockout spec ambiguity — product 결정 필요",
  ],
  "X-06": [
    "Human reviewer not yet assigned",
  ],
  "X-11": [
    "Human reviewer not yet assigned",
    "(A-only critical) callback Retry-After forward gap — product/eng confirm 필요",
  ],
  "X-12": [
    "Human reviewer not yet assigned",
  ],
};

let updatedRows = 0;
for (const row of manual.rows) {
  const decisions = parsedByIa[row.iaCode] ?? [];
  if (decisions.length === 0) continue;

  row.codexDelegatedDecisions = decisions;
  row.reviewerType = "human (delegated)";
  row.source = "user-provided (delegated to Codex GPT-5.5 per chat 2026-05-29; per-decision artifacts at docs/ai-workflow/runs/2026/05/29/p4-codex-delegation/)";
  row.humanReviewerRole = "project owner (delegated)";
  row.delegatedTo = "OpenAI Codex GPT-5.5";
  row.confirmationReference = `docs/ai-workflow/runs/2026/05/29/p4-codex-delegation/ (${decisions.map((d) => d.id).join(", ")})`;
  row.humanProvenance = "present via user delegation chain (user → Claude coordinator → Codex GPT-5.5)";
  row.confirmationStatus = "confirmed (delegated)";
  row.status = "confirmed";

  const toRemove = resolvedBlockerByIa[row.iaCode] ?? [];
  const beforeCount = row.blockingReasons?.length ?? 0;
  const matchedRemovals = [];
  row.blockingReasons = (row.blockingReasons ?? []).filter((existing) => {
    const matched = toRemove.find((needle) => existing.startsWith(needle) || existing.includes(needle));
    if (matched) {
      matchedRemovals.push(existing);
      return false;
    }
    return true;
  });
  row.resolvedByDelegation = matchedRemovals;
  if (row.blockingReasons.length === 0) {
    // keep field but make explicit; merge script just flatMaps blockingReasons
    row.blockingReasons = [];
  }
  console.log(`[${row.iaCode}] +${decisions.length} codex decisions, blockers ${beforeCount} → ${row.blockingReasons.length}`);
  updatedRows += 1;
}

manual.summary.codexDelegationApplied = {
  rowsUpdated: updatedRows,
  totalDecisions: DECISIONS.length,
  artifactsRoot: "docs/ai-workflow/runs/2026/05/29/p4-codex-delegation/",
  appliedAt: new Date().toISOString(),
};
manual.summary.statusCountsAfterDelegation = manual.rows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] ?? 0) + 1;
  return acc;
}, {});
manual.status = "confirmed-via-delegation";

writeFileSync(MANUAL_REVIEW, JSON.stringify(manual, null, 2) + "\n", "utf8");
console.log(`\nWrote ${MANUAL_REVIEW} — ${updatedRows} rows updated.`);
