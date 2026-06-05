# supabase/

TALKPIK AI의 Supabase 관련 파일이 모이는 디렉토리입니다. 현재는 `migrations/`(스키마 마이그레이션) 만 존재합니다. 적용 환경(`config.toml`, `seed.sql`, `functions/`)은 프로젝트 부트스트랩 단계에서 추가됩니다.

## 디렉토리 구조

```
supabase/
  README.md            ← 이 문서
  migrations/
    INDEX.md           ← 연/월/일 트리 시각적 인덱스
    20260520120000_*.sql
    20260520120100_*.sql
    ...                ← Supabase CLI 호환을 위해 flat 구조
```

> ⚠ `migrations/` 는 **flat 구조 강제**. `migrations/2026/05/20/` 같은 하위 폴더로 옮기면 Supabase CLI 가 SQL을 스캔하지 못해 적용이 깨집니다. 연/월/일 가독성은 [`migrations/INDEX.md`](./migrations/INDEX.md) 가 책임집니다.

## 마이그레이션 파일 명명 규칙

`YYYYMMDDHHMMSS_<짧은_설명>.sql` 형식. Supabase CLI 표준 컨벤션.

예) `20260520120100_profiles_goals.sql` = "2026-05-20 12:01:00에 만든 profiles + learning_goals 마이그레이션".

### 왜 timestamp prefix를 쓰나?

마이그레이션 도구가 파일을 **알파벳순으로 정렬해서 차례대로 실행**합니다. timestamp가 prefix면 자연스럽게 **시간순 = 의존순** 정렬이 됩니다.

구체적으로:

1. **적용 순서 보장.** `profiles`가 먼저 만들어져야 `writing_submissions.user_id` FK가 가능. 파일명 정렬로 `120100_profiles_goals.sql` → `120400_writing.sql` → `121100_rls_policies.sql` 순으로 실행되도록 강제.
2. **history 추적.** Supabase CLI가 적용된 마이그레이션을 `supabase_migrations.schema_migrations` 테이블에 timestamp로 기록 → 다음 적용 시 "이미 실행됨" 판단. timestamp가 unique key 역할.
3. **충돌 방지.** 여러 명이 동시에 마이그레이션을 작성해도 timestamp가 다르면 파일명 충돌이 안 남.

본 저장소의 16개 초기 마이그레이션은 모두 같은 날짜(`20260520`)에 작성됐기 때문에, 시간 부분만 100초 간격으로 증가시켜 순차 정렬되도록 했습니다.

## 현재 마이그레이션 인덱스

연/월/일 트리로 정리한 시각적 인덱스는 [`migrations/INDEX.md`](./migrations/INDEX.md) 에 있습니다.
컬럼/RLS/ER 등 스키마 상세는 [`docs/development/database-schema.md`](../docs/development/database-schema.md) 에 있습니다.

> 실제 `*.sql` 파일은 Supabase CLI 호환을 위해 `migrations/` 디렉토리 바로 아래에 **flat 으로 위치**합니다. 하위 폴더(`migrations/2026/05/20/`) 로 옮기면 CLI 가 스캔하지 못해 적용이 깨집니다. INDEX.md 는 그 한계를 우회한 시각적 메타 인덱스입니다.

## 적용 방법

본 저장소는 현재 **pre-implementation 상태**라 `package.json` / Supabase CLI 가 설치되어 있지 않습니다. 프로젝트 부트스트랩 후 아래 명령을 사용합니다.

```bash
# Supabase CLI 초기화 (한 번)
pnpm dlx supabase init

# 로컬 인스턴스 시작
pnpm dlx supabase start

# 깨끗한 재적용 (로컬)
pnpm dlx supabase db reset

# 원격 적용 (linked project)
pnpm dlx supabase db push

# TypeScript 타입 생성 (정본 위치: src/lib/supabase/types.ts)
pnpm dlx supabase gen types typescript --local > src/lib/supabase/types.ts
```

> 생성된 타입은 `src/lib/supabase/types.ts`로 저장합니다. Supabase 클라이언트와 같은 폴더에 두어 응집도를 유지합니다. `src/types/`는 hand-written shared domain types 용도로 남깁니다.

## 새 마이그레이션 추가하기

1. 다음 timestamp를 정한다. 본 저장소의 마지막 파일은 `20260520121500_*`. 다음 마이그레이션은 **현재 시각 UTC 또는 KST 기준 timestamp**를 쓰는 게 가장 안전 (예: `20260605093000_...`).
2. 파일명은 `YYYYMMDDHHMMSS_<짧은_설명>.sql`. 설명은 snake_case로 도메인을 표현 (`add_organizations`, `extend_problems_with_audio`).
3. SQL은 **idempotent**하게 작성:
   - `create table if not exists ...`
   - `create index if not exists ...`
   - `drop policy if exists ... ; create policy ...`
   - `insert ... on conflict do nothing`
   - 함수는 `create or replace function ...`
4. 의존하는 테이블/함수가 이전 timestamp 파일에 있는지 확인. 없으면 같은 마이그레이션 안에서 먼저 정의하거나, 이전 파일에 합치는 게 안전.
5. 정본 spec(`docs/development/database-schema.md`)도 같이 갱신. 인덱스 표, 컬럼 표, RLS/Invariants 섹션.
6. [`migrations/INDEX.md`](./migrations/INDEX.md) 의 해당 연/월/일 섹션에 한 줄 추가 (새 날짜면 트리 헤더부터 추가).

## Idempotency 컨벤션

본 디렉토리의 모든 마이그레이션은 **재실행 가능**하게 작성되어 있습니다. 이유:

- `supabase db reset` 으로 깨끗한 재적용 시 오류 없이 통과해야 함.
- 동일 마이그레이션을 다른 환경(local/preview/prod)에 적용할 때 한 곳에서만 실패하면 안 됨.

규칙 요약:
- 모든 `create` 는 `if not exists` 또는 `or replace`.
- 모든 `policy` 는 `drop policy if exists` 후 재생성.
- 모든 `trigger` 는 `drop trigger if exists` 후 재생성.
- `insert` 는 `on conflict do nothing` (lookup data, storage buckets 등).

## 관련 문서

- **스키마 정본**: [`docs/development/database-schema.md`](../docs/development/database-schema.md) — Tier 1 MVP 테이블 컬럼/RLS/인덱스/ER
- **Auth/RLS 정책**: [`docs/development/backend-auth.md`](../docs/development/backend-auth.md)
