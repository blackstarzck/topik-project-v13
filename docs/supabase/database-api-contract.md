# Database와 API 계약

## 현재 데이터 영역

현재 migration에는 다음 영역이 존재한다. 정확한 table·column·constraint는 SQL 본문이 정본이다.

| 영역 | 저장되는 관계 |
| --- | --- |
| 사용자와 목표 | profile, 학습 목표, 가입 완료·동의·계정 상태 |
| 문제와 콘텐츠 | 문제, asset, 공개·검수·기관 노출 상태 |
| 학습과 쓰기 | 풀이, 활성 초안, 확정 제출, 분석 상태와 재시도 관계 |
| 피드백 | 종합·영역·문장 피드백과 답안 비교 |
| 추천과 복습 | 추천 run/item, 서재 item, 학습 event |
| 내보내기 | export file, PDF quota 정책·사용·reset materialization |
| 알림 | 사용자 알림, 설정, dispatch/email 상태와 마케팅 동의 |
| 기관 | 조직, 구성원, 배정과 제출 연결 |
| 운영 기반 | audit, subscription/payment 구조, legal document |

운영 기반 table이 존재한다는 사실이 v13의 admin UI, 실제 billing provider 또는 외부 발송 기능을 활성화한다는 뜻은 아니다. 제품 노출 범위는 PRD가 결정한다.

## Data API

- local config는 `public`과 `graphql_public`을 노출 schema로 설정한다.
- table/view/function이 schema에 존재하는 것만으로 사용자 권한을 가정하지 않는다. role별 grants와 RLS/policy를 migration에서 함께 확인한다.
- browser client는 publishable key와 사용자 session으로 접근하고, user-owned row는 본인 범위로 제한한다.
- TypeScript 타입은 DB의 파생 산출물이며 migration보다 앞서지 않는다.

## 원자성과 idempotency

- 최종 쓰기 제출과 초기 피드백 상태처럼 함께 성공하거나 함께 실패해야 하는 변경은 RPC transaction으로 처리한다.
- 사용자와 문제의 활성 draft는 하나로 수렴한다. 반복 autosave와 동일 요청 재시도는 중복 draft 또는 submission을 만들지 않아야 한다.
- 외부 분석 결과 수신과 feedback retry는 기존 제출 관계를 보존하고 중복 요청을 식별한다.
- 기관 초대 수락, 가입 완료, nickname 확인처럼 경쟁 가능성이 있는 변경은 DB constraint와 RPC 검증을 함께 사용한다.
- PDF 생성은 distinct 문제 단위로 quota를 reserve하고 성공 시 commit, 실패 시 release한다. 저장 파일 재다운로드는 새 usage가 아니다.
- quota usage뿐 아니라 사용자에게 materialize된 quota reset header/target 조회도 active profile 전용이다. 탈퇴 JWT는 reset 이력을 읽을 수 없고 quota 예약 RPC도 진입 단계에서 거부된다.

정확한 RPC 이름, argument, return shape와 권한은 해당 migration 및 호출 source/tests를 확인한다.

### 가입 완료와 정확한 약관 스냅샷

- `20260718120000_auth_gate_exact_consent_snapshots.sql` 이후 가입 완료 RPC는 화면에 표시한 동의 문서의 `{id, version}` 배열을 `p_consent_documents jsonb`로 반드시 받는다.
- RPC는 같은 transaction에서 공식·published·required 문서 집합을 고정하고 locale 완전 집합 또는 `ko` fallback을 결정한다. 최신 효력 시각이 같은 문서가 있거나 terms/privacy 완전 집합이 아니면 profile과 동의 기록을 모두 남기지 않는다.
- 현재 아직 동의하지 않은 문서 집합을 ID 순서로 한 번 캡처한 뒤 전달된 배열과 정확히 같을 때만 그 캡처를 `user_consents`에 기록한다. 화면 표시 뒤 새 버전이 published되면 이전 배열은 `auth_completion_stale: consent_documents`로 실패한다.
- authenticated 사용자는 `user_consents`에 직접 INSERT할 수 없다. table grant와 RLS policy가 모두 직접 쓰기를 막으며, `complete_auth_gate()`만 위 검증을 마친 transaction에서 동의 ledger를 기록한다.
- 앱이 사용하는 공개 signature는 8-argument 또는 locale seed를 포함한 10-argument overload이며, 둘 다 boolean 다음에 `p_consent_documents jsonb`를 둔다. 이전 4/7/9-argument boolean-only signature는 `PUBLIC`, `anon`, `authenticated` 실행 권한을 모두 회수한다.
- 이 migration 파일과 파생 TypeScript 타입이 v13 정본이지만, dev·production 적용과 role별 catalog evidence는 topik-ai 운영 절차가 소유한다. v13 작업면에서는 원격 apply를 실행하지 않는다.

## Dashboard/growth KPI source

- 사용자에게 보이는 제출 완료 횟수는 `writing_submissions.feedback_status = 'complete'`이고 연결된 `writing_feedback.status = 'complete'`인 기록만 `writing_submissions.submitted_at` 기준으로 계산한다. pending·analyzing·failed 기록은 시도 이력으로 보존하지만 사용자 완료 횟수에는 포함하지 않는다.
- 운영 제출 시도 수는 `writing_submission_intents`를 기준으로 계산하고 accepted·materialized·failed·ambiguous를 분리한다. 사용자 완료 횟수와 운영 시도 수를 같은 지표로 사용하지 않는다.
- `writing_submission_metrics`는 분석과 피드백까지 완료된 제출의 파생 지표를 보관한다.
- 연속 학습일은 `study_events`를 Asia/Seoul 날짜로 해석해 계산한다.
- 현재 완료 정의를 반영한 함수 본문과 authenticated 실행 권한은 `20260722120000_writing_completion_and_pdf_outcomes.sql`이 정본이다.

## Canonical 쓰기 문항과 사용자 기록

- 사용자가 현재 풀 쓰기 문항의 유일한 본문 원천은 admin 소유 `topik_writing_51_questions`~`topik_writing_54_questions`와 `topik_writing_question_source_map`이다. v13은 `get_available_writing_questions`의 learner-safe projection을 요청 시 직접 읽으며 `public.problems`의 쓰기 mirror로 fallback하지 않는다.
- 쓰기 `problem_id`는 `md5(question_id)::uuid`로 결정되고 `private.problem_identities`가 사용자 기록의 FK anchor를 맡는다. registry에는 본문·정답·rubric·raw payload를 저장하지 않는다. `legacy_problem_id`는 과거 ETL provenance이며 신규 사용자 식별자로 사용하지 않는다.
- current-content는 canonical catalog를 사용하고, 과거 제출·피드백·비교·PDF는 각 draft/submission의 `question_snapshot` 또는 `legacy_cutover_snapshot`을 사용한다. 과거 기록을 현재 canonical 본문으로 추정해 덮어쓰거나 일반 목록이 과거 snapshot으로 fallback하지 않는다.
- `list_user_problems`의 `writing_submission_count`와 `solve_state = submitted`는 분석·피드백 완료 기록만 기준으로 한다. 전체 materialized submission 수는 `writing_submission_attempt_count`로 분리하며, 초안 또는 pending·analyzing·failed 기록만 있으면 `solve_state = attempted`다.
- 초안과 신규 제출 문맥은 `canonical_question_id`, `canonical_import_id`, `canonical_payload_hash`, learner-safe snapshot을 함께 고정한다. 같은 ID의 canonical payload가 바뀌면 기존 초안을 덮어쓰지 않고 superseded 처리 후 사용자가 현재 버전으로 답안을 복사하도록 한다.
- `20260714140000_writing_problem_identity_registry_cutover.sql`이 확인된 쓰기 FK를 registry로 이관하고 기존 기록 snapshot을 백필한 뒤 `public.problems`의 쓰기 행을 제거한다. `sync-writing-problems`, legacy/shadow read mode, reconciliation과 rollback sync entrypoint는 최종 current-content 계약에 없다.
- `20260714141000_writing_submission_outbox.sql`은 외부 호출 전에 불변 intent를 저장하고 한 요청만 claim한다. 명확한 성공은 외부 호출을 반복하지 않고 local submission으로 materialize하며, 처리 여부가 불명확한 timeout은 `ambiguous`로 격리한다. 내부 UUID와 provider의 text ID는 수명·형식·FK 책임이 달라 별도 필드로 보존한다.
- 제출 제어는 `blocked | canonical`이며 `canonical` 전환은 outbox 설치만으로 허용되지 않는다. 동시 요청, timeout, provider 4xx, 외부 성공 후 DB 실패와 replay를 실제로 검증한 evidence가 등록돼야 한다.

### 2026-07-15 dev 검증 상태

- 운영 소유 절차로 dev DB에 v13 `20260714140000`, admin bridge `20260714150000`, v13 권한 교정 `20260714160000`을 적용했다. 운영 DB에는 적용하지 않았다.
- dev에는 canonical 공개 문항 700건, source-map pin 700건, private writing identity 704건이 있고 `public.problems` 쓰기 행은 0건이다. 기존 draft 328건과 submission 280건은 유지됐고 submission history snapshot 누락은 0건이며 확인된 쓰기 FK 10개가 registry를 참조한다.
- 실제 cross-app headed Chromium에서 desktop 1280px 10/10, mobile 360px 7/7(데스크톱 전용 3개 의도적 skip)을 통과했다. current-content, Q51~54, Q53 chart, 초안 저장·새로고침, stale 복구, 과거 이력·PDF, 공개 제외, 추천과 제출 차단을 확인했고 page error·console error·5xx는 0건이었다.
- `20260714141000` outbox를 dev에 적용하고 down/up 재적용을 검증했다. 동시 중복, timeout 격리, provider 4xx, accepted marker 저장 실패, accepted 뒤 materialize 실패 복구의 5개 live fault-injection 시나리오가 통과했고, 보고서 SHA-256을 service-role evidence로 등록했다.
- headed Chromium의 실제 Q54 canary가 초안 저장 → intent/단일 provider 호출 → local submission materialize → 상태 polling → feedback 및 3개 dimension 저장 → 피드백 화면 렌더링을 통과했다. 내부 submission UUID와 provider submission ID가 분리됐고 browser console/page error/5xx는 0건이었다. canary 데이터는 제거했으며 기준 수량은 draft 328건, submission 280건, intent 0건으로 복귀했다.
- 검증 종료 후 dev 제출 제어는 의도적으로 `blocked + unverified`로 fail-close했다. 운영 DB와 Vercel에는 아직 적용하지 않았으며, 서비스 재개 시에는 검증된 evidence ID로 `canonical + local_outbox_verified`를 원자적으로 설정한 뒤 smoke test를 수행한다.

## 기관 초대 알림과 응답 RPC

기관 초대 알림은 `template_key` 또는 payload의 `kind`가 `institution_invitation`일 때 modal-first 동작으로 판별한다. payload의 `invitation_id`는 응답할 초대 UUID이고, `code`와 `code_label`은 표시용 정보다. `expires_at`은 초대 만료 시각을 나타내는 UTC 기준 ISO 8601 timestamp다. 이 값들은 payload field이며 RPC 인자가 아니다. 현재 v13 모달은 `code`만 사용자에게 보여 준다. `code_label`은 payload 호환을 위해 파싱·보존하지만 현재 v13 모달에는 표시하지 않는다.

v13 client는 shared RPC `respond_institution_invitation` 시그니처만 사용한다.

```text
respond_institution_invitation(p_invitation_id uuid, p_accept boolean) -> jsonb
```

- `p_invitation_id`에는 검증한 `invitation_id`를 전달한다.
- shared RPC에서 `p_accept`는 수락이면 `true`, 거절이면 `false`다. 현재 v13 모달은 수락할 때만 `true`를 보내며, 닫기 동작은 RPC를 호출하지 않는다. `false`는 과거 데이터와 다른 호출 주체를 위한 shared API 호환 계약으로 남는다.
- `accepted`, `declined`, `expired`는 shared RPC의 정상 결과 계약이다. 만료된 초대에 응답하면 RPC는 `status = expired`, `error = invitation_expired`를 반환하며, v13은 이 서버 최종 상태를 만료 상태로 표시한다. 현재 v13 모달이 직접 만드는 정상 응답은 `accepted` 또는 `expired`이며, `declined` 해석은 기존 결과 호환을 위해 유지한다.
- `canceled`와 `error = code_inactive`(`code_inactive`) 조합은 이전 계약과의 호환을 위해 만료 상태로 해석하고, 그 밖의 `canceled`는 회수 상태로 표시한다.
- `already responded`, `unauthenticated`, `profile_not_found`, `already affiliated` 등의 exception은 `src/components/notifications/notifications-data.ts`의 분류를 거쳐 raw DB message를 사용자에게 직접 노출하지 않는다.

이 RPC와 관련 table의 migration home은 외부 topik-ai 운영 저장소다. 확인된 외부 migration 이름은 `20260707140000_institution_invitations.sql`, `20260707141000_institution_invitation_respond.sql`, `20260708120000_institution_invitation_expiry.sql`이다. v13은 typed client 호출과 사용자 UI만 소유하므로 v13 migration을 추가하지 않는다. 이 문서는 외부 SQL의 grants, RLS 또는 내부 구현을 v13이 소유한다고 선언하지 않는다. 원격 DB apply도 v13 작업면에서 실행하지 않는다.

## 기관별 쓰기 문제 노출 경계

- shared admin surface가 소유하는 `topik_writing_question_institution_exposure`가 문제와 기관 code의 연결을 제공한다. v13 migration은 이 table을 생성하거나 변경하지 않는다.
- v13의 `is_writing_problem_visible_to_caller`와 관련 filter/list 함수는 그 연결을 읽어 user-facing 노출을 제한한다.
- 최신 `20260629110000_institution_assigned_only_writing_access.sql` 기준으로, table이 없으면 노출 판단은 fail closed다. 소속 code가 없는 사용자는 mapping이 없는 공개 문제만, 소속 code가 있는 사용자는 자기 code에 mapping된 문제만 볼 수 있다.
- 정확한 함수, grant, private service-role helper는 해당 v13 migration SQL이 정본이고, 외부 table의 schema·write 권한은 그 소유 저장소의 migration이 정본이다.

## Storage

- `avatars`는 private bucket이다. profile에는 object path만 저장하고 앱은 active authenticated 본인의 SELECT policy를 거쳐 최대 5분짜리 signed URL을 만든다. active·email-confirmed 사용자는 자기 `{user_id}/...` 경로에 insert/update할 수 있고, active 사용자는 자기 경로를 delete할 수 있다.
- `problem-assets`는 public bucket이며 현재 anon/authenticated SELECT policy는 `bucket_id = 'problem-assets'`만 검사한다. Storage 계층 자체는 문제의 publish/visibility를 검사하지 않으므로 object path를 아는 사용자는 파일을 읽을 수 있다. authenticated 관리 쓰기는 `private.is_admin(auth.uid())` 조건을 따른다.
- `generated-exports`는 private bucket이다. active authenticated 사용자는 `exports/{user_id}/...` 자기 경로를 select/delete할 수 있고, email 확인을 마치면 같은 경로에 직접 insert할 수도 있다. owner update policy는 없다. 앱의 정상 생성 흐름은 server 경로를 사용하지만, SQL 권한 자체가 browser의 자기 경로 insert를 금지하는 것은 아니다.

`deleted` profile은 기존 JWT가 남아 있어도 두 private bucket의 object SELECT/INSERT/DELETE와 signed URL 발급을 할 수 없다. 이미 발급된 avatar signed URL은 최대 5분 동안 유효할 수 있다. bucket 공개 여부, MIME/size, path 정책은 Storage migration이 정본이다. service role을 browser upload 편의용으로 사용하지 않는다.

## PDF 생성 운영 기록

- `export_files`는 인증되고 형식이 검증된 PDF 생성 요청을 `queued | ready | failed`로 보존한다. 실패 시에는 허용된 `failure_code`와 `failed_at`만 기록하고 원본 예외, 답안, provider 응답을 저장하지 않는다.
- server render의 기술 성공률은 종료된 기술 결과 중 `ready / (ready + technical_failed)`로 계산한다. queued, quota 거절, 인증·형식 거절은 기술 성공률 분모에서 제외한다.
- `options.source = browser_print`의 ready는 브라우저 인쇄 화면에 전달할 자료 준비 성공을 의미하며 사용자가 실제 파일로 저장했다는 증거가 아니다. server render 결과와 별도로 집계한다.

## 보존과 정리

- user-independent seed만 `supabase/seed.sql`에 두고, user-owned test fixture는 테스트가 만들고 정리한다.
- 제출·피드백·audit처럼 기록 의미가 있는 데이터는 일반 UI에서 임의 hard delete하지 않는다.
- 미인증 가입 정리는 private function과 cron 계약을 따르며 최소 retention floor를 지킨다.
- 탈퇴 사용자는 `request_account_deletion()`으로만 soft-delete 상태와 복구 유예를 적용한다. 일반 profile UPDATE로 `status`나 `deleted_at`을 바꿀 수 없다. `get_my_account_state()`는 로그인 경계에 호출자 본인의 최소 상태만 제공한다. 영구 삭제·Storage 파기 여부는 별도 운영 절차와 후속 migration이 정한다.
- `problems`/`problem_assets` DB 조회는 공개 published 문제 범위와 호출자-private 범위를 분리한다. 탈퇴 JWT에도 전자는 유지하지만 private·AI-generated 행과 INSERT/UPDATE/DELETE는 active profile이 없으면 거부한다.
- RLS를 우회하는 사용자 데이터 RPC 7개는 공통 active-account assertion을 가장 먼저 실행한다. `list_user_library_problem_items()`는 활성 사용자의 현재 서재 읽기 계약과 10열 반환 형식을 유지한다. runtime 의존성이 제거된 `submit_writing_with_feedback(jsonb,jsonb,jsonb,jsonb)`만 authenticated/PUBLIC 실행 표면에서 제외한다.
