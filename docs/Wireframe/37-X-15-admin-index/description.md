# 관리자 인덱스

- Source: 37 X-15 관리자 인덱스
- Code: X-15
- Added-screen note: 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.
- Wireframe: (해당 없음 - 기존 34개 이후 추가된 코드 기준 화면, wireframe.png 추후 추가)

## Wireframe Number Map

| No. | Area | Description |
| --- | --- | --- |
| 1 | Admin shell title | "관리" 제목과 관리자 영역 진입 상태를 표시한다. |
| 2 | Placeholder guidance | 좌측 사이드바에서 문제/기관/사용자 관리 영역을 선택하라는 안내를 제공한다. |
| 3 | Admin guard | 관리자 권한이 없으면 `/dashboard`로 redirect한다. |
| 4 | Admin navigation context | `/admin/problems`, `/admin/org`, `/admin/users`로 이어지는 상위 허브 역할을 한다. |

## Detailed Description

### 37 X-15 관리자 인덱스

1
■ 관리자 허브 placeholder

▣ 설명
• `/admin` 직접 진입 시 빈 화면이 아니라 관리 영역 선택 안내를 보여준다.
• 본격 관리 UI는 하위 IA인 H-01, X-08, X-10이 담당한다.
• 관리자 전용 layout 안에서 렌더링되며 비관리자는 접근할 수 없다.

2
■ 권한 분기

▣ 설명
• `ADMIN_ROLES`에 포함된 역할만 접근 가능하다.
• 권한이 없거나 프로필을 읽지 못하면 `/dashboard`로 보낸다.
• 페이지 자체도 `requireRole(ADMIN_ROLES)`를 호출해 layout guard와 같은 기준을 다시 적용한다.

3
■ 하위 관리 화면 연결

▣ 설명
• 현재 페이지에는 대량 변경/삭제/역할 변경 같은 직접 action이 없다.
• 사이드바에서 문제 관리(H-01), 기관 관리(X-08), 사용자 관리(X-10)로 이동하는 상위 entry다.

## 화면 목적

관리자가 `/admin`으로 직접 진입했을 때 관리 섹션의 안전한 진입 허브와 안내 상태를 제공한다.

## 분기

- 진입: 직접 URL `/admin`, 관리자 사이드바 root.
- 이탈: `/admin/problems`, `/admin/org`, `/admin/users`, `/dashboard`.
- 비관리자: `/dashboard` redirect.
- 세션 없음: 로그인/보호 route 정책에 따라 차단된다.

## 피드백

- 본격 UI가 아직 하위 화면에 있다는 phase 안내를 표시한다.
- 직접 변경 action이 없으므로 성공/실패 toast는 필요하지 않다.

## 예외 상황

- 프로필 읽기 실패 또는 권한 없음은 fail-closed로 처리한다.
- 관리자 권한 확장은 `ADMIN_ROLES`에 명시적으로 추가되어야 한다.
