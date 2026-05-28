#!/usr/bin/env node
// One-shot helper: merge 6 shard cards.json files into ai-ux-review.json
// for the current audit run. Fix invalid backslash-u escapes that child
// agents may have emitted, then recompute summary + overall status.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RUN_DIR = "reports/ia-verification/runs/20260528-141731";
const RESULTS_DIR = join(RUN_DIR, "agent-packets/results");
const TARGET = join(RUN_DIR, "ai-ux-review.json");

const INVALID_U_RE = /\\u(?![0-9a-fA-F]{4})/g;

const allCards = [];
for (const f of readdirSync(RESULTS_DIR).filter((x) => x.endsWith("-cards.json"))) {
  const fpath = join(RESULTS_DIR, f);
  let txt = readFileSync(fpath, "utf8");
  const fixed = txt.replace(INVALID_U_RE, "");
  if (fixed !== txt) {
    console.log("Fixed invalid backslash-u escapes in", f);
    writeFileSync(fpath, fixed);
  }
  try {
    const arr = JSON.parse(fixed);
    if (Array.isArray(arr)) {
      allCards.push(...arr);
      console.log(`Loaded ${arr.length} cards from ${f}`);
    } else {
      console.log("Skipped (not array):", f);
    }
  } catch (e) {
    console.log("Parse still failed:", f, "->", String(e).slice(0, 200));
  }
}

const existing = JSON.parse(readFileSync(TARGET, "utf8"));
const summary = {};
for (const c of allCards) {
  const k = c.aiUxResult || "?";
  summary[k] = (summary[k] || 0) + 1;
}
const blockedCards = allCards.filter(
  (c) => c.aiUxResult === "BLOCKED" || c.aiUxResult === "FAIL",
);

existing.cards = allCards;
existing.blockedCards = blockedCards;
existing.summary = summary;
existing.status = summary.FAIL > 0
  ? "FAIL"
  : summary.BLOCKED > 0
    ? "BLOCKED"
    : summary.PARTIAL > 0
      ? "PARTIAL"
      : "PASS";
existing.delegationMode = "multi-agent-6-shard";
existing.reviewerNote =
  "AI first-pass UX review (Phase 5). 6 child agents dispatched in parallel via Agent tool, results merged from agent-packets/results/*-cards.json. Per phase5NoPassRuleApplied: no PASS labels until rendered evidence + human confirmation.";
existing.generatedAt = new Date().toISOString();

writeFileSync(TARGET, JSON.stringify(existing, null, 2));

console.log("---");
console.log("Total cards merged:", allCards.length);
console.log("Summary:", JSON.stringify(summary));
console.log("Overall ai-ux-review status:", existing.status);
