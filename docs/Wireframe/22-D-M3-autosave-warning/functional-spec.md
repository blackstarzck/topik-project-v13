# D-M3 자동저장 경고 기능명세

## 화면 목적

작성 중 저장 실패나 충돌을 바로 인지하고 복구하게 한다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/writing/short-answer-writing-51, /writing/answer-writing-52, /writing/long-form-writing-53, /writing/essay-writing-54`
- Route type: modal/toast
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: D-01/D-02/D-03/D-04 작성 화면에서 저장되지 않은 변경이 있는 상태로 이탈할 때 열린다.
- 이탈 경로: 취소는 원래 작성 화면으로 돌아가고, 저장 후 이동은 원래 목적지로 이동하며, 저장하지 않고 나가기는 C-02 등 요청한 목적지로 이동한다.
- 모달 동작: 변경사항 경고, 저장 후 이동, 저장하지 않고 나가기, 계속 작성 선택을 처리한다.

## 주요 기능

- 저장 상태 표시
- 재시도
- 최근 저장 시각
- 계속 작성

## 상태/오류

- 네트워크 실패, 중복 저장, 충돌

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `writing_drafts` | `autosave_status`, `last_saved_at`, `answer_text`, `char_count` | read/write | 자동저장 실패, 지연, 충돌 경고에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/dashboard/page.tsx`<br>`src/lib/practice/queries.ts`<br>`src/lib/writing/mutations.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server.ts` | none |
| `study_events` | `event_type`, `payload`, `occurred_at` | write | 자동저장 이벤트를 기록한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/events/study-events.ts`<br>`src/lib/export/pdf-export.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |

## 현재 구현 상태

- writing_drafts 상태와 study_events 기록을 함께 본다.

## 코드 구현 근거

- `AutosaveWarningModal` - `src/components/writing/AutosaveWarningModal.tsx`
- `WritingEditor` modal host - `src/components/writing/WritingEditor.tsx`
- `LongFormEditor` modal host - `src/components/writing/LongFormEditor.tsx`
- `useUnsavedChangesGuard` - `src/hooks/useUnsavedChangesGuard.ts`
- `useUpsertDraft` - `src/lib/writing/mutations.ts`

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/ia.md`와 화면 기능명세의 audience와 맞는다.
