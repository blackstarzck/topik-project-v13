# 원격 DB migration 적용 handoff (운영자용 런북)

작성일: 2026-07-10
대상 migration: `supabase/migrations/20260710093000_revoke_anon_superseded_auth_gate.sql`, `supabase/migrations/20260710094000_auth_gate_trusted_consent_docs.sql`

> v13 사용자 앱 작업면에서는 원격 Supabase schema/data apply를 실행하지 않는다. 아래 적용은 스키마 소유 repo/운영 절차에서 수행한다. 이 문서는 무엇을·어떤 순서로 적용하고, 무엇으로 검증하는지의 안내다.

## 요약 (무엇을/왜)

| migration | 하는 일 | 왜 |
| --- | --- | --- |
| `20260710093000` | (1) 사용되지 않는 `complete_auth_gate(text,text,text,boolean,text,text)` 6-arg overload를 DROP (→ anon 권한도 함께 제거), (2) `list_user_library_problem_items()`에서 `anon` EXECUTE 회수 | 인증 안 된 역할(anon)에 남아 있던 실행 권한 드리프트를 authenticated-only 계약으로 정리(defense-in-depth) |
| `20260710094000` | base `complete_auth_gate(text,text,text,boolean)`의 필수 동의 문서 선택 로직에 신뢰 필터(`source_policy_id`/`is_placeholder`) 추가 | 신뢰되지 않은/더 최신인 published `legal_documents` 행이 동의 기록과 게이트 검사 대상을 어긋나게 해 **/auth/consent 무한 바운스**를 유발하던 버그 수정 |

- 두 migration 모두 **forward-only, idempotent**. 함수는 이미 미인증 호출자를 거부하므로 (1)은 즉각 데이터 노출 수정이 아니라 하드닝, (2)는 실제 사용자 영향 버그 수정이다.
- 적용 순서: 타임스탬프 순(`093000` → `094000`). 상호 독립적이라 순서 민감성은 없다.

## 적용 (소유 워크플로에서)

스키마 소유 repo/운영 절차의 표준 방식으로 두 파일을 적용한다(예: `supabase db push`, CLI migration, 또는 Management API `run-sql --file`). tracker 드리프트가 있는 환경은 memory `topik-ai-admin-tracker-drift`의 방식(파일 적용 후 tracker 행 수동 insert)을 따른다.

## 적용 전 확인 (선택, 기대 상태 파악)

```sql
-- (a) complete_auth_gate 현존 overload 목록: 6-arg (…,boolean,text,text)가 보이면 093000이 지울 대상
select p.oid::regprocedure as signature
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.proname = 'complete_auth_gate'
order by 1;

-- (b) anon EXECUTE 잔존 여부(회수 전이면 true일 수 있음)
select p.oid::regprocedure as signature,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('complete_auth_gate', 'list_user_library_problem_items')
order by 1;
```

## 적용 후 검증 (필수)

```sql
-- 1) 093000: 6-arg overload가 사라졌는지 (아래 결과에 (…,boolean,text,text)가 없어야 함)
select p.oid::regprocedure as signature
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.proname = 'complete_auth_gate'
order by 1;

-- 2) 093000: 남은 두 함수(그리고 모든 complete_auth_gate overload)에 anon EXECUTE가 없어야 함 → 전부 false
select p.oid::regprocedure as signature,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('complete_auth_gate', 'list_user_library_problem_items')
order by 1;

-- 3) 094000: base overload 정의에 신뢰 필터가 포함됐는지 → has_trust_filter=true, occurrences=4
select
  pg_get_functiondef('public.complete_auth_gate(text,text,text,boolean)'::regprocedure)
    like '%source_policy_id is not null or is_placeholder is true%' as has_trust_filter,
  (length(pg_get_functiondef('public.complete_auth_gate(text,text,text,boolean)'::regprocedure))
     - length(replace(pg_get_functiondef('public.complete_auth_gate(text,text,text,boolean)'::regprocedure),
                       'source_policy_id is not null or is_placeholder is true', '')))
     / length('source_policy_id is not null or is_placeholder is true') as occurrences;
```

기대: (1) 6-arg 없음, (2) `anon_can_execute` 전부 `false`, (3) `has_trust_filter=true` 및 `occurrences=4`.

## 데이터 위생 점검 (권장)

RPC 수정으로 신뢰되지 않은 문서는 더 이상 게이트를 오염시키지 않지만, 적용 대상 환경에 stale/untrusted published 필수 동의 문서가 없는지 확인한다.

```sql
select locale, doc_type, version, status, effective_at,
       (source_policy_id is not null or is_placeholder) as trusted
from public.legal_documents
where requires_consent and status = 'published'
order by doc_type, effective_at desc;
```

`trusted=false`인 published 행(예: version `e2e-auth-gate-*`, title `E2E Terms/Privacy`)이 있으면 테스트 잔여물이므로 제거 검토. (dev에서는 2026-07-10에 정리 완료.)

## 롤백 메모

- `093000`: DROP한 6-arg는 앱이 호출하지 않는 superseded overload라 롤백 불필요. 되살리려면 `20260625113000`의 정의를 재적용.
- `094000`: `create or replace`이므로 롤백은 직전 정의(`20260623103000`의 base body)를 재적용하면 됨. 단 그 경우 신뢰 필터 버그가 되돌아오므로 권장하지 않음.

## 참고
- 기능 회귀 확인이 필요하면 consent-completion / profile-phone-editing e2e를 적용 후 환경 대상으로 재실행(무한 바운스 미재현 확인).
- 관련 memory: `consent-gate-untrusted-doc-bounce`, `topik-ai-admin-tracker-drift`, `db-verify-without-docker`.
