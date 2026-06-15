# C-02 문제 목록 기능명세

## 화면 목적

추천/필터 결과에 맞는 문제를 고르고 풀이로 진입하게 한다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/practice/problems`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: C-01 유형 선택, R-02 다음 문제 추천, X-07 약점 기반 추천에서 추천 문제 시작, D-M3 저장하지 않고 나가기.
- 이탈 경로: 문제 상세 보기 또는 문제 선택 시 C-03 다시 풀기 모달을 연다.
- 화면 내부 동작: 유형 필터, 정렬, 검색, 페이지 이동, 문제 상태 확인을 처리한다.

## 주요 기능

- 문제 카드
- 필터/정렬
- 풀이 이력 표시
- 다시 풀기 모달 호출

## 상태/오류

- 문제 없음, 비공개 문제 제외, 자료 로드 실패

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `list_user_problems` (RPC) | `filter`(domain/topik_level/question_no/difficulty/status/search), `sort`, `page`, `page_size` → rows + `total_count` | read (rpc) | 문제 목록의 필터·정렬·페이지네이션과 정확한 총 건수 계산. 풀이/제출 상태를 함께 반환해 카드 상태·다시 풀기 딥링크에 쓴다. | SECURITY INVOKER — 호출자 RLS(auth.uid()) 범위에서 실행 | `supabase/migrations/20260602120400_admin_and_user_rpcs.sql`<br>`src/components/practice/problem-list-data.ts` | none |
| `problems` | `id`, `domain`, `question_no`, `topik_level`, `difficulty`, `title`, `prompt`, `tags`, `publish_status`, `visibility` | read | 문제 목록, 필터, 정렬, 상세 진입에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`src/lib/practice/next.ts` | none |
| `problem_assets` | `problem_id`, `storage_path`, `asset_type`, `sort_order` | read | 문제 자료 이미지/오디오를 연결한다. | authenticated user; auth.uid() owner RLS where user-owned | `supabase/migrations/20260520120200_problems.sql` | none |
| `problem_attempts` | `problem_id`, `status`, `is_correct`, `bookmarked`, `time_spent_seconds` | read/write | 풀이 이력, 다시 풀기, 북마크 상태에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`supabase/migrations/20260520120300_attempts.sql`<br>`tests/integration/rls-smoke.test.ts` | none |
| `writing_drafts` | `problem_id`, `autosave_status`, `last_saved_at` | read | 작성 중인 문제 표시와 이어쓰기 CTA에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/dashboard/page.tsx`<br>`src/lib/practice/queries.ts`<br>`src/lib/writing/mutations.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server.ts` | none |

## 현재 구현 상태

- 문제 목록은 `list_user_problems` RPC(SECURITY INVOKER)로 조회한다. 상태 필터(풀이완료/시도/미시도)와 총 건수를 SQL에서 계산하므로 필터된 결과의 페이지 번호가 정확하다.
- problem_assets와 문제 공개 상태가 표시 규칙에 포함된다.

## 코드 구현 근거

- `PracticeProblemsPage` - `src/app/(workspace)/practice/problems/page.tsx`
- `ProblemListView` - `src/components/practice/ProblemListView.tsx`
- `RetryModal` - `src/components/practice/RetryModal.tsx`
- `useUserProblemsRpc`, `fetchUserProblemsRpc`, `validateSearch` - `src/components/practice/problem-list-data.ts`

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
