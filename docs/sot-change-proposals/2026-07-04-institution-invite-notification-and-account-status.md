# 기관 초대 알림 및 계정 설정 소속 표시 구현 브리프

작성일: 2026-07-04

상태: implementation brief

## 제안 요약

관리자 앱이 기존 사용자에게 기관 초대를 보낼 수 있다는 전제를 사용자 앱 UX에 반영한다.
v13 사용자 앱은 새 관리자 화면이나 새 기관 카탈로그를 만들지 않고, 기존 인앱 알림함과
`/auth/institution-invite` 확인 화면을 사용해 사용자가 초대를 확인하고 직접 연결하도록 한다.

## 사용자 동작

- 사용자는 알림함에서 "기관 초대가 도착했어요" 알림을 본다.
- 알림을 누르면 `/auth/institution-invite?aff=CODE&next=/settings/account`로 이동한다.
- 초대 확인 화면은 현재 계정, 기관 코드, 연결 후 달라지는 점, 동의 체크박스,
  "기관에 연결" 버튼을 보여준다.
- 연결이 완료되면 `/settings/account`에서 "기관 소속 / 기관 코드 CODE"를 확인할 수 있다.

## 데이터 계약

관리자 앱은 기존 `user_notifications`에 아래 형태의 row를 만든다.

| 필드 | 값 |
| --- | --- |
| `template_key` | `institution_invite` |
| `category` | `notice` |
| `title` | `기관 초대가 도착했어요` |
| `body` | `초대를 확인하고 이 계정을 기관에 연결할지 선택하세요.` |
| `link_url` | `/auth/institution-invite?aff={CODE}&next=/settings/account` |
| `payload` | `{ "affiliation_code": "{CODE}", "kind": "institution_invite" }` |

사용자 앱의 기관 소속 기준은 기존과 동일하게 `profiles.affiliation_code`다.
기관 코드의 의미, 기관명, 만료, 승인 여부는 v13 사용자 앱에서 조회하지 않는다.

## 범위

- 기존 알림함의 내부 경로 이동 규칙을 사용한다.
- 기존 `/auth/institution-invite` 명시 확인 흐름을 사용한다.
- `/settings/account` 계정 상태에 기관 코드가 있을 때만 읽기 전용 소속 정보를 표시한다.
- 새 DB 테이블, 새 알림 카테고리, 기관명 조회, 기관 전환 self-service는 추가하지 않는다.

## 검증 기준

- `/auth/institution-invite?aff=CODE&next=/settings/account` 알림 링크는 내부 경로로 처리된다.
- 인증 사용자가 초대 화면에서 동의 전에는 기관 연결 CTA를 누를 수 없다.
- 동의 후 연결하면 `accept_affiliation_invite`가 호출되고, 완료 후 계정 설정으로 돌아간다.
- 기관 코드가 있는 사용자는 `/settings/account`에서 기관 소속 행을 본다.
- 기관 코드가 없는 사용자는 `/settings/account`에서 기관 소속 행을 보지 않는다.
- desktop/mobile 브라우저 e2e에서 알림 클릭부터 계정 설정 표시까지 확인한다.

## 제외 범위

- 관리자 앱의 초대 대상자 선택 UI
- `institution_codes` 카탈로그 또는 기관명 표시
- 코드 만료/유효성 서버 검증
- 다른 기관으로의 자동 전환 또는 self-service 전환
- 원격 Supabase schema/data 적용
