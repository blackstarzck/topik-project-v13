# Workflow 4-Gate Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 영상 AI 워크플로우와 Codex 분석의 토론 합의안 — Light Spec / Plan Cuts+SBU / Subagent-eligible / Architecture Pass 4게이트 + Cross-model review 의무화 — 를 이 저장소에 문서 + 검사 스크립트 + CI 3층으로 박는다.

**Architecture:** 기존 `scripts/ai-workflow-check.mjs`의 함수형 검사 패턴(`assert/strict` 단위 자가 테스트, `internals` export, `checkRepositoryState({ changedFiles })`)을 그대로 따라 4개 새 검사 함수를 추가한다. CI는 기존 `.github/workflows/ai-workflow-check.yml`이 확장된 검사기를 그대로 실행하므로 워크플로우 파일 자체는 손대지 않는다. 문서는 기존 `docs/` 구조에 5개 파일을 신규/변경한다. 별도 `docs/domain/` 디렉토리나 `plan-review-template.md`는 만들지 않는다(정본 중복/중복 스킬 위험).

**Tech Stack:** Node.js (ESM), `node:assert/strict`, 기존 `ai-workflow-check.mjs` 모듈 패턴.

---

## Docs Consulted

- `AGENTS.md` — "no fresh grill-me for covered scope" 규칙 유지 확인
- `docs/ai-development-workflow.md` — 기존 워크플로우 전체 구조와 fallback matrix
- `docs/ai-workflow/context-ledger-template.md` — ledger 필수 섹션 확인
- `scripts/ai-workflow-check.mjs` — 검사기 함수 시그니처와 export 패턴
- `scripts/ai-workflow-check.selftest.mjs` — 단위 테스트 패턴(`withTempRepo`)
- `docs/ai-workflow/plans/20260520-development-phases-and-bootstrap.md` — Phase Contract 표 구조 (Architecture Pass 항목 삽입 위치)
- `C:/Users/admin/Downloads/workflow-comparison-report.html` — 합의안 §6 (5개 변경 / 유지 / 제외)

## Out of Scope — Intentional Cuts

| 제외 항목 | 이유 |
| --- | --- |
| `AGENTS.md`의 "no fresh grill-me" 규칙 수정 | 사용자 결정으로 covered scope 정책 유지 |
| 신규 `docs/domain/` 디렉토리 신설 | 정본이 `docs/IA`, `docs/prd.md`와 중복되어 동기화 깨질 위험 |
| 신규 `plan-review-template.md` | 기존 `plan-eng-review` 스킬이 동일 역할 |
| `.claude/settings.json` hook 추가 | 사용자 답변 — 이번 PR은 "문서 + 스크립트 + CI"까지만. hook은 향후 별도 검토 |
| Light Spec을 모든 작업에 의무화 | phase 단위 작업에서만 의무. tiny docs/config 변경은 lightweight path 유지 |
| 매 작업 그릴미 의무화 | 영상식 원형은 net-new scope에서만 적용 |
| 기존 Plans 폴더의 다른 plan 일괄 보강 | 이 PR은 검사기 도입까지. 기존 plan은 이후 자연 업데이트 시 보강 |

## Smallest Buildable Unit

검사기 단독 — `scripts/ai-workflow-check.mjs` + `scripts/ai-workflow-check.selftest.mjs`에 4게이트 + cross-model review 검사 함수 5개를 추가하고 selftest로 RED→GREEN을 끝까지 통과시킨 상태. 이 단위만 있어도 PR 차단 효과가 즉시 발생하며, docs 갱신은 후속 task에서 같은 PR 내에 이어 붙인다.

## File Structure

| Path | Responsibility |
| --- | --- |
| `docs/domain-glossary.md` (신규) | 도메인 용어 단일 진입점. 정의 중복 없이 `docs/prd.md`, `docs/IA/*`, `docs/flow/user-flow.md`의 정본 위치로 라우팅. 모듈 경계는 코드 폴더 구조가 정본임을 명시. |
| `docs/ai-workflow/light-specs/README.md` (신규) | 라이트 스펙 6섹션 가이드(핵심 기능 / 제외 기능 / 최소 동작 / 사용자 흐름 / 도메인 경계 / 성공 조건). 작성 시점·파일명 규칙·1쪽 분량 제약 명시. |
| `docs/ai-workflow/plans/README.md` (신규 또는 갱신) | Plan 템플릿 필수 섹션: `## Docs Consulted`, `## Out of Scope — Intentional Cuts`, `## Smallest Buildable Unit`, `## File Structure`, task 표 컬럼에 `Subagent-eligible? (Y/N + reason)` 필수. |
| `docs/ai-development-workflow.md` (변경) | "1b. Light Spec 작성" 절 추가, "3. Use Codex And Claude Together"의 "가용 시" 표현을 "기본 의무, 부재 시 degraded 명시"로 강화, implementation 절에 "Subagent-eligible=Y task는 task packet으로 분산"을 명시, Phase Completion Gate에 "Architecture Pass" 추가 안내. |
| `docs/ai-workflow/plans/20260520-development-phases-and-bootstrap.md` (변경) | Phase Contract 표의 Completion Gate 컬럼 각 행 끝에 "Architecture Pass 통과" 항목 추가. |
| `scripts/ai-workflow-check.mjs` (변경) | 5개 새 export 함수 추가: `checkPlanFile(text, path)`, `checkLightSpecPresence(root, ledgerText)`, `checkLedgerReviewer(text)`, `checkLedgerArchitecturePass(text, phaseComplete)`, `checkPhasePlanArchitectureGate(text)`. `checkRepositoryState`가 changed files를 분석해 적절한 검사 함수를 호출. `internals` export에 추가. |
| `scripts/ai-workflow-check.selftest.mjs` (변경) | 위반 fixture 5종 + 정상 케이스 5종을 추가하는 단위 테스트. 기존 `withTempRepo` 헬퍼를 재사용. |

## Tasks

| # | Task | Files | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- |
| 1 | Plan 자체에 ledger 링크 추가 + ledger 초기 작성 | ledger md | N — 이미 main session에서 완료 |
| 2 | Codex(GPT 5.5) plan 리뷰 의뢰 | (외부 스킬 호출) | N — 외부 모델 호출, main session이 packet 작성 |
| 3 | 리뷰 반영 (필요 시 plan 보강) | plan md | N — 리뷰 결과에 따라 main session 직접 |
| 4 | 검사기 RED: selftest에 7+게이트 위반 fixture 추가 (Codex 리뷰 반영) | `scripts/ai-workflow-check.selftest.mjs` | N — Task 5와 export 이름/에러 문자열로 강결합. 단일 owner 순차 |
| 5 | 검사기 GREEN: 5개 새 검사 함수 + dispatch 로직 구현 (의미 강화) | `scripts/ai-workflow-check.mjs` | N — Task 4와 묶음 |
| 5b | context-ledger-template.md에 Cross-model review / Architecture Pass placeholder 추가 (Codex P1-D 반영) | `docs/ai-workflow/context-ledger-template.md` | Y — 독립 문서, 다른 파일과 독립 |
| 6 | 신규 문서 2개 작성 | `docs/domain-glossary.md`, `docs/ai-workflow/light-specs/README.md` | Y — 독립 문서, 다른 파일 의존 없음 |
| 7 | Plans README 작성(또는 갱신) | `docs/ai-workflow/plans/README.md` | Y — 독립 문서 |
| 8 | `ai-development-workflow.md` 4부분 보강 | `docs/ai-development-workflow.md` | N — 다른 변경과 정합성 동시 점검 필요 |
| 9 | Phase plan에 Architecture Pass 항목 추가 | `docs/ai-workflow/plans/20260520-development-phases-and-bootstrap.md` | Y — Phase Contract 표만 변경 |
| 10 | 통합 검증: `node scripts/ai-workflow-check.selftest.mjs` + `node scripts/ai-workflow-check.mjs --repo .` | (전체) | N — main session이 결과 분석/통합 |
| 11 | Cross-model 정합성 검사 (Opus + Codex 병렬) | (전체) | Y — 두 모델 병렬 |
| 12 | 최종 HTML 보고서 작성 | `C:/Users/admin/Downloads/workflow-4gate-enforcement-report.html` | N — 결과 통합 출력 |

---

### Task 4: 검사기 RED — selftest에 위반 fixture 추가

**Files:**
- Modify: `scripts/ai-workflow-check.selftest.mjs`

새 검사 함수 5개에 대응하는 fail/pass 케이스를 추가한다. 함수가 아직 존재하지 않으므로 import에서 즉시 실패하며, 이게 RED 상태이다.

- [ ] **Step 1: 검사 함수 import 추가**

```js
import {
  checkCommitMessage,
  checkPullRequestBody,
  checkRepositoryState,
  checkPlanFile,
  checkLedgerReviewer,
  checkLedgerArchitecturePass,
  checkPhasePlanArchitectureGate,
  checkLightSpecPresence,
} from "./ai-workflow-check.mjs";
```

- [ ] **Step 2: 위반/정상 케이스 8개 추가 (selftest 하단)**

```js
async function testPlanFileRequiresCutsAndSbuAndSubagentColumn() {
  const validPlan = [
    "# Plan",
    "## Out of Scope — Intentional Cuts",
    "- 이유와 함께",
    "## Smallest Buildable Unit",
    "- 최소 단위",
    "## Tasks",
    "| # | Task | Files | Subagent-eligible? (Y/N + reason) |",
    "| --- | --- | --- | --- |",
    "| 1 | ... | ... | Y — reason |",
  ].join("\n");
  assert.equal(checkPlanFile(validPlan, "docs/ai-workflow/plans/x.md").ok, true);

  const missingCuts = checkPlanFile(
    "# Plan\n## Smallest Buildable Unit\n- x\n",
    "docs/ai-workflow/plans/x.md",
  );
  assert.equal(missingCuts.ok, false);
  assert.ok(
    missingCuts.errors.some((e) =>
      e.includes("Out of Scope — Intentional Cuts"),
    ),
  );

  const missingSbu = checkPlanFile(
    "# Plan\n## Out of Scope — Intentional Cuts\n- x\n",
    "docs/ai-workflow/plans/x.md",
  );
  assert.equal(missingSbu.ok, false);
  assert.ok(
    missingSbu.errors.some((e) => e.includes("Smallest Buildable Unit")),
  );

  const missingColumn = checkPlanFile(
    [
      "# Plan",
      "## Out of Scope — Intentional Cuts",
      "- x",
      "## Smallest Buildable Unit",
      "- y",
      "| # | Task | Files |",
      "| --- | --- | --- |",
    ].join("\n"),
    "docs/ai-workflow/plans/x.md",
  );
  assert.equal(missingColumn.ok, false);
  assert.ok(
    missingColumn.errors.some((e) => e.includes("Subagent-eligible")),
  );
}

async function testLedgerReviewerFieldRequired() {
  const valid = "## Verification State\nCross-model review: codex (gstack)\n";
  assert.equal(checkLedgerReviewer(valid).ok, true);

  const degraded = "## Verification State\nCross-model review: degraded — codex unavailable\n";
  assert.equal(checkLedgerReviewer(degraded).ok, true);

  const missing = "## Verification State\nChecks run: none\n";
  const r = checkLedgerReviewer(missing);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("Cross-model review")));
}

async function testLedgerArchitecturePassRequiredWhenPhaseComplete() {
  const valid = "Architecture Pass: passed\n";
  assert.equal(checkLedgerArchitecturePass(valid, true).ok, true);

  const skipped = "Architecture Pass: skipped — non-implementation phase\n";
  assert.equal(checkLedgerArchitecturePass(skipped, true).ok, true);

  const missing = "Status: complete\n";
  const r = checkLedgerArchitecturePass(missing, true);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("Architecture Pass")));

  // phase not complete → field not required yet
  assert.equal(checkLedgerArchitecturePass(missing, false).ok, true);
}

async function testPhasePlanArchitectureGateRequired() {
  const valid = [
    "| Phase | Name | Scope | Completion Gate |",
    "| 1 | App Foundation | ... | tests pass + Architecture Pass |",
  ].join("\n");
  assert.equal(checkPhasePlanArchitectureGate(valid).ok, true);

  const missing = [
    "| Phase | Name | Scope | Completion Gate |",
    "| 1 | App Foundation | ... | tests pass |",
  ].join("\n");
  const r = checkPhasePlanArchitectureGate(missing);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("Architecture Pass")));
}

async function testLightSpecPresenceCheckedForPhaseLedgers() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "light-specs"), {
      recursive: true,
    });

    // ledger references a phase but light-spec missing
    const ledgerWithoutLS = "Phase: 4-learning-core\nLight Spec: docs/ai-workflow/light-specs/phase-4-learning-core.md\n";
    const r1 = await checkLightSpecPresence(root, ledgerWithoutLS);
    assert.equal(r1.ok, false);
    assert.ok(r1.errors.some((e) => e.includes("light spec file does not exist")));

    // create it
    await writeFile(
      join(root, "docs", "ai-workflow", "light-specs", "phase-4-learning-core.md"),
      "# Phase 4\n",
    );
    const r2 = await checkLightSpecPresence(root, ledgerWithoutLS);
    assert.equal(r2.ok, true);

    // ledger without Light Spec reference is allowed (non-phase work)
    const r3 = await checkLightSpecPresence(root, "Status: active\n");
    assert.equal(r3.ok, true);
  });
}

await testPlanFileRequiresCutsAndSbuAndSubagentColumn();
await testLedgerReviewerFieldRequired();
await testLedgerArchitecturePassRequiredWhenPhaseComplete();
await testPhasePlanArchitectureGateRequired();
await testLightSpecPresenceCheckedForPhaseLedgers();
```

- [ ] **Step 3: RED 실행 확인**

Run: `node scripts/ai-workflow-check.selftest.mjs`
Expected: FAIL — `SyntaxError`/`ReferenceError` from missing imports (`checkPlanFile is not exported`)

- [ ] **Step 4: 커밋하지 않음 (Task 5 GREEN까지 묶어 커밋)**

---

### Task 5: 검사기 GREEN — 5개 검사 함수 + dispatch 구현

**Files:**
- Modify: `scripts/ai-workflow-check.mjs`

기존 `internals` export 패턴과 `okResult`, `sectionContent` 헬퍼를 재사용해 5개 함수를 같은 모듈 안에 추가한다.

- [ ] **Step 1: 새 헬퍼/패턴 상수 추가 (파일 상단)**

```js
const REQUIRED_PLAN_SECTIONS = [
  "## Out of Scope — Intentional Cuts",
  "## Smallest Buildable Unit",
];

const SUBAGENT_COLUMN_PATTERN = /Subagent-eligible/i;
const ARCH_PASS_PATTERN = /Architecture Pass:\s*\S+/i;
const REVIEWER_PATTERN = /Cross-model review:\s*\S+/i;
const PHASE_GATE_ARCH_PASS_PATTERN = /Architecture Pass/i;
const LIGHT_SPEC_REF_PATTERN = /Light Spec:\s*(\S+\.md)/i;
```

- [ ] **Step 2: `checkPlanFile` 구현**

```js
export function checkPlanFile(text, path = "<plan>") {
  const errors = [];
  for (const section of REQUIRED_PLAN_SECTIONS) {
    if (sectionContent(text, section) === null) {
      errors.push(`plan ${path} missing required section: ${section}`);
    }
  }
  // task table header containing Subagent-eligible column
  const hasTaskTable = /^\|.*\|\s*$/m.test(text);
  if (hasTaskTable && !SUBAGENT_COLUMN_PATTERN.test(text)) {
    errors.push(
      `plan ${path} task table must include a 'Subagent-eligible? (Y/N + reason)' column`,
    );
  }
  return okResult(errors);
}
```

- [ ] **Step 3: `checkLedgerReviewer`, `checkLedgerArchitecturePass`, `checkPhasePlanArchitectureGate` 구현**

```js
export function checkLedgerReviewer(text) {
  const errors = [];
  if (!REVIEWER_PATTERN.test(text)) {
    errors.push(
      "ledger missing 'Cross-model review:' field (use 'degraded — <reason>' if unavailable)",
    );
  }
  return okResult(errors);
}

export function checkLedgerArchitecturePass(text, phaseComplete = false) {
  const errors = [];
  if (phaseComplete && !ARCH_PASS_PATTERN.test(text)) {
    errors.push(
      "ledger for completed phase missing 'Architecture Pass:' field (passed/failed/skipped(<reason>))",
    );
  }
  return okResult(errors);
}

export function checkPhasePlanArchitectureGate(text) {
  const errors = [];
  if (!PHASE_GATE_ARCH_PASS_PATTERN.test(text)) {
    errors.push(
      "phase plan Completion Gate column must include 'Architecture Pass' for each phase",
    );
  }
  return okResult(errors);
}
```

- [ ] **Step 4: `checkLightSpecPresence` 구현**

```js
export async function checkLightSpecPresence(root, ledgerText) {
  const errors = [];
  const match = ledgerText.match(LIGHT_SPEC_REF_PATTERN);
  if (!match) return okResult(errors); // not a phase ledger; allowed
  const referenced = match[1];
  const exists = await fileExists(root, referenced);
  if (!exists) {
    errors.push(`light spec file does not exist: ${referenced}`);
  }
  return okResult(errors);
}
```

- [ ] **Step 5: `checkRepositoryState` 내부에서 변경된 plan/ledger 파일 자동 분석**

기존 `validateLedger` 호출 직후 같은 ledger에 대해 `checkLedgerReviewer`와 (phase complete 마커가 있을 때) `checkLedgerArchitecturePass`를 호출. 변경 파일 중 `^docs/ai-workflow/plans/.*\.md$`는 `checkPlanFile`로 보내고, `^docs/ai-workflow/plans/20260520-development-phases-and-bootstrap.md$`는 추가로 `checkPhasePlanArchitectureGate`까지 호출.

```js
async function validatePlanFile(root, planPath, errors) {
  const content = await readFile(join(root, planPath), "utf8");
  const result = checkPlanFile(content, planPath);
  if (!result.ok) errors.push(...result.errors);

  if (/development-phases-and-bootstrap\.md$/.test(planPath)) {
    const r = checkPhasePlanArchitectureGate(content);
    if (!r.ok) errors.push(...r.errors);
  }
}
```

그리고 `validateLedger` 끝부분에:

```js
const reviewer = checkLedgerReviewer(content);
if (!reviewer.ok) errors.push(...reviewer.errors);

const phaseComplete = /Status:\s*complete/i.test(content);
const arch = checkLedgerArchitecturePass(content, phaseComplete);
if (!arch.ok) errors.push(...arch.errors);

const ls = await checkLightSpecPresence(root, content);
if (!ls.ok) errors.push(...ls.errors);
```

그리고 `checkRepositoryState` 안 (ledger 처리 직후):

```js
for (const file of files) {
  if (/^docs\/ai-workflow\/plans\/.+\.md$/.test(file) && (await fileExists(resolvedRoot, file))) {
    await validatePlanFile(resolvedRoot, file, errors);
  }
}
```

- [ ] **Step 6: `internals` export 갱신**

```js
export const internals = {
  REQUIRED_PR_SECTIONS,
  REQUIRED_GIT_DECISION_FIELDS,
  REQUIRED_LORE_TRAILERS,
  REQUIRED_LEDGER_SECTIONS,
  REQUIRED_PLAN_SECTIONS,
  needsLedger,
  sectionContent,
};
```

- [ ] **Step 7: GREEN 실행 확인**

Run: `node scripts/ai-workflow-check.selftest.mjs`
Expected: PASS — "ai-workflow-check self-test passed"

- [ ] **Step 8: 커밋**

```bash
git add scripts/ai-workflow-check.mjs scripts/ai-workflow-check.selftest.mjs
git commit -m "feat(workflow): add 4-gate enforcement checks to ai-workflow-check"
```

---

### Task 6: 신규 문서 2개

**Files:**
- Create: `docs/domain-glossary.md`
- Create: `docs/ai-workflow/light-specs/README.md`

- [ ] **Step 1: `docs/domain-glossary.md` 작성 — 정의 중복 없이 라우팅만**

내용 헤더 예시:

```markdown
# Domain Glossary

이 문서는 정의가 아니라 정본 위치 라우팅 인덱스입니다. 모든 정의는 아래 가리키는 문서에 있습니다.

| 용어 | 정본 위치 | 한 줄 요약 |
| --- | --- | --- |
| 학습 목표 | docs/IA/learning-goals/description.md | … |
| 문제 풀이 | docs/IA/problem-solving/description.md | … |
| ... | ... | ... |

## 모듈 경계

모듈 경계의 정본은 코드의 폴더 구조(예: `src/learning/`, `src/writing/`, `src/feedback/`)이다.
```

- [ ] **Step 2: `docs/ai-workflow/light-specs/README.md` 작성**

6섹션 의무: 핵심 기능 / 제외 기능 / 최소 동작 / 사용자 흐름 / 도메인 경계 / 성공 조건. 분량 1쪽 이내, 작성 시점은 phase 시작 시, 파일명은 `phase-{n}-{slug}.md`.

- [ ] **Step 3: 커밋**

```bash
git add docs/domain-glossary.md docs/ai-workflow/light-specs/README.md
git commit -m "docs(workflow): add domain glossary and light-specs guide"
```

---

### Task 7: Plans README — 필수 섹션·컬럼 명시

**Files:**
- Create or modify: `docs/ai-workflow/plans/README.md`

- [ ] **Step 1: 필수 섹션과 task 표 컬럼 명세 작성**

```markdown
# Plans Directory

플랜 파일명: `YYYYMMDD-<slug>.md`. 모든 plan은 다음 섹션을 의무로 갖는다.

## Required Sections

- `## Docs Consulted`
- `## Out of Scope — Intentional Cuts` (이유 포함)
- `## Smallest Buildable Unit`
- `## File Structure`
- Task 표 컬럼에 `Subagent-eligible? (Y/N + reason)` 포함

`scripts/ai-workflow-check.mjs`가 위 4개를 검증한다. 누락 시 CI 차단.
```

- [ ] **Step 2: 커밋**

```bash
git add docs/ai-workflow/plans/README.md
git commit -m "docs(workflow): document required plan sections and subagent column"
```

---

### Task 8: `ai-development-workflow.md` 4부분 보강

**Files:**
- Modify: `docs/ai-development-workflow.md`

- [ ] **Step 1: "1. Frame The Work" 끝에 "1b. Light Spec" 절 삽입**

phase 단위 작업에서 의무. 1쪽 분량. 6섹션.

- [ ] **Step 2: "3. Use Codex And Claude Together"의 "When both ... are available" 표현을 강화**

→ "Cross-model review is mandatory. When only one model is available, record `Cross-model review: degraded — <reason>` in the ledger."

- [ ] **Step 3: "3b. Multi-Agent Context Management" 끝에 Subagent-eligible 분산 규칙 한 단락 추가**

main session은 plan의 task 표에서 `Subagent-eligible? = Y` 항목을 task packet으로 분산. N 항목은 main 직접.

- [ ] **Step 4: "4. Review Gate" 이후에 Architecture Pass 단락 추가**

phase 완료 직전 게이트로 명시: route 비즈 로직 누수, 폴더/이름 ↔ docs 일치, 동일 개념 분산 점검.

- [ ] **Step 5: 커밋**

```bash
git add docs/ai-development-workflow.md
git commit -m "docs(workflow): mandate light-spec, cross-model review, and architecture pass"
```

---

### Task 9: Phase plan Architecture Pass 항목 추가

**Files:**
- Modify: `docs/ai-workflow/plans/20260520-development-phases-and-bootstrap.md`

- [ ] **Step 1: Phase Contract 표의 Completion Gate 컬럼 각 행 끝에 "+ Architecture Pass" 추가**

- [ ] **Step 2: 커밋**

```bash
git add docs/ai-workflow/plans/20260520-development-phases-and-bootstrap.md
git commit -m "docs(workflow): add architecture pass to phase completion gates"
```

---

### Task 10: 통합 검증

- [ ] **Step 1: `node scripts/ai-workflow-check.selftest.mjs` — 모든 케이스 통과 확인**

- [ ] **Step 2: `node scripts/ai-workflow-check.mjs --repo .` — false-positive 없이 통과 확인**
  - 만약 현재 ledger 자체가 `Cross-model review:` 또는 `Architecture Pass:` 검증에 걸리면, ledger를 같은 PR에서 보강(이 plan에 따라 task 11 결과를 ledger에 적어 통과시킴).

- [ ] **Step 3: 결과를 ledger의 Verification State에 기록**

---

### Task 11: Cross-model 정합성 검사 (Opus + Codex 병렬)

- [ ] **Step 1: codex 스킬에 정합성 task packet 전달**

packet 내용:
- 변경 파일 목록
- 합의안 §6의 5개 변경 항목
- 확인할 정합성 5가지: (a) 검사기 함수 시그니처 일관성, (b) 검사기 메시지 ↔ 문서 표현 일관성, (c) plan README ↔ 검사기 검사항목 일관성, (d) ai-development-workflow.md ↔ ledger 템플릿 일관성, (e) light-specs README ↔ 검사기 light-spec 검사 로직 일관성

- [ ] **Step 2: 동시에 Opus subagent에 동일 task packet 전달 (Agent 도구)**

- [ ] **Step 3: 두 result packet을 ledger에 통합**

---

### Task 12: 최종 HTML 보고서

- [ ] **Step 1: `C:/Users/admin/Downloads/workflow-4gate-enforcement-report.html` 작성**

섹션: 합의 요약 / 진행 단계 / Codex plan 리뷰 결과 / 변경 파일 / 검사기 fixture 5종 통과 증거 / Opus+Codex 정합성 검사 결과 / 잔여 위험 / 다음 단계

- [ ] **Step 2: ledger Verification State 최종 마감**

- [ ] **Step 3: 사용자에게 HTML 경로 보고**

---

## Verification Strategy

- 단위: `node scripts/ai-workflow-check.selftest.mjs`
- 통합: `node scripts/ai-workflow-check.mjs --repo .`
- 회귀: 기존 selftest 케이스 4개가 그대로 통과해야 함 (`testPullRequestBodyRequiresEvidenceSections`, `testRepositoryStateRequiresLedgerWhenImplementationFilesChange`, `testRepositoryStateRunsAgentSkillMirrorCheck`, `testCommitMessageRequiresLoreTrailers`)
- Lint/typecheck/build: `src/` 부재로 미실행 (Phase 1 진입 후 자연 적용)

## Risks

- 새 검사가 너무 엄격해 lightweight path 작업까지 fail시킬 가능성 → ledger의 phase complete 마커 없을 때 Architecture Pass 면제, plan 검사는 `docs/ai-workflow/plans/` 아래에서만 동작 (그 외 위치의 임시 plan은 검사 안 함)
- 기존 Phase 1 plan이 새 필수 섹션 없으면 즉시 fail → 같은 PR에서 task 7~9로 보강
- codex 스킬 부재 시 Task 11이 degraded → ledger에 명시, PR에서는 Opus 단독 검사로 게이트 통과

---

## Codex (GPT 5.5) Review Findings & Revisions

`/codex consult` returned **VERDICT: FAIL** with 5 P1 + 3 P2 findings. All accepted. Plan revised below.

### Accepted Findings

- **[P1-A] `checkPlanFile` 약함** — 표가 없으면 Subagent-eligible 검사를 건너뛰고, Out of Scope/SBU 섹션이 빈 문자열이어도 통과하며, 행별 `Y/N + reason` 검증이 없음.
- **[P1-B] `checkLightSpecPresence` 핵심 게이트 누락** — phase ledger인데 `Light Spec:` 줄이 아예 없으면 통과해버림.
- **[P1-C] `checkPhasePlanArchitectureGate` 거짓 양성** — 본문 어디든 "Architecture Pass" 한 번 등장하면 통과. Phase Contract 표의 각 행 Completion Gate 셀별로 검증해야 함.
- **[P1-D] `context-ledger-template.md` 미갱신** — 새 검사가 `Cross-model review:`, `Architecture Pass:` 필드를 요구하는데 템플릿엔 없음. 템플릿 복사로 만든 ledger가 즉시 fail.
- **[P1-E] ledger 검사가 `needsLedger()` 안에 갇힘** — ledger만 변경하는 PR은 신규 검사 전체 우회.
- **[P2-F] `docs/domain-glossary.md` 인접 범위 침범** — `docs/domain/` 디렉토리는 아니지만 정본 중복 위험. 채택하되 라우팅-only 규칙을 acceptance criteria로 박음.
- **[P2-G] Task 4+5 둘 다 Subagent=Y는 부적절** — RED 테스트와 GREEN 구현이 export 이름·에러 문자열로 강결합. 한 owner 또는 순차 packet.
- **[P2-H] Task 12 HTML 보고서가 저장소 밖** — 합의 범위(docs+scripts+CI) 밖. 보고-전용으로 명시, 게이트와는 분리.

### 반영 사항 (변경 1: 신규 문서)

`docs/ai-workflow/context-ledger-template.md`를 변경 파일에 추가. 두 줄을 새로 의무 항목으로 박는다:

```
## Verification State
- Cross-model review: <reviewer name, or "degraded — <reason>">
- Architecture Pass: <passed | failed | skipped — <reason>>  # phase complete 시 필수
```

### 반영 사항 (변경 2: 검사기 의미 강화)

- `checkPlanFile`:
  - Out of Scope / SBU 섹션 본문이 공백/빈 줄만이면 fail (`sectionContent`가 trim 후 비어 있으면 reject)
  - `## Tasks` 헤더가 존재하는 plan에만 task 표 검사 적용 (tiny config plan 면제). `## Tasks`가 있으면 표 헤더 의무, 표 헤더에 `Subagent-eligible` 컬럼 의무.
  - 표 본문 각 행에서 마지막 컬럼이 `Y — <reason>` 또는 `N — <reason>` 형식인지 정규식 검사. 한 행이라도 reason 없으면 fail.
- `checkLightSpecPresence`:
  - 시그니처를 `(root, ledgerText, ledgerPath)`로 확장.
  - **트리거**: ledger 본문에 정규식 `/^Phase:\s*\S+/m` 매치 또는 ledger 파일명에 `phase-\d` 매치 시 phase ledger로 판정.
  - phase ledger인데 `Light Spec:` 줄이 없으면 fail. 있으면 해당 경로 존재 확인.
- `checkPhasePlanArchitectureGate`:
  - "## Phase Contract" 또는 동등 표 헤더(`| Phase |`)를 찾고, 그 표의 각 데이터 행에 대해 `Completion Gate` 컬럼 셀에 `Architecture Pass` 문자열이 포함됐는지 검증.
  - 컬럼 인덱스는 헤더 행을 파싱해 결정.
- `checkRepositoryState`:
  - **변경 파일 중 ledger 매치(`LEDGER_PATTERN`)는 항상** `validateLedger`로 분기 — `needsLedger()` 안쪽이 아니라 바깥 루프에서. ledger-only PR도 새 게이트를 통과해야 함.
  - 변경 파일 중 plan 매치도 동일하게 항상 분기.

### 반영 사항 (변경 3: 문서·작업 분배)

- **Task 6**의 `docs/domain-glossary.md` acceptance criteria에 다음 추가: "본문 정의 0개, 모든 셀은 정본 위치의 헤더 링크/앵커만 허용. PR 리뷰에서 정의 추가 발견 시 reject."
- **Task 4 + Task 5**를 단일 owner 작업으로 결합 표시(둘 다 Subagent-eligible=N). 또는 RED를 main session이 직접 작성하고 GREEN만 subagent에 위임 가능. plan task 표를 그렇게 갱신.
- **Task 12**는 게이트가 아니라 **선택적 보고 산출물**로 표시. acceptance criteria에서 제외. 단, 사용자 요청으로 작성은 유지(이번 작업의 마지막 단계 — HTML 보고).

### 반영 사항 (변경 4: 새 selftest 케이스 5개 추가)

P1-A~E에 정확히 대응하는 fixture를 추가:

- empty-cuts-section.md → fail "Out of Scope ... is empty"
- plan-with-tasks-but-missing-column → fail "Subagent-eligible"
- subagent-row-missing-reason → fail "must include reason"
- phase-ledger-without-light-spec-line → fail "Light Spec: field required"
- phase-plan-row-without-arch-pass → fail "Completion Gate cell for phase X missing"
- ledger-only-change-with-missing-fields → fail (regardless of needsLedger)
- context-ledger-template 자체가 변경 파일 목록에 있어도 fixture로는 통과해야 함 (템플릿은 placeholder를 포함)

### 최종 verdict 기록

- Codex initial: FAIL (8 findings)
- After plan revision: 모든 P1 반영. P2 3건 중 2건 반영, 1건(Task 12)은 사용자 요청에 따라 보고-전용으로 유지 + scope 명시.
- 재리뷰는 Task 11(병렬 정합성 검사) 단계에서 자동 수행.
