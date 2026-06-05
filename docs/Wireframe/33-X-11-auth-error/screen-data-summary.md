# X-11 인증 에러 화면 데이터 계약

## 화면 요약
로그인, 회원가입, 인증 콜백 중 발생한 오류 reason을 사용자에게 설명하고 다음 행동을 안내하는 화면이다.

이 문서는 사용자 화면이 소비하는 운영/관리 대상 데이터만 정리한다. 관리자 전용 화면 구현이나 관리자 스키마 확장은 이번 범위에 포함하지 않는다.

## 기준 소스
| 우선순위 | 소스 | 적용 |
| --- | --- | --- |
| 1 | description.md | 사용 |
| 2 | functional-spec.md | 보조 |

소스 우선순위는 description.md, functional-spec.md, hifi.png, wireframe.png 순서다. 문서와 이미지가 다르면 description.md 기준으로 확정한다.

## 사용자 화면 표시 데이터
- 오류 제목
- 오류 설명
- 다시 시도 CTA
- 로그인/회원가입 이동
- 고객지원 링크

## 사용자 입력/상태 데이터
- reason query
- next redirect
- 다시 시도 선택

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| Auth 오류 reason mapping | DB 계약 없음 | 이 화면의 오류 reason은 Auth callback 또는 query 상태로 전달되며 public schema에 저장하지 않는다. | 계정 상태 보조 조회가 필요한 경우 profiles를 읽을 수 있다. |
| 계정 상태 보조 | 현재 스키마로 충족 | profiles.status가 active, blocked, deleted 상태를 제공한다. | 로그인 세션이 있는 경우에만 본인 row를 조회한다. |
| 오류 문구 catalog | 스키마 보강 필요 | reason별 사용자 안내 문구를 운영 데이터로 관리하는 구조는 없다. | 현재는 앱 문구 중심이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| profiles | 계정 상태 보조 | 20260520120100_profiles_goals.sql, 20260521141000_phase_6_notification_prefs.sql, 20260526170000_phase_7_profile_bio.sql, 20260602120200_notifications_and_settings.sql: id, display_name, nickname, avatar_path, ui_locale, app_role, plan_label, status, notification_prefs, bio, learning_locale, content_prefs. |

## 저장/조회/이벤트 흐름
화면은 URL reason 또는 Auth 오류 상태를 받아 사용자 문구로 매핑한다. 세션이 있으면 profiles.status를 보조로 조회할 수 있다.

## RLS/권한 기준
- profiles는 본인 row만 읽는다.
- Auth 오류 토큰은 public schema에 저장하지 않는다.
- profiles는 본인 select/update가 가능하지만 app_role, plan_label, status는 보호 컬럼이다.

## 스키마 정합성 메모
오류 화면 자체는 DB 계약 없음에 가깝다. 계정 상태 보조만 profiles로 충족된다.

## 검수 필요 항목
- reason 값 목록과 사용자 문구를 표준화한다.
- 지원 문의 링크의 추적 이벤트 저장 여부를 정한다.
