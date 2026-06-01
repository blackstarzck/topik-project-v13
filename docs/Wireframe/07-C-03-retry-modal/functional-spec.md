# C-03 재도전 모달 기능명세

## 화면 목적

이전 시도나 임시 저장이 있는 문제의 계속/새 시작을 선택하게 한다.

## 진입/이탈 흐름

- Route: `/practice/problems`
- Route type: user chooses to solve a previously attempted or retry-eligible problem.
- Audience: user
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 이탈: 다음 CTA, 상위 목록, 인증 오류, 권한 오류, 또는 빈 상태 CTA로 이동한다.

## 주요 기능

- 이전 상태 요약
- 이어풀기
- 새로 시작
- 취소

## 상태/오류/권한

- 임시 저장 없음, 이미 완료된 시도
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 현재 구현 상태

- hosted modal이라 독립 route가 없으며 문제 목록 컨텍스트가 필요하다.
- 실제 구현 여부는 `src/**`, IA 감사 산출물, 이 문서의 DB 근거를 함께 확인한다.

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- IA 감사 결과와 source-map이 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `problem_attempts` | `problem_id`, `status`, `is_correct`, `submitted_at` | read/write | 재도전 가능 여부와 새 시도 시작에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`supabase/migrations/20260520120300_attempts.sql`<br>`tests/integration/rls-smoke.test.ts` | none |
| `writing_drafts` | `problem_id`, `status`, `last_saved_at` | read/update | 이어쓰기 또는 새로 시작 판단에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/dashboard/page.tsx`<br>`src/lib/practice/queries.ts`<br>`src/lib/writing/mutations.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server.ts` | none |

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.

## 검증 근거

- Description: `docs/Wireframe/07-C-03-retry-modal/description.md`
- Wireframe: `docs/Wireframe/07-C-03-retry-modal/wireframe.png`
- Route map: `docs/sitemap.md`
- Active user flow: `docs/flow/user-flow.md`
- DB inventory: `reports/wireframe-functional-specs/runs/20260601-1542/data-inventory.json`
- Evidence: `src/lib/practice/next.ts`
- Evidence: `supabase/migrations/20260520120300_attempts.sql`
- Evidence: `tests/integration/rls-smoke.test.ts`
- Evidence: `src/app/(workspace)/dashboard/page.tsx`
- Evidence: `src/lib/practice/queries.ts`
- Evidence: `src/lib/writing/mutations.ts`
- Evidence: `src/lib/writing/queries.ts`
- Evidence: `src/lib/writing/server.ts`
- Evidence: `supabase/migrations/20260520120400_writing.sql`
