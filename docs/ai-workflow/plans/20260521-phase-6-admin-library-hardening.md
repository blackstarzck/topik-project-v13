# Phase 6 — Admin, Library, Hardening Plan (rev4)

> rev1 (2026-05-22): Codex Round 1 PASS Gate에서 P1 8건 + P2 6건이 잡혀 plan을 전면 수정함.
> 변경 요약: (a) admin role helper 3개 신설로 권한 mismatch 해소, (b) get_dashboard_kpi 인자 제거,
> (c) RPC service_role grant 철회 + OOS-12 신설, (d) drop policy 안전화, (e) library/export/event
> 정책에 참조 FK ownership 검증 추가, (f) cache headers는 next.config.ts로 이전, (g) weakness/next
> 폴백 정의, (h) jsonb payload validator 명세화.
>
> rev2 (2026-05-22): Codex Round 2가 잔여 P1 4건 + 신규 P1 2건을 추가 적발.
> 변경 요약: (i) `profiles_admin_all` 정책을 `is_platform_admin`으로 좁힘 — content_admin의
> profile 직접 update 차단, (j) `export_files` library_selection 분기 정책 추가, (k)
> next.config.ts headers 규칙 순서 교정(catch-all 제외), (l) dimension enum을 DB 정본
> 6종(`grammar/vocab/structure/content/expression/topic_fit`)으로 정정, (m) admin_audit_logs
> 컬럼 정확히 매핑(`diff`/`payload`/`target_table`/`target_id`), (n) recommendation_items 쿼리는
> `status='active'` + run.expires_at join.
>
> rev3 (2026-05-22): Codex Round 3가 잔여 SELECT-side leak 1건 + 검증 갭 2건 적발.
> 변경 요약: (o) `profiles_self_select` 정책의 admin OR branch도 `is_platform_admin`으로 좁힘 —
> content/org admin이 모든 profile 행 select 불가, (p) validator의 weakness_level 범위를
> DB 정본인 1-5로 정정 (feedback.sql:43), (q) cache headers 단위 테스트에서 `/dashboard`
> 헤더 검증 제거 — dynamic page no-store는 App Router 기본 위임이므로 단위 테스트 불가능.
>
> rev4 (2026-05-22): Codex Round 4가 `/admin/org` 데이터 경로 누락 발견. org_admin이 페이지
> gate는 통과하나 study_events SELECT 정책은 `is_admin()` (content/platform)만 허용. 변경:
> (r) `get_admin_org_dashboard()` SECURITY DEFINER RPC 신설 — org_admin/platform_admin 검증 후
> KPI aggregate + 최근 study_events 100건 일괄 반환. study_events 정책은 변경 안 함.

## Architecture (one paragraph + 한 줄 SBU)

Phase 6는 Tier 1 MVP의 마지막 phase로, 누적된 hardening follow-ups를 모두 정리하고 sitemap의 나머지 active routes(Admin × 3, Library + Export, Weakness, Next, Retry modal, Settings × 3, Profile)를 채운다. 신규 마이그레이션 두 개로 (a) Phase 5 RPC 본문 강화 + writing_submissions self-INSERT revoke + library/export/study_events 정책에 ownership 검증 + `get_dashboard_kpi`(인자 없음, KST 보존) + 권한 분리된 admin RPCs + 3개 권한 helper(`is_platform_admin`/`is_content_admin`/`is_org_admin`), (b) `profiles.notification_prefs` 컬럼(NOT NULL DEFAULT '{}'::jsonb + object check)을 추가한다. Admin 작업은 모두 SECURITY DEFINER RPC 경유로 `admin_audit_logs`에 자동 기록된다. PDF export는 Phase 6 한정으로 browser print-to-PDF에 `options.source='browser_print'` 마커로 구분(실 storage queue는 OOS-6). `study_events` 로깅은 마이그레이션이 frozen한 8종 카탈로그 그대로 client-side fire-and-forget으로 도입된다. Edge Function service-role 임퍼소네이션 경로는 OOS-12로 deferred(Phase 5 RPC service_role grant 철회).

**Vertical SBU (smallest buildable unit)**:
사용자가 `/library`에서 4 탭을 전환하며 저장된 submissions/reports/saved problems/exports를 본다. 각 항목 행 "PDF로 내보내기" → `window.print()` + `export_files` ledger row(options.source='browser_print') + study_event 기록. Admin은 `/admin/users`에서 user list → role change → admin_audit_logs 자동 기록(platform_admin only). `/practice/weakness`는 `feedback_dimension_scores` 5건 이상 dimension의 하위 2개 추천 카드, 데이터 부족 시 빈 상태 + CTA. `/settings/language`에서 `profiles.ui_locale` 변경 → 즉시 반영. 이 흐름 전체가 vitest mock + Architecture Pass + Plan-Review PASS Gate Round 2로 검증된다.

## Docs Consulted

- `docs/spec.md` §State Management, §Persistence
- `docs/sitemap.md` Lines 50-58 (H/X/F/G/X-* 미완 routes)
- `docs/Wireframe/*` (admin/library/weakness/next/settings 각 폴더)
- `docs/flow/user-flow.md` (admin/library 흐름)
- `supabase/migrations/{20260520120700_library_events_exports,20260520120800_audit,20260520120900_functions,20260520121100_rls_policies}.sql`
- `supabase/migrations/20260521130000_phase_5_writing_rpc.sql` (Phase 5 RPC — Phase 6에서 hardening)
- `src/lib/auth/roles.ts` (ADMIN_ROLES = content/org/platform — `private.is_admin()`와 불일치)
- `src/proxy.ts` (matcher가 static asset 제외 → cache header 불가)
- `src/lib/learning/kpi.ts` (KST timezone 로직 보존 대상)
- `docs/ai-workflow/runs/2026/05/21/20260521-1700-phase-5-writing-feedback.md` §Risks
- `docs/ai-workflow/runs/2026/05/21/20260521-1200-residual-risks-cleanup.md`
- `docs/ai-workflow/runs/2026/05/21/20260521-1800-phase-6-admin-library-hardening.md` §Codex Round 1 Findings (이 plan rev1의 동기)
- `docs/ai-workflow/light-specs/phase-6-admin-library-hardening.md` rev1 (본 phase 정본)

## Plan-Review PASS Gate (record)

| Round | Verdict | Catch | Action |
| --- | --- | --- | --- |
| 1 (Codex pre-impl, 2026-05-22) | FAIL — 8 P1 + 6 P2 | ledger §Codex Round 1 Findings | rev1 작성 (완료) |
| 2 (Codex pre-impl, rev1, 2026-05-22) | FAIL — 6 P1 (4 잔여 + 2 신규) | ledger §Codex Round 2 Findings | rev2 작성 (완료) |
| 3 (Codex pre-impl, rev2, 2026-05-22) | FAIL — 1 P1 (신규 SELECT leak) + 2 P2 | ledger §Codex Round 3 Findings | rev3 작성 (완료) |
| 4 (Codex pre-impl, rev3, 2026-05-22) | FAIL — 1 P1 (`/admin/org` 데이터 경로 누락) | ledger §Codex Round 4 Findings | rev4 작성 (완료) |
| 5 (Codex pre-impl, rev4, 2026-05-22) | **PASS** (0 P1, 2 P2 advisory) | ledger §Codex Round 5 Findings | rev4에 P2 2건 fix 인라인 반영 |

## Smallest Buildable Unit

위 §Architecture 두 번째 단락 참조. 4탭 library → PDF export (browser_print marker) → admin role change (platform_admin) → audit log → weakness recommendation (with fallback) → settings/profile fill 전체 종단 흐름.

## Out of Scope — Intentional Cuts

| ID | Item | Defer to |
| --- | --- | --- |
| OOS-1 | 실제 LLM Edge Function | 인프라 / Tier 2 |
| OOS-2 | Realtime | Tier 2 |
| OOS-3 | Stripe/billing | Tier 2 |
| OOS-4 | Playwright e2e | Tier 2 |
| OOS-5 | Admin problem create/edit UI | Tier 2 |
| OOS-6 | export_files queue worker | Tier 2 |
| OOS-7 | i18n translation files | Tier 2 |
| OOS-8 | Admin audit view UI + `getAuditLogs()` 서버 함수 | Tier 2 |
| OOS-9 | Notification transport | Tier 2 |
| OOS-10 | Server-side analytics 집계 | Tier 2 |
| OOS-11 | Bulk operations | Tier 2 |
| OOS-12 | **Edge Function service-role JWT 임퍼소네이션** (Phase 5 RPC `service_role` grant 철회됨) | Tier 2, 실 LLM 도입 시 |

## File Structure (target)

- 신규 SQL:
  - `supabase/migrations/20260521140000_phase_6_rpc_and_admin.sql` — admin role helpers 3개 + RLS hardening + RPC body 강화 + `get_dashboard_kpi` + admin RPCs + validator helper
  - `supabase/migrations/20260521141000_phase_6_notification_prefs.sql` — `profiles.notification_prefs` 컬럼
- 신규 도메인: `src/lib/{admin,library,export,settings,events}/`, 확장 `src/lib/practice/{weakness,next}.ts`
- 신규 컴포넌트: `src/components/{admin,library,settings,profile}/` + `src/components/practice/RetryModal.tsx`, `NextProblemView.tsx`, `WeaknessView.tsx`
- 페이지 채우기: `/admin/{problems,org,users}/page.tsx`, `/library/page.tsx`, `/practice/{weakness,next}/page.tsx`, `/settings/{language,notifications}/page.tsx`, `/profile/page.tsx` (모두 thin ≤40 lines)
- 수정:
  - `next.config.ts` (cache header — proxy.ts 대신 next.config의 `headers()` async function 사용)
  - `src/lib/learning/kpi.ts` (RPC 호출로 단축, KST 로직은 SQL에서 보존)
  - `src/lib/writing/mutations.ts` (dead invalidate 제거)
  - `src/lib/supabase/types.ts` (4 신규 테이블 + 1 컬럼 hand-align)
  - `src/lib/auth/profile.ts` 또는 `src/lib/auth/admin-guard.ts` (requirePlatformAdmin / requireContentAdmin / requireOrgAdmin helper 분리)
- **수정 안 함**: `src/proxy.ts` (P1-6 해소 — cache header는 next.config.ts에서)

## Verification Strategy

자동 gate (모두 PASS 필수):

- `pnpm install --frozen-lockfile`
- `pnpm typecheck` — 0 errors
- `pnpm lint` — 0 errors, 0 warnings
- `pnpm test` — 신규 + 통합 모두 GREEN (docker gated 제외)
- `pnpm build` — 모든 신규 route 컴파일 + next.config.ts headers 적용 확인
- `node scripts/ai-workflow-check.mjs --repo .` — PASS

수동 gate:

- Architecture Pass grep: 도메인 cross-import 0, supabase 직접 import 0 outside lib, TanStack hook only in "use client"
- 페이지 thin (≤40 lines)
- next.config.ts headers() 결과 확인: 정적 asset(`/_next/static/*`)에 `Cache-Control: public, max-age=31536000, immutable` 응답 헤더. dynamic page는 App Router 기본 응답(별도 검증 안 함)

## Tasks

| # | Title | Status | Audience | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- | --- |
| 0 | Hardening migration 140000 (admin helpers + RLS + RPC + KPI + admin RPCs) | pending | both | N — schema/security 변경 |
| 0b | Notification prefs migration 141000 | pending | user | N — schema |
| 1 | Hardening code (next.config.ts cache headers, kpi.ts RPC, mutations dead invalidate, admin-guard 분리) | pending | both | N — cross-phase contract |
| 2 | types.ts 4 신규 테이블 + notification_prefs 컬럼 (fallback hand-align) | pending | n/a | N — shared snapshot |
| 3 | src/lib/admin/ (server + queries + mutations + server-actions + types) | pending | admin | Y — isolated domain |
| 4 | src/lib/library/ (server + queries + mutations + types) | pending | user | Y — isolated |
| 5 | src/lib/export/pdf-export.ts (browser print + study_event + options.source='browser_print') | pending | user | Y — pure helper |
| 6 | src/lib/practice/{weakness,next}.ts (fallback 포함) | pending | user | Y — pure helpers |
| 7 | src/lib/settings/ + src/lib/events/study-events.ts | pending | user | Y — pure |
| 8 | UI components (admin × 3, library × 4, settings × 3, profile, retry/next/weakness views) | pending | both | Y — independent |
| 9 | Pages (admin × 3, library, practice × 2, settings × 2, profile) | pending | both | N — RLS-bound fetch composition |
| 10 | Integration tests (admin role change + library save + weakness aggregate + redirect matrix) | pending | both | N — multi-page |
| 11 | Full verification (lint/test/build/checker) | pending | n/a | N — main session |
| 12 | Cross-model review (Opus + Codex) | pending | n/a | N — main session |

---

### Task 0 — Hardening migration 140000 (P1-1/2/3/4/5/8 + P2-2/3/6 모두 반영)

- [ ] **Step 1: Admin role helpers (P1-2)** — `private.is_platform_admin(uid)` / `private.is_content_admin(uid)` / `private.is_org_admin(uid)` 세 함수 추가.
  - `is_platform_admin`: app_role in ('platform_admin') AND status='active'
  - `is_content_admin`: app_role in ('content_admin', 'platform_admin') AND status='active'
  - `is_org_admin`: app_role in ('org_admin', 'platform_admin') AND status='active'
  - 모두 SECURITY DEFINER + STABLE + `revoke all from public; grant execute to authenticated`
  - 기존 `private.is_admin(uid)` 는 그대로 유지(Phase 2-5 RLS 호환)
- [ ] **Step 1b: profiles 정책 좁힘 — admin all + self_select 양쪽 (P1-2 잔여, rev3)**
  ```sql
  -- (1) admin write 경로: platform_admin만, RPC 경유 강제 (P1-2 잔여, rev2 시작)
  drop policy if exists profiles_admin_all on public.profiles;
  create policy profiles_platform_admin_all on public.profiles
    for all to authenticated
    using ( private.is_platform_admin((select auth.uid())) )
    with check ( private.is_platform_admin((select auth.uid())) );
  -- content_admin / org_admin은 admin_change_user_role RPC를 통해서만 role 변경 가능

  -- (2) admin read 경로도 좁힘 (P1-3R3 SELECT leak, rev3 신규)
  -- 기존 profiles_self_select는 OR private.is_admin(...) 분기로 content/org admin이 모든
  -- profile 행을 select 가능했음. 그 분기를 is_platform_admin으로 축소.
  drop policy if exists profiles_self_select on public.profiles;
  create policy profiles_self_select on public.profiles
    for select to authenticated
    using ( id = (select auth.uid()) or private.is_platform_admin((select auth.uid())) );
  -- /admin/org KPI는 행 PII select가 아니라 count(*) aggregate이므로 영향 없음.
  -- 향후 org_admin이 본인 org의 user list를 봐야 한다면 별도 SECURITY DEFINER RPC 도입.
  ```
- [ ] **Step 2: writing_submissions self-INSERT 정책 안전 제거 (P1-4)**
  - `drop policy if exists writing_submissions_owner_insert on public.writing_submissions;`
  - 마이그레이션 주석에 명시: "Phase 5 SECURITY DEFINER 함수의 owner는 postgres(BYPASSRLS) 이므로 FORCE RLS 아래에서도 insert 통과. 신뢰 경로는 `submit_writing_with_feedback` RPC 단독."
  - 회귀 방지를 위해 explicit deny 정책 추가:
    ```sql
    create policy writing_submissions_no_direct_insert on public.writing_submissions
      for insert to authenticated with check (false);
    ```
  - Phase 5 RPC가 여전히 동작하는지 vitest mock + (docker 있을 시) integration test.
- [ ] **Step 3: Phase 5 RPC payload validator (P1-8, rev2 — dimension enum DB 정본 채택)**
  - `private.assert_submission_payload(submission jsonb, dimensions jsonb, sentences jsonb)` SECURITY DEFINER helper 도입.
  - 검증 항목:
    - submission.problem_id REQUIRED, `jsonb_typeof = 'string'`, UUID 캐스팅 검사(잘못된 형식이면 raise 'invalid problem_id')
    - submission.question_no REQUIRED, integer **in (51,52,53,54)** (TOPIK 글쓰기 문항 정본 — writing.sql:47 매칭, rev4 self-catch: rev1~3의 "1-5" 표현 오류 정정)
    - submission.char_count REQUIRED, integer >= 0
    - submission.answer_text REQUIRED, text non-empty
    - submission.draft_id OPTIONAL, UUID 캐스팅 가능 시만 허용
    - dimensions이 array면 각 원소:
      - **`dimension in ('grammar','vocab','structure','content','expression','topic_fit')` — DB CHECK 정본(feedback.sql:39)**
      - score/score_max 음수 금지
      - **weakness_level: null 또는 integer 1-5 (DB 정본 feedback.sql:43, rev3 — rev2의 "1-3"는 오류)**
    - sentences가 array면 각 원소: sentence_index integer >= 0
  - `submit_writing_with_feedback` 본문 진입부에서 호출 → 실패 시 명시적 raise.
  - **types.ts에 동일 enum tuple export. 단위 테스트로 SQL CHECK = TS enum 동일성 검증(dimension + weakness_level range 모두 cover).**
- [ ] **Step 4: Library/Export/study_events ownership 검증 (P1-5)**
  - `library_items_owner_all` 교체:
    ```sql
    drop policy if exists library_items_owner_all on public.library_items;
    create policy library_items_owner_select on public.library_items
      for select to authenticated using (user_id = (select auth.uid()));
    create policy library_items_owner_insert on public.library_items
      for insert to authenticated with check (
        user_id = (select auth.uid()) and (
          (item_type = 'attempt'    and exists (select 1 from public.problem_attempts    where id = attempt_id    and user_id = (select auth.uid()))) or
          (item_type = 'submission' and exists (select 1 from public.writing_submissions where id = submission_id and user_id = (select auth.uid()))) or
          (item_type = 'report'     and exists (select 1 from public.comparison_reports  where id = report_id     and user_id = (select auth.uid()))) or
          (item_type = 'export'     and exists (select 1 from public.export_files        where id = export_id     and user_id = (select auth.uid()))) or
          (item_type = 'problem'    and exists (select 1 from public.problems            where id = problem_id    and (publish_status = 'published' or author_id = (select auth.uid()))))
        )
      );
    create policy library_items_owner_update on public.library_items
      for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
    create policy library_items_owner_delete on public.library_items
      for delete to authenticated using (user_id = (select auth.uid()));
    ```
  - `export_files_owner_all` 교체 (P1-5 잔여, rev2 — library_selection 분기 명시):
    ```sql
    drop policy if exists export_files_owner_all on public.export_files;
    create policy export_files_owner_select on public.export_files
      for select to authenticated using (user_id = (select auth.uid()));
    create policy export_files_owner_insert on public.export_files
      for insert to authenticated with check (
        user_id = (select auth.uid()) and (
          (source_type = 'submission' and source_id is not null
             and exists (select 1 from public.writing_submissions where id = source_id and user_id = (select auth.uid()))) or
          (source_type = 'report' and source_id is not null
             and exists (select 1 from public.comparison_reports where id = source_id and user_id = (select auth.uid()))) or
          (source_type = 'library_selection' and source_id is null)
          -- library_selection은 단일 즉시 export. source_id NULL 강제로 cross-user 참조 차단.
        )
      );
    create policy export_files_owner_update on public.export_files
      for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
    create policy export_files_owner_delete on public.export_files
      for delete to authenticated using (user_id = (select auth.uid()));
    ```
  - `study_events_owner_insert` 교체: problem_id/submission_id/attempt_id 가 non-null이면 caller 소유여야 함
- [ ] **Step 5: get_dashboard_kpi RPC — 인자 없음 + KST 보존 (P1-1, P2-6)**
  ```sql
  create or replace function public.get_dashboard_kpi()
  returns table (today_attempts int, total_attempts int, exam_days_left int, streak_days int)
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  stable
  as $$
  declare
    caller_id uuid := auth.uid();
    today_kst date := (now() at time zone 'Asia/Seoul')::date;
    today_start timestamptz := (today_kst::timestamp at time zone 'Asia/Seoul');
    today_end   timestamptz := ((today_kst + interval '1 day')::timestamp at time zone 'Asia/Seoul');
    exam_date date;
  begin
    if caller_id is null then raise exception 'unauthenticated'; end if;
    -- ...today_attempts, total_attempts, exam_days_left, streak_days 계산 본문...
    return query select ...;
  end; $$;
  revoke all on function public.get_dashboard_kpi() from public;
  grant execute on function public.get_dashboard_kpi() to authenticated;
  ```
  - 인자 없음 → cross-user 누출 차단(P1-1).
  - streak_days 계산은 SQL CTE로 KST date 기준 distinct day 후 연속 카운트.
- [ ] **Step 6: admin_change_user_role RPC (P1-2, rev2 — audit_logs 컬럼 정정)**
  - 권한: `private.is_platform_admin(auth.uid())` 만 통과
  - `new_role in ('learner','content_admin','org_admin','platform_admin')` enum 검증
  - target_id != auth.uid() 안전장치 (자기 자신 platform 박탈 방지는 별도 OOS)
  - profiles.app_role 업데이트 + admin_audit_logs insert. **컬럼 정본**(audit.sql:7-16):
    ```sql
    insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
    values (
      caller_id,
      'profile.role_change',
      'profiles',
      target_id::text,
      jsonb_build_object('from', old_role, 'to', new_role),
      jsonb_build_object('target_user_id', target_id)
    );
    ```
- [ ] **Step 7: admin_toggle_problem_publish RPC (P1-2, rev2 — audit_logs 컬럼 정정)**
  - 권한: `private.is_content_admin(auth.uid())`
  - `new_status in ('draft','published','archived')` enum
  - problems.publish_status 업데이트 + admin_audit_logs insert:
    ```sql
    insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
    values (
      caller_id,
      'problem.publish_change',
      'problems',
      problem_id::text,
      jsonb_build_object('from', old_status, 'to', new_status),
      '{}'::jsonb
    );
    ```
- [ ] **Step 8: Phase 5 RPC service_role grant 철회 (P1-3)**
  - 기존 `grant execute ... to authenticated` 만 유지
  - service_role grant 추가하지 **않음**. Edge Function 도입 시 OOS-12로 별도 RPC + JWT 임퍼소네이션 패턴 도입 예정 — 마이그레이션 주석에 명시.
- [ ] **Step 8b: get_admin_org_dashboard RPC (rev4, P1-R4 fix)**
  - 권한: `private.is_org_admin(auth.uid())` (org_admin 또는 platform_admin) 만 통과
  - 반환: KPI aggregate + recent study_events 100건을 한 번에 (round-trip 절감)
  ```sql
  create or replace function public.get_admin_org_dashboard()
  returns table (
    learner_count int,
    active_7d_count int,
    submissions_7d_count int,
    recent_events jsonb
  )
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  stable
  as $$
  declare
    caller_id uuid := auth.uid();
  begin
    if caller_id is null then raise exception 'unauthenticated'; end if;
    if not private.is_org_admin(caller_id) then raise exception 'forbidden'; end if;

    return query
    select
      (select count(*)::int from public.profiles where app_role = 'learner') as learner_count,
      (select count(distinct user_id)::int from public.problem_attempts
         where started_at >= (now() - interval '7 days')) as active_7d_count,
      (select count(*)::int from public.writing_submissions
         where submitted_at >= (now() - interval '7 days')) as submissions_7d_count,
      (select coalesce(jsonb_agg(jsonb_build_object(
                'event_type', se.event_type,
                'occurred_at', se.occurred_at,
                'user_id', se.user_id,                   -- intended: org_admin sees which learner
                'payload', se.payload                    -- contract: payload MUST NOT contain raw writing content; client helper scrubs (Task 7 study-events.ts)
              ) order by se.occurred_at desc), '[]'::jsonb)
         from (
           select * from public.study_events
           order by occurred_at desc limit 100
         ) se) as recent_events;
  -- semantics note (rev4, P2-R5-NEW-2 fix):
  -- 7d aggregates use rolling 168h (`now() - interval '7 days'`), not KST day boundary.
  -- "최근 7일 활동" 표현으로 UI 라벨 통일. KST 일별 집계가 필요해지면 Tier 2에서 별도 RPC.
  end; $$;
  revoke all on function public.get_admin_org_dashboard() from public;
  grant execute on function public.get_admin_org_dashboard() to authenticated;
  ```
  - **핵심**: SECURITY DEFINER가 study_events RLS를 bypass (owner=postgres BYPASSRLS). study_events 정책 자체는 변경 안 함.
  - `/admin/org` 페이지는 `supabase.rpc('get_admin_org_dashboard')` 한 번만 호출.
  - `submissions_7d_count` 계산을 위해 `writing_submissions.submitted_at` 컬럼 존재 가정 — Task 2 단계에서 schema 확인. 없으면 `created_at` 또는 별도 컬럼 사용.
- [ ] **Step 9: SQL syntax 검사** (실 실행은 SUPABASE_LOCAL_STACK gated)

### Task 0b — Notification prefs migration 141000 (P2-5)

- [ ] Step 1: `alter table public.profiles add column if not exists notification_prefs jsonb not null default '{}'::jsonb;`
- [ ] Step 2: `alter table public.profiles add constraint profiles_notification_prefs_is_object check (jsonb_typeof(notification_prefs) = 'object');`
- [ ] Step 3: 허용 키 enum (예: `weekly_summary`, `feedback_ready`, `study_reminder`)은 코드 레벨 fallback. 마이그레이션 주석에 명시.

### Task 1 — Hardening code (P1-6 + admin-guard 분리)

- [ ] Step 1 (P1-6, rev2 — catch-all 제거): `next.config.ts` 의 `headers()` async 함수 추가. **catch-all `/:path*` 금지** — Next.js는 later rule이 same path를 override하므로 `/_next/static/*` 요청이 두 규칙 모두 매치하면 마지막 catch-all이 immutable을 덮어버린다. 정적 자산만 명시:
  ```ts
  async headers() {
    return [
      { source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/icon.svg',            headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, must-revalidate' }] },
      { source: '/favicon.ico',         headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, must-revalidate' }] },
      // dynamic page no-store는 Next.js App Router 기본(서버 RSC)에 위임. catch-all 사용 안 함.
    ];
  }
  ```
  - **src/proxy.ts는 손대지 않음.**
  - 검증: `tests/integration/cache-headers.test.ts` 에서 `/_next/static/foo.js`, `/icon.svg`, `/favicon.ico` 의 응답 헤더만 어서트. **`/dashboard` 같은 dynamic page no-store는 App Router 기본 위임이라 단위 테스트 불가능 — 검증 대상에서 제외(rev3)**. 통합/E2E 환경에서만 확인.
- [ ] Step 2: `src/lib/learning/kpi.ts` — `getDashboardKpi`를 `supabase.rpc("get_dashboard_kpi")` (인자 없음)로 단축. 기존 KST 클라이언트 로직은 SQL이 담당하므로 dayjs import 제거. 기존 vitest 케이스는 RPC mock으로 갱신하여 그대로 PASS.
- [ ] Step 3: `src/lib/writing/mutations.ts` — `useSubmitWriting`의 onSuccess invalidateQueries 정리(redundant 호출 제거).
- [ ] Step 4: `src/lib/auth/admin-guard.ts` 신설 — `requirePlatformAdmin()`, `requireContentAdmin()`, `requireOrgAdmin()` helper 분리. 페이지별 호출:
  - `/admin/users` → requirePlatformAdmin
  - `/admin/problems` → requireContentAdmin
  - `/admin/org` → requireOrgAdmin
  - 모두 미충족 시 redirect to `/dashboard?error=forbidden`

### Task 2 — types.ts 4 신규 테이블 + 1 컬럼 (P2-1)

- [ ] Step 1: `tests/lib/supabase/phase-6-types.test.ts` RED — `library_items`, `export_files`, `study_events`, `admin_audit_logs` 키 + `profiles.notification_prefs` 컬럼 검증.
- [ ] Step 2: `src/lib/supabase/types.ts`에 hand-align. 주석 갱신 + fallback evidence(supabase gen types 결과와 동기화 여부).
- [ ] Step 3: typecheck GREEN.

### Task 3 — Admin domain

- [ ] Step 1: `src/lib/admin/types.ts` — `AdminUserRow`, `AdminProblemRow`. (`AuditLogRow`는 OOS-8로 제거)
- [ ] Step 2: `src/lib/admin/server.ts` — `listAdminUsers(filter)` (platform admin), `listAdminProblems(filter)` (content admin). RLS는 `private.is_*_admin` helper 적용된 정책 의존. `getAuditLogs()` 함수는 도입하지 않음(OOS-8).
- [ ] Step 3: `src/lib/admin/queries.ts` — query keys + client fetch.
- [ ] Step 4: `src/lib/admin/server-actions.ts` ("use server") — `changeUserRoleAction` (platform), `togglePublishAction` (content). 모두 SECURITY DEFINER RPC 경유.
- [ ] Step 5: `src/lib/admin/mutations.ts` — TanStack mutations wrap Server Actions.
- [ ] Step 6: 단위 테스트 — query key shape, role enum validation, admin-guard redirect 매트릭스.

### Task 4 — Library domain

- [ ] Step 1: `src/lib/library/types.ts` — `LibraryTab` ('submissions'|'reports'|'problems'|'exports'), `LibraryItemView` polymorphic discriminated. **참고**: `attempt` item_type은 Phase 6에서 surface 안 함 (Tier 2). `submissions` 탭은 writing_submissions 기준.
- [ ] Step 2: `src/lib/library/server.ts` — `listLibraryItems(userId, tab)` (server). 별도 fetch + JS 결합.
- [ ] Step 3: `src/lib/library/queries.ts` — `useLibraryItems(tab)` + key.
- [ ] Step 4: `src/lib/library/mutations.ts` — `useSaveLibraryItem`, `useDeleteLibraryItem`, `useUpdateItemTags`. RLS가 ownership 검증하므로 client mutation 안전.
- [ ] Step 5: 단위 테스트 — 남의 submission_id 저장 시도 → RLS reject 동작 확인 mock.

### Task 5 — Export domain (P2-2)

- [ ] Step 1: `src/lib/export/pdf-export.ts` — `triggerPdfExport({sourceType, sourceId})` :
  - `export_files` insert: `{ user_id, source_type, source_id, storage_path: 'browser-print://' || gen_random_uuid()::text, status: 'ready', options: { source: 'browser_print' }, ready_at: now() }`
  - `window.print()` 호출
  - `study_event` 기록 ('export_downloaded')
- [ ] Step 2: 단위 테스트 — mock window.print, fixture로 options.source='browser_print' 마커 검증.
- [ ] Step 3: Library `LibraryExportsTab`은 `options.source === 'browser_print'` 행에 대해 "다운로드" 대신 "다시 인쇄" 버튼 표시.

### Task 6 — Practice extensions (P1-7 fallback 명시)

- [ ] Step 1: `src/lib/practice/weakness.ts` — `getWeakDimensions(userId, threshold=5)`:
  - feedback_dimension_scores에서 user의 5건 이상 dimension만 평균
  - 하위 2개 dimension 반환
  - **fallback**: dimension count < 5 → empty 반환 (UI는 CTA로 "더 많은 글쓰기로 약점 분석을 받아보세요")
  - **추천 problem fallback**: recommendation_items 없을 시 `problems where publish_status='published' and tags && weak_dimension_tags limit 3` 직접 쿼리
- [ ] Step 2: `src/lib/practice/next.ts` — `getNextProblem(userId)` (rev2 — schema 컬럼명 정정):
  - 1차: `recommendation_items` (status='active') join `recommendation_runs` (runs.expires_at is null OR runs.expires_at > now())에서 rank=1 1건
  - 2차: 직전 problem_attempts → same question_no의 다음 published problem
  - 3차: 모든 published problem 중 미수행 1건 random
  - 모두 fail → null + UI는 "오늘은 자유롭게 골라보세요" CTA
- [ ] Step 3: 단위 테스트 — fallback chain 각 단계 trigger.

### Task 7 — Settings + events (P2-3 카탈로그 정본 채택)

- [ ] Step 1: `src/lib/settings/server.ts` + `mutations.ts` — `getProfileSettings(userId)`, `useUpdateLocale`, `useUpdateNotificationPrefs`, `useUpdateProfile`.
- [ ] Step 2: `src/lib/events/study-events.ts` — `logStudyEvent({eventType, payload})` fire-and-forget. **PII contract (rev4, P2-R5-NEW-1)**: payload는 ID/메타만 (problem_id, submission_id, attempt_id, recommendation_item_id 등). **answer_text, draft 본문, feedback narrative 같은 raw writing content는 payload에 절대 넣지 않음** — org_admin이 KPI dashboard에서 평문으로 볼 수 있기 때문. 헬퍼는 runtime guard로 길이 검사(>500 chars → throw dev assertion). **eventType enum** (migration 정본 그대로):
  ```ts
  export type StudyEventType =
    | 'practice_started'
    | 'attempt_submitted'
    | 'draft_autosaved'
    | 'submission_submitted'
    | 'feedback_viewed'
    | 'report_viewed'
    | 'recommendation_clicked'
    | 'export_downloaded';
  ```
  - light-spec/plan과 마이그레이션 주석을 모두 이 8종으로 일치시킴.

### Task 8 — UI components

- [ ] Admin: `AdminUserTable`, `AdminUserRoleMenu`, `AdminProblemTable`, `AdminProblemPublishToggle`, `AdminOrgKpiCards`.
- [ ] Library: `LibraryTabs`, `LibrarySubmissionsTab`, `LibraryReportsTab`, `LibrarySavedProblemsTab`, `LibraryExportsTab` (browser_print 마커 분기), `LibraryItemRow`, `ExportPdfButton`.
- [ ] Practice: `WeaknessView` ("use client", empty state CTA 포함), `NextProblemView` (3단 fallback UI), `RetryModal`.
- [ ] Settings: `LanguageForm`, `NotificationPrefsForm`.
- [ ] Profile: `ProfileForm`.
- [ ] 단위 테스트 — RetryModal 분기, LibraryTabs URL state, ExportPdfButton 호출 시퀀스, WeaknessView empty state.

### Task 9 — Pages

- [ ] 8개 페이지 모두 thin: `requirePlatformAdmin/requireContentAdmin/requireOrgAdmin` (admin) 또는 `requireUser` (그 외) + fetch + delegate to content component.

### Task 10 — Integration tests

- [ ] `tests/integration/admin-flow.test.ts` — content_admin이 /admin/users 접근 → redirect, org_admin이 /admin/problems 접근 → redirect, platform_admin role change Server Action mock 호출 검증.
- [ ] `tests/integration/library-flow.test.ts` — 4 tab 전환, save/delete mutation, **남의 submission_id 저장 시도 → RLS reject** 케이스, PDF export options.source='browser_print' 마커 검증.
- [ ] `tests/integration/weakness-flow.test.ts` — 5건 미만 user는 empty state, 충분한 user는 하위 2 dimension 표시, recommendation_items 비어있을 때 fallback tag query 동작.
- [ ] `tests/integration/cache-headers.test.ts` — next.config headers() 결과 단위 검증 (mock NextResponse).

### Task 11 — Full verification

자동 + 수동 gates 모두.

### Task 12 — Cross-model review

Opus + Codex 병렬, P1/P2 triage. (Plan rev1 자체는 Codex Round 2로 사전 검증)

## Risks (rev1)

- **R-SCOPE-LARGE (P2)**: Phase 6 한 PR이 매우 크다(예상 ~55개 파일 — admin-guard, validator helper 추가). OOS 12건으로 압축했지만 review 부담↑. 분할 PR 옵션 고려했으나 사용자 요청으로 single PR.
- **R-RPC-CASCADE (P1 → 해결됨)**: writing_submissions self-INSERT revoke + explicit deny 정책으로 강제. 기존 Phase 5 code는 RPC만 사용 ✓. Edge Function 도입 시 OOS-12로 별도 경로.
- **R-PRINT-PDF-LIMITS (P2)**: `window.print()`는 browser feature. SSR/headless에서 NoOp. options.source='browser_print' 마커로 UI 분기 → "다시 인쇄" 버튼.
- **R-ADMIN-AUDIT-CHURN (P2)**: 모든 admin action이 audit_logs insert를 트리거. 대량 user import는 OOS-11.
- **R-NOTIFICATION-NULL-DEFAULT (해결됨)**: `not null default '{}'::jsonb + check object` 로 nullable 제거. UI 코드 fallback은 missing key→false.
- **R-FORCE-RLS-DEFINER (신규, P1-4 잔재)**: postgres role의 BYPASSRLS 가정. Supabase 호스팅 환경에서 함수 owner가 변경되는 경우 회귀 가능 → 마이그레이션 주석으로 명시 + integration test (docker gated)에서 RPC insert 통과 확인.
- **R-RECOMMENDATION-EMPTY (신규, P1-7 잔재)**: recommendation_items ingestion이 OOS이므로 fallback tag query에 의존. tag 매칭 데이터 품질에 영향.
- **R-VALIDATOR-ENUM-DRIFT (해결됨, rev2)**: dimension 정본 6종(`grammar/vocab/structure/content/expression/topic_fit`)을 feedback.sql:39 그대로 채택. types.ts와 1:1 매핑 + 단위 테스트로 drift 차단.
- **R-PROFILE-ADMIN-LEAK (해결됨, rev2)**: `profiles_admin_all` 정책을 `is_platform_admin`으로 좁혀 content_admin이 다른 user의 app_role을 직접 update할 수 없도록 차단. RPC 경유 강제.
- **R-EXPORT-LIB-SEL (해결됨, rev2)**: `export_files.source_type='library_selection'`은 source_id NULL 강제로 cross-user 참조 차단.
- **R-NEXT-CONFIG-OVERRIDE (해결됨, rev2)**: catch-all `/:path*` 규칙 제거로 Next.js header rule 마지막-매치 우선 트랩 회피.
- **R-AUDIT-COLUMN-DRIFT (해결됨, rev2)**: admin_audit_logs 컬럼 정본 매핑(`diff`/`payload`/`target_table`/`target_id`) — `metadata` 라는 컬럼은 없음.
- **R-REC-ITEMS-COLUMN (해결됨, rev2)**: `recommendation_items.status='active'` + run.expires_at 사용. `consumed` 컬럼은 존재하지 않음.

## Lightweight Path Decision

❌ Not eligible. 신규 마이그레이션 2건 + 4 신규 도메인 + 8 신규 페이지 + 다수 RPC + RLS 강화. Full workflow.
