# AGENTS.md and SOT Link Map Proposal

## Reason

`docs/swagger-api/openapi-reference.md` was too large for efficient agent use, and `AGENTS.md` currently names many SOT documents without direct Markdown links because it is an agent instruction contract rather than a navigational index.

This proposal records safe link additions that can make future agents find the right SOT faster without changing product behavior.

## Current Safe Change

- Add the split OpenAPI reference entry to root [README.md](../../README.md).
- Keep [docs/swagger-api/openapi-reference.md](../swagger-api/openapi-reference.md) as a short compatibility entry that points to the split reference map.
- Add [docs/swagger-api/README.md](../swagger-api/README.md) as the main API reference index.

## Recommended Future Link Additions

| Target document | Suggested link addition | Why |
| --- | --- | --- |
| [AGENTS.md](../../AGENTS.md) | Link `README.md`, `docs/prd.md`, `docs/ia.md`, `docs/flow/user-flow.md`, `docs/flow/sitemap.md`, `docs/Wireframe/README.md`, `docs/ant-design/README.md`, `supabase/migrations/INDEX.md`, and `docs/swagger-api/README.md` in the reading-order table | Improves agent navigation from the top-level contract |
| [docs/flow/README.md](../flow/README.md) | Add `docs/swagger-api/README.md` only as a technical reference, not as a flow SOT | Prevents API existence from being mistaken for user-flow scope |
| [docs/Wireframe/README.md](../Wireframe/README.md) | Add a short note that API references must be checked through `docs/swagger-api/README.md` when implementing backend integration | Helps screen implementers find endpoint/schema details |
| [docs/prd.md](../prd.md) | Do not add endpoint-level links unless product scope explicitly changes | Keeps API availability separate from product commitments |

## Guardrails

- The OpenAPI reference is factual backend metadata, not product scope.
- Admin endpoint groups remain awareness-only for this user-facing repository.
- AI grading, generation, quota enforcement, and in-writing AI chat must still follow the deferred-scope decision before implementation.
- API links should not be used to infer new UX, product behavior, data rules, or admin features.

## Rejected

- Directly editing `AGENTS.md` in this change: rejected because `AGENTS.md` is an agent rule/SOT contract and this request asked to assess link possibilities, not to change the contract itself.
- Linking every schema file from root `README.md`: rejected because it would make the project entry page noisy. The API index already links schema domains.
