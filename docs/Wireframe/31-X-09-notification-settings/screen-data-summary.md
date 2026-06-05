# X-09 알림 설정 화면 데이터 계약

## 화면 요약
사용자가 학습 알림 시간, 요일, 채널, 간단한 알림 선호를 설정하는 화면이다.

이 문서는 사용자 화면이 소비하는 운영/관리 대상 데이터만 정리한다. 관리자 전용 화면 구현이나 관리자 스키마 확장은 이번 범위에 포함하지 않는다.

## 기준 소스
| 우선순위 | 소스 | 적용 |
| --- | --- | --- |
| 1 | description.md | 사용 |
| 2 | functional-spec.md | 보조 |
| 3 | hifi.png | 보조 |
| 4 | wireframe.png | 보조 |

소스 우선순위는 description.md, functional-spec.md, hifi.png, wireframe.png 순서다. 문서와 이미지가 다르면 description.md 기준으로 확정한다.

## 사용자 화면 표시 데이터
- 알림 토글
- 시간 선택
- 요일 선택
- 채널 선택
- 최근 발송 상태
- 저장 상태

## 사용자 입력/상태 데이터
- notification_prefs
- reminder_time
- reminder_days
- channels
- timezone
- 저장 액션

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 간단 알림 플래그 | 현재 스키마로 충족 | profiles.notification_prefs가 클라이언트 알림 선호 JSON object를 저장한다. | missing key는 false로 해석하는 코드 계약이다. |
| 알림 시간/요일/채널 | 현재 스키마로 충족 | notification_settings가 reminder_time, reminder_days, channels, timezone을 저장한다. | user_id 1:1 구조다. |
| 발송 이력 | 현재 스키마로 충족 | notification_log가 channel, template_key, status, payload, sent_at을 저장한다. | 사용자는 본인 이력만 읽는다. |
| 알림 템플릿 catalog | 스키마 보강 필요 | 알림 문구와 template_key별 본문을 운영 데이터로 관리하는 구조는 없다. | 현재는 발송 이력 ledger 중심이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| profiles | 알림 조건 플래그 | 20260520120100_profiles_goals.sql, 20260521141000_phase_6_notification_prefs.sql, 20260526170000_phase_7_profile_bio.sql, 20260602120200_notifications_and_settings.sql: id, display_name, nickname, avatar_path, ui_locale, app_role, plan_label, status, notification_prefs, bio, learning_locale, content_prefs. |
| notification_settings | 알림 시간/요일/채널 | 20260602120200_notifications_and_settings.sql: user_id, reminder_time, reminder_days, channels, timezone, updated_at. |
| notification_log | 발송 이력 | 20260602120200_notifications_and_settings.sql: id, user_id, channel, template_key, status, payload, sent_at, created_at. |

## 저장/조회/이벤트 흐름
화면은 profiles.notification_prefs와 notification_settings를 조회한다. 저장 시 본인 settings를 upsert/update하고 발송 결과는 notification_log에서 읽는다.

## RLS/권한 기준
- notification_settings는 본인 row만 전체 작업 가능하다.
- notification_log는 본인 select만 가능하며 쓰기는 알림 서비스 권한 흐름이다.
- profiles 보호 컬럼은 변경하지 않는다.
- profiles는 본인 select/update가 가능하지만 app_role, plan_label, status는 보호 컬럼이다.
- notification_settings는 user_id = auth.uid() 기준 본인 설정만 전체 작업이 가능하다.
- notification_log는 본인 select만 가능하고 쓰기는 알림 서비스 권한 흐름이다.

## 스키마 정합성 메모
사용자 알림 설정과 발송 이력은 현재 스키마로 충족된다. 템플릿 본문 관리 구조는 없다.

## 검수 필요 항목
- channels JSON의 허용 key를 고정한다.
- timezone 기본값과 daylight saving 처리를 정한다.
