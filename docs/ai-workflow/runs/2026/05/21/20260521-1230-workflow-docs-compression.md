# Workflow Docs Compression Ledger

## Run Metadata

- Run id: 20260521-1230-workflow-docs-compression
- Created: 2026-05-21 12:30 KST
- Updated: 2026-05-21 14:30 KST
- Main session owner: Claude Code (Opus 4.7, 1M context)
- Host: Claude Code
- Status: complete

## Final Result (요약)

- 메인 `docs/ai-development-workflow.md`: 464 → **88줄**
- 신규 sub-doc 4: planning-contracts(92), context-and-packets(96), review-gates(154), fallback-and-recovery(66) — 합 408줄
- 라우팅 갱신: `AGENTS.md`, `docs/agent-index.md`, `docs/ai-workflow/README.md`
- 매 세션 비용: AGENTS(89) + CLAUDE.md(50) + agent-index(113) + 메인(88) = **340줄** (이전 709)
- 검사기 PASS, 룰 의미 100% 보존(Codex Step 4 검증)
- Codex 5-step cross-review: Step 1 PASS · Step 3 sandbox blocked(Opus hybrid) · Step 4 CONCERN(P2×2: anchor `#cross-model-review`, ledger trigger workflow-governing) → fix → Step 5 PASS
- Git publication decision: pending (사용자 결정 대기)

## Task

- User goal: `docs/ai-development-workflow.md`(464줄)가 매 에이전트 세션 시작 시 읽히는 문서인데 누적된 룰이 묻혀 핵심 게이트가 놓일 위험. 메인 80-120줄 + 4개 sub-docs로 분리.
- Accepted scope:
  - 메인 `docs/ai-development-workflow.md`를 슬림 매트릭스 + 라우팅 + 핵심 게이트 요약으로 압축
  - 4개 sub-docs 신설: `review-gates.md`, `fallback-and-recovery.md`, `context-and-packets.md`, `planning-contracts.md`
  - `AGENTS.md`, `CLAUDE.md`, `docs/agent-index.md`의 라우팅을 sub-doc 가리키도록 동기 업데이트
  - `scripts/ai-workflow-check.mjs`의 ledger/plan 검사 룰은 그대로 유지 (sub-doc 분리는 룰 의미 변경 아님)
- Out of scope:
  - 룰 자체의 약화/추가 (분리만, 내용 동일)
  - Phase 4 진입 (별도)
  - HTML 보고서 신규 작성 (cleanup PR의 학습대로 안 만듦)
- Current next action: Codex Step 1 구조 제안 받기 → review → 합의 후 Step 2.

## Docs Consulted

- Exact files read:
  - `docs/ai-development-workflow.md` (464줄, 16 섹션)
  - `AGENTS.md`, `CLAUDE.md`, `docs/agent-index.md` (라우팅 동기 갱신 대상)
  - `scripts/ai-workflow-check.mjs` (sub-doc 분리가 검사기에 영향 없는지)
  - `docs/ai-workflow/agent-packets.md`, `context-ledger-template.md`, `report-template.md` (sub-doc과 관계)
  - Cleanup PR 5-pass retrospective 학습 (`docs/ai-workflow/runs/2026/05/21/20260521-1200-residual-risks-cleanup.md`)
- Extracted requirements:
  - 메인은 매 세션 비용 일정하게 유지 (80-120줄)
  - sub-doc는 깊은 룰 필요 시만 읽음
  - 룰 의미는 100% 보존 (분리만)
- Doc conflicts: none
- Untouched relevant docs and reason: none

## Collaboration Mode (Codex와 합의됨, Mode C 변형)

| Step | 담당 | 산출물 |
| --- | --- | --- |
| 1 | Codex | 구조 제안 — 메인 목차 + sub-doc 4개 매핑 table + 검사기 영향 |
| 2 | Opus | 메인 슬림 문서 초안 (80-120줄) |
| 3 | Codex | sub-docs 4개 작성 |
| 4 | 양방향 | cross-review (Opus→sub-docs, Codex→메인) |
| 5 | 양측 + 검사기 | PASS Gate (FAIL→재리뷰, CONCERN→accepted 가능) |

Disagreement Resolution (사용자 요청으로 추가):
1. 양측 입장 + 근거 + trade-off를 ledger에 명시
2. 정량적 기준 우선 (줄 수, 검사기 통과, 토큰 비용)
3. 정성적 trade-off는 양측이 자기 약점 인정 라운드
4. 미합의 시 사용자에게 escalation (옵션 + trade-off + 권장 + 위험)
5. 사용자 결정을 ledger에 기록

Round 종결 룰 (cleanup PR 5-pass 학습): 기본 3-pass, workflow-governing 문서이거나 FAIL 시 4-5 pass 허용. 5-pass 도달 후에도 PASS 못 하면 escalation 강제.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-21 12:30 | Mode C 변형 채택 (Opus 메인 / Codex sub-docs / 양방향 review) | 메인/sub-doc 책임이 본래 다른 작업, 분리가 가장 안정적 | Codex collab-mode 평가 |
| 2026-05-21 12:30 | sub-doc 4개로 분리: review-gates, fallback-and-recovery, context-and-packets, planning-contracts | 룰의 도메인이 자연스럽게 4개로 묶임 | Codex 평가 |
| 2026-05-21 12:30 | Disagreement Resolution 절차 추가 | 사용자 지적 — 합의 미달 시 처리 누락 | 사용자 |
| 2026-05-21 12:30 | Round 한도 3-pass 기본, workflow-governing은 4-5 허용, 5+ 시 escalation 강제 | cleanup PR 5-pass 학습 | Codex + cleanup PR 학습 |
| 2026-05-21 12:30 | Plan 파일 생성 안 함 — Codex Step 1 구조 제안이 plan 대체 | non-phase cleanup. light spec과 plan 중복 회피 (사용자 지적한 docs inflation 학습) | 사용자 |
| 2026-05-21 13:10 | Codex Step 1 구조 제안 수용 — mapping table, mermaid 11줄 압축, sub-doc 4개 위치 모두 합의 | Codex 분석이 검사기·라우팅·룰 의미 보존 모두 합리적 | Codex Step 1 |
| 2026-05-21 13:10 | TDD 위치: main에 5줄 invariant + 나머지 review-gates.md | Codex open question 답변 + Opus 동의 | Codex |
| 2026-05-21 13:10 | 검사기 확장(sub-doc 존재 검사, 140줄 cap 등)은 별도 PR로 이월 | 이번 PR scope는 "분리만, 룰 변경 없음" — 검사기 확장은 룰 추가 | Opus 조정 |

## Active Files

- Files expected to change:
  - `docs/ai-development-workflow.md` (메인 압축)
  - `AGENTS.md`, `CLAUDE.md`, `docs/agent-index.md` (라우팅)
- Files expected to create:
  - `docs/ai-workflow/review-gates.md`
  - `docs/ai-workflow/fallback-and-recovery.md`
  - `docs/ai-workflow/context-and-packets.md`
  - `docs/ai-workflow/planning-contracts.md`
- Files explicitly not to touch:
  - `scripts/ai-workflow-check.mjs` (검사기 룰 변경 없음)
  - `docs/ai-workflow/agent-packets.md`, `context-ledger-template.md`, `report-template.md` (sub-doc과 관계 있지만 변경 없음)
  - `supabase/migrations/*` (무관)

## Agent Assignments

| Agent | Role | Scope | Status | Packet |
| --- | --- | --- | --- | --- |
| Claude Code Opus 4.7 (main) | 조정 + 메인 작성 | Step 2, Step 4(review sub-docs) | active | this ledger |
| codex (gstack) | 구조 제안 + sub-docs 작성 + 메인 review | Step 1, 3, 4(review main), 5 | step 1 in-flight | task packet — collab mode + 4 sub-doc 정의 |

## Verification State

- Required checks:
  - `node scripts/ai-workflow-check.mjs --repo .` PASS
  - `pnpm test` 그대로 (98/98 변동 없음)
  - 룰 의미 변경 없음 확인 (양방향 review에서)
- Checks run: (없음 — 진행 전)
- Cross-model review: 진행 예정 — Mode C 변형의 Step 4 양방향
- Architecture Pass: 해당 없음 (워크플로우 docs)
- Light Spec: 해당 없음 (non-phase cleanup)

## Ledger/File-State Consistency

- Files changed match accepted scope: pending (진행 전)
- Docs consulted match implemented behavior: pending
- Child result packets integrated: pending — Codex Step 1 결과 도착 시 통합
- Verification state current: pending
- Remaining risks listed: yes (아래)

## Risks And Follow-Up

- Remaining risks:
  - 룰 분리 시 sub-doc 사이 cross-reference 누락 → cross-review에서 catch
  - 라우팅 갱신(AGENTS.md/CLAUDE.md/agent-index.md) 누락 시 에이전트가 sub-doc 못 찾음 → 양방향 review checklist에 포함
  - 5-pass 같은 무한 round 위험 → 종결 룰 적용
- Assumptions:
  - sub-doc 분리가 검사기 영향 없음 (검사기는 ledger/plan 필수 필드만 검증)
  - 매 세션 에이전트가 메인만 읽고 sub-doc는 필요 시 라우팅 따라감
- Follow-up needed:
  - PASS 후 사용자가 commit 결정
  - 향후 phase에서 sub-doc 사이의 cross-reference 자동 검사 검토 (검사기 확장 후보)
