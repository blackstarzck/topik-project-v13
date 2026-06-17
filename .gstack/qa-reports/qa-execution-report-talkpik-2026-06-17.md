# TALKPIK AI QA 실행 리포트

- 작성일: 2026-06-17
- 모드: 리포트 전용 QA. 개발 작업, 소스 수정, 테스트 추가, 커밋 없음.
- 대상 서버: `http://127.0.0.1:3000`
- 시나리오 문서: `.gstack/qa-reports/qa-scenario-matrix-talkpik-2026-06-17.md`

## 결론

전체 health 판단은 **조건부 통과, release 전 P1 이슈 확인 필요**다.

통과 근거:

- `pnpm lint`: 통과. warning 6개.
- `pnpm typecheck`: 통과.
- `pnpm test`: 110 files passed, 2 skipped. 739 tests passed, 3 skipped.
- public/auth 특수 URL desktop/mobile e2e 통과.
- 핵심 writing flow는 retry 후 통과.
- mobile authed screen 20개 통과.

주요 리스크:

- desktop feedback direct URL에서 E-01/E-02가 404 화면을 렌더링한다.
- `/auth/verify-email?email=not-an-email`이 잘못된 이메일도 "인증 메일을 보냈어요"로 안내한다.
- `/password-reset/confirm` 직접 진입 시 recovery session이 없어도 먼저 새 비밀번호 입력 화면이 보이고, 제출 후에야 실패 Alert가 나온다.
- 알림은 부분 구현 상태다. 설정 화면/일부 저장/인앱 알림 경로는 구현되어 있고, 실제 이메일/Zalo/push 외부 발송은 SOT상 보류다.
- `pnpm audit --audit-level moderate`에서 5개 advisory가 발견되었다.

## 추가 QA 실행 결과 - 2026-06-17 20:31 KST

사용자 요청에 따라 `.gstack/qa-reports/qa-branching-test-design-talkpik-2026-06-17.md`의 "모든 시나리오가 leaf case로 테스트되어야 한다"는 기준에 맞춰 기존 PARTIAL/NOT RUN/BLOCKED 구간을 중심으로 재실행했다. 소스 수정, 테스트 수정, 커밋은 하지 않았다.

### 기본 검증 재실행

| 검증 | 결과 | 메모 |
| --- | --- | --- |
| `pnpm lint` | PASS | 0 errors, 6 warnings |
| `pnpm typecheck` | PASS | `tsc --noEmit` 통과 |
| `pnpm test` | PASS | 117 files passed, 2 skipped. 761 tests passed, 3 skipped |
| `pnpm audit --audit-level moderate` | FAIL | 5 vulnerabilities. high 1, moderate 3, low 1 |
| `pnpm test:e2e` | TIMEOUT | 15분 제한 초과. 프로젝트별/시나리오별 분할 실행으로 대체 |

### Playwright 분할 실행

| 명령/범위 | 결과 |
| --- | --- |
| `pnpm exec playwright test --project=desktop-1280 --workers=1` | FAIL. 85 passed, 3 failed |
| `pnpm exec playwright test --project=mobile-360 --workers=1` | FAIL. 81 passed, 2 skipped, 3 flaky, 2 failed |
| `pnpm exec playwright test --project=tablet-768 --workers=1` | TIMEOUT. 이후 집중 실행 |
| `pnpm exec playwright test tests/e2e/flows/auth-page-switch.spec.ts tests/e2e/screens/subscription-management.spec.ts tests/e2e/screens/sidebar-navigation.spec.ts --project=tablet-768 --workers=1` | FAIL. 7 passed, 1 flaky, 1 failed |
| `E2E_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test -c playwright.notif-error.config.ts --workers=1` | FAIL. N-SET-09 failed, 3 did not run |
| `E2E_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test -c playwright.notif.config.ts --workers=1` | FAIL. N-SET-09 failed due stale login selector, 3 did not run |
| `E2E_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test -c playwright.notif-error.config.ts --workers=1 --grep "N-SET-10"` | FAIL. 저장 버튼 미노출 |
| `E2E_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test -c playwright.notif-error.config.ts --workers=1 --grep "N-INB-09"` | FAIL. `알림 열기` 버튼 미발견으로 timeout |
| `E2E_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test -c playwright.notif-error.config.ts --workers=1 --grep "N-INB-11"` | FAIL. `알림 열기` 버튼 미발견으로 timeout |

### 추가 확인된 실패/위험

#### 정정. 회원가입 전환 flow 실패는 stale test contract 가능성이 높음

- 관련 시나리오: QA-02, QA-03
- 정정 근거:
  - `docs/sot-change-proposals/2026-06-17-sign-up-nationality.md`는 `/sign-up`이 "only the name field visible" 상태로 시작한다고 정의한다.
  - 이후 valid name -> country/region -> email 순서로 필드가 점진 노출되어야 한다.
  - 현재 실패한 e2e는 `/sign-up` 진입 직후 `#passwordConfirm`이 바로 보여야 한다고 기대한다.
- 재현:
  - `pnpm exec playwright test tests/e2e/flows/auth-page-switch.spec.ts --project=desktop-1280 --workers=1`
  - 동일 실패가 `mobile-360`, `tablet-768`에서도 재현됨.
- 실제 결과:
  - `/login` 우측 account link로 `/sign-up` 이동 후 `#displayName`은 보이나 `#passwordConfirm`이 없다.
  - 최근 UX 기준에서는 이 상태가 정상일 수 있다. 기존 테스트 계약은 이전 한 화면 입력 방식에 묶여 있다.
- 증거:
  - `test-results/flows-auth-page-switch-A-0-ba51a-een-login-and-sign-up-forms-desktop-1280/test-failed-1.png`
  - `test-results/flows-auth-page-switch-A-0-ba51a-een-login-and-sign-up-forms-mobile-360/test-failed-1.png`
  - `test-results/flows-auth-page-switch-A-0-ba51a-een-login-and-sign-up-forms-tablet-768/test-failed-1.png`
- 지휘자 종합:
  - 제품 결함으로 단정하지 않는다. `auth-page-switch.spec.ts`를 새 progressive sign-up UX에 맞게 갱신해야 한다. 새 기대값은 "회원가입 진입 직후 이름 필드만 보임 -> 이름 입력 후 국가/지역 표시 -> 국가/지역 선택 후 이메일 표시 -> 이후 비밀번호/비밀번호 확인 표시"다.

#### P1. Desktop feedback direct URL 실패 재확인

- 관련 시나리오: QA-19, QA-20, QA-29
- 재현:
  - `pnpm exec playwright test --project=desktop-1280 --workers=1`
- 실제 결과:
  - `screens-authed.spec.ts`의 E-01/E-02 direct URL 검증이 retry 포함 실패.
  - heading이 없어 feedback 화면으로 판정할 수 없다.
- 증거:
  - `test-results/screens-screens-authed-E-0-5d04c--authed-without-page-errors-desktop-1280/test-failed-1.png`
  - `test-results/screens-screens-authed-E-0-64ab8--authed-without-page-errors-desktop-1280/test-failed-1.png`
- 보강 근거:
  - 같은 viewport의 독립 spec `short-feedback.spec.ts`, `long-feedback.spec.ts`는 통과했다.
  - 따라서 "feedback 컴포넌트 자체"보다 `screens-authed`가 쓰는 durable seed route/data 또는 direct URL contract 쪽을 우선 의심한다.

#### P1/P2. Mobile `/subscription`은 500 또는 Next router 초기화 오류를 낸다

- 관련 시나리오: QA-27
- 재현:
  - `pnpm exec playwright test tests/e2e/screens/subscription-management.spec.ts --project=mobile-360 --workers=1`
- 실제 결과:
  - 첫 실행은 `Internal Next.js error: Router action dispatched before initialization.` pageerror가 다수 발생.
  - retry에서는 `response: 500 http://127.0.0.1:3000/subscription`과 500 resource error가 기록됨.
- 증거:
  - `test-results/screens-subscription-manag-1db55-ption-shell-without-IA-code-mobile-360/test-failed-1.png`
  - `test-results/screens-subscription-manag-1db55-ption-shell-without-IA-code-mobile-360-retry1/test-failed-1.png`
- 지휘자 종합:
  - desktop은 통과, tablet은 retry 통과라 mobile 우선 결함 또는 dev-server instability 가능성이 있다. 그러나 500 응답이 있어 단순 시각 이슈로 낮출 수 없다.

#### 정정. 알림은 부분 구현 + 외부 발송 deferred 상태

- 관련 시나리오: QA-25
- 정정 근거:
  - `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md`는 외부 알림/채널 연동을 보류 대상으로 정의한다.
  - `docs/Wireframe/31-X-09-notification-settings/functional-spec.md`는 구현된 범위와 미구현/deferred 범위를 분리한다.
  - 현재 문서상 구현된 범위는 `/settings/notifications` 화면, 설정 저장, 발송 이력 조회, 인앱 알림센터와 B-01 알림 카드, 인앱 발송 파이프라인이다.
  - 미구현/deferred 범위는 실제 이메일 발송, 실제 Zalo 발송, 실제 push provider 연동, 사용자 편집 가능한 timezone selector다.
- 재현:
  - `E2E_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test -c playwright.notif-error.config.ts --workers=1`
- 실제 결과:
  - N-SET-09에서 `.ant-alert-error`가 나타나지 않아 실패.
  - 이후 3개 실패 상태 테스트는 개별 grep으로 재실행했고 모두 실패했다.
  - N-SET-10은 저장 버튼이 보이지 않아 저장 실패/입력 보존 상태까지 도달하지 못했다.
  - N-INB-09와 N-INB-11은 `알림 열기` 버튼을 찾지 못해 수신함 실패/읽음 실패 상태까지 도달하지 못했다.
- 증거:
  - `test-results/notification-error-states--a628d-정-로드-실패-→-오류-Alert-화면-갇힘-없음/test-failed-1.png`
  - `test-results/notification-error-states--a628d-정-로드-실패-→-오류-Alert-화면-갇힘-없음-retry1/test-failed-1.png`
  - `test-results/notification-error-states--27953-저장-실패-→-오류-토스트-입력-보존-재시도-가능/test-failed-1.png`
  - `test-results/notification-error-states--0d867-NB-09-수신함-로드-실패-→-오류-재시도-회복/test-failed-1.png`
  - `test-results/notification-error-states--ed885--처리-실패-→-낙관-롤백-오류-불일치-잔존-없음/test-failed-1.png`
- 지휘자 종합:
  - 알림 기능 전체를 "완성된 기능의 실패"로 보지 않는다. QA-25는 "부분 구현 기능의 실패 상태 UX와 테스트 계약 확인 필요"로 재분류한다. 특히 외부 발송은 SOT상 보류이므로 release blocker 결함이 아니라 deferred scope다.

#### 테스트 신뢰성 이슈. `playwright.notif.config.ts` 로그인 selector stale

- 관련 시나리오: QA-25
- 재현:
  - `E2E_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test -c playwright.notif.config.ts --workers=1`
- 실제 결과:
  - 로그인 helper가 `input[type="email"], input#email, input:not([type="password"])`의 첫 요소를 잡는데, 실제로는 숨겨진 AntD segmented radio input을 선택해 timeout.
- 지휘자 종합:
  - 이 config는 현재 앱의 DOM과 selector 계약이 맞지 않아 QA 도구 결함으로 분류한다. 같은 기능의 기본 렌더링은 `notification-settings.spec.ts`에서 desktop/mobile 통과했고, failure-state는 위 `notif-error` config 기준으로 실패를 기록한다.

### 시나리오 상태 업데이트

| 시나리오 그룹 | 최신 상태 |
| --- | --- |
| QA-00 환경/기준 | PASS with audit risk |
| QA-01 landing/public legal | PASS desktop/mobile, tablet subset not fully completed due timeout |
| QA-02 signup | PASS/PARTIAL. signup 자체 flow는 통과. auth-page-switch 실패는 최신 progressive UX 반영 전 테스트 계약 문제로 재분류 |
| QA-03 login/session reason | PASS/PARTIAL. login render/flow는 통과. login -> signup 전환 테스트는 최신 progressive UX에 맞게 갱신 필요 |
| QA-04 password-reset request | PASS render/intercepted send |
| QA-05 password-reset confirm | FAIL UX. direct URL session 없음 상태가 제출 후 드러남 |
| QA-06 auth-error | PASS desktop/mobile |
| QA-07 verify-email | FAIL UX. malformed email query 성공성 안내 |
| QA-08 callback-fragment | PASS with mobile flaky retry. missing hash -> unknown error |
| QA-09 consent | PARTIAL. anonymous unsafe next -> login 확인 |
| QA-10 onboarding | PASS render in authed screen suite |
| QA-11 sidebar/workspace | PASS desktop/mobile/tablet subset |
| QA-12 dashboard | PASS render. notification details partially covered |
| QA-13 recommendations | PASS render |
| QA-14 problem list | PASS render |
| QA-15 retry modal | PASS by component/unit coverage and host problem-list/modal coverage; no independent route |
| QA-16 writing 51~54 | PASS render. 51 core flow covered; 52/53/54 render covered |
| QA-17 submit confirm | PASS through modal spec and core flow |
| QA-18 analysis loading | PASS through `analysis-loading-modal.spec.ts` and core flow |
| QA-19 feedback | FAIL desktop direct URL in `screens-authed`; dedicated short/long feedback specs pass |
| QA-20 compare report | PASS dedicated report spec and core flow |
| QA-21 next problem | PASS render |
| QA-22 library/PDF | PASS in latest desktop/mobile dedicated library spec and desktop core flow |
| QA-23 growth/weakness | PASS render |
| QA-24 language settings | PASS render |
| QA-25 notifications | PARTIAL/DEFERRED. 설정 화면과 일부 저장/인앱 알림 경로는 구현됨. 외부 이메일/Zalo/push 발송은 SOT상 보류. failure-state e2e는 테스트 계약/복구 UI 추가 확인 필요 |
| QA-26 profile | PASS render; mobile sidebar profile direct entry flaky then passed |
| QA-27 paywall/subscription | FAIL mobile `/subscription`; tablet flaky then passed; desktop passed |
| QA-28 terms/privacy | PASS desktop/mobile |
| QA-29 invalid/unavailable routes | PARTIAL/FAIL. protected route redirects covered; feedback invalid/direct URL class still needs fix due QA-19 desktop failure |

## 실행 명령 결과

| 검증 | 결과 | 메모 |
| --- | --- | --- |
| `pnpm lint` | PASS | 0 errors, 6 warnings |
| `pnpm typecheck` | PASS | `tsc --noEmit` 통과 |
| `pnpm test` | PASS | 739 passed, 3 skipped |
| `pnpm audit --audit-level moderate` | FAIL | 5 vulnerabilities. high 1, moderate 3, low 1 |
| `pnpm test:e2e` | TIMEOUT | 10분 제한 초과. 이후 scenario별 재실행 |

## e2e 재실행 결과

| 명령/범위 | 결과 |
| --- | --- |
| `tests/e2e/screens/screens-public.spec.ts --project=desktop-1280` | 13 passed |
| `auth-error + verify-email + auth-callback-fragment --project=desktop-1280` | 14 passed |
| `tests/e2e/screens/screens-authed.spec.ts --project=desktop-1280` | 18 passed, 2 failed |
| `screens-authed --project=desktop-1280 --grep "E-0"` | E-01/E-02 재현 실패 |
| `tests/e2e/flows/core-writing-flow.spec.ts --project=desktop-1280` | flaky. 최초 timeout, retry passed |
| `tests/e2e/screens/sidebar-navigation.spec.ts --project=desktop-1280` | 5 passed |
| `auth-page-switch + sign-up --project=desktop-1280` | 9 passed, 1 flaky |
| `tests/e2e/screens/notification-settings.spec.ts --project=desktop-1280` | 2 passed |
| `playwright.notif-error.config.ts` | 1 failed, 3 did not run |
| `playwright.notif.config.ts` | 1 failed, 3 did not run |
| `screens-public --project=mobile-360` | 13 passed |
| `sidebar-navigation --project=mobile-360` | 5 passed |
| `notification-settings --project=mobile-360` | 2 passed |
| `screens-authed --project=mobile-360` | 20 passed |

## 발견 이슈

### P1. Desktop feedback direct URL이 404로 떨어짐

- 관련 시나리오: QA-19, QA-20, QA-29
- 재현:
  - `pnpm exec playwright test tests/e2e/screens/screens-authed.spec.ts --project=desktop-1280 --grep "E-0" --workers=1`
- 결과:
  - `/writing/feedback/short/a0d17000-0000-4000-8000-000000000051`
  - `/writing/feedback/long/a0d17000-0000-4000-8000-000000000053`
  - 두 route 모두 desktop에서 workspace shell은 보이나 main은 "페이지를 찾을 수 없습니다"를 렌더링.
- 증거:
  - `test-results/screens-screens-authed-E-0-5d04c--authed-without-page-errors-desktop-1280/test-failed-1.png`
  - `test-results/screens-screens-authed-E-0-64ab8--authed-without-page-errors-desktop-1280/test-failed-1.png`
- UX 관점: 사용자가 피드백 링크를 직접 열었을 때 학습 결과로 복귀하지 못한다.
- UI 관점: sidebar는 정상 active 상태처럼 보이지만 본문은 404라 사용자가 권한 문제인지 데이터 없음인지 알기 어렵다.
- 기획 관점: invalid, missing, unauthorized, deleted submission 상태별 문구 정책이 필요하다.
- 개발 관점: durable seed ID, viewport별 route/data 분기, notFound 처리 조건을 분리 확인해야 한다.
- 지휘자 종합: direct URL 정책 검증의 핵심 실패다. 단, mobile e2e에서는 같은 묶음이 통과했으므로 viewport-dependent inconsistency 가능성이 있다.

### P1. verify-email direct URL의 malformed email 처리

- 관련 시나리오: QA-07
- 재현:
  - 브라우저 직접 진입: `/auth/verify-email?email=not-an-email`
  - 뒤로가기 확인: `/auth/error?reason=otp_expired` 방문 후 Back
- 결과:
  - 잘못된 이메일 문자열도 "인증 메일을 보냈어요"와 "가입 이메일: not-an-email"로 표시된다.
  - Back 후에도 `/auth/verify-email?email=bad-email`에서 동일한 성공성 안내가 유지된다.
- UX 관점: 직접 URL 사용자가 실제로 메일이 간 것으로 오해할 수 있다.
- UI 관점: invalid parameter에 대한 warning/error 상태가 없다.
- 기획 관점: `email` query는 prefill만 할지, 유효성 검증 후 안내할지 정책이 필요하다.
- 개발 관점: query param 검증과 화면 상태가 분리되어야 한다. malformed email은 resend CTA를 막거나 입력 상태로 전환하는 편이 안전하다.
- 지휘자 종합: 사용자 입력은 아니지만 URL+parameter 대응 요구사항에 직접 해당한다.

### P1. password reset confirm 직접 진입 시 session 없음 상태가 늦게 드러남

- 관련 시나리오: QA-05
- 재현:
  - 브라우저 직접 진입: `/password-reset/confirm`
  - 새 비밀번호/확인 입력 후 "비밀번호 변경" 클릭
- 결과:
  - 초기 화면은 "새 비밀번호 설정" 폼을 보여준다.
  - 제출 후에야 "비밀번호를 변경하지 못했어요. 링크가 만료됐거나 세션이 끊겼을 수 있어요" Alert가 나온다.
- UX 관점: 사용자는 가능한 작업처럼 보고 입력을 끝낸 뒤 실패를 알게 된다.
- UI 관점: error state는 텍스트 Alert로 노출되어 최소 요건은 충족하지만, 초기 상태 안내가 늦다.
- 기획 관점: direct URL은 "링크가 만료됐거나 유효하지 않음" 상태로 먼저 안내할지 결정해야 한다.
- 개발 관점: recovery session 확인 전에는 submit 가능한 reset form을 보여주지 않는 방식을 검토해야 한다.
- 지휘자 종합: 보안 우회는 보이지 않았지만, direct URL UX와 상태값 반응이 늦다.

### P2. core writing flow PDF export 단계 flaky

- 관련 시나리오: QA-16~QA-22
- 재현:
  - `pnpm exec playwright test tests/e2e/flows/core-writing-flow.spec.ts --project=desktop-1280 --workers=1`
- 결과:
  - 최초 실행은 `/library` 로딩 상태에서 30초 timeout.
  - retry는 통과.
- 증거:
  - `test-results/flows-core-writing-flow-co-f3cd3--compare-→-library-→-export-desktop-1280/test-failed-1.png`
- UX 관점: library/export 진입이 느리면 사용자는 저장 결과를 확신하기 어렵다.
- UI 관점: "불러오는 중..."이 오래 유지될 때 재시도/상태 설명이 필요하다.
- 기획 관점: export 준비 중, 빈 데이터, 저장 직후 동기화 중 상태 정의가 필요하다.
- 개발 관점: library query, 저장 직후 eventual consistency, timeout budget을 확인해야 한다.
- 지휘자 종합: retry 통과라 release blocker는 아니지만 PDF export QA의 우선 확인 항목이다.

### P2. login/sign-up 전환 flow에서 일회성 pageerror

- 관련 시나리오: QA-02, QA-03
- 재현:
  - `pnpm exec playwright test tests/e2e/flows/auth-page-switch.spec.ts tests/e2e/flows/sign-up.spec.ts --project=desktop-1280 --workers=1`
- 결과:
  - "right panel account link switches between login and sign-up forms" 최초 실행에서 `pageerror: Connection closed.`
  - retry는 통과.
- UX/UI/기획 관점: 사용자 재현 가능성은 낮아 보이나 auth 첫 화면 전환은 민감한 구간이다.
- 개발 관점: dev server, Next Dev Tools, browser context 종료, navigation race를 분리해야 한다.
- 지휘자 종합: flaky로 기록한다. 반복 재현되면 P1로 올린다.

### 정정. 알림 실패 상태 QA는 부분 구현/deferred 범위로 재분류

- 관련 시나리오: QA-25
- `playwright.notif-error.config.ts`:
  - N-SET-09에서 `/settings/notifications` 대신 "약관 동의가 필요해요" 화면에 머문다.
  - notification fixture 계정의 consent 상태가 현재 guard와 맞지 않는 것으로 보인다.
- `playwright.notif.config.ts`:
  - 로그인 selector가 숨겨진 segmented radio input을 잡아 timeout.
  - 제품 결함보다 테스트 selector stale 가능성이 크다.
- 지휘자 종합: 알림 설정 기본 렌더링은 desktop/mobile 모두 통과했다. 다만 이 영역은 완성된 외부 발송 기능이 아니라 부분 구현/deferred 기능이다. 실패 상태 세부 QA는 구현된 저장/인앱 범위와 외부 발송 보류 범위를 나눠 다시 설계해야 한다.

### 보안 advisory

- `pnpm audit --audit-level moderate`
- 결과:
  - `vite`: high 1, moderate 1
  - `postcss`: moderate 1
  - `js-yaml`: moderate 1
  - low 1
- 지휘자 종합: 이번 작업은 수정 금지이므로 리스크만 기록한다. dependency 변경은 별도 승인/문서 갱신 범위다.

## direct URL/API 결과

| 요청 | 결과 |
| --- | --- |
| `/auth/verify-email?email=qa-browser@example.com` | 이메일 인증 안내 표시 |
| `/auth/verify-email?email=not-an-email` | malformed email도 인증 메일 발송 안내 표시 |
| `/auth/error?reason=otp_expired` | 인증 오류 안내 표시 |
| `/password-reset/confirm` | 새 비밀번호 입력 폼 표시, 제출 후 session error Alert |
| `/auth/callback-fragment` | `/auth/error?reason=unknown`으로 redirect |
| `/dashboard` anonymous | `/login`으로 redirect. `reason=session_expired` 없음 |
| GET `/auth/sign-out` | 405 |
| POST `/auth/sign-out` | 303 -> `/login` |
| GET `/api/export/pdf` | 405 |
| POST `/api/export/pdf` malformed body | 400 |
| POST `/api/export/pdf` valid-shaped body anonymous | 401 |
| GET `/api/notifications/dispatch-email` | 405 |
| POST `/api/notifications/dispatch-email` without worker secret | 401 |
| `/auth/consent?next=https://evil.example` anonymous | 307 -> `/login` |
| `/admin` anonymous | 307 -> `/login` |
| `/practice/problems/bad` anonymous | 307 -> `/login` |
| `/writing/feedback/short/bad` anonymous | 307 -> `/login` |
| `/writing/reports/bad/compare` anonymous | 307 -> `/login` |

## 시나리오 상태 요약

| 시나리오 그룹 | 상태 |
| --- | --- |
| QA-00 환경/기준 | PASS with audit risk |
| QA-01 landing/public legal | PASS desktop/mobile |
| QA-02 signup | PASS with flaky auth switch |
| QA-03 login/session reason | PARTIAL. render/flow 통과, `/dashboard` anonymous redirect에는 reason 없음 |
| QA-04 password-reset request | PARTIAL. render 확인 |
| QA-05 password-reset confirm | FAIL UX. direct URL session 없음 상태가 제출 후 드러남 |
| QA-06 auth-error | PASS desktop |
| QA-07 verify-email | FAIL UX. malformed email query 성공성 안내 |
| QA-08 callback-fragment | PASS desktop. missing hash -> unknown error |
| QA-09 consent | PARTIAL. anonymous unsafe next -> login 확인 |
| QA-10 onboarding | PASS render in authed screen suite |
| QA-11 sidebar/workspace | PASS desktop/mobile |
| QA-12 dashboard | PASS render. notification details partially covered |
| QA-13 recommendations | PASS render |
| QA-14 problem list | PASS render |
| QA-15 retry modal | NOT RUN manually |
| QA-16 writing 51~54 | PASS render. 51 core flow covered |
| QA-17 submit confirm | PASS through core flow |
| QA-18 analysis loading | PARTIAL through core flow |
| QA-19 feedback | FAIL desktop direct URL, PASS mobile suite |
| QA-20 compare report | PARTIAL through core flow |
| QA-21 next problem | PASS render |
| QA-22 library/PDF | FLAKY in core flow |
| QA-23 growth/weakness | PASS render |
| QA-24 language settings | PASS render |
| QA-25 notifications | PARTIAL/DEFERRED. 설정 화면/일부 저장/인앱 알림 경로는 구현됨. 외부 이메일/Zalo/push 발송은 보류 |
| QA-26 profile | PASS render |
| QA-27 paywall/subscription | PASS render |
| QA-28 terms/privacy | PASS desktop/mobile |
| QA-29 invalid/unavailable routes | PARTIAL. anonymous protected routes redirect login; authenticated invalid id covered by feedback desktop failure |

## SOT 체크

- 읽은 SOT:
  - `AGENTS.md`
  - `README.md`
  - `TESTING.md`
  - `docs/user-communication-style.md`
  - `docs/ia.md`
  - `docs/flow/user-flow.md`
  - `docs/Wireframe/README.md`
  - `docs/Wireframe/functional-spec-index.md`
  - `docs/Wireframe/data-usage-index.md`
  - `docs/ant-design/07-review-checklist.md`
  - sidebar 관련 `docs/Wireframe/share/03-learner-side-nav-state/*`
- 충돌/확인 필요:
  - session expired UX가 `/login?reason=session_expired`를 기대하는 경우, anonymous protected route redirect와 정책을 분리해야 한다.
  - password reset confirm direct URL의 초기 상태 정책이 명확해야 한다.
  - verify-email `email` query validation 정책이 명확해야 한다.
  - notification failure-state QA는 구현된 설정/인앱 범위와 외부 발송 보류 범위를 분리해야 한다.
- 갱신 필요 문서:
  - 제품 정책이 확정되면 auth 특수 URL functional spec과 QA checklist에 반영 필요.

## 외부 기준 기반 인사이트

- OWASP Authentication Cheat Sheet는 login/password reset/account recovery에서 계정 존재 여부를 드러내지 않는 일반화된 오류 응답을 권장한다. verify-email과 reset UX는 보안과 사용자 안내의 균형을 맞춰야 한다. https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- WCAG 2.2 SC 3.3.1은 자동 감지된 입력 오류를 텍스트로 식별하고 설명해야 한다. malformed email query와 reset session error는 사용자가 무엇을 고쳐야 하는지 즉시 알 수 있어야 한다. https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- Playwright는 실패한 테스트의 trace를 보존하는 `retain-on-failure` 옵션을 제공한다. 현재 config가 이 방식을 쓰고 있으므로 실패 분석은 `trace.zip`을 1차 증거로 삼는 것이 맞다. https://playwright.dev/docs/trace-viewer
- Supabase password reset 문서는 새 비밀번호 변경 페이지가 authenticated user에게 접근 가능해야 한다고 설명한다. direct URL에서 recovery session이 없을 때 초기 화면 정책을 재검토할 근거다. https://supabase.com/docs/guides/auth/passwords
