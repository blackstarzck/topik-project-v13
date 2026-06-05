# F-01 내 서재 기능명세

## 화면 목적

저장한 문제, 제출, 리포트, 내보내기 파일을 모아 보여준다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/library`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: B-01 최근 첨삭 카드, E-01/E-02 피드백의 저장 결과, 직접 `/library` 접근.
- 이탈 경로: PDF 내보내기는 F-M1 모달을 열고, 저장된 문제/제출 항목은 해당 상세 또는 작성/피드백 경로로 이동한다.
- 화면 내부 동작: 검색, 탭 선택, 상세 패널, 저장 항목 삭제, 태그 수정, 페이지 이동을 처리한다.

## 주요 기능

- 탭별 목록
- 태그/메모
- 저장 해제
- PDF 내역

## 상태/오류

- 저장 항목 없음, export 실패

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `library_items` | `item_type`, `attempt_id`, `submission_id`, `report_id`, `export_file_id`, `problem_id`, `note`, `tags`, `saved_at` | read/write | 내 보관함 탭, 저장/해제, 태그에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/library/mutations.ts`<br>`src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |
| `writing_submissions` | `id`, `problem_id`, `submitted_at`, `char_count` | read | 제출 이력 탭에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`src/lib/practice/next.ts`<br>`src/lib/practice/queries.ts`<br>`src/lib/writing/queries.ts` | none |
| `comparison_reports` | `id`, `metrics`, `narrative`, `generated_at` | read | 리포트 탭에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`src/lib/writing/server.ts`<br>`supabase/migrations/20260520120500_feedback.sql` | none |
| `problems` | `id`, `title`, `question_no`, `difficulty` | read | 저장한 문제 탭에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/admin/queries.ts`<br>`src/lib/admin/server.ts`<br>`src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`src/lib/practice/next.ts` | none |
| `export_files` | `source_type`, `source_id`, `storage_path`, `status`, `created_at` | read | 내보내기 파일 목록에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/export/pdf-export.ts`<br>`src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |
| `study_events` | `event_type`, `occurred_at`, `payload` | read | 학습 활동 기록에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/events/study-events.ts`<br>`src/lib/export/pdf-export.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |

## 현재 구현 상태

- library_items의 단일 FK 제약을 문서에 남긴다.

## 코드 구현 근거

- `LibraryPage`, `computeLibraryStats` - `src/app/(workspace)/library/page.tsx`
- `LibraryTabs` - `src/components/library/LibraryTabs.tsx`
- `LibrarySubmissionsTab` - `src/components/library/LibrarySubmissionsTab.tsx`
- `LibraryReportsTab` - `src/components/library/LibraryReportsTab.tsx`
- `LibrarySavedProblemsTab` - `src/components/library/LibrarySavedProblemsTab.tsx`
- `LibraryExportsTab` - `src/components/library/LibraryExportsTab.tsx`
- `listLibraryItems` - `src/lib/library/server.ts`
- `useLibraryItems` - `src/lib/library/queries.ts`
- `saveLibraryItem`, `deleteLibraryItem`, `updateItemTags` - `src/lib/library/mutations.ts`

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.
