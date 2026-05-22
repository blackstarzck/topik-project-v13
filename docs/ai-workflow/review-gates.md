# Review Gates

All review and verification gates: TDD loop, cross-model review, plan-review PASS gate, code review, architecture pass, QA, and finish. **Entry point**: [`docs/ai-development-workflow.md`](../ai-development-workflow.md).

This sub-doc owns §2 (TDD), §3 (Codex+Claude Together), §3a (Plan-Review PASS Gate), §4 (Review Gate), §4b (Architecture Pass), §5 (QA Gate), and the review portion of §6 (Finish) of the legacy workflow.

## TDD

For code changes, `test-driven-development` is mandatory.

The required loop:

1. Write or update the smallest failing test
2. Run it and verify it fails for the expected reason
3. Write the minimal implementation
4. Run the focused test until it passes
5. Refactor only while tests stay green
6. Run broader verification

### Allowed TDD exceptions

- Documentation-only changes
- Configuration-only changes
- Generated artifacts
- No existing runnable test surface

When an exception applies, state it and use the nearest practical verification (lint, typecheck, build, static inspection, manual flow testing). The "no runnable test surface" exception is temporary — once `package.json` or `src/` exists, behavior changes must not use this exception unless the relevant surface still has no executable test path.

## Cross-Model Review

**Cross-model review is mandatory** for every code change and every non-trivial plan or doc change. A different model than the implementer must read the diff and either record findings or sign off. The intent is to cover one model's blind spots with another model's reading.

Pairing:

- Codex implements → Claude reviews (`requesting-code-review` or GStack `review`)
- Claude implements → Codex reviews (`requesting-code-review` or GStack `gstack-review`)

When only one model is available, the implementer must record `Cross-model review: degraded — <reason>` in the ledger's `## Verification State`. The checker (`scripts/ai-workflow-check.mjs`) treats `Cross-model review:` as required; missing/empty values block CI. Degraded completion is allowed only when the reason is recorded.

The implementer must not mark the task complete until reviewer findings are addressed or explicitly documented as rejected with a reason.

## Plan-Review PASS Gate

When a plan goes through pre-implementation review (`plan-eng-review`, `plan-ceo-review`, `plan-design-review`, or `codex consult` on the plan file) and the reviewer returns **FAIL**, the implementer must:

1. Revise the plan to address the findings
2. **Re-run the same review** against the revised plan
3. Only proceed to implementation after the re-review returns **PASS** (or **CONCERN** with each remaining concern explicitly documented in the ledger as "accepted with reason")

Going straight from "FAIL → revise → implement" without a re-review is a workflow violation: the implementer is signing off on their own revision and the originally-flagged risks have not been re-validated by an independent reader. This is true even when post-implementation cross-model review is planned — that catches code-level issues, not plan-level ones.

Record the pre-implementation review chain in the ledger Decisions table with timestamps for the original review, the revision, and the re-review. If only one model is available for re-review, record `Re-review: degraded — <reason>` and accept the residual risk explicitly.

Exemptions:

- **Lightweight path** changes skip plan review entirely; this gate does not apply
- **PASS verdict** on the first review needs no re-run
- **CONCERN verdict** on the first review needs the concerns documented and accepted, but no full re-review unless the implementer changes the plan in response

### Round-cap rule (lesson from cleanup PR)

- Base limit: 3 rounds
- Workflow-governing docs or first review FAIL: 4-5 rounds allowed
- Beyond 5 rounds: escalation to the user is mandatory (no infinite loops)
- When a round catches a different *layer* (scope summary → task body → prose → verification) each pass, the implementer should fix every layer simultaneously rather than one at a time

### Disagreement resolution

When cross-review surfaces a commitment-level disagreement (not a simple finding):

1. Each side records its position + rationale + trade-off in the ledger (one paragraph)
2. Apply quantitative criteria first (line counts, checker PASS, token cost, explicit user rule)
3. If only qualitative trade-offs remain, each side does a "weakness acknowledgement" round
4. If unresolved, escalate to the user with options A/B + trade-offs + recommendation + risk
5. User's decision and rationale are recorded in the ledger

Downgrades from P1 to P2 (or P2 to accepted) require ledger evidence: originally flagged level, downgraded level, rationale, accepted trade-off, residual risk, owner decision. **PASS is forbidden while any downgraded P1/P2 lacks this record.**

## Code/Doc Review Gate

Every code change must pass review before completion:

- Superpowers review: `requesting-code-review`, then `receiving-code-review` when feedback exists
- GStack review: `review` (Claude) / `gstack-review` (Codex)

Review must check:

- Behavior matches the accepted plan
- Tests cover the changed behavior
- No unrelated refactors or broad rewrites
- Error states, empty states, edge cases handled
- User-facing text and UI remain coherent

When an independent reviewer or GStack review is unavailable, record degraded mode and run an explicit self-review checklist:

- Scope: changed files match accepted scope, no unrelated edits introduced
- Docs: implementation matches consulted active docs
- Tests: changed behavior covered, or TDD exception + substitute verification documented
- Failure paths: error states, empty states, fallback paths considered
- Evidence: verification commands run fresh, outputs read
- Ledger: current and lists remaining risks

## Architecture Pass

Every phase completion must pass an Architecture Pass before the next phase starts. This is a focused last-mile review that makes the domain visible in the code, not a generic refactor:

- Route/page handlers contain no business logic that should live in a service or domain module
- Folder names and module boundaries match `docs/domain-glossary.md` and the agreed phase scope
- A single concept is not implemented in two places. If duplication exists, the ledger records a deliberate reason or the duplication is removed
- File names, function names, and types use domain terms, not implementation terms
- **Audience 경계 = 코드 boundary 일치** — Light Spec의 `Audience: user/admin/both` 명시와 실제 코드 폴더(`src/app/admin/...`, `src/app/library/...`, `src/lib/admin/...`, `src/lib/auth/admin-guard.ts` 등)가 일치한다. 위험 패턴 (실제 RLS 우회 경로): ① admin RPC · `SECURITY DEFINER` 함수 · service role 호출이 user 라우트의 코드 경로에서 직접 호출됨, ② admin 라우트에서 `requirePlatformAdmin / requireContentAdmin / requireOrgAdmin` 페이지 가드가 누락됨, ③ content_admin → platform_admin 권한 상승 차단 정책이 RPC 내부에 없음. 폴더 혼합 자체는 무해할 수 있으나 위 세 경로 중 하나라도 있으면 RLS 우회. `both`인 phase는 user와 admin 양쪽 폴더 boundary 각각 검증 + 위 세 패턴 grep.

The ledger records the result:

```
- Architecture Pass: passed | failed | skipped — <reason>
```

`scripts/ai-workflow-check.mjs` requires this field whenever the ledger's `Status:` is `complete` AND the ledger is a phase ledger. Phase plans (`*-development-phases-and-bootstrap.md`) must also list `Architecture Pass` in every row of the Phase Contract `Completion Gate` column.

## UX/UI Consistency Pass

UI 변경이 포함된 모든 작업에서 통과해야 한다.

**게이트 위치**: UI 구현 완료 후, 다음 QA Gate(browser/visual 실행 검증) **전**에 사전 점검.

**Architecture Pass와의 경계**: Architecture Pass는 코드 boundary와 audience(누가 쓰나)를 본다. UX/UI Consistency Pass는 **visual/system consistency**(같은 패턴인가, 토큰 따르나, 접근성 있나, 반응형 매트릭스 커버하나)를 본다. 둘 다 phase 완료 시점에 작동하지만 보는 차원이 다르다.

**QA Gate와의 경계**: QA는 로컬 실행으로 **실제 동작** 검증. UX/UI Pass는 **코드/디자인 문서 기반 사전 일관성** 점검 — 실행 안 함.

### 4개 체크

각 체크는 `passed` · `failed` · `skipped — <reason>` 중 하나로 ledger에 기록. 각 체크의 PASS 기준은 짧고 판정 가능하게:

- **Tokens PASS**: AntD 토큰만 사용. hardcoded color/radius/shadow/spacing 없음. 예외는 사유 필수.
  - 정본: [`docs/ant-design/02-global-styles.md`](../ant-design/02-global-styles.md), [`docs/ant-design/08-theme-architecture.md`](../ant-design/08-theme-architecture.md)
- **Components PASS**: 같은 패턴은 같은 컴포넌트 재사용. 새 컴포넌트 도입 시 기존 패턴과 비교 + 사유 기록.
  - 정본: [`docs/ant-design/03-patterns-and-components.md`](../ant-design/03-patterns-and-components.md), 참고 [`docs/ant-design/01-design-values.md`](../ant-design/01-design-values.md)
- **A11y PASS**: 키보드 도달 + focus visible + semantic label + 텍스트 대비 4.5:1 이상. 4가지 모두 검토자가 확인.
  - 정본: [`docs/ant-design/07-review-checklist.md`](../ant-design/07-review-checklist.md)
- **Responsive PASS**: 360px (mobile) / 768px (tablet) / 1280px (desktop) 3개 breakpoint에서 깨짐 없음.
  - 정본: [`docs/ant-design/02-global-styles.md`](../ant-design/02-global-styles.md) (breakpoint 정의)

### 허용되는 `skipped` 사유

- `skipped — types-only, no UI component prop/type contract change`: `*.d.ts` / `*.types.ts`만 변경, UI component prop/type 계약 변경 없음 명시.
- `skipped — internal refactor, no visual change`: 컴포넌트 내부 정리만, 렌더 결과 동일.
- `skipped — dead code removal`: 라우트/페이지에서 호출되지 않는 컴포넌트 삭제.
- `skipped — non-UI workflow change`: workflow 거버닝/스크립트/CI 변경만, UI 영향 없음.

자동 점검은 "사유 비어 있음 = FAIL"만 강제. 사유 내용 자체는 검증하지 않는다. 사유 형식 남용은 별도 분기 감사(예정).

### ledger 기록 형식

```
- UX/UI Consistency Pass: passed
  - Tokens: passed — 검토 결과 한 줄 + 정본 문서 경로
  - Components: passed — 검토 결과 한 줄
  - A11y: passed — 키보드/focus/label/대비 4가지 모두 확인
  - Responsive: passed — 360/768/1280 모두 깨짐 없음
```

또는 전체 skipped인 경우(자동 면제는 별도 아래):

```
- UX/UI Consistency Pass: skipped — internal refactor, no visual change
  - Tokens: skipped — same reason
  - Components: skipped — same reason
  - A11y: skipped — same reason
  - Responsive: skipped — same reason
```

부모 필드와 4개 하위 필드 모두 존재 + 값 비어 있지 않을 것. 어느 하나라도 누락/공백이면 `scripts/ai-workflow-check.mjs`가 FAIL.

### 적용 대상 PR 감지

다음 경로 중 하나 이상이 변경되면 UX/UI Consistency Pass 필수:
- `src/app/**`, `src/components/**`, `src/features/**`, `src/lib/ui/**`, `src/styles/**`
- `**/*.css`, `**/*.scss`, `**/globals.css`
- `**/theme*`, `tailwind.config.*`, `postcss.config.*`
- `public/icons/**`, `public/images/**`

**자동 면제** (사람 ledger 기록 불요): 변경 파일이 `**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`로만 구성되면 게이트 자동 skip. types-only(`*.d.ts`, `*.types.ts`)는 자동 면제 아님 — 위 `skipped — types-only ...` 사유 형식으로 명시 의무.

## QA Gate

Use QA for user-facing, browser, interaction, or integration work:

- Codex: `gstack-qa` or `gstack-qa-only`
- Claude Code: `qa` or `qa-only`

QA must include:

- Starting the local app when applicable
- Exercising the changed user path
- Checking responsive layout when UI changed
- Capturing failures as reproducible notes
- Adding regression coverage when possible

If browser automation is unavailable, state the blocker and run the closest alternative verification.

## Finish (review portion)

Before saying done:

- Run `verification-before-completion`
- Run focused tests for changed behavior
- Run broader tests, lint, typecheck, or build when available
- Run `node scripts/ai-workflow-check.mjs --repo .` when Node is available, or document why the checker could not run
- Process the Git publication decision per [`git-publication-decision.md`](git-publication-decision.md): pick exactly `no-commit`, `local-commit`, `push-and-pr`, or `blocked` and record it in the final report and ledger
- For release-sized work, run `ship` (Claude) / `gstack-ship` (Codex)

Final response follows [`report-template.md`](report-template.md).

## Related

- Plan and Light Spec that this gate reviews → [`planning-contracts.md`](planning-contracts.md)
- Ledger that records review evidence and degraded status → [`context-and-packets.md`](context-and-packets.md)
- Fallback when a review gate is blocked → [`fallback-and-recovery.md`](fallback-and-recovery.md)
