# TALKPIK QA Notification And P1/P2 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** QA 리포트의 P1/P2, 주의, 부분 실패, 실패 항목을 v13 SOT 기준으로 분류하고, 알림(notification)은 v13 사용자 앱 범위와 topik-ai 관리자 앱 참고 범위를 분리해 개발 가능한 계획으로 만든다.

**Architecture:** v13은 사용자 앱이며 `docs/`와 현재 `src/`가 최종 기준이다. topik-ai는 관리자 운영 네임스페이스와 알림 운영 UI의 참고 구현이다. 충돌 시 v13의 `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md`와 관련 Wireframe을 우선한다. 외부 발송(email/Zalo/push), 결제 provider, AI 실연동은 v13 SOT가 열기 전까지 완료 기능으로 구현하거나 테스트하지 않는다.

**Tech Stack:** Next.js App Router, React, TypeScript, Ant Design, Tailwind token bridge, Supabase, pg_cron/SQL migrations, Vitest, Playwright.

---

## 0. 조사와 토론 결과

### 병렬 에이전트 역할

- v13 알림 조사: `settings/notifications`, 인앱 알림, 이메일 큐/dispatcher, 관련 migration과 테스트가 이미 존재함을 확인했다.
- QA 분류 조사: 실제 제품 문제, 낡은 테스트, 정책 결정 필요, flaky를 분리했다.
- 비판 검토: v13 SOT가 topik-ai보다 우선이며, admin 기능 복구와 외부 발송 완료 선언은 금지해야 한다고 지적했다.
- topik-ai 조사: 첫 subagent는 context 초과로 실패했으나, 메인 세션에서 좁은 검색으로 관리자 알림 구현과 문서 근거를 확인했다.

### 확인한 핵심 근거

- v13 SOT:
  - `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md`
  - `docs/Wireframe/31-X-09-notification-settings/functional-spec.md`
  - `docs/qa/reports/qa-report-20260612-1205.html`
  - `supabase/migrations/INDEX.md`
  - `src/components/settings/NotificationPrefsForm.tsx`
  - `src/components/notifications/NotificationBell.tsx`
  - `src/components/dashboard/DashboardAlertsCard.tsx`
  - `src/app/api/notifications/dispatch-email/route.ts`
- topik-ai 참고:
  - `C:\Users\admin\Desktop\workspace\topik-ai\AGENTS.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\docs\알림-기능-구현-페이즈-가이드.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\docs\specs\notification-contract.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\docs\specs\admin-data-contract.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\docs\specs\admin-data-usage-map.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\src\features\message\api\notification-supabase-adapter.ts`
  - `C:\Users\admin\Desktop\workspace\topik-ai\src\features\message\pages\message-channel-page.tsx`
  - `C:\Users\admin\Desktop\workspace\topik-ai\src\features\message\pages\message-history-page.tsx`

### 외부 서비스 참고 인사이트

- Firebase Cloud Messaging은 대량 발송에서 스파이크와 quota 초과를 피하고, 429 응답에는 exponential backoff를 적용하라고 권장한다. 참고: https://firebase.google.com/docs/cloud-messaging/scale-fcm
- Firebase topic messaging은 topic 구독/해제 QPS 제한이 있어 대상 그룹 관리를 별도 배치와 재시도로 설계해야 한다. 참고: https://firebase.google.com/docs/cloud-messaging/topic-messaging
- OneSignal Preference Center는 사용자가 채널, 주제, 빈도, opt-out을 직접 관리하게 하는 구조를 제공한다. 참고: https://documentation.onesignal.com/docs/en/preference-center
- Courier는 알림 라우팅에서 사용자 선호를 애플리케이션 코드와 분리해 관리하는 방식을 권장한다. 참고: https://www.courier.com/blog/how-to-build-a-notification-center-for-web-and-mobile-apps
- MagicBell은 멀티채널 알림 시스템의 공통 요소로 사용자 선호, quiet hours, rate limit, retry, analytics를 제시한다. 참고: https://www.magicbell.com/blog/notification-system-design

---

## 1. SOT 충돌 판정

### 결정

- v13 최종 기준: `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md`.
- topik-ai는 관리자 운영 참고 구현이다. topik-ai 문서가 email 실발송 완료, 관리자 발송 완료, Resend 운영 준비 등을 말하더라도 v13에서 외부 알림 발송을 완료 기능으로 취급하지 않는다.
- topik-ai가 v13과 충돌하는 표현을 갖고 있으면 v13을 바꾸지 않고 topik-ai 수정 제안 대상으로 분류한다.

### 충돌/주의 지점

| 영역 | topik-ai 문서/구현 | v13 판단 |
| --- | --- | --- |
| email 실발송 | Resend 키 확보, 실발송 검증, email 출시 가능 표현 존재 | v13은 외부 발송/운영 이메일을 deferred로 본다. 사용자 앱에는 "준비 중" 안내와 설정 저장만 보장한다. |
| admin 발송 | `notification_templates`, `notification_groups`, `notification_dispatches`, `admin_send_notification` 운영 구현 존재 | v13에 admin CRUD/RPC/운영 UI를 되살리지 않는다. 관리자 기능은 topik-ai 소유로 둔다. |
| 채널 4종 | `in_app`, `email`, `push`, `zalo` 계약 존재 | v13에서는 인앱과 설정 저장을 우선한다. email은 큐/로그가 있어도 live transport는 보류, push/zalo는 준비 중 처리. |
| 기존 v13 테이블 | topik-ai도 기존 v13 DDL 변경 금지 원칙을 둠 | 일치한다. v13 계획에서도 기존 SOT 없는 DDL 변경은 금지한다. |

### 문서 후속 제안

- [ ] topik-ai 문서의 "email 실발송 완료/출시 가능" 표현이 v13 보류 결정과 혼동될 수 있으므로, 별도 작업에서 topik-ai SOT 변경 제안 작성:
  - 후보 경로: `C:\Users\admin\Desktop\workspace\topik-ai\docs\...`의 실제 문서 수정 전 제안 문서
  - 내용: "topik-ai 관리자 발송 운영 검증"과 "v13 사용자 앱 외부 발송 출시 가능"을 분리
- [ ] v13 SOT 직접 수정이 필요하면 바로 수정하지 말고 `docs/sot-change-proposals/2026-06-17-notification-scope-alignment.md`를 먼저 작성한다.

---

## 2. 알림(notification) 신규 개발 계획안

### Phase N0: 현재 구현 잠금과 범위 선언

- [ ] `docs/Wireframe/31-X-09-notification-settings/functional-spec.md`와 `supabase/migrations/INDEX.md`를 기준으로 v13 알림의 현재 범위를 다음처럼 고정한다:
  - 구현 가능: 알림 설정 화면, 수신 조건 저장, 인앱 알림센터, 대시보드 알림 카드, 최근 발송 시도 이력 표시, email pending/fail 로그 표시.
  - 보류: 실제 email 대량 발송, Zalo, push provider, 운영 cron의 외부 워커 호출 보장, 마케팅 동의 모델 확정.
- [ ] `src/components/settings/NotificationPrefsForm.tsx`에서 "실제 알림 발송 연동은 준비 중" 안내가 유지되는지 확인한다.
- [ ] `tests/components/settings/NotificationPrefsForm.test.tsx`에 deferred notice, 채널 미선택 warning, 저장 dirty gating이 남아 있는지 확인한다.

검증 명령:

```powershell
pnpm exec vitest run tests/components/settings/NotificationPrefsForm.test.tsx tests/lib/settings/server.test.ts tests/lib/settings/mutations.test.ts
pnpm exec playwright test tests/e2e/screens/notification-settings.spec.ts --project=desktop-1280
pnpm exec playwright test tests/e2e/screens/notification-settings.spec.ts --project=mobile-chrome
```

### Phase N1: v13 사용자 알림 안정화

- [ ] `src/components/notifications/notifications-data.ts`와 `src/components/notifications/NotificationBell.tsx`에서 empty/error/loading/read state를 확인한다.
- [ ] `src/components/dashboard/DashboardAlertsCard.tsx`가 `user_notifications` 기반 최신 알림을 보여주고, 실패 시 화면 전체를 깨지 않는지 확인한다.
- [ ] `src/lib/settings/server.ts`의 `notification_delivery_attempts` 최근 5건 조회가 RLS/owner select 전제와 맞는지 테스트한다.
- [ ] email worker `src/app/api/notifications/dispatch-email/route.ts`는 server-only secret을 요구하고, secret/env를 client bundle에 노출하지 않는지 확인한다.

검증 명령:

```powershell
pnpm exec vitest run tests/components/app/WorkspaceShell.test.tsx tests/lib/settings/server.test.ts
pnpm exec playwright test tests/e2e/notification-error-states.spec.ts --project=desktop-1280
```

### Phase N2: topik-ai 연동 참고 범위 정리

- [ ] topik-ai의 `notification_templates`, `notification_groups`, `notification_dispatches`, `notification_delivery_attempts`는 관리자 운영 원천으로만 참조한다.
- [ ] v13에서 관리자 발송 템플릿 CRUD, 그룹 CRUD, 발송 실행 UI, 감사 로그 UI를 추가하지 않는다.
- [ ] v13이 읽어야 하는 것은 사용자에게 도착한 `user_notifications`와 사용자의 `notification_settings`/`profiles.notification_prefs`뿐인지 확인한다.
- [ ] v13 route `link_url`은 `src/lib/routes.ts`, `docs/ia.md`, `docs/flow/user-flow.md`에 존재하는 사용자 route만 허용하는 allowlist를 계획한다. 관리자 route는 허용하지 않는다.

### Phase N3: 외부 채널은 proposal gate로 분리

- [ ] email 실발송을 v13에서 열려면 별도 proposal에 다음 결정을 먼저 기록한다:
  - provider와 발신 도메인
  - operational/marketing 분류
  - 수신 동의/거부 모델
  - bounce/complaint 처리
  - rate limit/retry/backoff
  - 운영 cron 또는 queue worker 호출 방식
- [ ] push/Zalo는 provider, 토큰 저장, opt-in, 구독해제/권한, 장애 fallback이 정해지기 전까지 "준비 중"으로 유지한다.
- [ ] 외부 채널 테스트는 "발송 성공"이 아니라 "준비 중 안내", "설정 저장", "발송 이력 비어 있음/실패 표시"를 검증한다.

---

## 3. P1/P2 항목별 수정 계획

### P1-1. 피드백 직접 URL 실패

판정: 제품 버그 또는 seed 계약 문제.

원인 가설: 공통 화면 테스트가 고정 ID를 사용하고, 해당 row가 없거나 RLS/문항 타입과 맞지 않아 `notFound()`로 빠진다. 전용 피드백 테스트는 임시 row 생성 방식이라 통과한다.

- [ ] `tests/e2e/screens/screens-authed.spec.ts`에서 고정 feedback ID 사용 여부를 확인한다.
- [ ] valid feedback direct URL은 테스트 시작 시 전용 fixture row를 만들고 그 ID로 접근하도록 바꾼다.
- [ ] invalid/unauthorized/not-found direct URL은 별도 케이스로 분리해 기대 문구를 명확히 한다.
- [ ] `src/app/(workspace)/writing/feedback/short/[id]/page.tsx`와 `src/app/(workspace)/writing/feedback/long/[id]/page.tsx`에서 `notFound`, redirect, forbidden 상태가 사용자에게 이해 가능한지 확인한다.
- [ ] 필요한 경우 `src/lib/writing/queries.ts`, `src/lib/writing/routes.ts`에 상태별 helper를 추가하되 SOT에 없는 새 UX는 proposal로 분리한다.

검증 명령:

```powershell
pnpm exec playwright test tests/e2e/screens/screens-authed.spec.ts -g "feedback|E-01|E-02" --project=desktop-1280
pnpm exec playwright test tests/e2e/flows/short-feedback.spec.ts tests/e2e/flows/long-feedback.spec.ts --project=desktop-1280
```

### P1-2. 모바일 `/subscription` 500과 Router 초기화 오류

판정: 제품 버그 우선.

- [ ] `tests/e2e/screens/subscription-management.spec.ts`를 desktop/mobile/tablet으로 각각 실행해 mobile 500 재현성을 확인한다.
- [ ] `src/app/(workspace)/subscription/page.tsx`와 구독/paywall 컴포넌트의 server/client boundary, redirect, loading fallback을 확인한다.
- [ ] 결제 provider 연결은 SOT상 보류이므로 실제 checkout 연결을 추가하지 않는다.
- [ ] 모바일에서 provider 보류 상태, empty billing history, error fallback이 깨지지 않게 테스트를 추가한다.

검증 명령:

```powershell
pnpm exec playwright test tests/e2e/screens/subscription-management.spec.ts --project=desktop-1280
pnpm exec playwright test tests/e2e/screens/subscription-management.spec.ts --project=mobile-chrome
pnpm exec vitest run tests/components/settings/SubscriptionPaywallChrome.test.tsx
```

### P1-3. 잘못된 verify-email query가 성공처럼 보임

판정: 제품 버그/명세 빈틈.

- [ ] `src/components/auth/VerifyEmailCard.tsx` 또는 해당 page에서 `email` query가 이메일 형식인지 검증한다.
- [ ] malformed query는 "인증 메일을 보냈어요" 같은 성공 문구를 보이지 않는다.
- [ ] malformed query는 이메일 재입력 또는 로그인/회원가입으로 돌아가는 안전한 CTA를 보여준다.
- [ ] raw provider error나 계정 존재 여부를 노출하지 않는다.

검증 명령:

```powershell
pnpm exec vitest run tests/components/auth/VerifyEmailCard.test.tsx
pnpm exec playwright test tests/e2e/screens/verify-email.spec.ts --project=desktop-1280
pnpm exec playwright test tests/e2e/screens/verify-email.spec.ts --project=mobile-chrome
```

### P1-4. 비밀번호 재설정 confirm 직접 진입 UX

판정: 정책 결정 + UX 개선. 현재 기능명세가 "저장 시 실패 안내"를 현재 구현으로 인정하므로 바로 제품 버그로 고치면 SOT 충돌 가능성이 있다.

- [ ] 관련 Wireframe/Auth SOT에서 direct `/password-reset/confirm`의 의도 상태를 재확인한다.
- [ ] 정책을 바꾸려면 `docs/sot-change-proposals/2026-06-17-password-reset-confirm-preflight.md`에 먼저 제안한다.
- [ ] 승인 후 구현한다면 no recovery session 상태에서는 폼 대신 "링크가 만료되었거나 잘못되었습니다"와 재전송 CTA를 보여준다.
- [ ] 정책 유지라면 테스트 이름과 리포트를 "reactive failure UX"로 바꾸고 P1에서 제외한다.

검증 명령:

```powershell
pnpm exec playwright test tests/e2e/screens/password-reset-confirm.spec.ts --project=desktop-1280
pnpm exec playwright test tests/e2e/screens/password-reset-confirm.spec.ts --project=mobile-chrome
```

### P2-1. 회원가입 화면 전환 테스트가 최신 UX와 불일치

판정: 낡은 테스트. 최근 UX는 name -> country/region -> email -> password/passwordConfirm 단계형이다.

- [ ] `docs/sot-change-proposals/2026-06-17-sign-up-nationality.md`와 `src/components/auth/SignUpForm.tsx`를 기준으로 테스트 계약을 갱신한다.
- [ ] `tests/e2e/flows/auth-page-switch.spec.ts`에서 `/sign-up` 진입 직후 `#passwordConfirm`을 기대하지 않는다.
- [ ] 단계별로 이름 입력, 국가/지역 선택, 이메일, 비밀번호 확인이 나타나는지 검증한다.

검증 명령:

```powershell
pnpm exec playwright test tests/e2e/flows/auth-page-switch.spec.ts --project=desktop-1280
pnpm exec playwright test tests/e2e/flows/sign-up.spec.ts --project=mobile-chrome
```

### P2-2. 알림 테스트 stale selector/fixture

판정: 부분 구현 + 낡은 테스트.

- [ ] `tests/e2e/notification-failure-states.spec.ts`의 로그인 입력 selector를 숨은 AntD input 의존에서 `autocomplete`, role, label 기반으로 변경한다.
- [ ] `tests/e2e/notification-error-states.spec.ts`는 consent/onboarding 상태를 테스트 시작 전에 보장한다.
- [ ] 외부 발송 성공을 기대하는 assertion은 제거한다.
- [ ] "준비 중 안내", "설정 저장", "이력 empty/error", "인앱 알림 표시"만 v13 현재 범위로 검증한다.

검증 명령:

```powershell
pnpm exec playwright test tests/e2e/notification-failure-states.spec.ts --project=desktop-1280
pnpm exec playwright test tests/e2e/notification-error-states.spec.ts --project=desktop-1280
```

### P2-3. audit advisory

판정: 보안 리스크. dependency 변경은 lockfile과 테스트 영향이 크므로 별도 dependency PR로 분리한다.

- [ ] `pnpm audit --audit-level moderate` 결과를 dependency별로 재확인한다.
- [ ] `pnpm why vite postcss js-yaml`로 직접/전이 의존성을 분류한다.
- [ ] framework-level upgrade가 필요하면 stack-change decision 또는 사용자 승인 후 진행한다.
- [ ] 자동 `pnpm audit fix --force`는 금지한다.

검증 명령:

```powershell
pnpm audit --audit-level moderate
pnpm why vite
pnpm why postcss
pnpm why js-yaml
```

### P2-4. tablet timeout과 flaky 실행 전략

판정: 테스트 실행 전략 문제 + 일부 flaky.

- [ ] tablet 전체 project를 한 번에 돌리는 대신 기능별 shard로 나눈다.
- [ ] 같은 viewport/같은 행동에서 2회 이상 반복되는 실패만 제품 버그로 승격한다.
- [ ] trace, screenshot, console, response 500을 보존하는 설정을 확인한다.

검증 명령:

```powershell
pnpm exec playwright test tests/e2e/flows/auth-page-switch.spec.ts --project=tablet
pnpm exec playwright test tests/e2e/screens/subscription-management.spec.ts --project=tablet
pnpm exec playwright test tests/e2e/screens/sidebar-navigation.spec.ts --project=tablet
```

---

## 4. 시나리오별 주의/부분/실패 수정 계획

| 시나리오 | 현재 상태 | 계획 |
| --- | --- | --- |
| QA-00 기본 품질 | PASS + audit 위험 | P2-3 dependency advisory로 분리. release risk로 유지하고 자동 강제 업그레이드 금지. |
| QA-01 app shell | PASS + tablet 불완전 | P2-4 shard 전략으로 tablet smoke를 별도 검증. |
| QA-02/03 auth 전환 | PARTIAL | P2-1 회원가입 단계형 테스트로 갱신. session_expired 정책은 별도 확인. |
| QA-04 password reset request | PARTIAL | cooldown/rate-limit/error/empty 상태 테스트 추가. |
| QA-05 password reset confirm | FAIL/UX | P1-4 정책 제안 또는 reactive UX로 리포트 정정. |
| QA-07 verify email | FAIL/UX | P1-3 malformed query 안전 상태 구현. |
| QA-08 auth callback | WARNING/flaky | mobile retry trace 보존. 2회 이상 반복 시 P2 승격. |
| QA-09 protected route | PARTIAL | anonymous direct와 expired session reason 정책을 구분해 middleware 테스트 추가. |
| QA-12 dashboard notification | PARTIAL | N1에서 인앱 알림 카드 empty/error/detail 이동 테스트 보강. |
| QA-15 retry modal | PARTIAL | host flow 외 leaf state, 닫기, 재시도 실패 상태 테스트 추가. |
| QA-18 writing core/PDF | PASS + watch | 현재 통과 유지. library/PDF 저장 직후 대기 조건만 확인. |
| QA-19 feedback direct | FAIL | P1-1 fixture 기반 direct URL 테스트와 상태별 화면 정리. |
| QA-20 compare | PARTIAL | invalid/unauthorized direct URL 테스트 추가. |
| QA-22 library/export | WARNING/flaky | 저장 직후 `/library` 진입 시 fixture marker 또는 row count 대기. |
| QA-25 notification | PARTIAL/DEFERRED | N0~N3와 P2-2로 처리. 외부 발송 성공 테스트 금지. |
| QA-26 profile | WARNING/flaky | mobile sidebar retry trace 보존. 반복 시 P2 승격. |
| QA-27 subscription | FAIL/mobile | P1-2 mobile 500 root cause 조사와 fallback 테스트. |
| QA-29 route robustness | FAIL/PARTIAL | P1-1 feedback direct와 invalid route/unauthorized route 정책 테스트 보강. |

---

## 5. 실행 순서

### Batch A: 테스트 계약 정정

- [ ] 회원가입 단계형 테스트 수정.
- [ ] 알림 E2E selector/fixture 수정.
- [ ] feedback 공통 화면 테스트의 고정 ID 제거.

검증:

```powershell
pnpm exec playwright test tests/e2e/flows/auth-page-switch.spec.ts --project=desktop-1280
pnpm exec playwright test tests/e2e/notification-failure-states.spec.ts --project=desktop-1280
pnpm exec playwright test tests/e2e/screens/screens-authed.spec.ts -g "feedback|E-01|E-02" --project=desktop-1280
```

### Batch B: 실제 제품 문제 수정

- [ ] verify-email malformed 상태 수정.
- [ ] subscription mobile 500 원인 수정.
- [ ] feedback direct URL 상태별 사용자 안내 수정.

검증:

```powershell
pnpm lint
pnpm typecheck
pnpm exec vitest run tests/components/auth/VerifyEmailCard.test.tsx tests/components/settings/SubscriptionPaywallChrome.test.tsx
pnpm exec playwright test tests/e2e/screens/verify-email.spec.ts --project=desktop-1280
pnpm exec playwright test tests/e2e/screens/subscription-management.spec.ts --project=mobile-chrome
```

### Batch C: 정책/보류 항목 정리

- [ ] password reset confirm direct 진입은 SOT 제안 또는 리포트 정정 중 하나로 결정한다.
- [ ] session_expired reason 정책을 anonymous direct와 구분한다.
- [ ] 알림 외부 발송은 proposal gate로 남긴다.
- [ ] audit advisory는 dependency PR로 분리한다.

검증:

```powershell
pnpm exec playwright test tests/e2e/screens/password-reset-confirm.spec.ts --project=desktop-1280
pnpm audit --audit-level moderate
```

### Batch D: 회귀 QA

- [ ] desktop 핵심 auth/writing/settings/notification/subscription smoke 실행.
- [ ] mobile 핵심 auth/notification/subscription smoke 실행.
- [ ] tablet shard smoke 실행.
- [ ] QA 리포트 HTML/MD를 최신 판정으로 갱신한다.

검증:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright test tests/e2e/flows/auth-page-switch.spec.ts tests/e2e/screens/notification-settings.spec.ts tests/e2e/screens/subscription-management.spec.ts --project=desktop-1280
pnpm exec playwright test tests/e2e/flows/auth-page-switch.spec.ts tests/e2e/screens/notification-settings.spec.ts tests/e2e/screens/subscription-management.spec.ts --project=mobile-chrome
```

---

## 6. 완료 보고 형식

구현 작업자는 완료 보고에 반드시 아래를 포함한다.

- 읽은 SOT:
- 확인한 요구사항:
- 충돌 여부:
- 갱신 필요 문서:
- 변경 파일:
- 실행한 검증 명령과 결과:
- 남은 위험:

---

## 7. 금지 사항

- [ ] v13에 admin CRUD, admin RPC, 사용자/조직 관리, 운영 검수 workflow를 추가하지 않는다.
- [ ] email/Zalo/push 실발송을 SOT 승인 없이 완료 기능으로 구현하지 않는다.
- [ ] 결제 provider나 checkout 실연동을 이 계획에 끼워 넣지 않는다.
- [ ] `docs/` active SOT를 직접 고치지 않는다. 필요하면 `docs/sot-change-proposals/`에 제안한다.
- [ ] secret, service role key, Resend key, worker secret을 출력하거나 테스트 리포트에 남기지 않는다.
- [ ] `pnpm audit fix --force`, production DB 조작, shared Supabase DDL 변경을 승인 없이 실행하지 않는다.
