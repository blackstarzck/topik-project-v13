# topik-ai ↔ v13 overlap data reconciliation plan

> Status: planning artifact only
>
> Created: 2026-06-08
>
> Scope: separate `topik-ai` admin app data/backend transition toward v13 Supabase for overlap entities only. No implementation, migration, install, test run, or live DB write is included in this document.

## 1. 결론 요약

- `docs/admin-scope-boundary.md` 기준으로 2026-06-08 현재 overlap integration gate는 열려 있다.
- 허용 범위는 `members/profiles`, `problems/question-bank`, `payments read-only` 세 영역뿐이다.
- v13은 concrete schema source of truth다. 확정 기준은 `supabase/migrations/*.sql`, `docs/development/database-schema.md`, `docs/supabase-table-inventory.md`, 그리고 현재 source usage다.
- topik-ai는 admin candidate contract와 UI/source boundary source다. 실제 DB migration source가 아니라 `docs/specs/*`, `docs/page-sync/*`, `src/features/**`의 후보 계약으로 취급한다.
- 전환 방향은 topik-ai UI를 v13으로 포팅하는 것이 아니라, topik-ai의 data layer가 v13 Supabase schema/RLS/RPC 경계에 맞도록 읽기 우선으로 붙는 것이다.
- 실데이터 write는 아직 시작하지 않는다. write가 필요한 경우에도 직접 table write가 아니라 owner-approved audited RPC/RLS 경계를 거쳐야 한다.
- 결제는 `subscription_plans`, `subscriptions`, `payment_history` read inventory까지만 허용한다. 환불, 결제 취소, withdraw/deleted semantics, billing provider write는 별도 owner approval gate다.

## 2. 고정 문서 목록

이번 계획의 고정 기준 문서는 아래 순서로 본다.

| 구분 | 문서/파일 | 역할 |
| --- | --- | --- |
| v13 top-level contract | `AGENTS.md` | 한국어 응답, docs 우선, admin scope boundary 준수, 검증 기반 완료 보고 |
| v13 docs index | `docs/README.md` | 프로젝트 문서 진입점 |
| admin boundary | `docs/admin-scope-boundary.md` | overlap gate와 frozen scope 판정 |
| cross-app method | `docs/user-admin-consistency-method.md` | schema/admin contract 우선순위와 reconciliation 절차 |
| current inventory | `docs/user-admin-data-consistency.md` | v13 DB object ↔ topik-ai page-sync current overlap inventory |
| prior design proposal | `docs/admin-integration-plan.md` | Phase A/B/C/D 방향, role/enum/gate 후보 |
| v13 schema | `docs/development/database-schema.md` | profiles/problems/billing/RLS/audit 확정 설명 |
| v13 Supabase inventory | `docs/supabase-table-inventory.md` | table/RPC/storage current inventory |
| v13 migration index | `supabase/migrations/INDEX.md` | migration order와 schema provenance |
| v13 auth/security | `docs/development/backend-auth.md`, `docs/development/auth-overview.md` | Supabase key boundary, role/RLS/RPC 기준 |
| topik-ai data transition | `C:\Users\admin\Desktop\workspace\topik-ai\docs\architecture\admin-data-source-transition.md` | mock/store/service 경계와 전환 원칙 |
| topik-ai admin contract | `C:\Users\admin\Desktop\workspace\topik-ai\docs\specs\admin-data-contract.md` | admin candidate entities, fields, enums |
| topik-ai page gaps | `C:\Users\admin\Desktop\workspace\topik-ai\docs\specs\admin-page-gap-register.md` | page-local dummy, hardcoded actor, unresolved action gaps |
| topik-ai audit contract | `C:\Users\admin\Desktop\workspace\topik-ai\docs\specs\admin-action-log.md` | Target Type/Target ID expectations |
| topik-ai page sync | `C:\Users\admin\Desktop\workspace\topik-ai\docs\page-sync\*.md` | admin page별 related user surface와 CRUD 후보 |

## 3. 현재 확인된 사실

### v13 confirmed facts

- `profiles`는 `auth.users`와 1:1로 연결되는 사용자 profile table이며 `app_role`, `plan_label`, `status`는 보호 컬럼이다.
- v13 role은 `learner`, `content_admin`, `org_admin`, `platform_admin` 네 값으로 유지한다.
- `profiles.status`는 `active`, `blocked`, `deleted` 값을 갖지만, 현재 admin status RPC는 `active|blocked` 중심으로 동작한다. `withdraw` 또는 `deleted` write는 차단 상태로 둔다.
- `problems`는 문제 catalog의 concrete parent table이다. 주요 값은 `source`, `domain`, `question_no`, `topik_level`, `difficulty`, `publish_status`, `review_status`, `visibility`, `lifecycle_status`다.
- `problem_assets`는 문제 이미지/오디오 asset metadata table이다.
- `subscription_plans`, `subscriptions`, `payment_history`는 사용자 paywall/subscription 화면의 billing read surface다.
- `subscriptions`와 `payment_history`는 owner/platform_admin select 중심이며 browser/admin app direct write policy가 없다.
- v13에는 이미 admin 관련 RPC가 일부 있다. 예: `get_admin_users`, `get_admin_user_stats`, `admin_set_user_status`, `admin_change_user_role`, `admin_update_problem`, `admin_toggle_problem_publish`, `admin_delete_problem`, `admin_add_problem_asset`, `admin_remove_problem_asset`, `get_admin_audit_logs`.
- v13 in-app admin UI/code는 frozen island다. 이번 계획의 구현 대상이 아니다.
- `src/lib/supabase/types.ts`는 최신 migration의 일부 additive fields, 특히 `problems.lifecycle_status/lifecycle_reason/expires_at` 반영 여부를 별도 확인해야 한다.

### topik-ai confirmed facts

- 실제 구조는 `C:\Users\admin\Desktop\workspace\topik-ai\src\features\**`다.
- Supabase browser client 경계는 `src/shared/api/supabase-client.ts`에 있으며 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`만 사용한다. service role browser exposure는 현재 확인 범위에서 발견하지 못했다.
- auth 경계는 이미 일부 Supabase session/profile read를 준비하고 있다. 다만 env 미설정 시 mock mode로 통과하고, auth gate가 `mock`과 `authenticated`를 모두 통과시키는 구조는 production 전환 전 fail-closed로 바꿔야 한다.
- `src/features/auth/model/app-role-mapping.ts`의 role mapping은 PROPOSED ONLY다. 최종 권한은 UI bundle이 아니라 v13 RLS/RPC가 `auth.uid()` 기준으로 강제해야 한다.
- Users 목록은 `users-service.ts`가 `mock-users.ts`를 반환한다. Users 상세는 `getMockUserById`와 page-local arrays에 직접 묶여 있다.
- Assessment question bank는 service abstraction이 있으나 내부적으로 Zustand store/fixture 기반이다.
- Commerce payments/refunds는 `billing/model/commerce-store.ts`의 초기 mock store를 직접 사용한다.
- `admin_current`, `admin_park`, `processedBy` 같은 hardcoded actor가 auth, assessment, billing/refund 경로에 남아 있다.
- topik-ai payments/refunds, coupons, points, store/products는 v13 billing schema와 일대일 대응하지 않는다.

## 4. In scope / Out of scope / Owner approval gate

### In scope

| Domain | Allowed planning scope | First allowed technical direction |
| --- | --- | --- |
| Members/profiles | topik-ai Users 목록/상세의 read adapter contract | `auth.users.email` + `profiles` + optional `subscriptions` read projection |
| Problem/question-bank | topik-ai Assessment question bank의 v13 problem catalog 매핑 | `problems`/`problem_assets` read adapter, write는 audited RPC only after gate |
| Payments | 결제 이력/구독 상태 read inventory | `subscription_plans`, `subscriptions`, `payment_history` read-only projection |

### Supporting guardrails

| Guardrail | Planning scope | Constraint |
| --- | --- | --- |
| Auth/session | topik-ai가 v13 Supabase auth/profile을 읽는 경계 설계 | anon key + Supabase session + `profiles.status='active'` + RLS/RPC final enforcement |
| Audit traceability | Target Type/Target ID mapping 설계 | v13 `admin_audit_logs.target_table/target_id`와 topik-ai audit contract reconciliation |
| Verification | mock parity, read-only e2e, RLS/RPC smoke 계획 | no live write until staged gate |

### Out of scope

- instructor, referral, coupon, points, community, message, operation, system metadata, analytics.
- topik-ai UI를 v13 repo로 porting.
- v13에 새 admin UI/screen 추가.
- owner approval 없는 v13 admin-oriented schema/migration 추가.
- user-owned learning artifacts에 대한 admin CRUD. 예: drafts, submissions, feedback, library, reports, exports, study events.
- payment write, refund approval/reject, withdrawal/deleted semantics, billing provider integration.
- topik-ai browser에서 `profiles`, `problems`, `problem_assets`, `subscriptions`, `payment_history`, `admin_audit_logs` 직접 write.

### Owner approval gate

아래 항목은 별도 owner approval 없이는 구현하지 않는다.

| Gate | 왜 필요한가 |
| --- | --- |
| v13 schema/migration/RPC 추가 또는 변경 | v13 concrete schema는 user-facing app의 load-bearing contract다. |
| permission-key layer DB 추가 | v13 4-role model을 유지하면서 shared entity permission을 RPC/RLS에 강제해야 한다. |
| `profiles.status='deleted'` 또는 withdraw write | 개인정보 삭제/보존/탈퇴 semantics가 아직 확정되지 않았다. |
| `review_workflow_status`, `topic_category_code`, generation metadata 추가 | topik-ai workflow 후보를 v13 `problems`에 손실 없이 반영하려면 additive schema 결정이 필요하다. |
| refund ledger/payment method/payment write schema | v13에는 별도 refund ledger와 payment method contract가 없다. |
| `commerce_products`, `commerce_packages`, coupons, points | overlap gate 밖이다. |
| hard delete/problem delete 연결 | destructive action이고 초기 전환에서는 publish/archive/update 중심으로 제한해야 한다. |
| service-role server/API 도입 | browser 노출 금지, server-only 권한 경계와 audit가 필요하다. |

## 5. cross-app entity mapping matrix

| Domain | v13 confirmed schema | topik-ai candidate/current source | Classification | Mapping decision for this plan |
| --- | --- | --- | --- | --- |
| Member identity | `auth.users.id/email` + `profiles.id` | `User.id`, `email`, `realName`, `nickname` | Direct/partial | canonical user id는 `profiles.id/auth.users.id`; email은 `auth.users.email`에서 projection |
| Member profile | `profiles.display_name`, `nickname`, `avatar_path`, `ui_locale` | Users list/detail fields | Direct/partial | page field는 adapter projection으로 해결; direct table rename 금지 |
| Member role | `profiles.app_role` | topik-ai UI roles/permission store | Partial | v13 4-role 유지; topik-ai role은 UI display/permission 후보, enforcement는 RPC/RLS |
| Member status | `profiles.status: active/blocked/deleted` | `정상/정지/탈퇴` | Partial/conflict | `정상 -> active`, `정지 -> blocked` 후보; `탈퇴 -> deleted`는 blocked |
| Member subscription display | `profiles.plan_label`, `subscriptions.status` | `tier`, `subscriptionStatus` | Partial | `일반/프리미엄`, `구독/미구독`은 read projection; source는 `subscriptions` 우선 |
| Last login/access log | no confirmed v13 source in `profiles` | `lastLoginAt`, `user_access_logs` | Missing | read adapter에서 optional/empty 처리; schema 추가 gate |
| Admin memo | no confirmed v13 source | `user_admin_memos` | Missing | page-local dummy 제거 전 별도 support contract 필요; schema 추가 gate |
| Problem content | `problems.id`, `question_no`, `prompt`, `materials`, `answer_key`, `rubric` | `AssessmentQuestion` fixture/service | Direct/partial | question bank read adapter의 1차 source는 `problems` |
| Problem domain | `problems.domain: reading/listening/writing` | `생활/학습/사회/...` | Conflict | 이름이 같아도 의미가 다르다. topik-ai topic은 `domain`에 매핑 금지 |
| TOPIK writing type | `problems.question_no: 51..54` | `빈칸 완성/연결 표현/자료 설명/의견 서술` | Direct | label projection으로 해결 |
| Difficulty | `problems.difficulty: 1..5` | `상/중/하` | Partial | proposed display mapping만 허용; write는 gate |
| Review status | `problems.review_status: pending/approved/rejected` | `검수 대기/검수 중/보류/검수 완료/수정 필요` | Conflict | v13 review_status에 5-state workflow를 넣지 않는다. additive `review_workflow_status` gate |
| Publish/visibility | `publish_status`, `visibility` | exposure/operation candidates | Partial | published/public 등 read projection 가능; write는 RPC/gate |
| Lifecycle/operation | `lifecycle_status: active/inactive/expired` | `미지정/노출 후보/숨김 후보/운영 제외` | Partial/conflict | direct write 금지; mapping glossary 확정 필요 |
| Problem assets | `problem_assets`, `problem-assets` storage | review document/attached data | Partial | asset handling은 별도 adapter/API contract; storage write gate |
| Subscription plans | `subscription_plans` | store/product/package candidates | Partial | subscription plan catalog read만 overlap |
| Subscription state | `subscriptions.status` | subscriptionStatus/payment user field | Partial | user/payment list read projection |
| Payment history | `payment_history.status: paid/failed/refunded/pending` | `CommercePayment` | Partial | payment inventory read-only |
| Refunds | no separate refund ledger; only payment status may be `refunded` | `CommerceRefund` | Missing/partial | refund workflow blocked; read summary only if derivable |
| Audit logs | `admin_audit_logs.target_table/target_id/action` | Target Type/Target ID | Partial | use immutable DB PK; email/display id cannot be target id |

## 6. phase별 실행 계획

> Implementation note: this is a plan for future execution. Do not start coding from this document until the current owner gate for the target phase is satisfied.

### Phase 0 — Baseline freeze and parity inventory

Purpose: implementation 전에 양쪽 계약과 현재 mock/store/service 경계를 잠근다.

- [ ] Fix the pinned source list in this document and link it from the relevant run note if needed.
- [ ] Re-check v13 dirty worktree and topik-ai dirty worktree. Do not revert unrelated changes.
- [ ] Record exact topik-ai current data source per overlap page:
  - [ ] Users list: `users-service.ts` + `mock-users.ts`.
  - [ ] Users detail: `getMockUserById` + page-local tab arrays.
  - [ ] Assessment question bank: service abstraction + store/fixture.
  - [ ] Payments/refunds: `commerce-store.ts` direct store.
- [ ] Record current v13 source usage per overlap object:
  - [ ] `profiles` user pages and settings/profile paths.
  - [ ] `problems`/`problem_assets` writing/practice/library paths.
  - [ ] `subscription_plans`/`subscriptions`/`payment_history` paywall/subscription paths.
- [ ] Check generated Supabase TypeScript types against latest migrations, especially `problems.lifecycle_status/lifecycle_reason/expires_at`.

Expected evidence:

- Updated inventory note or plan appendix with file references.
- No code/schema changes.
- Open-conflict register updated rather than silently resolved.

### Phase A — Auth/session read-first gate

Purpose: topik-ai가 v13 Supabase session/profile을 읽을 수 있게 하되, production mock bypass와 hardcoded actor risk를 먼저 닫는다.

- [ ] Decide environment behavior:
  - [ ] local/demo can remain mock-only when Supabase env is absent.
  - [ ] production/staging with real data must fail closed if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing.
- [ ] Require authenticated Supabase session before real data routes.
- [ ] Read `profiles` with `app_role`, `status`, display fields, and reject inactive/blocked/deleted admins at UI entry.
- [ ] Treat topik-ai permission store as display/menu control only.
- [ ] Confirm final enforcement remains v13 RLS/RPC with `auth.uid()`.
- [ ] Replace hardcoded actor use in any real-data/audit path with current Supabase user id. Mock actor may remain only behind mock-only boundary.

Allowed write: none.

Expected evidence:

- AuthGate behavior documented for mock/local vs real/staging.
- No `VITE_SUPABASE_SERVICE_ROLE_KEY` or equivalent browser service role variable.
- Manual/browser or e2e evidence that mock-only and real-data modes do not mix.

### Phase B — Members/profiles read adapter

Purpose: topik-ai Users list/detail를 v13 `profiles` 중심 read projection으로 전환할 준비를 한다.

- [ ] Define `AdminUserSummary` projection from:
  - [ ] `profiles.id`
  - [ ] `auth.users.email`
  - [ ] `profiles.display_name/nickname`
  - [ ] `profiles.status`
  - [ ] `profiles.plan_label`
  - [ ] `subscriptions.status` if available
- [ ] Keep `lastLoginAt`, access logs, admin memo as missing/optional fields until source is approved.
- [ ] Split Users list service so page does not know whether data comes from mock or Supabase.
- [ ] Split Users detail page-local arrays into service-returned optional sections before any real DB read.
- [ ] Restrict status write:
  - [ ] `active`/`blocked` may be future RPC candidate.
  - [ ] `deleted`/withdraw remains blocked.
- [ ] Define audit target mapping:
  - [ ] `target_table='profiles'`
  - [ ] `target_id=<profile uuid>`

Allowed write: none in read-first phase.

Future staged write candidate:

- `admin_set_user_status` for `active|blocked`, only after owner confirms permission key/RPC gate and audit evidence.

Expected evidence:

- Mock parity test for Users list filters/sorting/status labels.
- Users detail handles missing memo/access log/payments sections with empty states.
- No direct `profiles.update()` from topik-ai browser.

### Phase C — Problems/question-bank adapter

Purpose: topik-ai Assessment question bank를 v13 `problems`/`problem_assets`와 매핑한다.

- [ ] Define `AssessmentQuestion` projection from v13:
  - [ ] `problems.id`
  - [ ] `question_no`
  - [ ] `topik_level`
  - [ ] `difficulty`
  - [ ] `prompt`
  - [ ] `materials`
  - [ ] `answer_key`
  - [ ] `rubric`
  - [ ] `source`
  - [ ] `publish_status`
  - [ ] `review_status`
  - [ ] `visibility`
  - [ ] `lifecycle_status`
- [ ] Explicitly block direct mapping of topik-ai topic `domain` to v13 `problems.domain`.
- [ ] Treat topik-ai 5-state review workflow as a separate unresolved workflow field, not as v13 `review_status`.
- [ ] Treat operation status as unresolved until `publish_status` vs `lifecycle_status` responsibility is decided.
- [ ] Define asset handling:
  - [ ] read `problem_assets` for image/audio where present.
  - [ ] do not write storage or `problem_assets` until audited RPC gate is approved.
- [ ] Prefer update/publish/archive workflow over hard delete for first staged write.

Allowed write in read-first phase: none.

Future staged write candidates:

- `admin_update_problem`
- `admin_toggle_problem_publish`
- `admin_add_problem_asset`
- `admin_remove_problem_asset`

Owner-gated before write:

- `topic_category_code`
- `review_workflow_status`
- generation/review history metadata
- hard delete connection

Expected evidence:

- Question bank list/detail can render v13 `problems` projection without losing required labels.
- Mock fixture parity documented for fields that have no v13 source.
- Conflict register explicitly lists every unmapped workflow/status field.

### Phase D — Payments read-only inventory

Purpose: topik-ai Commerce payment surfaces가 v13 billing tables를 read-only로 보여줄 수 있는지 검증한다.

- [ ] Define `AdminPaymentSummary` read projection from:
  - [ ] `payment_history.id`
  - [ ] `payment_history.user_id`
  - [ ] `payment_history.amount_cents`
  - [ ] `payment_history.currency`
  - [ ] `payment_history.status`
  - [ ] `payment_history.paid_at`
  - [ ] related `subscriptions.status`
  - [ ] related `subscription_plans.name` if available
- [ ] Keep refund detail fields missing unless a separate source exists.
- [ ] Disable or mock-only guard refund approve/reject actions in real-data mode.
- [ ] Block direct writes to `subscriptions` and `payment_history`.
- [ ] Define payment target mapping:
  - [ ] `target_table='payment_history'`
  - [ ] `target_id=<payment_history uuid>`
  - [ ] read audit only if bulk/export access is approved.

Allowed write: none.

Owner-gated:

- refund ledger
- payment method source
- payment cancellation semantics
- billing provider/service role backend
- commerce store/products/packages

Expected evidence:

- Payments page can show read-only rows or explicit empty/error states.
- Refund page cannot mutate live data.
- No browser write to billing tables.

### Phase E — Cross-app regression and documentation update

Purpose: topik-ai read adapter changes do not alter v13 user-facing behavior and both repos keep one shared vocabulary.

- [ ] v13 user-facing regression candidates:
  - [ ] profile/settings pages for `profiles`.
  - [ ] writing/practice/library pages for `problems`.
  - [ ] paywall/subscription pages for billing read.
- [ ] topik-ai regression candidates:
  - [ ] `/users`
  - [ ] `/users/:userId`
  - [ ] `/assessment/question-bank`
  - [ ] `/assessment/question-bank/review/:questionId`
  - [ ] `/commerce/payments`
  - [ ] `/commerce/refunds` read-only behavior
- [ ] Update cross-app glossary with only confirmed mappings.
- [ ] Keep PROPOSED ONLY mappings visibly marked until owner approval.

Expected evidence:

- v13 tests/build chosen by change scope.
- topik-ai harness/build/e2e chosen by change scope.
- Documented gaps remain explicit; no silent schema invention.

## 7. subagent별 검토 결과 요약

| Agent | Focus | Result integrated into this plan |
| --- | --- | --- |
| Agent 1 | v13 schema/RLS/RPC/source usage | Confirmed `profiles`, `problems`, `problem_assets`, billing tables, admin RPCs, RLS and user-facing usage. Corrected source of `profiles` to `20260520120100_profiles_goals.sql`; actual role RPC is `admin_change_user_role`. |
| Agent 2b | topik-ai source boundary | Confirmed `src/features/**`, Users mock/service, Users detail page-local dummy, Assessment store/service, Billing commerce store, Supabase auth boundary, hardcoded actor risk. |
| Agent 3 | cross-app data contract | Produced entity matrix, enum glossary, direct/partial/missing classification, and conflict register. This plan uses that classification. |
| Agent 4 | security/RLS | Confirmed no observed browser service role exposure; identified production mock bypass, hardcoded actor, UI permission reliance, direct table write, payment/refund, and withdraw risks. |
| Agent 5 | QA/test strategy | Produced phase-based verification matrix for v13 and topik-ai, including read-first, mock parity, write-staged, cross-app regression, and release gate evidence. |

## 8. 검증 계획

### Planning-document verification for this artifact

- [ ] Confirm this file exists under `docs/superpowers/plans/`.
- [ ] Confirm the document is plan-only and does not claim code/schema implementation.
- [ ] Confirm all required report sections exist in order.
- [ ] Confirm scope gates and blocked domains are explicit.

### Future v13 verification candidates

| Change type | Commands/evidence |
| --- | --- |
| doc-only | file exists, links/paths checked, no source/schema diff |
| type/schema projection change | `pnpm typecheck`, targeted Vitest |
| normal code change | `pnpm lint`, `pnpm typecheck`, targeted `pnpm test` |
| user-facing route/UI change | component/e2e or browser check, desktop/mobile where relevant |
| Supabase local/RLS change | `pnpm test:supabase:local` with local stack and `.env.test.local` |
| release-level change | `pnpm build`, selected Playwright tests with required server |

Notes:

- v13 uses `pnpm` and Node `>=24 <25`.
- v13 Playwright does not define a `webServer` in config, so e2e requires an app server at the configured base URL.
- Supabase local tests require local stack/Docker/Supabase CLI prerequisites.

### Future topik-ai verification candidates

| Change type | Commands/evidence |
| --- | --- |
| static/data-boundary change | `npm run harness:check` |
| build/type validation | `npm run build` |
| smoke e2e | `npm run harness:e2e:smoke` |
| full e2e | `npm run test:e2e` |
| release-level gate | `npm run harness:full` |

Notes:

- topik-ai Playwright starts its own dev server at `127.0.0.1:4177`.
- Existing server reuse can contaminate results if the process is stale.
- `npm install`/`postinstall` is state-changing and was not part of this planning pass.

## 9. 문서 갱신 계획

| When | v13 docs | topik-ai docs | Rule |
| --- | --- | --- | --- |
| After Phase 0 | `docs/user-admin-data-consistency.md`, this plan if facts change | `docs/architecture/admin-data-source-transition.md` if source boundary facts change | fact-only updates, no implementation claims |
| After Phase A | `docs/admin-scope-boundary.md` only if owner changes gate wording; auth docs if v13 contract changes | auth transition note/page-sync references | mock vs real mode must be explicit |
| After Phase B | `docs/user-admin-data-consistency.md`, `docs/supabase-table-inventory.md` if RPC/source changes | Users page-sync and data-source docs | missing user detail sections must be explicit |
| After Phase C | `docs/user-admin-data-consistency.md`, `docs/development/database-schema.md`, migration index only if owner-approved schema changes land | Assessment page-sync/admin contract | conflict fields stay PROPOSED ONLY until approved |
| After Phase D | billing/auth docs only if read contract or backend changes | Commerce payments/refunds page-sync | payments remain read-only unless gate opens |
| After staged write gate | relevant migration index, schema docs, RLS/RPC docs | action-log and page-sync docs | every write must have audit/RLS evidence |

## 10. 남은 리스크와 결정 필요 사항

| Risk/decision | Current status | Needed decision |
| --- | --- | --- |
| Production mock bypass in topik-ai | Risk confirmed | Decide env/mode rule: real deployment must fail closed without Supabase config |
| Hardcoded actor | Risk confirmed | Decide removal boundary before any real audit/write |
| UI permission vs DB enforcement | permission-key layer direction is owner-approved for shared entities | Define shared-entity permission keys and RPC/RLS implementation shape |
| `users` vs `profiles + auth.users` naming | Partial mismatch | Adopt `profiles` canonical for v13-backed data; keep topik-ai DTO names as projection only |
| `탈퇴`/withdraw/deleted | Blocked | Define legal/product semantics before any write |
| `lastLoginAt`, access logs, admin memos | Missing source | Decide whether to add support-only schema/RPC later |
| topik-ai topic `domain` vs v13 `problems.domain` | Semantic conflict | Do not map directly; decide additive topic field if needed |
| 5-state review workflow | Semantic conflict | Decide additive workflow field or reduce UI workflow without data loss |
| operation status vs publish/lifecycle | Partial conflict | Define responsibility split before write |
| `src/lib/supabase/types.ts` drift | Suspected | Regenerate or patch types after confirming latest migrations |
| payments/refunds | Read-only only | Decide refund ledger/payment method/backend if product needs live refund operations |
| problem hard delete | Destructive | Keep out of initial write path; require explicit approval |
| direct table writes from topik-ai | Forbidden | All writes must go through audited RPC/RLS after gate |
