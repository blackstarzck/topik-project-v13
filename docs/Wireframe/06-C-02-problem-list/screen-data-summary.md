# C-02 문제 목록 화면 데이터 계약

## 화면 요약
사용자가 문제를 필터링하고 정렬해서 고르는 목록 화면이다.

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
- 문제 제목
- 유형/급수/난이도/태그
- 풀이 여부와 시도 횟수
- 북마크 상태
- 페이지네이션 total_count

## 사용자 입력/상태 데이터
- domain 필터
- topik_level 필터
- question_no 필터
- difficulty 필터
- status 필터
- 검색어
- 정렬값
- 페이지

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 필터/정렬/페이지 조회 | 현재 스키마로 충족 | public.list_user_problems가 사용자 RLS 범위에서 문제 목록과 total_count를 반환한다. | filter jsonb는 domain, topik_level, question_no, difficulty, status, search를 받는다. |
| 문제 메타데이터 | 현재 스키마로 충족 | problems와 problem_assets가 유형, 난이도, 태그, 공개 상태, 첨부 자료를 제공한다. | 문제 자료 파일은 problem-assets bucket을 사용한다. |
| 풀이/북마크 상태 | 현재 스키마로 충족 | problem_attempts가 attempt_count, is_solved, bookmarked, last_attempt_at의 근거가 된다. | 쓰기 문제의 이어쓰기 상태는 writing_drafts로 보조한다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| rpc:public.list_user_problems | 필터/정렬/페이지 조회 | 20260602120400_admin_and_user_rpcs.sql: filter, sort, page, page_size를 받아 사용자 RLS 범위의 문제 목록과 total_count를 반환한다. |
| problems | 문제 목록 원천 | 20260520120200_problems.sql: id, source, author_id, domain, question_no, topik_level, difficulty, title, prompt, materials, answer_key, rubric, explanation, tags, publish_status, review_status, visibility, created_at, updated_at. |
| problem_assets | 문제 첨부 자료 | 20260520120200_problems.sql: id, problem_id, storage_path, asset_type, sort_order. asset_type은 image 또는 audio. |
| problem_attempts | 풀이/북마크 상태 | 20260520120300_attempts.sql: id, user_id, problem_id, selected_answer, is_correct, score, status, started_at, submitted_at, bookmarked, time_spent_seconds. |
| writing_drafts | 쓰기 이어쓰기 상태 | 20260520120400_writing.sql: id, user_id, problem_id, question_no, answer_text, answer_json, char_count, autosave_status, last_saved_at, created_at, updated_at. 활성 draft는 사용자와 문제 기준 1개만 허용된다. |
| storage:problem-assets | 문제 자료 파일 | 20260520121200_storage_buckets.sql, 20260520121300_storage_policies.sql: public bucket, 이미지와 오디오 허용, 쓰기는 운영 권한 정책. |

## 저장/조회/이벤트 흐름
사용자가 필터를 바꾸면 list_user_problems RPC를 다시 호출한다. 문제 클릭은 유형에 따라 객관식 풀이 또는 쓰기 작성 화면으로 이동한다.

## RLS/권한 기준
- list_user_problems는 SECURITY INVOKER로 호출자 RLS 범위에서 실행된다.
- problem_attempts와 writing_drafts는 본인 상태만 결합된다.
- problems는 published/public 문제 또는 본인이 만든 ai_generated 문제만 사용자에게 노출된다.
- problem_assets 조회 권한은 연결된 problems의 노출 권한을 따른다.
- problem_attempts는 user_id = auth.uid() 기준 본인 풀이만 읽고 쓸 수 있다.
- writing_drafts는 user_id = auth.uid() 기준 본인 draft만 읽고 쓸 수 있다.
- problem-assets 파일은 public-read이며 쓰기는 운영 권한 흐름이다.

## 스키마 정합성 메모
목록 조회 계약은 현재 스키마로 충족된다. 별도 운영 필터 preset이나 추천 정렬 가중치는 현재 스키마에 없다.

## 검수 필요 항목
- 쓰기 문제와 객관식 문제의 상태 표시 기준을 같은 목록에서 어떻게 구분할지 정한다.
- 검색 대상이 title만인지 prompt까지 포함할지 정한다.
