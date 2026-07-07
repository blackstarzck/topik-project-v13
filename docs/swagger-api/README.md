# Swagger API Reference

This directory is the v13 integration reference for the TALKPIK external API.

- Swagger UI: [https://api.dotoretopik.com/docs](https://api.dotoretopik.com/docs)
- OpenAPI JSON: [https://api.dotoretopik.com/openapi.json](https://api.dotoretopik.com/openapi.json)
- Last synced: 2026-07-07
- OpenAPI: `3.1.0`
- API title/version: `TalkPik AI Service` / `0.1.0`
- Coverage: 82 paths, 87 operations, 133 component schemas, 2 security schemes

## Start Here

1. [OpenAPI summary](./openapi-reference.md)
2. [Auth and errors](./auth-and-errors.md)
3. [Writing API](./endpoints/writing.md)
4. [Evaluation API](./endpoints/evaluation.md)
5. [v13 writing screen/API map](./writing-api-v13-screen-map.html)

## Endpoint Groups

| Group | Operations | Scope |
| --- | ---: | --- |
| [Account](./endpoints/account.md) | 1 | User account self-service |
| [Eval Auth](./endpoints/eval-auth.md) | 1 | Eval dashboard login |
| [Admin Users](./endpoints/admin-users.md) | 6 | Admin/user account management; reference only, not v13 user-app scope |
| [Admin Eval](./endpoints/admin-eval.md) | 12 | Evaluation operations, reviews, and datasets |
| [Admin Reading](./endpoints/admin-reading.md) | 3 | Admin reading question-bank operations; reference only, admin-only, not v13 user-app scope |
| [Admin Campaign](./endpoints/admin-campaign.md) | 24 | Campaign admin review, email, PDF, and stats |
| [External Campaign](./endpoints/external-campaign.md) | 6 | External campaign upload, submission, contact, and waitlist |
| [Writing](./endpoints/writing.md) | 12 | TOPIK writing submission, generation, tutor sessions, history, drafts, and PDF |
| [Reading](./endpoints/reading.md) | 9 | Reading generation, submission, sessions, results, and bookmarks |
| [Listening](./endpoints/listening.md) | 10 | Listening sessions, submissions, results, audio, and bookmarks |
| [Evaluation](./endpoints/evaluation.md) | 3 | Async writing evaluation status, SSE stream, and detailed feedback lookup |

Admin endpoint groups are reference-only for this user-facing app. Do not treat them as permission to add or expand admin UI in v13.

## Schema Groups

| Group | Schemas |
| --- | ---: |
| [Common](./schemas/common.md) | 3 |
| [Eval Auth](./schemas/eval-auth.md) | 3 |
| [Admin Users](./schemas/admin-users.md) | 5 |
| [Admin Eval](./schemas/admin-eval.md) | 18 |
| [Admin Reading](./schemas/admin-reading.md) | 4 |
| [Admin Campaign](./schemas/admin-campaign.md) | 24 |
| [External Campaign](./schemas/external-campaign.md) | 13 |
| [Writing](./schemas/writing.md) | 22 |
| [Reading](./schemas/reading.md) | 15 |
| [Listening](./schemas/listening.md) | 17 |
| [Evaluation](./schemas/evaluation.md) | 9 |

## v13 Writing Submit Contract

The live contract changed from earlier local notes: `task_id` is no longer part of `WritingSubmitRequest`. The endpoint accepts the external TOPIK task enum and optional rich question id.

```json
{
  "task_type": "Q54",
  "question_id": "topik-writing-54-0001",
  "text": "student answer...",
  "user_id": "112a6b57-9564-4990-8bf3-6b536d622008"
}
```

Rules:

- Required fields: `task_type`, `text`.
- `task_type` must be one of `Q51`, `Q52`, `Q53`, or `Q54`.
- `question_id` is optional and should be an external rich question id returned by `GET /api/writing/tasks`, such as `topik-writing-54-0001`; omit it or send `null` for ad-hoc scoring.
- `user_id`, `lang`, and `passage_context` remain optional in the live component schema.
- Do not send the old `task_id` field or zero-padded `051`/`052`/`053`/`054` task type values to the current API.

## Evaluation Feedback Contract

The live OpenAPI now registers both evaluation lookup paths. After `POST /api/writing/submit` returns `submission_id`, poll `GET /api/evaluation/{submission_id}` until `status` is `graded`, then fetch `GET /api/evaluation/{submission_id}/feedback` for full feedback details.
