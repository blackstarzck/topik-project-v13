# 보안과 소유권 계약

## Auth gate

- public 인증 화면은 session이 없어도 동작하며 user-owned table 접근을 전제로 하지 않는다.
- callback의 `next`는 앱 내부 상대 경로로 sanitize한다. token과 provider raw error는 사용자 화면과 redirect URL에 노출하지 않는다. legacy implicit-flow fragment는 값을 캡처한 직후 session 교환보다 먼저 주소와 history에서 전체 제거한다. StrictMode effect 재실행도 같은 fragment 처리 작업에 다시 연결하며 session 교환을 반복하지 않는다. 동기식 history 정리가 실패하면 fragment를 읽거나 교환하지 않고 fragment가 없는 현재 pathname+search로 전체 navigation을 시작한다. session 교환이 reject되면 원본 오류를 기록하지 않고 canonical unknown 오류 화면으로 복구한다. callback server log도 provider `error_description`과 Supabase 원본 오류를 남기지 않고 canonical stage만 기록한다.
- email 확인, 필수 동의와 profile 완료 gate는 server와 DB 계약을 함께 확인한다.
- browser에는 publishable key만 허용한다. 일반 사용자 CRUD는 JWT와 RLS/RPC 소유권 검증으로 실행한다. secret/service-role key는 사용자 인증 수단이 아니며 명시적 server-only 시스템 작업에만 허용한다.
- `/auth/account-inactive`는 query의 상태 힌트를 신뢰하지 않는다. 같은 request-bound client로 현재 JWT 사용자와 `get_my_account_state()` 결과를 확인하고, 실제 `blocked`/`deleted`일 때만 local sign-out한다. `active`는 dashboard로 돌려보내고, 확정된 미인증 사용자만 login으로 보낸다. 인증·상태 확인·local sign-out 오류와 unknown 상태는 session mutation 없이 public `/auth/error?reason=unknown`으로 보내 auth-entry redirect loop를 막는다. RPC가 존재하지 않는다는 `PGRST202`에만 같은 JWT/RLS client의 본인 `profiles(id, status)` 조회를 임시 호환 경로로 사용하고, owner id와 `active`/`blocked`/`deleted` allowlist를 다시 검증한다.

## RLS와 소유권

- Data API에 노출되는 table은 grants와 RLS를 함께 적용한다.
- profile, goal, attempt, draft, submission, feedback, recommendation, library, event, export, notification과 quota usage 같은 user-owned row는 `auth.uid()`에 연결된 본인 범위로 제한한다.
- 이 사용자 전용 범위는 소유자 일치만으로 충분하지 않다. 호출자의 profile이 `active`일 때만 허용하며, 탈퇴 전에 발급된 JWT가 아직 만료되지 않았어도 `deleted` 상태가 된 즉시 읽기와 쓰기를 모두 거부한다.
- UPDATE는 기존 row 소유 조건과 변경 후 소유 조건을 모두 지켜야 한다. 사용자가 `user_id`, role, status처럼 권한을 바꾸는 필드로 row를 탈취할 수 없어야 한다.
- RLS의 행 소유권 검사와 별도로 column privilege를 최소화한다. `library_items`는 `tags`, `recommendation_items`는 `status`, `export_files`는 `storage_path/status/ready_at`만 authenticated UPDATE를 허용한다. 이 제한은 대상 FK, export source, 추천 근거·순위의 재지정을 막는다.
- `review_set_created` 이벤트는 SECURITY INVOKER trigger가 같은 사용자의 보관함 항목만 허용한다. 이 검사는 service-role 우회 함수가 아니며 일반 사용자 요청은 JWT와 기존 RLS 문맥을 그대로 사용한다.
- 사용자별 client cache key에 인증된 사용자 ID를 포함하지만 이는 cache 분리용이다. 권한 판단에 client가 전달한 ID를 신뢰하지 않고 JWT와 RLS를 계속 사용한다.
- 공개 콘텐츠 읽기는 publish/review/visibility, 만료와 기관 노출 조건을 함께 만족해야 한다. `problems`와 그 DB 자산 행은 탈퇴 후에도 published+public 범위만 읽을 수 있고, 본인 비공개·AI 생성 문제 조회와 모든 쓰기는 active profile이 있어야 한다.
- 기관 데이터는 membership/manager predicate와 배정 관계를 통해 제한한다.

## 보호 필드와 privileged code

- 일반 사용자는 profile의 `app_role`, `plan_label`, `affiliation_code`를 임의로 바꿀 수 없고, 일반적인 status 변경도 trigger가 차단한다.
- self-deactivation도 일반 profile UPDATE의 예외가 아니다. authenticated role은 허용된 일반 프로필 열에만 UPDATE 권한이 있어 admin JWT를 포함해 `status`와 `deleted_at`을 직접 바꿀 수 없다. 본인 탈퇴는 호출자를 다시 확인하는 idempotent `request_account_deletion()`만 사용한다.
- 탈퇴 후 일반 profile RLS가 닫혀도 로그인 경계가 상태를 판별할 수 있도록 `get_my_account_state()`는 호출자 본인의 상태 문자열만 반환한다. 다른 profile 필드, 탈퇴 시각 또는 다른 사용자의 상태는 반환하지 않는다.
- 사용자 입력 metadata를 권한 근거로 사용하지 않는다. 권한은 DB row, trusted app metadata 또는 server 검증에서 가져온다.
- 기관 초대 생성·회수는 topik-ai가 소유한다. v13 사용자는 본인 JWT session으로 `respond_institution_invitation`을 호출하며, 초대 UUID·소유자·pending 상태는 DB가 검증한다.
- `private.protect_profile_columns()`의 `app.claim_affiliation_code` 검사는 topik-ai 소유 응답 RPC가 같은 트랜잭션에서 소속을 갱신하기 위한 transaction-local 호환 경계다. v13 browser가 이 값을 설정하거나 raw affiliation code RPC로 우회하지 않는다.
- `SECURITY DEFINER` function은 RLS 우회가 필요한 최소 작업에만 사용하고, 함수 내부에서 auth·소유권을 다시 확인하며 `search_path`와 execute grant를 제한한다.
- 사용자 전용 데이터를 다루는 공개 `SECURITY DEFINER` RPC는 진입 시 active profile을 다시 확인한다. 현재 대상은 dashboard KPI, 제출 이력 문맥, 오래된 초안 교체, 비교 리포트 생성, PDF quota 예약, nickname 중복 확인, 서재 문제 목록이다. 제거된 canonical 쓰기 경로에 의존하는 구형 제출 RPC는 authenticated 실행 권한을 회수한다.
- PDF 획득과 quota claim은 browser의 사용자 session/JWT로만 실행하고 함수 안에서 `auth.uid()`, 활성 사용자, 원본 소유권을 다시 확인한다. claim 시 DB는 획득 기록의 제출·리포트·서재 항목에서 문제 집합을 다시 계산하며, 정렬·중복 제거된 1~6개 입력과 정확히 같고 모든 원본이 여전히 존재할 때만 quota를 변경한다. 서재 선택은 서재 row 소유권뿐 아니라 허용된 `submission | report` 유형과 연결 대상의 실제 소유권까지 확인한다. DB가 attempt UUID와 lease를 만들며 authenticated 역할의 `export_files` 직접 INSERT·UPDATE·DELETE 권한은 제거한다. service role은 사용자 대신 획득·claim하거나 일반 CRUD를 수행하는 용도가 아니고, JWT 단계가 성공한 뒤 현재 attempt와 export 요청 번호가 usage 요청 번호에 정확히 일치하는 경우에만 원자적 ready+commit 또는 failed+release에 사용한다.
- private schema function과 cron은 browser callable API로 간주하지 않는다.
- admin RPC와 audit 구조가 migration에 남아 있어도 v13 user app은 admin UI나 운영 권한을 소유하지 않는다.
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_ACCESS_TOKEN` 직접 접근은 공용 service-role helper로 제한한다. 현재 notification worker와 unsubscribe route의 두 직접 접근은 별도 notification 소유권 정리 전까지의 명시적 임시 예외이며, 후속 notification task가 shared server-only helper로 옮긴 뒤 allowlist에서 제거한다.
- canonical 쓰기 RPC는 학습자에게 제목·지문·자료와 버전 식별자처럼 허용된 필드만 반환한다. 정답·모범답안·rubric·scoring·raw payload는 browser 응답과 learner-safe snapshot에 포함하지 않는다.
- `private.problem_identities`와 submission intent/outbox, reconciliation·evidence RPC는 browser가 직접 읽거나 조작하는 표면이 아니다. authenticated 사용자는 owner 검증을 거친 공개 RPC만 호출하고, 상태 전환·운영 대사는 service role에 한정한다.
- snapshot CHECK가 호출하는 금지-key 판별 helper는 immutable하고 table을 읽지 않는 순수 함수다. `authenticated`와 `service_role`에 실행 권한을 주되 `anon`과 `PUBLIC`에는 주지 않는다.
- 필수 동의 ledger인 `user_consents`는 authenticated role의 table INSERT 권한과 직접 INSERT policy를 모두 닫는다. 공식 동의 기록의 유일한 쓰기 경로는 `complete_auth_gate()`이며, 이 함수가 공식 문서 snapshot을 검증한 transaction 안에서 기록한다.

## 시스템 리포팅

- `private.system_reports`는 Data API 노출 대상이 아니며 RLS를 enable·force한다. `PUBLIC`, `anon`, `authenticated`, `service_role`의 직접 table 권한을 모두 회수해 browser와 일반 서버 코드가 행을 직접 읽거나 쓰지 못하게 한다.
- `submit_system_report`는 고정된 `search_path`를 사용하는 최소 범위의 `SECURITY DEFINER` 함수다. `PUBLIC`, `anon`, `authenticated`의 실행 권한을 회수하고 `service_role`에만 실행을 허용한다.
- 사용자 앱의 server route가 same-origin·본문·필드 allowlist를 먼저 검증한 뒤 이 RPC를 호출한다. browser가 보낸 사용자 ID는 받지 않으며, server가 쿠키 session을 직접 검증해 확인된 Auth 사용자 ID만 선택적으로 전달한다.
- browser에는 publishable key만 남고 service-role secret은 server-only다. 접수번호는 사용자 ID나 생성 시각을 포함하지 않는 무작위 코드이며, 실패 응답은 database·RPC·provider 원인을 노출하지 않는다.
- 허용된 진단 정보는 query·hash 없는 pathname과 브라우저·OS·기기 유형의 대분류, viewport, locale, server가 정한 앱 버전뿐이다. IP·referrer·원본 User-Agent·query·hash는 수집하지 않는다.

## 계정·알림·정리

- 탈퇴 요청은 사용자 접근을 막는 soft delete와 30일 복구 유예를 기본으로 한다.
- 탈퇴 HTTP POST의 신뢰 출처는 production의 `NEXT_PUBLIC_SITE_URL`이다. `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`는 출처 판정과 redirect 기준으로 사용하지 않으며, development/test만 현재 loopback request URL을 추가 허용한다.
- `get_my_account_state()`는 현재 JWT 소유자의 lifecycle 상태만 반환하는 최소 RPC다. 함수·grant의 정본은 P0 보안 migration `20260723234527_consent_account_deletion_rls.sql`이다. 결합 후에는 RPC를 우선 사용하며, 결합 전 단독 배포에서는 `PGRST202`일 때만 현재 JWT/RLS가 허용하는 본인 profile 상태 조회로 호환한다. 다른 RPC 오류에는 fallback하지 않는다.
- 미인증 계정 cleanup은 확인 상태와 retention floor를 검사하고 private/cron 경계에서 실행한다.
- 사용자 알림 읽음 상태·설정·마케팅 동의 테이블인 `user_notifications`, `user_marketing_consent`는 v13이 소유한다. dispatch, email transport, retry, marketing gate, pg_cron과 admin 대상 생성은 topik-ai `admin_schema_migrations` 소유 private/server 운영 경계다. v13의 과거 파이프라인 migration은 독립 clean replay를 위한 no-op이며 topik-ai 운영 테이블을 정적으로 참조하지 않는다. replay guard는 이관 marker와 고정된 notice-only `DO` 본문만 허용하고, 그 밖의 실행 SQL은 종류와 관계없이 거부한다.
- marketing 전달은 저장된 consent가 있는 경우에만 가능하며, provider가 준비되지 않은 상태를 성공 발송으로 기록하지 않는다.

## 현재 Storage 권한

| Bucket | 공개성·읽기 | authenticated write |
| --- | --- | --- |
| `avatars` | private bucket, active authenticated 본인의 `{user_id}/...` 경로만 SELECT. 앱은 짧은 유효기간의 signed URL을 사용 | active·email-confirmed 본인의 경로만 INSERT/UPDATE, active 본인의 경로만 DELETE |
| `problem-assets` | public bucket, anon/authenticated SELECT는 bucket 조건만 검사 | `private.is_admin(auth.uid())`인 authenticated 사용자만 write |
| `generated-exports` | private bucket, active authenticated 본인의 `exports/{user_id}/...` 경로만 SELECT | active·email-confirmed 본인의 경로만 INSERT, active 본인의 경로만 DELETE, UPDATE policy 없음 |

public bucket과 SELECT policy는 콘텐츠 table의 publish/visibility RLS를 자동으로 상속하지 않는다. 이미 발급된 avatar signed URL은 최대 5분 동안 유효할 수 있지만, 탈퇴한 사용자의 기존 JWT로 새 signed URL을 만들거나 object를 읽고 쓸 수는 없다. 앱의 정상 export 생성은 server 경로지만 위 표는 현재 SQL이 실제 허용하는 범위를 기록한다. bucket, path와 policy의 최종 정본은 Storage migration이다.

서버 PDF는 attempt별 object 경로를 사용한다. service-only terminal 함수가 현재 attempt의 실패 또는 lease 상실을 확정한 경우에만 그 실행의 object를 삭제하고, 새 attempt의 ledger·quota·object는 변경하지 않는다. complete 호출 결과만 유실돼 ready 여부도 확정할 수 없으면 복구 가능성을 위해 object를 남긴다. 삭제 자체는 Storage 장애로 실패할 수 있으므로 운영 정리 대상은 attempt, `failed` ledger와 object 존재 여부를 함께 대사한다.

## 변경 검토 체크리스트

- [ ] Data API grant와 RLS가 함께 정의됐는가?
- [ ] anon/authenticated/service-role 권한이 필요한 최소 범위인가?
- [ ] owner 조건과 `WITH CHECK`가 변경 후 row 탈취를 막는가?
- [ ] RPC 재시도와 동시 요청이 중복 데이터를 만들지 않는가?
- [ ] Storage path와 bucket 정책이 DB 소유권과 일치하는가?
- [ ] protected field와 secret이 browser에 노출되지 않는가?
- [ ] local replay와 관련 auth/RLS integration test가 통과했는가?
