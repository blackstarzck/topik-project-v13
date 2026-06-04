# TALKPIK AI Docs Guide

This folder contains the active documentation for TALKPIK AI. Use it to align
product decisions, implementation work, UI design, user journeys, and AI-agent
workflow.

## Reading Order

```mermaid
flowchart TD
    A["What are you trying to do?"] --> B{"Goal"}
    A --> X["AI agents: read agent-index.md first"]
    B -->|"Implementation / stack / backend / deployment"| C["spec.md"]
    B -->|"Product scope / user value"| D["prd.md"]
    B -->|"Routes / navigation"| E["sitemap.md + ia.md"]
    B -->|"Specific screen"| F["Wireframe/README.md"]
    B -->|"Visual UI"| G["ant-design/README.md"]
    B -->|"User journey"| H["flow/README.md"]
    B -->|"AI workflow"| I["ai-workflow/README.md"]
    B -->|"AI execution plan"| J["ai-execution-plans/README.md"]
```

Read the entry document first, then only the detailed docs it routes to. Reading
every document by default increases the chance of missing the important one.

## Document Map

| Document | Plain meaning | Use when |
| --- | --- | --- |
| [spec.md](./spec.md) | Single implementation spec and development router. | Implementing features, choosing packages, working with backend/auth/AI/deployment/env vars/tests. |
| [prd.md](./prd.md) | Product purpose, user value, and scope. | Checking product direction, personas, priorities, and business rules. |
| [agent-index.md](./agent-index.md) | AI routing index. | Asking an AI agent to select the correct docs for a task. |
| [sitemap.md](./sitemap.md) | Target route map. | Checking URLs, route hierarchy, and page navigation. |
| [ia.md](./ia.md) | Information architecture. | Understanding screen groups, menus, and content structure. |
| [flow/README.md](./flow/README.md) | User journey folder entry. | Checking the order of signup, study, writing, feedback, and review flows. |
| [Wireframe/README.md](./Wireframe/README.md) | Page-level screen specs and wireframes. | Building or reviewing a specific screen. |
| [ant-design/README.md](./ant-design/README.md) | UI implementation rules. | Designing or implementing UI with Ant Design. |
| [development/README.md](./development/README.md) | Detailed implementation specs. | Reading stack, backend/auth, AI boundary, deployment, or deferred-scope details after `spec.md` routes you there. |
| [ai-workflow/README.md](./ai-workflow/README.md) | AI-agent workflow and evidence rules. | Managing Codex/Claude work, ledgers, reports, and verification. |
| [ai-execution-plans/README.md](./ai-execution-plans/README.md) | Task-specific execution plans for AI agents. | Giving Codex/Claude a mapped plan for a long audit, remediation, or multi-phase task without forcing one huge file read. |
| [user-admin-data-consistency.md](./user-admin-data-consistency.md) | v13 user DB usage and topik-ai admin page-sync inventory. | Planning user/admin data reconciliation before real CRUD validation. |
| [user-admin-data-consistency.html](./user-admin-data-consistency.html) | HTML report for the v13/topik-ai data consistency inventory. | Reviewing the reconciliation baseline in a browser-friendly format. |
| [ia-pages/README.md](./ia-pages/README.md) | Legacy observed HTML page notes. | Historical reference only. Active docs win on conflicts. |

## Example Requests

| Goal | Good request |
| --- | --- |
| Implement a feature | "`docs/spec.md` 기준으로 쓰기 제출 흐름을 구현해줘. 관련 상세 문서도 먼저 확인해줘." |
| Check stack/auth/AI/deployment | "`docs/spec.md` 기준으로 Auth와 AI 기능 경계가 맞는지 검토해줘." |
| Build a screen | "`docs/Wireframe`와 `docs/ant-design` 기준으로 대시보드 화면을 만들어줘." |
| Check user flow | "`docs/flow/user-flow.md` 기준으로 학습 흐름이 자연스러운지 검토해줘." |
| Write an AI work report | "`docs/ai-workflow` 기준으로 이번 작업 보고서를 작성해줘." |
| Run a long AI execution plan | "`docs/ai-execution-plans` README에서 해당 계획을 고르고, 필요한 phase 파일만 읽어서 진행해줘." |

## Active And Legacy Docs

Active docs govern implementation, QA, and review:

- `prd.md`
- `spec.md`
- `sitemap.md`
- `ia.md`
- `Wireframe/README.md` and matching `Wireframe/<page>/description.md`
- `flow/user-flow.md`
- `ant-design/README.md`
- `development/*.md` when routed from `spec.md`

Legacy docs are reference only:

- `user-flow.md`
- `ia-pages/`
- legacy static route notes inside `sitemap.md`

If active and legacy docs conflict, active docs win. If active docs conflict
with a user request, stop and report the conflict before implementing.
