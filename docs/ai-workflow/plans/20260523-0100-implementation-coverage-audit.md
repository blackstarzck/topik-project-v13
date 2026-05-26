# Implementation Coverage Audit — Plan

> **Status**: rev4 (Codex Round 4 **CONCERN** — no P1, 2 trivial P2 반영 — **실행 준비 완료, 사용자 승인 대기**)
>
> **Date**: 2026-05-23 01:00 KST (rev1: 01:30, rev2: 02:00, rev3: 02:30, rev4: 03:00 KST)
>
> **Author**: Claude Code (Opus 4.7, 1M context)
>
> **Pre-plan review**: 4 rounds (round-cap 5) — Round 1 FAIL → Round 2 FAIL → Round 3 FAIL → Round 4 CONCERN with explicit accepts (no P1).
>
> **Ledger**: [`docs/ai-workflow/runs/2026/05/23/20260523-0100-implementation-coverage-audit-plan.md`](../runs/2026/05/23/20260523-0100-implementation-coverage-audit-plan.md)
>
> **Audience**: both (user-facing 라우트 + admin 라우트 양쪽 분석)

## 1. User Goal & Problem Statement

사용자 요청 원문:

> "docs/IA와 docs/ia-pages, docs/prd.md, docs/flow, docs/user-flow.md 등 이 프로젝트 개발을 위해 참고한 문서들을 다시 바라보고 **현재 구현이 안 됐거나 잘못됐거나 부족한 부분**을 찾고 보고서를 만들어. 정확한 분석을 위해 **직접 각 페이지를 브라우저에 띄워보기도** 해야 할 거야."

배경 (현재 발견된 신호 — 본 plan을 트리거한 사고):

- **신호 1**: 사용자가 dev 서버에서 `/`로 들어가니 `학습 워크스페이스 준비 중`이라는 Phase 3 시절 placeholder 발견 (`src/app/page.tsx:6`). 사이트맵에는 X-01 "Product landing"으로 명시.
- **신호 2**: `/login`이 `로그인 UI는 다음 단계(Phase 3)에서 제공됩니다`라는 거짓 안내 placeholder. `/sign-up`, `/password-reset`도 동일. 즉 **인증 UI 3개가 통째로 누락**.
- **신호 3**: Supabase 원격 프로젝트가 빈 상태 — 마이그레이션 21개 파일은 있으나 한 번도 적용된 적 없음. `supabase/config.toml` 없음.
- **신호 4**: Phase 6 ledger는 "Tier 1 MVP 종결"이라 선언했으나, 실제로는 **사용자가 가입 → 로그인 → 대시보드로 가는 골든 패스가 끝까지 안 감**. 메모리 인덱스의 "UI 완료 보고 전 dev 서버 부팅 의무" (2026-05-22 사고)와 본질적으로 같은 종류의 누락 가능성.

문제 정의:

각 Phase ledger가 "그 phase 범위 안에서 PASS"만 검증했고, **전체 사용자 여정 종단(end-to-end)이 정본 docs대로 작동하는가**를 검증한 적이 없다. 32-screen Paper IA가 정본인데, 그것과 실제 구현(코드 + 브라우저 동작)의 매트릭스 비교를 한 번도 수행하지 않았다. 따라서 **신호 1~3 외에 더 많은 누락이 있을 가능성이 높고**, 그 카탈로그 없이는 다음 phase 우선순위를 정할 수 없다.

## 2. Accepted Scope

- **분석 범위**: docs/sitemap.md Target React Route Map의 32개 active 라우트 = docs/IA/01~32 한 페이지씩 + 모달 5개 (C-03, D-M1, D-M2, D-M3, F-M1).
- **정본 docs**: docs/sitemap.md, docs/IA/{N}/description.md (×32), docs/prd.md (Future scope 제외 부분), docs/flow/user-flow.md, docs/spec.md, docs/ant-design/* (검사 항목 기반).
- **레거시 (참고만)**: docs/ia-pages/*, docs/user-flow.md — 정본 충돌 발견 시 정본 우선, "doc 자체 모호함" finding으로 분류.
- **검증 매체**: (a) 코드 정적 read (src/app/**, src/components/**, src/lib/**), (b) 정본 docs 정적 read, (c) **브라우저 동작 확인** (dev 서버 + 로컬 Supabase + 시드 사용자), (d) 3개 breakpoint 반응형 매트릭스 (360/768/1280).
- **산출물**: HTML 보고서 1건 + ledger 1건 + (선택) Phase 7 후보 plan 시드 1건.

## Out of Scope — Intentional Cuts

| Item | Reason |
| --- | --- |
| 구현/수정/리팩토링 | 본 작업은 **분석만**. 발견된 결함은 우선순위만 매기고 별도 phase로 분리 |
| docs/ia-pages 19개 레거시 페이지 검증 | 사용자 결정 (Tier 1 active만). 레거시는 정본 아니라 "이 정본 자체가 레거시와 충돌하는가"만 plan 진행 중 발견 시 finding |
| Future scope (모의고사, 단어장, 게시판) | docs/prd.md에 명시적으로 "Future / 별도 IA 필요"로 분리됨. Paper frame 32개 밖 |
| Ant Design detail docs 자체의 완결성 검증 | 메타 작업. 본 plan은 그 docs를 "정본"으로 사용하지 구조 자체를 감사 안 함 |
| Tier 2 OOS 11개 항목 자체의 구현 검증 | Phase 6 ledger에 이미 명시적으로 OOS로 박혀 있음 (Real LLM, Realtime, Stripe, Playwright, full admin CRUD, export queue worker, i18n, audit view, notification transport, server analytics, bulk ops). Tier 2는 "원래 안 하기로 한 것"으로 finding 카테고리만 분류 |
| Supabase 스키마 자체의 정합성 재검증 | Phase 2 Codex 5라운드에서 이미 확인됨 (`20260520-1149-schema-parallel-analysis.md`). 마이그레이션 적용이 안 됐는지만 본 plan에서 확인 |
| 실제 LLM 호출 결과의 품질 평가 | LLM 자체는 Tier 2 OOS-1. 본 plan은 "LLM 자리에 mock/stub이 있는가, 그게 정본대로 fail 안 하나"까지만 |
| 다국어 (i18n) 번역 품질 | Tier 2 OOS-7. 본 plan은 한국어 UI 한정 |
| 결제(Stripe) 동작 | Tier 2 OOS-3. /paywall, /subscription은 "shell만 있는가"까지 |

## Smallest Buildable Unit

**(rev2 — Sliced for Commit Safety, Codex Round 2 NF-P1-1 반영)**

rev1의 3-way 분할은 SBU-B에서 시크릿/세션 artifact를 만들고 cleanup을 SBU-C로 미루면 **두 SBU 사이 commit/PR이 시크릿을 가져갈 위험**을 만들었다 (Codex NF-P1-1). 따라서 rev2는 다음 원칙을 적용한다:

**원칙**: SBU-A는 외부 의존 0의 정적 분석이라 독립 PR 가능. **SBU-B와 SBU-C는 단일 비공개 실행 슬라이스**로 묶이며, 모든 cleanup(secret/session artifact 삭제 + .gitignore 재확인)이 완료된 **이후에만** 그 슬라이스에서 산출물 PR을 생성한다. PR 분할은 산출물 차원에서만 (보고서 PR ≠ 분석 코드).

**SBU-A (독립 PR — 정적 매핑만, 외부 의존 0)**:
- Scope: Task 2만. docs/IA × 32 + src/app/** + src/components/** 정적 read만으로 가능
- 외부 의존: 없음. Docker 미설치, Supabase 미부팅 환경에서도 즉시 실행 가능
- 산출물: `analysis/coverage-matrix.md` 32 행 × (route / 페이지 파일 존재 / placeholder 텍스트 감지 / 정본 출처) + 한 줄 결론
- PR 생성: 즉시 가능 (산출물만, 코드 변경 없음)
- 사용자 가치: 이 표 단독으로 "어느 라우트가 살아있고 어느 것이 placeholder인가" 결정 가능

**SBU-B+C (단일 실행 슬라이스 — 로컬 Supabase + 브라우저 검증 + 보고서 + cleanup)**:
- Scope: Task 1 (Supabase setup + Auth Admin API 시드 + Playwright storageState 인증) + Task 3 (요구사항 매트릭스 **5 batch**) + Task 4 (Playwright 32×3 browser 매트릭스) + Task 5 (Findings 집계) + Task 6 (HTML 보고서) + Task 7 (cleanup + Finish 4중 검증) + Task 8 (Codex post-audit)
- 외부 의존: Docker Desktop + 사용자 PC service role key
- **PR 생성 금지 시점**: Task 1~6 진행 중에는 어떤 commit/PR도 생성하지 않는다 (시크릿/세션/스크린샷 artifact 활성 상태).
- **PR 생성 허용 시점**: Task 7 cleanup 완료 + Finish 4중 검증 모두 PASS 직후 한 번. 이때 산출물 (`reports/*.html`, `analysis/findings.md` 등)만 staging.
- 산출물: Per-page 5-dimension grade + 96 스크린샷 + 콘솔 에러 카탈로그 + 한국어 바이브 코더 HTML 보고서 + Phase 7 후보 plan 시드
- 사용자 가치: 정본 vs 실제 동작 매트릭스 — 어느 페이지가 정본 docs대로 진짜 작동하나

**.gitignore 사전 갱신 (Task 1 시작 전 의무)**:
- `scripts/audit-setup/`
- `tests/e2e/auth-state/`
- `screenshots/`
- `tests/e2e/coverage/failure-log.json`
- `analysis/` (임시 작업 폴더 — 산출물 commit 시점에는 `reports/` 또는 plan/ledger로 승격된 파일만 staging)
- `.env.local.bak`
- 이 변경은 SBU-A보다 먼저 .gitignore에 박혀야 하며 (small PR 또는 SBU-A PR에 포함), 본 plan rev2의 Task 1 step 0으로 명시

## 5. Audit Method — Per-screen Rubric

각 32 페이지마다 다음 5개 차원에서 PASS/FAIL/MISSING/PARTIAL/OOS 판정:

### 5.1 Route Presence (라우트 존재)

- 정본: docs/sitemap.md Target React Route Map의 route 컬럼
- 검증: `src/app/**/page.tsx` 파일 존재 여부
- 결과: PRESENT / MISSING

### 5.2 Page-Level Implementation (페이지 구현 깊이)

- 정본: `docs/IA/{N}/description.md` 의 "이 화면에 어떤 영역/버튼/정보/상태가 있어야 하는가"
- 검증: 페이지 컴포넌트 + import한 sub-component 트리 read → description.md의 각 요구사항이 (a) DOM에 실재 (b) 빈 컴포넌트만 (c) placeholder 텍스트 (d) 누락 중 어느 쪽인가
- 결과: 요구사항별 PASS/PARTIAL/PLACEHOLDER/MISSING + 비율 점수 (예: 7/10 항목 PASS)

### 5.3 Data Wiring (데이터 연결)

- 정본: docs/prd.md "7. 기능 요구사항" 해당 섹션 + docs/spec.md §Persistence + Supabase RPC/RLS
- 검증: 페이지가 (a) 실제 DB에서 데이터 fetch하는가 (Server Component / TanStack Query) (b) 고정 mock인가 (c) 빈 상태인가
- 결과: WIRED / MOCKED / EMPTY / OOS (Tier 2 의도된 mock)

### 5.4 Browser Reality (실제 동작)

- 정본: docs/flow/user-flow.md 에서 해당 페이지의 이전/다음 화면 + docs/IA 의 user action
- 검증: dev 서버에서 시드 사용자로 로그인 → 해당 URL 진입 → IA의 핵심 user action 1~3개 직접 클릭/입력 → 콘솔 에러 캡처 + 다음 화면 도달 여부 확인
- 결과: WORKS / BREAKS — <에러 요약> / BLOCKED — <차단 사유>

### 5.5 Responsive & A11y Sanity (반응형/접근성 간이)

- 정본: docs/ant-design/02-global-styles.md (breakpoint) + docs/ant-design/07-review-checklist.md (a11y)
- 검증: 360/768/1280 3개 breakpoint 스크린샷 + 키보드 Tab으로 핵심 컨트롤 도달 가능한가 1점만 (간이)
- 결과: OK / BROKEN — <breakpoint + 증상>

### 5.6 차원 라벨 → PASS/PARTIAL/FAIL 정규화 (rev1, Codex P1-1 반영)

각 차원의 원시 라벨을 종합 등급 산출 전 다음과 같이 정규화한다:

| Dimension | PASS 매핑 | PARTIAL 매핑 | FAIL 매핑 | BLOCKED 매핑 |
| --- | --- | --- | --- | --- |
| §5.1 Route | PRESENT | — | MISSING | — |
| §5.2 Page | (요구사항 항목 80% 이상 PASS) | (50-79% PASS) or PLACEHOLDER만 | (50% 미만) or MISSING | — |
| §5.3 Data | WIRED (실 DB) | MOCKED (의도된 mock 또는 fixture 의존) | EMPTY (빈 상태 + 정본은 데이터 요구) | OOS (Tier 2로 명시 제외) |
| §5.4 Browser | WORKS | — | BREAKS — <에러> | BLOCKED — <차단 사유> |
| §5.5 Responsive | OK | — | BROKEN — <bp+증상> | — |

### 5.7 종합 등급 (rev1 — grade caps 추가)

각 페이지의 5개 차원 정규화 결과를 다음 5단계로 압축. **Grade caps**가 우선 적용된다:

**Grade caps (먼저 적용)**:
- 어느 차원이라도 BLOCKED → 종합 등급 최대 **YELLOW** (GREEN 불가). 보고서에 "BLOCKED 차원 + 사유" 명시.
- §5.3 Data 차원이 MOCKED → Data 차원은 PARTIAL로만 집계 (PASS로 올라가지 못함). Codex P1-4 fixture false-positive 차단용.
- §5.3 Data 차원이 OOS → 종합 등급 산출에서 해당 차원 제외 + WHITE 카테고리 별도 표기.
- §5.4 Browser 차원이 BREAKS → 종합 등급 최대 **ORANGE**.

**등급 산출 (cap 적용 후)**:
- 🟢 **GREEN**: 5/5 PASS (cap 적용 후) — 정본과 완전 일치, 즉시 출시 가능
- 🟡 **YELLOW**: 4/5 PASS 또는 1-2개 PARTIAL 또는 BLOCKED cap — 사용 가능하지만 정본 일부 미반영 또는 검증 차단
- 🟠 **ORANGE**: 2-3/5 PASS 또는 Browser BREAKS cap — 핵심 기능은 살아있으나 다수 누락/오류
- 🔴 **RED**: 0-1/5 PASS — placeholder/사용 불가
- ⚪ **WHITE (OOS)**: Tier 2로 명시적 제외 — Phase 6 ledger의 OOS 11개에 해당하면 의도된 누락

**Reporting rule**: Data 차원이 MOCKED인 페이지는 보고서에 별도 컬럼 `Browser-with-fixture vs Implementation-data-wiring` 2칸 기록 — "fixture 도움 받으면 작동 / 실 구현은 mock"임을 사용자가 즉시 식별 가능. 본 분리는 Codex P1-4 R-9 mitigation의 기록 형식.

## 6. Findings Classification & Severity

각 finding은 다음 항목 모두 기록:

| 필드 | 내용 |
| --- | --- |
| IA ID | A-01, B-01, ... X-10 중 하나 |
| 정본 출처 | 파일 경로 + 줄 번호 |
| 코드 증거 | 파일 경로 + 줄 번호 또는 "코드 없음" |
| 브라우저 증거 | 스크린샷 경로 + 핵심 user action 결과 |
| 차원 | Route / Page / Data / Browser / Responsive 중 하나 이상 |
| 심각도 | P0/P1/P2/OOS |
| 분류 | MISSING / WRONG / PARTIAL / DOC-AMBIGUOUS |
| 제안 행동 | 한 줄 |

### Severity 정의

- 🔴 **P0**: 사용자가 골든 패스(가입 → 로그인 → 대시보드 → 첫 학습) 한 발도 못 옮김. 또는 보안 위험 (RLS 우회 등). **즉시 막아야**.
- 🟡 **P1**: 사용자가 골든 패스는 통과하나 핵심 기능이 정본과 다르거나 부분 누락. **다음 phase에서 채워야**.
- 🟠 **P2**: 사용성/디자인/일관성 결함, 비정상 흐름 (예외 처리 누락 등). **여유 있을 때 채워야**.
- ⚪ **OOS**: Tier 2 의도된 누락. **finding으로 기록하되 우선순위 아님**.
- 📄 **DOC-AMBIGUOUS**: 정본 docs 자체가 모호해 PASS/FAIL 판정 불가. **docs 보강 follow-up**.

## 7. Browser-Driven Verification Setup (rev1 — Codex P1-2, P1-3 반영)

### 7.1 사전조건 (Task 1) — 시드는 Auth Admin API, 인증은 Playwright storageState

**SBU-B 시작 시점에 1회 수행.** Codex Round 1 P1-2 (seed.sql ↔ R-6 충돌) + P1-3 (dev-login 누출 위험) 모두 반영.

#### 7.1.1 Supabase 로컬 부팅

1. Docker Desktop 가동 확인 (사용자 환경)
2. `pnpm dlx supabase init` → `supabase/config.toml` 생성
3. `pnpm dlx supabase start` → 로컬 인스턴스 부팅 (postgres, auth, kong, studio)
4. `pnpm dlx supabase db reset` → 21개 마이그레이션 적용
5. `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`을 `http://127.0.0.1:54321` 로 임시 교체 — **`.env.local.bak` 백업 저장 후 변경**, Task 7 cleanup에서 복원

#### 7.1.2 시드 (Auth Admin API + 도메인 SQL 분리) — Codex P1-2 fix

- **Auth user 생성은 SQL 금지**. `auth.users`에 직접 INSERT는 Supabase 내부 인증 hash/trigger를 우회해 RLS 정책 무효화 위험 (Codex 지적, `docs/development/backend-auth.md:20-23` 참조).
- **Node 스크립트**: `scripts/audit-setup/seed-dev-users.mjs` (new)
  - `@supabase/supabase-js` admin client (`createClient(url, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })`)
  - **service role key는 로컬 `.env.local`에만**, 절대 commit 금지 — `.gitignore`로 보호 확인
  - `supabase.auth.admin.createUser({ email, password, email_confirm: true })` × 4명 (`student@dev.local`, `content-admin@dev.local`, `org-admin@dev.local`, `platform-admin@dev.local`)
  - 반환된 user id로 `profiles.app_role` 업데이트 (admin trio는 RPC 또는 직접 UPDATE — 본 스크립트는 service role이라 가능)
- **도메인 row SQL**: `supabase/seed.sql` (new) — `auth.users` 절대 건드리지 않음
  - 샘플 problems 5건 (D-01~D-04 + reading 1건)
  - sample writing_submissions 1건 (E-01/E-02 피드백 화면 분석용)
  - sample library_items 1건 (F-01 분석용)
  - sample recommendation_runs + items 1건 (R-02/X-07 분석용)
  - admin_audit_logs 1건 (X-08 분석용)
  - 모두 `seed_marker = 'audit_20260523'` 컬럼 또는 prefix로 Task 7 cleanup 시 단일 DELETE 가능
- **순서**: 1) `node scripts/audit-setup/seed-dev-users.mjs` (user id 반환) → 2) `psql ... -f supabase/seed.sql` (반환 id 환경 변수 주입) 또는 Node 스크립트 안에서 SQL도 일원화 실행 (선택)

#### 7.1.3 인증 — Playwright storageState (라우트 만들지 않음) — Codex P1-3 fix

- **Primary 채택**: `src/app/(dev)/dev-login/page.tsx` 같은 **앱 라우트는 만들지 않는다**. Codex 지적 — NODE_ENV 가드만으로는 commit/build 누출 차단 부족.
- **구현**: `scripts/audit-setup/build-storage-state.mjs` (new)
  - Playwright `chromium.launch()` → 새 컨텍스트로 `/login` 또는 직접 `supabase.auth.signInWithPassword` API 호출
  - 4명 시드 사용자에 대해 각각 `tests/e2e/auth-state/{role}.json` 으로 storageState 저장
  - Playwright 스펙에서 `test.use({ storageState: 'tests/e2e/auth-state/student.json' })` 형식 사용
  - 스크립트는 `scripts/audit-setup/` 안에만 — 본 폴더 자체가 분석 phase 한정, Task 7 cleanup에서 통째 삭제
- **만약 (선택) 라우트가 꼭 필요하면** (Playwright 시드 실패 fallback):
  - `src/app/(dev)/dev-login/page.tsx` 작성 시 `if (process.env.NODE_ENV !== "development") notFound()` 의무 (NODE_ENV 가드 + `notFound()` 두 줄 + 페이지 최상단에 `// ANALYSIS-ONLY TEMP CODE — DO NOT COMMIT` 주석)
  - **하지만 Primary 권장**: 이 fallback도 결국 Task 7 cleanup 의존이라 위험 동등 — Playwright storageState가 더 안전
- **Finish 자동 검증** (Task 7 cleanup 직후 의무, **rev2 — 4중 검증**, Codex NF-P1-1 반영):
  - ① `git diff --name-only origin/main..HEAD` 결과에 `dev-login`, `audit-setup`, `auth-state`, `screenshots/`, `failure-log` 문자열 없을 것
  - ② `git status --porcelain --untracked-files=all` 결과에서 위 패턴 untracked 파일 없을 것 (`.gitignore`가 모두 잡아내는지 검증)
  - ③ `rg -i "dev-login|ANALYSIS-ONLY|audit-setup|SUPABASE_SERVICE_ROLE_KEY" src/` 결과 비어 있을 것
  - ④ `pnpm build` 후 `.next/server/app/` route manifest에 dev-login 경로 없을 것
  - 4개 모두 PASS여야 SBU-B+C 슬라이스에서 PR 생성 허용. 본 검증을 Task 7 ledger에 PASS 증거로 캡처.

### 7.2 브라우저 실행 (Task 4)

- Playwright (skills-lock.json 확인 — playwright-skill 사용 가능)
- 32 페이지 × 3 breakpoint = 96 스크린샷 + 32 페이지 핵심 user action 1-3개씩 자동화
- 콘솔 에러 + 네트워크 401/403/500 자동 캡처
- 스크린샷은 `screenshots/coverage-{ia-id}-{bp}.png` 형식, gitignore (분석 종료 시 보고서에 embed된 것만 남김)

### 7.3 Fallback

- Docker 미설치 시: `degraded — docker unavailable`. 차원 5.4 (Browser Reality)는 "BLOCKED — docker unavailable, code-only inference" 로 표기 + 사용자에게 명시 승인 요청 후 정적 분석만 진행.
- 원격 Supabase는 비어 있는 상태가 사용자 분석 환경이므로 fallback 후보 아님.

## 8. Final Deliverable Structure

### 8.1 HTML 보고서 (`reports/implementation-coverage-audit-20260523.html`)

구조 (한국어, 바이브 코더 톤, CLAUDE.md §Communication Style 준수). **rev2 — 10 섹션** (Codex Round 2 NF-P2-2 반영, "Remote Supabase schema status" 명시 섹션 추가):

1. **한 줄 결론** — "Tier 1 MVP는 X/32 페이지가 GREEN, Y개 RED, Z개 OOS. 골든 패스는 N단계에서 끊김."
2. **3카드 신호등 스코어보드** — GREEN/YELLOW/RED 페이지 수 + 골든 패스 진행도 + Tier 2 OOS 비율
3. **골든 패스 다이어그램** — Mermaid 또는 카드 흐름으로 가입 → 로그인 → ... → 다음 문제 추천까지 어느 단계에서 끊기는지 시각화
4. **Remote Supabase schema status** — 한 줄 보고: "원격 Supabase 마이그레이션 적용 상태 = (적용 됨 / 빈 상태 / unknown). 본 분석은 (로컬 / 원격) 데이터로 수행." Codex NF-P2-2 반영. fixture false-positive 위험을 사용자가 즉시 식별 가능.
5. **32 페이지 매트릭스 표** — IA ID / route / 종합 등급 / 차원별 결과 / **Browser-with-fixture vs Implementation-data-wiring 2칸** / 핵심 finding 한 줄
6. **우선순위 액션 리스트** — P0 (지금 당장) / P1 (이번 주 안에) / P2 (여유 있을 때)
7. **Tier 2 (의도된 누락) 인벤토리** — OOS 11개 + 본 분석에서 추가 발견된 OOS
8. **DOC-AMBIGUOUS 인벤토리** — 정본 docs 자체 모호 항목 + 보강 제안
9. **방법론 부록** — 본 plan §5/§6 요약
10. **용어집** — 바이브 코더용

### 8.2 ledger (`docs/ai-workflow/runs/2026/05/23/20260523-{HHMM}-implementation-coverage-audit-execution.md`)

별도 phase ledger로 분석 실행 추적. 본 plan은 plan 단계 ledger와 분리.

### 8.3 Phase 7 후보 plan 시드 (선택, `docs/ai-workflow/plans/20260524-phase-7-coverage-gap-fill.md`)

분석 결과 P0/P1 항목을 그대로 Phase 7 task 후보로 정리. 사용자가 승인하면 별도 Plan-Review 절차로 진행.

## 9. Verification Strategy

`docs/ai-workflow/review-gates.md`의 적용 가능 게이트를 모두 명시 (Required Output Before Coding 의무):

| Gate | 본 plan 적용 | 분석 실행 phase 적용 |
| --- | --- | --- |
| TDD | exception — doc-only plan | applicable — Task 4 Playwright 스크립트는 TDD 가능 |
| Cross-model review | **mandatory — Codex GPT 5.5 (사용자 명시 요청)** | mandatory — finding 결과를 Codex가 cross-review |
| Plan-Review PASS Gate | **mandatory — round-cap 3-5** | n/a (분석 결과는 plan 아닌 보고서) |
| Code/Doc Review | applicable — plan 본문 자체 검토 | applicable — 보고서 본문 + Phase 7 후보 plan |
| Architecture Pass | skipped — 코드 boundary 변경 없음 | skipped — 분석 only, 단 분석에서 발견한 boundary 위반은 finding으로 기록 |
| UX/UI Consistency Pass | skipped — non-UI doc | skipped — 분석 only (단, finding 자체는 UX/UI 차원 평가 포함) |
| QA Gate | skipped — non-UI doc | **passed 목표 — 32 페이지 × 3 bp 브라우저 직접 확인이 분석 본체** |
| Finish | applicable — verification-before-completion + ai-workflow-check.mjs | applicable — 동일 |

## 10. Tasks (rev3 — SBU 라벨 A / B+C 통합 + Lifecycle 컬럼 추가)

각 task에 SBU 라벨(A 또는 B+C) 명시. Task 3은 audience batch 5개로 분리(Codex Round 1 P2-3). **Lifecycle 컬럼**(rev3, Codex Round 3 NF3-P2-2 반영): 각 생성 파일이 (`durable` — 산출물 PR에 포함 / `delete` — Task 7 cleanup / `gitignore` — `.gitignore` 패턴으로 영구 무시) 중 하나.

| # | Task | Files (with lifecycle) | Audience | SBU | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- | --- | --- |
| 0 | **Pre-Task** — `.gitignore` 사전 갱신 (`scripts/audit-setup/`, `tests/e2e/auth-state/`, `screenshots/`, `tests/e2e/coverage/failure-log.json`, `analysis/`, `.env.local.bak`) — SBU-A PR 또는 별도 small PR | `.gitignore` — **durable** (modify) | n/a | A | N — 환경 안전 사전 작업, main session |
| 1 | Setup: Supabase 로컬 부팅 + Auth Admin API 시드 + Playwright storageState (라우트 없음) | `supabase/config.toml` — **durable** (new, 향후 dev 환경에서도 유용), `supabase/seed.sql` — **durable** (new, 도메인 row only, auth.users 안 건드림 — dev 시드로 재사용 가능), `scripts/audit-setup/seed-dev-users.mjs` — **delete** (Task 7), `scripts/audit-setup/build-storage-state.mjs` — **delete** (Task 7), `tests/e2e/auth-state/*.json` — **gitignore + delete** (Task 7), `.env.local.bak` — **gitignore + delete** (Task 7) | both | B+C | N — 사용자 docker 확인 + service role key 필요, main session이 직접 |
| 2 | 32-페이지 정본 vs 코드 라우트 매핑 표 (**SBU-A 1차 산출물**) | `analysis/coverage-matrix.md` — **gitignore + promote** (작업 중엔 gitignored, SBU-A PR 직전에 승격), `reports/sbu-a-coverage-matrix-20260523.md` — **durable** (SBU-A PR commit 대상) | both | A | Y — Explore 서브에이전트로 docs/IA/* 32 페이지 + src/app/** 동시 read 후 표 생성. 외부 의존 없음 |
| 3a-1 | Batch 1 — Public landing + Auth (비로그인 진입점) 차원 1-3+5 매트릭스 | `analysis/batch-1a-public.md` — **gitignore + Task 6에 통합 + delete** | both | B+C | Y — 라우트 4개 (X-01, A-01, A-02, X-06). audience는 contract 허용값 `both` 사용 — 비로그인 + 인증 후 처리 양쪽 분석 |
| 3a-2 | Batch 1 — Onboarding 차원 1-3+5 매트릭스 | `analysis/batch-1b-onboarding.md` — **gitignore + Task 6에 통합 + delete** | user | B+C | Y — 라우트 1개 (A-03), 인증 후 진입 |
| 3b | Batch 2 — Learning core 차원 1-3+5 매트릭스 | `analysis/batch-2-learning.md` — **gitignore + Task 6에 통합 + delete** | user | B+C | Y — 라우트 7개 (B-01, C-01, C-02, C-03, R-02, X-02, X-07) |
| 3c | Batch 3 — Writing + Feedback 차원 1-3+5 매트릭스 | `analysis/batch-3-writing.md` — **gitignore + Task 6에 통합 + delete** | user | B+C | Y — 라우트 11개 (D-01~04, D-M1, D-M2, D-M3, E-01, E-02, R-01, F-M1 부분) |
| 3d | Batch 4 — Library + Settings + Profile + Subscription 차원 1-3+5 매트릭스 | `analysis/batch-4-library.md` — **gitignore + Task 6에 통합 + delete** | user | B+C | Y — 라우트 6개 (F-01, G-01, X-05, X-09, X-03, X-04) |
| 3e | Batch 5 — Admin 차원 1-3+5 매트릭스 | `analysis/batch-5-admin.md` — **gitignore + Task 6에 통합 + delete** | admin | B+C | Y — 라우트 3개 (H-01, X-08, X-10), 명시적 admin audience packet |
| 4 | 브라우저 차원 5.4 자동 검증 — Playwright 32 페이지 × 3 breakpoint + storageState 기반 핵심 user action + Windows-specific 안정화 + Remote Supabase schema status 캡처 | `tests/e2e/coverage/*.spec.ts` — **durable** (향후 phase 7 회귀 테스트 시드로 재사용. storageState 의존 없게 작성), `playwright.config.ts` — **durable** (프로젝트 표준 e2e 설정으로 유지), `screenshots/` — **gitignore + delete** (Task 7), `tests/e2e/coverage/failure-log.json` — **gitignore + delete** (Task 7), `analysis/remote-supabase-status.md` — **gitignore + Task 6에 통합 + delete** | both | B+C | Y — Playwright 스크립트 실행, 단 Task 1 완료 후 |
| 5 | Findings 집계 + 우선순위 (P0/P1/P2/OOS/DOC-AMBIGUOUS) + Browser-with-fixture vs Implementation-data-wiring 분리 기록 | `analysis/findings.md` — **gitignore + Task 6에 통합 + delete** | both | B+C | N — Task 2/3/4 통합 분석, main session |
| 6 | 최종 HTML 보고서 (한국어 바이브 코더 톤, §8.1 10 섹션 구조) — 모든 `analysis/batch-*.md` + `analysis/findings.md` + `analysis/remote-supabase-status.md` 내용을 본 HTML에 통합 | `reports/implementation-coverage-audit-20260523.html` — **durable** (최종 산출물 PR) | both | B+C | N — 최종 산출물 |
| 7 | Cleanup — `scripts/audit-setup/` 통째 삭제 + `tests/e2e/auth-state/` 삭제 + `screenshots/` 비우기 + `analysis/` 통째 삭제 (Task 6에서 reports/로 통합 완료 확인 후) + `.env.local` 복원 + `.env.local.bak` 삭제 + Finish 자동 검증 **4중** PASS 증거 캡처 (rev2) | `scripts/audit-setup/` (delete), `tests/e2e/auth-state/` (delete), `screenshots/` (delete contents), `analysis/` (delete after Task 6 통합 확인), `.env.local` (restore from .bak), `.env.local.bak` (delete after restore), ledger에 `git diff` + `git status --porcelain --untracked-files=all` + `rg` + `pnpm build` route manifest 4개 결과 박기 | both | B+C | N — 보안 위험 회수, main session. **PR 생성 직전에만 수행** |
| 8 | Codex post-audit cross-review (사용자 명시 요청과 별개 의무) + Phase 7 후보 plan 시드 (선택) | `tasks/codex-post-audit-review-{run_id}.output` — **durable** (검토 기록), `docs/ai-workflow/plans/20260524-phase-7-coverage-gap-fill.md` — **durable** (new, optional) | both | B+C | N — Codex 호출 + 결과 통합 |

## 11. Smallest Buildable Unit — Restated (rev3 — §4와 일치)

**SBU-A = Task 2 단독** — docs/IA × 32 + src/app/** 정적 read만으로 가능, **외부 의존 0**. Docker/Supabase 미부팅 환경에서도 즉시 실행되어 32-라우트 매핑 표를 산출. 이 표 단독으로 "어느 라우트가 살아있고 어느 것이 placeholder/누락인가" 결정 가능. SBU-A는 산출물만의 독립 PR.

SBU-A 완료 후 **SBU-B+C 단일 비공개 실행 슬라이스**로 진행 (브라우저 검증 + 보고서 + cleanup + cross-review). 본 슬라이스는 Task 1~6 진행 중 commit/PR 생성 금지, Task 7 cleanup + Finish **4중** 검증 PASS 후에만 PR 생성. **본 분할의 핵심**: SBU-A는 사용자가 docker를 켜기 전에도 1차 산출물 제공 가능, SBU-B+C는 시크릿/세션 artifact가 PR 사이에 누출되지 않도록 단일 슬라이스. Codex Round 1 P2-1 + Round 2 NF-P1-1 + Round 3 NF3-P1-1 반영.

## 12. Risks (rev1 — R-2/R-6/R-8 재작성 + R-9 추가 / Codex P1-2, P1-3, P1-4, P2-2 반영)

| ID | Risk | Mitigation |
| --- | --- | --- |
| R-1 (rev3) | Plan이 너무 야심차 (32×3×rubric ≈ 1500+ 데이터 포인트) | **SBU-A / SBU-B+C 2분할** (rev3: rev1의 3분할이 secret cleanup risk 만들어 단일 슬라이스로 통합). SBU-A 단독은 외부 의존 0, 도커 없이도 1차 산출물 제공. SBU-B+C는 Task 1~6 commit/PR 금지 + Task 7 cleanup + Finish 4중 검증 후 단일 PR |
| R-2 (rev3 — Finish 4중) | dev-login 코드 / 시드 세션 artifact가 production build/commit에 누출 | **Primary**: 라우트 자체 만들지 않음 (Playwright storageState만 사용). **Fallback 시**: NODE_ENV + `notFound()` 이중 가드. Task 7 cleanup 후 **Finish 4중 자동 검증**: ① `git diff --name-only origin/main..HEAD`에 dev-login/audit-setup/auth-state/screenshots/failure-log 없을 것 ② `git status --porcelain --untracked-files=all`에 위 패턴 untracked 파일 없을 것 ③ `rg -i "dev-login|ANALYSIS-ONLY|audit-setup|SUPABASE_SERVICE_ROLE_KEY" src/` 비어 있을 것 ④ `pnpm build` 후 route manifest에 dev-login 없을 것. 4개 모두 PASS여야 SBU-B+C 슬라이스 PR 생성 허용 |
| R-3 (rev4) | Docker 미설치 → 차원 5.4 Browser Reality 불가 | SBU-A는 외부 의존 0이라 즉시 진행. SBU-B+C는 degraded 모드 (사용자 명시 승인 후 정적 분석만 + 잔여 위험 명시) |
| R-4 | 정본 docs 자체 모호 (예: docs/prd.md의 Future scope 경계) | DOC-AMBIGUOUS 카테고리 별도 분류, 구현 결함과 구분 |
| R-5 | Codex가 plan에 동의 안 함 (round-cap 5 초과) | 사용자 escalation, plan 핵심 트레이드오프 1페이지 요약 제출 |
| R-6 (재작성) | Direct `auth.users` SQL insert가 Supabase 내부 인증 hash/trigger 우회해 RLS 무효화 | **`supabase/seed.sql`은 도메인 row만**, `auth.users` 절대 안 건드림. 시드 사용자 생성은 별도 Node 스크립트 `scripts/audit-setup/seed-dev-users.mjs`에서 `supabase.auth.admin.createUser` API 호출. service role key는 `.env.local` 로컬 한정, `.gitignore` 보호 |
| R-7 | 분석 도중 사용자가 코드 수정해서 진단 결과 무효화 | 분석 시작 commit hash 고정 + 보고서 frontmatter에 명시 |
| R-8 (재작성, Windows-specific) | Playwright 자동화가 Windows 환경에서 실패 | ① `pnpm dlx playwright install chromium` 으로 browser binary 사전 설치 검증 ② explicit `baseURL: 'http://127.0.0.1:3000'` 사용 ③ dev-server 부팅 후 `wait-on http://127.0.0.1:3000` health check 후 테스트 시작 ④ 스크린샷 실패는 1회 자동 retry ⑤ failure log를 `tests/e2e/coverage/failure-log.json` 에 저장. 모두 실패하면 manual fallback (사용자에게 32 페이지 manual 클릭 요청) |
| R-9 (신규 — Codex P1-4) | Fixture/mock이 페이지를 PASS처럼 보이게 해서 실제 누락을 숨김 (audit 본래 목적 위협) | **§5.6 정규화 표의 Grade caps 적용**: Data 차원이 MOCKED면 PARTIAL로 cap, 종합 등급 GREEN 불가. **§5.7 reporting rule**: Browser-with-fixture vs Implementation-data-wiring 2칸 분리 기록. **추가 검증**: 보고서에 "Remote Supabase schema status" 별도 한 줄 — 마이그레이션이 원격에 적용됐는가, fixture로만 작동하는가 명시. |

## 13. Acceptance Criteria (rev2 — task별/SBU 체크포인트별 / Codex Round 2 NF-P1-2 반영)

### SBU-A 완료 게이트 (PR 생성 직전)

- [ ] **Task 0 PASS**: `.gitignore`에 6개 패턴 모두 추가됨 — `git check-ignore` 명령으로 각 패턴이 실제 동작하는지 검증 결과를 ledger에 기록
- [ ] **Task 2 PASS**: 매트릭스 산출물 (`reports/sbu-a-coverage-matrix-20260523.md`로 승격) 작성됨, 다음 필드 모두 32행 포함:
  - IA ID, route (sitemap.md line 참조), `src/app/**` page.tsx 파일 경로 (없으면 "MISSING"), placeholder 감지 결과 (정규식 매칭 결과 + 매칭된 텍스트 일부), 정본 출처 file:line, 1차 신호등 등급 (R/Y/O/G/W)
  - 한 줄 결론 ("X/32 GREEN, Y RED, Z OOS, 골든 패스 N단계 끊김" 형태)
- [ ] SBU-A ledger entry 작성됨 — `docs/ai-workflow/runs/2026/05/23/...-sbu-a-static-mapping.md` — 다음 필드 모두 채워짐: Docs Consulted (실제 file:line), Decisions (append-only), Verification State (cross-model review 결과 포함), Risks And Follow-Up

### SBU-B+C 실행 슬라이스 진행 중 (PR 생성 금지 구간)

- [ ] **Task 1 PASS**: Supabase 로컬 부팅 PASS + `supabase/seed.sql` (도메인 row only) + `scripts/audit-setup/seed-dev-users.mjs` (Auth Admin API) + `tests/e2e/auth-state/{role}.json` 4개 생성 + `.env.local.bak` 백업 확인
- [ ] **Task 3a-1 PASS**: `analysis/batch-1a-public.md` — 라우트 4개 (X-01, A-01, A-02, X-06) 각각 다음 필드 포함: §5.1 Route 결과 / §5.2 Page 결과 + IA description.md의 요구사항 항목별 PASS/PARTIAL/PLACEHOLDER/MISSING 표 / §5.3 Data 결과 (WIRED/MOCKED/EMPTY/OOS) + 정본 출처 file:line / §5.5 Responsive 결과 / 핵심 finding 한 줄 + 심각도
- [ ] **Task 3a-2 PASS**: `analysis/batch-1b-onboarding.md` — 라우트 1개 (A-03), 위와 동일 5필드 구조
- [ ] **Task 3b PASS**: `analysis/batch-2-learning.md` — 라우트 7개, 위와 동일 구조
- [ ] **Task 3c PASS**: `analysis/batch-3-writing.md` — 라우트 11개, 위와 동일 구조
- [ ] **Task 3d PASS**: `analysis/batch-4-library.md` — 라우트 6개, 위와 동일 구조
- [ ] **Task 3e PASS**: `analysis/batch-5-admin.md` — 라우트 3개, 위와 동일 구조
- [ ] **Task 4 PASS**: `tests/e2e/coverage/*.spec.ts` 32 페이지 spec 작성 + 96 스크린샷 생성 (또는 R-3 degraded 명시 승인) + `analysis/remote-supabase-status.md` 작성 + `tests/e2e/coverage/failure-log.json` 빈 배열 또는 R-8 mitigation 발동 기록
- [ ] **Task 5 PASS**: `analysis/findings.md` 작성 — 각 finding이 §6 8개 필드 모두 채움 + P0/P1/P2/OOS/DOC-AMBIGUOUS 분류 + 페이지마다 Browser-with-fixture vs Implementation-data-wiring 2칸 분리 기록
- [ ] **Task 6 PASS**: `reports/implementation-coverage-audit-20260523.html` 작성 — §8.1 **10 섹션** 모두 포함 (한 줄 결론 / 3카드 스코어보드 / 골든 패스 다이어그램 / **Remote Supabase schema status** / 32 페이지 매트릭스 / 우선순위 액션 / Tier 2 인벤토리 / DOC-AMBIGUOUS 인벤토리 / 방법론 부록 / 용어집), 한국어 바이브 코더 톤

### SBU-B+C PR 생성 직전 cleanup 게이트 (Task 7)

- [ ] **Task 7 cleanup**: `scripts/audit-setup/`, `tests/e2e/auth-state/`, `screenshots/` 통째 삭제 + `.env.local` `.env.local.bak`에서 복원
- [ ] **Finish 4중 자동 검증 모두 PASS** (rev2):
  - [ ] ① `git diff --name-only origin/main..HEAD` 결과에 `dev-login`/`audit-setup`/`auth-state`/`screenshots/`/`failure-log` 패턴 없음
  - [ ] ② `git status --porcelain --untracked-files=all` 결과에 위 패턴 untracked 파일 없음
  - [ ] ③ `rg -i "dev-login|ANALYSIS-ONLY|audit-setup|SUPABASE_SERVICE_ROLE_KEY" src/` 결과 비어 있음
  - [ ] ④ `pnpm build` 후 `.next/server/app/` route manifest에 dev-login 경로 없음
- [ ] 4중 검증 결과를 ledger의 §Verification State에 그대로 박음 (커맨드 출력 그대로)

### 슬라이스 종료 직후 (Task 8)

- [ ] **Task 8 PASS**: Codex post-audit cross-review 호출 → PASS (또는 CONCERN with explicit accepted) → 결과를 `tasks/codex-post-audit-review-{run_id}.output`로 저장
- [ ] **선택**: Phase 7 후보 plan 시드 작성 — P0/P1 finding이 5개 이상이면 의무, 미만이면 선택
- [ ] SBU-B+C ledger 작성됨 — `docs/ai-workflow/runs/2026/05/23/...-sbu-bc-browser-and-report.md` — 다음 필드 모두 채워짐: Docs Consulted (실제 file:line), Decisions (append-only with Codex Round 결과), Verification State (Architecture Pass / UX-UI Pass / QA Gate / Cross-model 모두 명시), Fallback State (degraded 사용 시 blocker + 대체 검증 + 잔여 위험), Risks And Follow-Up
- [ ] `node scripts/ai-workflow-check.mjs --repo .` PASS — 모든 ledger 게이트 필드 채워짐

### 전체 plan 종료 게이트

- [ ] SBU-A 완료 게이트 + SBU-B+C 완료 게이트 + Task 7 cleanup 게이트 + Task 8 게이트 모두 PASS
- [ ] 사용자가 보고서 1줄 결론을 즉시 이해 가능 (테스트: "Tier 1 MVP는 X/32 GREEN, 골든 패스 N단계에서 끊김" 형태)
- [ ] Phase 7 우선순위 결정에 즉시 쓸 수 있는 P0/P1 리스트 존재

## 14. Cross-Model Review Plan

### 14.1 Pre-plan review (본 plan 자체)

- **Reviewer**: Codex GPT 5.5 (codex CLI consult mode, reasoning=medium)
- **Task packet 내용**:
  - 사용자 요청 원문 (§1)
  - 본 plan 전체 (특히 §3 Out of Scope, §4 SBU, §5 Rubric, §10 Tasks, §12 Risks)
  - 정본 docs 위치 인덱스 (Codex가 spot-check 가능하도록)
  - PASS 기준: ① 32 페이지 분석을 위한 rubric이 정본 docs 모두에 매핑되는가 ② SBU가 충분히 작은가 ③ 임시 dev 로그인 코드의 보안 회수 절차가 명시적인가 ④ Out of Scope에 빠진 진짜 누락이 없는가 ⑤ Risk 8개 중 미적발이 없는가
  - 명시: "FAIL 또는 CONCERN 시 finding을 구체 줄 번호와 함께 반환. PASS 시 'no further findings' 명시."
- **Round-cap**: 3 (5까지 허용, 5 초과 시 사용자 escalation)
- **출력 형식**: Codex 출력 그대로 `tasks/codex-pre-plan-review-{run_id}.output` 에 저장 후 본 plan에 §15 Codex Findings 섹션으로 통합

### 14.2 Post-audit review (별도 phase, 분석 결과 보고서 대상)

- 분석 phase 실행 후 별도 ledger에서 진행
- 본 plan 범위 밖이지만 §13 Acceptance Criteria에 포함

## 15. Codex Findings

### Round 1 — 2026-05-23 01:20 KST — VERDICT: FAIL

Reviewer: codex-cli 0.128.0, exec mode (default reasoning). Output: `tasks/codex-output-pre-plan-review-20260523-0100.md`.

#### P1 (모두 rev1에 반영 완료)

| ID | Section | Issue | rev1 fix |
| --- | --- | --- | --- |
| P1-1 | §5.6 | 차원별 라벨(PRESENT/WIRED/WORKS/OK)이 PASS/PARTIAL/FAIL로 어떻게 정규화되는지 없음 → 등급 산출 일관성 깨짐 | §5.6 정규화 표 신설 + §5.7 grade caps 5종 추가 (BLOCKED→YELLOW cap, MOCKED→Data PARTIAL cap, OOS→차원 제외, BREAKS→ORANGE cap) |
| P1-2 | §7.1, §12 R-6 | `seed.sql`이 `auth.users` insert한다고 했으나 R-6는 Auth Admin API 써야 한다고 — 자기모순 | §7.1.2 재작성: `seed.sql`은 도메인 row만, 시드 사용자는 `scripts/audit-setup/seed-dev-users.mjs`의 `supabase.auth.admin.createUser` |
| P1-3 | §7.1, §12 R-2 | NODE_ENV 가드만으로는 dev-login 라우트 누출 차단 부족 | §7.1.3 재작성: **Primary**는 Playwright storageState (라우트 안 만듦). Fallback 시 NODE_ENV + `notFound()` 이중 가드 + Finish 자동 검증 3개 (`git diff`, `rg`, route manifest) PASS 의무 |
| P1-4 | §12 Risks | fixture/mock false-positive 위험 누락 — audit 본래 목적 위협 | R-9 신설 + §5.6 grade caps의 "MOCKED→Data PARTIAL cap" + §5.7 reporting rule "Browser-with-fixture vs Implementation-data-wiring" 2칸 분리 |

#### P2 (rev1에 같이 반영)

| ID | Section | Issue | rev1 fix |
| --- | --- | --- | --- |
| P2-1 | §4, §10 | SBU가 작긴 한데 Task 1(Supabase setup)이 SBU에 포함돼 여전히 무거움 | §4 SBU 3분할 (A/B/C). SBU-A = Task 2만, 외부 의존 0. §11 restated 갱신 |
| P2-2 | §12 R-8 | Playwright 위험이 generic — Windows-specific 항목 없음 | R-8 재작성: browser binary 사전 설치 / explicit baseURL / wait-on health / screenshot retry / failure log |
| P2-3 | §10 Tasks | Audience 컬럼 다 `both` — child task packet에 분리 정보 부족 | Task 3을 3a~3e 5 batch로 분리: 3a public+user / 3b user / 3c user / 3d user / 3e admin. 각 batch의 audience 명시 |

#### Missed by Opus

세 항목 모두 위 P1-4, P2-2, P1-2와 동일 카테고리 — rev1에서 동일 fix로 해소.

#### Round 1 SBU Assessment 반영

Codex 권고대로 SBU 3분할 채택 (A/B/C). SBU-A 단독은 외부 의존 0.

#### Round 1 Overall Recommendation 반영

"Revise with the P1s and re-run this pre-plan review" — 본 rev1 작성 + Codex Round 2 호출 예정.

### Round 2 — 2026-05-23 01:50 KST — VERDICT: FAIL

Reviewer: codex-cli 0.128.0, exec mode. Output: `tasks/codex-output-pre-plan-review-20260523-0200-round2.md`.

#### Round 1 finding 상태

| Round 1 ID | Round 2 Status | rev2 처리 |
| --- | --- | --- |
| P1-1 정규화 표 | RESOLVED | — |
| P1-2 seed 분리 | RESOLVED | — |
| P1-3 dev-login 회수 | PARTIAL → NF-P1-1 로 이어짐 | rev2에서 cleanup-in-SBU-B+C 슬라이스로 재구조화 |
| P1-4 fixture | PARTIAL → NF-P2-2 로 이어짐 | rev2에서 §8.1 4번 섹션 + §13 AC 추가 |
| P2-1 SBU 분할 | RESOLVED | — |
| P2-2 Windows Playwright | RESOLVED | — |
| P2-3 audience | PARTIAL → NF-P2-3 로 이어짐 | rev2에서 3a를 3a-1(public+landing)/3a-2(onboarding)로 분리, audience는 contract 허용값 `both`/`user` 사용 |

#### NEW P1 (rev2에 반영 완료)

| ID | Section | Issue | rev2 fix |
| --- | --- | --- | --- |
| NF-P1-1 | §4/§7.1.3/§10 | SBU 분할이 secret/session artifact cleanup을 SBU-B → SBU-C 사이에 미뤄 PR이 시크릿을 가져갈 위험. `.gitignore`도 `.env*`만 커버 | §4 SBU-B+C를 단일 비공개 실행 슬라이스로 묶음 (PR 생성 금지 구간 명시) + .gitignore Pre-Task 추가 (Task 0) + Finish 4중 검증 (`git status --untracked-files=all` 추가) + Task 7을 "PR 생성 직전에만 수행"으로 명시 |
| NF-P1-2 | §13 vs §10 | Acceptance Criteria가 새 task table과 mismatch — 3a-3e, SBU 체크포인트, 산출물 경로별 AC 없음 | §13 전면 재작성 — SBU-A 게이트 / SBU-B+C 진행 중 / cleanup 게이트 / 슬라이스 종료 / 전체 종료 5단계 체크리스트, 각 Task별 PASS 조건 + 산출물 경로 명시 |

#### NEW P2 (rev2에 반영)

| ID | Section | Issue | rev2 fix |
| --- | --- | --- | --- |
| NF-P2-1 | §4 | "4 batch"라고 했으나 §10은 5 batch | §4 SBU-B+C 본문을 "5 batch"로 수정 — Task 3 분리(3a-1/3a-2/3b/3c/3d/3e)에 맞춰 표기 일치 |
| NF-P2-2 | §8.1, §12 R-9 | Remote Supabase schema status가 R-9에만 있고 보고서/AC에 없음 | §8.1 보고서 구조에 4번 섹션 "Remote Supabase schema status" 추가 (10 섹션으로 확장) + §13 AC에 Task 6 항목으로 명시 |
| NF-P2-3 | §10/planning-contracts | Task 3a의 `public+user`가 contract 허용값(`user|admin|both|n/a`) 위반 | 3a를 3a-1(audience: `both` — 비로그인 + 인증 후 양쪽 분석)/3a-2(audience: `user`)로 분리. Contract 자체 수정은 본 plan 범위 밖, follow-up |

#### Round 2 Consistency Check 결과 반영

- §13 vs §10: rev2에서 fixed
- §9 vs §4 SBU split: §9는 전체 phase strategy로 유지 (Codex가 "concern"만 표시, P1 아님) — 본 plan 범위에서 추가 fix 불필요
- §11 SBU restated vs §4: consistent 유지

#### Round 2 Overall Recommendation 반영

"Revise before execution" — rev2 작성 + Codex Round 3 호출 예정.

### Round 3 — 2026-05-23 02:20 KST — VERDICT: FAIL

Reviewer: codex-cli 0.128.0, exec mode. Output: `tasks/codex-output-pre-plan-review-20260523-0300-round3.md`.

#### Round 2 finding 상태

| Round 2 ID | Round 3 Status | rev3 처리 |
| --- | --- | --- |
| NF-P1-1 SBU merge | PARTIAL → NF3-P1-1 로 이어짐 | rev3에서 §11, §12 R-1/R-2, §10 intro의 stale rev1 텍스트 모두 정리 (SBU-A / SBU-B+C 통일, Finish 4중 검증 통일) |
| NF-P1-2 §13 AC | PARTIAL → NF3-P2-1 로 이어짐 | rev3에서 §13의 Task 2, 3a-1~3e batch, ledger AC를 testable한 구조로 강화 (페이지별 5필드 명시, ledger 구체 섹션 요구) |
| NF-P2-1 batch 수 | RESOLVED | — |
| NF-P2-2 schema status | RESOLVED | — |
| NF-P2-3 audience | RESOLVED | — |

#### NEW P1 (rev3에 반영 완료)

| ID | Section | Issue | rev3 fix |
| --- | --- | --- | --- |
| NF3-P1-1 | §11, §12 R-1/R-2, §10 intro | rev1 잔재 텍스트 ("SBU-A 완료 후 SBU-B, 그 후 SBU-C", "SBU-A/B/C 3분할", "3중 Finish 검증", "SBU-C 완료 commit 허용", §10 intro의 A/B/C 라벨)가 rev2의 보안 fix와 충돌 → 실행자 혼란 위험 | §11 재작성 ("SBU-A 후 SBU-B+C 단일 비공개 실행 슬라이스"). §12 R-1 재작성 ("SBU-A/B+C 2분할"). §12 R-2 "4중 Finish 검증" + "SBU-B+C 슬라이스 PR 생성"으로 통일. §10 intro 갱신 + **Lifecycle 컬럼** 추가 |

#### NEW P2 (rev3에 반영)

| ID | Section | Issue | rev3 fix |
| --- | --- | --- | --- |
| NF3-P2-1 | §13 | 일부 batch AC가 "작성됨" 수준 — testable하지 않음 | §13 Task 2 / 3a-1~3e / ledger AC를 강화 — 페이지별 5필드 요구 (Route 결과 / Page 요구사항별 PASS/PARTIAL/PLACEHOLDER/MISSING 표 / Data WIRED-MOCKED-EMPTY-OOS + 정본 file:line / Responsive / 핵심 finding + 심각도), ledger는 구체 섹션 (Docs Consulted file:line / Decisions / Verification State 모든 게이트 / Fallback State / Risks) 요구 |
| NF3-P2-2 | §4, §10, §13 | Task 1/4에서 만드는 `supabase/config.toml`, `seed.sql`, `playwright.config.ts`, `*.spec.ts`의 lifecycle 분류 누락 | §10 Tasks 표에 **Lifecycle 컬럼 추가** — 모든 생성 파일에 (`durable` / `delete` / `gitignore + delete` / `gitignore + promote` / `gitignore + Task 6에 통합 + delete`) 중 하나 명시. `supabase/config.toml` / `seed.sql` / `playwright.config.ts` / `tests/e2e/coverage/*.spec.ts` → durable (재사용 가치). `analysis/*` → gitignore + Task 6 통합 + delete. `screenshots/` / `failure-log.json` / `auth-state` / `.env.local.bak` → gitignore + delete. `scripts/audit-setup/` → delete. Task 7 cleanup 항목에 `analysis/` 통째 삭제 + `.env.local.bak` 삭제 추가 |

#### Round 3 Consistency Check 결과 반영

- §13 vs §10: rev3에서 fixed (Task별 PASS 조건이 task table과 1:1 매핑)
- §4 vs §10 batch count: consistent (rev2에서 fixed, rev3에서 유지)
- §8.1 vs §13 Task 6: consistent
- §10 audience values vs planning-contracts.md: consistent

#### Round 3 SBU MERGE IMPACT 반영

- Staged delivery value (YES for SBU-A): rev3에서 §11 명시 — SBU-A는 산출물만 독립 PR
- Cleanup risk (PARTIAL → rev3에서 RESOLVED 기대): rev3에서 stale 텍스트 모두 정리
- New issue from merge: rev3에서 정리됨

#### Round 3 Overall Recommendation 반영

"Rev2 is close, but not ready. Fix the stale §11/§12/§10 language first, then tighten weak §13 lines, then classify all generated audit support files" — rev3에서 모두 반영.

### Round 4 — 2026-05-23 02:50 KST — VERDICT: CONCERN (no P1, 2 trivial P2)

Reviewer: codex-cli 0.128.0, exec mode. Output: `tasks/codex-output-pre-plan-review-20260523-0400-round4.md`.

#### Round 3 finding 상태

| Round 3 ID | Round 4 Status | Note |
| --- | --- | --- |
| NF3-P1-1 stale text | 🟢 RESOLVED | §11, §12 R-1/R-2, §10 intro 모두 정합 |
| NF3-P2-1 §13 weak AC | 🟢 RESOLVED | Task 2/3a-1~3e/ledger AC 모두 testable |
| NF3-P2-2 lifecycle | 🟡 PARTIAL → NF4-P2-2 | promoted output 1개 라벨만 누락 — rev4에서 fix |

#### NEW P1

**없음** — rev3가 모든 P1을 해소.

#### NEW P2 (rev4에서 즉시 반영)

| ID | Section | Issue | rev4 fix |
| --- | --- | --- | --- |
| NF4-P2-1 | §12 R-3 | "SBU-B는 degraded mode" → 단일 슬라이스 명명 일치 안 함 | `SBU-B+C는 degraded mode`로 수정 |
| NF4-P2-2 | §10 Task 2 | promoted artifact path `reports/sbu-a-coverage-matrix-20260523.md`에 명시적 `durable` 라벨 없음 | Files 칸에 명시적 `durable` 라벨 추가 |

#### Round 4 Spot Checks 결과

- **Stale text scan**: §12 R-3 한 곳만 잔재 (NF4-P2-1) — 작은 trivial label, P1 아님. 그 외 SBU-B → SBU-C 3분할, 3-step Finish, 4-batch 등 운영 잔재 **없음**. §15 historical references는 review history이므로 OK.
- **Lifecycle 완전성**: §10 모든 경로 분류됨 단, NF4-P2-2 1개 라벨 누락 — rev4에서 fix.
- **§13 testability**: spot-check 3개 모두 PASS — Task 2 (32 행 구체 필드), Task 3a-1 (페이지별 5필드), Finish 4-step (exact commands).
- **End-to-end coherence**: §1 → §3 → §4 → §5 → §7 → §10 → §13 **YES, coherent sequence**.

#### Round 4 Overall Recommendation 반영

"CONCERN with explicit accepts. No new P1. Rev3 is executable after two tiny cleanup edits" — rev4에서 두 라벨 모두 fix. 

#### Final Verdict (5-round 누적)

5 rounds 누적 결과:
- Round 1: FAIL 4 P1 + 3 P2 + 3 missed
- Round 2: FAIL 2 P1 + 3 P2
- Round 3: FAIL 1 P1 + 2 P2
- Round 4: **CONCERN — no P1**, 2 trivial P2 (rev4에 즉시 반영)
- Round 5: **호출 안 함** (CONCERN with no P1 = 실행 가능. Round 5는 cap이지만 의무 아님. 두 P2가 trivial 라벨 정리라 추가 검증 가치 낮음. 사용자 명시 승인으로 진입 절차 수렴)

**Plan-Review PASS Gate 통과** (CONCERN with explicit accepts, P1 없음). 사용자 승인 후 SBU-A 실행 진입 가능.

---

## Appendix A — Doc Source Index (Codex spot-check용)

| Doc | 본 plan에서의 역할 |
| --- | --- |
| `docs/sitemap.md` | 32 active routes Target React Route Map (line 23-58), Audience 분류 (line 64-68), Legacy 매핑 (line 146-165) |
| `docs/IA/README.md` | 32 페이지 인덱스 + 단계 분류 (line 30-61) |
| `docs/IA/{N}/description.md` × 32 | 페이지별 영역/버튼/정보/상태 정본 |
| `docs/prd.md` | 7. 기능 요구사항 + 12. MVP 범위 + Future scope 경계 |
| `docs/spec.md` | Fixed Baseline + Required Reading Map |
| `docs/flow/user-flow.md` | 현행 사용자 플로우 정본 |
| `docs/ant-design/02-global-styles.md` | breakpoint 360/768/1280 정의 |
| `docs/ant-design/07-review-checklist.md` | a11y 4항목 (키보드/focus/label/대비) |
| `docs/ai-workflow/runs/2026/05/21/20260521-1800-phase-6-admin-library-hardening.md` | Tier 2 OOS 11개 카탈로그 |
| `docs/ai-workflow/runs/2026/05/23/20260523-0000-pr-c-qa-gate-enforcement.md` | 가장 최근 컨텍스트 (QA Gate enforcement 도입) |

## Appendix B — Sibling Past Plans (구조 참고)

- `docs/ai-workflow/plans/20260521-phase-6-admin-library-hardening.md` — 가장 최근 phase plan (5라운드 Codex 통과 패턴)
- `docs/ai-workflow/plans/20260522-uxui-consistency-pass.md` — Codex D안 채택 패턴 (좁고 강한 enforcement)
