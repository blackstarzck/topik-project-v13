# D-M1 제출 확인 모달 기능명세

## 화면 목적

최종 제출 전 답안과 글자 수를 확인하게 한다.

## 진입/이탈 흐름

- Route: `/writing/51, /writing/52, /writing/53, /writing/54`
- Route type: user submits a writing answer.
- Audience: user
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 이탈: 다음 CTA, 상위 목록, 인증 오류, 권한 오류, 또는 빈 상태 CTA로 이동한다.

## 주요 기능

- 답안 요약
- 글자 수 확인
- 제출 확정
- 돌아가기

## 상태/오류/권한

- 빈 답안, 저장 지연, 중복 제출
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 현재 구현 상태

- 제출은 직접 insert보다 RPC 경로가 기준이다.
- 실제 구현 여부는 `src/**`, IA 감사 산출물, 이 문서의 DB 근거를 함께 확인한다.

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- IA 감사 결과와 source-map이 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `writing_drafts` | `problem_id`, `answer_text`, `answer_json`, `char_count`, `autosave_status` | read | 제출 전 임시 저장 답안을 확인한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/dashboard/page.tsx`<br>`src/lib/practice/queries.ts`<br>`src/lib/writing/mutations.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server.ts` | none |
| `rpc:public.submit_writing_with_feedback` | - | rpc | 최종 제출과 초기 feedback row 생성을 원자적으로 처리한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/writing/server-actions.ts`<br>`supabase/migrations/20260521130000_phase_5_writing_rpc.sql`<br>`supabase/migrations/20260521140000_phase_6_rpc_and_admin.sql` | none |
| `writing_submissions` | `problem_id`, `answer_text`, `char_count`, `feedback_status` | write | 확정 제출본을 만든다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`src/lib/practice/next.ts`<br>`src/lib/practice/queries.ts`<br>`src/lib/writing/queries.ts` | none |

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.

## 검증 근거

- Description: `docs/Wireframe/12-D-M1-submission-confirmation-modal/description.md`
- Wireframe: `docs/Wireframe/12-D-M1-submission-confirmation-modal/wireframe.png`
- Route map: `docs/sitemap.md`
- Active user flow: `docs/flow/user-flow.md`
- DB inventory: `reports/wireframe-functional-specs/runs/20260601-1542/data-inventory.json`
- Evidence: `src/app/(workspace)/dashboard/page.tsx`
- Evidence: `src/lib/practice/queries.ts`
- Evidence: `src/lib/writing/mutations.ts`
- Evidence: `src/lib/writing/queries.ts`
- Evidence: `src/lib/writing/server.ts`
- Evidence: `supabase/migrations/20260520120400_writing.sql`
- Evidence: `src/lib/writing/server-actions.ts`
- Evidence: `supabase/migrations/20260521130000_phase_5_writing_rpc.sql`
- Evidence: `supabase/migrations/20260521140000_phase_6_rpc_and_admin.sql`
- Evidence: `src/lib/library/queries.ts`
- Evidence: `src/lib/library/server.ts`
- Evidence: `src/lib/practice/next.ts`
