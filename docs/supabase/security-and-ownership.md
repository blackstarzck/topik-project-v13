# 보안과 소유권 계약

## Auth gate

- public 인증 화면은 session이 없어도 동작하며 user-owned table 접근을 전제로 하지 않는다.
- callback의 `next`는 앱 내부 상대 경로로 sanitize한다. token과 provider raw error는 사용자 화면과 redirect URL에 노출하지 않는다. callback server log도 provider `error_description`과 Supabase 원본 오류를 남기지 않고 canonical stage만 기록한다.
- email 확인, 필수 동의와 profile 완료 gate는 server와 DB 계약을 함께 확인한다.
- browser에는 publishable key만 허용한다. secret/service-role key는 server-only다.

## RLS와 소유권

- Data API에 노출되는 table은 grants와 RLS를 함께 적용한다.
- profile, goal, attempt, draft, submission, feedback, recommendation, library, event, export, notification과 quota usage 같은 user-owned row는 `auth.uid()`에 연결된 본인 범위로 제한한다.
- UPDATE는 기존 row 소유 조건과 변경 후 소유 조건을 모두 지켜야 한다. 사용자가 `user_id`, role, status처럼 권한을 바꾸는 필드로 row를 탈취할 수 없어야 한다.
- 공개 콘텐츠 읽기는 publish/review/visibility, 만료와 기관 노출 조건을 함께 만족해야 한다.
- 기관 데이터는 membership/manager predicate와 배정 관계를 통해 제한한다.

## 보호 필드와 privileged code

- 일반 사용자는 profile의 `app_role`, `plan_label`, `affiliation_code`를 임의로 바꿀 수 없고, 일반적인 status 변경도 trigger가 차단한다.
- self-deactivation은 예외다. 최신 trigger는 row owner의 `active → deleted` 직접 UPDATE를 허용하며, 역방향 복구나 `blocked` 등 다른 전이는 허용하지 않는다. 정상 앱 흐름은 idempotent account-deletion RPC를 사용한다.
- `deleted_at`은 현재 protected-column trigger의 비교 대상이 아니다. 따라서 migration SQL은 일반 owner UPDATE에서 이 필드까지 보호한다고 보장하지 않는다. 이 문서가 SQL보다 강한 차단을 선언해서는 안 되며, 향후 보강 시 migration과 관련 test가 필요하다.
- 사용자 입력 metadata를 권한 근거로 사용하지 않는다. 권한은 DB row, trusted app metadata 또는 server 검증에서 가져온다.
- `SECURITY DEFINER` function은 RLS 우회가 필요한 최소 작업에만 사용하고, 함수 내부에서 auth·소유권을 다시 확인하며 `search_path`와 execute grant를 제한한다.
- private schema function과 cron은 browser callable API로 간주하지 않는다.
- admin RPC와 audit 구조가 migration에 남아 있어도 v13 user app은 admin UI나 운영 권한을 소유하지 않는다.
- canonical 쓰기 RPC는 학습자에게 제목·지문·자료와 버전 식별자처럼 허용된 필드만 반환한다. 정답·모범답안·rubric·scoring·raw payload는 browser 응답과 learner-safe snapshot에 포함하지 않는다.
- `private.problem_identities`와 submission intent/outbox, reconciliation·evidence RPC는 browser가 직접 읽거나 조작하는 표면이 아니다. authenticated 사용자는 owner 검증을 거친 공개 RPC만 호출하고, 상태 전환·운영 대사는 service role에 한정한다.
- snapshot CHECK가 호출하는 금지-key 판별 helper는 immutable하고 table을 읽지 않는 순수 함수다. `authenticated`와 `service_role`에 실행 권한을 주되 `anon`과 `PUBLIC`에는 주지 않는다.

## 계정·알림·정리

- 탈퇴 요청은 사용자 접근을 막는 soft delete와 30일 복구 유예를 기본으로 한다.
- 미인증 계정 cleanup은 확인 상태와 retention floor를 검사하고 private/cron 경계에서 실행한다.
- 사용자 알림 읽음 상태와 설정은 본인이 소유한다. dispatch, email transport, retry와 admin 대상 생성은 private/server 운영 경계다.
- marketing 전달은 저장된 consent가 있는 경우에만 가능하며, provider가 준비되지 않은 상태를 성공 발송으로 기록하지 않는다.

## 현재 Storage 권한

| Bucket | 공개성·읽기 | authenticated write |
| --- | --- | --- |
| `avatars` | public bucket, anon/authenticated SELECT는 bucket 조건만 검사 | 자기 `{user_id}/...` 경로 INSERT/UPDATE는 email 확인 필요, DELETE는 자기 경로 조건 |
| `problem-assets` | public bucket, anon/authenticated SELECT는 bucket 조건만 검사 | `private.is_admin(auth.uid())`인 authenticated 사용자만 write |
| `generated-exports` | private bucket, authenticated 본인의 `exports/{user_id}/...` 경로만 SELECT | email-confirmed 사용자의 자기 경로 직접 INSERT와 자기 경로 DELETE 허용, UPDATE policy 없음 |

public bucket과 SELECT policy는 콘텐츠 table의 publish/visibility RLS를 자동으로 상속하지 않는다. 앱의 정상 export 생성은 server 경로지만 위 표는 현재 SQL이 실제 허용하는 범위를 기록한다. bucket, path와 policy의 최종 정본은 Storage migration이다.

## 변경 검토 체크리스트

- [ ] Data API grant와 RLS가 함께 정의됐는가?
- [ ] anon/authenticated/service-role 권한이 필요한 최소 범위인가?
- [ ] owner 조건과 `WITH CHECK`가 변경 후 row 탈취를 막는가?
- [ ] RPC 재시도와 동시 요청이 중복 데이터를 만들지 않는가?
- [ ] Storage path와 bucket 정책이 DB 소유권과 일치하는가?
- [ ] protected field와 secret이 browser에 노출되지 않는가?
- [ ] local replay와 관련 auth/RLS integration test가 통과했는가?
