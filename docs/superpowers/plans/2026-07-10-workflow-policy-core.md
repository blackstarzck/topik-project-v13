# Workflow Policy Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 워크플로우 개편의 Phase 0/1을 적용해 정책 충돌을 줄이고, active SOT를 기계적으로 검사하며, Codex Desktop cleanup은 증거가 생길 때까지 report-only로 고정한다.

**Architecture:** root 정책 파일은 얇은 진입점으로 만들고 상세 계약은 `docs/agent-workflow/`로 이동한다. `docs/sot-registry.json`을 canonical source로 삼고 Node.js checker가 schema·경로·active scope·생성 색인을 검증한다. worktree 정리는 이번 단계에서 실행하지 않고 Desktop spike와 legacy inventory만 기록한다.

**Tech Stack:** Node.js 24, JavaScript ES modules, JSON, Markdown, Vitest, pnpm

**Execution status:** 2026-07-10 완료. 네 workflow 문서는 `active`, 제안서는 `superseded`이며, 임시 `.workflow-staging/` 경로는 제거됐다. 아래 staging·원복 항목은 원자적 승격 과정의 실행 이력이다.

---

## Scope boundary

이번 계획은 정책과 report-only worktree 조사만 적용한다. 제품 동작, Supabase, `global.css` 실제 이관, cleanup enforce, branch 삭제, commit/push/PR은 범위 밖이다. 현재 detached app-managed worktree에서는 작업 전 상태와 task-owned diff를 rollback 단위로 사용하고 commit 기반 rollback은 게시 승인 뒤로 미룬다.

### Task 1: 승인 설계와 구현 경계 고정

**Files:**

- Modify: `docs/sot-change-proposals/2026-07-10-codex-workflow-overhaul.md`
- Create: `docs/superpowers/specs/2026-07-10-codex-workflow-overhaul-design.md`
- Create: `docs/superpowers/plans/2026-07-10-workflow-policy-core.md`

- [x] Fable 리뷰 중 저장소에서 확인된 항목만 proposal에 반영한다.
- [x] proposal status를 `accepted_pending_promotion`으로 바꾸고 파괴적 작업의 비허용 범위를 명시한다.
- [x] canonical JSON registry, generated Markdown index, Desktop spike 선행, legacy manual remediation, STRICT remediation lane을 설계 기록에 고정한다.
- [x] 독립 critic에게 계획의 누락·과도한 범위·rollback 가능성을 검토받고 수정한다.

### Task 2: Desktop lifecycle spike와 legacy worktree baseline

**Files:**

- Create: `docs/qa/reports/2026-07-10-codex-desktop-worktree-spike.md`
- Create: `docs/qa/reports/2026-07-10-legacy-worktree-inventory.md`

- [x] `git rev-parse --git-dir`, `git rev-parse --git-common-dir`, `git worktree list --porcelain`, 각 worktree의 read-only 상태를 수집한다.
- [x] Codex Desktop이 제공하는 task heartbeat/native cleanup/보관 API를 로컬 설치와 현재 task metadata에서 찾는다.
- [x] API나 지속성이 증명되지 않으면 cleanup mode를 `report`로 명시하고 구현을 중단한다.
- [x] legacy 후보는 삭제하지 않고 owner, branch/detached, dirty/untracked/ignored 확인 가능 여부와 다음 수동 검토 조건만 기록한다.

### Task 3: SOT registry checker를 테스트 우선으로 구현

**Files:**

- Create: `tests/scripts/check-sot-registry.test.mjs`
- Create: `scripts/check-sot-registry.mjs`
- Create: `docs/sot-registry.json`
- Create: `docs/INDEX.md`

- [x] RED: missing path, duplicate active scope, invalid role/status, broken replacement link, generated index drift fixture를 작성한다.
- [x] Run: `pnpm exec vitest run tests/scripts/check-sot-registry.test.mjs --reporter=verbose --maxWorkers=1`
- [x] 실패가 구현 부재 또는 의도한 assertion 때문인지 확인한다.
- [x] GREEN: `validateRegistry`, `renderIndex`, `evaluateRegistry`와 CLI `--mode report|block`, `--check`, `--write-index`를 최소 구현한다. `report`는 오류를 출력하되 exit 0, `block`/`--check`는 오류 시 non-zero다.
- [x] schema version 1의 document 필드는 `id`, `title`, `path`, `role`, `scope`, `owner`, `status`, `precedence`, `effectiveDate`, `replaces[]`, `replacedBy[]`, `decisionLink`로 고정한다. replacement는 path가 아니라 registry ID를 사용한다.
- [x] valid role은 `constitution`, `entry`, `active-sot`, `workflow`, `proposal`, `decision-record`, `reference`, `archive`, `unclassified`; valid status는 proposal의 lifecycle 6종으로 고정한다.
- [x] 초기 active seed는 `AGENTS.md`, `README.md`, `TESTING.md`, `DESIGN.md`, `docs/prd.md`, `docs/ia.md`, `docs/flow/user-flow.md`, `docs/flow/sitemap.md`, `docs/Wireframe/README.md`, scope decision, AntD entry/review/theme 문서, migration index, user communication으로 제한한다. 새 workflow 문서는 registry seed에 `accepted_pending_promotion`으로 등록한다.
- [x] 명시적으로 등록되지 않은 문서는 lifecycle status를 추정하지 않고 `classificationDefault.role=unclassified`로 취급한다. proposal은 개별 등록된 문서의 실제 status만 사용한다.
- [x] Run: `pnpm exec vitest run tests/scripts/check-sot-registry.test.mjs --reporter=verbose --maxWorkers=1`
- [x] Run: `node scripts/check-sot-registry.mjs --write-index && node scripts/check-sot-registry.mjs --check`
- [x] 리뷰 보강: proposal/active 금지, status와 replacement 상태 호환성, replacement 상호 참조, superseded successor의 active 상태, 비어 있는 metadata와 잘못된 `decisionLink`를 RED→GREEN 계약 테스트로 고정한다.

### Task 4: 공통 workflow 문서와 Claude 진입점 준비

**Files (승격 전 임시 경로, 완료 후 제거):**

- Create: `.workflow-staging/README.md`
- Create: `.workflow-staging/agent-workflow/README.md`
- Create: `.workflow-staging/agent-workflow/core.md`
- Create: `.workflow-staging/agent-workflow/codex.md`
- Create: `.workflow-staging/agent-workflow/ui.md`
- Modify: `CLAUDE.md`
- Modify: `.claude/CLAUDE.md`

- [x] `core.md`에 precedence, FAST/STANDARD/STRICT, SOT promotion, 검증/보고, publish approval을 정의한다.
- [x] `codex.md`에 task/worktree lifecycle, detached handling, task-owned PR monitoring, guarded cleanup과 report-only downgrade를 정의한다.
- [x] `ui.md`에 Page Recipe와 UI ownership ladder, diff-only global CSS gate, exception 및 STRICT remediation lane을 정의한다.
- [x] 기존 `docs/ 전체=SOT` 계약 아래에서 pending 문서가 부분 활성화되지 않도록 최종 문서를 `.workflow-staging/agent-workflow/`에 보관한다.
- [x] root `CLAUDE.md`와 `.claude/CLAUDE.md`의 중복 제거안을 검증한다.
- [x] 부분 활성화를 피하기 위해 원복한 Claude 진입점 변경을 최종 승격 묶음에서 다시 적용한다. Claude의 기본 branch prefix는 `claude/<slug>`로 명시해 Codex adapter의 `codex/<slug>`와 분리한다.
- [x] `node scripts/check-sot-registry.mjs --check`로 새 경로와 registry를 검증한다.

### Task 5: README와 사용자 보고 계약의 충돌 제거

**Files:**

- Modify: `README.md`
- Modify: `docs/user-communication-style.md`

- [x] README의 “docs 전체가 SOT” 표현을 registry 기반 active SOT로 바꾼다.
- [x] 실제 LLM 기능이 단계적으로 추가 중이라는 표현을 deferred scope 결정과 맞춘다.
- [x] 쉬운 결론 우선, 한국어, 근거 보고 원칙은 유지한다.
- [x] 사용자 답변 본문 내부 이름 3개, 문단 1~3문장 같은 절대 숫자 제한은 기본 권고로 완화한다.
- [x] `rg -n "docs/.*source of truth|단계적으로 추가 중|3개 이하|1~3문장" README.md docs/user-communication-style.md`로 잔여 충돌을 확인한다.
- [x] 부분 활성화를 피하기 위해 원복한 README와 사용자 보고 계약 변경을 최종 승격 묶음에서 다시 적용한다.

### Task 6: package/CI에 policy check 연결

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [x] `check:sot-registry`와 `generate:sot-index` package scripts를 추가한다.
- [x] migration 중 확인용 `report:sot-registry` script도 제공한다.
- [x] package `prebuild` chain과 CI의 독립 step에 registry `block` mode를 연결한다.
- [x] Next 16의 `.next/dev` 격리 계약을 확인하고 전역 포트 오탐을 보완한다. 정확히 Next 16이고 config에 opt-out이 없을 때만 경고 후 허용하며 legacy/future/unknown/opt-out은 fail closed로 유지한다.
- [x] Run: `pnpm exec vitest run tests/scripts/check-sot-registry.test.mjs --reporter=verbose --maxWorkers=1`
- [x] 원복했던 package scripts와 CI block gate를 최종 승격 묶음에서 다시 적용한다.

### Task 7: 얇은 AGENTS 적용, 최종 검증과 promotion 판정

**Files:**

- Modify: `docs/sot-change-proposals/2026-07-10-codex-workflow-overhaul.md`
- Modify: `docs/sot-registry.json`
- Regenerate: `docs/INDEX.md`
- Move: `.workflow-staging/agent-workflow/` → `docs/agent-workflow/`
- Modify: `AGENTS.md`

- [x] staged workflow 문서를 최종 경로로 옮기고 root `AGENTS.md`를 얇은 constitution으로 교체한다.
- [x] Run: `pnpm check:sot-registry`
- [x] Run: `pnpm exec vitest run tests/scripts/check-sot-registry.test.mjs tests/scripts/build-preflight.test.ts --maxWorkers=1`
- [x] Run: `pnpm typecheck`
- [x] Run: `pnpm lint`
- [x] Run: `pnpm exec vitest run --maxWorkers=4`
- [x] Run: `pnpm build`. base checkout dev server를 종료하거나 `--force`하지 않고 Next 16 isolated dev output 계약으로 production build를 통과한다.
- [x] `git diff --check`, `git status --short --branch`, secret-like filename과 staged state를 확인한다.
- [x] 부분 활성화 방지를 위해 pending 문서를 staging에서 준비한 뒤 진입 파일·package/CI·registry lifecycle과 함께 최종 경로로 승격한다.
- [x] 새 workflow 정책 문서를 `active`, proposal을 `superseded`로 전환하고 네 workflow 문서의 `replaces`와 proposal의 `replacedBy`를 상호 참조시킨 뒤 index를 다시 생성한다.
- [x] 제품 UI 변경이 없으므로 Playwright가 불필요하다는 근거와, cleanup enforce/UI debt가 후속 phase라는 남은 위험을 보고한다.
- [x] repo-local skill 편집은 Phase 1B로 분리한다. 얇은 정책 적용 후 실제 충돌을 pressure scenario 3개 이상으로 재현한 skill만 일반적인 상위-policy 존중 문구로 수정한다.
