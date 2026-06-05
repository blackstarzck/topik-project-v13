# G-01 설정 언어 화면 데이터 계약

## 화면 요약
사용자가 앱 UI 언어와 학습 콘텐츠 언어, 피드백 표시 선호를 바꾸는 화면이다.

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
- UI 언어 선택
- 학습 콘텐츠 언어 선택
- 피드백 표시 옵션
- 예시 난이도/설명 길이 옵션
- 저장 상태

## 사용자 입력/상태 데이터
- ui_locale
- learning_locale
- content_prefs
- 저장 액션

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| UI 언어와 학습 언어 | 현재 스키마로 충족 | profiles.ui_locale와 profiles.learning_locale이 언어 설정을 저장한다. | learning_locale은 null이면 ui_locale을 따른다. |
| 학습 콘텐츠 선호 | 현재 스키마로 충족 | profiles.content_prefs jsonb가 피드백 표시, 예시 난이도, 설명 길이 같은 설정을 담는다. | JSON object 제약이 있다. |
| 번역 문구 catalog | 스키마 보강 필요 | 화면 문구와 콘텐츠 번역본을 운영 데이터로 관리하는 테이블은 없다. | 현재는 사용자 선호 저장 계약이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| profiles | UI 언어와 학습 콘텐츠 설정 | 20260520120100_profiles_goals.sql, 20260521141000_phase_6_notification_prefs.sql, 20260526170000_phase_7_profile_bio.sql, 20260602120200_notifications_and_settings.sql: id, display_name, nickname, avatar_path, ui_locale, app_role, plan_label, status, notification_prefs, bio, learning_locale, content_prefs. |

## 저장/조회/이벤트 흐름
화면은 profiles의 locale과 content_prefs를 읽는다. 저장 시 profiles_self_update 정책으로 본인 row를 update한다.

## RLS/권한 기준
- profiles는 본인 row만 update할 수 있다.
- app_role, plan_label, status는 보호 컬럼이라 사용자가 바꿀 수 없다.
- profiles는 본인 select/update가 가능하지만 app_role, plan_label, status는 보호 컬럼이다.

## 스키마 정합성 메모
사용자 설정 저장은 현재 스키마로 충족된다. 번역 콘텐츠 관리 구조는 현재 migration에 없다.

## 검수 필요 항목
- content_prefs JSON의 key와 기본값을 문서화한다.
- 언어 변경 직후 캐시/세션 반영 방식을 정한다.
