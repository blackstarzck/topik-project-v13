# X-05 프로필 편집 화면 데이터 계약

## 화면 요약
사용자가 표시 이름, 닉네임, 자기소개, 아바타, 학습 목표 일부를 수정하는 화면이다.

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
- 아바타
- 표시 이름
- 닉네임
- 자기소개
- 언어/목표 요약
- 저장 상태

## 사용자 입력/상태 데이터
- display_name
- nickname
- bio
- avatar file
- learning goal fields
- 저장 액션

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 프로필 정보 | 현재 스키마로 충족 | profiles가 display_name, nickname, avatar_path, bio, ui_locale 등을 제공한다. | bio는 160자 제한 constraint가 있다. |
| 아바타 파일 | 현재 스키마로 충족 | avatars bucket이 본인 경로 파일 업로드/수정/삭제를 지원한다. | avatar_path는 profiles에 저장한다. |
| 시험 목표 | 현재 스키마로 충족 | learning_goals가 목표 급수, 시험일, 약점 영역을 저장한다. | 프로필 화면에서 요약 편집할 수 있다. |
| 공개 프로필 확장 | 스키마 보강 필요 | 팔로우, 공개 범위, 외부 링크 같은 공개 프로필 구조는 없다. | 현재는 개인 설정 중심이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| profiles | 프로필 정보 | 20260520120100_profiles_goals.sql, 20260521141000_phase_6_notification_prefs.sql, 20260526170000_phase_7_profile_bio.sql, 20260602120200_notifications_and_settings.sql: id, display_name, nickname, avatar_path, ui_locale, app_role, plan_label, status, notification_prefs, bio, learning_locale, content_prefs. |
| learning_goals | 시험 목표 | 20260520120100_profiles_goals.sql: user_id, topik_level, target_grade, exam_date, weekly_goal_minutes, weak_areas, is_active, updated_at. |
| storage:avatars | 아바타 파일 | 20260520121200_storage_buckets.sql, 20260520121300_storage_policies.sql, 20260527113000_storage_email_confirmed_hardening.sql: public-read bucket, 경로는 {user_id}/{file}, 소유자 생성/수정/삭제. |

## 저장/조회/이벤트 흐름
화면은 profiles와 learning_goals를 조회한다. 텍스트 저장은 profiles/learning_goals update로, 아바타는 avatars bucket 업로드 뒤 avatar_path update로 처리한다.

## RLS/권한 기준
- profiles는 본인 row만 update 가능하며 보호 컬럼은 바꿀 수 없다.
- avatars는 본인 경로만 쓸 수 있다.
- learning_goals는 본인 row만 작업 가능하다.
- profiles는 본인 select/update가 가능하지만 app_role, plan_label, status는 보호 컬럼이다.
- learning_goals는 user_id = auth.uid() 기준으로 본인 row만 전체 작업이 가능하다.
- avatars 파일은 본인 경로만 생성/수정/삭제 가능하며 읽기는 public-read다.

## 스키마 정합성 메모
프로필 편집 기본 데이터는 현재 스키마로 충족된다. 공개 프로필 네트워크 기능은 현재 범위 밖이다.

## 검수 필요 항목
- 닉네임 중복 오류 문구를 고정한다.
- 아바타 삭제 시 avatar_path를 null로 둘지 기본 이미지로 둘지 정한다.
