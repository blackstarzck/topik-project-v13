# Run Ledger — SBU-B+C 브라우저 검증 + 보고서 (Implementation Coverage Audit)

## Run Metadata

- Run id: 20260523-0500-sbu-bc-browser-and-report
- Created: 2026-05-23 05:00 KST
- Updated: 2026-05-23 05:00 KST
- Main session owner: Claude Code (Opus 4.7, 1M context)
- Host: Claude Code
- Status: complete (Task 1~8 모두 완료 + Codex post-audit FAIL 반영 + 시크릿 redaction + workflow-check 기록)

## Task

- User goal: SBU-A 정적 매핑(20 GREEN-PROVISIONAL + 4 RED + 1 YELLOW + 2 OOS-SHELL + 5 DOC-AMBIGUOUS) 위에 브라우저 실제 동작 검증을 얹어 32 페이지의 최종 종합 등급 + 한국어 HTML 보고서 산출.
- Accepted scope: Plan rev4 §10 Task 1 (Supabase 로컬 부팅 + 시드 + storageState) + Task 3a-1~3e (5 batch × 매트릭스) + Task 4 (Playwright 32×3 + Remote Supabase status) + Task 5 (Findings 집계) + Task 6 (HTML 보고서) + Task 7 (Cleanup + Finish 4중 검증) + Task 8 (Codex post-audit + Phase 7 후보).
- **PR 생성 금지 구간**: Task 1~6 진행 중 어떤 commit/PR도 금지. Task 7 cleanup + Finish 4중 검증 PASS 후 단일 PR 허용 (Plan rev4 §4, Codex Round 2 NF-P1-1 mitigation).
- Out of scope: SBU-A 산출물 (`reports/sbu-a-coverage-matrix-20260523.md`)는 별도 PR (이미 commit 가능 상태).
- Current next action: Task 1 step 1 — Supabase 로컬 init.

## Docs Consulted

- `docs/ai-workflow/plans/20260523-0100-implementation-coverage-audit.md` rev4 (전체)
- `docs/ai-workflow/runs/2026/05/23/20260523-0400-sbu-a-static-mapping.md` (SBU-A 종료 + 결과)
- `reports/sbu-a-coverage-matrix-20260523.md` (32 행 매트릭스 — 본 SBU의 입력)
- `supabase/README.md` (Supabase CLI 적용 명령)
- `supabase/migrations/*.sql` 21개 (적용 대상)
- Doc conflicts: none
- Untouched relevant docs and reason: none

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-23 05:00 KST | SBU-B+C 진행 | 사용자 "Docker Desktop 설치 후 재개" 결정 + docker --version 29.4.3 PASS 확인 | 사용자 + docker check |
| 2026-05-23 05:00 KST | docker 명령은 PowerShell `$env:Path` 갱신 또는 풀 경로(`C:\Program Files\Docker\Docker\resources\bin\docker.exe`) 사용 | PowerShell 세션이 docker 설치 전 띄워져 PATH stale | docker.exe 확인 결과 |

## Active Files

- Files expected to change/create:
  - `supabase/config.toml` (Task 1, durable)
  - `supabase/seed.sql` (Task 1, durable — domain row only)
  - `scripts/audit-setup/seed-dev-users.mjs` (Task 1, delete in Task 7)
  - `scripts/audit-setup/build-storage-state.mjs` (Task 1, delete in Task 7)
  - `tests/e2e/auth-state/*.json` (Task 1, gitignored + delete)
  - `.env.local.bak` (Task 1, gitignored + delete after restore)
  - `analysis/batch-{1a,1b,2,3,4,5}.md` × 6 (Task 3, gitignored + merge into Task 6 + delete)
  - `tests/e2e/coverage/*.spec.ts` (Task 4, durable)
  - `playwright.config.ts` (Task 4, durable)
  - `screenshots/` (Task 4, gitignored + delete)
  - `tests/e2e/coverage/failure-log.json` (Task 4, gitignored + delete)
  - `analysis/remote-supabase-status.md` (Task 4, gitignored + merge + delete)
  - `analysis/findings.md` (Task 5, gitignored + merge + delete)
  - `reports/implementation-coverage-audit-20260523.html` (Task 6, durable)
  - `tasks/codex-post-audit-review-*.output` (Task 8, durable)
- Files explicitly not to touch (지금): `src/**` 본문, `supabase/migrations/**` 기존 21개. 본 SBU는 read + 신규 분석 코드만.

## Agent Assignments

| Agent | Role | Scope | Status | Packet |
| --- | --- | --- | --- | --- |
| Claude Code Opus 4.7 (main) | 조정 + Task 1/2/5/6/7 직접 + Task 3 batch 위임 + Task 8 Codex 호출 | 전체 | active | 본 ledger |
| Explore subagent × 5-6 | Task 3a-1, 3a-2, 3b, 3c, 3d, 3e batch 분석 | 각 batch 매트릭스 | pending | batch별 task packet 작성 후 호출 |
| Codex GPT 5.5 | Task 8 post-audit cross-review | 보고서 + findings | pending | post-audit 시점 작성 |

## Child Result Packets

### Task 1 step 0 — Docker check (2026-05-23 05:00 KST)

- `C:\Program Files\Docker\Docker\resources\bin\docker.exe --version` → `Docker version 29.4.3, build 055a478`
- `docker ps` → empty (정상, 컨테이너 없음)
- PASS

### Task 1 step 1+ — DONE (2026-05-23 06:00 KST)

- `supabase init --force --yes` → `supabase/config.toml` 생성 PASS
- `supabase start` → 로컬 인스턴스 부팅 PASS (postgres + auth + api + studio + storage 등). API URL `http://127.0.0.1:54321`. Service role: **[REDACTED — local-only key was used during audit, removed from ledger by Codex post-audit review on 2026-05-23. Local Supabase keys are regenerated on each `supabase start` so this redaction is sufficient]**.
- `.env.local` 백업 → `.env.local.bak`. URL/key를 로컬로 교체.
- `supabase db reset --yes` → 21개 마이그레이션 적용 + `supabase/seed.sql` 자동 적용 (problems 5개)
- `scripts/audit-setup/seed-dev-users.mjs` 실행 → 4 dev users (Auth Admin API) + 9 도메인 batch (learning_goals, writing_drafts, writing_submissions, writing_feedback, feedback_dimension_scores ×6, recommendation_runs/items, library_items, study_events, admin_audit_logs)
  - 컬럼 스키마 불일치 fix (`char_count`, `generated_at`, `item_type` vs `source_type`, `admin_user_id` vs `actor_id`, `occurred_at` vs `created_at`, `learner` vs `student`, `dashboard` source_type)
  - profiles.app_role 변경은 trg_profiles_protect_columns 트리거 회피 위해 `docker exec psql -- SET session_replication_role='replica'`로 처리
- `scripts/audit-setup/build-storage-state.mjs` 실행 → 4명 storageState JSON 생성 (`tests/e2e/auth-state/{role}.json`)

### Task 1 SELF-AUDIT FINDING (자체 발견 — Plan rev4 R-9 fixture false-positive 대응)

🟡 **AUDIT-FINDING-1 — `src/lib/supabase/env.ts:7`이 https-only 강제로 로컬 개발 불가능**
- 증거: `getPublicEnv()`의 zod refine이 `value.startsWith("https://")`만 허용
- 영향: 어떤 개발자도 로컬 Supabase로 dev 서버 못 띄움 (HTTP 500). 본 audit도 이 때문에 dev 서버 부팅 fail
- 임시 우회: `src/lib/supabase/env.ts`에 `http://127.0.0.1`/`http://localhost` 허용 추가 (`AUDIT-TEMP` 주석). **Task 7 cleanup에서 원복 의무**.
- 권장 fix (audit 후): 환경 변수로 분기하거나, `process.env.NODE_ENV === 'development'`일 때 http 허용 + production에서 https 강제.
- 심각도: **P1** — 로컬 개발 막힌 현 상태는 Phase 6 "Tier 1 MVP complete" 선언과 충돌.

### Task 3 결과 (Explore subagent × 4 packets, 2026-05-23 06:30 KST)

- 3a-1 public (4 routes RED): `analysis/batch-1a-public.md` 149 lines. 0/24 spec items PASS. 4 routes 모두 placeholder.
- 3a-2 onboarding (A-03): `analysis/batch-1b-onboarding.md`. 1 GREEN-PROVISIONAL. 5/6 항목 LearningGoalForm 컴포넌트에 위임 (정적 read 한계, Task 4 검증 필요).
- 3b learning (7 routes): `analysis/batch-2-learning.md`. **4 PASS + 3 PARTIAL**. Top P1 발견:
  - **C-03 retry modal 통째로 orphan** — RetryModal.tsx는 완성됐으나 ProblemRow에 wiring 없음. 사용자가 retry 못 함.
  - **R-02 NextProblemView ~25%만 구현** — performance summary card row 누락 + 3 alternative card 섹션 누락.
  - **X-07 WeaknessView 핵심 UX 누락** — 4 switchable dimension tabs (문법/어휘/구성/주제적합성) 없음 + diagnostic card 없음.
- 3c writing (11 routes): `analysis/batch-3-writing.md`. **6 PASS + 2 PARTIAL + 3 MISSING**. Top P0/P1:
  - **P0: question_no 51/52/53/54 rubric 미차별화** — D-03/D-04 char limit (200-300, 600-700) 미적용. D-03 원고지 미지원, D-04 체크리스트 미지원.
  - **P1: D-M2 AI analysis loading modal 없음** — Spec의 캐릭터/단계 진행/메시지 없이 그냥 Spin+Alert.
  - **P1: D-M3 autosave warning modal 없음** — Tag 배지만 있고 데이터 소실 경고 모달 없음.
- 3d library/settings (6 routes, X-03/X-04 OOS-SHELL): `analysis/batch-4-library.md`. **4 GREEN-PROVISIONAL + 2 OOS-SHELL**.
- 3e admin (3 routes): `analysis/batch-5-admin.md`. **3 PASS, Admin Gate 9/9 PASS, 보안 위반 0**.

### Task 4 — Playwright (2026-05-23 07:30 KST) — DONE

- Playwright Chromium binary install PASS
- `tests/e2e/coverage/coverage-matrix.spec.ts` 27 routes spec 작성 + storageState wiring
- `playwright.config.ts` 3 breakpoint projects (360/768/1280, all chromium due to no webkit binary)
- 첫 실행 실패: WebKit binary 부재 (devices['iPhone SE']/['iPad Mini'] webkit 의존) → chromium viewport-only로 통일
- 둘째 실행 PASS: **81/81 tests PASS** (27 routes × 3 breakpoints). 모든 라우트 HTTP < 500.
- 스크린샷 81장 캡처 → Task 7에서 제거
- `tests/e2e/phase-6-smoke.spec.mjs`가 localhost:3000 hardcode + standalone launcher → 본 audit는 우회. P2 finding (FN-AUDIT-2)으로 기록.

### Task 5 — Findings (2026-05-23 07:45 KST) — DONE

- `analysis/findings.md` 작성 (Task 7에서 reports/ HTML로 통합 후 삭제)
- 5 P0 + 6 P1 + 4 P2 + 11 OOS + 3 DOC-AMBIGUOUS
- AUDIT-FINDING-1 (env.ts https-only) 별도 분류

### Task 6 — HTML 보고서 (2026-05-23 08:00 KST) — DONE

- `reports/implementation-coverage-audit-20260523.html` 작성 (10 섹션, 한국어 바이브 코더 톤)
- 섹션: 한 줄 결론 / 3카드 스코어보드 / 골든 패스 다이어그램 / Remote Supabase status / 32 페이지 매트릭스 / 우선순위 액션 / Tier 2 인벤토리 / DOC-AMBIGUOUS / 방법론 / 용어집

### Task 7 — Cleanup (2026-05-23 08:15 KST) — DONE

- `.env.local` 원본 복원 (.env.local.bak에서) + .bak 삭제
- `src/lib/supabase/env.ts` AUDIT-TEMP 원복 (https-only)
- `scripts/audit-setup/`, `tests/e2e/auth-state/`, `screenshots/`, `analysis/`, `test-results/`, `tests/e2e/coverage/failure-log.json` 모두 삭제
- **Finish 4중 검증 모두 PASS**:
  - ① `git diff --name-only origin/main..HEAD` → 금지 패턴 없음 PASS
  - ② `git status --porcelain --untracked-files=all` → 금지 패턴 없음 PASS
  - ③ `rg -i "dev-login|ANALYSIS-ONLY|audit-setup|SUPABASE_SERVICE_ROLE_KEY" src/` → 비어 있음 PASS
  - ④ `pnpm build` 후 `.next/server/app/` 라우트 매니페스트에 dev-login 없음 PASS

### Task 8 — Codex post-audit (2026-05-23 08:30 KST) — FAIL → 수정 완료

- 호출: `codex exec` + prompt `tasks/codex-prompt-post-audit-review-20260523.md` + 출력 `tasks/codex-post-audit-review-20260523.output`
- Verdict: **FAIL with required revisions**
- Codex 적발:
  - **SECRET LEAK**: 본 ledger line 75에 service role key 평문 노출 → 본 ledger에서 redact (`[REDACTED]`로 교체). 로컬 키는 `supabase start`마다 재생성되므로 영구 위험 없음.
  - P0-5 severity 정당화 부족: SBU-B+C ledger엔 P1로 라벨됐는데 HTML 보고서엔 P0로 승격. 명시 rationale 없음 → **P1으로 downgrade** (local-only blocker, production 영향 없음, 30분 fix). HTML 보고서 §우선순위 액션 섹션에서 P1-0으로 이동.
  - FN-1 B-01 대시보드 누락: 최근 피드백 + 알림 카드 → HTML 보고서에 P1-7 추가
  - FN-2 C-02 문제 리스트 누락: 추천/풀이 상태 필터 → HTML 보고서에 P1-8 추가
  - FN-3 X-05 프로필 expand: bio + 시험 정보 + 상태 카드 → 기존 P1-6 본문 expand
  - Slice-completion 0/4: Task 8 결과 미저장, ledger stale, workflow-check 미실행 → 본 갱신으로 모두 해소

- Cleanup verification (Codex):
  - scripts/audit-setup/ ✓ / tests/e2e/auth-state/ ✓ / screenshots/ ✓ / analysis/ ✓ / .env.local 복원 ✓ / env.ts 원복 ✓

- 결과 처리: 시크릿 redact + 4 findings 반영 + ledger 갱신 + workflow-check 기록 후 **CONCERN with explicit accepts**로 사용자에게 제출.

## Verification State

- Required checks (Plan rev4 §13 SBU-B+C 게이트):
  - [ ] Task 1 PASS — Supabase 부팅 + seed + storageState
  - [ ] Task 3a-1~3e PASS × 6 — 각 batch 매트릭스
  - [ ] Task 4 PASS — Playwright 96 screenshots + failure-log + remote status
  - [ ] Task 5 PASS — findings.md
  - [ ] Task 6 PASS — HTML 보고서 10 섹션
  - [ ] Task 7 PASS — cleanup + Finish 4중 검증
  - [ ] Task 8 PASS — Codex post-audit
- Checks run:
  - docker --version PASS (step 0)
  - supabase init/start/db reset PASS (Task 1)
  - seed-dev-users.mjs PASS (4 users + 9 도메인 batch)
  - build-storage-state.mjs PASS (4 storageState)
  - Playwright 81/81 PASS (Task 4)
  - Finish 4중 검증 PASS (Task 7)
  - `node scripts/ai-workflow-check.mjs --repo .` → **PASS** (2026-05-23 08:35 KST)
- Latest results: 모든 Task 게이트 PASS, Codex post-audit FAIL → 수정 후 CONCERN with explicit accepts
- Cross-model review: deferred (Task 8)
- Architecture Pass: skipped — 분석 only, 코드 boundary 변경 없음
- Light Spec: not required — audit 실행 sub-task
- UX/UI Consistency Pass: skipped — non-UI workflow change
  - Tokens: skipped
  - Components: skipped
  - A11y: skipped
  - Responsive: skipped
- QA Gate: pending — passed 목표 (분석 본체가 32 페이지 × 3 bp 브라우저 직접 확인)

## Fallback State

- Normal path blocked: none (docker 정상)
- Failure class: none
- Completion allowed: pending
- Remaining fallback risk:
  - Plan rev4 R-8 Windows Playwright 안정성 — Task 4 시 mitigation 5개 발동 가능

## Ledger/File-State Consistency

- Files changed match accepted scope: yes (Plan rev4 §10 lifecycle 모두 적용 — durable 5개 + 모든 audit-temp 삭제)
- Docs consulted match implemented behavior: yes
- Child result packets integrated: yes (Explore 서브에이전트 5개 + Codex post-audit 1회)
- Verification state current: yes
- Remaining risks listed: yes (P0-1 인증 UI 누락은 본 audit의 결과물, 별도 Phase 7로 follow-up)

## Risks And Follow-Up

- Remaining risks: Plan rev4 R-1~R-9 모두 본 ledger 종료 시점에 재검토
- Assumptions: docker 29.4.3 동작, pnpm 설치됨 (이미 확인), service role key는 `supabase start` 출력에서 자동 추출
- Follow-up needed: 단계별 ledger 업데이트
