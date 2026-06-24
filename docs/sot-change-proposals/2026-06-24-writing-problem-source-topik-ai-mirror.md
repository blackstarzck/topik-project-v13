# 2026-06-24 쓰기 문제 소스 = topik-ai §7(관리 DB) 미러 SOT 변경 제안

## 목적

v13 사용자 화면이 보여주는 TOPIK **쓰기(51~54) 문제의 원본/원장(SoT)은 topik-ai 관리자
앱이 관리하는 §7 스키마**(`topik_writing_5x_questions`, 노출 제어 컬럼 `service_status`)임을
명문화한다. v13은 그중 `service_status='available'` 문항만 자기 `public.problems`로
**단방향 미러**해 기존 풀이/초안/서재/제출 경로를 그대로 사용한다.

## 한 줄 요약

쓰기 문제는 admin(topik-ai)이 §7에서 켜고(`available`), v13은 그것을 `problems`로 자동
복제(미러)해 노출한다. v13은 §7를 **읽기만** 하고, 외부 채점 API(`/api/writing/tasks` 등)는
**문제 로딩에 사용하지 않는다**(제출→분석→피드백 전용).

## 변경 내용

| 항목 | 내용 |
| --- | --- |
| 쓰기 문제 SoT | topik-ai §7(`topik_writing_5x_questions` + `service_status`). v13 `problems`는 파생 미러. |
| 미러 메커니즘 | `public.sync_available_writing_problems()`(SECURITY DEFINER) — §7 `available` → `problems` upsert. id=`md5(question_id)::uuid`(결정적, idempotent). 콘텐츠(prompt/materials/answer_key/rubric)=§7 적재 원본 `raw_payload`(=기존 normalizer가 파싱하는 위자드 형태). topik_level=2(TOPIK II), publish_status=published, visibility=public, lifecycle_status=active. |
| 목록 메타데이터 | v13 문제목록(`list_user_problems` RPC → `ProblemTable`)의 난이도/예상시간/태그는 `problems.difficulty`(smallint 1~5)와 `problems.tags`(text[])에서 읽는다. 미러가 §7 `difficulty_level`(1~6=TOPIK 급수)→`difficulty`(CHECK 1~5로 클램프), §7 `topic_main`/`topic_detail`/`speech_act`/`scenario_type`→`tags`(한글 칩, 순서보존·중복/빈값 제거)로 채운다. **예상시간**은 별도 컬럼 없이 v13가 `difficulty`에서 파생(`fallbackEstimatedMinutes`). **이전 점수**는 미러 범위 밖이라, v13 목록 로더(`problem-list-data.ts`)에서 본인 최신 제출의 `writing_feedback.score_total`을 추가 조회(owner RLS)해 표시하도록 별도 연동했다(`list_user_problems` RPC 무변경; 미제출/미채점→null). |
| 동기화 트리거 | pg_cron `sync-writing-problems`(매 1분). admin이 노출 토글 시 1분 내 반영. |
| 미노출 전환 | §7에서 `available`이 풀린 문항의 미러는 **하드삭제 금지**(`writing_submissions.problem_id` on delete restrict) → `publish_status='archived'`, `lifecycle_status='inactive'`. 기존 제출/서재 ledger 보존. |
| 외부 API 경계 | `/api/writing/tasks`(상류 목록)는 **문제 로딩에 사용 금지**. 외부 API는 제출(submit)→분석(evaluation)→피드백(feedback) 전용. |
| v13 코드 변경 | 없음. 로더(`getWritingProblem`)·정규화기·초안·서재·제출은 `problems`를 그대로 읽으므로 미러 행만 있으면 작동. |

## 현재 구현과 맞춰야 할 지점

- `problems` 제약 준수: `topik_level ∈ (1,2)`(쓰기=2), `question_no ∈ (51..54)`, `domain='writing'`. `author_id`는 nullable(미러는 null).
- 미러는 `source='curated'`로 표기해 admin이 직접 만든 문제와 구분/식별 가능.
- 숨김/비활성 UX 계약(`2026-06-23-hidden-writing-problem-ux-contract`)과 정합: 미노출 전환분은 archived/inactive로 내려 동일 계약(제공 종료/placeholder)이 적용된다.

## 대상 문서 / 수정 이유 / 수정 방향

| 대상 문서 | 수정 이유 | 수정 방향 |
| --- | --- | --- |
| `docs/Wireframe/data-usage-index.md` | 쓰기 문제 데이터 소스가 §7 미러임을 역색인에 반영해야 한다. | `problems`(writing, source=curated)의 출처를 §7 미러 + `sync_available_writing_problems`로 기재. |
| `README.md` / 아키텍처 개요 | 쓰기 문제 SoT·외부 API 경계가 빠져 있다. | "쓰기 문제 SoT=topik-ai §7, v13는 미러 읽기, /api/writing/tasks는 로딩 미사용(제출/피드백 전용)" 추가. |
| `docs/swagger-api/*`(있다면 로딩 용도 기술) | `/api/writing/tasks`를 문제 로딩 경로로 읽히게 하는 서술 정정. | 로딩 용도 아님을 명시(스냅샷 자체는 사실로 유지). |

## 검증 기준 / 검증 결과

- admin이 §7 문항을 `available`로 켜면 1분 내 `problems`에 미러되어 v13 쓰기 화면에 노출된다.
- **검증됨(2026-06-24):** §7 `available`(예: topik-writing-51-0001) → `problems` 미러 행(uuid `md5(question_id)`)이 v13 표시 게이트(published/public/active/domain=writing) 통과; playwright `next-problem.spec.ts`(표시/추천 화면) PASS; 콘텐츠 정합은 기존 466-픽스처 `problem-normalizer` 단위 테스트로 보장(§7 데이터=동일 픽스처).
- **미검증/후속:** 피드백 화면 e2e(`short/long-feedback`)는 본 변경과 무관한 `getSubmission` 세션 이슈로 실패 — 별도 조사. 외부 API 실채점 제출→피드백 전 구간 e2e는 외부 종속으로 미실행.
