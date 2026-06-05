# X-15 관리자 인덱스 기능명세

> 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.

## 화면 목적

`/admin` 직접 진입 시 관리자 전용 섹션의 상위 허브를 제공하고, 현재 역할이 접근할 수 있는 하위 관리 화면 카드만 보여준다.

## 사용자와 권한

- Audience: admin
- 관리자 범위: `docs/admin-scope-boundary.md` 기준으로 현행 frozen 관리자 코드 기록용이며, 신규 관리자 기능 확장이나 관리자 스키마/마이그레이션 추가 대상으로 보지 않는다.

## 진입/이탈 흐름

- Route: `/admin`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: A-02 관리자 로그인 성공 또는 직접 `/admin` 접근.
- 이탈 경로: 문제 관리는 H-01, 기관 관리는 X-08, 사용자 관리는 X-10, 일반 학습자 대시보드는 B-01로 이동한다.
- 화면 내부 동작: 역할 기반 관리자 카드 노출과 관리자 섹션 선택을 처리한다.

## 주요 기능

- 관리자 섹션 제목 + 현재 역할 태그
- 관리자 role guard (layout + 페이지 이중 적용)
- 역할별 필터링된 하위 관리 화면 카드(문제/기관/사용자)
- 비관리자 fail-closed redirect

## 상태/오류

- `ADMIN_ROLES`(`content_admin`, `org_admin`, `platform_admin`)에 포함된 역할만 접근할 수 있다.
- 비관리자 또는 프로필 없음은 `/dashboard`로 redirect한다.
- 카드 노출은 하위 페이지 guard와 동일한 매핑으로 필터된다:
  - 문제 관리 → `content_admin`, `platform_admin`
  - 기관 관리 → `org_admin`, `platform_admin`
  - 사용자 관리 → `platform_admin`
- 카드 필터는 UX 정렬일 뿐 보안 경계가 아니다. 실제 차단은 각 하위 페이지의 `requireXAdmin()` 서버 guard가 담당한다.
- 현재 페이지는 직접 데이터 변경 action이 없으므로 `admin_audit_logs` 기록 대상이 아니다.

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `id`, `app_role`, `status` | read | 관리자 접근 권한 확인 + 카드 필터용 role | admin role allowlist + server guard | `src/app/(workspace)/admin/layout.tsx`, `src/app/(workspace)/admin/page.tsx`, `src/lib/auth/profile.ts` | 없음 — `app_role`로 카드 필터링 |
| `private.is_content_admin`/`private.is_org_admin`/`private.is_platform_admin` | - | RLS helper | 하위 admin 데이터 접근 경계 | RLS helper | `docs/development/backend-auth.md`, `supabase/migrations/*.sql` | `/admin` root는 직접 helper를 호출하지 않는다(데이터 fetch 없음) |

## 현재 구현 상태

- `src/app/(workspace)/admin/layout.tsx`가 `getCurrentProfile()`과 `ADMIN_ROLES`로 layout guard를 적용한다.
- `src/app/(workspace)/admin/page.tsx`가 `requireRole(ADMIN_ROLES)`를 호출하고, 반환된 profile의 `app_role`을 `AdminHub`에 넘긴다.
- `src/components/admin/AdminHub.tsx`(client)가 제목/안내/역할 필터 카드를 렌더링한다. 카드 role 매핑은 `src/lib/auth/admin-guard.ts`(CONTENT_ROLES / ORG_ROLES / PLATFORM_ROLES)와 동일하게 복제되어 있다.
- `src/lib/routes.ts`의 `/admin` protected route IA code는 X-15로 정렬되어 있다.

## 코드 구현 근거

- 관리자 화면은 `docs/admin-scope-boundary.md` 기준으로 현재 신규 구현, 확장, 관리자 스키마/마이그레이션 추가 대상이 아니다. 아래 항목은 현행 frozen 관리자 코드 확인용이다.
- `AdminIndexPage` - `src/app/(workspace)/admin/page.tsx`
- `AdminHub` - `src/components/admin/AdminHub.tsx`
- `requireRole`, `ADMIN_ROLES` - `src/lib/auth/profile.ts`

## 미구현/불일치

- `/admin` 자체에는 문제/기관/사용자 관리 데이터(KPI/표)가 표시되지 않는다. 카드는 navigation 전용이다.
- 하위 관리 action의 audit logging은 H-01, X-08, X-10에서 검증한다.
- 카드 role 매핑은 `admin-guard.ts`에서 수동 복제된 상수다(런타임 공유 import 아님). 한쪽만 바꾸면 "보이지만 막히는" 카드가 생긴다 → 두 곳을 함께 수정해야 한다.

## 추가 발견 후보

- 관리자 root에 요약 KPI를 넣으려면 X-08과 중복되지 않도록 별도 제품 결정이 필요하다.
- 사이드바에 `/admin` root 자체로 가는 링크를 추가할지는 navigation 정책 결정이 필요하다(현재 사이드바 admin 그룹은 하위 3개 leaf만 노출).

## 수용 기준

- 기존 34개 Wireframe 이후 추가된 코드 기준 화면임을 명시한다.
- `/admin`은 관리자에게 제목/안내와 역할별 카드를 보여주고 비관리자는 차단한다.
- 카드 노출 role 매핑이 `admin-guard.ts`의 하위 페이지 guard 매핑과 일치한다.
- `/admin` protected route case의 IA code가 X-15로 정렬된다.
- 직접 변경 action이 없다는 이유로 audit log 미기록이 문서화된다.
