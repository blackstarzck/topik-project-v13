# Plan — UX/UI Consistency Pass 신설 (PR B, rev2)

## Metadata

- Created: 2026-05-22 22:00 KST
- Revised: 2026-05-22 22:30 KST (Codex plan-eng-review round 1: CONCERN, 모든 층 수정)
- Author: Claude Opus 4.7
- Plan audience: n/a — 본 PR은 게이트 정의 워크플로 변경. **게이트가 적용될 대상 PR의 audience는 그 PR의 Light Spec/plan이 명시** (user/admin/both).
- Triggers: PR A 확장 ledger (`20260522-1900-pr-a-extension-after-codex-review.md`) follow-up.
- Codex round 1 CONCERN 핵심: "현재 plan은 검수 게이트가 아니라 ledger에 한 줄 쓰게 하는 장치 — 빈 도장칸". 모든 층 수정으로 (a) PASS 기준 정본 명시, (b) 4줄 증거 필드, (c) UI 감지 범위 확대, (d) SBU에 checker 포함, (e) Phase 6 retroactive 회피, (f) negative test 확장 반영.

## Problem Statement

PR A로 audience(user/admin/both) 워크플로 분기가 정착됐다. 그러나 UI/UX 게이트는 두 시점(`plan-design-review` 사전 / 화면 QA 사후)만 강제하고, 그 사이 "디자인 시스템 일관성 자체"를 보는 게이트가 없다. 결과: 토큰 비준수·컴포넌트 fragmentation·a11y 누락·반응형 매트릭스 누락이 phase가 늘수록 누적된다.

단순 ledger 필드 추가는 "빈 도장칸"이 된다 (Codex round 1 비판). 그래서 본 plan은 ① 4개 체크 각각에 **정본 문서 경로 + 최소 PASS 기준**을 명시하고, ② ledger 필드를 4줄 증거 구조로 강제하며, ③ checker가 UI 변경 PR에서 그 형식까지 자동 검사한다. 게이트 위치는 **UI 구현 완료 후, browser/visual QA 전 사전 점검**으로 고정.

## Acceptance Criteria

- `docs/ai-workflow/review-gates.md`에 새 `## UX/UI Consistency Pass` 섹션:
  - 4개 체크(Tokens / Components / A11y / Responsive) 각각 **정본 문서 경로 + 최소 PASS 기준 + skipped 허용 사유 목록** 명시.
  - 게이트 위치 명확화: UI 구현 완료 후, browser/visual QA 전 사전 점검. Architecture Pass와 차이(visual/system consistency vs code boundary/audience) 한 문단.
  - 기존 `QA Gate`의 "responsive layout when UI changed"와의 경계(QA는 실행 검증, UX/UI Pass는 사전 일관성 점검) 한 문단.
- `docs/ai-workflow/context-ledger-template.md`의 `## Verification State`에 4줄 증거 구조 필드:
  ```
  - UX/UI Consistency Pass: passed | failed | skipped — <reason>
    - Tokens: passed | failed | skipped — <reason> | <근거 1줄: 정본 문서 + 검토 결과>
    - Components: passed | failed | skipped — <reason> | <근거 1줄>
    - A11y: passed | failed | skipped — <reason> | <근거 1줄>
    - Responsive: passed | failed | skipped — <reason> | <근거 1줄>
  ```
- `scripts/ai-workflow-check.mjs`:
  - UI 변경 감지 패턴 확장: `src/app/**`, `src/components/**`, `src/features/**`, `src/lib/ui/**`, `src/styles/**`, `**/*.css`, `**/*.scss`, `**/theme*`, `**/globals.css`, `tailwind.config.*`, `postcss.config.*`, `public/icons/**`, `public/images/**`.
  - UI 변경 PR에서 ledger에 `UX/UI Consistency Pass:` 부모 필드 + 4개 하위 필드(Tokens/Components/A11y/Responsive) 모두 존재 + 비어 있지 않음 강제. 누락 시 FAIL with 어느 하위 필드가 없는지 명시.
  - `skipped`는 사유 비어 있으면 FAIL.
  - false positive 면제: 변경 파일이 `**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`, `**/*.d.ts`, `**/*.types.ts`로만 구성되면 게이트 면제 (skipped — test/types-only 허용).
- `docs/ai-development-workflow.md` Core Invariants에 한 줄 추가 (Task 1 게이트 정의 완료 후).
- 회귀 테스트: **Phase 6 ledger 수정 대신** `docs/ai-workflow/fixtures/uxui-consistency-pass/` 아래 5개 fixture ledger 만들기:
  - `fx-01-passes.md` (4줄 모두 채움) → PASS
  - `fx-02-missing-field.md` (UX/UI Consistency Pass 부모 필드 자체 없음) → FAIL
  - `fx-03-empty-value.md` (부모는 있고 하위 4개 비움) → FAIL
  - `fx-04-skipped-no-reason.md` (`skipped` 단독, 사유 없음) → FAIL
  - `fx-05-test-only-change.md` (변경이 `**/*.test.*`만, UX/UI 필드 없음) → PASS (면제)
- Phase 6 ledger는 **건드리지 않음** (history 보존). 게이트 도입 시점 이후의 새 ledger부터 적용.

## Docs Consulted

- 정본 (4개 체크의 PASS 기준 입력):
  - `docs/ant-design/01-design-values.md` (디자인 가치 — Components 체크 입력)
  - `docs/ant-design/02-global-styles.md` (글로벌 토큰 — Tokens 체크 정본)
  - `docs/ant-design/03-patterns-and-components.md` (컴포넌트 패턴 — Components 체크 정본)
  - `docs/ant-design/05-visual-motion-illustration.md` (모션·일러스트 — Components 체크 보조)
  - `docs/ant-design/07-review-checklist.md` (리뷰 체크리스트 — A11y + 전반 체크 정본)
  - `docs/ant-design/08-theme-architecture.md` (테마 아키텍처 — Tokens 체크 정본)
- 워크플로 구조 참고:
  - `docs/ai-workflow/review-gates.md` (Architecture Pass · QA Gate와의 경계)
  - `docs/ai-workflow/context-ledger-template.md` (필드 추가 위치)
  - `docs/ai-workflow/planning-contracts.md` (게이트와 Light Spec 연결)
  - `scripts/ai-workflow-check.mjs` (Audience 자동 검사 패턴 참고)
- 직전 결정 기록:
  - `docs/ai-workflow/runs/2026/05/22/20260522-2100-codex-decision-on-pr-a-checklist.md` (Codex 위임)
  - `tasks/biwc7mtnx.output` (Codex round 1 plan-eng-review CONCERN 출력)

## Out of Scope — Intentional Cuts

- **자동 토큰 lint** (stylelint, custom AST 검사): 본 PR은 수동 게이트 + 정본 참조만. 자동 위반 탐지는 별도 PR. **이유**: 토큰 명세 안정화 + false positive 캘리브레이션 필요.
- **a11y 자동 테스트 도구 통합** (axe-core, playwright-axe): 게이트 정의만. 도구 통합은 별도 PR. **이유**: 도구 선택·CI 통합이 phase급.
- **반응형 자동 스크린샷 / visual regression baseline**: 수동 체크리스트. **이유**: baseline 운영 부담.
- **admin 전용 디자인 토큰 분기**: user/admin 공통 토큰 전제. **이유**: 디자인 측 합의 전 분기는 fragmentation 가속.
- **Storybook / 디자인 시스템 카탈로그**: 본 PR 범위 밖. **이유**: 게이트 정의와 직교.
- **per-page design owner approval workflow** (Codex 권고 OOS): 페이지별 디자인 owner 승인 자동화. **이유**: 조직/role 정의 의존, 디자인팀 합의 필요.
- **component inventory 자동 생성**: 어떤 컴포넌트가 어디에 쓰이는지 자동 추출. **이유**: 별도 도구 + 별도 PR.
- **full WCAG certification 자동 검증**: 본 PR은 최소 a11y만(키보드·라벨·대비·focus visible). 전체 WCAG는 별도 PR.
- **Phase 6 ledger retroactive 채움**: history 보존 위해 fixture로 대체.
- **이전 미해결 항목** (P0 pre-implementation 단언, P1 AGENTS↔CLAUDE drift, P1 doc↔code reconcile, P2 Node 정렬, P2 degraded 감사): 본 PR과 무관.

## Smallest Buildable Unit

**Task 1 + Task 2 + Task 3** = 진짜 작동 unit.
- Task 1: 게이트 정의 (정본 + 최소 기준) — 사람이 게이트 의미 파악.
- Task 2: ledger 4줄 증거 형식 — 작성자가 어떤 증거를 남길지 정함.
- Task 3: checker 자동 강제 — 사람이 안 쓰면 PR 막힘.

이 셋이 없으면 "게이트가 작동"하지 않는다(Codex round 1 비판). Task 4(fixture 회귀), Task 5(Core Invariants), Task 6(ledger + 보고서)은 SBU 외부.

## Tasks

| # | Task | Files | Audience | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- | --- |
| 1 | `## UX/UI Consistency Pass` 섹션 정의 — 4개 체크 × (정본 경로 + 최소 PASS 기준 + skipped 허용 사유) + 게이트 위치 + QA/Architecture Pass와의 경계 | `docs/ai-workflow/review-gates.md` | n/a | N — 다른 task와 용어 일관성 필요, 단일 owner |
| 2 | ledger 템플릿에 4줄 증거 구조 필드 추가 + 예시 | `docs/ai-workflow/context-ledger-template.md` | n/a | N — Task 1의 표현과 정확히 일치해야, 단일 owner |
| 3 | `ai-workflow-check.mjs`에 UI 감지 패턴 확장 + UX/UI Consistency Pass 4줄 증거 형식 자동 검사 + test/types-only 면제 룰 | `scripts/ai-workflow-check.mjs` | n/a | N — Task 1/2 값 형식에 강하게 의존 |
| 4 | fixture-based 회귀 — `docs/ai-workflow/fixtures/uxui-consistency-pass/` 아래 5개 fixture (PASS 1, FAIL 3, exempt 1) + checker가 각 fixture에 대해 예상 결과 내는지 확인 | `docs/ai-workflow/fixtures/uxui-consistency-pass/*.md`, (선택) `scripts/test-uxui-fixtures.mjs` | n/a | Y — Task 1-3 완료 후 독립 적용 |
| 5 | `ai-development-workflow.md` Core Invariants에 한 줄 + Lane Selection의 UI/flow 행에 게이트 참조 추가 | `docs/ai-development-workflow.md` | n/a | Y — Task 1 완료 후 단순 추가 |
| 6 | 새 ledger + checker PASS 최종 확인 + 검토 HTML 보고서 (`reports/pr-b-uxui-consistency-pass-review.html`) | `docs/ai-workflow/runs/2026/05/22/...`, `reports/*` | n/a | N — 통합 작업, 단일 owner |

의존성: Task 1 → 2 → 3 (강한 순서). Task 4는 1-3 완료 후. Task 5는 1 완료 후. Task 6은 모두 완료 후.

## Verification Strategy

- **단위**: 각 task 후 `node scripts/ai-workflow-check.mjs --repo .` PASS.
- **통합 negative test 5개** (Task 4 fixture에 대응):
  - `fx-01-passes.md` → PASS
  - `fx-02-missing-field.md` → FAIL (어느 필드 누락인지 메시지 포함)
  - `fx-03-empty-value.md` → FAIL
  - `fx-04-skipped-no-reason.md` → FAIL
  - `fx-05-test-only-change.md` → PASS (면제 사유 메시지 포함)
- **자가 회귀**: 본 PR 자체는 UI 코드 변경 없음 → UX/UI Pass 면제 (`Audience: n/a, UI 변경 없음`). 본 plan의 자체 ledger가 면제 룰의 첫 사례.
- **Plan-Review 재검토**: 본 round 2 plan을 Codex에게 다시 보내 PASS 확보. 라운드 캡 3 (안내문 변경 동반 시 4-5) 안에서.
- **사람 검토 (디자인 측)**: 최소 PASS 기준 표현이 디자인팀 의도와 맞는지 짧게 확인. 본 PR 진행 중 또는 후속 PR에서 디자인 owner 1명 reviewer 의무.

## Known Risks

- **Checkbox theatre**: 4줄 모두 채웠지만 실제 검토 없이 통과시키는 위험. **완화**: "근거 1줄"에 정본 문서 경로 명시 의무 → 검토자가 어떤 문서 어느 부분을 봤는지 추적 가능. 추후 reviewer 평판/샘플링 도입 검토.
- **Reviewer skill drift**: 검토자마다 PASS 기준 해석 다름. **완화**: 정본 문서가 단일 출처. 분기 발생 시 Codex/`plan-design-review` 합의로 정본 갱신.
- **Retroactive ledger mutation 회피**: Phase 6 ledger를 첫 적용 예시로 쓰는 대신 fixture 도입. **완화**: 게이트는 새 ledger부터 적용. Phase 6는 게이트 도입 전이라 면제.
- **CI scope drift**: local dirty tree 기준과 PR changed-files 기준이 다를 위험. **완화**: checker가 이미 `--changed-files` 인자 지원. Task 3에서 `IMPLEMENTATION_OR_WORKFLOW_PATTERNS`와 같은 패턴 정의 방식으로 추가하여 두 경로 일관.
- **Gate fatigue**: Cross-model + Architecture + QA + 새 게이트로 우회/skip이 늘 수 있음. **완화**: test/types-only 자동 면제 + skipped + 사유 허용으로 "끝낼 길"을 명확히. 사유 감사는 별도 PR (degraded 감사 follow-up과 묶기 가능).
- **디자인 측 합의 부재 (남은 위험)**: 정본 문서 경로는 명시했으나 4개 체크 각각의 "최소 PASS 기준"은 본 PR 작성 중 정해야 함. **완화**: Task 1 작성 시 `docs/ant-design/07-review-checklist.md`를 기준으로 최소 PASS 기준 초안 작성 후 디자인 owner 1명 비동기 확인.
- **false positive 잔여 위험**: 감지 패턴 확장 후에도 internal refactor / dead component 수정 등에서 false positive 가능. **완화**: skipped + 사유로 처리 가능. 사유에 "internal refactor — no visual change"처럼 적으면 통과.

## Plan-Review PASS Gate (현재 상태)

| Round | Date | Reviewer | Verdict | 다음 행동 |
| --- | --- | --- | --- | --- |
| 1 | 2026-05-22 22:00 KST | Codex GPT 5.5 | CONCERN | 9개 비판 모두 모든 층 수정 → rev2 |
| 2 | 2026-05-22 23:00 KST | Codex GPT 5.5 | **CONCERN (accepted with reason)** | 8/9 OK + 1 PARTIAL. 라운드 3 불요. 아래 §"Round 2 보강" 즉시 반영 + 본격 구현 Task 1→2→3→5→4→6 진행 |

## Round 2 보강 (Codex 권고 즉시 반영 + accepted concerns)

**즉시 반영 (rev2.1)**:

1. **Task 5 위치 수정**: Task 5(`ai-development-workflow.md` Core Invariants + Lane Selection 갱신)는 **Task 1-3 완료 후** 진행. 이유: Core Invariants 문구가 checker/ledger 표현과 어긋날 위험. 정정 순서: **Task 1 → 2 → 3 → 5 → 4 → 6**.

2. **types-only 면제 조건 강화**: `**/*.d.ts` · `**/*.types.ts` 변경은 **자동 면제하지 않음**. 대신 ledger의 `UX/UI Consistency Pass`를 `skipped — types-only, no UI component prop/type contract change` 형식으로 명시 의무. test-only(`**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`)는 자동 면제 유지.

3. **fixture 자동 실행 의무화**: `scripts/test-uxui-fixtures.mjs`를 **선택 → 의무**로 변경. Task 4 완료 조건에 "스크립트가 5개 fixture 모두에 대해 예상 결과를 자동 출력하고 1개라도 빗나가면 exit 1"를 포함. 이걸 안 만들면 fixture는 문서 장식이 됨.

4. **최소 PASS 기준을 review-gates.md에 명시적으로 박기** (Task 1 완료 조건 강화). 4개 체크 각각 짧고 판정 가능한 한 줄:
   - **Tokens PASS**: AntD 토큰만 사용. hardcoded color/radius/shadow/spacing 없음. 예외는 사유 필수.
   - **Components PASS**: 같은 패턴은 같은 컴포넌트 재사용. 새 컴포넌트 도입 시 `docs/ant-design/03-patterns-and-components.md`의 기존 패턴과 비교 사유 기록.
   - **A11y PASS**: 키보드 도달 + focus visible + semantic label + 텍스트 대비 4.5:1 이상. 4가지 모두 검토자가 확인.
   - **Responsive PASS**: 360px(mobile) / 768px(tablet) / 1280px(desktop) 3개 breakpoint에서 깨짐 없음.

**Accepted with reason (라운드 3 미진행 사유)**:

| Codex 우려 | 수용 사유 | 후속 |
| --- | --- | --- |
| fixture 디렉터리가 "두 번째 정본"처럼 썩을 위험 | fixture 자동 실행 의무화(보강 #3)로 일차 완화. 장기적 sync는 별도 운영 작업 | 후속 PR (예: degraded-mode 사용률 감사와 묶기) |
| `skipped` 사유 "internal refactor — no visual change" 남용 | 현 시점에 사용 데이터 없음. 1-2개월 운영 후 사유 빈도 감사 → 남용 패턴 발견 시 사유 화이트리스트 도입 | 별도 PR (사유 감사 자동화) |
| "최소 PASS 기준이 정본 참조만으로 부족"의 잔여 (보강 #4로 일차 명시했으나 디자인팀 합의는 미완) | 본 PR에서 가장 보수적 기준으로 시작. 디자인 owner 1명 비동기 확인은 본 PR 진행 중 진행 | Task 1 작성 중 디자인 측 ping |

## Next Action

Codex round 2 CONCERN을 accepted with reason로 받아들이고 본격 구현 Task 1→2→3→5→4→6 진행. 라운드 3 재검토는 불요 (Codex 명시). 단 Task 1(`review-gates.md` 게이트 정의) 완료 후 디자인 owner 1명 비동기 확인 권장.
