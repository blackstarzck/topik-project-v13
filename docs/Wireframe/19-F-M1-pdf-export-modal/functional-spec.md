# F-M1 PDF 내보내기 모달 기능명세

## 화면 목적

피드백/리포트를 PDF로 저장하고 다운로드하게 한다.

## 진입/이탈 흐름

- Route: `/library, /writing/feedback/short/:id, /writing/feedback/long/:id, /writing/reports/:id/compare`
- Route type: user exports feedback or report content.
- Audience: user
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 이탈: 다음 CTA, 상위 목록, 인증 오류, 권한 오류, 또는 빈 상태 CTA로 이동한다.

## 주요 기능

- 내보내기 옵션
- 생성 요청
- 다운로드
- 실패 재시도

## 상태/오류/권한

- 생성 실패, 권한 없음, 파일 없음
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 현재 구현 상태

- generated-exports bucket과 export_files 상태가 기준이다.
- 실제 구현 여부는 `src/**`, IA 감사 산출물, 이 문서의 DB 근거를 함께 확인한다.

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- IA 감사 결과와 source-map이 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `export_files` | `source_type`, `source_id`, `storage_path`, `options`, `status` | read/write | PDF 생성 요청과 결과 파일 상태를 저장한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/export/pdf-export.ts`<br>`src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |
| `study_events` | `event_type`, `export_file_id`, `payload` | write | PDF 다운로드 이벤트를 기록한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/events/study-events.ts`<br>`src/lib/export/pdf-export.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |
| `storage:generated-exports` | - | read/write | 생성된 PDF 파일을 저장하고 소유자에게만 노출한다. | owner or public bucket policy depending on bucket | `supabase/migrations/20260520121200_storage_buckets.sql` | none |

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.

## 검증 근거

- Description: `docs/Wireframe/19-F-M1-pdf-export-modal/description.md`
- Wireframe: `docs/Wireframe/19-F-M1-pdf-export-modal/wireframe.png`
- Route map: `docs/sitemap.md`
- Active user flow: `docs/flow/user-flow.md`
- DB inventory: `reports/wireframe-functional-specs/runs/20260601-1542/data-inventory.json`
- Evidence: `src/lib/export/pdf-export.ts`
- Evidence: `src/lib/library/queries.ts`
- Evidence: `src/lib/library/server.ts`
- Evidence: `supabase/migrations/20260520120700_library_events_exports.sql`
- Evidence: `src/lib/events/study-events.ts`
- Evidence: `supabase/migrations/20260520121200_storage_buckets.sql`
