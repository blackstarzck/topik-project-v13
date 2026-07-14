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

정확한 RPC 이름, argument, return shape와 권한은 해당 migration 및 호출 source/tests를 확인한다.

## Dashboard/growth KPI source

- 제출 횟수는 `writing_submissions.submitted_at`을 기준으로 계산한다.
- `writing_submission_metrics`는 확정 제출의 파생 지표를 보관한다.
- 연속 학습일은 `study_events`를 Asia/Seoul 날짜로 해석해 계산한다.
- 실제 함수 본문과 authenticated 실행 권한은 `20260709120000_dashboard_kpi_writing_source.sql`이 정본이다.

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

- `avatars`는 public bucket이다. anon/authenticated는 bucket 안의 object를 읽을 수 있고, email-confirmed authenticated 사용자는 자기 `{user_id}/...` 경로에 insert/update할 수 있다. 자기 경로 delete는 별도 email-confirmed 조건 없이 허용된다.
- `problem-assets`는 public bucket이며 현재 anon/authenticated SELECT policy는 `bucket_id = 'problem-assets'`만 검사한다. Storage 계층 자체는 문제의 publish/visibility를 검사하지 않으므로 object path를 아는 사용자는 파일을 읽을 수 있다. authenticated 관리 쓰기는 `private.is_admin(auth.uid())` 조건을 따른다.
- `generated-exports`는 private bucket이다. authenticated 사용자는 `exports/{user_id}/...` 자기 경로를 select/delete할 수 있고, email 확인을 마치면 같은 경로에 직접 insert할 수도 있다. owner update policy는 없다. 앱의 정상 생성 흐름은 server 경로를 사용하지만, SQL 권한 자체가 browser의 자기 경로 insert를 금지하는 것은 아니다.

bucket 공개 여부, MIME/size, path 정책은 Storage migration이 정본이다. service role을 browser upload 편의용으로 사용하지 않는다.

## 보존과 정리

- user-independent seed만 `supabase/seed.sql`에 두고, user-owned test fixture는 테스트가 만들고 정리한다.
- 제출·피드백·audit처럼 기록 의미가 있는 데이터는 일반 UI에서 임의 hard delete하지 않는다.
- 미인증 가입 정리는 private function과 cron 계약을 따르며 최소 retention floor를 지킨다.
- 탈퇴 사용자는 soft-delete 상태와 복구 유예를 먼저 적용한다. 영구 삭제·Storage 파기 여부는 별도 운영 절차와 후속 migration이 정한다.
