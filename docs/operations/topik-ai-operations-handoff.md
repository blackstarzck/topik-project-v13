# topik-ai 운영 작업 handoff

| 항목 | 값 |
| --- | --- |
| 상태 | 실행 대기 handoff |
| 인계자 | TALKPIK AI v13 클라이언트 운영 |
| 인수 owner | topik-ai 운영 |
| 대상 | `topik-dev`, `topik-prod`, 운영 백업 보관소 |
| 마지막 검토 | 2026-07-18 |
| 완료 판정 | topik-ai의 migration·자동화·복원 훈련 증거와 v13 acceptance가 모두 존재할 때 |

## 1. 목적과 현재 판단

v13은 사용자 입력을 로컬에 임시 보존하고, 원격 장애나 복구 중에는 쓰기를 안전하게 막으며, 복구 후 읽기 전용 확인을 수행한다. 원격 데이터베이스의 백업·복원·권한·관리자 projection은 v13이 소유하지 않는다. 이 문서는 남은 운영 작업을 topik-ai에서 실행 가능한 작업 묶음으로 인계한다.

현재 v13 테스트 통과는 다음 항목의 완료 증거가 아니다.

- `topik-prod` 백업 자동화와 외부 보관
- Storage 실제 객체의 별도 백업
- 운영 복원 훈련과 측정된 RTO
- 화면에 표시한 약관과 DB에 기록한 동의가 같은 transaction에서 일치한다는 보장
- 새 환경에서도 재현되는 Data API grant·RLS·RPC 실행 권한

## 2. 대상과 절대 경계

| 논리 환경 | Supabase project ref | 용도 |
| --- | --- | --- |
| `topik-dev` | `fglggyfvzjdsbyckinqa` | migration·권한·복원 acceptance 선행 검증 |
| `topik-prod` | `eymlabowhfgtxbiqwxqh` | 운영 사용자 데이터와 배포 서비스 |

project ref는 대상 식별자일 뿐 권한 증명이 아니다. 실제 URL에서 추출한 ref, 실행 프로필, 명시적 승인 대상이 모두 일치하지 않으면 작업을 중단한다.

- migration, backup, restore, retention, credential, 감사 증거는 topik-ai가 소유한다.
- v13 저장소나 Vercel Preview에서 원격 SQL, restore, 운영 데이터 정리를 실행하지 않는다.
- `service_role`, secret key, database password, Management API token, 연결 문자열을 source·문서·로그·PR·스크린샷에 기록하지 않는다.
- 운영 변경은 dashboard 수동 변경으로 끝내지 않는다. 승인된 긴급 조치도 동일 내용을 forward migration 또는 운영 코드로 사후 고정한다.
- production restore, 사용자 데이터 삭제, Git history rewrite는 별도 변경 승인과 사고 절차 없이는 실행하지 않는다.

## 3. 작업 묶음과 권장 순서

| 순서 | 작업 묶음 | 우선순위 | 다음 단계 진입 조건 |
| --- | --- | --- | --- |
| 1 | 노출 가능 credential 폐기·재발급 | P0 | 관련 session·credential이 무효화되고 소유자가 증거를 보관함 |
| 2 | 백업 자동화·외부 보관·감시 | P0 | 새 backup과 검증 가능한 manifest가 자동 생성됨 |
| 3 | 약관 projection·동의 RPC·권한 migration | P0 | dev role별 계약 테스트와 advisor가 통과함 |
| 4 | production 적용과 v13 읽기 acceptance | P0 | 적용 직전 backup 확인, migration 적용, 읽기 전용 smoke 통과 |
| 5 | 격리 복원 훈련과 운영 기준 확정 | P1 | 실제 RPO/RTO·누락 자산·runbook 수정이 기록됨 |

각 작업은 topik-ai 저장소에서 별도 issue와 의미 있는 branch/worktree로 수행한다. 서로 다른 작업을 한 migration이나 한 승인에 묶지 않는다.

## 4. P0-A: 노출 가능 credential 대응

v13 과거 이력의 삭제된 `.scratch/student-state.json`에 인증 상태가 포함됐을 가능성이 있다. 현재 worktree에서 파일을 삭제하는 것만으로 기존 session이나 credential은 폐기되지 않는다.

### 실행

1. 실제 값을 문서나 터미널에 출력하지 않고 어떤 계정·session·key 계열인지 운영 owner가 식별한다.
2. 관련 Auth session을 revoke하고, 재사용 가능성이 있는 key·token·password를 rotate한다.
3. Vercel과 topik-ai secret store의 사용처를 새 값으로 교체하고 정상 동작을 확인한다.
4. 저장소 공개 범위와 복제 상태를 바탕으로 Git history purge 필요성을 결정한다.
5. purge가 필요하면 배포 중단·협업자 재동기화·force push 영향을 별도 승인 문서로 처리한다.

### 완료 증거

- 폐기·재발급 시각과 담당자, 영향 범위가 있는 비밀 없는 사고 기록
- 이전 credential이 더 이상 인증되지 않는다는 운영 확인
- 새 credential 사용처 목록과 다음 rotation 예정일
- history purge 시행 또는 미시행 결정과 근거

## 5. P0-B: 자동 백업과 외부 보관

Supabase 유료 플랜은 일일 DB 백업을 제공하지만 Free 프로젝트는 정기적인 논리 dump와 외부 보관이 필요하다. 플랜 상태는 변경될 수 있으므로 자동화 시작 시 dashboard/API로 다시 확인한다. Supabase DB 백업에는 Storage API의 실제 객체가 포함되지 않고 metadata만 포함되므로 DB와 Storage를 별도로 보호한다.

### 초기 운영 목표

| 항목 | `topik-prod` | `topik-dev` |
| --- | --- | --- |
| DB RPO | 최대 24시간 | 최대 7일 |
| 목표 RTO | 4시간 이내를 초기 목표로 두고 첫 drill 실측으로 보정 | 업무일 1일 이내 |
| 자동 실행 | 매일 02:00 KST | 매주 일요일 03:00 KST |
| 보존 | 일간 14개, 주간 8개, 월간 12개 | 최근 4개 |
| 위험 migration 전 | 즉시 on-demand backup과 검증 필수 | 필요 시 실행 |

RPO 24시간이 제품·법무·결제 요구에 부족하면 `topik-prod`를 유료 플랜과 PITR 대상으로 전환한다. PITR을 사용하더라도 Storage 객체와 설정 백업은 별도 유지한다.

### 자동화 구조

1. topik-ai CI 또는 전용 운영 runner가 고정된 Supabase CLI 버전으로 실행한다.
2. 실행 전에 allowlist project ref, 환경 이름, read-only backup mode를 확인한다.
3. DB roles, schema, data를 분리된 논리 backup으로 생성한다. 사용 중인 CLI 버전의 `supabase db dump --help`로 옵션을 확인하고 공식 방식에 맞춘다.
4. 각 산출물의 SHA-256, 크기, 생성 시각, source ref, migration head, 도구 버전을 secret 없는 manifest에 기록한다.
5. Storage bucket 목록과 실제 객체를 별도 export하고 object count·총 크기·표본 checksum을 manifest에 기록한다.
6. 클라우드 계정이 분리된 off-site 저장소에 전송 중·보관 중 암호화하여 저장한다. production DB와 같은 계정의 단일 bucket만 사용하지 않는다.
7. 업로드 및 checksum 재검증이 끝난 뒤에만 성공으로 기록하고 retention을 집행한다.
8. 26시간 안에 새로운 production 성공 manifest가 없거나 checksum·업로드·Storage export 중 하나라도 실패하면 운영 채널에 경보한다.

### 자동화 실패 원칙

- 부분 성공을 전체 성공으로 기록하지 않는다.
- 실패한 backup을 자동 삭제하거나 동일 이름으로 덮어쓰지 않는다.
- 로그에는 단계, 대상의 논리 이름, 시작·종료 시각, 비식별 오류 코드만 남긴다.
- credential 오류는 값을 재출력하지 않고 작업을 중단하고 rotation 절차로 넘긴다.

### 완료 증거

- topik-ai 저장소의 workflow·script와 pinned tool version
- 최근 production 성공 manifest와 DB·Storage 산출물의 외부 보관 확인
- 의도적으로 실패시킨 canary에서 경보가 전달된 기록
- retention dry-run과 실제 삭제 대상 검토 기록
- 운영 dashboard에 최근 성공 시각, 다음 실행, 연속 실패 수가 표시되거나 동일 수준으로 조회 가능함

## 6. P0-C: 약관 projection과 동의 원자성

v13 source에는 `20260718120000_auth_gate_exact_consent_snapshots.sql`과 그 typed caller가 준비되어 있다. action의 사전 비교에 더해 새 RPC가 화면에 표시된 정확한 문서를 입력으로 받고 같은 transaction 안에서 공식 문서 집합 lock·검증·동의 기록·프로필 완료를 처리한다. 다만 v13은 원격 DB에 migration을 적용하지 않으므로 topik-ai가 dev·production 적용과 evidence를 완료하기 전에는 운영 원자성이 확보됐다고 선언하지 않는다.

### 관리자 projection 계약

- topik-ai의 `operation_policies`와 version history가 정본이며 `legal_documents`는 사용자 앱용 projection이다.
- 공식 동기화 RPC는 `doc_type`, locale, version, title, body, effective time, consent 필요 여부와 비어 있지 않은 source policy/history 식별자를 검증한다.
- placeholder, 빈 source 식별자, 같은 문서 종류·locale의 동률 최신 버전은 published 대상이 될 수 없다.
- 관리자는 `legal_documents`를 직접 INSERT/UPDATE하지 않고 승인된 projection RPC만 호출한다.
- 동기화는 idempotent해야 하며 동일 source history를 재처리해 중복 행을 만들지 않는다.

### 동의 RPC 계약

- topik-ai는 v13 `20260718120000`의 snapshot-aware `complete_auth_gate` 계약을 검토·적용하고 최종 profile 입력과 함께 화면에 표시한 consent document `{id, version}` 배열을 받는 signature를 운영 정본에 반영한다.
- 한 transaction 안에서 `auth.uid()`와 profile owner를 확인하고, 전달된 ID가 해당 사용자의 locale fallback 규칙으로 결정되는 현재의 비-placeholder·trusted·published·required 문서 집합과 정확히 같은지 확인한다.
- 누락, 추가, 중복, locale 불일치, 최신 시각 동률, projection 변경이 있으면 어떤 profile 변경이나 consent 기록도 남기지 않고 안정적인 canonical 오류 코드로 실패한다.
- 성공 시 profile 완료와 `user_consents` append-only 기록이 함께 commit된다. 재시도는 동일 사용자의 동일 문서에 중복 consent를 만들지 않는다.
- `SECURITY DEFINER`가 필요하면 고정 `search_path`, 함수 내부 사용자 검증, 최소 owner, 명시적인 `REVOKE`/`GRANT EXECUTE`를 함께 적용한다.
- 최종 함수명·인자·반환 shape는 v13 migration과 파생 타입에 고정되어 있다. topik-ai는 적용 version/hash, role별 EXECUTE와 stale rollback 결과를 typed handback evidence로 제공하고, v13은 그 handback 확인 전까지 사전검사와 fail-close를 유지한다.

## 7. P0-D: Data API grant·RLS·RPC 권한 migration

Data API object 접근을 결정하는 grant와 행 접근을 결정하는 RLS는 별도 계층이다. Supabase의 자동 grant 기본값이 변경 중이므로 현재 환경에서 우연히 동작하는 권한에 의존하지 않는다.

forward migration은 최소한 다음 계약을 명시하고 dev에서 role별로 검증한다.

| 객체 | `anon` | `authenticated` | 관리자/서버 |
| --- | --- | --- | --- |
| `legal_documents` | published trusted 문서 SELECT | published trusted 문서 SELECT | projection RPC를 통한 쓰기 |
| `user_consents` | 모든 접근 REVOKE | 본인 SELECT; 쓰기 방식은 승인된 동의 RPC로 제한 | 감사·복구 절차에 필요한 최소 권한 |
| 관리자 projection RPC | EXECUTE REVOKE | 일반 사용자 EXECUTE REVOKE | 승인된 서버 role만 EXECUTE |
| 원자적 동의 RPC | EXECUTE REVOKE | 본인 흐름 EXECUTE | 운영 점검에 필요한 최소 권한 |

`user_consents`에 authenticated 직접 INSERT를 유지해야 하는 다른 소비자가 있다면, topik-ai가 소비자와 위협 모델을 문서화하고 임의 document ID를 기록할 수 없도록 DB 검증을 추가해야 한다. 해당 근거가 없으면 RPC-only write를 기본으로 한다.

### 권한 검증

- `anon`: 공식 published 문서는 읽지만 draft·placeholder·consent ledger는 읽거나 쓰지 못한다.
- 사용자 A: 자신의 consent만 읽고 사용자 B의 consent는 읽거나 쓰지 못한다.
- 일반 authenticated 사용자: projection RPC와 관리자 함수 실행이 거부된다.
- 동의 RPC: 정확한 문서 집합은 성공하고 stale·누락·추가·중복 집합은 전부 rollback된다.
- 함수의 `PUBLIC` 기본 EXECUTE와 불필요한 `anon`·`authenticated` 권한이 회수됐는지 catalog query로 확인한다.
- Supabase database/security advisor 결과를 검토하고 새 경고를 해결하거나 승인 근거를 기록한다.

## 8. dev → production 적용 절차

1. topik-ai의 격리 branch/worktree에서 migration과 계약 테스트를 작성한다.
2. 완전히 초기화한 로컬 Supabase에 timestamp 순으로 migration을 재생한다.
3. `topik-dev` 대상 ref와 승인 범위를 확인한 뒤 migration을 적용한다.
4. anon·사용자 A·사용자 B·관리자 role acceptance와 동시 요청·재시도 테스트를 실행한다.
5. topik-ai 관리자 화면에서 terms/privacy를 동기화하고 v13 dev가 공식 문서를 읽으며 가입 완료가 정확한 ID로 기록되는지 확인한다.
6. PR 검토와 필수 검사를 통과시킨다. 검토자는 SQL owner, grants/RLS, rollback 가능성, secret 출력을 확인한다.
7. production 변경 창을 선언하고 최신 성공 backup과 Storage export, checksum을 확인한다.
8. `topik-prod` ref를 다시 확인하고 forward migration을 적용한다. destructive down migration은 자동 실행하지 않는다.
9. 운영 terms/privacy projection을 동기화하고 read-only 및 지정된 합성 계정 smoke test를 수행한다.
10. 오류율과 가입 완료 지표를 관찰한 뒤 변경 창을 종료한다. 이상 시 신규 가입 완료를 fail-close하고 운영 owner가 forward fix 또는 restore 여부를 결정한다.

production 사용자 데이터로 임의 가입·동의·삭제 테스트를 하지 않는다. 합성 계정 사용과 정리는 사전 승인된 운영 절차로 제한한다.

## 9. P1: 격리 복원 훈련

최소 분기 1회, 위험한 schema 전환 전에는 별도로 수행한다.

1. source production을 직접 덮어쓰지 않고 새 격리 Supabase 프로젝트 또는 승인된 격리 환경에 복원한다.
2. 복원 직후 `pg_cron`, `pg_net`, webhook, Edge Function, email, 외부 결제·알림 경로를 비활성화해 실제 사용자나 외부 시스템으로 동작이 나가지 않게 한다.
3. DB schema·migration head·Auth 사용자 수·핵심 table row count·RLS·RPC·index·extension을 manifest와 비교한다.
4. Storage bucket 설정과 실제 객체를 별도로 복원하고 object count·표본 checksum을 확인한다.
5. topik-ai 관리자 읽기와 v13 읽기 전용 acceptance를 수행한다. create/update/delete/submission은 격리된 합성 데이터로만 확인한다.
6. backup 기준 시각부터 복원된 최종 시각까지의 RPO, 복원 시작부터 acceptance 완료까지의 RTO를 측정한다.
7. 누락된 설정, 수동 단계, 실패 원인, runbook 수정 사항을 기록한다.
8. 격리 프로젝트 삭제는 증거 보존과 owner 승인이 끝난 뒤 수행한다.

Supabase의 “새 프로젝트로 복원”은 DB·Auth data를 복제하지만 Storage 객체, Auth provider 설정, API key, Edge Function 등은 별도 구성이 필요하다. 외부 동작을 수행하는 extension도 복원 후 먼저 비활성화해야 한다.

## 10. v13으로 돌려줄 handback package

topik-ai는 다음을 secret 없이 v13 담당자에게 전달한다.

- topik-ai PR/commit과 migration 파일 경로
- dev/prod 적용된 migration version 또는 hash와 적용 시각
- 최종 동의 RPC 함수명, 정확한 인자·반환 shape, canonical 오류 코드
- terms/privacy projection source와 현재 published document ID·version·locale 목록
- table grant, RLS, function EXECUTE의 role별 검증 결과
- backup 자동화 최근 성공 시각과 restore drill 결과 요약
- v13이 브라우저에서 확인할 base URL, 합성 계정 사용 절차, 허용된 read/write 범위
- rollback 또는 fail-close 결정권자와 운영 연락 경로

v13은 handback을 받은 뒤 typed client를 갱신하고 로컬 통합 테스트, Playwright CLI E2E, 현재 worktree runtime의 desktop/mobile 브라우저 검증을 다시 수행한다. production에서는 승인된 합성 계정 외의 쓰기를 하지 않는다.

## 11. 완료 판정표

| 완료 조건 | 필수 증거 | owner |
| --- | --- | --- |
| 노출 가능 credential 대응 | revoke/rotate 기록과 이전 credential 무효 확인 | topik-ai 운영 |
| production backup 자동화 | 최근 성공 manifest, checksum, off-site 존재 확인, 실패 경보 canary | topik-ai 운영 |
| Storage 보호 | bucket/object export와 별도 복원 표본 결과 | topik-ai 운영 |
| 약관 원자성 | stale 문서 경쟁 테스트와 transaction rollback 증거 | topik-ai DB |
| Data API 보안 | role별 grants·RLS·EXECUTE 검증과 advisor 결과 | topik-ai DB |
| production 적용 | 적용 전 backup, migration version, smoke와 관찰 결과 | topik-ai 운영 |
| 복원 가능성 | 격리 drill의 실측 RPO/RTO와 수정된 runbook | topik-ai 운영 |
| 클라이언트 수용 | local E2E와 desktop/mobile runtime 결과 | v13 |

한 항목이라도 증거가 없으면 해당 항목은 완료가 아니라 미확인이다. backup 파일이 존재하는 것만으로 복원 가능성을 입증하지 않으며, v13 테스트 통과만으로 DB 권한과 운영 자동화를 입증하지 않는다.

## 12. 에이전트 작업 지침

- 시작 전에 topik-ai의 `AGENTS.md`, 데이터 owner, migration 정본과 현재 Git 상태를 읽는다.
- 한 작업은 한 branch와 한 worktree로 격리하며 dev 검증 없이 production으로 이동하지 않는다.
- migration 파일이 SOT다. dashboard에서 먼저 실험했다면 검증된 결과를 forward migration으로 재작성한다.
- target ref와 환경 이름을 코드로 fail-close 검증하고 production mutation은 별도 명시 승인을 요구한다.
- secret은 존재 여부와 logical name만 다루며 값을 읽거나 출력해 검증하지 않는다.
- backup·restore script는 dry-run, checksum, idempotency, 부분 실패와 재개 동작을 테스트한다.
- destructive SQL, restore, retention 삭제, credential revoke, history rewrite를 일반 코드 수정과 같은 승인으로 묶지 않는다.
- 운영 결과에는 명령 원문 전체나 raw provider/DB 오류 대신 단계, 성공·실패, 비식별 오류 코드와 evidence 위치만 남긴다.
- 실패를 만났을 때 production에서 반복 실행하지 않는다. 읽기 전용 진단 후 owner에게 중단 상태와 안전한 다음 행동을 보고한다.

## 13. 공식 참고자료

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Restore to a new project](https://supabase.com/docs/guides/platform/clone-project)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Supabase database changelog](https://supabase.com/changelog?tags=database)
