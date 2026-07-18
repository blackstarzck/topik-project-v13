# Supabase 계약 안내

이 폴더는 TALKPIK AI가 Supabase를 어떻게 사용하는지 사람이 읽을 수 있게 설명한다. SQL을 복제한 스키마 목록이 아니며 독립 SOT도 아니다.

## 읽는 순서와 우선순위

1. 제품 약속: [`../prd.md`](../prd.md)
2. 실제 schema, grant, RLS, trigger, function/RPC: timestamp 순으로 재생한 `supabase/migrations/*.sql`
3. 사람이 읽는 데이터 계약: 이 폴더
4. 파생 TypeScript 타입: `src/lib/supabase/types.ts`
5. 외부 백엔드 API 참고: [`../swagger-api/README.md`](../swagger-api/README.md)

SQL replay 결과와 이 문서가 다르면 SQL이 우선한다. 같은 변경 묶음에서 이 문서와 타입을 갱신한다.

[`../../supabase/migrations/INDEX.md`](../../supabase/migrations/INDEX.md)는 날짜별 변경을 찾기 위한 비정본 탐색 ledger다. SQL을 대체하거나 위 우선순위에 새로운 계약 계층을 추가하지 않는다.

- [`database-api-contract.md`](./database-api-contract.md): 데이터 영역, Data API, RPC, 원자성·idempotency, Storage·retention
- [`security-and-ownership.md`](./security-and-ownership.md): Auth, RLS, 보호 필드, service role, 탈퇴·정리와 소유 경계

Supabase Data API는 DB schema에서 자동 생성된다. object 접근은 grants, row 접근은 RLS가 각각 담당하므로 둘을 함께 검토한다. 공식 참고: [Data API](https://supabase.com/docs/guides/api), [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).

## 변경 절차

- migration을 새 timestamp 파일로 작성하고 local stack에서 처음부터 replay한다.
- Data API grant, RLS/policy, RPC execute 권한과 service-role 경계를 함께 검토한다.
- 관련 source/tests, `INDEX.md`, 이 폴더의 계약과 생성 타입을 같은 변경에 맞춘다.
- v13 작업면에서는 원격 Supabase schema/data apply를 하지 않는다.

## 저장소 경계

- v13은 학습자용 user app과 그 서버 경로를 소유한다.
- admin 운영 UI, quota reset, 콘텐츠 관리와 production DB 적용은 별도 소유 앱·운영 절차의 책임이다.
- 클라이언트 안전과 백업·복구 운영의 책임 경계는 [`../operations/cross-repo-recovery-boundary.md`](../operations/cross-repo-recovery-boundary.md)를 따른다.
- `docs/swagger-api/`는 외부 백엔드 OpenAPI 참고이며 Supabase migration의 대체물이 아니다.
