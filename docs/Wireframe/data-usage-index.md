# Wireframe Data Usage Index

이 문서는 DB 객체 기준으로 어떤 Wireframe 페이지가 어떤 데이터를 쓰는지 역색인합니다. 관리자 화면은 별도 관리자 앱(topik-ai) 소관이라 이 색인에 없습니다.

## Summary

- Pages: 35
- Tables: 20
- RPC/functions: 16
- Storage buckets: 3
- Page data links: 110
- Unclassified DB objects: 0

## avatars

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| X-05 | Profile editing | storage | - | read/write | 프로필 이미지 업로드와 공개 읽기에 사용한다. |

## comparison_reports

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| R-01 | Comparison report | table | `current_submission_id`, `previous_submission_id`, `metrics`, `narrative`, `generated_at` | read/write | 비교 리포트 본문과 지표에 사용한다. |
| F-01 | My library | table | `id`, `metrics`, `narrative`, `generated_at` | read | 리포트 탭에 사용한다. |

## export_files

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| E-01 | Short-answer feedback | table | `source_type`, `source_id`, `status`, `storage_path` | read/write | 피드백 PDF 내보내기와 연결된다. |
| E-02 | Long-form feedback | table | `source_type`, `source_id`, `status`, `storage_path` | read/write | 피드백 PDF 내보내기와 연결된다. |
| F-01 | My library | table | `source_type`, `source_id`, `storage_path`, `status`, `created_at` | read | 내보내기 파일 목록에 사용한다. |
| F-M1 | PDF export modal | table | `source_type`, `source_id`, `storage_path`, `options`, `status` | read/write | PDF 생성 요청과 결과 파일 상태를 저장한다. |

## feedback_dimension_scores

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| C-01 | Problem type recommendations | table | `dimension`, `score`, `weakness_level` | derived-read | 취약 영역 기반 추천 근거가 된다. |
| E-01 | Short-answer feedback | table | `dimension`, `score`, `score_max`, `summary`, `weakness_level` | read | 영역별 점수와 약점 수준을 표시한다. |
| E-02 | Long-form feedback | table | `dimension`, `score`, `score_max`, `summary`, `weakness_level` | read | 영역별 점수와 약점 수준을 표시한다. |
| R-01 | Comparison report | table | `dimension`, `score`, `summary` | read | 영역별 성장 지표에 사용한다. |
| R-02 | Next problem recommendation | table | `dimension`, `weakness_level` | derived-read | 취약 영역 추천 근거에 사용한다. |
| X-02 | Growth dashboard | table | `dimension`, `score`, `weakness_level` | derived-read | 영역별 성장/취약 분석에 사용한다. |
| X-07 | Weakness-based recommendations | table | `dimension`, `score`, `weakness_level`, `summary` | read | 취약 영역 계산에 사용한다. |

## generated-exports

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| F-M1 | PDF export modal | storage | - | read/write | 생성된 PDF 파일을 저장하고 소유자에게만 노출한다. |

## learning_goals

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| A-03 | Learning goal setup | table | `user_id`, `topik_level`, `target_grade`, `exam_date`, `weekly_goal_minutes`, `weak_areas`, `is_active` | read/write | 온보딩 학습 목표를 저장하고 이후 대시보드 추천에 연결한다. |
| B-01 | Home dashboard | table | `topik_level`, `target_grade`, `exam_date`, `weekly_goal_minutes` | read | 목표 달성률과 다음 행동 안내에 사용한다. |
| X-05 | Profile editing | table | `topik_level`, `target_grade`, `exam_date`, `weekly_goal_minutes`, `weak_areas` | read/write | 프로필의 시험 목표 정보에 사용한다. |

## library_items

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| E-01 | Short-answer feedback | table | `submission_id`, `item_type`, `note`, `tags` | read/write | 피드백 저장/보관함 추가에 사용한다. |
| E-02 | Long-form feedback | table | `submission_id`, `item_type`, `note`, `tags` | read/write | 피드백 저장/보관함 추가에 사용한다. |
| F-01 | My library | table | `item_type`, `attempt_id`, `submission_id`, `report_id`, `export_file_id`, `problem_id`, `note`, `tags`, `saved_at` | read/write | 내 보관함 탭, 저장/해제, 태그에 사용한다. |

## notification_delivery_attempts

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| X-09 | Notification settings | table | `template_key`, `channel`, `status`, `sent_at`, `created_at` | read | 발송 이력 패널 최근 5건(상태 6종 라벨)에 사용한다. topik-ai 소유 공유 객체(owner select)다. |

## notification_log

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| X-09 | Notification settings | table | `channel`, `template_key`, `status`, `sent_at` | deprecated (미사용) | 구 발송 이력 소스. 2026-06-12 `notification_delivery_attempts`로 교체되어 화면 데이터 경로에서 제거됐다(O-9). |

## private.protect_profile_columns

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| X-05 | Profile editing | rpc | - | trigger | 사용자가 app_role, plan_label, status를 직접 바꾸지 못하게 막는다. |

## private.set_submission_feedback_status

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| D-M2 | AI analysis loading | rpc | - | function | service role 전용 상태 전이를 담당한다. |

## problem_assets

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| C-02 | Problem list | table | `problem_id`, `storage_path`, `asset_type`, `sort_order` | read | 문제 자료 이미지/오디오를 연결한다. |
| D-01 | Short-answer writing 51 | table | `problem_id`, `storage_path`, `asset_type` | read | 문제 자료 이미지/오디오를 연결한다. |
| D-02 | Answer writing 52 | table | `problem_id`, `storage_path`, `asset_type` | read | 문제 자료 이미지/오디오를 연결한다. |
| D-03 | Long-form writing 53 | table | `problem_id`, `storage_path`, `asset_type` | read | 문제 자료 이미지/오디오를 연결한다. |
| D-04 | Essay writing 54 | table | `problem_id`, `storage_path`, `asset_type` | read | 문제 자료 이미지/오디오를 연결한다. |

## problem_attempts

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| C-02 | Problem list | table | `problem_id`, `status`, `is_correct`, `bookmarked`, `time_spent_seconds` | read/write | 풀이 이력, 재도전, 북마크 상태에 사용한다. |
| C-03 | Retry modal | table | `problem_id`, `status`, `is_correct`, `submitted_at` | read/write | 재도전 가능 여부와 새 시도 시작에 사용한다. |
| X-02 | Growth dashboard | table | `is_correct`, `submitted_at`, `time_spent_seconds` | derived-read | 풀이 정확도와 학습 시간 지표에 사용한다. |

## problems

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| C-01 | Problem type recommendations | table | `id`, `domain`, `question_no`, `topik_level`, `difficulty`, `tags` | read | 추천 문제 후보를 조회한다. |
| C-02 | Problem list | table | `id`, `domain`, `question_no`, `topik_level`, `difficulty`, `title`, `prompt`, `tags`, `publish_status`, `visibility` | read | 문제 목록, 필터, 정렬, 상세 진입에 사용한다. |
| D-01 | Short-answer writing 51 | table | `id`, `question_no`, `prompt`, `materials`, `rubric`, `answer_key` | read | 51번 작성 문제 본문과 조건을 표시한다. |
| D-02 | Answer writing 52 | table | `id`, `question_no`, `prompt`, `materials`, `rubric`, `answer_key` | read | 52번 작성 문제 본문과 조건을 표시한다. |
| D-03 | Long-form writing 53 | table | `id`, `question_no`, `prompt`, `materials`, `rubric`, `answer_key` | read | 53번 작성 문제 본문과 조건을 표시한다. |
| D-04 | Essay writing 54 | table | `id`, `question_no`, `prompt`, `materials`, `rubric`, `answer_key` | read | 54번 작성 문제 본문과 조건을 표시한다. |
| R-02 | Next problem recommendation | table | `id`, `question_no`, `difficulty`, `title`, `tags` | read | 추천 대상 문제 정보를 표시한다. |
| F-01 | My library | table | `id`, `title`, `question_no`, `difficulty` | read | 저장한 문제 탭에 사용한다. |
| X-07 | Weakness-based recommendations | table | `id`, `domain`, `question_no`, `difficulty`, `tags` | read | 추천 문제 상세 표시와 필터에 사용한다. |

## profiles

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| A-01 | Sign-up | table | `id`, `email`, `display_name`, `app_role`, `plan_label`, `status` | triggered-write | 회원가입 후 auth.users 트리거가 프로필 기본 row를 만든다. |
| A-02 | Login | table | `id`, `status`, `app_role` | read | 로그인 후 세션 사용자의 상태와 권한을 확인한다. |
| A-03 | Learning goal setup | table | `id`, `ui_locale`, `status` | read | 사용자 기본 설정과 onboarding 상태 판단에 사용한다. |
| B-01 | Home dashboard | table | `id`, `display_name`, `plan_label`, `status` | read | 대시보드 사용자 표시와 권한 상태에 사용한다. |
| G-01 | Language settings | table | `ui_locale`, `updated_at` | read/write | 앱 표시 언어를 저장한다. |
| X-01 | Product landing | table | `plan_label` | derived-read | 랜딩의 플랜/권한 CTA 문구와 연결될 수 있으나 현재 직접 DB 의존은 낮다. |
| X-03 | Paywall | table | `plan_label`, `status` | read | 현재 플랜과 접근 제한 안내에 사용한다. |
| X-04 | Subscription management | table | `plan_label`, `status` | read | 구독 상태 셸 화면에 사용한다. 실제 결제 테이블은 아직 없다. |
| X-05 | Profile editing | table | `display_name`, `nickname`, `avatar_path`, `bio`, `ui_locale`, `plan_label`, `status` | read/write | 프로필 편집, 160자 자기소개, 아바타 경로에 사용한다. |
| X-06 | Password reset | table | `id`, `email`, `status` | read | 비밀번호 재설정 성공 후 사용자 상태 확인에 연결될 수 있다. |
| X-09 | Notification settings | table | `notification_prefs` | read/write | 알림 채널과 조건 설정을 JSON object로 저장한다. |
| X-11 | Auth error | table | `id`, `status` | read | 인증 오류 후 계정 상태 안내와 재시도 분기에 연결될 수 있다. |
| X-12 | Auth verify-email | table | `id`, `email`, `status` | read | 가입 직후 이메일 인증 안내와 인증 상태 확인에 연결된다. |

## public.create_comparison_report_with_metrics

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| R-01 | Comparison report | rpc | - | rpc | 현재 제출과 이전 제출 비교 리포트를 생성한다. |

## public.get_dashboard_kpi

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| B-01 | Home dashboard | rpc | - | rpc | 대시보드 KPI 요약을 만든다. |
| X-02 | Growth dashboard | rpc | - | rpc | 성장 지표 일부를 재사용할 수 있다. |

## public.handle_new_user

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| A-01 | Sign-up | rpc | - | trigger | auth.users 생성 후 public.profiles를 보강한다. |
| X-12 | Auth verify-email | rpc | - | trigger | 가입 직후 프로필 row 생성을 보장한다. |

## public.list_user_problems

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| C-02 | Problem list | rpc | `filter` jsonb(domain/topik_level/question_no/difficulty/status/search), `sort`, `page`, `page_size` → rows + `total_count` | rpc | 필터·정렬·페이지에 맞는 문제 목록과 정확한 총 건수를 SQL에서 계산한다. SECURITY INVOKER라 호출자 RLS(auth.uid()) 범위에서 실행된다. |

## public.submit_writing_with_feedback

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| D-M1 | Submission confirmation | rpc | - | rpc | 최종 제출과 초기 feedback row 생성을 원자적으로 처리한다. |

## recommendation_items

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| B-01 | Home dashboard | table | `problem_id`, `rank`, `reason`, `status` | read/update | 추천 카드와 클릭/완료 상태에 사용한다. |
| C-01 | Problem type recommendations | table | `problem_id`, `rank`, `reason`, `weakness_tags` | read/update | 추천 유형과 선택 상태를 제공한다. |
| R-02 | Next problem recommendation | table | `problem_id`, `rank`, `reason`, `weakness_tags`, `status` | read/update | 다음 문제 추천 카드와 클릭 상태에 사용한다. |
| X-07 | Weakness-based recommendations | table | `problem_id`, `rank`, `reason`, `weakness_tags`, `status` | read/update | 취약 기반 추천 목록과 상태에 사용한다. |

## recommendation_runs

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| B-01 | Home dashboard | table | `source_type`, `reason_summary` | read | 추천 묶음의 출처와 설명에 사용한다. |
| C-01 | Problem type recommendations | table | `source_type`, `reason_summary`, `created_at` | read | 추천이 어떤 근거로 만들어졌는지 보여준다. |

## sentence_feedback

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| E-01 | Short-answer feedback | table | `sentence_index`, `original_text`, `corrected_text`, `comment` | read | 문장별 수정 제안을 표시한다. |
| E-02 | Long-form feedback | table | `sentence_index`, `original_text`, `corrected_text`, `comment` | read | 문장별 수정 제안을 표시한다. |

## study_events

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| B-01 | Home dashboard | table | `event_type`, `occurred_at`, `payload` | derived-read | 학습 연속성, 오늘 활동, 이벤트 기반 KPI에 사용한다. |
| D-01 | Short-answer writing 51 | table | `event_type`, `problem_id`, `submission_id`, `payload` | write | 작성 시작과 제출 이벤트를 기록한다. |
| D-02 | Answer writing 52 | table | `event_type`, `problem_id`, `submission_id`, `payload` | write | 작성 시작과 제출 이벤트를 기록한다. |
| D-03 | Long-form writing 53 | table | `event_type`, `problem_id`, `submission_id`, `payload` | write | 작성 시작과 제출 이벤트를 기록한다. |
| D-04 | Essay writing 54 | table | `event_type`, `problem_id`, `submission_id`, `payload` | write | 작성 시작과 제출 이벤트를 기록한다. |
| E-01 | Short-answer feedback | table | `event_type`, `submission_id`, `payload` | write | 피드백 조회 이벤트를 기록한다. |
| E-02 | Long-form feedback | table | `event_type`, `submission_id`, `payload` | write | 피드백 조회 이벤트를 기록한다. |
| R-01 | Comparison report | table | `event_type`, `report_id`, `occurred_at` | write | 리포트 조회 이벤트를 남긴다. |
| F-01 | My library | table | `event_type`, `occurred_at`, `payload` | read | 학습 활동 기록에 사용한다. |
| F-M1 | PDF export modal | table | `event_type`, `export_file_id`, `payload` | write | PDF 다운로드 이벤트를 기록한다. |
| D-M3 | Autosave warning | table | `event_type`, `payload`, `occurred_at` | write | 자동저장 이벤트를 기록한다. |
| X-02 | Growth dashboard | table | `event_type`, `occurred_at`, `payload` | derived-read | 학습 추세와 활동 그래프에 사용한다. |

## user_notifications

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| B-01 | Home dashboard | table | `id`, `category`, `title`, `link_url`, `read_at`, `created_at` | read/update | 일정/알림 보조 영역의 최신 5건 알림 피드. 클릭 시 `read_at` 기록 후 이동한다(2026-06-12 구현). |

## writing_drafts

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| B-01 | Home dashboard | table | `problem_id`, `autosave_status`, `updated_at` | read | 이어 쓸 문제와 자동저장 상태에 사용한다. |
| C-02 | Problem list | table | `problem_id`, `autosave_status`, `last_saved_at` | read | 작성 중인 문제 표시와 이어쓰기 CTA에 사용한다. |
| C-03 | Retry modal | table | `problem_id`, `status`, `last_saved_at` | read/update | 이어쓰기 또는 새로 시작 판단에 사용한다. |
| D-01 | Short-answer writing 51 | table | `problem_id`, `answer_text`, `answer_json`, `char_count`, `autosave_status`, `last_saved_at` | read/write | 작성 중 임시 저장과 자동저장 상태에 사용한다. |
| D-02 | Answer writing 52 | table | `problem_id`, `answer_text`, `answer_json`, `char_count`, `autosave_status`, `last_saved_at` | read/write | 작성 중 임시 저장과 자동저장 상태에 사용한다. |
| D-03 | Long-form writing 53 | table | `problem_id`, `answer_text`, `answer_json`, `char_count`, `autosave_status`, `last_saved_at` | read/write | 작성 중 임시 저장과 자동저장 상태에 사용한다. |
| D-04 | Essay writing 54 | table | `problem_id`, `answer_text`, `answer_json`, `char_count`, `autosave_status`, `last_saved_at` | read/write | 작성 중 임시 저장과 자동저장 상태에 사용한다. |
| D-M1 | Submission confirmation | table | `problem_id`, `answer_text`, `answer_json`, `char_count`, `autosave_status` | read | 제출 전 임시 저장 답안을 확인한다. |
| D-M3 | Autosave warning | table | `autosave_status`, `last_saved_at`, `answer_text`, `char_count` | read/write | 자동저장 실패, 지연, 충돌 경고에 사용한다. |

## writing_feedback

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| B-01 | Home dashboard | table | `submission_id`, `score_total`, `generated_at` | read | 최근 첨삭과 점수 요약에 사용한다. |
| D-M2 | AI analysis loading | table | `submission_id`, `score_total`, `overall_summary`, `raw_ai_result` | read/write | 분석 완료 후 첨삭 결과를 연결한다. |
| E-01 | Short-answer feedback | table | `submission_id`, `score_total`, `score_max`, `overall_summary`, `ai_model`, `generated_at` | read | AI 첨삭 총점과 요약을 표시한다. |
| E-02 | Long-form feedback | table | `submission_id`, `score_total`, `score_max`, `overall_summary`, `ai_model`, `generated_at` | read | AI 첨삭 총점과 요약을 표시한다. |
| R-01 | Comparison report | table | `submission_id`, `score_total`, `overall_summary` | read | 점수 변화와 요약 비교에 사용한다. |
| R-02 | Next problem recommendation | table | `score_total`, `generated_at` | derived-read | 최근 첨삭 결과를 추천 근거로 사용한다. |
| X-02 | Growth dashboard | table | `score_total`, `generated_at` | derived-read | 점수 추세에 사용한다. |

## writing_submissions

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
| D-01 | Short-answer writing 51 | table | `problem_id`, `answer_text`, `answer_json`, `char_count`, `feedback_status` | write/read | 최종 제출과 제출 상태 확인에 사용한다. |
| D-02 | Answer writing 52 | table | `problem_id`, `answer_text`, `answer_json`, `char_count`, `feedback_status` | write/read | 최종 제출과 제출 상태 확인에 사용한다. |
| D-03 | Long-form writing 53 | table | `problem_id`, `answer_text`, `answer_json`, `char_count`, `feedback_status` | write/read | 최종 제출과 제출 상태 확인에 사용한다. |
| D-04 | Essay writing 54 | table | `problem_id`, `answer_text`, `answer_json`, `char_count`, `feedback_status` | write/read | 최종 제출과 제출 상태 확인에 사용한다. |
| D-M1 | Submission confirmation | table | `problem_id`, `answer_text`, `char_count`, `feedback_status` | write | 확정 제출본을 만든다. |
| D-M2 | AI analysis loading | table | `id`, `feedback_status`, `submitted_at` | read/update | AI 분석 대기/완료 상태를 표시한다. |
| E-01 | Short-answer feedback | table | `id`, `problem_id`, `answer_text`, `char_count`, `submitted_at`, `feedback_status` | read | short 제출 원문과 상태를 표시한다. |
| E-02 | Long-form feedback | table | `id`, `problem_id`, `answer_text`, `char_count`, `submitted_at`, `feedback_status` | read | long 제출 원문과 상태를 표시한다. |
| R-01 | Comparison report | table | `id`, `answer_text`, `char_count`, `submitted_at` | read | 비교 대상 제출본을 불러온다. |
| R-02 | Next problem recommendation | table | `problem_id`, `submitted_at` | derived-read | 최근 제출 흐름을 추천 근거로 사용한다. |
| F-01 | My library | table | `id`, `problem_id`, `submitted_at`, `char_count` | read | 제출 이력 탭에 사용한다. |

## Unmapped Or Infrastructure DB Objects

| Type | Object | Classification | Reason |
| --- | --- | --- | --- |
| rpc | `private.assert_submission_payload` | infrastructure/security | Function is a trigger, RLS helper, cleanup job, validator, or security hardening helper rather than a direct page data surface. |
| rpc | `private.cleanup_unconfirmed_users` | infrastructure/security | Function is a trigger, RLS helper, cleanup job, validator, or security hardening helper rather than a direct page data surface. |
| rpc | `private.is_admin` | infrastructure/security | Function is a trigger, RLS helper, cleanup job, validator, or security hardening helper rather than a direct page data surface. |
| rpc | `private.is_content_admin` | infrastructure/security | RLS helper preserved for policies; no user-facing page uses it (admin screens live in the separate topik-ai app). |
| rpc | `private.is_org_admin` | infrastructure/security | RLS helper preserved for policies; no user-facing page uses it (admin screens live in the separate topik-ai app). |
| rpc | `private.is_platform_admin` | infrastructure/security | RLS helper preserved for policies; no user-facing page uses it (admin screens live in the separate topik-ai app). |
| table | `admin_audit_logs` | infrastructure/security | Admin audit trail written by the separate admin app (topik-ai); no user-facing page reads or writes it. |
| storage | `problem-assets` | infrastructure | Bucket holding problem material files; user pages reach files indirectly via `problem_assets.storage_path`, uploads belong to the admin app. |
| rpc | `private.is_email_confirmed` | infrastructure/security | Function is a trigger, RLS helper, cleanup job, validator, or security hardening helper rather than a direct page data surface. |
| rpc | `public.supersede_active_draft` | infrastructure/security | Function is a trigger, RLS helper, cleanup job, validator, or security hardening helper rather than a direct page data surface. |
| rpc | `public.touch_updated_at` | infrastructure/security | Function is a trigger, RLS helper, cleanup job, validator, or security hardening helper rather than a direct page data surface. |

## Document Conflicts

- database-schema-drift: `docs/development/database-schema.md` does not fully reflect the later migration set now present under `supabase/migrations/`.
- stale-ia-paths-in-audit-output: Latest IA audit artifacts still contain legacy `docs/IA/...` strings; current docs use `docs/Wireframe/...`.
