# 2026-06-22 회원 탈퇴(self-service 계정 삭제) 구현 브리프 + SOT 정합안

> 상태: PROPOSED (구현 착수 전 사용자 확정 대기 항목은 "미해결 결정" 참조)
> 결정 기준일: 2026-06-22 (6/22 MVP 당일)
> 작성 경위: 사용자가 "회원 탈퇴 기능 계획안" 요청 → 영향도 파악, SOT 조사,
> 멀티 에이전트(critic) 비판 검토를 거쳐 정리. 사용자 결정 3건 반영(아래 결정 기록).

## 배경

현재 앱에는 self-service **회원 탈퇴(계정 삭제)** 기능이 없다. 이 기능은 net-new
스코프가 아니라 **이미 active SOT에 정의된 요구사항**이다.

- `docs/prd.md:321` — "계정 보안에서 비밀번호 변경, 마케팅 수신 동의, **회원 탈퇴**를 관리할 수 있어야 한다."
- `docs/development-core-planning/01-core-decisions/README.md:27` (확정, PM/OPS, 2026-05-20) — "탈퇴 계정은 **30일 복구 유예 후** 개인정보를 비식별/삭제한다. 휴면 전환은 MVP 미적용."
- `docs/Wireframe/02-A-02-login/description.md:64,82` — 로그인 예외에 "휴면/**탈퇴 계정**" 인라인 안내가 정의됨.
- `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md` — 보류 대상(결제/외부알림/정식법무)에 회원 탈퇴는 **포함되지 않음** → 6/22 MVP 범위 내.

다만 (a) 두 SOT가 삭제 정책에서 충돌하고, (b) 회원 탈퇴 전용 화면 기능명세가 없으며,
(c) 코드에 계정 status 검증 게이트가 전무하다. 본 문서가 이 셋을 정리한다.

## 변경이 필요한 SOT (정합 제안)

### 1. SOT 충돌: 삭제 정책

| 문서 | 현재 문구 | 성격 |
| --- | --- | --- |
| `docs/development-core-planning/01-core-decisions/README.md:27` | "30일 복구 유예 후 비식별/삭제" | **확정**(담당자·근거 명시) |
| `docs/Wireframe/36-X-14-privacy-policy/description.md:36` | "회원 탈퇴 시 즉시 파기" | **placeholder**(법무 검토 전, scope-decision에 보류 명시) |

- **정합 방향(제안)**: 확정 결정(30일 유예)을 기준으로 삼고, 개인정보처리방침
  `description.md:36` 문구를 "회원 탈퇴 요청 시 즉시 비활성화(로그인 차단)하고,
  30일 복구 유예 후 개인정보를 비식별/파기한다"로 갱신한다. 정식 법무 검토 시
  최종 확정한다(placeholder 상태 유지).
- 본 문서는 SOT 문서를 직접 수정하지 않는다. 위 문구 갱신은 사용자 확정 후
  별도 반영한다(AGENTS.md: SOT 직접 변경 금지, 제안만).

### 2. 화면 기능명세 부재

- 회원 탈퇴는 전용 Wireframe 화면이 아니라 **계정 설정(`/settings/account`)** 내
  danger-zone로 배치한다(PRD "계정 보안" 묶음과 일치).
- `docs/Wireframe/data-usage-index.md`에 `profiles.deleted_at` 신규 컬럼과
  탈퇴 RPC의 데이터 사용을 추가한다.
- `supabase/migrations/INDEX.md`에 신규 migration 줄을 추가한다.

## 수용 기준 (Acceptance Criteria)

1. 로그인 사용자가 `/settings/account`에서 회원 탈퇴를 실행할 수 있다(type-to-confirm 확인 모달).
2. 탈퇴 성공 시 `profiles.status='deleted'`, `profiles.deleted_at=now()`로 기록되고,
   전 기기 세션이 무효화된다.
3. 탈퇴 사용자는 **모든 인증 경로**(workspace 라우트, `/api/*`)에서 차단되어
   `/login?reason=withdrawn` 인라인 안내로 돌아간다.
4. 멀티 기기/탭: 다른 기기/탭에서 다음 이동·요청 시 동일하게 차단된다(상세는 아래 설계).
5. 멱등성: 더블클릭/재호출 시 `deleted_at`가 재스탬프되지 않고 성공으로 처리된다.
6. 하드 삭제(storage + auth.users 파기)는 **후속 범위**로 분리한다(6/22 비-blocking).
7. 복구 플로우는 **후속 범위**. 이번엔 로그인 시 안내만 제공한다.

## 구현 반영 방향 (Phase / TODO)

### Phase 1 — DB (additive·idempotent + down migration 동반)
- `profiles.deleted_at timestamptz` 추가(가산형).
- `private.protect_profile_columns()` 보완: 비-admin이라도 **본인의 `active → deleted`
  단방향 전이만** 허용(그 외 status 변경·역방향은 계속 차단). 복구(`deleted → active`)는
  허용하지 않는다(후속 admin/service-role 경로).
- `public.request_account_deletion()` SECURITY DEFINER RPC:
  - `auth.uid()` 본인 행만 대상, `search_path` 잠금, `revoke from anon`.
  - 멱등: 이미 `deleted`면 재스탬프 없이 성공 반환(패턴: `admin_set_user_status`
    `20260602120400_admin_and_user_rpcs.sql`의 `if old_status = new_status then return`).
  - `admin_audit_logs`에 탈퇴 기록(보존 대상 테이블).
- `supabase/migrations/down/`에 대응 down migration 작성.

### Phase 2 — 인증 게이트 (보안 핵심, 비-타협)
- `src/lib/auth/profile.ts`의 `getSessionAndProfile`(또는 workspace layout)에
  `status='deleted'`(및 `'blocked'`) 차단 추가 → `/login?reason=withdrawn` redirect.
  ※ 현재 status는 어느 인증 경로에서도 검증되지 않음(= `blocked`도 무력 상태).
- `/api/*`는 proxy 매처에서 제외되고 다수가 service-role(RLS 우회)이므로,
  공용 가드 `requireActiveUser()`를 추가해 API 경로에서도 status를 검증한다.
- `src/proxy.ts`는 최소 변경 또는 무변경(검토 후 결정; layout 게이트로 충분한지 확인).

### Phase 3 — 탈퇴 실행 경로
- 서버 액션(service-role 콜로케이션): `request_account_deletion()` 호출 +
  `supabase.auth.admin.signOut(userId, 'global')`로 refresh token 폐기 + 로컬 세션 정리.
  ※ `admin.signOut`은 token 폐기용이며 `deleteUser`와 구분(하드 삭제는 후속).
- 로그인 차단 배선: `LoginForm`에 이미 존재하는 `REASON_NOTICE.withdrawn` 스캐폴드
  (`src/components/auth/LoginForm.tsx:50`, i18n 키 `auth.login.noticeWithdrawn` 존재)를
  실제 `?reason=withdrawn` 진입과 연결.
- i18n 문구 정합: `messages/*.json`의 `noticeWithdrawn` 현재 문구("새로 가입해주세요")가
  30일 복구 모델과 어긋나므로, 복구 안내 톤으로 소폭 갱신(ko/en/vi).

### Phase 4 — UI (`talkpik-ui-system`, AntD 우선)
- `src/app/(workspace)/settings/account/page.tsx`에 danger-zone 카드 추가
  (`AccountLoginMethodsCard`/`StatusHelpCard`/`ProfileLogoutForm` 옆).
- type-to-confirm 확인 모달, loading/success/error/disabled 상태, 인라인 스타일 금지.
- desktop/mobile 양쪽 확인.

### Phase 5 — 후속(비-6/22-blocking)
- 30일 하드 삭제: `deleted_at < now() - interval '30 days'` 대상 신규 함수 +
  별도 pg_cron 잡. 기존 `cleanup_unconfirmed_users`(`email_confirmed_at IS NULL` 전용)는
  재사용 불가. storage.objects → auth.users 삭제 순서 패턴(`20260526180000`) 준수.
- 복구 플로우(grace 내 재로그인 시 active 복원) RPC/UI.
- 비식별(익명) 학습 통계 보관 정책 구체화.

## 멀티 기기/탭 세션 처리 설계 (요청 핵심)

토큰 무효화만으로는 다른 기기가 즉시 튕기지 않는다(JWT는 stateless, 만료 전까지 유효).
권위 있는 통제점은 **"모든 요청에서 서버측 status 검증"**이고, 토큰 무효화는 보조다.

| 시나리오 | 처리 | 비고 |
| --- | --- | --- |
| 다른 기기 페이지 이동 | proxy → workspace layout의 status 검증이 `/login?reason=withdrawn`로 차단 | 권위 통제점 |
| 다른 기기 세션 갱신 시점 | `admin.signOut(global)`로 refresh token 폐기 → 갱신 실패 | 방어심화 |
| 같은 브라우저 다른 탭 | `WorkspaceShell`에 `onAuthStateChange` 리스너 → `SIGNED_OUT` 수신 시 즉시 redirect | 실시간 탭 동기화 |
| `/api/*` 호출 | `requireActiveUser()` 가드가 status 검증 | proxy 제외 영역 |
| idle 열린 탭(이동·API 없음) | access token 만료(~1h)/다음 상호작용까지 인지 못함 | 문서화된 허용 한계 |

## 결정 기록 (사용자 결정 2026-06-22)

1. **삭제 정책 = 30일 유예 소프트삭제, 하드삭제는 후속**.
   - 근거: 확정 SOT(30일 유예) 부합 + MVP 당일 되돌릴 수 없는 즉시삭제는 고위험.
     첫 코호트가 30일에 도달하는 시점은 7월 말이라 하드삭제 cron은 비-blocking.
   - 검토한 대안: ⓐ 30일 유예 + 하드삭제 cron 동시 구현(범위·검증 부담 증가, 미채택),
     ⓑ 즉시 하드삭제(개인정보처리방침 placeholder 부합하나 확정 결정과 충돌·되돌릴 수 없음, 미채택).
2. **복구 플로우 = 안내만, 복구 RPC/UI는 후속**.
   - 근거: 복구는 protect-columns 트리거 우회가 필요해 비-자명하고 MVP 가벼움 우선.
   - 검토한 대안: 자동 복구 포함(트리거 예외·UI 추가 필요, 후속으로 분리).
3. **문서 처리 = 본 구현 브리프 + SOT 정합안 작성**(승인 완료, 본 문서).

## 검증 기준

- DB: `request_account_deletion()` 멱등성/권한(anon revoke)·트리거 단방향 예외 단위 검증,
  RLS 영향 점검, `supabase/migrations/INDEX.md`·`data-usage-index.md` 갱신.
- 인증: status 게이트 단위테스트(deleted/blocked → redirect), `requireActiveUser` API 가드.
- 명령: 영향 범위 기준 unit/integration, `pnpm lint`, `pnpm typecheck`.
- e2e: 설정 → 탈퇴 → 로그인 차단(`?reason=withdrawn`) → 멀티 탭/세션 무효화 흐름.
  desktop/mobile, loading/empty/success/error/disabled 상태.
- 보안: service-role 키 비노출(서버 액션/route 한정), 토큰 폐기 동작, 실패 케이스.

## 구현 결과 (2026-06-22)

소프트 삭제 단계를 구현 완료했다. 적대적 멀티 에이전트 리뷰(5개 차원)에서
초기 스코프가 놓친 결함을 발견해 보강했다.

### 구현 범위
- DB: `20260622120000_account_deletion_soft_delete.sql`(+down). `deleted_at`,
  `protect_profile_columns` self `active→deleted` 예외, `request_account_deletion()` RPC.
- 인증 게이트(권위 통제점): workspace layout + `/api/export/pdf` + `/api/writing/evaluation-status`
  에 `status` 검증 추가. 비활성 계정은 `/auth/account-inactive`(쿠키 정리 GET route)
  → `/login?reason=withdrawn|blocked` 로 보낸다(리다이렉트 루프 회피).
- 실행 경로: `/auth/account-delete`(POST) → RPC + `signOut({scope:'global'})` → `/login?reason=withdrawn`.
- UI: `AccountDeletionCard`(danger-zone, type-to-confirm 모달), settings/account 에 배치.
- 멀티 기기/탭: `WorkspaceShell` `onAuthStateChange` → SIGNED_OUT 시 `/login`.
- i18n: `settings.account.dangerZone`(ko/en/vi), `noticeWithdrawn` 30일 정책 정합.

### 리뷰에서 보강한 결함
- **type-to-confirm 우회(중대)**: 모달 form 에 `preventDefault` 가 없어 Enter 키로
  버튼 disabled 를 우회해 즉시 삭제 가능했음 → `!canSubmit` 시 제출 차단으로 수정.
- **게이트 누락 surface(중대)**: deleted 계정이 유효 JWT(~1h)로 mutation 가능했던
  `/auth/post-auth`(backfill), `/auth/consent`(page+action), `submitWritingAction`,
  `createComparisonReportAction` 에 `requireActiveSession`/`fetchProfileStatus` 게이트 추가.

### 잔존 위험(후속)
- 클라이언트 직접 Supabase 변경(설정 폼: 언어/알림/프로필 편집)은 브라우저 RLS 경로라
  서버 게이트로 막을 수 없다. deleted 계정의 ~1h 잔존 윈도우 동안 본인 비-보호 컬럼
  변경이 이론상 가능(저위험·미관). 포괄적 차단은 self-update RLS 정책에 `status='active'`
  조건을 추가하는 **RLS 레벨 후속 작업**으로 권고한다.
- 30일 하드 삭제 cron + storage 파기, 복구 RPC는 여전히 후속.

### 검증
- `pnpm typecheck` ✅, `pnpm lint` ✅(0 errors). 단위/컴포넌트/route 테스트: 본 작업이
  추가·수정·접촉한 22개 파일 149 테스트 ✅. 신규 테스트: status 게이트(layout),
  helper(profile-status), danger-zone(Enter 우회 가드 포함), account-delete/inactive route,
  멀티탭 SIGNED_OUT, RPC 통합(gated).
- RPC/RLS 통합 테스트는 `SUPABASE_LOCAL_STACK=1` 게이트(로컬 Supabase/Docker 필요)라
  이 환경에서 미실행. 마이그레이션은 라이브 DB 미적용(적용 명령: `supabase db reset` /
  CLI push). e2e(danger-zone, 비파괴)는 dev 서버+E2E 계정 필요로 이 환경 미실행.
- 무관 사전 실패: `weakness-flow`, `LearningLiveCards`(커밋 HEAD에서도 실패) 및
  사용자 WIP(`LandingAuthCta`/`AnalysisLoadingPage`/`WritingEditor.submit-flow`,
  global.css·분석 UI 리팩터)은 본 작업과 무관함을 stash 베이스라인으로 확인.

## 미해결 결정 (구현 착수 전 확인 필요)

- 개인정보처리방침 `description.md:36` 문구 갱신 최종 승인(법무 검토 전 placeholder 갱신).
- `blocked` status도 이번에 함께 게이트로 차단할지(현재 무력 상태) — 보안상 함께 처리 권장.
