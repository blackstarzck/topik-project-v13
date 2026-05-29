#!/usr/bin/env node
// P4 Mark Stale Blockers
// =============================================================================
// ai-ux-review.json was generated BEFORE the 2026-05-28 PW max(64) + raw-error
// resolutions (auth-overview §10) and BEFORE the 2-agent cross-audit. Some of
// its blockingReasons are now confirmed-resolved or downgraded to observations.
//
// To preserve audit trail (not silently delete), we MOVE the superseded
// blockingReasons into a new `resolvedBlockers` array per card with reason.
//
// Mapping decided from manual-review.json `resolvedDocGapsDiscovered` +
// reviewerA/reviewerB agreements:
// - A-01: PW max(64) drift RESOLVED, raw-error RESOLVED
// - A-02: raw-error RESOLVED (PW 8-64 enforcement partially still gap)
// - X-06: PW max(64) RESOLVED, raw-error RESOLVED
// - X-12: raw-error RESOLVED; wireframe absence + cooldown comments downgraded
//   to observations per Codex 3-round consensus

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = process.cwd();
const PATH = join(REPO, "reports/ia-verification/runs/20260528-141731/ai-ux-review.json");

const STALE_MARKERS = {
  "A-01": [
    {
      match: /PW max\(64\) not enforced/,
      reason: "RESOLVED 2026-05-28 per auth-overview §10 line 296 — SignUpForm.tsx line 78 enforces max:64. Confirmed by cross-audit reviewer A+B.",
    },
  ],
  "X-06": [
    {
      match: /PW max\(64\) not enforced/,
      reason: "RESOLVED 2026-05-28 per auth-overview §10 — PasswordResetConfirmForm.tsx line 50. Confirmed by cross-audit reviewer A+B.",
    },
  ],
  "X-12": [
    {
      match: /wireframeStatus=missing/,
      reason: "Downgraded to observation per Codex 3-round consensus (cross-audit): description.md is detailed enough for an info+resend card; wireframe absence is acceptable. NOT a DOC-GAP.",
    },
    {
      match: /Cooldown formatCountdown identical to X-11/,
      reason: "Downgraded to observation — 60s default cooldown is fine; longer Retry-After values are an X-11 i18n concern, not an X-12 blocker.",
    },
  ],
};

const doc = JSON.parse(readFileSync(PATH, "utf8"));
const allCards = [...(doc.cards ?? []), ...(doc.blockedCards ?? [])];

let moved = 0;
for (const card of allCards) {
  const rules = STALE_MARKERS[card.iaCode];
  if (!rules) continue;
  const remaining = [];
  const resolved = card.resolvedBlockers ?? [];
  for (const reason of card.blockingReasons ?? []) {
    const rule = rules.find((r) => r.match.test(reason));
    if (rule) {
      resolved.push({
        originalReason: reason,
        resolution: rule.reason,
        appliedAt: new Date().toISOString(),
        source: "p4-mark-stale-blockers.mjs (cross-audit + auth-overview §10 evidence)",
      });
      moved += 1;
    } else {
      remaining.push(reason);
    }
  }
  card.blockingReasons = remaining;
  if (resolved.length > 0) card.resolvedBlockers = resolved;
}

doc.reviewerNote = (doc.reviewerNote ?? "") +
  "\n\n[2026-05-29] p4-mark-stale-blockers.mjs moved superseded blockingReasons to `resolvedBlockers` per card — total " + moved + " entries. Audit trail preserved: each entry has originalReason + resolution + source.";

writeFileSync(PATH, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`Moved ${moved} stale blockingReasons → resolvedBlockers in ${PATH}.`);
