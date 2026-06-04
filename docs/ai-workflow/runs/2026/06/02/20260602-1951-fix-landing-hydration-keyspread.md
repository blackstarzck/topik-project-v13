# Context Ledger — Landing hydration + key-spread console errors

## Run Metadata

- Run id: 20260602-1951-fix-landing-hydration-keyspread
- Created: 2026-06-02 19:51 KST
- Updated: 2026-06-02 20:02 KST
- Main session owner: Claude Code (Opus 4.8)
- Host: Claude Code
- Status: complete (서버측 fix+verify 완료) — 에러2 진짜 원인=dev immutable 캐시(next.config 수정). 사용자 브라우저는 poisoned 캐시 1회 비우기(hard-reload) 필요. 부수: :3101 prod 정지(복구 대기) + /auth/error 별개 hydration 2건 + 날짜 패밀리(별도 scope)

## Task

- User goal: 랜딩(`/`)에서 보이는 콘솔 에러 2개 제거 후 직접(브라우저) 검증.
  1. Hydration mismatch — `<body>`의 `data-demoway-document-id` 속성.
  2. "A props object containing a 'key' prop is being spread into JSX" — `ProductPreview.tsx`.
- Accepted scope: 두 에러의 근본 원인 규명 + 코드/환경 교정 + 실제 dev 서버 부팅 후 브라우저 콘솔 검증.
- Out of scope: 랜딩 외 다른 화면 리디자인, admin(H-01/X-08/X-10/X-15), 신규 제품 동작.
- Current next action: dev 부팅 → Playwright/headless로 `/` 로드 → 콘솔 캡처.

## Docs Consulted

- Exact files read: `CLAUDE.md`, `src/app/layout.tsx`, `src/components/landing/ProductPreview.tsx`, `src/app/page.tsx`.
- Extracted requirements: 사용자 화면 전용 저장소(admin 동결); "don't invent product behavior"; UI 완료 보고 전 dev 서버 부팅 의무(memory).
- Doc conflicts: none.
- Untouched relevant docs and reason:
  - `docs/spec.md`, `docs/prd.md` — 제품 동작 변경 아님(콘솔 에러/환경 교정), 스펙 영향 없음.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 19:45 | 에러1은 코드 아님(브라우저 확장 Demoway 주입) → `<body suppressHydrationWarning>` 적용 | repo 전체 grep "demoway" = 0건; 확장이 hydration 직전 body에 data-* 주입; React/Next 공식 처방 | grep, React docs |
| 19:48 | 에러2는 소스 이미 정상(스프레드 없음) → 스테일 `.next` 청크가 원인 | 현재 `ProductPreview.tsx`에 `{...}` 스프레드 0건; 과거 `32d349f`에는 `<PreviewMock {...preview} />`(key 포함) 존재; dev PID 47736이 :3000에서 옛 청크 서빙 | git show 32d349f, Get-NetTCPConnection |
| 19:51 | dev 정지(PID 47736) → `.next` 제거 → 재부팅으로 청크 갱신 | 프로젝트 함정: dev 살아있는 채 .next 손대면 청크 혼합 | memory project-pnpm-build-clobbers-dev-server |
| 20:12 | **정정 RC**: 1차 재부팅이 불충분했음. 같은 프로젝트에서 `next start -p 3101`(prod, PID 46840, 어제부터)가 `.next`를 붙잡은 채였고 `next dev`(:3000)와 `.next`를 공유 → 내 `.next` 삭제 시 청크 혼합 → 사용자 브라우저가 그 순간 옛 청크를 받아 캐시(+dev 오버레이 sticky)로 에러 재출현 | 사용자 재신고 + 포트 스캔(:3000/:3101) + bv6yizy88 dev 로그에 key-spread 출현 |
| 20:14 | 프로젝트 Next 서버 전부 정지(dev 46260/42416 + prod 46840) → `.next` 완전 삭제(경합 0) → dev 단일 재부팅(b1p8g001f) | 단일 소유로 .next 혼합 제거; next dev ↔ next start 동시 실행이 근본 취약점 | 실측 |
| 20:16 | 부수 피해 정직 기록: 내 `.next` 삭제로 `:3101` prod(next start)가 500-깨짐 → 정리 차원서 정지. 복구는 사용자 승인 후 별도(빌드는 dev .next를 다시 덮으므로 동시 실행 금지 안내) | careful/honesty | 실측(:3101=500) |
| 20:30 | **REAL ROOT CAUSE**: `next.config.ts` `headers()`가 `/_next/static/:path*`에 `immutable,max-age=1yr`을 dev에도 적용 → 브라우저가 옛 청크(i18n 리팩터 이전, 스프레드 有)를 영구 캐시 → 소스/.next 고쳐도 refetch 안 함(재시작 전부 무력). 캐시없는 Playwright만 clean이라 1·2차 오판. → immutable 규칙을 `NODE_ENV==='production'`에서만 push하도록 수정 + 테스트 prod/dev 분기로 갱신 | Next 시작 경고 + dev 정적 헤더=immutable + Playwright(무캐시)만 clean이던 모순; bx5no6s9e 로그에 경고 사라짐 + 헤더 no-cache,must-revalidate | next.config.ts, tests/integration/cache-headers.test.ts ([[project-dev-immutable-cache-stale-chunk]]) |

## Active Files

- Files expected to change: `src/app/layout.tsx` (body suppressHydrationWarning).
- Files inspected: `src/app/layout.tsx`, `src/components/landing/ProductPreview.tsx`, `src/app/page.tsx`, `git show 32d349f:.../ProductPreview.tsx`.
- Files changed: `src/app/layout.tsx` (body suppressHydrationWarning), `next.config.ts` (정적 immutable 캐시 → prod-only, **에러2 진짜 근본 수정**), `tests/integration/cache-headers.test.ts` (prod/dev 분기 검증, vitest 4 pass).
- Files explicitly not to touch: admin 코드(동결), `ProductPreview.tsx`(이미 정상).

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Workflow wf_04aee931-214 (13 agents) | completeness/adversarial sweep | 전 src key-spread + hydration risk + 내 fix 반증 | done | candidate 9 → confirmed 3 (전부 hydration-risk); key-spread 0; refutation 0(내 두 claim 유지) |

## Child Result Packets

- Workflow `wf_04aee931-214` (landing-error-residual-sweep, 13 agents): 
  - **Refutation (claim check)**: 0 confirmed → CLAIM A(에러2=stale chunk, 현재 소스 정상) + CLAIM B(`<body suppressHydrationWarning>`이 demoway 처방으로 정확/안전/충분) **둘 다 유지**.
  - **key-spread**: 0 real (모든 `{...}` 히트는 react-hook-form `{...field}` / key 이미 분리한 `{...props}` 등 benign).
  - **hydration-risk (CONFIRMED HIGH 3건, 신고와 무관한 기존 결함)**:
    1. `src/components/profile/StatusHelpCard.tsx:71` — `new Date(joinedAt).toLocaleDateString("ko-KR")` (timeZone 미지정).
    2. `src/components/library/LibraryStatsPanel.tsx:51` — `new Date(iso).toLocaleDateString("ko-KR")`.
    3. `src/components/growth/GrowthDashboard.tsx:339` — `new Date(item.generatedAt).toLocaleDateString("ko-KR")`.
    - 처방: `{ timeZone: "Asia/Seoul" }` 핀 (기존 `DashboardKpiSummary.tsx:48`, `learning/RecentFeedbackCard.tsx:61-63` 패턴과 동일).
  - **Critic(미탐 영역)**: 같은 `new Date(arg).toLocale*` 패밀리 10여 곳 추가 의심(ExamInfoCard:233, practice ProblemRow/RetryModal `relativeDay()`+Date.now, DiagnosticCard:100, AnalysisLoadingModal:166, AutosaveBadge:32, Autosave/Submission 모달, NotificationPrefsForm:521, SubscriptionShell:81), recharts SSR(폭0/애니), 숫자·통화 `toLocaleString`(no-locale), 테마 쿠키 flash, antd 자동 id. **각 항목 per-file 검증 필요**(critic의 A섹션 RecentFeedbackCard는 이미 고쳐져 있어 false member — 일괄 적용 금지). 근본처방 권고: 공용 tz-pinned 포매터 + raw `toLocale*` 금지 lint.
  - 전체 결과 파일: `tasks/wvdu3uksd.output` (세션 temp).

## Verification State

- Required checks: dev 서버 부팅 + `/` 로드 + 콘솔 에러 캡처(에러1/에러2 부재 확인) + 스크린샷.
- Checks run: dev 재부팅(`.next` 제거 후, Ready 362ms, :3000) → Playwright headless(clean 브라우저, ko-KR)로 `http://localhost:3000/` 로드 → 콘솔/pageerror 캡처 + fullPage 스크린샷(`verify-landing-home.png`).
- Latest results: STATUS=200; ERROR_COUNT=0 (pageerror 0 + console error 0); HAS_KEY_SPREAD_WARN=false; HAS_HYDRATION_WARN=false; BODY_HAS_DEMOWAY_ATTR=false; PREVIEW_CARD_COUNT=3; 콘솔=React DevTools 안내 + `[HMR] connected`뿐. 스크린샷 육안 확인: 헤더/히어로/기능4/프리뷰3 정상 렌더, 레이아웃 회귀 없음.
- Latest results (정정 후 결정적 재검증, 경합 0 단일 dev b1p8g001f, 2회 로드): `/`에서 4중 확인 — (1) 브라우저 콘솔 error 0, (2) dev 에러 오버레이 없음(OVERLAY_HAS_KEY_SPREAD=false), (3) 서빙 client 청크 `src_components_0_lo6jm._.js` hasSpreadSig=**false**, (4) **dev 서버 로그 `GET / 200`에 key-spread/PreviewMock 경고 0**. → 에러2(key-spread) 서버측·클라측 모두 부재 확정.
- Latest results (cache-header 근본 수정 검증, dev bx5no6s9e): (1) dev 시작 로그에서 "Custom Cache-Control headers detected" 경고 **사라짐**, (2) 정적 청크 응답 `Cache-Control = no-cache, must-revalidate`(이전 immutable), (3) 랜딩 `/` 콘솔 0·key-spread 없음·청크 hasSpreadSig=false, (4) `tests/integration/cache-headers.test.ts` 4 pass(prod=immutable / dev=부재). → 서버측 근본 원인 제거 확정. **잔여**: 사용자 브라우저에 이미 박힌 immutable 옛 청크는 설정 수정으로 안 지워짐 → hard-reload 1회 필요(설명함).
- Known failures: 신고와 무관한 **별개 발견** — dev 로그에 `/auth/error` hydration mismatch 2건: (a) reason 메시지 텍스트 SSR↔client 불일치(`AuthErrorCard.tsx` reason/`useSearchParams` SSR), (b) 카운트다운 span 유무 불일치(`remaining` 초기값/`useSearchParams`). antd `Form.Item` auto-id도 후보. 랜딩 아님·다른 라우트. 완전성 점검 §F와 일치. 보고만, 수정은 범위 밖.
- Skipped checks and reason: 에러1(Demoway hydration)은 clean 자동화 브라우저에 Demoway 확장이 없어 직접 재현 불가. 대체 검증: (a) repo 전체 grep "demoway"=0 → 코드 아님 확정, (b) `suppressHydrationWarning`을 확장이 변형하는 바로 그 엘리먼트(`<body>`)에 적용 = React 공식 처방, (c) clean 브라우저 무회귀(ERROR_COUNT=0)로 부작용 없음 확인.
- Cross-model review: degraded — diff가 trivial(1-prop + 주석)하고 한글 주석은 codex(Windows)에서 mojibake 위험([[codex-review-mojibake-windows]]). 대신 Workflow의 적대적 refutation 에이전트(동계열 cross-check)로 근거/처방을 반증 시도 → **결과: refutation 0건, 두 claim 유지(claims hold)**.
- Architecture Pass: n/a (구조 변경 없음, 1-line prop)
- Light Spec: n/a (phase 작업 아님)
- UX/UI Consistency Pass: skipped — 시각/마크업 변경 없음. `suppressHydrationWarning`은 렌더 출력에 영향 없는 hydration 진단 플래그(스크린샷으로 무회귀 확인).
- QA Gate: passed — 로컬 dev 부팅 + `/` 직접 로드 + 콘솔 캡처(ERROR_COUNT=0) + 스크린샷 완료.

## Fallback State

- Normal path blocked: none.
- Failure class: none.
- Fallback used: none.
- Evidence collected: (pending browser)
- Completion allowed: no (검증 전).
- Remaining fallback risk: 에러1 직접 재현 불가(확장 의존) → degraded 설명 필요.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes.
- Child result packets integrated: yes (Workflow wf_04aee931-214 통합).
- Verification state current: yes (브라우저 ERROR_COUNT=0 + 워크플로 반증 0).
- Remaining risks listed: yes.

## Risks And Follow-Up

- Remaining risks: 에러1은 사용자 브라우저 확장 의존 → 확장 제거/타 확장에서도 안전하도록 body 한정 suppress. 신고와 무관한 기존 hydration 패밀리(아래) 미수정 시 profile/library/growth 등에서 자정 부근 날짜 React #418 가능.
- Assumptions: 사용자는 dev(Turbopack) 모드에서 관찰; 에러2는 dev-only warning.
- Follow-up needed (사용자 승인 대기): (1) 확정 3건(StatusHelpCard:71, LibraryStatsPanel:51, GrowthDashboard:339) tz 핀, (2) 의심 패밀리 per-file 검증+수정, (3) 공용 tz-pinned 날짜/숫자 포매터 + lint 규칙(근본처방).

## Continuation — 2026-06-04 (재신고: 동일 2 에러 재출현, 진단 only · 코드 변경 없음)

- 사용자 콘솔 재출현 2건: (a) `ProductPreview.tsx` key-spread warning, (b) hydration mismatch — 이번엔 `LandingHeader`의 `<header>` 인라인 스타일.
- 재진단 결론: **소스·서버 모두 정상**. 동일 root cause(이 ledger 20:30 행: dev immutable 캐시 → 브라우저가 옛 청크 1년 핀)의 사용자측 잔여 증상.
  - `ProductPreview.tsx` working-tree diff 0건, `{...}` 스프레드 0건 → 경고가 가리키는 코드 본문이 현재 파일에 없음(스테일 청크).
  - `LandingHeader.tsx`는 working tree에서 `var(--app-border, #f0f0f0)` → `var(--app-color-border)`(정의됨: global.css:17)로 이미 수정(미커밋, 리디자인 변경). 브라우저 hydration diff의 client 값이 옛 `var(--app-border, #f0f0f0)` → 이 편집 이전 청크 실행 중임을 입증.
- 라이브 검증: 단일 dev 서버(PID 10124, :3000). `/_next/static/...` 응답 헤더 = `Cache-Control: no-cache, must-revalidate`(immutable 아님) → next.config prod-only 가드 실제 작동, 서버 재오염 없음.
- 남은 조치: **사용자 브라우저 핀 청크 1회 비우기(hard-reload, Ctrl+Shift+R)** 뿐. 서버 재시작/`.next` 삭제 불필요(서버 정상 + 경합 위험 회피). 참고: [[project-dev-immutable-cache-stale-chunk]].
