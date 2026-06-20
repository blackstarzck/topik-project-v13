# /profile 분리 구현 브리프

작성일: 2026-06-20

## 배경

`/profile` 화면은 현재 이름, 닉네임, 자기소개, 프로필 이미지뿐 아니라 로그인 방법, 목표 시험, 계정 상태, 로그아웃까지 함께 보여준다. UX 검토 결과, 목표 시험은 학습 프로필로 볼 수 있지만 로그인 방법과 계정 상태는 계정 설정에 더 가깝다.

## 변경 방향

기존 기능을 제거하지 않고 위치를 분리한다.

| 현재 위치 | 변경 위치 | 보존할 기능 |
| --- | --- | --- |
| `/profile` 이름, 닉네임, 자기소개, 프로필 이미지 | `/profile` 유지 | 프로필 저장, 닉네임 중복 확인, 아바타 변경/삭제, 미저장 이탈 경고 |
| `/profile` 목표 시험 | `/settings/learning` | 목표 등급, TOPIK 단계, 시험일 인라인 편집, 기존 학습 목표 설정 링크 |
| `/profile` 로그인 방법 | `/settings/account` | 이메일 로그인 상태, Google 로그인 연결 시작 |
| `/profile` 계정 상태 | `/settings/account` | 공개 범위, 역할, 플랜, 가입일, 알림/언어 설정 링크 |
| `/profile` 로그아웃 | `/settings/account` | `POST /auth/sign-out` 로그아웃 |

## 수용 기준

- `/profile`은 공개 프로필 정보만 중심으로 보여준다.
- `/settings/account`에서 로그인 방법, 계정 상태, 로그아웃이 작동한다.
- `/settings/learning`에서 목표 시험 카드의 기존 보기/편집 기능이 작동한다.
- 사이드바의 상위 메뉴 6개 구조는 유지하고, 새 화면은 `설정` 하위에 둔다.
- 기존 저장, 업로드, Google 연결, 로그아웃, 목표 저장 기능의 컴포넌트와 데이터 경로를 재사용한다.
- 모바일과 데스크톱에서 세 화면 모두 실제 렌더링을 확인한다.

## 문서 갱신 제안

이 변경이 확정되면 다음 active SOT 갱신이 필요하다.

- `docs/flow/user-flow.md`: `X05`에서 계정/학습 설정 분리 흐름 반영
- `docs/ia.md`: 새 설정 하위 화면 또는 X-05 분리 설명 반영
- `docs/Wireframe/README.md`: 새 화면 문서 추가 또는 X-05 기능 범위 축소
- `docs/Wireframe/27-X-05-profile-editing/description.md`: 목표 시험, 계정 상태 영역 제거 또는 링크 처리로 변경
- `docs/Wireframe/27-X-05-profile-editing/functional-spec.md`: 데이터 사용 명세 재분류
- `src/lib/routes.ts`: 구현 route registry와 sidebar 항목 반영
