# 1차 수정 실행 계획안 (QA 2026-06-12 발견사항)

| 항목 | 내용 |
| --- | --- |
| 상태 | **실행 완료(2026-06-12)** — 브랜치 `first-qa-remediation`, 커밋 `4d0032f`(작업0) · `f5afb7d`(D-2) · `bdeff1b`(D-3) · `46409f8`(G6) · `60ed769`(D-5) · `8a435f3`(T-1). e2e 207/0/4 · 수동 4/4 |
| 출처 | [`docs/qa/reports/qa-report-20260612-1205.html`](../reports/qa-report-20260612-1205.html) (QA 실행 계획 rev6 결과) |
| 작성 | 2026-06-12 |
| 범위 결정(owner) | 결함(P2/P3) + G6 로그아웃 / D-4 포맷 보류 / LoginForm은 외부 변경 먼저 커밋 |

## Context

QA 리포트의 발견사항을 수정한다. 사용자(owner) 결정 확정 사항:

- 범위 = **결함(P2/P3) + G6 로그아웃 UI** (G1 이탈 경고는 보류)
- D-4 prettier 포맷 드리프트(193파일) = **보류** (동시 에이전트 작업 충돌 회피)
- LoginForm.tsx의 **외부(동시 에이전트) 미커밋 변경을 먼저 커밋**한 뒤 D-2 수정 진행
- 작업 후 **깃 커밋 + QA 보고서 업데이트**까지 완료

D-1(`NEXT_PUBLIC_SITE_URL`)은 코드가 아닌 **배포 환경 변수 액션**이므로 본 계획의 코드
범위 밖(보고서에 배포 게이트로 기록됨). 로컬 `.env.local`에는 QA 중 이미 추가됨.

## 작업 항목

### 0. 외부 변경 먼저 커밋 (owner 지시)

- 대상: `messages/ko.json` + `src/components/auth/LoginForm.tsx`
  (매직링크 안내 UI — `text-center`, `<br>` rich tag)
- 별도 커밋, 메시지에 "동시 에이전트(Antigravity) 작업 정착" 명시
- `next-env.d.ts`는 빌드 산출물(dev/prod 전환 시 자동 변경)이므로 **커밋하지 않음**
- 주의: ko.json에 `br` rich tag가 추가됐다면 en/vi 카탈로그 패리티 확인
  (`tests/lib/i18n/catalog-parity.test.ts`) — 깨지면 외부 변경 쪽 문제로 owner에게
  보고(임의 수정 금지)

### 1. D-2 (P2) — 인증 핸들러 redirect-throw 방어 (영구 로딩 제거)

근본 원인: `buildAuthRedirectUrl()`이 prod에서 `NEXT_PUBLIC_SITE_URL` 부재 시 동기
throw → `void handler()`라 unhandled rejection → `setLoading(false)` 미도달 → 버튼
영구 로딩.

수정 대상 5곳 (전부 동일 패턴):

- `src/components/auth/VerifyEmailCard.tsx` `handleResend` (L168~172)
- `src/components/auth/AuthErrorCard.tsx` 재전송 핸들러 (L144)
- `src/components/auth/SignUpForm.tsx` (L76)
- `src/components/auth/PasswordResetRequestForm.tsx` (L64)
- `src/components/auth/LoginForm.tsx` 매직링크 (L165) — **작업 0 커밋 후** 수정

패턴: supabase 호출 + URL 빌드를
`try { ... } catch { message.error(기존 실패 키 재사용) } finally { setXxx(false) }`로
감싼다.

- **새 i18n 키 추가 지양** — 각 폼의 기존 일반 실패 키(`resendFailed` 등) 재사용.
  부득이 새 키가 필요하면 ko/en/vi 3로케일 동시 추가(catalog-parity 테스트 게이트).
- 단위 테스트: `tests/components/auth/*.test.tsx` 기존 패턴에 "builder throw 시 로딩
  해제+오류 표시" 케이스 추가 (redirect-url 모듈 mock으로 throw 유도).

### 2. D-3 (P2) — 잘못된(비-uuid) `?problem=` id 가드

- 파일: `src/lib/writing/server.ts`의 `getWritingProblem(questionNo, problemId)` 입구
- problemId가 존재하는데 uuid 형식
  (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`)이 아니면 DB
  조회 없이 **존재하지 않는 문제와 동일 경로**(null 반환) → 기존의 정상 빈 상태
  UI("지문을 불러오지 못했어요" + 다시 시도 + 문제 목록으로)가 그대로 재사용됨.
  서버 에러 바운더리 도달 차단.
- 단위 테스트: `tests/lib/writing/`에 malformed id → null 케이스 추가.

### 3. G6 — 로그아웃 진입점 추가 (스펙 갭, owner 승인 = 본 계획)

- **UI**: 워크스페이스 사이드바 하단(사용자/플랜 카드 영역 근처)에 로그아웃 버튼.
  - 위치 파일: `src/components/app/SidebarNav.tsx` 또는 사이드바 footer를 렌더하는
    워크스페이스 셸(footer 카드 "매일 조금씩…" 렌더 위치를 추적해 결정).
  - 동작: **HTML `<form method="post" action="/auth/sign-out">`** + submit 버튼.
    `src/app/auth/sign-out/route.ts`가 POST 전용(CSRF 보호) + 303→`/login`이며
    주석에 "form action or fetch from client" 명시 — form post가 가장 단순·정합.
- **i18n**: `nav.logout` 키 ko/en/vi 3로케일 추가 (catalog-parity 게이트).
- **문서 정합(CLAUDE.md 게이트)**:
  - `docs/flow/user-flow.md`: B01 -. "로그아웃" .-> A02 엣지 추가
  - `docs/Wireframe/04-B-01-home-dashboard/description.md`: 사이드 내비 설명에
    로그아웃 반영
- **e2e**: 신규 spec 1개 (desktop-1280 한정).
  - ⚠️ **공유 storageState로 로그아웃 금지** — signOut이 토큰을 revoke해 잔여
    테스트의 세션을 깨뜨릴 수 있음. `auth.setup.ts` 패턴대로 **자체 컨텍스트에서
    fresh login → 로그아웃 → /login 도착 + 이후 protected 접근 시 redirect** 단언.

### 4. D-5 (P3) — 루트 404

- 신규 파일: `src/app/not-found.tsx` — 기존
  `AppNotFound`(`src/components/shared/AppNotFound.tsx`) 재사용 1줄
  패턴(`src/app/(workspace)/not-found.tsx`와 동일).
- 루트 레이아웃이 `AppProviders`(intl)+`AntdRegistry`를 이미 제공하므로 그대로 동작.
  `/dashboard` 링크는 비로그인 시 기존 가드가 `/login`으로 보냄(허용).

### 5. T-1 (P3, 테스트만) — stale 셀렉터 교체

- `tests/e2e/flows/core-writing-flow.spec.ts:81`: `.ant-modal-title` →
  `page.getByTestId("submission-confirm-modal")` 가시성 + 제목 heading 확인
  (`submission-confirm-modal.spec.ts` 패턴 재사용). antd 6은 모달 제목을 `h2`로
  렌더(클래스 없음).

### 6. QA 보고서 업데이트 (owner 요청)

- `docs/qa/reports/qa-report-20260612-1205.html`:
  - Defect log D-2/D-3/D-5 status: open → **resolved(커밋 해시 기재)**, T-1 동일
  - 스펙 갭 G6: "구현됨(owner 승인, 커밋 해시)" 표기 + UX U-1 해소
  - Command results: 최종 e2e 수치 갱신
  - (보너스) X-09 저장 영속성 UNVERIFIED → 검증 단계에서 직접 확인 후 해소 기록

## 검증 (CLAUDE.md E2E 게이트 의무)

1. `pnpm typecheck` && `pnpm test` (vitest — 신규 단위 테스트 포함 GREEN)
2. 포트 3000 점유 프로세스 확인·정지(IDE dev 재기동 가능성 주의) → `.next` 삭제 →
   `pnpm build`(M5 preflight 통과) → `pnpm start`
3. `pnpm test:e2e` 풀 실행 — **기대: 0 fail**
   (이전 205 pass + T-1 해소 + 신규 logout spec ≈ 207 pass / 2 skip)
4. 브라우저 수동 확인(서버 떠 있는 동안):
   - 로그아웃 버튼 → /login → 보호 라우트 재접근 차단
   - `?problem=잘못된id` → 빈 상태 UI(에러 바운더리 아님)
   - `/없는경로` → 커스텀 404
   - X-09 알림: 토글→저장→재진입 값 유지 (UNVERIFIED 해소)
5. 종료 시 QA prod 서버 정지(포트 3000 비움)

## Git 커밋 (관심사별 분리, `git add -A` 금지·파일 명시)

1. 외부 변경 정착: `messages/ko.json` + `LoginForm.tsx` (외부 작업 명시)
2. `fix(auth)`: D-2 핸들러 5곳 + 단위 테스트
3. `fix(writing)`: D-3 uuid 가드 + 테스트
4. `feat(nav)`: G6 로그아웃 (UI + i18n 3로케일 + docs 2건 + e2e spec)
5. `fix(app)`: D-5 루트 not-found
6. `test(e2e)`: T-1 셀렉터 교체
7. `docs(qa)`: 보고서 status 갱신

제외 유지: `next-env.d.ts`(빌드 산출물), `.scratch/`(진단 스크립트),
`.env.local`(gitignore).

## Out of scope (이번 작업 아님)

- D-1: 배포 환경에 `NEXT_PUBLIC_SITE_URL` 설정 — 인프라/owner 액션 아이템
- D-4: 포맷 드리프트 193파일 — 보류(동시 작업 정리 후 별도 기계적 커밋)
- G1: 앱 내 이동 이탈 경고 배선 — 보류(별도 승인·작업)
- G2~G5, G7~G10: 문서 게이트 에스컬레이션 유지
- 스텁 실연동(실 AI 피드백, 결제 provider, 알림 발송 transport): 제품 로드맵

## Docs consulted

- `docs/qa/reports/qa-report-20260612-1205.html` — 결함/갭/UNVERIFIED 출처
- `docs/flow/user-flow.md` — 로그아웃·D-M3 흐름 정합 기준
- `docs/Wireframe/04-B-01-home-dashboard/description.md` — 사이드 내비 명세
- `src/lib/auth/redirect-url.ts`, `src/app/auth/sign-out/route.ts`,
  `src/lib/writing/server.ts`, `src/components/app/SidebarNav.tsx`,
  `src/components/shared/AppNotFound.tsx` — 수정 지점 코드 근거
- `CLAUDE.md` — E2E 게이트·문서 게이트·커뮤니케이션 규칙
