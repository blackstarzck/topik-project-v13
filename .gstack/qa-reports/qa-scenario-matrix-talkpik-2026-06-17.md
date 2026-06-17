# TALKPIK AI QA 시나리오 매트릭스

- 작성일: 2026-06-17
- 모드: 리포트 전용 QA. 개발 작업, 소스 수정, 테스트 추가, 커밋 없음.
- 대상: 사용자 앱 36개 Wireframe 화면과 route handler/API 직접 검증.
- 기준 문서: `AGENTS.md`, `README.md`, `TESTING.md`, `docs/ia.md`, `docs/flow/user-flow.md`, `docs/Wireframe/README.md`, `docs/Wireframe/functional-spec-index.md`, `docs/Wireframe/data-usage-index.md`, `docs/ant-design/07-review-checklist.md`

## 실행 원칙

1. 각 시나리오는 `page landing -> user action -> state change -> UI response -> back navigation -> direct URL` 순서로 확인한다.
2. 모든 클릭, 입력, 토글, 모달, 필터, 탭, 저장, 제출, redirect 후 console error를 확인한다.
3. direct URL은 anonymous / authenticated 상태를 나누어 확인한다.
4. 뒤로가기는 브라우저 Back, 앱 내부 Back/취소 CTA, 모달 닫기를 분리해 확인한다.
5. 결과 평가는 UX, UI 디자인, 기획, 개발 관점으로 따로 기록한 뒤 지휘자 관점에서 종합한다.
6. secret 값은 기록하지 않는다. 필요한 경우 변수명만 쓴다.

## 공통 상태값 사전 목록

| 상태 그룹 | 확인할 값 | 관련 화면 |
| --- | --- | --- |
| Auth/session | anonymous, authenticated, session_expired, recovery session, OAuth callback success/error, consent missing, onboarding missing | `/`, `/login`, `/sign-up`, `/auth/*`, `/onboarding/learning-goal`, workspace routes |
| Route guard | public allowed, protected redirect, transient system redirect, not-found, unsafe `next` fallback | public/auth/workspace/system routes |
| Form | pristine, dirty, valid, invalid, submitting, submitted, duplicate submit blocked, server error | auth, onboarding, writing, settings, profile |
| Writing draft | no draft, dirty answer, saving, saved, save failed, autosave disabled, conflict/stale draft | D-01~D-04, D-M3 |
| Submission/feedback | ready to submit, confirm blocked, submitted, analyzing, feedback completed, feedback failed, invalid id | D-M1, D-M2, E-01, E-02, R-01 |
| Problem list | filter selected, search term, sort order, page index, result count, empty result, private/lifecycle blocked | C-01, C-02, C-03, X-07, R-02 |
| Notification | channel enabled/disabled, dirty settings, save success/error, inbox unread/read, optimistic rollback, delivery history empty/error | B-01, X-09 |
| Library/export | saved/unsaved, selected item, export option selected, export pending, export unavailable/paywall | F-01, F-M1, X-03 |
| Subscription | no subscription, active plan, deferred checkout, payment history empty, plan change intent | X-03, X-04 |
| UI/system | loading, empty, success, warning, error, disabled, selected/active, focus trapped, horizontal overflow, mobile collapse | all pages |

## 리뷰 기록 템플릿

각 시나리오 실행 후 아래 형식으로 기록한다.

```md
### QA-XX 결과

- 실행 상태: PASS / FAIL / BLOCKED / NOT RUN
- 증거: screenshot path, Playwright trace, console summary
- 사용자 액션: ...
- 변한 상태값: ...
- 기대 반응: ...
- 실제 반응: ...
- 뒤로가기 결과: ...
- direct URL 결과: ...
- UX 관점: ...
- UI 디자인 관점: ...
- 기획 관점: ...
- 개발 관점: ...
- 지휘자 종합: ...
```

## 시나리오 매트릭스

| ID | 화면/흐름 | 사전 조건 | 사용자 액션 | 변해야 하는 상태값 | 기대 반응 | 뒤로가기 확인 | direct URL 확인 | 리뷰 초점 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QA-00 | 환경/기준선 | `.env.local`은 secret 출력 없이 존재 여부만 확인. dev server 또는 Playwright webServer 사용 | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` 실행 | build/type/test status, e2e auth storage state | 기본 검증 실패가 있으면 브라우저 QA 전에 기록 | 해당 없음 | 해당 없음 | 개발: 실패 로그, flaky 가능성, secret 미노출 |
| QA-01 | 제품 랜딩 `/` | anonymous | 헤더 로그인, 무료 시작, 섹션 anchor, 약관/개인정보 링크 클릭 | route path, hover/pressed state, video ready state, scroll position | CTA가 `/login`, `/sign-up`, `/terms`, `/privacy`로 이동. 랜딩 비디오/섹션이 깨지지 않음 | 각 하위 페이지에서 Back 시 랜딩의 이전 위치 또는 상단으로 일관 복귀 | `/` direct는 anonymous에게 랜딩, authenticated CTA는 대시보드 지향 | UX: 첫 행동 명확성. UI: hero/header 고정, 모바일 overflow |
| QA-02 | 회원가입 `/sign-up` | anonymous | 빈 제출, 잘못된 이메일, 비밀번호 불일치, 약관 미체크, 정상 입력 후 제출, Google 버튼 | form validity, terms checked, submitting, cooldown/error | 필드 오류는 하단 표시. 정상 제출은 `/auth/verify-email` 안내. provider raw 오류 미노출 | 로그인/약관 이동 후 Back 시 입력 보존 여부 확인 | `/sign-up` direct 허용. 로그인 세션 상태에서 접근 시 정책 확인 | 기획: 중복 이메일을 확정 표현하지 않는지. 개발: auth payload/redirect |
| QA-03 | 로그인 `/login` | anonymous + 테스트 계정 | 빈 제출, 잘못된 계정, 정상 로그인, 매직링크 탭, Google 버튼, `?reason=session_expired` | auth method, validation, submitting, session state | 정상 로그인은 `/dashboard`. 세션 만료 reason은 친절 안내. 인앱 브라우저 Google 제한 안내 | 회원가입/비밀번호 재설정 이동 후 Back 시 auth 패널 안정 | `/login`, `/login?reason=session_expired` direct 허용 | UX: 실패 후 다음 행동. UI: 탭/폼 높이 흔들림 |
| QA-04 | 비밀번호 재설정 `/password-reset` | anonymous | 이메일 입력, 빈 제출, 전송 성공, rate limit/cooldown, 로그인 복귀 | email value, submitting, cooldown, sent state | 전송 후 확인 안내와 재시도 제한. raw provider 오류 미노출 | 로그인 복귀 후 Back 시 재설정 화면 상태 확인 | `/password-reset` direct 허용 | 기획: 존재 여부 노출 없이 안내하는지 |
| QA-05 | 새 비밀번호 설정 `/password-reset/confirm` | anonymous 또는 recovery session 없음 | direct URL 진입, 비밀번호 약함/불일치, 제출 | password strength, match, submitting, recovery session error | recovery session 없으면 저장 실패 안내와 재발송 링크. token 노출 없음 | 재발송 링크 이동 후 Back 시 오류 상태 과도 노출 없는지 | `/password-reset/confirm` direct는 페이지 표시 가능, 저장은 실패 안내 | 보안: token/provider raw error 미노출 |
| QA-06 | 인증 오류 `/auth/error` | anonymous | `reason=otp_expired`, `user_not_found`, `over_request_rate_limit`, unknown reason 접근, CTA 클릭 | reason mapping, retry countdown, resend state | canonical 문구 표시. Retry-After 동안 CTA disabled. raw error 미노출 | CTA 이동 후 Back 시 같은 오류 카드가 안전하게 보임 | reason 없음/unknown/지원 reason 모두 안전한 fallback | 기획: 오류별 다음 행동이 다른지 |
| QA-07 | 인증 메일 확인 `/auth/verify-email` | anonymous | `email=` 있음/없음, 재전송, 빈 이메일, Gmail 링크, 로그인/재가입 링크 | email prefill, resend cooldown, inbox link visibility | 이메일 있으면 재전송 가능. 없으면 입력 안내. 알 수 없는 도메인은 inbox link 숨김 | 외부 메일 링크 제외, 내부 링크 Back 동작 확인 | `/auth/verify-email`, `?email=...`, malformed email 대응 | UX: 직접 진입자가 길을 잃지 않는지 |
| QA-08 | 인증 callback fragment `/auth/callback-fragment` | anonymous | hash 없음, error hash, token hash, unsafe `next` | fragment parsed, session set, redirect target, error reason | hash 없음은 `/auth/error?reason=unknown`. error hash는 canonical reason. unsafe next는 `/dashboard` fallback | redirect 후 Back 시 callback 화면이 루프/토큰 노출하지 않는지 | direct URL은 자동 처리 후 안전 redirect 또는 error | 보안: fragment/token/raw description 노출 금지 |
| QA-09 | 소셜 약관 동의 `/auth/consent` | authenticated, consent missing 가정 | checkbox 없이 제출, 체크 후 계속, unsafe `next`, DB 오류 상태 | consent checked, required-error, user_consents write intent, redirect target | 체크 누락은 같은 화면 안내. 체크 후 safe next로 이동. 외부 next 차단 | 다음 화면에서 Back 시 동의 화면 재노출 정책 확인 | anonymous direct는 login redirect. auth direct는 누락 동의 없을 때 정책 확인 | 기획: 약관 전 core 진입 차단 |
| QA-10 | 학습 목표 설정 `/onboarding/learning-goal` | authenticated | 필수값 누락, 목표 급수/시험일/빈도/취약영역 선택, 저장, 건너뛰기 | learning_goals fields, valid/invalid, submitting | 필수값 누락 시 다음 CTA disabled 또는 오류. 저장/건너뛰기는 `/dashboard` | dashboard에서 Back 시 중복 저장/폼 재제출 없음 | anonymous direct는 login. authenticated direct는 페이지 접근 | UX: 첫 사용자에게 부담이 크지 않은지 |
| QA-11 | Workspace shell/sidebar | authenticated | 각 sidebar 메뉴 클릭, 하위 메뉴 열기, 로그아웃, 모바일 메뉴 조작 | active menu, expanded group, auth session, layout width | active는 문맥 유지. 로그아웃은 `/login`, 이후 protected route 차단 | 각 메뉴 이동 후 Back이 이전 route로 복귀 | deep link 피드백/약점/프로필에서 sidebar active 문맥 확인 | UI: 6개 상위 메뉴 원칙, 모바일 overflow |
| QA-12 | 홈 대시보드 `/dashboard` | authenticated, 데이터 있음/없음 모두 관찰 | 추천 카드, 최근 첨삭, 알림 열기, 알림 읽음, 설정 이동 | KPI loading/empty, notification read_at, card CTA route | 새 사용자 빈 상태와 기존 데이터 상태 모두 이해 가능. 알림 실패 시 재시도 | 알림/추천/최근첨삭 이동 후 Back 시 대시보드 상태 유지 | anonymous direct는 login. auth direct는 dashboard | 기획: 다음 학습 행동이 분명한지 |
| QA-13 | 문제 유형 추천 `/practice/recommendations` | authenticated | 추천 카드 선택, 직접 유형 카드 선택, 실패/빈 추천 상태 관찰 | selected type, recommendation source, loading/error | 추천 실패 시 직접 선택 카드와 재시도. 선택 후 문제 목록 이동 | 문제 목록에서 Back 시 선택 상태/추천 맥락 유지 여부 | direct 접근은 추천 계산/직접 선택 가능 | UX: 추천 사유가 신뢰 가능한지 |
| QA-14 | 문제 목록 `/practice/problems` | authenticated | 필터, 검색, 정렬, 페이지 이동, 결과 없음 만들기, 문제 행 클릭 | filter, search, sort, page, total_count, empty result, selected problem | 결과 수와 page가 정확히 갱신. 빈 결과는 초기화 CTA. 행 클릭은 C-03 모달 | 모달 닫기/작성 화면 Back 시 목록 필터 유지 여부 | query 유무 직접 접근, anonymous redirect | 개발: RPC filter/sort/page와 UI 불일치 |
| QA-15 | 다시 풀기 모달 C-03 | 문제 목록에서 문제 선택 | 모달 열기, mode 선택, 이전 결과 보기, 취소, 시작, 배경 클릭, Esc | modal open, selected retry mode, focus trap, loading/error | 취소는 목록 복귀. 시작은 51~54 writing route. 위험 상태는 배경 닫기 제한 | 모달 열린 상태에서 Back 또는 Esc 동작 | 독립 URL 없음. host `/practice/problems`에서만 검증 | UI: focus trap, scroll lock, dim 처리 |
| QA-16 | 쓰기 51~54 `/writing/*` | authenticated, 문제 데이터 있음 | 답안 입력, 글자수 변화, 임시저장, 도움말 접기, 이미지/자료 로드 실패, 제출 클릭 | answer_text, char_count, autosave_status, dirty, submit enabled | 입력에 따라 글자수와 제출 가능 상태 변경. 저장 실패 시 답안 보존 | dirty 상태에서 sidebar/Back 시 D-M3 경고 | direct 접근 시 문제 context 없거나 anonymous일 때 안내/redirect 확인 | UX: 시험 답안 보존 신뢰감 |
| QA-17 | 제출 확인 모달 D-M1 | writing 답안 작성 완료 | 제출 클릭, 체크 없이 제출, 체크 후 제출, 취소 | confirm checked, submitting, duplicate blocked, writing_submissions intent | 체크 전 제출 blocked. 제출 후 D-M2 분석 로딩. 취소는 작성 화면 | 모달 취소/Back 시 작성 내용 유지 | 독립 URL 없음. writing host에서 검증 | 기획: 오제출 방지와 진행감 |
| QA-18 | AI 분석 로딩 D-M2 | 제출 직후 또는 fixture | 분석 중, 완료, 실패/timeout, 새로고침 | feedback_status pending/analyzing/completed/failed | 진행 상태 표시, 완료 후 E-01/E-02 이동, 실패 시 재시도/안내 | 완료 후 Back 시 제출 재실행 안 됨 | 독립 route 없음. 제출 flow에서 검증 | 개발: 중복 제출, 상태 polling 안정성 |
| QA-19 | 단답/장문 피드백 E-01/E-02 | authenticated, valid submission id | 저장, 다시 풀기, 비교 리포트, 다음 문제, PDF/공유 메뉴 | library saved, feedback score, dimension scores, navigation target | 저장 toast, 다음 행동 CTA, 점수/첨삭/원문 표시 | compare/next/library 이동 후 Back 시 피드백 유지 | valid id, invalid id, unauthorized id direct 대응 | UX: 피드백이 다음 학습으로 연결되는지 |
| QA-20 | 비교 리포트 R-01 | authenticated, report id 있음 | metric 확인, 약점 인사이트, 다음 문제, 공유/차트 | report metrics, selected chart, next route | 비교 대상과 성장 지표가 혼동되지 않음 | 다음 문제/약점 이동 후 Back 시 report 유지 | valid/invalid/unauthorized id direct 대응 | 기획: 비교 기준과 해석 가능성 |
| QA-21 | 다음 문제 추천 `/practice/next` | authenticated | 추천 카드 선택, 목록 탐색, 유료 잠금 분기 | recommendation status, selected problem, paywall trigger | 추천 이유와 시작 CTA 표시. 잠금이면 X-03으로 자연 진입 | 문제 목록/페이월 이동 후 Back 시 추천 맥락 유지 | direct 접근 시 추천 없음/empty 상태 대응 | UX: “다음 할 일”이 즉시 보이는지 |
| QA-22 | 내 서재/PDF F-01/F-M1 | authenticated | 탭 변경, 검색, 행 선택, 저장 해제, PDF 모달 열기, 옵션 선택, 다운로드/닫기 | selected tab, item selected, saved status, export option, export status | 빈 탭과 결과 탭 구분. PDF 생성 준비/잠금/오류 상태 명확 | 모달 닫기/Back 시 탭과 검색 유지 | `/library` direct, modal은 host에서 검증 | UI: 모달 내부 상태와 host 배경 |
| QA-23 | 성장/약점 `/growth`, `/practice/weakness` | authenticated | 기간/탭/추천 카드, 약점 탭 변경, 문제 시작 | KPI period, weakness dimension, selected tab, recommendation | 성장 지표와 추천 문제가 연결됨. 유료 잠금 오인 없음 | 문제 목록 진입 후 Back 시 선택 탭 유지 | anonymous redirect, auth direct 허용 | 기획: 성장 리포트와 약점 추천의 역할 분리 |
| QA-24 | 언어 설정 `/settings/language` | authenticated | 언어/지역/학습 언어 변경, 저장, 저장 전 이탈 | ui_locale, dirty, saving, saved, validation | 저장 전 버튼 disabled/active가 명확. 저장 후 UI 언어 변화 확인 | dirty 상태 Back/sidebar 클릭 시 이탈 확인 필요 | anonymous redirect, auth direct 허용 | 개발: locale 변경 후 hydration/문구 깨짐 |
| QA-25 | 알림 설정 `/settings/notifications` | authenticated | 채널 탭, 토글, 요일/시간 변경, 저장, 로드 실패, 저장 실패, 수신함 읽음 실패 | channels, reminder days/time, dirty, save error, read_at rollback | 미연동 채널은 실제 발송 가능처럼 보이지 않음. 실패 시 입력 보존/재시도 | dirty 상태 Back/sidebar 클릭 시 이탈 확인 | anonymous redirect, auth direct 허용 | 보안/기획: transport deferred 표현 정확성 |
| QA-26 | 프로필 `/profile` | authenticated | 이름/닉네임/자기소개 입력, 이미지 업로드 시도, 저장 disabled/enabled | display_name, nickname, bio, avatar_path, dirty, saving | 길이 제한, 이메일 read-only, 저장 전/후 상태 명확 | dirty 상태 Back/sidebar 클릭 시 이탈 확인 | anonymous redirect, auth direct 허용 | UI: 필드 label, disabled 이유 |
| QA-27 | 페이월/구독 `/paywall`, `/subscription` | authenticated | 플랜 카드, 구독 CTA, 학습 복귀, 플랜 변경, 결제 이력 확인 | plan selected, checkout deferred, subscription status, payment history empty | 실제 결제가 연결된 것처럼 보이지 않음. deferred 안내 명확 | subscription/paywall 왕복 Back 자연스러움 | anonymous redirect, auth direct 허용 | 기획: 결제 deferred 범위 준수 |
| QA-28 | 법적 문서 `/terms`, `/privacy` | anonymous/authenticated | 상호 링크, 회원가입 복귀, placeholder 안내 확인 | public page state, legal placeholder visibility | 세션 없이 접근. placeholder/정식 미확정 상태 숨김 없음 | 회원가입/랜딩에서 왕복 Back 확인 | direct 접근 허용 | 기획: 운영 전 위험 문구 명확성 |
| QA-29 | 미존재/불가 route | anonymous/authenticated | `/admin`, `/practice/problems/bad`, `/writing/feedback/short/bad`, 임의 route 접근 | not-found, protected redirect, auth guard | admin 기능 노출 없음. 사용자에게 안전한 404 또는 login redirect | 404에서 Back 시 이전 페이지 복귀 | direct URL 전체 확인 | 보안: 관리자 범위 침범 없음 |

## 자동 테스트와 매핑

| 자동 테스트 | 커버하는 시나리오 | 보강할 수동 QA |
| --- | --- | --- |
| `tests/e2e/screens/screens-public.spec.ts` | QA-01~QA-08, QA-28 일부 direct URL 렌더링 | 각 페이지의 클릭/뒤로가기/파라미터 변형 |
| `tests/e2e/screens/screens-authed.spec.ts` | QA-10~QA-27 일부 auth direct URL 렌더링 | 상태값 변화, dirty guard, modal/back |
| `tests/e2e/flows/sign-up.spec.ts` | QA-02 | 실제 UX 문구, Back, 모바일 |
| `tests/e2e/flows/auth-page-switch.spec.ts` | QA-03 | Back history, form state 보존 |
| `tests/e2e/screens/auth-error.spec.ts` | QA-06 | 전체 reason matrix, CTA 후 Back |
| `tests/e2e/screens/verify-email.spec.ts` | QA-07 | 직접 URL 변형과 외부 링크 처리 |
| `tests/e2e/screens/auth-callback-fragment.spec.ts` | QA-08 | 브라우저 Back loop 여부 |
| `tests/e2e/flows/core-writing-flow.spec.ts` | QA-14~QA-22 | 52/53/54 개별, autosave, invalid id |
| `tests/e2e/notification-error-states.spec.ts` | QA-12, QA-25 | 실제 화면에서 사용자 복구감 확인 |
| `tests/e2e/screens/sidebar-navigation.spec.ts` | QA-11 | 모바일 sidebar, Back, dirty guard |

## 실행 명령 초안

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

브라우저 수동 QA는 dev server가 필요하다.

```powershell
pnpm dev
```

기본 대상 URL은 `http://127.0.0.1:3000`로 둔다. 이미 다른 포트가 사용 중이면 사용 가능한 포트와 `E2E_BASE_URL`을 보고서에 기록한다.

## 최종 리포트 구성

1. Executive summary: 전체 health score, 가장 위험한 사용자 흐름 3개
2. Scenario result table: QA-00~QA-29 PASS/FAIL/BLOCKED
3. Issues: repro steps, screenshot, console, severity, affected route
4. Direct URL matrix: anonymous/authenticated/invalid parameter 결과
5. Back navigation matrix: 정상 복귀/루프/상태 손실 여부
6. State transition matrix: 액션별 데이터 상태 변화와 UI 반응
7. 4-perspective review: UX/UI/기획/개발 관점 요약
8. SOT check: 읽은 문서, 충돌 여부, 갱신 필요 문서

## 에이전트 리뷰 종합

### UX/UI 에이전트 관점

- 모든 시나리오는 desktop/mobile을 분리한다. 특히 sidebar, modal, writing editor, PDF modal, problem list filter는 viewport에 따라 실패 양상이 다르다.
- UI 판정은 loading, empty, success, warning, error, disabled, selected, focus trapped, overflow 상태를 빠짐없이 본다.
- 모달은 열림/닫힘뿐 아니라 Esc, 배경 클릭, focus trap, scroll lock, 뒤로가기 동작까지 한 세트로 판정한다.
- writing 51~54는 글자수, 저장 상태, 제출 가능 상태, 이탈 경고가 사용자의 현재 작업을 잃지 않게 연결되는지가 핵심이다.

### 기획 에이전트 관점

- 핵심 사용자 여정은 `landing -> signup/login -> email/auth handling -> consent/onboarding -> dashboard -> recommendation -> problem list -> writing -> submit -> feedback -> next/library/growth` 순서로 본다.
- 범위 밖으로 본 항목은 admin 기능, 실제 결제 SDK/결제 처리, 실제 LLM 채점 품질, 독립 단어장/모의고사 기능이다.
- 직접 URL 진입 시 사용자가 막히지 않는 안내가 있어야 하는 페이지는 `/auth/verify-email`, `/auth/error`, `/password-reset/confirm`, `/auth/callback-fragment`다.
- protected route는 로그인 전에는 `/login`으로, 로그인 후 필수 동의/온보딩이 없으면 해당 보완 흐름으로 이동해야 한다.

### 테스트 엔지니어 관점

- 기존 e2e는 public/auth 화면 렌더링, signup, auth 특수 화면, 51번 writing happy path, sidebar direct-entry, notification error 일부를 커버한다.
- 수동 QA가 특히 보완해야 할 갭은 onboarding 저장, login 실패/세션 만료 안내, 52/53/54 전체 제출, draft/autosave 실패와 충돌, problem list filter/search/sort/page/bookmark, notification 성공 저장/시간대/상태 라벨, library 저장/해제/export, profile/language dirty guard다.
- e2e 실패 증거는 `test-results/failure-log.json`, `test-results/**/trace.zip`, screenshot, spec/project명, 재현 명령, console error, response URL을 함께 기록한다.
- secret 값은 절대 캡처하지 않고 `E2E_STUDENT_EMAIL`, `SUPABASE_TEST_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN` 같은 변수명만 쓴다.

### 보안/권한 에이전트 관점

- `/auth/sign-out`는 GET 접근 시 405여야 하고, POST 성공 시 session 삭제 후 `/login`으로 이동해야 한다.
- `/auth/consent?next=...`는 상대 경로만 허용해야 하며 외부 URL 또는 protocol-relative URL은 fallback되어야 한다.
- `/auth/callback-fragment`와 password reset confirm 흐름은 URL, 화면, console, trace에 token/hash/provider raw error가 노출되면 실패다.
- dynamic id가 있는 feedback/report/library/export 계열은 invalid id, missing id, 다른 사용자 id를 각각 확인한다. 다른 사용자의 데이터가 보이면 즉시 P0/P1이다.
- `/api/export/pdf`는 anonymous 401, 본인 데이터만 export가 기준이다. `/api/notifications/dispatch-email`은 worker secret 없이는 거부되어야 한다.
- 현재 QA 중 확인할 잠재 충돌: SOT는 세션 만료 안내를 `/login?reason=session_expired`로 기대하지만, 현 구현의 보호 route redirect가 단순 `/login`일 가능성이 있어 실제 실행으로 확인한다.
- `pnpm audit --audit-level moderate` 사전 점검에서 dependency advisory가 발견되었다. 이번 작업에서는 수정하지 않고 보안 리스크로만 기록한다.

## 실행 우선순위

| 우선순위 | 시나리오 | 이유 |
| --- | --- | --- |
| P0 | QA-03, QA-08, QA-09, QA-16~QA-20, QA-29 | auth/session, token 노출, writing 제출, 권한/직접 URL 실패는 제품 신뢰와 데이터 보호에 직접 영향 |
| P1 | QA-02, QA-05~QA-07, QA-10~QA-15, QA-22, QA-25~QA-27 | 가입/복구/온보딩/목록/설정은 사용자 여정 중단 가능성이 높음 |
| P2 | QA-01, QA-21, QA-23, QA-24, QA-28 | core flow 보조 화면이지만 UX 완성도와 route 품질에 영향 |

## 실행 중 이슈 등급 기준

| 등급 | 기준 |
| --- | --- |
| P0 | secret/token 노출, 타 사용자 데이터 접근, auth 우회, 제출 데이터 유실, 앱 전체 진입 불가 |
| P1 | 핵심 writing/auth/onboarding flow 중단, 뒤로가기 루프, direct URL에서 복구 불가, 모바일 주요 UI 조작 불가 |
| P2 | 특정 상태의 안내 부족, 일부 CTA/필터/탭 오류, 화면 overflow, console error가 있지만 우회 가능 |
| P3 | 문구, 간격, 보조 상태 표시, 낮은 빈도의 polish 이슈 |
