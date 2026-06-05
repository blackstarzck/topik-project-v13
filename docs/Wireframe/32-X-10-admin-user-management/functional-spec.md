# X-10 관리자 사용자 관리 기능명세

## 화면 목적

플랫폼 관리자가 사용자 상태와 역할을 관리한다.

## 사용자와 권한

- Audience: admin
- 권한 기준: admin guard와 RLS helper/RPC를 통과해야 한다. 변경은 감사 로그 대상이다.
- 관리자 범위: `docs/admin-scope-boundary.md` 기준으로 현행 frozen 관리자 코드 기록용이며, 신규 관리자 기능 확장이나 관리자 스키마/마이그레이션 추가 대상으로 보지 않는다.

## 진입/이탈 흐름

- Route: `/admin/users`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: X-15 관리자 인덱스의 사용자 관리 또는 X-08 기관 관리자 대시보드의 사용자 관리 링크.
- 이탈 경로: 같은 화면의 상세/역할/감사 패널을 열거나 X-15/X-08로 돌아간다.
- 화면 내부 동작: KPI, 필터, 검색, 테이블 선택, 역할 변경, 일괄 차단을 처리한다.

## 주요 기능

- 사용자 목록
- 역할 변경
- 상태 표시
- 감사 로그

## 상태/오류

- 권한 없음, 보호 컬럼 직접 변경 차단

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `id`, `display_name`, `email`, `app_role`, `plan_label`, `status`, `created_at` | read/write | 관리자 사용자 목록, 역할/상태 변경에 사용한다. | admin guard + RLS helper/admin RPC; audit log required for mutations | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/admin/queries.ts`<br>`src/lib/admin/server.ts`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | none |
| `admin_audit_logs` | `admin_user_id`, `action`, `target_table`, `target_id`, `diff` | write/read | 관리자 권한 변경 이력을 남긴다. | admin guard + RLS helper/admin RPC; audit log required for mutations | `supabase/migrations/20260520120800_audit.sql` | none |
| `rpc:public.admin_change_user_role` | - | rpc | 사용자 역할 변경을 서버 측 검증과 감사 로그로 처리한다. | admin guard + RLS helper/admin RPC; audit log required for mutations | `src/lib/admin/server-actions.ts`<br>`supabase/migrations/20260521140000_phase_6_rpc_and_admin.sql` | none |
| `rpc:private.is_platform_admin` | - | RLS helper | 플랫폼 관리자 권한 확인에 사용한다. | admin guard + RLS helper/admin RPC; audit log required for mutations | `supabase/migrations/20260521140000_phase_6_rpc_and_admin.sql` | none |

## 현재 구현 상태

- 현행 frozen 코드는 `admin_change_user_role` RPC와 `admin_audit_logs` 기록 경로를 둔다.

## 코드 구현 근거

- 관리자 화면은 `docs/admin-scope-boundary.md` 기준으로 현재 신규 구현, 확장, 관리자 스키마/마이그레이션 추가 대상이 아니다. 아래 항목은 현행 frozen 관리자 코드 확인용이다.
- `AdminUsersPage` - `src/app/(workspace)/admin/users/page.tsx`
- `requirePlatformAdmin` - `src/lib/auth/admin-guard.ts`
- `AdminUsersConsole` - `src/components/admin/AdminUsersConsole.tsx`
- `AdminUserTable` - `src/components/admin/AdminUserTable.tsx`
- `AdminUserDetailPanel` - `src/components/admin/AdminUserDetailPanel.tsx`
- `AdminUserRoleModal` - `src/components/admin/AdminUserRoleModal.tsx`
- `fetchAdminUserDirectory`, `fetchAdminUserStats`, `setUserStatus` - `src/components/admin/admin-rpc.ts`
- `setUserStatusAction` - `src/app/(workspace)/admin/actions.ts`

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.
- 관리자 변경 기능은 admin_audit_logs 기록 여부를 후속 QA 기준에 포함한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.
