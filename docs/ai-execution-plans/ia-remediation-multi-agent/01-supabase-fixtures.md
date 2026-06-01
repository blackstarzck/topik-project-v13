# IA Remediation Multi-Agent Plan: Supabase Fixtures

## Supabase IA Fixture And Seeding Contract

This section applies only to IA evidence that depends on real Supabase state: auth, session, user-owned data, owner checks, storage paths, RBAC, admin audit logs, persistence, or service-role-dependent setup. It is not a blanket requirement to seed Supabase for every IA item.

Visual-only states, static public pages, hosted modal behavior, copy checks, delegated human confirmation, and deferred-scope UI shells may use local/UI fixtures when the IA profile does not require real auth, data, owner, storage, RBAC, or persistence evidence.

### Required fixture manifest

The coordinator must create or verify `<auditRunDirectory>/supabase-fixture-manifest.json` before dispatching any security/data/auth/storage/RBAC item.

Required top-level fields:

- `schemaVersion`
- `runId`
- `generatedAt`
- `sourceCommit`
- `fixtureSourceCommit`
- `environment`: `local`, `dev`, `preview`, or `staging`
- `supabaseProjectRef`
- `supabaseEnvLabel`
- `productionAllowed`: must be `false`
- `mutationAllowed`
- `credentialsUsed`: type only; never secret values
- `serviceRoleUse`: `forbidden` by default, or narrowly scoped with justification
- `seedCommand`
- `verifyCommand`
- `cleanupCommand`
- `rollbackOrResetBoundary`
- `seedBatchId`
- `fixtureExpiresAt`
- `seededUsers`
- `storageStatePaths`
- `authStates`
- `rows`
- `storageObjects`
- `ownerScopeFixtures`
- `adminRbacFixtures`
- `wrongOwnerCases`
- `authNegativeFixtures`
- `storageFixtures`
- `rlsCases`
- `adminAuditFixtures`
- `deferredScopeGuards`
- `iaEvidenceMap`
- `evidencePaths`
- `commandOutputFiles`
- `limitations`

The manifest must never include passwords, access tokens, refresh tokens, service-role keys, database passwords, or raw secret values. It may record credential type, command output path, and storage-state artifact path.

### Production and credential guard

Fixture seeding is allowed only for `local`, `dev`, `preview`, or `staging` targets with a verified Supabase project ref, non-production credential scope, explicit mutation boundary, rollback or reset path, and fixture provenance.

The coordinator must mark the affected IA item `blocked_terminal` when any of these are true:

- environment is `prod`, `production`, `unknown`, or `unknown-treat-as-prod`
- Supabase project ref cannot be verified
- credential type is unknown
- service-role use is ambiguous or broader than the packet allows
- rollback or reset boundary is missing
- fixture provenance is missing or stale
- the fixture manifest points at a project different from the one used by the app under test

Do not use the production seeding override flag during IA remediation. Production fixture creation, DB row insertion/deletion, test-user creation, role-change RPCs, and storage mutation are out of scope for this plan.

### Minimum fixture matrix

The fixture manifest must prove only the fixture categories required by the IA profile row and task packet.

| Evidence category | Minimum fixture requirement | Applies to |
| --- | --- | --- |
| Auth/session | logged-out state, valid learner state, stale or expired token state, malformed token or safe auth-error state when profile evidence requires it | `A-01`, `A-02`, `X-06`, `X-11`, `X-12`, protected routes |
| User-owned data | learner profile, learning goal, published problem, draft/submission/feedback/report/recommendation/library rows as required by the route | `A-03`, `B-01`, `C-01`, `C-02`, `D-01`-`D-04`, `E-01`, `E-02`, `R-01`, `R-02`, `F-01`, `G-01`, `X-02`, `X-05`, `X-07` |
| Owner negative case | a second non-admin learner with rows that the primary learner must not read or mutate. Do not use an admin account as the wrong-owner stand-in | owner-scoped feedback, reports, library, exports, profile, recommendations |
| Autosave/submission | active draft, failed autosave state, submitted immutable submission, duplicate-submit attempt where required | `D-01`-`D-04`, `D-M1`, `D-M3` |
| Storage | own avatar path, own generated-export path, wrong-owner export denial, problem-asset public/admin path when required | `F-01`, `F-M1`, profile/avatar flows, problem assets |
| Admin/RBAC | learner denied, content admin limited to content/problem scope, org admin limited to implemented org scope, platform admin required for user-management or privilege actions | `H-01`, `X-08`, `X-10` |
| Admin audit | audit-log row proving an admin action, append-only behavior or update/delete denial evidence | `H-01`, `X-10` |
| Deferred billing shell | profile `plan_label` or local UI fixture only; no provider row, checkout, invoice, SDK, or payment-flow fixture | `X-03`, `X-04` |
| Deferred organization scope | only implemented Tier 1/admin profile data may be used. Do not create `organizations` or membership tables unless active docs are updated first | `X-08` |
| Deferred notification transport | preference UI may use local/UI fixture or implemented persistence only. Do not seed email/SMS/push transport rows unless active docs are updated first | `X-09` |

If a required fixture category cannot be proven, the IA item remains in `security-fixture` or `blocked_terminal`. Do not close it with screenshots, generic notes, or broad "looks good" summaries.

### Fixture evidence and verifier rules

The task packet must name the fixture keys it relies on. The result packet must list the fixture IDs, storage-state artifacts, RLS cases, command outputs, and evidence files used.

The final verifier must reject closure when:

- the manifest is missing, stale, or not tied to the current source commit or app-under-test environment
- an IA profile evidence token requiring auth/data/owner/storage/RBAC/persistence has no matching manifest entry
- wrong-owner evidence is missing for owner-scoped IA
- admin denial or privilege-escalation evidence is missing for admin IA
- storage-path evidence is missing for storage IA
- service-role use is broader than the packet allows
- deferred billing, organization, or notification scope is reopened through fixtures
- manual notes, screenshots, or chat summaries are used as substitute evidence for auth, owner, storage, RBAC, fixture, service-role, or RLS claims

Allowed degraded evidence is limited to UI-only visual/browser claims, the manual flow-edge artifact defined below, and delegated human-confirmation records where the profile explicitly requires them.
