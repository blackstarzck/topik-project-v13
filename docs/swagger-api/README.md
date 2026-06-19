# Swagger API Reference

This directory is the v13 integration reference for the TALKPIK external API.

- Swagger UI: [https://api.dotoretopik.com/docs](https://api.dotoretopik.com/docs)
- OpenAPI JSON: [https://api.dotoretopik.com/openapi.json](https://api.dotoretopik.com/openapi.json)
- Last synced: 2026-06-19
- OpenAPI: `3.1.0`
- API title/version: `TalkPik AI Service` / `0.1.0`
- Coverage: 70 paths, 72 operations, 109 component schemas, 2 security schemes

## Start Here

1. [OpenAPI summary](./openapi-reference.md)
2. [Auth and errors](./auth-and-errors.md)
3. [Writing API](./endpoints/writing.md)
4. [v13 writing screen/API map](./writing-api-v13-screen-map.html)

## Endpoint Groups

| Group | Operations | Scope |
| --- | ---: | --- |
| [Eval Auth](./endpoints/eval-auth.md) | 1 | Eval dashboard login |
| [Admin Eval](./endpoints/admin-eval.md) | 12 | Evaluation operations, reviews, and datasets |
| [Admin Campaign](./endpoints/admin-campaign.md) | 24 | Campaign admin review, email, PDF, and stats |
| [External Campaign](./endpoints/external-campaign.md) | 6 | External campaign upload, submission, contact, and waitlist |
| [Writing](./endpoints/writing.md) | 9 | TOPIK writing submission, generation, history, drafts, and PDF |
| [Reading](./endpoints/reading.md) | 10 | Reading generation, submission, sessions, results, and bookmarks |
| [Listening](./endpoints/listening.md) | 10 | Listening sessions, submissions, results, audio, and bookmarks |
| [Evaluation](./endpoints/evaluation.md) | 0 | Async writing evaluation result lookup; not registered in current OpenAPI paths |

## Schema Groups

| Group | Schemas |
| --- | ---: |
| [Common](./schemas/common.md) | 3 |
| [Eval Auth](./schemas/eval-auth.md) | 3 |
| [Admin Eval](./schemas/admin-eval.md) | 18 |
| [Admin Campaign](./schemas/admin-campaign.md) | 26 |
| [External Campaign](./schemas/external-campaign.md) | 11 |
| [Writing](./schemas/writing.md) | 16 |
| [Reading](./schemas/reading.md) | 15 |
| [Listening](./schemas/listening.md) | 17 |
| [Evaluation](./schemas/evaluation.md) | 0 |

## v13 Writing Submit Contract

The v13 app follows the endpoint-level Swagger request example for external writing submission.

```json
{
  "task_type": "Q51",
  "task_id": "Q51",
  "text": "student answer...",
  "user_id": "current"
}
```

Rules:

- Do not send the local Supabase `problem_id` UUID as external `task_id`.
- Send `task_id` as one of the external TOPIK task codes: `Q51`, `Q52`, `Q53`, or `Q54`.
- Send `user_id` as `current`, matching the Swagger endpoint request example and the current v13 integration contract.
- `lang` and `passage_context` remain optional in the live component schema, but the v13 default submit payload does not send them.

## Known Spec Gap

`POST /api/writing/submit` tells clients to poll `GET /api/evaluation/{submission_id}`, but `https://api.dotoretopik.com/openapi.json` currently does not register any `/api/evaluation/...` path. Keep this gap visible when changing the v13 writing feedback flow.
