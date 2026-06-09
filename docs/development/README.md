# Development Detail Docs

This folder contains detailed implementation specs for TALKPIK AI.

Always read [`../spec.md`](../spec.md) first. It is the single implementation
spec and routes you to the specific detail file needed for the task. Do not read
every file in this folder by default.

## Selection Map

```mermaid
flowchart TD
    A["Implementation question"] --> B["../spec.md"]
    B --> C{"What kind of detail is needed?"}
    C -->|"framework / packages / tests / frontend libraries"| D["stack.md"]
    C -->|"Supabase / Auth / RLS / Storage"| E["backend-auth.md"]
    C -->|"current table / RPC / storage inventory"| DBI["../supabase-table-inventory.md"]
    C -->|"login / signup / callback / error / operational policy"| AO["auth-overview.md"]
    C -->|"Vercel / env vars / deployment / rollback"| G["deployment.md"]
    C -->|"dev/prod separation · Supabase 프로젝트 운영 · 키 회전 · 사고 대응"| ENV["environments.md"]
    C -->|"billing / subscription / paywall"| H["deferred-scope.md"]
```

## Files

| File | Purpose | Use when |
| --- | --- | --- |
| [stack.md](./stack.md) | Framework, package, frontend stack, and test tooling. | Choosing or changing packages, scripts, frontend libraries, or test setup. |
| [backend-auth.md](./backend-auth.md) | Supabase, Auth, RLS, Storage, and server-only key rules. | Implementing login, database access, storage, profiles, or admin roles. |
| [../supabase-table-inventory.md](../supabase-table-inventory.md) | Current Supabase table, RPC, storage, and code usage inventory. | Checking or changing tables, columns, migrations, RPCs, storage, RLS, or Supabase usage. |
| [auth-overview.md](./auth-overview.md) | Login, signup, callback, error pages mapped to code + IA, plus operational policy (cleanup cron, rate limits, env vars, role model). | Touching any auth surface, env vars (`NEXT_PUBLIC_SITE_URL`), or the unconfirmed-user cleanup policy. Read after `backend-auth.md`. |
| [deployment.md](./deployment.md) | Vercel environments, build settings, preview gates, rollback. | Working on preview links, production deploys, CI, env vars, or rollback. |
| [environments.md](./environments.md) | dev/prod 분리 원칙, Supabase 프로젝트 운영, Vercel env 매트릭스, 마이그레이션 흐름, 키 회전, audit 가드, 사고 대응 플레이북. | prod 환경 도입 / Supabase 프로젝트 추가 / 키 회전 / 마이그레이션 prod 적용 / 사고 대응. |
| [deferred-scope.md](./deferred-scope.md) | Billing and other deferred areas. | Discussing subscriptions, paywall, Stripe, pricing, or intentionally postponed features. |

## Non-Negotiable Reminder

- `spec.md` is the required entry point.
- This folder contains details selected by `spec.md`.
- Billing remains deferred unless scope is explicitly reopened.
- Secrets must never be exposed in browser-visible variables.
