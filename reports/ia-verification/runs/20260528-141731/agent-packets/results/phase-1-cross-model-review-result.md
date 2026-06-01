# Phase 1 — Cross-Model Review Result Packet (X-05 + X-07)

- Run: 20260528-141731 (Phase 1, Workstream 1)
- Date: 2026-06-01
- Coordinator: Claude (Opus 4.8) main session
- Diff under review: `5fc57f8` (parent `cd2758b`), 6 X-05/X-07 source/test files. Input snapshot: `reports/ia-verification/runs/20260528-141731/agent-packets/tasks/phase-1-review-input.diff` (995 lines).
- Phase 0 implementer family: **Codex** (predecessor ledger `Coordinator: Codex main session`).

## Reviewers

| Reviewer | Family | Role | Ledger-blind? | Verdict |
| --- | --- | --- | --- | --- |
| A — Claude subagent (`general-purpose`) | Claude/Opus | **Gate-satisfying cross-family** (≠ Codex implementer) | yes (read diff + 2 IA specs only) | FAIL |
| B — Codex CLI (`codex exec -s read-only`, gpt-5.5, effort=high) | GPT/Codex | Bonus independent adversarial (same family as implementer) | yes (clean process, no ledger access) | FAIL |

Gate logic: review-gates.md §Cross-Model Review requires the reviewer family ≠ implementer family. Implementer = Codex, so **Reviewer A (Claude) is the gate-satisfying review**. The handoff's "Option A: codex is cross-family" assumption was inverted and is corrected here (codex = same family as implementer; useful but not gate-closing).

### Reviewer B degradation (recorded)

Codex read project files via Windows PowerShell `Get-Content`, which produced **UTF-8 mojibake** for all Korean strings (e.g. `문법` rendered as `ë¬¸ë²•`), and PowerShell constrained-language mode blocked its `[Console]::OutputEncoding` fix. Consequence: Codex's Korean-copy and honesty findings are low-confidence; its ASCII/structural findings (dimension keys, control flow, navigation guard) are usable. This is why Reviewer A (which read Korean correctly) is the authoritative review and Reviewer B is corroborating only.

## Findings & Disposition

### P1 — Dimension-label key mismatch (Reviewer A; coordinator-confirmed) — FIXED

`src/components/practice/WeaknessView.tsx` introduced a new `DIMENSION_LABELS`/`DIMENSION_INSIGHTS` map keyed `grammar/vocab/structure/topic`. The data layer (`src/lib/practice/weakness.ts:35-42` `WEAKNESS_DIMENSIONS`) emits `grammar/vocab/structure/content/expression/topic_fit`. So a leading weak dimension of `topic_fit`, `content`, or `expression` made `getDimensionLabel()` return the raw English key, leaking it into the insight Alert headline and the tag-fallback reason — while sibling cards (`DiagnosticCard.tsx:7-14`, `DimensionTabs.tsx:7-14`) rendered the correct Korean label for the same dimension on the same page.

Coordinator verification: read all four files; confirmed reachable and user-visible. X-07 spec §2 explicitly lists "주제 적합성" as a dimension label, reinforcing the requirement.

Fix (TDD): corrected `DIMENSION_LABELS` to all 6 keys with `topic_fit`; rekeyed the `topic` insight to `topic_fit`; added cautious (≤60-char, hedged) insights for `content` and `expression`. Regression test: `it.each(["topic_fit","content","expression"])` asserts the Korean label appears and the raw key never reaches the DOM. Red→green confirmed.

### P2 — Recommendation cards not capped at 4 (Reviewer B; spec-backed) — FIXED

X-07 spec §5: "카드 4개 이하". The component rendered every recommendation it received. Added defensive `recommendations.slice(0, RECOMMENDATION_CARD_LIMIT=4)` + regression test (5 in → 4 cards). Red→green confirmed.

### P1 (Reviewer B) → downgraded to P2-deferred — DOCUMENTED, OWNER-DEFERRED

Reviewer B flagged the unsaved-leave guard (`ProfileForm.tsx`) as P1: it covers `beforeunload` (reload/close) and capture-phase anchor-click interception (catches Next `<Link>` clicks) but NOT browser Back/Forward (`popstate`) or programmatic `router.push`.

Downgrade record (review-gates.md §Downgrades):
- Originally flagged: P1 (Reviewer B).
- Downgraded to: P2, deferred to follow-up.
- Rationale: X-05 spec ("저장 전 이탈 확인 적용") does not mandate a specific navigation vector; the dominant leave vectors (reload, tab close, in-app link clicks) are covered. A `popstate` guard in the Next App Router requires history manipulation that is fragile and hard to test reliably.
- Accepted trade-off: a dirty profile form can be silently lost via the browser Back/Forward button.
- Residual risk: unsaved profile edits lost on browser back navigation (no confirm prompt).
- Owner decision: user chose scope "싼 스펙 P2까지만" (2026-06-01), explicitly deferring popstate. This keeps X-05 at **PARTIAL** (not PASS) until the gap is closed.

### Honesty audit — PASS (both reviewers)

No overclaiming. Paywall copy explicitly states no real billing occurs; AI/insight copy is hedged ("추정", "달라질 수 있습니다"); recommendation source is honestly labeled ("약점 태그 기반" vs "추천 근거"); avatar/upload state is honest. Two soft notes (not flags): the "보안 안내" Alert implies re-auth that isn't wired (hedged "필요할 수 있습니다", spec calls for the notice — defensible); the generic non-fallback reason assumes recommendation-source semantics. Both accepted as-is.

### Test coverage

Reviewer A confirmed the new behavior is well covered and identified the exact gap that hid the P1 (no test used a `topic_fit`/`content`/`expression` leading dimension) — now closed by the regression test. Remaining coverage gaps map to the deferred follow-ups below.

## Deferred follow-ups (recorded in Phase 1 ledger §Risks And Follow-Up)

1. `popstate`/programmatic-nav leave guard for `/profile` (blocks X-05 PASS; PARTIAL ok).
2. Title truncation shows up to 28+`...` (31 chars) vs spec "제목 28자" — minor, defensible; tighten if strict.
3. `DIMENSION_LABELS` now triplicated (WeaknessView + DiagnosticCard + DimensionTabs) — extract a shared constant to prevent re-drift (root cause of the P1).
4. `{question_no}번 문항` renders "0번 문항" when `question_no` is null.
5. Post-save visible field state can retain untrimmed spaces while Save is disabled (cosmetic).

## Checks run

- `pnpm vitest run` (WeaknessView + ProfileForm + theme-context): 28 passed.
- `pnpm typecheck`: clean.
- `pnpm exec eslint` (changed files): clean.
- `pnpm exec prettier --check` (changed files): clean after `--write`.
- `git diff --check`: clean.
- `node scripts/ai-workflow-check.mjs --repo .`: PASS.

## Gate outcome

Cross-model review gate: **passed** via Reviewer A (Claude cross-family). All blocking findings fixed or owner-deferred-with-record. Reviewer B recorded as degraded (encoding) corroborating pass.
