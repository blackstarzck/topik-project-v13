# X-15 관리자 인덱스 기능명세

> 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.

## 화면 목적

`/admin` 직접 진입 시 관리자 전용 섹션의 상위 허브를 제공하고, 하위 관리 화면으로 이동할 수 있는 맥락을 만든다.

## 진입/이탈 흐름

- Route: `/admin`
- Route type: page
- Audience: admin
- 진입: 직접 URL, 관리자 사이드바 root.
- 이탈: `/admin/problems`, `/admin/org`, `/admin/users`, `/dashboard`.

## 주요 기능

- 관리자 섹션 placeholder 안내
- 관리자 role guard
- 하위 관리 화면으로 이어지는 navigation context
- 비관리자 fail-closed redirect

## 상태/오류/권한

- `ADMIN_ROLES`에 포함된 역할만 접근할 수 있다.
- 비관리자 또는 프로필 없음은 `/dashboard`로 redirect한다.
- 현재 페이지는 직접 데이터 변경 action이 없으므로 `admin_audit_logs` 기록 대상이 아니다.

## 현재 구현 상태

- `src/app/(workspace)/admin/layout.tsx`가 `getCurrentProfile()`과 `ADMIN_ROLES`로 layout guard를 적용한다.
- `src/app/(workspace)/admin/page.tsx`가 `requireRole(ADMIN_ROLES)`를 호출하고 `PlaceholderPage`를 렌더링한다.
- `src/lib/routes.ts`의 `/admin` protected route IA code는 X-15로 맞춰야 한다.

## 미구현/불일치

- `/admin` 자체에는 문제/기관/사용자 관리 데이터가 표시되지 않는다.
- 하위 관리 action의 audit logging은 H-01, X-08, X-10에서 검증한다.

## 추가 발견 후보

- 관리자 root에 요약 KPI를 넣으려면 X-08과 중복되지 않도록 별도 제품 결정이 필요하다.
- 사이드바에 `/admin` root 링크를 추가할지는 navigation 정책 결정이 필요하다.

## DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `id`, `app_role`, `status` | read | 관리자 접근 권한 확인 | admin role allowlist + server guard | `src/app/(workspace)/admin/layout.tsx`, `src/lib/auth/profile.ts` | 권한별 root landing 차이는 미정 |
| `private.is_content_admin`/`private.is_org_admin`/`private.is_platform_admin` | - | RLS helper | 하위 admin 데이터 접근 경계 | RLS helper | `docs/development/backend-auth.md`, `supabase/migrations/*.sql` | `/admin` root는 직접 helper를 호출하지 않을 수 있음 |

## 수용 기준

- 기존 34개 Wireframe 이후 추가된 코드 기준 화면임을 명시한다.
- `/admin`은 관리자에게 placeholder 안내를 보여주고 비관리자는 차단한다.
- `/admin` protected route case의 IA code가 X-15로 정렬된다.
- 직접 변경 action이 없다는 이유로 audit log 미기록이 문서화된다.

## 검증 근거

- Description: `docs/Wireframe/37-X-15-admin-index/description.md`
- Route map: `docs/sitemap.md`
- Source: `src/app/(workspace)/admin/page.tsx`
- Layout guard: `src/app/(workspace)/admin/layout.tsx`
- Route registry: `src/lib/routes.ts`
