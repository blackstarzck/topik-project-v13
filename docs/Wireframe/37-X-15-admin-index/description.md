# 관리자 인덱스

- Source: 37 X-15 관리자 인덱스
- Code: X-15
- Added-screen note: 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.
- Wireframe: (해당 없음 - 기존 34개 이후 추가된 코드 기준 화면, wireframe.png 추후 추가)

## Wireframe Number Map

| No. | Area | Description |
| --- | --- | --- |
| 1 | Admin shell title | "관리" 제목과 현재 관리자 역할 태그를 표시한다. |
| 2 | Placeholder guidance | 접근 가능한 관리 영역을 선택하라는 안내를 제공한다. |
| 3 | Role-gated 영역 카드 | 현재 역할이 들어갈 수 있는 하위 관리 화면 카드만 노출한다(문제/기관/사용자). |
| 4 | Admin guard | 비관리자는 layout과 페이지 양쪽에서 `/dashboard`로 redirect한다. |

## Detailed Description

### 37 X-15 관리자 인덱스

1
■ 관리자 허브 제목

▣ 설명
• `/admin` 직접 진입 시 빈 화면이 아니라 "관리" 제목과 현재 역할 태그(콘텐츠/기관/플랫폼 관리자)를 보여준다.
• 관리자 전용 layout 안에서 렌더링되며 비관리자는 접근할 수 없다.

▣ 제약 조건: 별도 KPI/요약 데이터는 두지 않는다(요약 지표는 X-08이 담당, 중복 방지).

▣ 예외: 역할 라벨이 매핑에 없으면 그대로 비노출(현재 4개 role 모두 매핑됨).

2
■ 영역 선택 안내

▣ 설명
• 접근 권한이 있는 관리 영역을 선택하라는 안내 문구를 보여준다.
• 좌측 사이드바(`SIDEBAR_ADMIN_SECTION`)에서도 동일 영역으로 이동할 수 있음을 안내한다.

3
■ Role-gated 영역 카드

▣ 설명
• 하위 관리 화면 카드(문제 관리 → `/admin/problems`, 기관 관리 → `/admin/org`, 사용자 관리 → `/admin/users`)를 보여준다.
• 각 카드는 하위 페이지 server guard(`src/lib/auth/admin-guard.ts`)와 동일한 role 매핑으로 필터된다. 즉 클릭 후 `forbidden` redirect 될 카드는 처음부터 렌더링하지 않는다.
  - 문제 관리: `content_admin`, `platform_admin`
  - 기관 관리: `org_admin`, `platform_admin`
  - 사용자 관리: `platform_admin`
• 카드 노출은 UX 정렬일 뿐 보안 경계가 아니다. 실제 권한 차단은 각 하위 페이지의 서버 guard가 담당한다(defense-in-depth).

▣ 제약 조건: 카드 CTA는 카드당 1개("이동"). 카드는 단순 navigation일 뿐 직접 변경 action이 없다.

▣ 예외: 접근 가능한 카드가 하나도 없으면 안내 Empty 상태를 보여준다(현행 ADMIN_ROLES는 모두 최소 1개 카드를 가짐 → 정상 흐름에서는 발생하지 않는 fail-safe).

## 화면 목적

관리자가 `/admin`으로 직접 진입했을 때, 자신의 역할이 접근할 수 있는 관리 섹션만 노출하는 안전한 진입 허브를 제공한다.

## 분기

- 진입: 직접 URL `/admin`, 관리자 사이드바 root.
- 이탈: `/admin/problems`, `/admin/org`, `/admin/users`, `/dashboard`.
- 비관리자: `/dashboard` redirect (layout guard + 페이지 `requireRole(ADMIN_ROLES)` 이중 적용).
- 세션 없음: workspace layout이 `/login`으로 보낸다.

## 피드백

- 현재 역할 태그로 진입 상태를 표시한다.
- 직접 변경 action이 없으므로 성공/실패 toast는 필요하지 않다.

## 예외 상황

- 프로필 읽기 실패 또는 권한 없음은 fail-closed로 처리한다(`/dashboard` redirect).
- 관리자 권한 확장은 `ADMIN_ROLES`에 명시적으로 추가되어야 한다.
- 카드 role 매핑은 `admin-guard.ts`의 매핑과 항상 일치해야 한다(한쪽만 바뀌면 "보이지만 막히는" 카드가 생긴다).
