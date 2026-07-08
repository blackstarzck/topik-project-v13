# F-M1 PDF 내보내기 모달 기능명세

## 화면 목적

피드백/리포트를 PDF로 저장하고 다운로드하게 한다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/library, /writing/feedback/short/:id, /writing/feedback/long/:id, /writing/reports/:id/compare`
- Route type: modal
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: F-01 내 서재 또는 E-02 장문 피드백의 PDF 저장 CTA에서 열린다.
- 이탈 경로: 다운로드 완료 또는 닫기 시 F-01 또는 호출한 피드백 화면으로 돌아가며, 유료 잠금은 X-03으로 이동한다.
- 모달 동작: 내보내기 범위, 포함 옵션, 미리보기, PDF 생성 요청을 처리한다.

## 주요 기능

- 내보내기 옵션
- 생성 요청
- 다운로드
- 실패 재시도

## 상태/오류

- 생성 실패, 권한 없음, 파일 없음
- PDF quota exceeded: `code = "pdf_export_quota_exceeded"` is shown as a warning/info message, not as a system error.

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `export_files` | `source_type`, `source_id`, `storage_path`, `options`, `status` | read/write | PDF 생성 요청과 결과 파일 상태를 저장한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/export/pdf-export.ts`<br>`src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |
| `pdf_export_quota_policies` | `limit_count`, `period_unit`, `timezone`, `is_active` | read | Default policy is 3 exports per user + problem per month using `Asia/Seoul`. Future policies can change n/day/week/month. | authenticated read for active user-app enforcement; admin management belongs to topik-ai | `src/lib/export/pdf-export-quota.ts`<br>`supabase/migrations/20260707120000_pdf_export_quota.sql` | none |
| `pdf_export_quota_usages` | `user_id`, `problem_id`, `period_start`, `period_end`, `status`, `export_file_id` | write via RPC | Server-side quota ledger. A distinct problem in one PDF is charged once; failed generation is released. | no direct browser writes; SECURITY DEFINER RPC validates auth user | `src/lib/export/pdf-export-quota.ts`<br>`supabase/migrations/20260707120000_pdf_export_quota.sql` | none |
| `pdf_export_quota_resets` / `pdf_export_quota_reset_targets` | `reset_scope`, `policy_id`, `user_id`, `problem_id`, `effective_at` | read via effective policy | Reset materialization lets topik-ai reset individual, group, or global quota without v13 admin UI. | reset management is topik-ai server/admin only; users see only effective allowance | `docs/handoff-pdf-export-quota-topik-ai.md`<br>`supabase/migrations/20260707120000_pdf_export_quota.sql` | none |
| `claim_pdf_export_quota` / `commit_pdf_export_quota` / `release_pdf_export_quota` | RPC args: `p_user_id`, `p_problem_ids`, `p_usage_ids`, `p_export_file_id` | rpc | Atomically reserve, commit, or release PDF quota for `POST /api/export/pdf` and `/api/export/pdf/print`. | SECURITY DEFINER, authenticated user scoped | `src/app/api/export/pdf/route.ts`<br>`src/app/api/export/pdf/print/route.ts`<br>`supabase/migrations/20260707120000_pdf_export_quota.sql` | none |
| `study_events` | `event_type`, `export_file_id`, `payload` | write | PDF 다운로드 이벤트를 기록한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/events/study-events.ts`<br>`src/lib/export/pdf-export.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |
| `storage:generated-exports` | - | read/write | 생성된 PDF 파일을 저장하고 소유자에게만 노출한다. | owner or public bucket policy depending on bucket | `supabase/migrations/20260520121200_storage_buckets.sql` | none |

## 현재 구현 상태

- **서버 실파일 생성 적용(2026-06-12, owner 지시와 QA report 기록 기준)**:
  `POST /api/export/pdf`가 react-pdf로 PDF를 생성해 `generated-exports`의
  `exports/{user_id}/{export_id}.pdf`에 업로드하고 `export_files`를
  queued→ready(실패 시 failed)로 기록한다. 클라이언트는 본인 경로 파일을
  내려받아 저장하며, 서버 생성 실패 시 브라우저 인쇄(`window.print`)로
  폴백한다. 본문은 한국어 고정(NanumGothic 임베딩, `public/fonts/pdf/`).
- **PDF quota enforcement accepted on 2026-07-08**:
  `POST /api/export/pdf` and `POST /api/export/pdf/print` both resolve target problem ids server-side and pass through the same quota RPCs. The default policy is 3 exports per user + problem per month in `Asia/Seoul`. Direct client-side `export_files` counting or print fallback bypass is not allowed.
- 모달 UI는 hifi.png 2단 레이아웃(선택한 문제/포함할 항목/레이아웃 옵션 +
  미리보기)으로 정렬됨. 파일명·개인정보 확인은 본 문서 제약에 따라 유지.

## 코드 구현 근거

- `PdfExportModal`, `handleExport` - `src/components/library/PdfExportModal.tsx`
- `ExportPdfButton` - `src/components/library/ExportPdfButton.tsx`
- `POST /api/export/pdf` - `src/app/api/export/pdf/route.ts`
- `POST /api/export/pdf/print` - `src/app/api/export/pdf/print/route.ts`
- `buildPdfDocument`, `registerPdfFonts` - `src/lib/export/pdf-document.tsx`
- `resolvePdfExportItems` - `src/lib/export/pdf-export-server.ts`
- `claimPdfExportQuota`, `commitPdfExportQuota`, `releasePdfExportQuota` - `src/lib/export/pdf-export-quota.ts`
- `requestServerPdfExport`, `exportPdfWithPrintFallback` - `src/lib/export/pdf-export-client.ts`
- `pdfExportRequestSchema`(options 계약) - `src/lib/export/pdf-options.ts`
- `triggerPdfExport`(인쇄 폴백) - `src/lib/export/pdf-export.ts`
- `LibraryTabs` modal host - `src/components/library/LibraryTabs.tsx`

## 미구현/불일치

- PDF 템플릿/레이아웃의 운영 데이터화(표지·브랜딩 옵션)는 여전히 없음 — v1은
  코드 내 "간단 1안" 템플릿(owner 확정).
- library_selection은 저장 답안(submission) 항목만 PDF 본문으로 변환한다.
  리포트/문제 항목의 묶음 병합은 후속 협의.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/ia.md`와 화면 기능명세의 audience와 맞는다.
