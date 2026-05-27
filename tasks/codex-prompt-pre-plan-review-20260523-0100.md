# Codex GPT 5.5 Pre-Plan Review Request

You are reviewing a plan file authored by Claude Code (Opus 4.7) for an Implementation Coverage Audit of the TALKPIK AI project (TOPIK Korean exam learning platform built on Next.js App Router + Supabase + Ant Design). The plan must pass your review before execution begins.

## Context — what triggered this plan

The user (project owner, "vibe coder" — reads code but is not a professional developer) just discovered three failures by manually opening dev server:

1. `/` shows a Phase 3 placeholder "학습 워크스페이스 준비 중" — but sitemap.md X-01 says it should be a product landing.
2. `/login`, `/sign-up`, `/password-reset` are all placeholders with the message "Phase 3에서 제공됩니다". Phase 2 light-spec promised Phase 3 would deliver auth UI; Phase 3 plan deferred it to "later phase or follow-up PR"; Phase 4/5/6 never touched it. **Auth UI is missing entirely** despite Phase 6 declaring "Tier 1 MVP complete".
3. Remote Supabase project is empty (zero tables). 21 migration files exist but were never applied; `supabase/config.toml` does not exist.

The user concluded: "각 Phase ledger가 'phase 범위 PASS'만 검증했을 뿐, 전체 사용자 여정(가입→로그인→대시보드→첫 학습)을 끝까지 검증한 적이 없다. 더 많은 누락이 있을 가능성이 높고, 그 카탈로그 없이 다음 phase 우선순위를 정할 수 없다."

Their request (verbatim, in Korean):

> "@docs/IA와 @docs/ia-pages, @docs/prd.md, @docs/flow, @docs/user-flow.md 등 이 프로젝트 개발을 위해 참고한 문서들을 다시 바라보고 현재 구현이 안되거나 잘못되거나 부족한 부분을 찾고 보고서를 만들어. 정확한 분석을 위해 직접 각 페이지를 브라우저에 띄워보기도 해야할꺼야. 이 작업을 위해 실행 계획을 세우고, gpt 5.5가 리뷰하는 절차를 거쳐서 완성도 높은 분석 계획서를 만들어"

Translated: produce an implementation coverage audit report by re-reading canonical docs and opening each page in a browser; first produce an execution plan for this audit and have GPT 5.5 (you) review it; only then proceed.

## Files you must read directly

- **Plan to review**: `docs/ai-workflow/plans/20260523-0100-implementation-coverage-audit.md`
- **Plan-writing ledger**: `docs/ai-workflow/runs/2026/05/23/20260523-0100-implementation-coverage-audit-plan.md`

## Project canonical docs (spot-check as needed)

| Doc | Purpose |
| --- | --- |
| `docs/sitemap.md` | Target React Route Map for 32 active routes + Audience map + Legacy crosswalk |
| `docs/IA/README.md` + `docs/IA/{01..32}/description.md` | Per-screen IA specifications (Paper frame 32-screen inventory) |
| `docs/prd.md` | Product requirements (note: includes Future scope flagged as out-of-frame) |
| `docs/flow/user-flow.md` | Canonical user flow |
| `docs/spec.md` | Implementation spec with Required Reading Map |
| `docs/ant-design/02-global-styles.md` | Breakpoint definitions (360 / 768 / 1280) |
| `docs/ant-design/07-review-checklist.md` | A11y checklist |
| `docs/ai-workflow/planning-contracts.md` | Plan structure requirements (Out of Scope / SBU / Tasks Subagent-eligible column / Audience column) |
| `docs/ai-workflow/review-gates.md` | All review gates (TDD / Cross-model / Plan-Review PASS / Architecture / UX-UI / QA / Finish) |
| `docs/ai-workflow/runs/2026/05/21/20260521-1800-phase-6-admin-library-hardening.md` | Tier 2 OOS 11 catalog + 5-round Codex review pattern |
| `docs/ai-workflow/runs/2026/05/23/20260523-0000-pr-c-qa-gate-enforcement.md` | Most recent context (QA Gate enforcement just landed today) |

## PASS criteria (all must be true)

1. **§5 Rubric coherence**: Each of the 5 dimensions (Route / Page / Data / Browser / Responsive) maps to at least one canonical doc cited by file path. Composite grade (§5.6) is internally consistent with the 5 dimensions.

2. **§4 SBU is genuinely smaller**: Task 1 + Task 2 alone delivers stand-alone value (the 32-row mapping table that lets the user decide next steps), and is meaningfully smaller than the full 8-task plan.

3. **Security recovery is explicit**: The temporary dev-login code (§7.1 + Task 7) has NODE_ENV guard + explicit Task 7 cleanup + ledger commit hash record. No path where it leaks to production.

4. **§3 Out of Scope does not exclude what the user demanded**: User asked for analysis/report and browser verification. Excluding "implementation fixes" is correct. But OOS must not silently exclude any canonical doc the user named (`docs/IA`, `docs/ia-pages`, `docs/prd.md`, `docs/flow`, `docs/user-flow.md`). Note: ia-pages and user-flow.md are explicitly legacy per their own status notes; OOS treats them as "reference only" — verify this is consistent with user intent.

5. **§12 Risks coverage**: 8 risks are enumerated. Identify any risk a senior reviewer would flag that is missing. Specifically check: shadow auth user creation conflicts with RLS triggers (R-6 mentions it — verify mitigation is realistic), Playwright stability on Windows, dev-login route accidentally landing in production build, false-positive PASS due to fixture mocks hiding real failures.

6. **§10 Tasks table format**: per `docs/ai-workflow/planning-contracts.md`, must include `Subagent-eligible? (Y/N + reason)` column. Since phase Audience is `both`, must also include `Audience` column with `user | admin | both | n/a` per row. Verify both columns present and each row has a substantive reason (not just "Y" or "N").

7. **§11 SBU restatement matches §4**: No contradiction between the two statements.

8. **§14 Cross-model review process is sound**: Round-cap stated (3 base, 5 hard cap), reviewer named, packet content listed, output destination specified.

## Output format (exact)

```
VERDICT: <PASS | CONCERN | FAIL>

FINDINGS (P1 — must fix before execution):
| ID | Section | Issue | Evidence (file:line) | Suggested fix |
| --- | --- | --- | --- | --- |
| P1-1 | ... | ... | ... | ... |

FINDINGS (P2 — advisory, can fix in rev or accept with reason):
| ID | Section | Issue | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |

MISSED BY OPUS (risks/issues not flagged in §12):
- <bullet — be specific, cite evidence>

SBU ASSESSMENT:
- Is Task 1 + Task 2 truly smaller? <YES/NO + reason>
- Should the plan be split further? <YES/NO + recommended split if YES>

VERIFICATION (what you actually read):
- Files opened: <list with file paths>
- Spot-checks performed: <list canonical doc cross-references verified>

OVERALL RECOMMENDATION:
- <one paragraph: proceed as-is | revise with these P1s | split into smaller phases | escalate to user>
```

Be specific. Cite line numbers when calling out issues. If the plan is too ambitious for one pass, recommend a slimmer SBU. If Opus missed something a senior reviewer would catch, flag it under MISSED BY OPUS.

The user has explicitly named you (GPT 5.5) as the reviewer. Take this seriously. The user has experienced workflow failures before (Phase 6 QA Gate skipped post-mortem) and this audit is the recovery action.
