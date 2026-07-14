# supabase/

이 디렉터리는 TALKPIK AI의 로컬 Supabase 재현 자료를 보관한다. 원격 운영 DB 적용 공간이 아니다.

## 현재 구조

```text
supabase/
├── config.toml          local Auth, API, DB, Storage 설정
├── seed.sql             migration 후 적용되는 user-independent seed
├── migrations/
│   ├── INDEX.md         날짜별 변경 설명
│   └── *.sql            schema, RLS, RPC의 실행 가능한 정본
└── README.md
```

`migrations/`는 Supabase CLI가 순서대로 읽을 수 있도록 flat 구조를 유지한다. 파일명은 `YYYYMMDDHHMMSS_<snake_case_description>.sql` 형식이며 timestamp 순서가 의존 순서다.

## 계약 소유권

- 실제 schema, grant, RLS, policy, trigger, function/RPC: timestamp 순으로 재생한 `migrations/*.sql`
- 날짜별 변경 요약: [`migrations/INDEX.md`](./migrations/INDEX.md)
- 사람이 읽는 데이터·보안 계약: [`docs/supabase/README.md`](../docs/supabase/README.md)
- 생성된 TypeScript 타입: `src/lib/supabase/types.ts`

사람이 읽는 문서가 SQL과 다르면 SQL replay 결과가 우선하며, 같은 변경 묶음에서 문서와 타입을 고친다. Supabase Data API의 object 접근은 grants, row 접근은 RLS가 담당하므로 둘을 함께 검토한다.

## 로컬 재현

```bash
pnpm dlx supabase start
pnpm dlx supabase db reset
pnpm dlx supabase gen types typescript --local > src/lib/supabase/types.ts
```

`db reset`은 migration을 timestamp 순으로 적용한 뒤 `seed.sql`을 실행한다. seed는 auth user UUID에 의존하지 않는 개발 자료만 포함한다. user-owned fixture는 테스트가 별도로 만들고 정리한다.

v13 작업면에서는 원격 Supabase schema/data apply를 실행하지 않는다. 원격 변경은 별도 운영 절차와 소유 저장소에서 검토·적용한다.

## migration 작성 원칙

- Supabase CLI의 migration 생성 명령으로 timestamp 파일을 만든다.
- 기존 migration을 수정해 배포 이력을 바꾸지 않고 새 migration으로 보강한다.
- table과 function의 Data API grant, RLS, RPC execute 권한을 최소 권한으로 명시한다.
- public table은 RLS와 owner 조건을 확인하고, `SECURITY DEFINER`는 필요한 경우에만 인증·소유권 검증, 고정 `search_path`, 명시적 execute grant와 함께 사용한다.
- 재시도 가능한 작업은 unique constraint, conflict handling 또는 RPC transaction으로 idempotency를 보장한다.
- Storage 변경은 bucket 공개 여부, object path owner, upload/read/update/delete policy를 함께 검토한다.
- [`migrations/INDEX.md`](./migrations/INDEX.md)와 필요한 `docs/supabase/` 계약을 같은 변경에 갱신한다.

검증 방법은 [`TESTING.md`](../TESTING.md)를 따른다. secret과 service-role key는 출력하거나 문서화하지 않는다.
