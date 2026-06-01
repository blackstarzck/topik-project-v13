# Phase 7 — Coverage Gap Fill Plan

> **Status**: **PASS** (Codex Round 4 PASS, no blocking P1, 1 trivial advisory P2. 4-round 누적 12 P1 + 9 P2 모두 처리)
>
> **Pre-plan review**: 4 rounds (round-cap 5) — Round 1 CONCERN 8 P1+4 P2 → Round 2 CONCERN 3 P1+2 P2 → Round 3 CONCERN-with-accept 1 P1+1 P2 → Round 4 **PASS** 0 P1+1 P2 advisory.
>
> **Optional cleanup (P2-R4-1)**: §7 Task별 AC 일부가 §5의 exact path를 shorthand로 표기. 다음 implementation 시 §5의 정확 경로 그대로 사용.
>
> **Date**: 2026-05-24 00:00 KST
>
> **Author**: Claude Code (Opus 4.7, 1M context)
>
> **Audience**: user (admin 영역은 본 phase 비대상)
>
> **Light Spec**: [`docs/ai-workflow/light-specs/phase-7-coverage-gap-fill.md`](../light-specs/phase-7-coverage-gap-fill.md)
>
> **Source**: Implementation Coverage Audit (2026-05-23) 13건 합의서 — [`docs/ai-workflow/proposals/20260523-coverage-audit-fix-proposals.md`](../proposals/20260523-coverage-audit-fix-proposals.md)

## 1. User Goal

Implementation Coverage Audit이 발견한 P0 5 + P1 8 = 13건 finding 모두 구현하여 골든 패스(가입 → 글쓰기 피드백 → 다음 문제 추천)가 끝까지 작동하게 한다. 13건 모두 Opus + Codex 합의 + 사용자 결정 완료.

## 2. Docs Consulted

- `reports/implementation-coverage-audit-20260523.html` (audit 보고서 + §11 합의서)
- `docs/ai-workflow/proposals/20260523-coverage-audit-fix-proposals.md` (13건 합의 — 본 plan의 task spec 출처)
- `docs/Wireframe/{NN-IA-id}/description.md` × 13건 해당 IA
- `docs/spec.md` (Fixed Baseline + Required Reading Map)
- `docs/development/database-schema.md` (profiles bio 추가 위치)
- `docs/development/backend-auth.md` (Supabase Auth 흐름)
- `docs/ant-design/*` (Form / Tabs / Steps / Modal / Segmented 컴포넌트 가이드)
- `docs/ai-workflow/runs/2026/05/21/20260521-1800-phase-6-admin-library-hardening.md` (Phase 6 task table 패턴)

## 3. Problem Statement

Phase 6은 "Tier 1 MVP complete"라 선언했으나 본 audit가 13건 finding 발견. 가장 큰 결함은:

1. 인증 UI 4개 통째로 placeholder → 사용자가 사이트 진입 자체 불가
2. 글쓰기 51~54의 char limit / 53번 탭+원고지 / 54번 체크리스트 누락 → TOPIK 시험 환경 재현 못 함
3. 대시보드/문제 리스트/약점/프로필의 IA spec 일부 미구현

본 phase가 13건 fix를 완성하면 Phase 6 선언이 실제로 사실이 된다.

## Out of Scope — Intentional Cuts

| Item | Reason |
| --- | --- |
| 실제 LLM 호출 | Tier 2 OOS-1. AI 분석 로딩 모달(P1-4)은 fixture timer 단계로 시뮬레이션 |
| Stripe 결제 | Tier 2 OOS-3. X-03/X-04 OOS-SHELL 유지 |
| SMTP 트랜스포트 | Tier 2 OOS-9. 가입 이메일 확인은 Supabase 기본 dev 메일러 |
| i18n 번역 | Tier 2 OOS-7. 한국어 한정 |
| Realtime 알림 push | Tier 2 OOS-2. 대시보드 알림은 in-app banner |
| Full admin CRUD | Tier 2 OOS-5. 본 phase는 user-facing만 |
| Notification transport (SES/FCM) | Tier 2 OOS-9 |
| 디자인 토큰 자체 refactor | UX/UI Consistency Pass로 별도 처리 |
| 학습 효과 측정 / 분석 | Tier 2 OOS-10 server analytics |
| Bulk operations | Tier 2 OOS-11 |
| P2 finding 처리 | 본 phase 종료 후 별도 정리 (sitemap-code 불일치, phase-6-smoke localhost 등 4건) |
| DOC-AMBIGUOUS 보강 | 별도 docs 보강 phase |
| Full Playwright e2e suite (Phase 6 OOS-4) | Task 13의 골든 패스 1건 + 기존 coverage-matrix 회귀 시드만 reopen. Phase 6 OOS-4 나머지는 유지 (Codex P1-PLAN-7) |
| Export queue worker (Phase 6 OOS-6) | F-M1 PDF는 P2로 별도 처리 |
| Admin audit view / getAuditLogs (Phase 6 OOS-8) | 본 phase는 user-facing만 |
| Edge Function service-role impersonation (Phase 6 OOS-12) | 본 phase는 직접 client SDK 호출만 |

## Smallest Buildable Unit

**SBU-A (가장 작게, 즉시 PR 가능)**: P1-0 env.ts NODE_ENV 분기만 — 30분. 본 phase 시작 전 로컬 dev 환경 즉시 풀림. 외부 의존 0.

**SBU-B (가입부터 골든 패스 0단계)**: P0-1 인증 UI 4개 — 2-3일. 사용자가 진입 가능. 단독으로 가치 있음.

**SBU-C+ (이후 단계)**: P0-2/3/4 글쓰기 시험 환경 + P1-1~8 학습 흐름 보강. 분할 가능, 우선순위는 P0 먼저.

## 4. Files Likely To Change

- 신규 라우트 / 페이지:
  - `src/app/page.tsx` (X-01 랜딩 — 재작성)
  - `src/app/sign-up/page.tsx` (A-01 — 재작성)
  - `src/app/login/page.tsx` (A-02 — 재작성)
  - `src/app/password-reset/page.tsx` (X-06 — 재작성)
  - `src/app/password-reset/confirm/page.tsx` (X-06 confirm step — 신규)
- 신규 컴포넌트:
  - `src/components/auth/SignUpForm.tsx`
  - `src/components/auth/LoginForm.tsx`
  - `src/components/auth/PasswordResetRequestForm.tsx`
  - `src/components/auth/PasswordResetConfirmForm.tsx`
  - `src/components/landing/Hero.tsx`, `FeatureCard.tsx` (X-01)
  - `src/components/writing/LongFormEditor.tsx` (P0-3 — 53번 전용)
  - `src/components/writing/SectionEditor.tsx` (P0-3 — 탭 내부)
  - `src/components/writing/ManuscriptPreview.tsx` (P0-3 — 원고지)
  - `src/components/writing/EssayChecklist.tsx` (P0-4 — 3-state)
  - `src/components/writing/ChecklistRow.tsx` (P0-4)
  - `src/components/writing/AutosaveWarningModal.tsx` (P1-5)
  - `src/components/practice/DimensionTabs.tsx` (P1-3)
  - `src/components/practice/DiagnosticCard.tsx` (P1-3)
  - `src/components/practice/SummaryCardRow.tsx` (P1-2)
  - `src/components/practice/AlternativeCardsGrid.tsx` (P1-2)
  - `src/components/feedback/AnalysisLoadingModal.tsx` (P1-4)
  - `src/components/feedback/AnalysisCharacter.tsx` (P1-4)
  - `src/components/learning/RecentFeedbackCard.tsx` (P1-7)
  - `src/components/learning/AlertsCard.tsx` (P1-7)
  - `src/components/profile/ExamInfoCard.tsx` (P1-6)
  - `src/components/profile/StatusHelpCard.tsx` (P1-6)
- 수정 (rev2 — task table과 일치, Codex P1-R2-1 반영):
  - `src/lib/supabase/env.ts` (P1-0)
  - `src/lib/writing/{types,constants}.ts` (P0-2 CHAR_LIMITS + P0-3 LongFormDraftJson + P0-4 ChecklistItemStatus)
  - `src/lib/writing/server.ts` (P0-3 — getWritingProblem materials select 확장)
  - `src/components/writing/WritingEditor.tsx` (P0-2 + P1-5 trigger wiring 통합)
  - `src/components/writing/WritingPageContent.tsx` (LongFormEditor 분기)
  - `src/components/practice/{ProblemListView,ProblemRow}.tsx` (P1-1)
  - `src/components/practice/ProblemListControls.tsx` (P1-8)
  - `src/components/practice/NextProblemView.tsx` (P1-2)
  - `src/components/practice/WeaknessView.tsx` (P1-3)
  - `src/components/feedback/FeedbackPendingPanel.tsx` (P1-4)
  - `src/components/learning/DashboardContent.tsx` (P1-7)
  - `src/components/profile/ProfileForm.tsx` (P1-6)
  - `src/app/(workspace)/profile/page.tsx` (P1-6 — learning_goals fetch wiring 추가)
  - `src/app/(workspace)/practice/next/page.tsx` (P1-2 — getNextProblemBundle 호출)
  - `src/lib/practice/next.ts` (P1-2 — getNextProblemBundle 신규 함수 + 기존 유지)
  - `src/lib/practice/queries.ts` (P1-8 — listUserProblems 필터 확장)
  - `src/lib/practice/types.ts` (P1-8 — 필터 enum + R-02 번들 타입)
  - `src/lib/settings/{types,server,mutations}.ts` (P1-6 — bio 필드 추가)
  - `src/lib/supabase/types.ts` (P1-6 — `supabase gen types` 재생성 후 commit. profile bio 컬럼 반영)
  - `supabase/seed.sql` (P0-3 — 53번 problem materials chart 시드 추가)
- 신규 마이그레이션:
  - `supabase/migrations/{새timestamp}_profile_bio.sql` (P1-6)
- 신규 helper:
  - `src/lib/auth/redirect-url.ts` (R-10 — Supabase emailRedirectTo / resetPasswordForEmail absolute URL builder)

## 5. Test Strategy (rev1 — Codex P1-PLAN-5 반영, task별 RED test surface 명시)

각 task마다 RED 테스트가 먼저, GREEN 구현이 따라온다 (TDD 표준 loop).

| Task | RED test surface | 위치 |
| --- | --- | --- |
| 0 P1-0 env | `tests/lib/supabase/env.test.ts` — http://127.0.0.1 dev 허용, production https 강제 | unit |
| 1 P0-1 auth | `tests/components/auth/{SignUpForm,LoginForm,PasswordResetRequestForm,PasswordResetConfirmForm}.test.tsx` — Form validation + submit handler call. `tests/e2e/coverage/auth-flow.spec.ts` — 가입 → 이메일 확인 (Mailpit) → 학습 목표 도달 | unit + e2e |
| 2 P0-2 char limit | `tests/lib/writing/constants.test.ts` — CHAR_LIMITS 정본 4×4값. `tests/components/writing/WritingEditor.char-limit.test.tsx` — 51/52/53/54별 hard/recommended 표시 + submit disabled 조건 | unit |
| 3 P0-3 LongFormEditor | `tests/components/writing/{LongFormEditor,SectionEditor,ManuscriptPreview}.test.tsx` — 3탭 전환 + 원고지 layout + chart materials 렌더. `tests/lib/writing/server.test.ts` — `getWritingProblem` materials select 확장. **`tests/integration/long-form-draft-persistence.test.ts` (rev2 — Codex P1-R2-3): 53번 sections {intro/body/conclusion} autosave → DB round-trip → reload 후 복원 검증. 54번 checklist 상태 + text autosave → reload 복원 검증.** | unit + integration |
| 4 P0-4 EssayChecklist | `tests/components/writing/{EssayChecklist,ChecklistRow}.test.tsx` — 3-state segmented control 동작 + 6 항목 모두 렌더 | unit |
| 5 P1-1 RetryModal wiring | `tests/components/practice/ProblemListView.retry.test.tsx` — RetryModal trigger state + onClose | unit |
| 6 P1-2 R-02 | `tests/components/practice/{SummaryCardRow,AlternativeCardsGrid,NextProblemView}.test.tsx`. `tests/lib/practice/next.test.ts` — `getNextProblemBundle` 반환 형식 (primary + summary + 3 alts) | unit + integration |
| 7 P1-3 X-07 | `tests/components/practice/{DimensionTabs,DiagnosticCard,WeaknessView}.test.tsx` — 4 dim tabs + dimension scores 통합 | unit |
| 8 P1-4 D-M2 | `tests/components/feedback/{AnalysisLoadingModal,AnalysisCharacter}.test.tsx` — Steps 단계 시뮬레이션 timer | unit |
| 9 P1-5 D-M3 | `tests/components/writing/AutosaveWarningModal.test.tsx` — 3 trigger × 3 action 분기. `tests/components/writing/WritingEditor.autosave.test.tsx` — trigger wiring (save_failure / disable_attempt / exit_with_dirty) | unit |
| 10 P1-6 profile bio | `tests/integration/profile-bio-migration.test.ts` — bio 컬럼 + char_length 제약. `tests/components/profile/{ProfileForm,ExamInfoCard,StatusHelpCard}.test.tsx` — bio textarea 160자 maxLength + learning_goals 카드 렌더. `tests/lib/settings/{server,mutations}.test.ts` — bio CRUD | unit + integration |
| 11 P1-7 dashboard | `tests/components/learning/{RecentFeedbackCard,AlertsCard}.test.tsx`. `tests/components/learning/DashboardContent.test.tsx` — 두 카드 통합 + n+1 회피 | unit |
| 12 P1-8 C-02 filter | `tests/components/practice/ProblemListControls.test.tsx` — 추천 toggle + 풀이 상태 Select. `tests/lib/practice/queries.test.ts` — listUserProblems 필터 확장 | unit + integration |
| 13 골든 패스 e2e | `tests/e2e/coverage/golden-path.spec.ts` — X-01 → A-01 가입 → 이메일 확인 → A-03 → B-01 → D-03 (53 탭 + 원고지) → 제출 → E-02 → R-02. 기존 `coverage-matrix.spec.ts` 81/81 회귀 PASS | e2e |

추가 통합:
- `tests/integration/rls-smoke.test.ts` (Phase 2 이후 표준) — bio 컬럼 self-update RLS 정합 재검증
- `supabase/seed.sql` 53번 materials 시드 (`{ chart: { type: 'bar', data: [...] } }`) — Codex P2-PLAN-3
- e2e는 본 phase가 `tests/e2e/coverage/golden-path.spec.ts` 1건만 reopen, 나머지 Phase 6 OOS-4 유지

## 6. Known Risks

| ID | Risk | Mitigation |
| --- | --- | --- |
| R-1 | Phase 7 작업량 너무 큼 (15-22일 추정) | SBU-A → SBU-B → SBU-C+ 단계 분할 + Subagent-eligible task 다수 활용 |
| R-2 | Supabase Auth 이메일 확인이 로컬 dev에서 실제 이메일 전송 안 함 | `supabase status`에서 `Mailpit` URL 확인. local dev 한정 fake 메일러 사용 |
| R-3 | 53번 LongFormEditor의 도표 자료 렌더링 — problems.materials jsonb 구조 미정 | 본 plan 작성 단계에서 정의: `{ chart: { type, data, options } } | { text: string }` |
| R-4 | EssayChecklist 3-state가 vague — "warning" 기준은 사용자 자율 | spec과 일치 (사용자 self-eval). 자동 채점 시도 안 함 |
| R-5 | RecentFeedbackCard query 성능 — N+1 가능성 | server component에서 single join query 작성 |
| R-6 | profiles.bio 마이그레이션이 기존 RLS 정책과 충돌 | bio는 self-update 가능 컬럼이라 별도 정책 변경 없음. 검증: migration 후 RLS smoke 테스트 |
| R-7 | AutosaveWarningModal trigger 3종이 race condition | 우선순위: save_failure > disable_attempt > exit_with_dirty. 동시 발생 시 가장 critical 표시 |
| R-8 | 인증 UI Test fixture 재사용 — 본 audit의 storageState 패턴 적용 가능 | playwright spec에서 storageState 패턴 일관 적용 |
| R-9 (rev1, Codex P2-PLAN-1) | Mailpit (local-machine dev mailer) 가용성 — 다른 개발자 PC에서 동일 보장 안 됨 | Task 1 시작 전 `supabase status`로 Mailpit URL 확인 + ledger에 기록. Mailpit 부재 시 fallback: 사용자에게 manual token 흐름 안내 |
| R-10 (rev1, Codex P2-PLAN-2) | Supabase `emailRedirectTo` / `resetPasswordForEmail.redirectTo` — bare relative path는 origin-unsafe | URL builder helper 신설 (`src/lib/auth/redirect-url.ts`) — `process.env.NEXT_PUBLIC_SITE_URL` 또는 `window.location.origin` 결합. dev/staging/prod 모두 absolute URL 보장 |

## 7. Acceptance Criteria

본 phase 종료 시 다음 모두 충족 (light spec §6 + 본 plan task별).

### Phase 전체 게이트

- [ ] 13 task 모두 구현 (proposal 합의 옵션대로)
- [ ] vitest 신규 단위 테스트 모두 PASS
- [ ] `pnpm exec playwright test tests/e2e/coverage/coverage-matrix.spec.ts` 81/81 PASS (회귀, 기존 시드)
- [ ] `pnpm exec playwright test tests/e2e/coverage/golden-path.spec.ts` PASS (신규 — Task 13 산출물, 사용자 가입→글쓰기→피드백 골든 패스, rev2 Codex P2-R2-2 분리)
- [ ] 골든 패스 manual QA 통과 (가입 → 글쓰기 53번 → 피드백 → 다음 문제)
- [ ] Architecture Pass (audience boundary 일치, admin 영역 미변경 확인)
- [ ] UX/UI Consistency Pass (Tokens/Components/A11y/Responsive 4 PASS)
- [ ] QA Gate passed (dev 서버 부팅 + 직접 클릭 + 콘솔 에러 없음)
- [ ] Codex pre-plan review PASS (또는 CONCERN with accept)
- [ ] Codex post-implementation cross-review PASS
- [ ] `node scripts/ai-workflow-check.mjs` PASS

### Task별 AC (rev3 — Codex P1-R3-1 반영)

- [ ] **Task 0 AC**: `tests/lib/supabase/env.test.ts` 모든 케이스 PASS (http://127.0.0.1 dev 허용, production https 강제)
- [ ] **Task 1 AC**: 4 auth form 컴포넌트 + landing 단위 테스트 PASS + `tests/e2e/coverage/auth-flow.spec.ts` PASS (가입 → Mailpit 이메일 확인 → 학습 목표 도달)
- [ ] **Task 2 AC**: `tests/lib/writing/constants.test.ts` CHAR_LIMITS 16값 검증 PASS + `tests/components/writing/WritingEditor.char-limit.test.tsx` 51/52/53/54 hard/recommended 분기 PASS
- [ ] **Task 3 AC**: LongFormEditor/SectionEditor/ManuscriptPreview 단위 테스트 PASS + `tests/lib/writing/server.test.ts` materials select 확장 PASS + **`tests/integration/long-form-draft-persistence.test.ts` 53 sections + 54 checklist autosave→DB→reload 복원 PASS**
- [ ] **Task 4 AC**: EssayChecklist/ChecklistRow 단위 테스트 PASS (3-state segmented control 동작 + 6 항목 렌더)
- [ ] **Task 5 AC**: `tests/components/practice/ProblemListView.retry.test.tsx` RetryModal trigger state PASS
- [ ] **Task 6 AC**: SummaryCardRow/AlternativeCardsGrid/NextProblemView 단위 테스트 PASS + `tests/lib/practice/next.test.ts` getNextProblemBundle 반환 형식 (primary + summary + 3 alts) PASS
- [ ] **Task 7 AC**: DimensionTabs/DiagnosticCard/WeaknessView 단위 테스트 PASS (4 dim tabs + dimension scores 통합)
- [ ] **Task 8 AC**: AnalysisLoadingModal/AnalysisCharacter 단위 테스트 PASS (Steps 단계 시뮬레이션 timer)
- [ ] **Task 9 AC**: AutosaveWarningModal 단위 테스트 PASS (3 trigger × 3 action 분기) + WritingEditor.autosave.test.tsx trigger wiring PASS
- [ ] **Task 10 AC**: `tests/integration/profile-bio-migration.test.ts` PASS (bio 컬럼 + char_length 제약) + ProfileForm/ExamInfoCard/StatusHelpCard 단위 테스트 PASS + `tests/lib/settings/{server,mutations}.test.ts` bio CRUD PASS
- [ ] **Task 11 AC**: RecentFeedbackCard/AlertsCard + DashboardContent 단위 테스트 PASS (n+1 회피 query 확인)
- [ ] **Task 12 AC**: ProblemListControls 단위 테스트 PASS (추천 toggle + 풀이 상태 Select) + `tests/lib/practice/queries.test.ts` listUserProblems 필터 확장 PASS
- [ ] **Task 13 AC**: `tests/e2e/coverage/golden-path.spec.ts` PASS (X-01 → A-01 가입 → 이메일 확인 → A-03 → B-01 → D-03 → 제출 → E-02 → R-02 전체 흐름) + 기존 `coverage-matrix.spec.ts` 81/81 회귀 PASS

## 8. Verification Strategy

`docs/ai-workflow/review-gates.md`의 모든 적용 가능 게이트:

| Gate | 적용 |
| --- | --- |
| TDD | mandatory — 신규 컴포넌트 각각 단위 테스트 우선 |
| Cross-model review | mandatory — Codex pre-plan + post-impl |
| Plan-Review PASS Gate | mandatory — round-cap 5 |
| Code/Doc Review | applicable |
| Architecture Pass | mandatory — audience: user 경계 검증 |
| UX/UI Consistency Pass | mandatory — 13건 모두 UI 변경 PR |
| QA Gate | **mandatory — passed 목표**. dev 서버 부팅 + 골든 패스 직접 클릭 + 콘솔 에러 캡처 |
| Finish | mandatory |

## 9. Tasks

Audience: 모든 행 `user` (admin 비대상). Subagent-eligible 컬럼은 plan rev1에서 분할 검토 후 작성.

| # | Task | Files | Audience | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- | --- |
| 0 | P1-0 env.ts NODE_ENV 분기 (SBU-A — 단독 즉시 PR) | `src/lib/supabase/env.ts` | user | N — 30분, main session 직접 |
| 1 | P0-1 인증 4 화면 + LandingHero (SBU-B 핵심). **사용자 결정 A안 정본 (proposal lines 84-88 그대로)**: <br/>(a) **A-01 sign-up**: Ant Design Form + email/password/confirm/display_name/**terms checkbox**. Submit → `supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrlBuilder('/onboarding/learning-goal') }})`. 이메일 확인 안내 화면 + **resend 버튼** (`supabase.auth.resend`). <br/>(b) **A-02 login**: 이메일+비번 form + "비밀번호 잊으셨나요?" 링크 + **"매직링크로 로그인" 토글** (`signInWithOtp` + `emailRedirectTo`). <br/>(c) **X-06 password-reset**: email 입력 → `resetPasswordForEmail(email, { redirectTo: redirectUrlBuilder('/password-reset/confirm') })`. **`/password-reset/confirm` page에서 새 비번 입력** → `updateUser({ password })`. <br/>(d) **X-01 landing**: 히어로 + "지금 가입하기" + 보조 "로그인" + 기능 3카드. <br/>모든 redirect는 `src/lib/auth/redirect-url.ts` (R-10) 사용 absolute URL. | `src/app/page.tsx` (X-01 root landing), `src/app/sign-up/page.tsx` (A-01), `src/app/login/page.tsx` (A-02), `src/app/password-reset/page.tsx` (X-06 request), `src/app/password-reset/confirm/page.tsx` (X-06 confirm, 신규), `src/components/auth/{SignUpForm,LoginForm,PasswordResetRequestForm,PasswordResetConfirmForm}.tsx`, `src/components/landing/{Hero,FeatureCard}.tsx`, `src/lib/auth/redirect-url.ts` (신규) | user | Y — 4 라우트 + form 컴포넌트, 독립 분할 가능 (각 form은 audience: public 진입) |
| 2 | P0-2 글쓰기 51~54 hard/recommended char limit + WritingEditor 통합. **CHAR_LIMITS 정본 (Codex Round 1 P1-PLAN-1 반영)**: `51: {hardMin:10, hardMax:120, recommendedMin:10, recommendedMax:120}`, `52: {hardMin:10, hardMax:160, recommendedMin:10, recommendedMax:160}`, `53: {hardMin:120, hardMax:300, recommendedMin:200, recommendedMax:300}`, `54: {hardMin:300, hardMax:700, recommendedMin:600, recommendedMax:700}` | `src/lib/writing/{types,constants}.ts`, `src/components/writing/WritingEditor.tsx` | user | N — Task 9가 같은 WritingEditor 수정 의존, Task 2 먼저 (Codex P1-PLAN-8) |
| 3 | P0-3 53번 LongFormEditor (탭 + 원고지 + 도표) — 신규 컴포넌트 트리. **answer_json 스키마 (Codex P1-PLAN-6)**: 53번 — `{ sections: { intro: string, body: string, conclusion: string }, _v: "53.v1" }`. 54번 — `{ text: string, checklist: { [key]: 'complete' | 'warning' | 'unchecked' }, _v: "54.v1" }`. WritingEditor가 question_no에 따라 answer_json/answer_text 통합 저장 | `src/components/writing/{LongFormEditor,SectionEditor,ManuscriptPreview}.tsx`, `src/components/writing/WritingPageContent.tsx` (분기 수정), `src/lib/writing/server.ts` (problem.materials select 확장 — Codex P1-PLAN-3), `src/lib/writing/types.ts` (LongFormDraftJson 타입 추가) | user | Y — 독립 컴포넌트 트리, Task 4가 의존 (Task 3 먼저, Codex P1-PLAN-8) |
| 4 | P0-4 54번 EssayChecklist 3-state + LongFormEditor에 통합 | `src/components/writing/{EssayChecklist,ChecklistRow}.tsx`, `src/lib/writing/types.ts` (ChecklistItemStatus enum) | user | N — Task 3 LongFormEditor에 통합 필요, Task 3 후 진행 (Codex P1-PLAN-8) |
| 5 | P1-1 C-03 Retry Modal wiring | `src/components/practice/{ProblemListView,ProblemRow}.tsx` | user | N — 기존 컴포넌트 수정 중심, Task 12와 ProblemListView 공유 (Task 5 먼저, Codex P1-PLAN-8) |
| 6 | P1-2 R-02 SummaryCardRow + AlternativeCardsGrid + getNextProblemBundle RPC 확장 | `src/components/practice/{SummaryCardRow,AlternativeCardsGrid,NextProblemView}.tsx`, `src/lib/practice/next.ts` (실제 파일, Codex P1-PLAN-2 fix), `src/app/(workspace)/practice/next/page.tsx` | user | Y — 컴포넌트 + lib 분리 가능 |
| 7 | P1-3 X-07 DimensionTabs + DiagnosticCard | `src/components/practice/{DimensionTabs,DiagnosticCard,WeaknessView}.tsx` | user | Y — 두 컴포넌트 독립 |
| 8 | P1-4 D-M2 AnalysisLoadingModal + Character + Steps | `src/components/feedback/{AnalysisLoadingModal,AnalysisCharacter,FeedbackPendingPanel}.tsx` | user | Y — modal + character 분리 |
| 9 | P1-5 D-M3 AutosaveWarningModal 3 trigger × 3 action | `src/components/writing/AutosaveWarningModal.tsx`, `src/components/writing/WritingEditor.tsx` (trigger wiring) | user | N — Task 2가 같은 WritingEditor 수정, Task 2 후 Task 9 (Codex P1-PLAN-8) |
| 10 | P1-6 profile bio 마이그레이션 + ProfileForm 3 카드 + 설정 lib 확장 | `supabase/migrations/{새timestamp}_profile_bio.sql`, `src/lib/supabase/types.ts` (regen), `src/lib/settings/{types,server,mutations}.ts` (bio 필드 추가), `src/components/profile/{ProfileForm,ExamInfoCard,StatusHelpCard}.tsx`, `src/app/(workspace)/profile/page.tsx` (learning_goals fetch wiring) | user | Y — 마이그레이션 + lib + 컴포넌트 분리 (Codex P1-PLAN-4 반영) |
| 11 | P1-7 B-01 RecentFeedbackCard + AlertsCard + DashboardContent 확장 | `src/components/learning/{RecentFeedbackCard,AlertsCard,DashboardContent}.tsx` | user | Y — 두 카드 독립 |
| 12 | P1-8 C-02 추천/풀이 상태 필터 + listUserProblems 확장 | `src/components/practice/{ProblemListControls,ProblemListView}.tsx`, `src/lib/practice/queries.ts` (실제 파일, Codex P1-PLAN-2 fix), `src/lib/practice/types.ts` (필터 enum) | user | N — Task 5와 ProblemListView 공유, Task 5 후 Task 12 (Codex P1-PLAN-8) |
| 13 | 골든 패스 e2e 신규 spec + 회귀 확인 + 마무리 cleanup. **OOS-4 부분 reopen 사유**: Phase 6에서 Playwright e2e 통째 OOS였으나 본 Phase 7은 골든 패스 1건 한정 (`tests/e2e/coverage/golden-path.spec.ts`). 기존 `coverage-matrix.spec.ts` 회귀 시드로 유지. Phase 7 한정 골든 패스 e2e만 reopen (Codex P1-PLAN-7) | `tests/e2e/coverage/golden-path.spec.ts` (신규), `supabase/seed.sql` (53번 materials 시드 추가 — Codex P2-PLAN-3), 기존 coverage-matrix spec 회귀 | user | N — 통합 verification, all earlier sub-phases 의존 (Codex 지적: "Task 13 depends on all earlier sub-phases") |

## 10. Risks

(§6과 동일 — 본 plan template 일관성을 위해 §10에 mirror, rev2 — Codex P2-R2-1 반영)

R-1 ~ R-10 모두 §6 참조. **rev2**에서 R-9 (Mailpit local-machine 가용성) + R-10 (Supabase redirect URL builder) 추가됨. Codex pre-plan review가 추가 risk 발견 시 본 §과 §6 동시 갱신.

## 11. Phase 7 Sub-Phase 분할 (rev1 — Codex Round 1 SUB-PHASE SPLIT FEASIBILITY 반영)

각 sub-phase 내부 task 순서 + 공유 파일 의존성 명시. Codex Round 1 지적: 7-C 내부에 Task 2 ↔ 9 WritingEditor 공유, Task 3 ↔ 4 의존. 7-D 내부에 Task 5 ↔ 12 ProblemListView 공유. 7-E의 Task 13은 모든 sub-phase 의존.

- **Phase 7-A (SBU-A)**: Task 0 — env https-only fix. **30분**, 즉시 PR. 외부 의존 0.
- **Phase 7-B (SBU-B)**: Task 1 — 인증 UI 4. **2-3일**, 골든 패스 0단계 해소. 본 sub-phase 종료 시 Mailpit + redirect URL builder 확인 (R-9, R-10).
- **Phase 7-C (글쓰기 시험 환경, sequential 내부)**: 순서 의무 = `Task 2 → Task 3 → Task 4 → Task 9`.
  - Task 2 (char limit) 먼저 — WritingEditor 기반 수정
  - Task 3 (LongFormEditor) — WritingPageContent 분기
  - Task 4 (EssayChecklist) — Task 3에 통합 의존
  - Task 9 (Autosave warning) — Task 2의 WritingEditor 수정 후
  - **5-9일** 총합. 내부 parallel 불가, sequential.
- **Phase 7-D (학습 흐름 보강, partial parallel)**: Task 5 → Task 12 sequential (ProblemListView 공유). Task 6, 7, 8, 11은 모두 parallel 가능.
  - 순서: `Task 5 → Task 12` (ProblemListView 공유 sequential)
  - 병렬: Task 6, 7, 8, 11 (서로 독립)
  - **4-7일** 총합.
- **Phase 7-E (프로필 + 골든 패스 final verify)**: Task 10 (profile) + Task 13 (e2e + final verification).
  - Task 10 parallel 가능 (다른 sub-phase 영향 없음)
  - Task 13은 모든 earlier sub-phase 완료 후 실행 (Codex 명시 지적)
  - **2-3일** 총합.

5 sub-phase 각 PR. 총: **14~22일** (이전과 동일, 다만 내부 sequencing 명확).
