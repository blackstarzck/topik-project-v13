# 2026-07-03 QA 결함 수정 실행 계획·기록

| 항목 | 내용 |
| --- | --- |
| 작성일 | 2026-07-03 |
| 상태 | 코드 수정 완료 · 정적 검증 GREEN · 런타임(E2E/build) 검증 대기 |
| 출처 보고서 | `docs/qa/reports/qa-report-20260702-1055.html` (Blocked 판정: P1 1건, P2 8건) |
| 작업 위치 | `v13-before-convention` worktree, branch `before-convention` |
| 기준 문서 | `AGENTS.md`, `docs/prd.md`, `DESIGN.md`, `TESTING.md`, `playwright.config.ts` |

## Context

2026-07-02 QA 보고서가 **Blocked**로 판정한 결함을 수정한다. 릴리스 차단(P1) 1건과
사용자 가시 결함(약관 화면 원문 기호 노출)을 우선 해소하고, 나머지 P2와 E2E 정비를 함께
진행한다. 모든 근본 원인은 코드 레벨로 확인했고, 원격 Supabase schema 변경이나 신규
의존성 추가는 하지 않았다.

### 사용자 확정 결정

| 항목 | 결정 |
| --- | --- |
| QA-05 `/paywall` | 빈 상태를 유효한 MVP 동작으로 인정. 테스트를 플랜 그리드/빈 상태 양쪽 허용으로 수정 |
| QA-08 랜딩 CTA | 의도된 동적 렌더링으로 확정(선언 + 주석 + 문서). 정적화하지 않음 |
| QA-02 포맷 | `.scratch/`, `artifacts/`, `.tmp/`를 무시 목록에 추가 후 나머지 전체 정리 |

## 결함별 조치

| ID | 등급 | 근본 원인 | 조치 | 상태 |
| --- | --- | --- | --- | --- |
| QA-01 | P1 | `check-admin-boundary`가 주석 속 `operation_policies` 문자열을 감지(실제 테이블 접근 없음) | `scripts/check-admin-boundary.mjs`의 `ALLOWED_CODE_REFERENCES`에 legal 3파일을 근거 주석과 함께 등록 | 완료 · `harness:admin-boundary` PASS |
| QA-03 | P2 | `renderLegalDocumentBodyHtml`가 혼합(HTML+Markdown) 본문 미처리 → `<div>`/`<br>`/`##` 노출 | `src/lib/legal/html.ts`에 래퍼 peel·인라인 태그 stash·heading probe·토큰 복원(reduceRight) 추가. XSS 초크포인트(`sanitizeLegalDocumentHtml`) 유지. X-13/X-18 공통 적용 | 완료 · unit/component 테스트 GREEN |
| QA-09 | P2 | `ScoreComparisonChart`·`.writing-material-chart` 부모 폭 제약 부재로 Recharts 컨테이너 -1 | `GrowthTrendChart` 패턴(`minWidth:0`+`initialDimension`)으로 통일, CSS에 `width:100%` 추가 | 완료 · typecheck GREEN, 런타임 콘솔 확인 대기 |
| QA-08 | P2 | 랜딩 CTA가 `cookies()`로 로그인 상태 확인 → `DYNAMIC_SERVER_USAGE` | `src/app/page.tsx`에 `export const dynamic = "force-dynamic"` + 이유 주석 | 완료 · build 확인 대기 |
| QA-04 | P2 | `password-reset.spec.ts`가 storageState 초기화로 Playwright 기본 `en-US` 협상 → 영어 렌더 | `test.use`에 `locale:"ko-KR"` + `Accept-Language` 고정(`auth-error.spec.ts` 관례) | 완료 · 스펙 파싱 확인, 런타임 대기 |
| QA-05 | P2 | 테스트가 플랜 그리드를 강제. `subscription_plans` 빈 상태(보류 스코프)에서 실패 | 빈 상태 Alert에 `data-testid="paywall-empty-state"` 추가, 스펙을 `grid.or(empty)` 상태 적응형으로 재구성 | 완료 · paywall unit GREEN, 런타임 대기 |
| QA-06 | P2 | 다시풀기 secondary 버튼은 prior work가 있어야 렌더. 초기화된 DB엔 attempt 0 | `retry-modal.spec.ts`에 service-role marker fixture 도입(문제 A=q51 published+draft→attempted, 문제 B=draft 없음). marker 스코프 내비게이션 + `afterAll` 정리 | 완료(코드) · 런타임 대기 |
| QA-07 | UNVERIFIED | feedback fixture 견고성 결함(부분 실패 누수, 단일 페이지 user 조회, 사전조건 미검증) | `long-feedback.spec.ts`·`pending-feedback-route.spec.ts`: 정리 등록을 insert 이전으로 이동, 페이지네이션 user 조회, published 문제 부재 시 명확한 에러, insert read-back, `page.goto` status<400 fail-fast + header 가시성 | 완료(코드) · 런타임 대기 |
| QA-02 | P2 | prettier 미준수 271파일 | `.prettierignore`에 `.scratch/`·`artifacts/`·`.tmp/` 추가 후 나머지 203파일 `format:write`. eslint도 `.scratch/**` 제외 통일 | 완료 · `format` PASS |
| (lint) | — | 미사용 변수 경고 7건 | `.scratch/` 4건은 eslint 제외로 정리, `scripts/`·test 3건은 직접 제거 | 완료 · `lint` 0 경고 |

## 정적 검증 결과 (이 worktree에서 실행)

| 게이트 | 결과 |
| --- | --- |
| `pnpm lint` | PASS · 0 error / 0 warning (기존 7 경고 → 0) |
| `pnpm typecheck` | PASS · 0 error |
| `pnpm test` | PASS · 224 files, 1414 tests (신규 테스트 포함, 9 skipped) |
| `pnpm harness:admin-boundary` | PASS · FAIL → PASS (릴리스 게이트 해제) |
| `pnpm format` | PASS · 271 미준수 → 0 |
| Playwright 스펙 파싱 | 변경 7파일 49 테스트 정상 수집(`playwright test --list`) |

## 런타임 검증 결과 (2026-07-03 실제 실행)

사용자가 `.env.local`(원격 dev Supabase, `SUPABASE_ENV_LABEL=dev`)을 이 worktree로 가져와,
base `v13` dev 서버를 중지하고 프로덕션 빌드를 포트 3000(=`NEXT_PUBLIC_SITE_URL`)에 올려
전체 e2e를 실행했다.

- **`pnpm build`**: exit 0. 랜딩 `/`가 동적(`ƒ`)으로 표시되고 `DYNAMIC_SERVER_USAGE` 경고 **0건** → QA-08 소거 확인.
- **QA-03 추가 발견 및 수정**: 발행 약관 본문의 `&gt;`·`&nbsp;` 엔티티가 markdown 경로 `escapeText`에서 이중 이스케이프(`&amp;gt;`)되어 글자로 노출되던 문제를 발견. `escapeText`를 유효 엔티티 보존형으로 수정. 실제 `/terms`에서 `&amp;nbsp;`·`&amp;gt;` **0건** 확인 + unit/컴포넌트 25건 통과.
- **수정 스펙 6개(QA-03/04/05/06/07 + terms) 전부 통과**(mobile/desktop). `consent-completion`(약관 렌더러 소비처)도 통과.
- **전체 스위트(6청크, 서버 완주)**: **375 통과 / 63 실패 / 3 flaky / 24 skip**. **제가 수정한 영역은 실패 0건** — 63건은 전부 미수정 영역.
  - **① 비로그인 로케일**(익명 스펙이 en-US로 협상 → 한국어 단언 실패): `landing-auth-cta`(익명)·`auth-page-switch`에 `locale: ko-KR` 고정으로 **수정·재검증 통과**.
  - **② 시드 baseline 부재 → 실 DB 시드로 해결**: `scripts/seed-e2e-audit-fixtures.mjs`(신규, service-role·prod 가드·idempotent)로 dev DB에 durable 감사 데이터를 넣었다. 고정 id 제출 `…051`(short)/`…053`(long) + 완료 피드백 번들, 그리고 weakness 추천(`recommendation_runs` 1 + `recommendation_items` 4, status=active)을 시드. 결과: **E-01·E-02·weakness X-07·workspace-layout:391/:438 통과 확인**.
  - **flaky (수정 불필요)**: `problem-list-regressions`(3), `verify-email`(4), `landing-auth-cta`(인증) 등은 건강한 서버에서 격리 재실행 시 **통과** — 전체 스위트의 직렬 공유-DB 부하 하에서만 실패.
  - **③ 남은 항목 — 제품/디자인 결정 필요(무단 변경 안 함)**:
    - `workspace-layout:332` 레이아웃 계약(`Expected "workspace" / Received "wide"`): 한 workspace 변형이 다른 폭 컨테이너 사용. 어느 쪽이 정본인지 디자인 확인 필요.
    - `screens-authed` X-04 subscription: 보류 스코프의 "Coming Soon"(AntD Result)이 heading role 미생성 → 스모크의 heading 단언과 불일치. 제품(placeholder에 heading 부여) vs 테스트(해당 화면 예외) 결정 필요.
    - 히어로 아이콘 `stroke-width`(X-01): `createIconsaxIcon`이 `strokeWidth`를 의도적으로 폐기 → 공유 아이콘 컴포넌트 변경이라 디자인 결정 필요.

### 2026-07-03 후속(보완-4·5): aff 라우팅 + 결정적 실패 3건 해소

- **aff 라우팅 — 해결(제품 수정 불필요)**: 실측 결과 `sign-up:373`·`institution-invite:68`은 제품이 SOT(2026-07-01 institution-invite-flow)대로 이미 정상 동작(통과). 유일한 실패였던 `landing-auth-cta:132`는 **개편 이전 계약**(랜딩에 머물며 조용히 캡처)을 검사하던 stale test → SOT 계약(aff 진입 → `/auth/institution-invite` 선택 화면 → 가입 링크 → payload에 `affiliation_code` 포함 + 사용 후 storage 정리)으로 갱신, **mobile/desktop 통과**. 진단 단계의 "미들웨어 서버사이드 캡처 필요" 가설은 실측으로 기각됨.
- **hidden-writing:176 — 해결(stale test)**: 라이브러리 개편(commit `a0c4c5f4`)으로 저장 문제 목록이 `/library?tab=problems` → `/library/problems`로 이동, `library-search` → `library-problems-search`, `library-result-count` → `library-problems-result-count`. 행 계약(`library-item-row`, `opacity-40`, unavailable 뱃지, disabled 버튼)은 유지. 스펙을 새 경로/testid로 갱신 → **통과**.
- **autosave-warning-modal:17 — 해결(stale test)**: "자동 저장 끄기" 버튼이 Q51 workspace의 "표현 힌트" 아코디언 내부로 이동(접힘 시 DOM에 없음). 아코디언을 먼저 펼치도록 갱신 → **통과**.
- **institution-writing-exposure:438 — 해결(테스트 하드닝)**: 원인은 목록이 아니라 로그인 직후 **리다이렉트 정착 타이밍**. 초기엔 "완료 게이트 우회(제품 버그)"로 의심했으나, 깨끗한 평범 로그인으로 재검증하니 동의 0건 사용자는 로그인 직후 `/auth/consent`로 **정상 리다이렉트**됨(게이트 정상). 첫 프로브가 본 `/dashboard`는 `router.push("/dashboard")` 직후 서버 리다이렉트 정착 전 URL을 조기 판독한 **측정 착오**(1.5초 대기 재검증에서 소멸). 다만 이 정착 지연(~1s) 때문에 스펙 login 헬퍼가 순간의 `/dashboard`를 신뢰해 동의 처리를 건너뛰던 것이 실패 원인 → **full-load 재검증 + 게이트 처리 루프**로 하드닝(동일 패턴 `institution-writing-existing-account`도 함께) → **통과**. **제품 버그 아님**(발행했던 작업 칩 철회). 선택적 개선: 비밀번호 로그인도 OAuth처럼 post-auth 서버 경유로 보내면 리다이렉트가 화면 정착 전에 처리됨.
- **institution-writing-existing-account:292 — 환경 전제로 정리**: 공유 e2e 학생이 기관 소속으로 프로비저닝된 환경 전용 시나리오. 공유 계정에 기관 코드를 시드하면 assigned-only 정책(2026-06-29)으로 스위트 전체가 깨지므로 시드하지 않고, 전제 미충족 시 **명시적 skip**으로 전환(형제 스펙의 exposure-table skip 관례). → skip으로 정상 종료.

### 환경 주의: prod 서버 안정성

Windows에서 `next start` 프로덕션 서버가 지속 e2e 부하를 받으면 종료코드 `3221226505`(0xC0000409, 네이티브 크래시)로 간헐 종료됐다. 전체 스위트 1회는 완주했으나, 이후 격리 재실행 도중 서버가 크래시해 `net::ERR_CONNECTION_REFUSED` 연쇄가 발생(그 실행 결과는 무효). 반복 fix-verify 시 서버 생존을 curl로 확인하고, 크래시 시 재기동 후 재실행할 것.

### E2E 실행 절차 (timeout 회피)

`playwright.config.ts`는 `workers:1`, `fullyParallel:false`를 유지한다(공유 student 계정 +
service-role DB 변이 경합 방지, coverage matrix 정합성). 전체 1회 실행은 60~80분으로 15분
예산을 초과하므로, 아래 6개 청크로 분할 실행한다(각 15분 이내). 청크 사이
`test-results/failure-log.json`를 보관하고 청크별 시작/종료/exit code를 기록한다.

```
pnpm test:e2e --project=mobile-360  tests/e2e/screens
pnpm test:e2e --project=mobile-360  tests/e2e/flows
pnpm test:e2e --project=tablet-768  tests/e2e/screens
pnpm test:e2e --project=tablet-768  tests/e2e/flows
pnpm test:e2e --project=desktop-1280 tests/e2e/screens
pnpm test:e2e --project=desktop-1280 tests/e2e/flows
```

수정 스펙만 우선 확인하는 스코프 명령:

```
pnpm test:e2e --project=mobile-360 tests/e2e/screens/password-reset.spec.ts
pnpm test:e2e --project=mobile-360 --project=desktop-1280 tests/e2e/screens/paywall.spec.ts
pnpm test:e2e --project=mobile-360 --project=desktop-1280 tests/e2e/screens/retry-modal.spec.ts
pnpm test:e2e --project=desktop-1280 tests/e2e/screens/long-feedback.spec.ts tests/e2e/screens/pending-feedback-route.spec.ts
pnpm test:e2e tests/e2e/screens/terms.spec.ts
```

향후 QA 하네스는 단일 `pnpm test:e2e`에 ≥90분 timeout을 주거나 위 청크 방식을 사용해야 한다.

## 변경 파일

- 앱/스크립트: `scripts/check-admin-boundary.mjs`, `src/lib/legal/html.ts`, `src/components/reports/ScoreComparisonChart.tsx`, `src/components/writing/Writing53MaterialCards.tsx`, `src/styles/global.css`, `src/app/page.tsx`, `src/components/settings/PaywallShell.tsx`, `.prettierignore`, `eslint.config.mjs`, `scripts/design-review/render-shot.mjs`, `scripts/i18n/merge-staging.mjs`
- 테스트: `tests/lib/legal/html.test.ts`, `tests/components/legal/TermsDocument.test.tsx`, `tests/components/auth/AuthConsentPanel.test.tsx`, `tests/components/settings/SubscriptionPaywallChrome.test.tsx`, `tests/e2e/screens/{terms,password-reset,paywall,retry-modal,long-feedback,pending-feedback-route}.spec.ts`, `tests/lib/export/pdf-export.test.ts`
- 런타임 실행 중 추가 편집(2026-07-03): `src/lib/legal/html.ts`(엔티티 보존 escapeText — QA-03 후속), `tests/e2e/flows/auth-page-switch.spec.ts`·`tests/e2e/flows/landing-auth-cta.spec.ts`(익명 로케일 ko-KR 고정 — ① 클러스터), `tests/e2e/screens/hidden-writing-problem-availability.spec.ts`(search 입력 가시성 대기)
- 포맷 전용: 위와 별개로 prettier `--write`가 src/·tests/ 등 약 200개 파일의 코드 스타일을 정리(기능 변경 없음). **커밋은 기능 변경과 포맷 전용을 분리한다.**

## 당시 기준 체크

- **읽은 기준**: `AGENTS.md`, `CLAUDE.md`, `package.json`, QA 보고서(2026-07-02), `scripts/check-admin-boundary.mjs`, `src/lib/legal/*`, `playwright.config.ts`, 관련 e2e 스펙, `docs/prd.md`, `DESIGN.md`, `TESTING.md`, `supabase/migrations`(writing 스키마·solve_state 예측자)
- **충돌 여부**: 없음. 당시 구현 범위와 코드 allowlist를 대조했다.
- **현재 해석**: 이 문서는 당시 실행 기록이며, 현재 제품·UI·검증 판정은 `docs/prd.md`, `DESIGN.md`, `TESTING.md`와 active source/tests가 소유한다.
