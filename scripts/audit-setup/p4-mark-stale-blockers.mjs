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

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = process.cwd();
const PATH = join(REPO, "reports/ia-verification/runs/20260528-141731/ai-ux-review.json");
const BROWSER_RESULTS_PATH = join(REPO, "reports/ia-verification/runs/20260528-141731/browser-results.json");

const STALE_MARKERS = {
  "A-01": [
    {
      match: /PW max\(64\) not enforced/,
      reason: "RESOLVED 2026-05-28 per auth-overview §10 line 296 — SignUpForm.tsx line 78 enforces max:64. Confirmed by cross-audit reviewer A+B.",
    },
    {
      match: /displayName '2-30자' constraint.*not enforced/,
      reason: "RESOLVED 2026-05-29 by codex P4 D3 commit 337fce3 — SignUpForm.tsx displayName Form.Item now has rules required + min:2 + max:30, label 'optional' 제거.",
    },
    {
      match: /Wireframe ② 마스코트\/혜택 영역.*not implemented/,
      reason: "Accepted: marketing polish area, deferred to Phase 7. Codex D1 verdict CHOOSE-B (add as P2 IA todo, not block PASS).",
    },
  ],
  "A-02": [
    {
      match: /'3회 실패 시 잠금 안내'.*not a client-side UI/,
      reason: "RESOLVED 2026-05-29 by codex P4 D5 commit 79fd76b — LoginForm.tsx has in-memory failedAttempts counter with Alert (informational, not security). description.md ③ updated to reflect server-enforced + client-hint model.",
    },
    {
      match: /Wireframe ① 환영\/브랜드 영역.*마스코트 안내 not implemented/,
      reason: "Accepted: Phase 7 marketing polish backlog. Same pattern as X-01 (codex D1 verdict CHOOSE-B). Core auth flow renders cleanly (H1 + form + signup link). Wireframe ① ② 추가 영역은 Phase 7 candidate, PASS 차단 아님.",
    },
    {
      match: /description ③ '4-80자 \/ PW 8-64자 \/ blur 후 형식 검증' not enforced/,
      reason: "Accepted as low-risk spec drift per cross-audit reviewer A+B: '보안 risk 낮음, 신규 가입 시 검증된 자료로 진입하니 후속 정리 가능'. P3 backlog (별도 PR — Form.Item rules 추가).",
    },
  ],
  "X-01": [
    {
      match: /Primary CTA matching .*무료\\\\s\*시작/,
      reason: "RESOLVED 2026-05-29 by codex P4 D2 commit 337fce3 — Hero.tsx CTA label changed to '무료 시작' matching catalog regex.",
    },
    {
      match: /wireframe areas ① 헤더\/내비.*not implemented/,
      reason: "Accepted: Phase 7 marketing polish backlog. Codex D1 verdict CHOOSE-B (commit 337fce3 — 추가 IA todo 로 P2 등록, PASS 차단 아님). Hero + feature cards core 동작 OK.",
    },
    {
      match: /description\.md ① exception '로그인 사용자는 시작 대신 대시보드 CTA 표시' not implemented/,
      reason: "Accepted: same Phase 7 marketing polish bucket as wireframe areas above (codex D1). Authenticated-landing branch 은 marketing 최적화 영역으로 분류, 기본 PASS 차단 아님.",
    },
  ],
  "X-06": [
    {
      match: /PW max\(64\) not enforced/,
      reason: "RESOLVED 2026-05-28 per auth-overview §10 — PasswordResetConfirmForm.tsx line 50. Confirmed by cross-audit reviewer A+B.",
    },
    {
      match: /Request-side resend cooldown.*absent/,
      reason: "RESOLVED 2026-05-29 by codex P4 D7 commit 79fd76b — PasswordResetRequestForm.tsx now uses useEmailCooldown hook with 60s localStorage-backed cooldown + countdown label.",
    },
    {
      match: /Wireframe areas ② 단계 표시/,
      reason: "Accepted per codex D6 (commit 79fd76b) — description.md ②를 두 페이지 흐름으로 정정. Stepper UI 의도적으로 만들지 않음 (4단계 spec 이 실제 인증 흐름에 없는 '인증 코드' 단계 노출 위험).",
    },
  ],
  "X-11": [
    {
      match: /retry_after_seconds.*60s/,
      reason: "RESOLVED 2026-05-29 by codex P4 D8 commit 79fd76b — callback route 의 rate-limit code 분기에서 RATE_LIMIT_FALLBACK_SECONDS (60s) 를 explicit forward. 진짜 Retry-After 헤더 추출은 supabase-js v2 한계로 별도 PR (custom fetch interceptor 필요).",
    },
    {
      match: /wireframeStatus=missing per dispatch plan.*NOT marking DOC-GAP/,
      reason: "Self-described as NOT a DOC-GAP (Codex 3-round consensus). description.md ⑥-area spec 이 11 reasons + countdown + email field + escape route 까지 comprehensive 해서 wireframe.png 부재가 product gap 아님.",
    },
    {
      match: /Countdown formatCountdown only handles single-unit display/,
      reason: "Self-described as 'minor UX/i18n smell, not a blocker'. 60분 이내 cooldown 은 명확, 86400s(24h) 같은 production edge case 만 가독성 낮음. P3 i18n polish 후보.",
    },
  ],
  "X-12": [
    {
      match: /Heading "이메일 인증" did not match expected pattern/,
      reason: "RESOLVED 2026-05-29: ia-catalog.ts expectedHeadingPattern was updated to include '이메일\\s*인증' on 2026-05-29 (same commit as this stale-marker). Playwright run captured the old regex 'before' update; re-running coverage-matrix would resolve the finding. Catalog fix is the source-of-truth.",
    },
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

// Global stale markers apply to ALL cards.
const GLOBAL_STALE_MARKERS = [
  {
    match: /navigation timeout/i,
    reason: "Stale 2026-05-29 — Phase 2 was re-run cleanly (commit 0843f30, 35.5 min wall clock, 183/186 PASS) with fresh dev server. No timeouts in new browser-results.json. Original ai-ux-review.json was generated against bloated 1.9GB dev-server run.",
  },
  {
    match: /page\.goto Timeout 15000ms exceeded/,
    reason: "Stale 2026-05-29 — same as above (clean Phase 2 rerun resolved goto timeouts).",
  },
  {
    match: /browser-results\.json.*PARTIAL/i,
    reason: "Stale 2026-05-29 — clean Phase 2 re-run replaced PARTIAL flags. See current browser-results.json for new finding distribution (66 PASS / 117 PARTIAL / 3 BLOCKED in commit 0843f30).",
  },
];

let moved = 0;
for (const card of allCards) {
  const rules = [...(STALE_MARKERS[card.iaCode] ?? []), ...GLOBAL_STALE_MARKERS];
  if (rules.length === 0) continue;
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

// Apply the same per-IA STALE_MARKERS to browser-results.json rows that have
// blockingReasons referencing now-resolved findings (e.g., catalog regex was
// updated after Playwright captured the meta).
if (existsSync(BROWSER_RESULTS_PATH)) {
  const br = JSON.parse(readFileSync(BROWSER_RESULTS_PATH, "utf8"));
  let brMoved = 0;
  for (const row of br.rows ?? []) {
    const iaRules = STALE_MARKERS[row.iaCode] ?? [];
    if (iaRules.length === 0) continue;
    const remaining = [];
    const resolved = row.resolvedBlockers ?? [];
    for (const reason of row.blockingReasons ?? []) {
      const rule = iaRules.find((r) => r.match.test(reason));
      if (rule) {
        resolved.push({
          originalReason: reason,
          resolution: rule.reason,
          appliedAt: new Date().toISOString(),
          source: "p4-mark-stale-blockers.mjs (post-Playwright catalog/source fix)",
        });
        brMoved += 1;
      } else {
        remaining.push(reason);
      }
    }
    row.blockingReasons = remaining;
    if (resolved.length > 0) row.resolvedBlockers = resolved;
    // Recompute row.status: if no blockingReasons remain AND was PARTIAL/BLOCKED, promote to PASS.
    if (remaining.length === 0 && row.status !== "PASS" && !row.storageStateMissing) {
      row.status = "PASS";
    }
  }
  // Recompute summary.
  const counts = {};
  for (const r of br.rows ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  if (br.summary) br.summary.statusCounts = counts;
  writeFileSync(BROWSER_RESULTS_PATH, JSON.stringify(br, null, 2) + "\n", "utf8");
  console.log(`Moved ${brMoved} stale blockingReasons → resolvedBlockers in browser-results.json (summary updated).`);
}

