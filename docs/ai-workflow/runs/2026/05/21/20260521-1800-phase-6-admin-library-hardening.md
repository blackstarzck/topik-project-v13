# Phase 6 — Admin, Library, Hardening Ledger

## Run Metadata

- Run id: 20260521-1800-phase-6-admin-library-hardening
- Created: 2026-05-21 18:00 KST
- Updated: 2026-05-22 (Codex Round 1 FAIL → plan rev1 진행 중)
- Main session owner: Claude Code (Opus 4.7, 1M context)
- Host: Claude Code
- Status: active (Plan-Review PASS Gate Round 5 PASS — 구현 착수 준비 완료)
- Phase: 6-admin-library-hardening (final Tier 1 MVP phase)
- Session continuity: 2026-05-21 18:11 KST 중단 → 2026-05-22 PC 자동 재부팅 후 재개

## Task

- User goal: Tier 1 MVP 종결 — sitemap의 나머지 active routes + Phase 3/4/5 hardening follow-ups + Phase 6 본 영역(Admin + Library + Weakness + Next + Settings + Profile + study_events + audit logs).
- Accepted scope: light spec의 Core Functionality 9개 + plan의 13 task. Real LLM/Realtime/Stripe/Playwright/i18n은 OOS.
- Out of scope: 11 OOS items (Phase 6 light spec table) + 이미 Phase 2-5 완료된 routes.
- Current next action: Codex pre-plan review (PASS Gate), 그 후 자동 batch.

## Plan-Review PASS Gate (record)

| Round | Verdict | Catch | Action |
| --- | --- | --- | --- |
| 1 (Codex pre-impl, 2026-05-22) | FAIL — 8 P1 + 6 P2 | 아래 §Codex Round 1 Findings 참조 | Plan rev1 작성 중 |
| 2 (Codex pre-impl, plan rev1) | pending | — | — |

## Codex Round 1 Findings (2026-05-22)

Reviewer: codex-cli 0.128.0, consult mode, reasoning=medium. Prompt: light-spec + plan 임베드 + 마이그/소스 파일 8개 직접 읽기 지시. ~30K tokens 사용.

### P1 — 구현 전 필수 (검증 완료)

| ID | 요약 | 증거 |
| --- | --- | --- |
| P1-1 | `get_dashboard_kpi(uid)` 가 `uid = auth.uid()` 검증 없이 SECURITY DEFINER + grant authenticated → cross-user KPI 누출 | plan task 0 step 1.4 누락 |
| P1-2 | `private.is_admin()`는 content/platform만, `ADMIN_ROLES`는 org_admin 포함 → 권한 mismatch. 또 `admin_change_user_role`이 `is_admin()`만 쓰면 content_admin이 platform_admin으로 권한 상승 가능 | functions.sql:24, roles.ts:15 |
| P1-3 | Phase 5 RPC service_role grant 무의미. RPC는 `auth.uid()` 사용 → service-role JWT 없으면 caller_id null로 raise | phase_5_writing_rpc.sql:21,138 |
| P1-4 | `drop policy writing_submissions_owner_insert` 안전성 미증명. FORCE RLS 아래 SECURITY DEFINER bypass 보장 + `if exists` 누락 | rls_policies.sql:170,178 |
| P1-5 | library_items/export_files/study_events 정책이 user_id만 검증, 참조 FK 소유 미검증 → 남의 submission을 자기 라이브러리로 저장 가능 | rls_policies.sql:273,304,292 |
| P1-6 | proxy.ts cache-header 추가 불가능 — matcher가 _next/static + asset 확장자 일체 제외 | proxy.ts:64-66 |
| P1-7 | weakness/next는 recommendation_items 의존하나 ingestion이 OOS → 빈 화면. fallback 누락 | spec.md 미정 |
| P1-8 | jsonb_typeof 가드 너무 모호 — UUID/numeric/필수/dimension enum/음수 검증 안 됨 | phase_5_writing_rpc.sql:36-46 |

### P2 — 권고 (rev1에서 함께 반영)

- P2-1: "5 신규 typed tables" 문구 모호 → 4 tables + 1 column 으로 수정
- P2-2: `export_files.status='ready'` + `storage_path='browser-print://...'` 거짓말. options.source='browser_print' 마커로 변경
- P2-3: study_events event 이름 불일치 — 마이그레이션 카탈로그(8종) 정본 채택
- P2-4: `getAuditLogs()` 제거 — OOS-8과 충돌
- P2-5: notification_prefs 스키마 계약 명시 (not null default '{}'::jsonb + jsonb_typeof = 'object')
- P2-6: get_dashboard_kpi 본문에 Asia/Seoul day-boundary 명시 (kpi.ts 기존 로직 보존)

Cross-model: Claude main session 동의 — 8/8 P1 모두 factual, 직접 파일 read로 확인.

## Codex Round 2 Findings (2026-05-22)

rev1 적용 후 재리뷰. PASS Gate Round 2 결과: **FAIL — 6 P1 (잔여 4 + 신규 2) + 1 P2**.

### 잔여 P1 (rev1 fix가 불충분)

| ID | 요약 | 증거 |
| --- | --- | --- |
| P1-2 잔여 | `profiles_admin_all` 정책이 여전히 `private.is_admin()` 사용 → content_admin이 RPC 우회로 다른 user의 app_role 직접 update 가능 | rls_policies.sql:39-44 |
| P1-5 잔여 | `export_files.source_type='library_selection'` ownership 미정의 + source_id nullable. rev1의 EXISTS 분기가 library_selection을 다루지 않음 | rev1 plan task 0 step 4 |
| P1-6 | next.config.ts `headers()`에서 `/:path*` catch-all `no-store`가 마지막에 오면 Next.js의 later-rule-override 규칙으로 `_next/static` immutable을 덮음 | https://nextjs.org/docs/app/api-reference/config/next-config-js/headers |
| P1-8 잔여 | dimension enum이 DB 정본과 다름. rev1 plan: `('grammar','vocabulary','content','organization','spelling')` / DB feedback.sql:39 정본: `('grammar','vocab','structure','content','expression','topic_fit')` | feedback.sql:39 |

### 신규 P1 (rev1이 새로 도입)

| ID | 요약 | 증거 |
| --- | --- | --- |
| P1-NEW-1 | `admin_change_user_role` audit insert에 `metadata` 컬럼 사용 — admin_audit_logs에는 `(action, target_table, target_id, diff, payload)` 컬럼만 있고 metadata 없음. RPC 실행 시 SQL error | audit.sql:7-16 |
| P1-NEW-2 | `getNextProblem` 쿼리가 `recommendation_items.consumed`, `expires_at`을 사용. 실제 schema는 `status (active/consumed/expired)` 컬럼이고 `expires_at`는 `recommendation_runs`에 있음 | recommendations.sql:30-41 |

### P2 (advisory)

- P2-NEW: `study_events.event_type`은 DB에서 자유 텍스트 (CHECK constraint 없음). Client enum이 잘못된 event_type을 막지 못함. 마이그레이션 주석에 카탈로그 명시는 했으나 DB 강제 없음. Phase 6에서 CHECK 추가 가능(한 줄). 선택사항.

Cross-model: 모두 schema 파일 직접 read로 검증 완료.

## Plan rev2 적용 (2026-05-22)

Codex Round 2 6 P1 + 1 P2를 모두 plan에 반영:
- `profiles_admin_all` → `profiles_platform_admin_all` (is_platform_admin)
- export_files insert 정책에 `library_selection + source_id is null` 분기 추가
- next.config.ts `headers()`에서 catch-all 제거 (정적 자산 명시만)
- dimension enum 정본 6종 채택 + types.ts와 1:1 매핑 단위 테스트
- admin_audit_logs insert 컬럼 정정 (`action/target_table/target_id/diff/payload`)
- `getNextProblem` 쿼리는 `status='active'` + run.expires_at join
- (P2-NEW) study_events.event_type CHECK 추가는 plan rev3 후 결정 (선택)

다음: Codex Round 3.

## Codex Round 3 Findings (2026-05-22)

PASS Gate Round 3 결과: **FAIL — 1 P1 + 2 P2**. Round 2의 6 P1 모두 [VERIFIED].

### 신규 P1

| ID | 요약 | 증거 |
| --- | --- | --- |
| P1-R3-NEW | `profiles_self_select` 정책이 여전히 `is_admin()` 분기 — content/org admin이 모든 profile 행 select 가능 | rls_policies.sql:20-24 |

### P2 (advisory)

- P2-R3-NEW-1: validator의 weakness_level 범위 1-3 → DB CHECK는 1-5 (feedback.sql:43)
- P2-R3-NEW-2: `/dashboard` 헤더 단위 테스트 불가 (catch-all 제거 후 App Router 기본 위임) — 검증 scope 명시 필요

## Plan rev3 적용 (2026-05-22)

- `profiles_self_select` 좁힘: admin OR 분기를 `is_platform_admin`으로 변경
- validator weakness_level 1-3 → 1-5 정정
- cache 단위 테스트에서 `/dashboard` 제거 — 통합/E2E 환경 위임

## Codex Round 4 Findings (2026-05-22)

PASS Gate Round 4 결과: **FAIL — 1 P1**. Round 3 finding 3건 모두 [VERIFIED].

### 신규 P1

| ID | 요약 | 증거 |
| --- | --- | --- |
| P1-R4-NEW | `/admin/org` 데이터 경로 누락. org_admin이 페이지 gate는 통과하나 study_events SELECT 정책은 `is_admin()`(content/platform)만 허용 — org_admin은 study_events 못 읽음 | rls_policies.sql:286-290 |

## Plan rev4 적용 (2026-05-22)

- `get_admin_org_dashboard()` SECURITY DEFINER RPC 신설 — `is_org_admin` 검증 후 KPI aggregate + 최근 study_events 100건 일괄 반환. study_events 정책 자체는 변경 안 함.
- self-catch (Codex 미적발): validator의 `question_no` 정본은 1-5가 아니라 **(51,52,53,54)** TOPIK 글쓰기 4문항(writing.sql:47). 정정.

다음: Codex Round 5.

## Codex Post-Impl Review Findings (2026-05-22)

implementation 완료 후 spot-check. PASS Gate Round 6 (post-impl) 결과: **FAIL — 1 P1 + 2 P2**.

### 신규 P1 (구현 단계에서만 드러난 결함)

| ID | 요약 | 증거 | Fix |
| --- | --- | --- | --- |
| P1-POST-1 | `study-events.ts`의 PII 가드가 production에서는 `console.warn`만 하고 원본 payload를 그대로 insert → forbidden key가 누출 가능 | study-events.ts:84-89, 142-166 | `sanitizePayloadForInsert()` 추가, logStudyEvent가 sanitized payload만 insert. dev throws + prod strips + warns 패턴. 23 tests PASS |

### P2 (RLS는 정확, plan 표현만 부정확)

| ID | 요약 | 정정 |
| --- | --- | --- |
| P2-POST-1 | library_items `problem` save 정책이 plan 표현 "any published problem"보다 strict (published+public 또는 author). 실제로는 problems 정책과 정확히 일치 — 의도된 동작 | plan 표현을 "사용자가 볼 수 있는 published problem"으로 정정. RLS 변경 없음 |
| P2-POST-2 | study_events.problem_id 같은 패턴 | 동일 |

## Plan PASS Gate 통과 + Post-Impl Fix 완료 (2026-05-22)

총 6 라운드 (5 pre + 1 post) 누적 결과:
- Pre-impl Round 1-4: 16 P1 + 14 P2 잡힘 → plan rev1~4
- Pre-impl Round 5: PASS (0 P1, 2 P2 advisory)
- Post-impl Round 6: 1 P1 + 2 P2 → study-events sanitizer 추가 + plan 표현 정정

자동 검증 결과:
- pnpm typecheck: 0 errors
- pnpm lint: 0 errors (4 trivial warnings — unused eslint-disable)
- pnpm test: 346 passed / 3 skipped / 0 failed
- pnpm build: PASS (모든 신규 route 컴파일)
- node scripts/ai-workflow-check.mjs: PASS

Architecture Pass 결과:
- 8 페이지 모두 thin (≤40 lines, /admin/org는 24 lines)
- supabase 직접 import: src/lib 내부 + src/proxy.ts (middleware) 만 — 도메인 boundary OK
- 도메인 cross-import: 0건
- TanStack hook: "use client" 한정 ✓

신규 파일 ~55개 (마이그 2 + lib 5도메인 + admin-guard + UI 16+ + 페이지 8 수정 + 테스트 다수). 구현 완료.

PASS Gate Round 5 결과: **PASS — 0 P1, 2 P2 advisory**. Round 4 신규 RPC + question_no self-catch 모두 [VERIFIED] (8개 verification 항목 통과).

### 검증 통과 (Round 5 verify list 8건)

- P1-R4-NEW (get_admin_org_dashboard RPC) ✓
- is_org_admin이 platform_admin 포함 ✓
- writing_submissions.submitted_at 컬럼 존재 ✓
- SECURITY DEFINER가 좁힌 profiles_self_select bypass ✓
- jsonb_agg ORDER BY 정확히 적용 ✓
- question_no in (51,52,53,54) self-catch ✓
- search_path/revoke/grant 정확 ✓
- 마이그레이션 ordering (helper → RPC) ✓

### P2 advisory (rev4 인라인 fix)

- P2-R5-NEW-1: recent_events PII 노출 → study-events.ts client helper에 payload contract 추가 (ID/메타만, raw content 금지, runtime guard)
- P2-R5-NEW-2: 7d aggregate semantics 모호 → "rolling 168h" 명시 + UI 라벨은 "최근 7일 활동"

## Plan PASS Gate 통과 (2026-05-22)

5 라운드 누적 결과:
- Round 1: FAIL 8 P1 + 6 P2 → rev1 작성
- Round 2: FAIL 6 P1 (4 잔여 + 2 신규) → rev2 작성
- Round 3: FAIL 1 P1 (신규 SELECT leak) + 2 P2 → rev3 작성
- Round 4: FAIL 1 P1 (admin/org 경로) → rev4 작성 + self-catch (question_no)
- Round 5: PASS 0 P1 + 2 P2 advisory → rev4 인라인 fix

구현 착수 준비 완료. 다음: Task 0 마이그레이션 작성.



## Docs Consulted

- `docs/spec.md` §State Management, §Persistence
- `docs/sitemap.md` Lines 50-58 (H/X/F/G/X-* 미완 routes)
- `docs/IA/{H-01,X-08,X-10,F-01,F-M1,X-07,R-02,C-03,G-01,X-09,X-05}/description.md`
- `docs/flow/user-flow.md` (admin/library 흐름)
- `supabase/migrations/{20260520120700_library_events_exports,20260520120800_audit,20260520120900_functions,20260520121100_rls_policies,20260521130000_phase_5_writing_rpc}.sql`
- `docs/ai-workflow/runs/2026/05/21/20260521-1700-phase-5-writing-feedback.md` §Risks
- `docs/ai-workflow/light-specs/phase-6-admin-library-hardening.md`
- Extracted requirements:
  - 8 active routes (admin × 3, library, practice × 2, settings × 2, profile)
  - 5 신규 typed tables (library_items, export_files, study_events, admin_audit_logs, profiles.notification_prefs 컬럼)
  - 2 신규 마이그레이션 (Phase 5 RPC hardening + KPI RPC + admin RPCs + notification_prefs column)
  - study_events fire-and-forget logging 핵심 흐름 6종
  - admin_audit_logs 자동 기록 (모든 admin role/publish change)
- Doc conflicts: none
- Untouched relevant docs and reason: none

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-21 18:00 | 한 PR로 Phase 6 전체 진행 (분할 X) | 사용자 요청 "나머지 phase 도 작업시작해줘. 모두 마무리되면 깃에 커밋" | 사용자 |
| 2026-05-21 18:00 | Admin problem CRUD는 OOS-5로 deferred — list + publish toggle만 | Tier 2 영역, full editor는 큰 작업 | sitemap H-01 base scope |
| 2026-05-21 18:00 | PDF export는 browser print fallback — 실 storage queue OOS-6 | docker/storage 미연동, browser feature로 1차 만족 | F-M1 spec |
| 2026-05-21 18:00 | Notification은 form + profiles.notification_prefs 컬럼만 — transport OOS-9 | 인프라(SES/FCM 등) 미준비 | X-09 IA |
| 2026-05-21 18:00 | writing_submissions self-INSERT 정책 revoke로 RPC 유일 경로 강제 | Phase 5 Codex P2 R-INSERT-PATH 해소 | Phase 5 ledger |
| 2026-05-21 18:00 | dashboard kpi 4 fetch → 1 RPC | Phase 3 carry-forward dashboard 최적화 | Phase 3 ledger |

## Active Files

- Files expected to change/create: plan §File Structure 참조 (예상 ~50개 신규/수정)
- Files inspected: 위 Docs Consulted + 11 IA descriptions
- Files changed: (없음 — 진행 전)
- Files explicitly not to touch:
  - `src/lib/auth/*` (Phase 2 그대로)
  - `src/lib/{supabase/{browser,server,env},routes}.ts` (Phase 2/3 그대로)
  - Phase 4 learning + Phase 5 writing UI/도메인 (kpi.ts RPC 호출로 단축만)
  - `scripts/ai-workflow-check.mjs`, workflow docs (Phase 6 scope 외)

## Agent Assignments

| Agent | Role | Scope | Status | Packet |
| --- | --- | --- | --- | --- |
| Claude Code Opus 4.7 (main) | 조정 + 구현 | plan 전체 | active | this ledger |
| codex (gstack) | 사전 plan 리뷰어 | plan + light spec + RLS + RPC | pending | task packet — plan path + scope |
| TBD (Opus subagent + codex) | post-impl cross-model review | 구현 완료 diff | pending | Phase 5 패턴 |

## Verification State

- Required checks: pnpm install/lint/typecheck/test/build + workflow checker
- Checks run: (없음 — 진행 전)
- Latest results: n/a
- Known failures: n/a
- Skipped checks and reason: SUPABASE_LOCAL_STACK gated integration (docker 부재)
- Cross-model review: pre-plan pending (Codex), post-impl pending
- Architecture Pass: pending
- Light Spec: docs/ai-workflow/light-specs/phase-6-admin-library-hardening.md

## Fallback State

- Normal path blocked: none yet
- Failure class: none
- Fallback used: n/a
- Evidence collected: n/a
- Completion allowed: pending
- Remaining fallback risk:
  - SUPABASE_LOCAL_STACK 통합 테스트 skip 유지 (docker 부재)
  - PDF storage queue는 OOS-6 — Phase 6는 browser print로 한정

## Ledger/File-State Consistency

- Files changed match accepted scope: pending
- Docs consulted match implemented behavior: pending
- Child result packets integrated: pending
- Verification state current: pending
- Remaining risks listed: yes (R-SCOPE-LARGE, R-RPC-CASCADE, R-PRINT-PDF-LIMITS, R-ADMIN-AUDIT-CHURN, R-NOTIFICATION-NULL-DEFAULT)

## Risks And Follow-Up

- Remaining risks: (plan §Risks 참조)
- Assumptions:
  - 기존 RLS가 library_items/export_files/study_events에 owner-all/insert 모두 허용 (마이그레이션 121100 확인됨)
  - private.is_admin(uid) helper 이미 존재 (마이그레이션 120900)
- Follow-up needed:
  - Plan-Review PASS Gate 결과 적용
  - 사용자 commit/PR 결정
  - Tier 2: OOS-1~11 항목 (Real LLM, Realtime, Stripe, Playwright, full admin CRUD, export queue worker, i18n, audit view, notification transport, server analytics, bulk ops)
