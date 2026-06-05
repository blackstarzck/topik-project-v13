# A-03 학습 목표 설정 화면 데이터 계약

## 화면 요약
사용자가 TOPIK 급수, 시험일, 주간 목표, 약점 영역을 처음 설정하는 화면이다.

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
- TOPIK I/II 선택지
- 목표 급수 선택지
- 시험일 입력 안내
- 주간 학습 시간 안내
- 약점 영역 체크 목록

## 사용자 입력/상태 데이터
- topik_level
- target_grade
- exam_date
- weekly_goal_minutes
- weak_areas

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 학습 목표 | 현재 스키마로 충족 | learning_goals가 사용자별 단일 활성 목표를 저장한다. | topik_level, target_grade, exam_date, weekly_goal_minutes, weak_areas를 사용한다. |
| 초기 추천 seed | 스키마 보강 필요 | 목표 설정 직후 추천 묶음을 자동 생성하는 규칙과 운영 설정 구조는 현재 migration에 없다. | recommendation_runs는 결과 저장은 가능하지만 추천 규칙 catalog는 없다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| learning_goals | 목표 저장/조회 | 20260520120100_profiles_goals.sql: user_id, topik_level, target_grade, exam_date, weekly_goal_minutes, weak_areas, is_active, updated_at. |
| profiles | 사용자 locale과 기본 상태 | 20260520120100_profiles_goals.sql, 20260521141000_phase_6_notification_prefs.sql, 20260526170000_phase_7_profile_bio.sql, 20260602120200_notifications_and_settings.sql: id, display_name, nickname, avatar_path, ui_locale, app_role, plan_label, status, notification_prefs, bio, learning_locale, content_prefs. |

## 저장/조회/이벤트 흐름
화면 진입 시 기존 learning_goals를 조회한다. 저장 시 같은 user_id row를 upsert하고 홈 대시보드 또는 문제 추천으로 이동한다.

## RLS/권한 기준
- learning_goals는 본인 row만 읽고 쓸 수 있다.
- profiles는 본인 row만 읽는다.
- learning_goals는 user_id = auth.uid() 기준으로 본인 row만 전체 작업이 가능하다.
- profiles는 본인 select/update가 가능하지만 app_role, plan_label, status는 보호 컬럼이다.

## 스키마 정합성 메모
목표 값 자체는 현재 스키마로 충족된다. 추천 규칙과 onboarding 문구를 운영 데이터로 관리하려면 별도 구조가 필요하다.

## 검수 필요 항목
- 약점 영역 값 목록을 code enum으로 둘지 운영 데이터로 둘지 정한다.
- 목표 변경 이력을 study_events에 남길 event_type을 정한다.
