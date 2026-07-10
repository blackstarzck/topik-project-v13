<!-- GENERATED FILE: edit docs/sot-registry.json, then run node scripts/check-sot-registry.mjs --write-index -->

# Active SOT Registry

이 파일은 `docs/sot-registry.json`에서 생성된다. 직접 수정하지 않는다.

낮은 precedence 숫자가 먼저 적용된다. 동일 scope에는 active owner가 하나만 존재해야 한다.

## Active contracts

| Precedence | Scope | Role | Title | Path | Owner | Effective |
| ---: | --- | --- | --- | --- | --- | --- |
| 10 | `workflow/constitution` | constitution | Agent Constitution | [AGENTS.md](../AGENTS.md) | project | 2026-07-10 |
| 12 | `workflow/index` | workflow | Agent Workflow Index | [docs/agent-workflow/README.md](./agent-workflow/README.md) | project | 2026-07-10 |
| 13 | `workflow/core` | workflow | Shared Agent Workflow Core | [docs/agent-workflow/core.md](./agent-workflow/core.md) | project | 2026-07-10 |
| 14 | `workflow/codex-lifecycle` | workflow | Codex Task and Worktree Lifecycle | [docs/agent-workflow/codex.md](./agent-workflow/codex.md) | project | 2026-07-10 |
| 15 | `workflow/ui-implementation` | workflow | UI Ownership and Implementation Workflow | [docs/agent-workflow/ui.md](./agent-workflow/ui.md) | product-design | 2026-07-10 |
| 20 | `project/entry` | entry | TALKPIK AI Project Guide | [README.md](../README.md) | project | 2026-07-10 |
| 25 | `product/mvp-scope` | decision-record | AI Deferred and MVP Scope Decision | [docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md](./scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md) | product | 2026-07-10 |
| 30 | `product/requirements` | active-sot | Product Requirements | [docs/prd.md](./prd.md) | product | 2026-07-10 |
| 35 | `product/information-architecture` | active-sot | Information Architecture | [docs/ia.md](./ia.md) | product | 2026-07-10 |
| 40 | `product/user-flow` | active-sot | User Flow | [docs/flow/user-flow.md](./flow/user-flow.md) | product | 2026-07-10 |
| 45 | `product/sitemap` | active-sot | Sitemap | [docs/flow/sitemap.md](./flow/sitemap.md) | product | 2026-07-10 |
| 50 | `product/wireframes` | active-sot | Wireframe Index | [docs/Wireframe/README.md](./Wireframe/README.md) | product-design | 2026-07-10 |
| 55 | `ui/design-system` | active-sot | Design System | [DESIGN.md](../DESIGN.md) | product-design | 2026-07-10 |
| 60 | `ui/ant-design` | active-sot | Ant Design Guide | [docs/ant-design/README.md](./ant-design/README.md) | product-design | 2026-07-10 |
| 65 | `ui/theme-architecture` | active-sot | Theme Architecture | [docs/ant-design/08-theme-architecture.md](./ant-design/08-theme-architecture.md) | product-design | 2026-07-10 |
| 65 | `ui/review` | active-sot | UI Review Checklist | [docs/ant-design/07-review-checklist.md](./ant-design/07-review-checklist.md) | product-design | 2026-07-10 |
| 70 | `data/migrations` | active-sot | Supabase Migration Index | [supabase/migrations/INDEX.md](../supabase/migrations/INDEX.md) | data | 2026-07-10 |
| 70 | `engineering/testing` | active-sot | Testing Guide | [TESTING.md](../TESTING.md) | engineering | 2026-07-10 |
| 75 | `workflow/user-communication` | active-sot | User Communication Style | [docs/user-communication-style.md](./user-communication-style.md) | project | 2026-07-10 |

## Lifecycle records

| Status | Role | Title | Path | Replaced by |
| --- | --- | --- | --- | --- |
| superseded | proposal | Codex Workflow Overhaul Proposal | [docs/sot-change-proposals/2026-07-10-codex-workflow-overhaul.md](./sot-change-proposals/2026-07-10-codex-workflow-overhaul.md) | workflow-index, workflow-core, workflow-codex, workflow-ui |

## Unlisted documents

Registry에 명시되지 않은 문서의 기본 role은 `unclassified`이다. lifecycle status는 추정하지 않는다.
