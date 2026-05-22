# Phase 6 — Admin, Library, Hardening (Light Spec, rev2)

> rev1 (2026-05-22): Codex Round 1에서 P1 8건 + P2 6건 fix 반영.
> rev2 (2026-05-22): Codex Round 2 잔여 P1 4건 + 신규 P1 2건 fix:
> profiles_admin_all 좁힘 / export library_selection 분기 / next.config 순서 / dimension enum DB 정본 / audit_logs 컬럼 정정 / recommendation_items.status.

## Phase

- ID: phase-6-admin-library-hardening
- Phase row of `docs/ai-workflow/development-phases.md`: 6 (final Tier 1 MVP phase)
- Started: 2026-05-21 (rev1: 2026-05-22)
- Owner: Claude Code (Opus 4.7, 1M context)

## Goal

Tier 1 MVP의 나머지 sitemap-active routes(Admin × 3, Library + Export, Weakness, Next problem, Retry modal, Settings × 3, Profile)를 RLS 안에서 작동시키고, Phase 3/4/5에서 누적된 hardening follow-ups를 모두 해소한다. 권한 분리(content/org/platform admin), 정책 ownership 강화, KPI RPC, payload validator까지 포함한다.

## Out of Scope (deferred)

### Phase 6 자체 OOS — Tier 2 / 인프라 영역

| ID | Item | Defer to |
| --- | --- | --- |
| OOS-1 | 실제 LLM Edge Function (mock-v1 → real) | 인프라 / Tier 2 |
| OOS-2 | Realtime subscriptions (autosave conflict, presence) | Tier 2 |
| OOS-3 | Stripe/billing integration (X-03 paywall, X-04 subscription) | Tier 2 |
| OOS-4 | Playwright e2e suite | Tier 2 |
| OOS-5 | Admin problem CREATE/EDIT UI (Phase 6는 list + publish toggle만) | Tier 2 |
| OOS-6 | export_files queue worker (Phase 6는 browser-side PDF + options.source 마커) | Tier 2 |
| OOS-7 | i18n translation files (UI 라벨만 ko, 인프라 미준비) | Tier 2 |
| OOS-8 | Granular admin audit UI + getAuditLogs() 서버 함수 | Tier 2 |
| OOS-9 | Notification 인프라 (X-09 settings는 form만, transport는 미구현) | Tier 2 |
| OOS-10 | Server-side analytics ingestion (study_events write는 OK, dashboard 표시 외 통계 집계는 미구현) | Tier 2 |
| OOS-11 | Bulk operations (admin user mass-update, library batch export 등) | Tier 2 |
| OOS-12 | **Edge Function service-role JWT 임퍼소네이션** (Phase 5 RPC service_role grant 철회) | Tier 2, 실 LLM 도입 시 |

### 이미 다른 Phase에 소속된 routes (Phase 6 스코프 외)

| Code | Route | Phase |
| --- | --- | --- |
| X-01 ~ X-06 | landing/auth/dashboard/practice/writing/feedback/comparison | Phase 2–5 완료 |

## Core Functionality

1. **Hardening batch (Phase 3/4/5 carry-forward + Codex Round 1 fix)**:
   - **R-INSERT-PATH (P1-4 강화)**: `writing_submissions`의 owner_insert RLS 정책 `drop ... if exists` + 명시적 `with check (false)` deny 정책. RPC `submit_writing_with_feedback` (SECURITY DEFINER owner=postgres BYPASSRLS) 단독 경로.
   - **R-RPC-CAST → P1-8 validator**: Phase 5 RPC에 `private.assert_submission_payload()` helper 도입. UUID/integer 범위/dimension enum/필수 필드 모두 검증 후 raise.
   - **R-SERVICE-ROLE-GRANT (P1-3 결정 변경)**: Phase 5 RPC에 service_role grant 추가하지 **않음**. Edge Function 경로는 OOS-12로 deferred — 향후 별도 RPC + JWT 임퍼소네이션 도입.
   - **R-DEAD-INVALIDATE**: `useSubmitWriting`의 redundant invalidateQueries 정리.
   - **B5 cache headers (P1-6)**: `next.config.ts` 의 `headers()` async 함수로 이전 (proxy.ts 미들웨어는 static asset 제외 matcher라 불가능). 정적 asset에 `Cache-Control: public, max-age=31536000, immutable`, dynamic은 `no-store`.
   - **Dashboard KPI (P1-1, P2-6)**: `get_dashboard_kpi()` **인자 없음** (cross-user 누출 차단). 본문에서 `auth.uid()` + `(now() at time zone 'Asia/Seoul')::date` 으로 KST day-boundary 보존.
2. **Admin (H-01/X-08/X-10) — 권한 분리 (P1-2)**:
   - 신규 helper 3개: `private.is_platform_admin(uid)`, `private.is_content_admin(uid)`, `private.is_org_admin(uid)`. 기존 `private.is_admin(uid)`는 Phase 2-5 RLS 호환을 위해 유지.
   - `/admin/problems` (content admin): list + 행별 publish/archive 토글. CREATE/EDIT는 OOS-5.
   - `/admin/org` (org admin): KPI + 최근 study_events.
   - `/admin/users` (platform admin): 사용자 리스트 + role/status 변경. admin_audit_logs에 모든 변경 기록. **content_admin이 platform_admin으로 권한 상승 불가**.
   - 페이지 helper: `requirePlatformAdmin/requireContentAdmin/requireOrgAdmin` — 페이지별로 명시.
3. **Library + Export (F-01/F-M1) — ownership 강화 (P1-5)**:
   - `/library`: 4 tabs (submissions / reports / saved problems / exports). `library_items` polymorphic 조회.
   - **신규 RLS**: insert/update에 참조 FK 소유 EXISTS 검증. submission/report/attempt는 user_id 일치, problem은 publish_status='published' 또는 author_id 일치. 남의 submission_id 저장 시도 → reject.
   - F-M1 PDF export: browser print-to-PDF (`window.print()`) + `export_files` row (status='ready', `options.source='browser_print'`, storage_path='browser-print://uuid'). UI는 source 마커로 "다시 인쇄" 버튼 표시.
4. **Weakness + Next (X-07/R-02) — fallback 명시 (P1-7)**:
   - `/practice/weakness`: 5건 이상 dimension만 평균 → 하위 2개. **fallback**: dimension count <5 → empty + CTA. recommendation_items 비면 `problems.tags && weak_tags` 직접 쿼리.
   - `/practice/next`: 1차 recommendation_items, 2차 same question_no 다음 problem, 3차 random published. 모두 fail → "오늘은 자유롭게" CTA.
5. **C-03 Retry modal** (practice/problems hosted):
   - 이미 푼 문제 클릭 시 "다시 풀기 / 결과 보기 / 취소" modal.
6. **Settings/Profile fill (G-01/X-09/X-05)**:
   - `/settings/language`: `profiles.ui_locale` (ko/en/vi).
   - `/settings/notifications`: form + `profiles.notification_prefs jsonb not null default '{}'::jsonb check (jsonb_typeof = 'object')`. 허용 키는 코드 레벨 fallback. Transport는 OOS-9.
   - `/profile`: display_name, nickname. avatar는 OOS.
7. **study_events 도입 — 카탈로그 통일 (P2-3)**: 마이그레이션 정본 8종 그대로 채택:
   `practice_started`, `attempt_submitted`, `draft_autosaved`, `submission_submitted`, `feedback_viewed`, `report_viewed`, `recommendation_clicked`, `export_downloaded`.
8. **admin_audit_logs 도입**: 모든 admin role change / publish toggle을 audit log에 기록 (admin_user_id=auth.uid()).
9. **Types snapshot extension (P2-1)**: **4 신규 테이블** (`library_items`, `export_files`, `study_events`, `admin_audit_logs`) + **1 컬럼** (`profiles.notification_prefs`) hand-align.

## Routes (Active)

- `/admin/problems` (H-01, content admin), `/admin/org` (X-08, org admin), `/admin/users` (X-10, platform admin)
- `/library` (F-01) — 4-tab 구조
- `/practice/weakness` (X-07), `/practice/next` (R-02) — fallback 포함
- `/practice/problems`의 retry modal (C-03 hosted)
- `/settings/language` (G-01), `/settings/notifications` (X-09), `/profile` (X-05)

## State Model (light)

- TanStack Query mutations: `useToggleProblemPublish`, `useChangeUserRole`, `useSaveLibraryItem`, `useDeleteLibraryItem`, `useUpdateProfile`, `useUpdateLocale`, `useUpdateNotificationPrefs`
- Server Actions: `toggleProblemPublishAction` (content), `changeUserRoleAction` (platform) — 모두 SECURITY DEFINER RPC 경유, audit log write 보장
- study_events write는 fire-and-forget (mutation onSuccess hook)

## Data Touched

- 신규 typed: library_items, export_files, study_events, admin_audit_logs, profiles.notification_prefs 컬럼
- 신규 마이그레이션:
  - `20260521140000_phase_6_rpc_and_admin.sql` — admin role helpers 3개 + RLS ownership 강화 + writing_submissions insert deny + `assert_submission_payload` + `get_dashboard_kpi` (인자 없음, KST) + admin RPCs (권한 분리)
  - `20260521141000_phase_6_notification_prefs.sql` — `notification_prefs jsonb not null default '{}'::jsonb` + object check
- 새 함수:
  - `private.is_platform_admin(uid)`, `private.is_content_admin(uid)`, `private.is_org_admin(uid)` — STABLE SECURITY DEFINER
  - `private.assert_submission_payload(jsonb, jsonb, jsonb)` — validator
  - `public.get_dashboard_kpi()` — 인자 없음, KST timezone, returns table
  - `public.admin_change_user_role(target_id, new_role)` — platform admin only
  - `public.admin_toggle_problem_publish(problem_id, new_status)` — content admin
- **변경 안 함**: `src/proxy.ts` (P1-6 → next.config.ts로 이전)

## User Flow Anchor

```
/library    → 4 tabs (submissions/reports/saved/exports) → PDF export (options.source='browser_print')
/practice/weakness → bottom-2 dimension recs (또는 empty CTA)
/practice/next     → 3단 fallback (rec → same Q → random published)
/practice/problems → 이미 푼 문제 클릭 → C-03 retry modal
/admin/users    → platform admin → role change → audit log
/admin/problems → content admin → publish toggle → audit log
/admin/org      → org admin → KPI dashboard
/settings/{language,notifications}, /profile → form-based edits
```

## File Structure (target)

- 신규 `src/lib/admin/` → server.ts, queries.ts, mutations.ts, server-actions.ts, types.ts
- 신규 `src/lib/auth/admin-guard.ts` → requirePlatformAdmin / requireContentAdmin / requireOrgAdmin
- 신규 `src/lib/library/` → server.ts, queries.ts, mutations.ts, types.ts
- 신규 `src/lib/export/` → pdf-export.ts (browser print + options.source='browser_print')
- 신규 `src/lib/practice/weakness.ts` + extension to `src/lib/practice/queries.ts` (next-problem)
- 신규 `src/lib/settings/` → server.ts + mutations.ts
- 신규 `src/lib/events/` → study-events.ts (8종 카탈로그)
- 신규 `src/components/admin/`, `src/components/library/`, `src/components/practice/RetryModal.tsx`, `src/components/settings/`, `src/components/profile/`
- 페이지 채우기: `/admin/{problems,org,users}/page.tsx`, `/library/page.tsx`, `/practice/{weakness,next}/page.tsx`, `/settings/{language,notifications}/page.tsx`, `/profile/page.tsx` 모두 thin (≤40 lines)
- 수정: `next.config.ts` (headers), `src/lib/learning/kpi.ts` (RPC + dayjs 제거), `src/lib/writing/mutations.ts` (dead invalidate), `src/lib/supabase/types.ts` (4 신규 + 1 컬럼)

## Acceptance (machine + manual)

- 자동: `pnpm typecheck` + `pnpm lint` + `pnpm test` PASS, build의 모든 신규 route 컴파일, `node scripts/ai-workflow-check.mjs --repo .` PASS, headers() unit test PASS.
- 수동: platform admin role change → audit log row 생성, content_admin이 /admin/users 접근 → redirect, /library 4 tab 전환 + 남의 submission 저장 시도 → reject, /practice/weakness 5건 미만 → empty CTA, 충분한 경우 하위 2 dimension, /settings/language change → ui_locale 변경, PDF 출력 시 print dialog open + options.source='browser_print'.
- Architecture Pass: route handler/page는 thin (≤40 lines), domain code는 `src/lib/{admin,library,export,settings,events}/` 분리, TanStack hook은 "use client" 한정.
