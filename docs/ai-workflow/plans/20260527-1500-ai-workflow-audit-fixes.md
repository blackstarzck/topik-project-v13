# AI Workflow Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `reports/ai-workflow-audit-20260527.html`에서 발견된 P0 3건 + P1 5건을 정확한 TDD 사이클(RED → GREEN → refactor)과 회귀 방지 자동 검사를 통해 해결한다. 핵심 효과: 워크플로의 self-test가 다시 통과하고, CI가 self-test와 fixture 테스트를 실제로 돌리고, 체커가 문서 요구사항을 빠뜨리지 않게 한다.

**Architecture:** 기존 `scripts/ai-workflow-check.mjs`의 함수형 export 패턴과 `node:assert/strict` selftest 패턴을 그대로 따른다. 새로운 검사 로직은 기존 검사 함수에 인라인 확장하거나 작은 신규 export를 추가하는 방식으로 도입한다. CI yaml에는 step만 추가하고 액션 인프라는 손대지 않는다. 잘못된 ledger 파일 1건은 `git mv` 가능하면 git history 보존, 안 되면 단순 rename. P1-5(Audience 컬럼 강제)는 light spec ↔ plan 두 파일을 cross-reference해야 하므로 별도 dispatcher 함수를 둔다.

**Tech Stack:** Node.js (ESM, v22+), `node:assert/strict`, GitHub Actions YAML, 기존 `ai-workflow-check.mjs` 모듈 패턴.

---

## Docs Consulted

- `docs/ai-development-workflow.md` — 워크플로 entry + 4 sub-doc 진입 규칙
- `docs/ai-workflow/planning-contracts.md` — 본 plan의 필수 섹션 컨트랙트(Out of Scope, SBU, Subagent-eligible)
- `docs/ai-workflow/context-and-packets.md` — ledger 필수 섹션(`Untouched relevant docs` 분석의 근거)
- `docs/ai-workflow/review-gates.md` — TDD 사이클, QA Gate `failed`/`degraded` 문법, Plan-Review PASS Gate
- `docs/ai-workflow/fallback-and-recovery.md` — Codex 부재 시 degraded mode 처리
- `docs/agent-index.md` — `Untouched relevant docs`가 필수 evidence임을 명시
- `AGENTS.md` / `CLAUDE.md` — Communication Style 룰, completion gate
- `scripts/ai-workflow-check.mjs` — 검사 함수 시그니처, `internals` export 패턴, 정규식 목록
- `scripts/ai-workflow-check.selftest.mjs` — `withTempRepo` 헬퍼, 기존 fixture 패턴 (특히 line 419-429의 깨진 fixture)
- `scripts/test-uxui-fixtures.mjs`, `scripts/test-qa-gate-fixtures.mjs` — CI에 추가할 fixture runner
- `.github/workflows/ai-workflow-check.yml` — 현재 CI step 구조
- `docs/ai-workflow/templates/context-ledger-template.md` — 템플릿이 "Untouched relevant docs"를 bullet 형태로 명시함을 확인
- `docs/ai-workflow/plans/README.md` + `20260520-workflow-4gate-enforcement.md` — plan 파일 스타일 레퍼런스
- `reports/ai-workflow-audit-20260527.html` — 본 plan의 입력 보고서

**Doc conflicts:** none.

**Untouched relevant docs:**
- `docs/ant-design/*.md` — UI 게이트 정본. P1-1이 UI 게이트 *발동 조건*만 좁히고 게이트 *내용*은 안 건드리므로 미참조. Codex 리뷰에서 필요시 펼침.
- `docs/Wireframe/*`, `docs/prd.md`, `docs/spec.md` — 제품/IA 정본. 본 작업과 무관.
- `docs/development/*.md` — 백엔드/스택 정본. 본 작업과 무관.

## Out of Scope — Intentional Cuts

| 제외 항목 | 이유 |
| --- | --- |
| P2 5건 (Architecture Pass grep 자동화, em-dash 함정, phase-N false positive, Communication Style 자동검사, runs/ 폴더 일괄 감사) | 보고서에서 P2로 분류 — 사고 가능성 낮음. 별도 backlog. |
| 기존 ledger 다수의 `Untouched relevant docs` 일괄 마이그레이션 | P1-2는 *changed ledger*에만 적용 (`validateLedger`는 changed ledgers만 검증). 기존 ledger 전수 보강은 별건 작업. |
| 로컬 checker(`git status`)와 CI checker(`git diff base..head`) 입력 의미 통일 | P1-4는 *문서화*만. checker 입력 모델 자체 변경은 별건 behavior 작업 (Codex round 1 review 지적 §3 반영) |
| Codex CLI 외 다른 모델(Gemini, GPT-4) 추가 검토 | 본 plan은 review-gates.md의 cross-model review 1회로 충분. 메모리 룰의 "Codex 2개 병렬 재검수"는 *보고서* 사고 사례 기준이지 *plan*에는 무적용. |
| CI yaml의 step 순서 외 액션 인프라(runner, permissions, triggers) 변경 | step 3개 추가만. Node 버전, checkout depth 등은 그대로. |
| `light-specs/README.md`, `plans/README.md` 등 가이드 문서 갱신 | 본 plan은 *체커*와 *셀프테스트*에 집중. 가이드 문서는 후속 정리에서. |
| 잘못된 형식 ledger의 *내용* 보강 | 본 plan은 *파일명 규칙* 위반만 해결(P0-3). 내용 자체는 Codex 세션이 만든 ledger 그대로 보존. |
| Light Spec ↔ Plan 매칭 알고리즘의 일반화 | P1-5는 phase-N 슬러그 매칭만. 더 정교한 plan↔spec 추적은 별건. |

## Smallest Buildable Unit

**P0-1 + P0-2 묶음** — `scripts/ai-workflow-check.selftest.mjs`의 깨진 fixture 한 줄 보강 + CI yaml에 self-test/fixture step 3개 추가. 이것만 머지돼도:
1. self-test가 다시 통과 (P0-1 효과)
2. 이후 어떤 회귀가 들어와도 CI가 잡음 (P0-2 효과 — 안전망 복원)
3. P0-3·P1 항목은 후속 PR로 분리 가능 (영향 범위 작음)

이 묶음만 SBU로 본 이유: P0-1만 단독으로 머지하면 P0-2가 빠진 상태라 같은 회귀가 다시 들어올 수 있음. 두 항목은 "고친다 + 굳힌다" 짝으로 묶어야 의미가 생긴다.

## File Structure

| Path | Responsibility | 변경 종류 |
| --- | --- | --- |
| `scripts/ai-workflow-check.selftest.mjs` | self-test fixture에 `Audience: user` 추가 + 새 검사(P1-2/P1-3/P1-5)의 RED/GREEN 케이스 추가 | 변경 |
| `scripts/ai-workflow-check.mjs` | `UI_CHANGE_PATTERNS`의 `/theme/i` 좁히기, `Untouched relevant docs` 검사, QA Gate `failed` 사유 강제, `Audience` 컬럼 cross-validation | 변경 |
| `.github/workflows/ai-workflow-check.yml` | self-test + UX/UI fixture + QA Gate fixture step 3개 추가 | 변경 |
| `docs/ai-workflow/runs/2026/05/26/20260526-auth-error-callback-ux-review.md` | 파일명을 `20260526-1700-auth-error-callback-ux-review.md`로 변경 (시간 17:00로 가정 — 사용자 확인 필요) | rename |
| `docs/ai-workflow/review-gates.md` | §Finish 절에 "로컬 checker(`git status`)와 CI checker(`git diff base..head`) 입력 차이" 한 단락 추가 | 변경 |
| (선택) `docs/ai-workflow/templates/context-ledger-template.md` | `Untouched relevant docs` bullet이 필수임을 주석으로 명시 (P1-2 동반) | 변경 |

## Tasks

| # | Task | Files | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- |
| 0 | Codex plan-eng-review 1라운드 | (외부 스킬 호출) | N — main session이 packet 작성, 결과 통합 |
| 1 | 리뷰 반영 + plan revise | 본 plan | N — 리뷰 결과에 따라 main session 직접 |
| 2 | Codex re-review → PASS gate | (외부) | N — 동일 |
| 3 | P0-1: selftest fixture에 `Audience: user` 추가 | `scripts/ai-workflow-check.selftest.mjs:421-422` | Y — 단일 라인, 독립적, RED/GREEN 사이클 명확 |
| 4 | P0-2: CI yaml에 self-test/fixture step 3개 추가 | `.github/workflows/ai-workflow-check.yml` | Y — 독립 파일, syntax 검증만 필요 |
| 5 | P0-3: 잘못된 형식 ledger 리네임 | `docs/ai-workflow/runs/2026/05/26/...` | Y — 단일 mv 작업, history 영향 없음(untracked) |
| 6 | P1-1: `UI_CHANGE_PATTERNS`의 `/theme/i` 좁히기 | `scripts/ai-workflow-check.mjs:87` + selftest fixture | N — 동일 파일에서 Task 7/8/9와 sequential 권장 |
| 7 | P1-2: `Untouched relevant docs` 검사 추가 | `scripts/ai-workflow-check.mjs` validateLedger + selftest | N — Task 6/8/9와 sequential |
| 8 | P1-3: QA Gate `failed` 단독 FAIL 처리 | `scripts/ai-workflow-check.mjs:286-289` + selftest | N — sequential |
| 9 | P1-4: 로컬 vs CI checker 입력 차이 문서화 | `docs/ai-workflow/review-gates.md` §Finish | Y — 독립 문서 변경 |
| 10 | P1-5: Audience 컬럼 cross-validation | `scripts/ai-workflow-check.mjs` 신규 dispatcher + selftest | N — 가장 복잡, 단일 owner |
| 11 | 통합 검증: 4개 검증 명령 + 본 plan 자체가 체커 통과 | (전체) | N — main session이 결과 분석/통합 |
| 12 | Cross-model 최종 정합성 검사 (Codex 1회) | (외부) | N — packet 통합 |

---

## Task 0: Codex plan-eng-review 1라운드

**Files:** (외부 스킬 호출, plan 파일 자체는 read-only)

- [ ] **Step 1: codex CLI로 plan 파일 리뷰 의뢰**

```bash
codex consult \
  --file docs/ai-workflow/plans/20260527-1500-ai-workflow-audit-fixes.md \
  --prompt "이 plan은 reports/ai-workflow-audit-20260527.html의 P0 3건 + P1 5건을 고치기 위한 구현 계획서다. 다음 관점에서 plan-eng-review를 해줘: (1) TDD 사이클이 각 task에서 명확한가, (2) Smallest Buildable Unit 선정이 합리적인가, (3) Out of Scope에서 빠뜨린 것 또는 잘못 뺀 것이 있는가, (4) Task table의 Subagent-eligible 분류가 정확한가, (5) P1-2의 'Untouched relevant docs' 검사가 기존 ledger를 깨지 않는가, (6) P1-5의 Audience 컬럼 cross-validation 구현 방식에 더 단순한 대안이 있는가. PASS / CONCERN / FAIL 중 하나로 판정하고 각 항목에 근거 명시. 반대 의견이 있으면 구체적으로."
```

- [ ] **Step 2: 결과를 ledger에 packet 형태로 기록**

Codex 응답을 본 plan과 ledger의 "Child Result Packets" 섹션에 그대로 붙임. PASS/CONCERN/FAIL 판정 명시.

---

## Task 1: 리뷰 반영 + plan revise

**Files:**
- Modify: `docs/ai-workflow/plans/20260527-1500-ai-workflow-audit-fixes.md`
- Modify: `docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md` (ledger Decisions 테이블)

- [ ] **Step 1: Codex 피드백 분류**

각 항목을 다음 4개 중 하나로 분류:
- `accepted` — plan에 반영
- `accepted-with-modification` — 부분 반영, 사유 ledger 기록
- `rejected-with-reason` — 반영 안 함, 사유 ledger 기록 (review-gates.md §Disagreement resolution 따름)
- `out-of-scope` — 별건 follow-up으로 분리

- [ ] **Step 2: plan 본문 업데이트**

분류 결과대로 plan 본문 수정. 변경 위치를 ledger Decisions 표에 라인 단위로 기록.

- [ ] **Step 3: ledger 업데이트**

```
| 2026-05-27 HH:MM | Codex review round 1 결과: <PASS/CONCERN/FAIL> | <항목별 사유 요약> | <Codex 출력 경로 또는 본 ledger Child Result Packets> |
```

---

## Task 2: Codex re-review → PASS gate

**Files:** (외부 호출)

- [ ] **Step 1: 같은 명령으로 재검수**

```bash
codex consult \
  --file docs/ai-workflow/plans/20260527-1500-ai-workflow-audit-fixes.md \
  --prompt "이전 라운드의 피드백을 반영해 plan을 수정했다. 다시 PASS/CONCERN/FAIL 판정. 새로 추가된 우려가 있다면 명시. 같은 우려가 남아 있다면 'unresolved' 표기."
```

- [ ] **Step 2: 판정 결과에 따라 분기**

- PASS → Task 3 진행 가능
- CONCERN with all accepted → Task 3 진행, 각 concern을 ledger에 "accepted with reason"으로 기록
- FAIL → Task 1으로 돌아감 (round-cap: base 3, workflow-governing 보너스로 최대 5)
- 5라운드 도달 → 사용자에게 escalate

- [ ] **Step 3: ledger에 review chain 기록**

```
| Time | Round | Verdict | Resolved | Unresolved |
| --- | --- | --- | --- | --- |
| ... | 1 | <PASS/CONCERN/FAIL> | <list> | <list or none> |
```

---

## Task 3: P0-1 — selftest fixture에 `Audience: user` 추가

**Files:**
- Modify: `scripts/ai-workflow-check.selftest.mjs:419-429`

**문제:** `testLightSpecPresenceCheckedForPhaseLedgers`의 fixture light spec 본문이 `"# Phase 4 light spec\n"`인데, 체커는 `AUDIENCE_FIELD_PATTERN` 또는 `AUDIENCE_SECTION_PATTERN`을 요구. 결과적으로 `r4.ok === true` 단언이 실패.

- [ ] **Step 1: RED 확인 — 현재 selftest 실패 재현**

```bash
node scripts/ai-workflow-check.selftest.mjs
```

Expected: `AssertionError at line 429 ... false !== true`.

- [ ] **Step 2: fixture 수정**

`scripts/ai-workflow-check.selftest.mjs` line 419-423 부근, `await writeFile(...)` 호출의 본문 인자를 변경:

```js
// Before:
await writeFile(
  join(root, "docs", "ai-workflow", "light-specs", "phase-4-learning-core.md"),
  "# Phase 4 light spec\n",
);

// After:
await writeFile(
  join(root, "docs", "ai-workflow", "light-specs", "phase-4-learning-core.md"),
  "# Phase 4 light spec\n\nAudience: user\n",
);
```

- [ ] **Step 3: GREEN 확인**

```bash
node scripts/ai-workflow-check.selftest.mjs
```

Expected: `ai-workflow-check self-test passed`.

- [ ] **Step 4: 추가 회귀 방지 fixture 신설**

`testLightSpecPresenceCheckedForPhaseLedgers` 끝부분(line 438 직전)에 다음 단언 추가:

```js
// Audience missing → fail (regression guard for the bug that broke self-test silently)
await writeFile(
  join(root, "docs", "ai-workflow", "light-specs", "phase-5-no-audience.md"),
  "# Phase 5 light spec (no audience)\n",
);
const r6 = await checkLightSpecPresence(
  root,
  [
    "Phase: 5-no-audience",
    "Light Spec: docs/ai-workflow/light-specs/phase-5-no-audience.md",
  ].join("\n"),
  "docs/ai-workflow/runs/2026/05/20/20260520-1200-other.md",
);
assert.equal(r6.ok, false);
assert.ok(r6.errors.some((e) => /Audience/i.test(e)));
```

- [ ] **Step 5: 다시 selftest 통과 확인**

```bash
node scripts/ai-workflow-check.selftest.mjs
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add scripts/ai-workflow-check.selftest.mjs
git commit -m "test(workflow): fix selftest fixture missing Audience + add regression guard

Constraint: checkLightSpecPresence now requires Audience field/section (added 2026-05-22 PR A extension)
Tested: node scripts/ai-workflow-check.selftest.mjs → PASS
Not-tested: n/a
Publication-decision: local-commit
Review: degraded — single-model self-review (codex unavailable for code-level review at time of fix)
Ledger: docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md"
```

---

## Task 4: P0-2 — CI yaml에 self-test + fixture step 3개 추가

**Files:**
- Modify: `.github/workflows/ai-workflow-check.yml`

**문제:** 현재 CI는 `ai-workflow-check.mjs`만 실행. self-test와 2개 fixture 테스트는 무시.

- [ ] **Step 1: 현재 yaml 구조 확인**

```bash
cat .github/workflows/ai-workflow-check.yml
```

- [ ] **Step 2: "Validate AI workflow evidence" step *앞에* 3개 step 추가**

`Set up Node.js` 다음, `Prepare workflow check inputs` 앞에:

```yaml
      - name: Run checker self-test
        run: node scripts/ai-workflow-check.selftest.mjs

      - name: Run UX/UI Consistency Pass fixture tests
        run: node scripts/test-uxui-fixtures.mjs

      - name: Run QA Gate fixture tests
        run: node scripts/test-qa-gate-fixtures.mjs
```

**순서 근거:** self-test가 먼저 돌아야 체커 자체의 회귀를 잡는다. 그 후 실제 PR 검증.

- [ ] **Step 3: YAML syntax 검증**

```bash
node -e "const yaml=require('js-yaml');const fs=require('fs');try{yaml.load(fs.readFileSync('.github/workflows/ai-workflow-check.yml','utf8'));console.log('YAML valid')}catch(e){console.error('YAML invalid:',e.message);process.exit(1)}"
```

(만약 `js-yaml`이 없으면 `python -c "import yaml; yaml.safe_load(open('.github/workflows/ai-workflow-check.yml'))"` 또는 `npx -y @action-validator/cli .github/workflows/ai-workflow-check.yml`)

Expected: YAML valid.

- [ ] **Step 4: 커밋**

```bash
git add .github/workflows/ai-workflow-check.yml
git commit -m "ci(workflow): run checker self-test and fixture tests before PR validation

Constraint: P0-1 류 회귀가 CI를 통과하던 안전망 끊김 — self-test/fixture를 CI가 실제로 돌리게
Tested: YAML syntax validated locally
Not-tested: 실제 CI 실행은 PR 푸시 시점
Publication-decision: local-commit
Review: degraded — pending Codex review
Ledger: docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md"
```

---

## Task 5: P0-3 — 잘못된 형식 ledger 리네임

**Files:**
- Rename: `docs/ai-workflow/runs/2026/05/26/20260526-auth-error-callback-ux-review.md` → `docs/ai-workflow/runs/2026/05/26/20260526-<HHMM>-auth-error-callback-ux-review.md`

**시각 결정 방식 (Codex round 1 §7 반영):** 파일 본문에는 날짜만 있고 시간 없음(확인됨 — `Created: 2026-05-26`, `Updated: 2026-05-26`, Decisions 표도 date only). 따라서 다음 우선순위로 시각 결정:
1. 사용자가 명시 지정한 시간이 있으면 그걸 사용
2. 없으면 파일 시스템 mtime을 KST로 변환해 사용 (`stat`/`ls -la` 결과)
3. 그것도 못 얻으면 `1200`(정오 — "시간 미상"의 명시적 sentinel)을 사용 + ledger Decisions 표에 사유 기록

**Acceptance criterion (수정됨)**: 파일이 `docs/ai-workflow/runs/2026/05/26/20260526-\d{4}-auth-error-callback-ux-review.md` 패턴에 매치하면 OK. 정확한 HHMM 값은 위 결정 규칙에 따라 자유.

- [ ] **Step 1: 파일 존재 + 현재 상태 확인**

```bash
ls -la docs/ai-workflow/runs/2026/05/26/20260526-auth-error-callback-ux-review.md
git status docs/ai-workflow/runs/2026/05/26/20260526-auth-error-callback-ux-review.md
```

Expected: 파일 존재 + untracked (`??`) 상태.

- [ ] **Step 2: 시각 결정 — fs mtime 우선, 미상이면 1200**

```bash
# Windows PowerShell:
(Get-Item "docs/ai-workflow/runs/2026/05/26/20260526-auth-error-callback-ux-review.md").LastWriteTime.ToString("HHmm")
# bash equivalent:
stat -c "%y" "docs/ai-workflow/runs/2026/05/26/20260526-auth-error-callback-ux-review.md" | awk '{print substr($2,1,2) substr($2,4,2)}'
```

위 결과를 `<HHMM>`로 사용. 결과가 시스템 timezone에 따라 흔들리거나 신뢰 안 가면 `1200` 사용 + ledger Decisions에 "fs mtime unreliable, used 1200 sentinel" 기록.

- [ ] **Step 3: 단순 mv (untracked이므로 `git mv` 불요)**

```bash
# <HHMM>은 Step 2에서 결정한 값. 예시는 1200 sentinel.
HHMM=1200  # or value from fs mtime
mv "docs/ai-workflow/runs/2026/05/26/20260526-auth-error-callback-ux-review.md" \
   "docs/ai-workflow/runs/2026/05/26/20260526-${HHMM}-auth-error-callback-ux-review.md"
```

- [ ] **Step 4: 체커 통과 확인**

```bash
node scripts/ai-workflow-check.mjs --repo .
```

Expected: 더 이상 "implementation/config workflow changes require a run ledger" 오류 없음 (다른 untracked 파일들 때문에 다른 오류가 남을 수는 있음 — 본 task는 *이 한 가지 원인*만 해결).

- [ ] **Step 5: 커밋 (다른 untracked 파일들은 stage 안 함)**

```bash
git add "docs/ai-workflow/runs/2026/05/26/20260526-${HHMM}-auth-error-callback-ux-review.md"
git commit -m "chore(workflow): rename ledger to follow YYYYMMDD-HHMM- naming convention

Constraint: LEDGER_PATTERN requires \\d{8}-\\d{4}- prefix
Tested: node scripts/ai-workflow-check.mjs --repo . — 해당 ledger 위반 항목 사라짐
Not-tested: n/a
Publication-decision: local-commit
Review: degraded — pending Codex review
Ledger: docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md"
```

---

## Task 6: P1-1 — `UI_CHANGE_PATTERNS`의 `/theme/i` 좁히기

**Files:**
- Modify: `scripts/ai-workflow-check.mjs:78-92` (UI_CHANGE_PATTERNS 배열)
- Modify: `scripts/ai-workflow-check.selftest.mjs` (RED/GREEN 케이스 추가)

**문제:** `/theme/i`가 경로 어디에도 매치 → `docs/ant-design/08-theme-architecture.md` 같은 docs-only 변경이 UI 게이트 발동.

- [ ] **Step 1: RED — selftest에 회귀 fixture 추가**

`scripts/ai-workflow-check.selftest.mjs`의 `testRepositoryStateValidatesLedgerEvenWhenNoLedgerRequired` 근처에 새 테스트 추가:

```js
async function testUiChangeDetectionDoesNotMatchDocsOnlyPaths() {
  // docs-only file with "theme" in path must NOT trigger UI gate
  const { needsUxuiConsistencyPass } = await import("./ai-workflow-check.mjs").then(m => m.internals);
  assert.equal(
    needsUxuiConsistencyPass(["docs/ant-design/08-theme-architecture.md"]),
    false,
    "docs path with 'theme' should not trigger UI gate",
  );
  // src/theme/ — must trigger
  assert.equal(
    needsUxuiConsistencyPass(["src/theme/index.ts"]),
    true,
    "src/theme/ path should trigger UI gate",
  );
}
```

`await testUiChangeDetectionDoesNotMatchDocsOnlyPaths();`를 self-test 마지막 줄에 추가.

```bash
node scripts/ai-workflow-check.selftest.mjs
```

Expected: FAIL (현재 `/theme/i`는 docs 경로도 매치).

- [ ] **Step 2: GREEN — UI_CHANGE_PATTERNS 수정**

`scripts/ai-workflow-check.mjs:87`:

```js
// Before:
  /theme/i,

// After:
  /^src\/theme\//,
```

근거: `src/theme/` 폴더가 theme 시스템의 실제 위치. 다른 위치에 "theme" 글자가 들어가는 경우(`tailwind.config.*` 등)는 별도 패턴이 이미 커버.

- [ ] **Step 3: GREEN 확인**

```bash
node scripts/ai-workflow-check.selftest.mjs
```

Expected: PASS.

- [ ] **Step 4: 기존 fixture 회귀 확인**

```bash
node scripts/test-uxui-fixtures.mjs
node scripts/test-qa-gate-fixtures.mjs
```

Expected: 모두 PASS 유지.

- [ ] **Step 5: 커밋**

```bash
git add scripts/ai-workflow-check.mjs scripts/ai-workflow-check.selftest.mjs
git commit -m "fix(workflow): narrow UI_CHANGE_PATTERNS /theme/i to ^src/theme/

Constraint: docs-only changes with 'theme' in path were spuriously triggering UX/UI Consistency Pass + QA Gate
Tested: selftest PASS + uxui/qa fixtures PASS
Not-tested: n/a
Publication-decision: local-commit
Review: degraded — pending Codex review
Ledger: docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md"
```

---

## Task 7: P1-2 — `Untouched relevant docs` 검사 추가

**Files:**
- Modify: `scripts/ai-workflow-check.mjs` (`validateLedger` 또는 별도 함수)
- Modify: `scripts/ai-workflow-check.selftest.mjs`
- Modify: `docs/ai-workflow/templates/context-ledger-template.md` (코멘트 추가)

**문제:** 세 곳(`ai-development-workflow.md` L76, `agent-index.md` L113, `report-template.md`)에서 "Untouched relevant docs"를 필수 evidence로 명시. 체커는 무검사.

**구현 방식 결정 (Codex round 1 §5 반영):** REQUIRED_LEDGER_SECTIONS에 새 섹션을 *추가하지 않음* (템플릿은 `## Docs Consulted` 안에 bullet으로 적게 돼 있음). 대신 ledger 본문에서 "Untouched relevant docs" 라인을 찾고 **두 가지 shape 모두 허용**:

1. **same-line value**: `- Untouched relevant docs and reason: none` 또는 `... : n/a` — 콜론 뒤 같은 줄에 값 있음
2. **header + indented bullets**: 라인 자체는 콜론 뒤 비어 있고, 다음 줄들이 공백으로 들여쓰기된 bullet으로 시작 — 본 plan의 ledger와 context-ledger-template.md가 이 shape를 씀

regex 단독으로는 이 양쪽을 처리하기 어려우니 줄 단위 파싱 사용.

- [ ] **Step 1: RED — selftest에 fixture 3개 추가 (missing / same-line / indented-bullets)**

```js
async function testLedgerRequiresUntouchedRelevantDocs() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "runs", "2026", "05", "27"), {
      recursive: true,
    });
    const baseSections = [
      "## Verification State",
      "- Cross-model review: degraded — solo",
      "## Ledger/File-State Consistency",
      "- yes",
    ].join("\n");

    // (A) missing entirely → FAIL
    const missingRel = "docs/ai-workflow/runs/2026/05/27/20260527-1200-missing.md";
    await writeFile(
      join(root, missingRel),
      ["## Docs Consulted", "- Exact files read: a.md", baseSections].join("\n"),
    );
    const rMissing = await checkRepositoryState({ root, changedFiles: [missingRel] });
    assert.equal(rMissing.ok, false);
    assert.ok(rMissing.errors.some((e) => /Untouched relevant docs/i.test(e)));

    // (B) same-line value 'none' → PASS
    const sameLineRel = "docs/ai-workflow/runs/2026/05/27/20260527-1201-same.md";
    await writeFile(
      join(root, sameLineRel),
      [
        "## Docs Consulted",
        "- Exact files read: a.md",
        "- Untouched relevant docs and reason: none",
        baseSections,
      ].join("\n"),
    );
    const rSame = await checkRepositoryState({ root, changedFiles: [sameLineRel] });
    assert.ok(rSame.ok || !rSame.errors.some((e) => /Untouched relevant docs/i.test(e)),
      `same-line 'none' must not raise Untouched relevant docs error: ${rSame.errors.join(" | ")}`);

    // (C) header + indented bullets → PASS (this is the real ledger/template shape)
    const indentedRel = "docs/ai-workflow/runs/2026/05/27/20260527-1202-indent.md";
    await writeFile(
      join(root, indentedRel),
      [
        "## Docs Consulted",
        "- Exact files read: a.md",
        "- Untouched relevant docs and reason:",
        "  - `docs/foo.md` — out of scope for this work",
        "  - `docs/bar.md` — not relevant",
        baseSections,
      ].join("\n"),
    );
    const rIndent = await checkRepositoryState({ root, changedFiles: [indentedRel] });
    assert.ok(rIndent.ok || !rIndent.errors.some((e) => /Untouched relevant docs/i.test(e)),
      `indented-bullets shape must not raise Untouched relevant docs error: ${rIndent.errors.join(" | ")}`);

    // (D) header with colon but no bullets after → FAIL (empty section)
    const emptyHeaderRel = "docs/ai-workflow/runs/2026/05/27/20260527-1203-empty.md";
    await writeFile(
      join(root, emptyHeaderRel),
      [
        "## Docs Consulted",
        "- Exact files read: a.md",
        "- Untouched relevant docs and reason:",
        "",
        baseSections,
      ].join("\n"),
    );
    const rEmpty = await checkRepositoryState({ root, changedFiles: [emptyHeaderRel] });
    assert.equal(rEmpty.ok, false);
    assert.ok(rEmpty.errors.some((e) => /Untouched relevant docs/i.test(e)));
  });
}
```

```bash
node scripts/ai-workflow-check.selftest.mjs
```

Expected: FAIL.

- [ ] **Step 2: GREEN — `validateLedger`에 줄 단위 파서 추가**

`scripts/ai-workflow-check.mjs`의 `validateLedger` 함수 안, REQUIRED_LEDGER_SECTIONS 루프 다음에 추가:

```js
// "Untouched relevant docs" must have non-empty content.
// Two valid shapes (see context-ledger-template.md):
//   (A) same-line: "- Untouched relevant docs and reason: none"
//   (B) header + indented bullets:
//       "- Untouched relevant docs and reason:"
//       "  - foo — reason"
// Empty (header colon followed by blank/non-indented line) fails.
const lines = content.split(/\r?\n/);
let untouchedOk = false;
let untouchedFound = false;
for (let i = 0; i < lines.length; i += 1) {
  const m = lines[i].match(/^\s*-?\s*Untouched relevant docs[^:]*:\s*(.*)$/i);
  if (!m) continue;
  untouchedFound = true;
  const inline = m[1].trim();
  if (inline.length > 0) {
    untouchedOk = true;
    break;
  }
  // look forward for indented bullets / non-empty content lines
  for (let j = i + 1; j < lines.length; j += 1) {
    const next = lines[j];
    if (next.trim().length === 0) continue;
    // stop scan when next top-level item or new section starts
    if (/^##\s+/.test(next)) break;
    if (/^\S/.test(next)) break;   // non-indented → next field at same level
    // indented non-empty line counts as content
    untouchedOk = true;
    break;
  }
  break;
}
if (!untouchedFound) {
  errors.push(
    `ledger ${ledgerPath}: missing 'Untouched relevant docs:' field (required per docs/agent-index.md §Output Requirement)`,
  );
} else if (!untouchedOk) {
  errors.push(
    `ledger ${ledgerPath}: 'Untouched relevant docs:' field is empty (use 'none' or 'n/a' if intentional, or list with indented bullets)`,
  );
}
```

**경계 조건:** `none` / `n/a` / `not applicable` 모두 same-line 유효 값. indented bullets는 한 줄 이상이면 OK.

- [ ] **Step 3: GREEN 확인**

```bash
node scripts/ai-workflow-check.selftest.mjs
```

Expected: PASS.

- [ ] **Step 4: 본 plan의 ledger가 이 검사를 통과하는지 확인**

```bash
node scripts/ai-workflow-check.mjs --repo .
```

본 plan ledger는 이미 `Untouched relevant docs and reason:` 라인을 가지고 있음. PASS 예상.

- [ ] **Step 5: 템플릿에 코멘트 추가**

`docs/ai-workflow/templates/context-ledger-template.md` line 26 옆에 주석:

```markdown
- Untouched relevant docs and reason:  # required — 체커가 강제. 'none' 또는 'n/a'도 허용.
```

- [ ] **Step 6: 커밋**

```bash
git add scripts/ai-workflow-check.mjs scripts/ai-workflow-check.selftest.mjs docs/ai-workflow/templates/context-ledger-template.md
git commit -m "feat(workflow): enforce 'Untouched relevant docs' field in ledger

Constraint: agent-index.md §Output Requirement + ai-development-workflow.md §Required Evidence + report-template.md 모두 'Untouched relevant docs'를 필수로 명시
Tested: selftest PASS, 본 plan ledger도 통과
Not-tested: n/a
Publication-decision: local-commit
Review: degraded — pending Codex review
Ledger: docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md"
```

---

## Task 8: P1-3 — QA Gate `failed` 단독 FAIL 처리

**Files:**
- Modify: `scripts/ai-workflow-check.mjs:286-289` (`checkQaGate`)
- Modify: `scripts/ai-workflow-check.selftest.mjs` (회귀 fixture)

**문제:** 문서(`review-gates.md:212-213`)는 `failed`일 때 "막힌 원인 명시" 요구하지만 체커는 bare `failed`를 통과시킴.

- [ ] **Step 1: RED — selftest fixture + fixture 파일 둘 다 추가** (Codex round 1 §9 반영: 5/5 PASS 의무)

**Step 1a: selftest 단위 테스트 추가**

`scripts/ai-workflow-check.selftest.mjs`에:

```js
async function testQaGateBareFailedRequiresReason() {
  const { checkQaGate } = await import("./ai-workflow-check.mjs");
  const ledgerWithBareFailed = "- QA Gate: failed\n";
  const r = checkQaGate(ledgerWithBareFailed);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /failed.*reason/i.test(e)));
}
```

**Step 1b: 별도 fixture 파일 추가 (기존 4개 fixture 패턴 그대로)**

새 파일 `docs/ai-workflow/fixtures/qa-gate/fx-05-failed-bare.md`:

```markdown
# Fixture · fx-05-failed-bare

- QA Gate: failed
```

그리고 `scripts/test-qa-gate-fixtures.mjs`에 fx-05 검증 케이스 추가 (기존 fx-02/fx-03이 FAIL 사례인 패턴 그대로):

```js
// 예: 기존 fx-02 패턴을 따라
{ file: "fx-05-failed-bare.md", expectError: /failed.*reason/i, label: "bare 'failed' must require reason" }
```

**RED 확인:**

```bash
node scripts/ai-workflow-check.selftest.mjs
node scripts/test-qa-gate-fixtures.mjs
```

Expected: 둘 다 FAIL — bare `failed`가 현재 PASS 통과 중.

- [ ] **Step 2: GREEN — checkQaGate에 한 줄 추가**

`scripts/ai-workflow-check.mjs:286-289` 부근:

```js
// Before:
if (/^skipped$/i.test(value)) {
  errors.push(
    "QA Gate 'skipped' requires a reason ('skipped — <reason>')",
  );
}

// After:
if (/^skipped$/i.test(value)) {
  errors.push(
    "QA Gate 'skipped' requires a reason ('skipped — <reason>')",
  );
}
if (/^failed$/i.test(value)) {
  errors.push(
    "QA Gate 'failed' requires a reason ('failed — <blocker>'). See review-gates.md §QA Gate.",
  );
}
```

- [ ] **Step 3: GREEN 확인**

```bash
node scripts/ai-workflow-check.selftest.mjs
node scripts/test-qa-gate-fixtures.mjs
```

Expected: selftest PASS, qa-gate fixtures `5/5 PASS`.

- [ ] **Step 4: 커밋**

```bash
git add scripts/ai-workflow-check.mjs scripts/ai-workflow-check.selftest.mjs docs/ai-workflow/fixtures/qa-gate/fx-05-failed-bare.md scripts/test-qa-gate-fixtures.mjs
git commit -m "fix(workflow): enforce QA Gate 'failed' must specify reason

Constraint: review-gates.md §QA Gate L212-213 — failed = '실행 시도했으나 통과 못 함. 막힌 원인 명시'
Tested: selftest PASS, qa-gate fixtures PASS
Not-tested: n/a
Publication-decision: local-commit
Review: degraded — pending Codex review
Ledger: docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md"
```

---

## Task 9: P1-4 — 로컬 vs CI checker 입력 차이 문서화

**Files:**
- Modify: `docs/ai-workflow/review-gates.md` §Finish

**문제:** 로컬은 `git status --porcelain`, CI는 `git diff --name-only base..head` — 입력 다르면 결과 다를 수 있음. 문서화 안 됨.

- [ ] **Step 1: §Finish 절 끝에 한 단락 추가**

`review-gates.md` line 239 직전 (또는 §Finish 안 적절한 위치)에:

```markdown
### 로컬 vs CI checker 입력 차이 (운영 주의)

- **로컬**: `node scripts/ai-workflow-check.mjs --repo .`는 `git status --porcelain --untracked-files=all` 결과를 사용. 즉 **working tree에 남아 있는 변경**만 봄. 커밋 직후에는 changed files가 빈 상태가 되므로 일부 검사가 트리거되지 않음.
- **CI**: `.github/workflows/ai-workflow-check.yml`은 `git diff --name-only base..head` 결과를 `--changed-files`로 넘김. 즉 **PR 전체 diff**를 봄.
- **결과**: 로컬에서 PASS인데 CI에서 FAIL이거나 그 반대인 경우가 발생 가능. **신뢰는 CI 결과 기준**. 로컬은 작업 중 빠른 피드백 용도.
- **로컬에서 CI와 같은 입력을 보고 싶으면**: `git diff --name-only origin/main..HEAD > /tmp/changed.txt && node scripts/ai-workflow-check.mjs --repo . --changed-files /tmp/changed.txt`.
```

- [ ] **Step 2: 검토 — `## Finish (review portion)` 안에 들어가는지 위치 재확인**

- [ ] **Step 3: 커밋**

```bash
git add docs/ai-workflow/review-gates.md
git commit -m "docs(workflow): document local vs CI checker input divergence

Constraint: 로컬 git status와 CI git diff base..head는 입력이 달라 결과 다를 수 있음 — 운영자가 혼란을 겪는 사례 방지
Tested: 문서 변경만, 자동 검증 없음
Not-tested: n/a
Publication-decision: local-commit
Review: degraded — pending Codex review
Ledger: docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md"
```

---

## Task 10: P1-5 — Audience 컬럼 cross-validation

**Files:**
- Modify: `scripts/ai-workflow-check.mjs` (신규 dispatcher 함수 + checkPlanFile 인자 확장)
- Modify: `scripts/ai-workflow-check.selftest.mjs`

**문제:** Light Spec의 `Audience: both`일 때 plan task table에 `Audience` 컬럼 필수 (planning-contracts.md L64). 현재 미강제.

**구현 방식 (Codex round 1 §6 반영 — fail-closed 보강):**
1. plan 파일의 슬러그에서 `phase-N`을 추출.
2. 동일 phase-N의 light spec 파일(`docs/ai-workflow/light-specs/phase-N-*.md`)을 찾음.
3. **fail-closed 분기**:
   - light spec 발견 + `Audience: both` → `checkPlanFile`에 `requireAudienceColumn: true` 전달
   - light spec 발견 + `Audience: user|admin` → `requireAudienceColumn: false`
   - light spec 발견 + `Audience` 필드 없음 → **에러 (light spec 자체 결함, 별도 검사)** — 이미 `checkLightSpecPresence`가 잡음
   - **light spec 미발견** + plan path에 `phase-N` 슬러그 있음 → **에러**: `plan ${path} references phase ${N} but no matching docs/ai-workflow/light-specs/phase-${N}-*.md exists` — phase plan은 항상 light spec과 짝이어야 함 (planning-contracts.md L38)
   - plan path에 `phase-N` 슬러그 없음 → 검사 skip (non-phase workflow/meta plan)
4. `checkPlanFile`은 task table 헤더에 `Audience` 컬럼이 있고 각 행이 `user|admin|both|n/a` 중 하나인지 검증.

- [ ] **Step 1: RED — selftest fixture 추가**

```js
async function testPlanRequiresAudienceColumnWhenLightSpecIsBoth() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "light-specs"), { recursive: true });
    await mkdir(join(root, "docs", "ai-workflow", "plans"), { recursive: true });

    // light spec with Audience: both
    await writeFile(
      join(root, "docs/ai-workflow/light-specs/phase-9-mixed.md"),
      "# Phase 9\n\nAudience: both\n",
    );

    // plan without Audience column
    const planRel = "docs/ai-workflow/plans/20260601-phase-9-mixed.md";
    await writeFile(
      join(root, planRel),
      [
        "# Phase 9 Plan",
        "## Out of Scope — Intentional Cuts",
        "- x",
        "## Smallest Buildable Unit",
        "- y",
        "## Tasks",
        "| # | Task | Files | Subagent-eligible? (Y/N + reason) |",
        "| --- | --- | --- | --- |",
        "| 1 | foo | s | Y — independent |",
      ].join("\n"),
    );

    const r = await checkRepositoryState({
      root,
      changedFiles: [planRel],
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => /Audience column/i.test(e)),
      `expected Audience column error, got: ${r.errors.join(" | ")}`);
  });
}
```

```bash
node scripts/ai-workflow-check.selftest.mjs
```

Expected: FAIL.

- [ ] **Step 2: GREEN — `checkPlanFile` 시그니처 확장 + dispatcher 추가**

`scripts/ai-workflow-check.mjs`의 `checkPlanFile` 시그니처:

```js
// Before:
export function checkPlanFile(text, path = "<plan>") { ... }

// After:
export function checkPlanFile(text, path = "<plan>", options = {}) {
  const { requireAudienceColumn = false } = options;
  // ... 기존 로직
  // task table 검사 안쪽에서 requireAudienceColumn이면 'Audience' 컬럼 + 각 행 값 검증
}
```

신규 helper:

```js
const PLAN_PHASE_PATTERN = /phase-(\d+)/;
const LIGHT_SPEC_AUDIENCE_VALUE_PATTERN = /^Audience:\s*(\S+)/im;

// Returns: { found: bool, audience: string|null, missingLightSpec: bool }
// fail-closed: phase-N plan with no matching light spec is treated as an error upstream.
async function resolvePlanAudienceFromLightSpec(root, planPath) {
  const m = planPath.match(PLAN_PHASE_PATTERN);
  if (!m) return { found: false, audience: null, missingLightSpec: false, phaseNum: null };
  const phaseNum = m[1];
  const lightSpecsDir = join(root, "docs", "ai-workflow", "light-specs");
  if (!existsSync(lightSpecsDir)) {
    return { found: false, audience: null, missingLightSpec: true, phaseNum };
  }
  const entries = await readdir(lightSpecsDir);
  const match = entries.find((e) => new RegExp(`^phase-${phaseNum}[-_.]`).test(e));
  if (!match) {
    return { found: false, audience: null, missingLightSpec: true, phaseNum };
  }
  const body = await readFile(join(lightSpecsDir, match), "utf8");
  const av = body.match(LIGHT_SPEC_AUDIENCE_VALUE_PATTERN);
  return {
    found: true,
    audience: av ? av[1].toLowerCase() : null,
    missingLightSpec: false,
    phaseNum,
  };
}
```

`validatePlanFile`을 async 함수로 유지(이미 async)하고 호출 부분 수정:

```js
async function validatePlanFile(root, planPath, errors) {
  if (PLAN_TEMPLATE_PATTERN.test(planPath)) return;
  if (!(await fileExists(root, planPath))) { errors.push(...); return; }
  const content = await readFile(join(root, planPath), "utf8");

  const resolved = await resolvePlanAudienceFromLightSpec(root, planPath);
  // fail-closed: phase-N plan must have a matching light spec
  if (resolved.missingLightSpec) {
    errors.push(
      `plan ${planPath}: references phase ${resolved.phaseNum} but no matching docs/ai-workflow/light-specs/phase-${resolved.phaseNum}-*.md exists (planning-contracts.md §1b)`,
    );
  }
  const result = checkPlanFile(content, planPath, {
    requireAudienceColumn: resolved.audience === "both",
  });
  if (!result.ok) for (const e of result.errors) errors.push(e);
  // ... phase plan extra check
}
```

`checkPlanFile`의 task table 검사 안쪽:

```js
// after subagent column check
if (requireAudienceColumn) {
  const audienceColIdx = cols.findIndex((c) => /^audience$/i.test(c));
  if (audienceColIdx === -1) {
    errors.push(
      `plan ${path} task table requires an 'Audience' column (light spec phase Audience is 'both')`,
    );
  } else {
    let rowNumber = 0;
    for (let i = headerIdx + 2; i < lines.length; i += 1) {
      const row = lines[i];
      if (!/^\|/.test(row)) break;
      rowNumber += 1;
      const cells = row.split("|").slice(1, -1).map((c) => c.trim());
      const cell = cells[audienceColIdx] ?? "";
      if (!/^(user|admin|both|n\/a)$/i.test(cell)) {
        errors.push(
          `plan ${path} task row ${rowNumber} Audience cell must be one of 'user|admin|both|n/a' (got: '${cell}')`,
        );
      }
    }
  }
}
```

- [ ] **Step 3: GREEN 확인**

```bash
node scripts/ai-workflow-check.selftest.mjs
```

Expected: PASS.

- [ ] **Step 4: 회귀 — 기존 `user`/`admin` light spec은 Audience 컬럼 안 요구해야 함**

selftest에 추가:

```js
async function testPlanDoesNotRequireAudienceColumnWhenLightSpecIsSingle() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "light-specs"), { recursive: true });
    await mkdir(join(root, "docs", "ai-workflow", "plans"), { recursive: true });

    await writeFile(
      join(root, "docs/ai-workflow/light-specs/phase-9-mixed.md"),
      "# Phase 9\n\nAudience: user\n",
    );
    const planRel = "docs/ai-workflow/plans/20260601-phase-9-mixed.md";
    await writeFile(
      join(root, planRel),
      [
        "# Phase 9 Plan",
        "## Out of Scope — Intentional Cuts",
        "- x",
        "## Smallest Buildable Unit",
        "- y",
        "## Tasks",
        "| # | Task | Files | Subagent-eligible? (Y/N + reason) |",
        "| --- | --- | --- | --- |",
        "| 1 | foo | s | Y — independent |",
      ].join("\n"),
    );
    const r = await checkRepositoryState({ root, changedFiles: [planRel] });
    // Audience: user means Audience column NOT required → no related error
    assert.ok(
      !r.errors.some((e) => /Audience column/i.test(e)),
      `single audience must not require Audience column: ${r.errors.join(" | ")}`,
    );
  });
}
```

- [ ] **Step 4b: 회귀 — phase-N plan + light spec 미존재 → fail-closed (Codex round 2 §6 반영)**

selftest에 추가:

```js
async function testPlanFailsClosedWhenLightSpecMissing() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "light-specs"), { recursive: true });
    await mkdir(join(root, "docs", "ai-workflow", "plans"), { recursive: true });

    // NOTE: NO light spec written for phase-99
    const planRel = "docs/ai-workflow/plans/20260601-phase-99-orphan.md";
    await writeFile(
      join(root, planRel),
      [
        "# Phase 99 Plan",
        "## Out of Scope — Intentional Cuts",
        "- x",
        "## Smallest Buildable Unit",
        "- y",
        "## Tasks",
        "| # | Task | Files | Subagent-eligible? (Y/N + reason) |",
        "| --- | --- | --- | --- |",
        "| 1 | foo | s | Y — independent |",
      ].join("\n"),
    );
    const r = await checkRepositoryState({ root, changedFiles: [planRel] });
    assert.equal(r.ok, false, "phase-N plan without matching light spec must fail");
    assert.ok(
      r.errors.some((e) => /phase 99.*light-specs.*phase-99/i.test(e)),
      `expected missing-light-spec error for phase 99, got: ${r.errors.join(" | ")}`,
    );
  });
}
```

또한 selftest 본문 끝에 `await testPlanFailsClosedWhenLightSpecMissing();` 추가.

**경계 조건:** non-phase plan(`20260527-1500-ai-workflow-audit-fixes.md` 같은 슬러그)은 phase-N 매치 없으므로 검사 skip. positive 케이스로 selftest에 한 줄 추가:

```js
async function testNonPhasePlanSkipsLightSpecCheck() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "plans"), { recursive: true });
    const planRel = "docs/ai-workflow/plans/20260601-1200-meta-workflow.md";
    await writeFile(
      join(root, planRel),
      [
        "# Meta Plan",
        "## Out of Scope — Intentional Cuts",
        "- x",
        "## Smallest Buildable Unit",
        "- y",
      ].join("\n"),
    );
    const r = await checkRepositoryState({ root, changedFiles: [planRel] });
    assert.ok(
      !r.errors.some((e) => /light-specs/i.test(e)),
      `non-phase plan must not raise missing-light-spec error: ${r.errors.join(" | ")}`,
    );
  });
}
```

- [ ] **Step 5: 커밋**

```bash
git add scripts/ai-workflow-check.mjs scripts/ai-workflow-check.selftest.mjs
git commit -m "feat(workflow): require Audience column in plan task table when light spec Audience is 'both'

Constraint: planning-contracts.md L64 — 'When the phase Audience is both, the table must also include an Audience column'
Tested: selftest PASS (positive + negative cases)
Not-tested: 실제 phase=both plan은 현재 저장소에 없으므로 fixture 기반 검증만
Publication-decision: local-commit
Review: degraded — pending Codex review
Ledger: docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md"
```

---

## Task 11: 통합 검증

**Files:** (전체 자체 검증)

- [ ] **Step 1: 검증 명령 4개 순차 실행**

```bash
node scripts/ai-workflow-check.selftest.mjs && \
node scripts/test-uxui-fixtures.mjs && \
node scripts/test-qa-gate-fixtures.mjs && \
node scripts/ai-workflow-check.mjs --repo .
```

Expected: 4개 모두 PASS (qa-gate는 5/5).

- [ ] **Step 2: 본 plan 자체가 체커 통과하는지 확인**

```bash
git diff --name-only origin/main..HEAD > /tmp/changed.txt
node scripts/ai-workflow-check.mjs --repo . --changed-files /tmp/changed.txt
```

Expected: PASS (본 plan + ledger 모두 필수 섹션 있음).

- [ ] **Step 3: 대표 commit message 검증** (Codex round 1 §8 반영)

본 plan의 Task 3-10에서 만든 커밋 메시지 중 하나를 대표로 골라 체커 통과 확인:

```bash
git log -1 --format=%B > /tmp/last-commit.txt
node scripts/ai-workflow-check.mjs --commit-message /tmp/last-commit.txt
```

Expected: PASS (Conventional Commits header + Lore trailers 모두 충족).

- [ ] **Step 4: ledger 갱신**

본 plan의 ledger `Verification State` 섹션에 Step 1-3 명령 결과 기록.

---

## Task 12: Cross-model 최종 정합성 검사

**Files:** (외부 호출)

- [ ] **Step 1: 변경된 모든 파일에 대해 Codex review 요청**

```bash
git diff origin/main..HEAD -- \
  scripts/ai-workflow-check.mjs \
  scripts/ai-workflow-check.selftest.mjs \
  .github/workflows/ai-workflow-check.yml \
  docs/ai-workflow/review-gates.md \
  docs/ai-workflow/templates/context-ledger-template.md \
  > /tmp/audit-fixes.diff
codex review --diff /tmp/audit-fixes.diff \
  --prompt "이 diff는 ai-workflow-audit-fixes plan의 구현 결과다. (1) 각 변경이 plan과 일치하는가, (2) 회귀 위험이 있는가, (3) 빠뜨린 edge case가 있는가."
```

- [ ] **Step 2: PASS / CONCERN / FAIL 분기**

- PASS → 완료 보고
- CONCERN → 각 항목 accepted-with-reason으로 ledger 기록
- FAIL → 해당 task 재실행 (round-cap 적용)

- [ ] **Step 3: ledger Verification State에 cross-model review 결과 박기**

```
- Cross-model review: passed — Codex review on diff after Task 11
```

---

## Verification Strategy

본 plan은 [`review-gates.md`](../review-gates.md)의 다음 게이트를 모두 거친다:

| Gate | 본 plan에서의 적용 |
| --- | --- |
| **TDD** | Task 3, 6, 7, 8, 10이 RED → GREEN → 커밋 사이클 (selftest fixture가 RED 역할). **Task 4 / 5 / 9는 TDD 예외** — review-gates.md L20-25의 docs-only/config-only/no-runnable-test-surface 조항 적용. 대체 검증: Task 4 = YAML syntax + 체커 실행, Task 5 = 체커 실행으로 위반 해소 확인, Task 9 = 문서 자체 inspection. (Codex round 1 §1 반영) |
| **Cross-model review** | Task 0/2/12 — Codex가 plan 단계 2회 + 구현 후 diff 1회 검토. |
| **Plan-Review PASS Gate** | Task 0 → 1 → 2 사이클. FAIL이면 revise + re-review, round-cap 5. |
| **Code/Doc Review** | Task 12에서 implementation diff를 Codex가 review. |
| **Architecture Pass** | n/a — phase 작업 아님. workflow infrastructure는 단일 폴더(`scripts/`, `.github/`, `docs/ai-workflow/`) 안에 머묾. |
| **QA Gate** | n/a — UI 없음, dev 서버 부팅 의무 없음. |
| **UX/UI Consistency Pass** | n/a — UI 변경 없음. |
| **Finish** | `verification-before-completion` 스킬 + 본 plan의 Task 11 (Step 1-3 모두). |

## Known Risks

- **R1**: Codex 리뷰가 plan 범위 자체에 deep change를 요구하는 경우 → round-cap 5까지 진행, 그 이상이면 escalate.
- **R2**: P1-5의 phase 매칭 — non-phase plan은 검사 skip (의도). phase-N 슬러그 있는데 light spec 없으면 **fail-closed**로 에러 (Codex round 1 §6 반영).
- **R3**: P1-2 추가가 기존 ledger를 깨뜨릴 가능성 → `validateLedger`는 *changed ledger*에만 적용되므로 미변경 ledger는 영향 없음. 옛 ledger를 약간만 수정하면 새 룰에 걸리는 건 의도된 동작 (touch한 시점부터 새 룰 적용).
- **R4**: P0-3 리네임 시각 미상 → fs mtime 우선, 미상이면 `1200` sentinel + ledger Decisions에 사유 기록 (Codex round 1 §7 반영).
- **R5**: CI yaml 변경 후 실제 CI 실행은 PR 푸시 시점에만 검증 가능 → 로컬에서 YAML syntax 검증으로 보완. 그 이상은 PR 단계 실측.
- **R6**: `/theme/i` 좁히기가 다른 정당한 케이스를 빠뜨릴 수 있음 → selftest에 positive(`src/theme/`)와 negative(`docs/.../theme*`) 모두 fixture로 박음.
- **R7**: **Codex CLI 실패/타임아웃/hang** (Codex round 1 §10 반영) — Task 0/2/12의 외부 Codex 호출이 실패할 가능성. 대응:
  - 각 호출에 600초(10분) timeout 적용
  - stderr 캡처해 `tasks/codex-runs/`에 보존
  - Codex 결과 못 얻으면 → ledger에 `Cross-model review: degraded — codex CLI unavailable (<error summary>)` 기록
  - Plan-Review PASS Gate를 독립 검토 없이 통과시킬 수 없음 → **fail-closed** + 사용자 escalation. degraded 단독으로는 plan PASS 안 줌.

## Acceptance Criteria

- [ ] `node scripts/ai-workflow-check.selftest.mjs` → exit 0 + "ai-workflow-check self-test passed"
- [ ] `node scripts/test-uxui-fixtures.mjs` → 5/5 PASS
- [ ] `node scripts/test-qa-gate-fixtures.mjs` → **5/5 PASS** (Codex round 1 §9 반영: fx-05-failed-bare.md 추가 후)
- [ ] `node scripts/ai-workflow-check.mjs --repo .` → exit 0
- [ ] `.github/workflows/ai-workflow-check.yml`에 self-test/fixture step 3개 존재 + YAML valid
- [ ] 잘못된 형식 ledger가 `docs/ai-workflow/runs/2026/05/26/20260526-\d{4}-auth-error-callback-ux-review.md` 패턴에 매치하는 새 이름으로 존재 (HHMM 값은 Task 5 결정 규칙에 따름)
- [ ] `docs/ai-workflow/review-gates.md`에 로컬 vs CI 입력 차이 단락 존재
- [ ] 본 plan Task 3-10에서 만든 대표 커밋 메시지 1개가 `node scripts/ai-workflow-check.mjs --commit-message <file>` 통과 (Codex round 1 §8 반영)
- [ ] Codex review verdict: PASS (또는 CONCERN with all accepted)
- [ ] 본 ledger의 `Cross-model review:` 필드에 결과 기록
- [ ] Codex CLI 실패 시 R7 처리(degraded + fail-closed escalation) 발동 없이 완료 — 발동 시 사용자 승인 필요
