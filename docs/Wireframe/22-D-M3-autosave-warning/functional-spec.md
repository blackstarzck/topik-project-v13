# D-M3 자동저장 경고 기능명세

## 화면 목적

작성 중 저장 실패나 충돌을 바로 인지하고 복구하게 한다.

## 진입/이탈 흐름

- Route: `/writing/short-answer-writing-51, /writing/answer-writing-52, /writing/long-form-writing-53, /writing/essay-writing-54`
- Route type: autosave failure, delay, or conflicting save state.
- Audience: user
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 이탈: 다음 CTA, 상위 목록, 인증 오류, 권한 오류, 또는 빈 상태 CTA로 이동한다.

## 주요 기능

- 저장 상태 표시
- 재시도
- 최근 저장 시각
- 계속 작성

## 상태/오류/권한

- 네트워크 실패, 중복 저장, 충돌
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 현재 구현 상태

- writing_drafts 상태와 study_events 기록을 함께 본다.
- 실제 구현 여부는 `src/**`, IA 감사 산출물, 이 문서의 DB 근거를 함께 확인한다.

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- IA 감사 결과와 source-map이 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `writing_drafts` | `autosave_status`, `last_saved_at`, `answer_text`, `char_count` | read/write | 자동저장 실패, 지연, 충돌 경고에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/dashboard/page.tsx`<br>`src/lib/practice/queries.ts`<br>`src/lib/writing/mutations.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server.ts` | none |
| `study_events` | `event_type`, `payload`, `occurred_at` | write | 자동저장 이벤트를 기록한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/events/study-events.ts`<br>`src/lib/export/pdf-export.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.

## 검증 근거

- Description: `docs/Wireframe/22-D-M3-autosave-warning/description.md`
- Wireframe: `docs/Wireframe/22-D-M3-autosave-warning/wireframe.png`
- Route map: `docs/sitemap.md`
- Active user flow: `docs/flow/user-flow.md`
- DB inventory: `reports/wireframe-functional-specs/runs/20260601-1542/data-inventory.json`
- Evidence: `src/app/(workspace)/dashboard/page.tsx`
- Evidence: `src/lib/practice/queries.ts`
- Evidence: `src/lib/writing/mutations.ts`
- Evidence: `src/lib/writing/queries.ts`
- Evidence: `src/lib/writing/server.ts`
- Evidence: `supabase/migrations/20260520120400_writing.sql`
- Evidence: `src/lib/events/study-events.ts`
- Evidence: `src/lib/export/pdf-export.ts`
- Evidence: `supabase/migrations/20260520120700_library_events_exports.sql`
