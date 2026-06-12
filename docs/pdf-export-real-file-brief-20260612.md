# PDF 내보내기(F-M1) 실파일 전환 — 구현 브리프 초안

| 항목 | 내용 |
| --- | --- |
| 상태 | **구현 완료(2026-06-12)** — §3 결정 A~H 전부 owner 확정("제안대로 작업" 지시), 같은 날 구현·검증. 추가 지시: 모달 UI를 hifi.png 레이아웃으로 정렬(디자인 시스템 준수) — 반영됨 |
| 작성 | 2026-06-12 (QA 1차 수정 후속, 11-S 스텁 항목) |
| 범위 | F-M1 PDF 내보내기를 브라우저 인쇄(MVP)에서 **서버 생성 실파일 다운로드**로 전환 + 모달 hifi 정렬 |
| 스키마 변경 | **없음** — 테이블/버킷/RLS 전부 기존 계약 재사용 |
| 배포 메모 | `public/fonts/pdf/`(NanumGothic TTF·OFL)가 배포 산출물에 포함돼야 함. standalone 출력을 쓰는 배포라면 public 복사 단계 확인 |

## 1. 배경 (현재 상태)

- 현재 F-M1은 `window.print()`(브라우저 인쇄 대화상자)로 동작하는 Tier 1 MVP다
  (`src/lib/export/pdf-export.ts`, `options.source='browser_print'`,
  `storage_path='browser-print://<uuid>'`, 즉시 `status='ready'`).
- 모달 UI는 이미 완성: 파일명(≤60자)·답안 포함·피드백 포함 체크박스·개인정보
  확인·미리보기 (`src/components/library/PdfExportModal.tsx`).
- 데이터 계약도 이미 완비 (`docs/Wireframe/19-F-M1-pdf-export-modal/screen-data-summary.md`):
  - `export_files`(id, user_id, source_type, source_id, storage_path, options,
    status[queued/ready/failed], created_at, ready_at) — 마이그레이션 적용됨
  - `storage:generated-exports` private 버킷 — PDF만 허용, 경로 계약
    `exports/{user_id}/{export_id}.pdf`, 소유자 읽기/생성, 이메일 인증 강화 정책
  - `study_events` 다운로드 이벤트
- 남은 개발 = **"서버에서 실제 PDF를 만들어 버킷에 올리고 내려받게 하는 부분"** 하나.

## 2. 제안 설계 (요약)

1. **생성 엔드포인트**: Next.js Route Handler `POST /api/export/pdf`
   (사용자 세션으로 실행 — RLS가 본인 소유 submission/report만 허용).
2. **흐름(동기)**: 요청 수신 → `export_files` row 생성(`status='queued'`) →
   대상 데이터 조회(제출/피드백/리포트) → PDF 렌더 → `generated-exports`의
   `exports/{user_id}/{export_id}.pdf`에 업로드 → `status='ready'`+`ready_at` →
   응답으로 export_id 반환. 실패 시 `status='failed'`+오류 토스트(기존
   "내 보관함에서 다시 저장" 안내 재사용).
3. **다운로드**: private 버킷이므로 클라이언트가 소유자 읽기 정책으로
   `storage.download()` 후 사용자 지정 파일명으로 저장. (signed URL 인프라 불필요)
4. **PDF 렌더**: `@react-pdf/renderer` 제안(§3-A) — 헤드리스 브라우저 불필요,
   서버리스 호환. **한글 폰트 임베딩 필수**(§3-E).
5. **options JSON 확정(제안)**: `{ source: 'server_render', filename,
   include_answers, include_feedback, locale }` — 모달이 이미 수집하는 값과 1:1.
6. **기존 browser_print 경로**: 폴백으로 유지할지 제거할지 §3-B에서 결정.

## 3. 결정 질문 (owner)

| # | 질문 | 선택지 | 권장 |
| --- | --- | --- | --- |
| A | PDF 생성 기술 | ① `@react-pdf/renderer`(가볍고 서버리스 호환, 레이아웃 코드 직접 작성) ② headless 브라우저 인쇄(HTML 충실도 높음, 배포 환경 무거움) | **①** |
| B | 기존 브라우저 인쇄 | ① 실파일 성공 시 완전 대체 ② 실패 시 폴백으로 유지 | **②** (생성 실패해도 사용자가 갇히지 않음) |
| C | 동기/비동기 | ① 동기(요청 1번에 생성, 수 초 로딩) ② 비동기 잡+폴링(queued→ready) | **①** (스키마는 ②도 수용하지만 v1은 단순하게) |
| D | PDF 디자인 | 표지 유무·섹션 순서·로고/브랜딩 — 와이어프레임에 없음(문서가 "관리 구조 없음"이라 명시) | ✅ **owner 확정(2026-06-12): 간단 1안** — 표지 없음, [제목→점수→답안→피드백] 순서, 상단 TALKPIK 로고만. 구현 후 실물 보고 다듬기 |
| E | PDF 본문 언어 | ① 한국어 고정 ② 사용자 ui_locale 따라감(ko/en/vi) | **①** (v1, 한글 폰트만 임베딩. ②는 폰트 3종 임베딩 필요) |
| F | 유료 잠금 | 와이어프레임 이탈 경로에 "유료 잠금은 X-03" 존재. 실파일 내보내기를 ① 전체 공개 ② 유료 전용(X-03 페이월 연동) | ✅ **owner 확정(2026-06-12): ① 전체 공개** (결제 연동이 스텁인 동안 잠그지 않음) |
| G | 파일 보존 | ① v1은 무기한 보존(정리 없음) ② N일 후 자동 삭제(스케줄러 필요) | **①** (②는 cron 인프라가 필요해 알림 발송과 같은 선행 결정 발생) |
| H | 재시도 정책 | 실패 후 재시도 시 ① 새 export row 생성 ② 같은 row 재사용 | **①** (이력 보존, 문서의 "검수 필요 항목" 해소) |

## 4. 범위 밖 (이번 작업 아님)

- PDF 템플릿을 운영 데이터로 관리(DB화) — 문서상 "스키마 보강 필요", v1은 코드 내 템플릿
- library_selection(여러 항목 묶음 내보내기)의 병합 PDF — v1은 submission/report 단건 우선, 묶음은 owner 협의
- 파일 정리 스케줄러(§3-G ②), 다국어 PDF(§3-E ②)

## 5. 수용 기준 (acceptance criteria)

1. E-01/E-02/R-01/F-01에서 PDF 내보내기 → `generated-exports`에 실파일 생성 →
   브라우저 다운로드 성공 (한글 깨짐 없음)
2. `export_files`에 queued→ready(또는 failed) 상태 전이와 options가 정확히 기록
3. 타인 소유 source_id로 요청 시 RLS 거부(403/빈 결과) — 파일 미생성
4. 생성 실패 시 사용자에게 실패 토스트 + (B-② 채택 시) 브라우저 인쇄 폴백 제공
5. `pnpm typecheck` · `pnpm test`(렌더러 단위 테스트 포함) · `pnpm test:e2e` 풀 GREEN
   (F-M1 e2e를 실파일 다운로드 단언으로 갱신)
6. 문서 갱신: F-M1 functional-spec/screen-data-summary "현재 구현 상태",
   QA 보고서 11-S 표의 PDF 행

## 6. Docs consulted

- `docs/Wireframe/19-F-M1-pdf-export-modal/{description,functional-spec,screen-data-summary}.md`
- `src/lib/export/pdf-export.ts`, `src/components/library/PdfExportModal.tsx`
- `supabase/migrations/20260520120700_library_events_exports.sql`,
  `20260520121200_storage_buckets.sql`, `20260520121300_storage_policies.sql`,
  `20260527113000_storage_email_confirmed_hardening.sql`
- `docs/qa/reports/qa-report-20260612-1205.html` §11-S
