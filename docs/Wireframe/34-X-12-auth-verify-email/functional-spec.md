# X-12 이메일 인증 안내 기능명세

## 화면 목적

가입 직후 이메일 확인과 재발송 제한을 안내한다.

## 진입/이탈 흐름

- Route: `/auth/verify-email`
- Route type: page
- Audience: public
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 이탈: 다음 CTA, 상위 목록, 인증 오류, 권한 오류, 또는 빈 상태 CTA로 이동한다.

## 주요 기능

- 인증 메일 안내
- 재발송
- cooldown
- 로그인 복귀

## 상태/오류/권한

- 메일 미도착, rate limit, 이미 인증됨
- 권한 기준: public route. 세션이 없을 수 있으므로 사용자 row 접근을 전제로 하지 않는다.

## 현재 구현 상태

- handle_new_user trigger와 profile 상태를 함께 고려한다.
- 실제 구현 여부는 `src/**`, IA 감사 산출물, 이 문서의 DB 근거를 함께 확인한다.

## 미구현/불일치

- Auth 중심 화면은 Supabase Auth 동작과 UI 상태 연결을 함께 확인해야 한다.

## 추가 발견 후보

- IA 감사 결과와 source-map이 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `id`, `email`, `status` | read | 가입 직후 이메일 인증 안내와 인증 상태 확인에 연결된다. | public/auth flow; no user-owned row access unless session exists | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/admin/queries.ts`<br>`src/lib/admin/server.ts`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | none |
| `rpc:public.handle_new_user` | - | trigger | 가입 직후 프로필 row 생성을 보장한다. | public/auth flow; no user-owned row access unless session exists | `supabase/migrations/20260521120000_auth_user_profile_bootstrap.sql` | none |

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.

## 검증 근거

- Description: `docs/Wireframe/34-X-12-auth-verify-email/description.md`
- Wireframe: `docs/Wireframe/34-X-12-auth-verify-email/wireframe.png`
- Route map: `docs/sitemap.md`
- Active user flow: `docs/flow/user-flow.md`
- DB inventory: `reports/wireframe-functional-specs/runs/20260601-1542/data-inventory.json`
- Evidence: `src/app/(workspace)/profile/page.tsx`
- Evidence: `src/lib/admin/queries.ts`
- Evidence: `src/lib/admin/server.ts`
- Evidence: `src/lib/auth/profile.ts`
- Evidence: `src/lib/settings/mutations.ts`
- Evidence: `src/lib/settings/server.ts`
- Evidence: `supabase/migrations/20260520120100_profiles_goals.sql`
- Evidence: `supabase/migrations/20260521141000_phase_6_notification_prefs.sql`
- Evidence: `supabase/migrations/20260526170000_phase_7_profile_bio.sql`
- Evidence: `tests/integration/profile-trigger.test.ts`
- Evidence: `tests/integration/rls-smoke.test.ts`
- Evidence: `supabase/migrations/20260521120000_auth_user_profile_bootstrap.sql`
