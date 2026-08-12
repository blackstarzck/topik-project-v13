# 시스템 리포팅 DB 적용 handoff

| 항목 | 값 |
| --- | --- |
| 상태 | 실행 대기 handoff |
| 인계자 | TALKPIK AI v13 클라이언트 |
| 인수 owner | topik-ai DB·운영 |
| 대상 | `topik-dev`, 검증 후 `topik-prod` |
| 마지막 검토 | 2026-07-23 |
| 완료 판정 | dev·production 적용과 role별 권한 증거를 v13이 확인하고 앱 배포 검증을 마쳤을 때 |

## 1. 목적과 경계

v13에는 랜딩을 제외한 모든 렌더링 화면에서 익명·로그인 사용자가 버그·문의·제안을 보내는 UI와 server API가 준비되어 있다. DB 정본인 `supabase/migrations/20260723170000_system_reports.sql`과 파생 타입 `src/lib/supabase/types.ts`도 준비되어 있으나, v13 작업면에서는 원격 DB에 적용하지 않는다.

topik-ai는 migration의 dev 검증, production 적용, 권한 확인, 수동 보관·삭제 운영을 소유한다. 적용과 handback이 끝나기 전에 v13 앱을 배포하면 저장 요청은 일반적인 `잠시 후 다시 시도` 오류로 실패하며, v13은 사용자의 입력값을 유지한다.

## 2. 적용할 계약

### 데이터와 권한

- `private.system_reports`는 내부 UUID, 비식별 무작위 접수번호, 고유 idempotency key, 선택적 Auth 사용자 ID, 유형·이메일·제목·내용, 허용된 진단 정보, 앱 버전, 생성 시각만 저장한다.
- table은 RLS를 enable·force하고 `PUBLIC`, `anon`, `authenticated`, `service_role`의 직접 권한을 모두 회수한다.
- `public.submit_system_report`는 고정 `search_path`의 `SECURITY DEFINER` RPC이며 `PUBLIC`, `anon`, `authenticated` 실행은 거부하고 `service_role`만 실행한다.
- 동일 idempotency key의 동시·반복 요청은 기존 접수번호와 생성 시각을 반환하고 새 행을 만들지 않는다.
- 앱 server가 쿠키 session을 검증해 확인한 사용자 ID만 전달한다. browser가 사용자 ID를 정하거나 RPC를 직접 호출하지 않는다.

### 수집과 보관

허용된 자동 진단 정보는 query·hash 없는 pathname, 브라우저·OS·기기 유형의 대분류, viewport 크기, locale, server가 정한 앱 버전뿐이다. IP·referrer·원본 User-Agent·query·hash는 수집하거나 파생 저장하지 않는다.

이번 계약에는 rate limit, CAPTCHA, 외부 알림, 첨부 파일, 관리자 처리 화면, 자동 삭제 작업을 추가하지 않는다. 리포트는 별도 보관 기한 없이 무기한 수동 보관하며, topik-ai 운영 owner가 승인된 운영 절차와 감사 기록 아래 필요할 때만 수동 삭제한다.

## 3. 적용 순서

순서는 `topik-dev 검증 → topik-prod 적용 → v13 handback → v13 앱 배포`로 고정한다.

1. topik-ai의 격리 branch/worktree에서 대상 migration과 checksum, 현재 migration head를 확인한다. SQL을 dashboard에서 임의로 재작성하지 않는다.
2. 완전히 초기화한 로컬 Supabase에 timestamp 순으로 replay하고 migration·RLS·RPC 계약 테스트를 통과시킨다.
3. `topik-dev` project ref와 승인 범위를 확인한 뒤 migration을 적용한다.
4. dev에서 schema·constraint·RLS·grant·function owner와 role별 권한을 검증하고, 승인된 합성 요청으로 익명·로그인·중복 접수를 확인한 뒤 test row를 운영 절차에 따라 정리한다.
5. topik-ai PR 검토와 필수 검사를 통과하고 `topik-prod` 적용 직전 최신 backup과 대상 ref를 다시 확인한다.
6. production 변경 창에서 동일 migration을 적용한다. destructive down migration이나 기존 데이터 삭제는 실행하지 않는다.
7. production에서는 catalog 기반 권한 확인과 승인된 합성 계정의 최소 smoke만 수행하고, 실제 사용자 정보나 임의 접수 내용을 만들지 않는다.
8. 아래 handback package를 v13에 전달한다. v13이 증거를 확인하고 API·Playwright 검증을 마친 뒤에만 v13 앱 배포를 진행한다.

## 4. dev 권한·동작 검증

raw secret이나 연결 문자열을 출력하지 않고 다음 결과를 비식별 증거로 남긴다.

| 검증 주체 | 기대 결과 |
| --- | --- |
| `PUBLIC` | table 직접 접근과 RPC 실행 거부 |
| `anon` | table 직접 접근과 RPC 실행 거부 |
| `authenticated` 사용자 A·B | 자기·타인 행 모두 직접 접근 거부, RPC 직접 실행 거부 |
| `service_role` | table 직접 접근 권한 없이 `submit_system_report` RPC 실행 가능 |
| v13 server API | 익명 접수는 사용자 ID 없이 저장, 로그인 접수는 쿠키 session의 사용자 ID만 연결 |
| 같은 `Idempotency-Key` 재시도 | 첫 요청만 생성되고 이후 요청은 같은 접수번호·시각 반환 |

추가로 다음을 확인한다.

- `private.system_reports`의 RLS가 enabled·forced이고 공개 policy가 없다.
- `submit_system_report` owner는 Supabase CLI migration 실행 관례의 신뢰된 `postgres`이고, `SECURITY DEFINER`, 정확히 `pg_catalog, private`인 `search_path`, signature와 role별 EXECUTE가 migration과 일치한다. owner가 다르면 임의로 신뢰하지 말고 적용을 중단한다.
- 접수번호가 `SR-` 뒤 무작위 코드이며 사용자 ID·이메일·생성 시각에서 만들어지지 않는다.
- 허용된 field 외에 IP·referrer·원본 User-Agent·query·hash column, trigger, log가 없다.
- 입력 길이·유형·locale·진단 대분류 CHECK와 idempotency unique constraint가 실제로 거부·수렴 동작을 보인다.

### 4.1 복사 실행용 catalog 검증

DB 연결 정보는 secret store가 관리하는 `pg_service.conf`의 논리 profile로만 제공한다. 다음 블록은 raw connection string을 command line이나 출력에 남기지 않는다. 먼저 `topik-dev`에서 실행하고 모든 `*_ok` 열이 `t`인지 확인한다.

```bash
set -euo pipefail
mkdir -p .codex/work/system-reporting
cat > .codex/work/system-reporting/system-report-catalog.sql <<'SQL'
with private_schema as (
  select n.oid, n.nspacl
  from pg_catalog.pg_namespace n
  where n.nspname = 'private'
),
target_table as (
  select c.oid, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity
  from pg_catalog.pg_class c
  where c.oid = 'private.system_reports'::regclass
    and c.relkind = 'r'
),
table_acl as (
  select acl.grantee, acl.privilege_type
  from target_table t
  cross join lateral pg_catalog.aclexplode(
    coalesce(t.relacl, pg_catalog.acldefault('r', t.relowner))
  ) acl
),
target_function as (
  select p.oid, p.proowner, p.prosecdef, p.proconfig, p.proacl
  from pg_catalog.pg_proc p
  where p.oid =
    'public.submit_system_report(uuid,uuid,text,text,text,text,text,text,text,text,integer,integer,text,text)'::regprocedure
),
function_acl as (
  select acl.grantee, acl.privilege_type
  from target_function f
  cross join lateral pg_catalog.aclexplode(
    coalesce(f.proacl, pg_catalog.acldefault('f', f.proowner))
  ) acl
)
select
  not exists (
    select 1
    from private_schema s
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        s.nspacl,
        pg_catalog.acldefault(
          'n',
          (select nspowner from pg_catalog.pg_namespace where oid = s.oid)
        )
      )
    ) acl
    where acl.grantee = 0 and acl.privilege_type = 'USAGE'
  ) as schema_public_usage_ok,
  not pg_catalog.has_schema_privilege('anon', 'private', 'USAGE')
    as schema_anon_usage_ok,
  pg_catalog.has_schema_privilege('authenticated', 'private', 'USAGE')
    as schema_authenticated_usage_ok,
  not pg_catalog.has_schema_privilege('service_role', 'private', 'USAGE')
    as schema_service_role_usage_ok,
  t.relrowsecurity as table_rls_enabled_ok,
  t.relforcerowsecurity as table_rls_forced_ok,
  not exists (
    select 1
    from pg_catalog.pg_policy pol
    where pol.polrelid = t.oid
  ) as table_policy_empty_ok,
  not exists (
    select 1
    from table_acl acl
    where acl.grantee = 0
       or pg_catalog.pg_get_userbyid(acl.grantee) in (
         'anon',
         'authenticated',
         'service_role'
       )
  ) as table_direct_acl_ok,
  pg_catalog.pg_get_userbyid(t.relowner) as table_owner,
  pg_catalog.pg_get_userbyid(t.relowner) = 'postgres' as table_owner_ok,
  pg_catalog.pg_get_userbyid(f.proowner) as function_owner,
  pg_catalog.pg_get_userbyid(f.proowner) = 'postgres' as function_owner_ok,
  f.prosecdef as function_security_definer_ok,
  f.proconfig as function_config,
  f.proconfig = array['search_path=pg_catalog, private']::text[]
    as function_search_path_ok,
  exists (
    select 1
    from function_acl acl
    where acl.privilege_type = 'EXECUTE'
      and pg_catalog.pg_get_userbyid(acl.grantee) = 'postgres'
  ) and exists (
    select 1
    from function_acl acl
    where acl.privilege_type = 'EXECUTE'
      and pg_catalog.pg_get_userbyid(acl.grantee) = 'service_role'
  ) as function_acl_ok,
  not exists (
    select 1
    from function_acl acl
    where acl.privilege_type = 'EXECUTE'
      and (
        acl.grantee = 0
        or pg_catalog.pg_get_userbyid(acl.grantee)
          not in ('postgres', 'service_role')
      )
  ) as function_execute_allowlist_ok
from target_table t
cross join target_function f;
SQL

PGSERVICE=topik-dev psql --no-psqlrc --set=ON_ERROR_STOP=1 \
  --file .codex/work/system-reporting/system-report-catalog.sql \
  | tee .codex/work/system-reporting/catalog-topik-dev.txt
```

`private` schema의 `authenticated USAGE`는 기존 공용 helper를 위한 저장소 기준 계약이다. 이 리포트 table에는 어떤 직접 권한도 없으므로 schema 사용 가능 여부만으로 행에 접근할 수 없다. `PUBLIC`·`anon`·`service_role`의 schema `USAGE`는 없어야 한다.

합격 기준은 결과가 정확히 한 행이고 모든 `*_ok` 열이 `t`인 것이다. 한 열이라도 `f`이거나 결과 행이 없으면 migration 적용·앱 배포를 중단한다. `table_owner`와 `function_owner`는 모두 `postgres`여야 한다. 함수 EXECUTE grantee는 trusted owner인 `postgres`와 `service_role`만 정확히 존재해야 하며 `PUBLIC`, `anon`, `authenticated`나 나중에 추가된 임의 role이 하나라도 있으면 `function_execute_allowlist_ok = f`로 실패한다. `search_path=pg_catalog, private` 외의 값도 허용하지 않는다.

production migration 적용 뒤에는 같은 SQL을 profile만 바꿔 다시 실행한다.

```bash
set -euo pipefail
PGSERVICE=topik-prod psql --no-psqlrc --set=ON_ERROR_STOP=1 \
  < .codex/work/system-reporting/system-report-catalog.sql \
  | tee .codex/work/system-reporting/catalog-topik-prod.txt
```

위 production 명령을 사용하려면 dev에서 실행한 SQL 본문을 비밀 없는 `.codex/work/system-reporting/system-report-catalog.sql`로 먼저 저장한다. 두 환경의 출력은 값 전체를 그대로 외부에 게시하지 않고 논리 환경, 실행 시각, migration version과 `*_ok = t` 요약만 handback에 연결한다.

### 4.2 단일 failure-safe API acceptance

다음 단일 shell script는 `topik-dev` migration 적용 뒤 허용된 v13 dev runtime에서만 실행한다. `SUPABASE_DEV_URL`, publishable key, 합성 사용자의 access token·cookie jar·user ID는 topik-ai의 승인된 secret/test-data 준비 절차가 주입하며 값을 출력하지 않는다. `SYNTHETIC_SESSION_COOKIE_FILE`에는 v13 dev origin용 cookie만 있어야 한다.

세 idempotency key는 어떤 네트워크 요청보다 먼저 만든다. `EXIT` trap은 direct deny, 익명 접수, 로그인 접수, idempotency 비교, DB 연결 확인 중 어느 단계가 실패해도 같은 key로 합성 행 정리를 시도한다. 정리 뒤 원래 acceptance가 실패했다면 그 exit status를 그대로 돌려주고, acceptance가 성공했지만 정리가 실패했다면 cleanup status로 실패한다.

```bash
set -euo pipefail
mkdir -p .codex/work/system-reporting
work_dir="$(mktemp -d)"
trap 'rm -rf -- "$work_dir"' EXIT

direct_key="$(uuidgen)"
anon_key="$(uuidgen)"
auth_key="$(uuidgen)"

cleanup_acceptance_rows() {
  PGSERVICE=topik-dev psql --no-psqlrc --set=ON_ERROR_STOP=1 \
    --set=direct_key="$direct_key" \
    --set=anon_key="$anon_key" --set=auth_key="$auth_key" <<'SQL' \
    | tee .codex/work/system-reporting/cleanup-topik-dev.txt
begin;
create function pg_temp.cleanup_system_reports(p_keys uuid[])
returns integer
language plpgsql
as $$
declare
  v_expected integer;
  v_deleted integer;
begin
  if exists (
    select 1
    from private.system_reports
    where idempotency_key = any(p_keys)
      and (
        email <> 'system-report-acceptance@example.invalid'
        or title not like 'acceptance:%'
      )
  ) then
    raise exception 'system report acceptance cleanup key collision';
  end if;

  select count(*)
    into v_expected
  from private.system_reports
  where idempotency_key = any(p_keys)
    and email = 'system-report-acceptance@example.invalid'
    and title like 'acceptance:%';

  delete from private.system_reports
  where idempotency_key = any(p_keys)
    and email = 'system-report-acceptance@example.invalid'
    and title like 'acceptance:%';

  get diagnostics v_deleted = row_count;
  if v_deleted <> v_expected then
    raise exception 'system report acceptance cleanup changed during delete';
  end if;

  return v_deleted;
end;
$$;

select pg_temp.cleanup_system_reports(array[
  :'direct_key'::uuid,
  :'anon_key'::uuid,
  :'auth_key'::uuid
]) as deleted_count \gset
select not exists (
  select 1
  from private.system_reports
  where idempotency_key in (
    :'direct_key'::uuid,
    :'anon_key'::uuid,
    :'auth_key'::uuid
  )
) as cleanup_ok \gset
select :'deleted_count'::integer as deleted_count,
       :'cleanup_ok'::boolean as cleanup_ok;
\if :cleanup_ok
\else
  \quit 1
\endif
commit;
SQL
}

finalize_acceptance() {
  acceptance_status=$?
  trap - EXIT
  set +e
  cleanup_acceptance_rows
  cleanup_status=$?
  rm -rf -- "$work_dir"

  if [ "$acceptance_status" -ne 0 ]; then
    exit "$acceptance_status"
  fi
  exit "$cleanup_status"
}
trap finalize_acceptance EXIT

assert_denied() {
  case "$1" in
    401|403|404|406) return 0 ;;
    *) echo "unexpected direct-access status: $1" >&2; return 1 ;;
  esac
}

run_acceptance() {
  rpc_body="$(printf '{"p_idempotency_key":"%s","p_user_id":null,"p_category":"bug","p_email":"system-report-acceptance@example.invalid","p_title":"acceptance:direct-deny","p_message":"direct calls must fail","p_pathname":"/acceptance","p_browser":"other","p_os":"other","p_device_type":"unknown","p_viewport_width":0,"p_viewport_height":0,"p_locale":"ko","p_app_version":null}' "$direct_key")"

  anon_table_status="$(curl --silent --show-error --output "$work_dir/anon-table.json" --write-out '%{http_code}' \
    "$SUPABASE_DEV_URL/rest/v1/system_reports?select=id&limit=1" \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
    -H 'Accept-Profile: private')"
  anon_rpc_status="$(curl --silent --show-error --output "$work_dir/anon-rpc.json" --write-out '%{http_code}' \
    "$SUPABASE_DEV_URL/rest/v1/rpc/submit_system_report" \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
    -H 'Content-Type: application/json' \
    --data "$rpc_body")"
  auth_table_status="$(curl --silent --show-error --output "$work_dir/auth-table.json" --write-out '%{http_code}' \
    "$SUPABASE_DEV_URL/rest/v1/system_reports?select=id&limit=1" \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
    -H "Authorization: Bearer $SYNTHETIC_ACCESS_TOKEN" \
    -H 'Accept-Profile: private')"
  auth_rpc_status="$(curl --silent --show-error --output "$work_dir/auth-rpc.json" --write-out '%{http_code}' \
    "$SUPABASE_DEV_URL/rest/v1/rpc/submit_system_report" \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
    -H "Authorization: Bearer $SYNTHETIC_ACCESS_TOKEN" \
    -H 'Content-Type: application/json' \
    --data "$rpc_body")"

  assert_denied "$anon_table_status"
  assert_denied "$anon_rpc_status"
  assert_denied "$auth_table_status"
  assert_denied "$auth_rpc_status"
  printf 'direct_access_ok=true anon_table=%s anon_rpc=%s auth_table=%s auth_rpc=%s\n' \
    "$anon_table_status" "$anon_rpc_status" "$auth_table_status" "$auth_rpc_status" \
    | tee .codex/work/system-reporting/direct-access-topik-dev.txt

  anon_body='{"category":"bug","email":"system-report-acceptance@example.invalid","title":"acceptance:anonymous","message":"anonymous acceptance","context":{"pathname":"/acceptance","browser":"other","os":"other","deviceType":"unknown","viewportWidth":0,"viewportHeight":0,"locale":"ko"}}'
  auth_body='{"category":"question","email":"system-report-acceptance@example.invalid","title":"acceptance:authenticated","message":"authenticated acceptance","context":{"pathname":"/acceptance","browser":"other","os":"other","deviceType":"unknown","viewportWidth":0,"viewportHeight":0,"locale":"ko"}}'

  anon_first_status="$(curl --silent --show-error --output "$work_dir/anon-first.json" --write-out '%{http_code}' \
    "$V13_DEV_ORIGIN/api/system-reports" \
    -H "Origin: $V13_DEV_ORIGIN" -H 'Sec-Fetch-Site: same-origin' \
    -H 'Content-Type: application/json' -H "Idempotency-Key: $anon_key" \
    --data "$anon_body")"
  anon_retry_status="$(curl --silent --show-error --output "$work_dir/anon-retry.json" --write-out '%{http_code}' \
    "$V13_DEV_ORIGIN/api/system-reports" \
    -H "Origin: $V13_DEV_ORIGIN" -H 'Sec-Fetch-Site: same-origin' \
    -H 'Content-Type: application/json' -H "Idempotency-Key: $anon_key" \
    --data "$anon_body")"
  auth_status="$(curl --silent --show-error --output "$work_dir/auth.json" --write-out '%{http_code}' \
    "$V13_DEV_ORIGIN/api/system-reports" \
    -H "Origin: $V13_DEV_ORIGIN" -H 'Sec-Fetch-Site: same-origin' \
    -H 'Content-Type: application/json' -H "Idempotency-Key: $auth_key" \
    --cookie "$SYNTHETIC_SESSION_COOKIE_FILE" \
    --data "$auth_body")"

  test "$anon_first_status" = 201
  test "$anon_retry_status" = 200
  test "$auth_status" = 201
  jq --exit-status --slurp \
    '.[0].referenceCode == .[1].referenceCode and .[0].createdAt == .[1].createdAt' \
    "$work_dir/anon-first.json" "$work_dir/anon-retry.json" >/dev/null
  printf 'server_api_ok=true anonymous_first=%s anonymous_retry=%s authenticated=%s same_receipt=true\n' \
    "$anon_first_status" "$anon_retry_status" "$auth_status" \
    | tee .codex/work/system-reporting/api-acceptance-topik-dev.txt

  PGSERVICE=topik-dev psql --no-psqlrc --set=ON_ERROR_STOP=1 \
    --set=anon_key="$anon_key" --set=auth_key="$auth_key" \
    --set=synthetic_user_id="$SYNTHETIC_USER_ID" <<'SQL' \
    | tee -a .codex/work/system-reporting/api-acceptance-topik-dev.txt
select
  count(*) filter (
    where idempotency_key = :'anon_key'::uuid and user_id is null
  ) = 1 as anonymous_link_ok,
  count(*) filter (
    where idempotency_key = :'auth_key'::uuid
      and user_id = :'synthetic_user_id'::uuid
  ) = 1 as authenticated_link_ok
from private.system_reports
where idempotency_key in (:'anon_key'::uuid, :'auth_key'::uuid)
\gset
select :'anonymous_link_ok'::boolean as anonymous_link_ok,
       :'authenticated_link_ok'::boolean as authenticated_link_ok;
\if :anonymous_link_ok
\else
  \quit 1
\endif
\if :authenticated_link_ok
\else
  \quit 1
\endif
SQL
}

run_acceptance
```

합격 기준은 직접 접근 네 요청이 모두 비-2xx 거부되고, server API 상태가 `201 → 200 → 201`이며 익명 재시도의 `referenceCode`와 `createdAt`이 같고, DB 연결 결과의 두 `*_link_ok`가 모두 `t`인 것이다. 정상 경로의 EXIT cleanup은 `deleted_count = 2`, `cleanup_ok = t`여야 한다. 중간 실패 때 삭제 수는 0~3일 수 있으나 cleanup 자체는 성공해야 하며, 원래 실패 status가 보존돼야 한다.

`cleanup_acceptance_rows`는 세 UUID와 전용 이메일·제목 prefix를 동시에 만족하는 행만 삭제한다. UUID가 다른 내용의 행을 가리키거나 삭제 수가 사전 조회와 다르면 transaction 전체를 rollback한다. cleanup까지 실패하면 더 넓은 `DELETE`, 이메일 기준 일괄 삭제, production 재실행으로 우회하지 말고 세 key와 생성 행을 읽기 전용으로 대조한 뒤 topik-ai 운영 owner에게 넘긴다.

## 5. v13 handback package

topik-ai는 secret과 실제 사용자 데이터를 제외하고 다음 증거를 전달한다.

- topik-ai PR/commit, 적용한 `20260723170000_system_reports.sql`의 경로·version·checksum
- dev·production의 적용 시각, 적용 전후 migration head와 논리 환경 이름
- `private.system_reports`의 owner, RLS enabled/forced, policy 목록과 role별 table privilege 결과
- `submit_system_report`의 owner, signature, security mode, `search_path`와 role별 EXECUTE 결과
- 익명·로그인·동일 idempotency key 재시도의 dev acceptance 결과와 생성 test row 정리 기록
- production catalog 검증과 승인된 최소 smoke 결과, 새 database/security advisor 경고의 처리 결과
- 실패 시 forward-fix 또는 v13 배포 중단 결정권자와 운영 연락 경로

실제 증거 위치는 dev catalog의 `catalog-topik-dev.txt`, 직접 거부의 `direct-access-topik-dev.txt`, API 결과의 `api-acceptance-topik-dev.txt`, 정리의 `cleanup-topik-dev.txt`, production catalog의 `catalog-topik-prod.txt`로 연결한다. 외부 handback에는 raw 파일이나 secret을 복사하지 않고 각 파일의 checksum, 실행 시각, 논리 환경과 합격 열·HTTP status 요약만 기록한다. dev 네 증거가 모두 합격한 뒤에만 production 적용으로 이동하고, production catalog가 합격한 뒤에만 v13 handback과 앱 배포로 이동한다.

v13 owner는 handback을 확인한 뒤 파생 타입 `src/lib/supabase/types.ts`가 적용된 signature와 같은지 비교하고, API 통합 테스트와 desktop/mobile Playwright CLI·현재 worktree runtime 검증을 다시 수행한다. 증거가 누락되거나 signature가 다르면 앱 배포를 중단하고 입력 보존 오류 상태를 유지한다.

## 6. 운영 책임과 제외 범위

- 무기한 수동 보관과 수동 삭제 책임은 topik-ai 운영 owner에게 있다. 자동 retention job이나 사용자 앱의 삭제 UI는 만들지 않는다.
- v13은 접수 UI·검증·일반 실패 UX를 소유하지만 접수 목록 조회, 상태 변경, 담당자 배정, 외부 알림과 관리자 처리 화면을 소유하지 않는다.
- 스팸 위험은 알려진 잔여 위험이다. 현재는 중복 클릭과 동일 요청 재접수만 막으며 rate limit이나 CAPTCHA를 완료 기능으로 표현하지 않는다.
- 운영 장애 때 v13은 database·RPC·provider 세부 원인을 숨기고 `잠시 후 다시 시도`를 안내하며 입력값을 유지한다.
- 원격 schema/data apply, 실제 사용자 접수 생성·조회·삭제와 retention 집행은 v13 에이전트가 실행하지 않는다.
