# IA Implementation Audit

- Run id: 20260528-141731
- Source commit: b7b7189681aaf7f5aed8a3b2ec7d34c187f365ff
- Evidence bundle: 96e5d23b0ad1221f

| IA | Screen | Route | Type | Audience | Final label | Top gaps |
| --- | --- | --- | --- | --- | --- | --- |
| A-01 | Sign-up | `/sign-up` | page | public | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| A-02 | Login | `/login` | page | public | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| A-03 | Learning goal setup | `/onboarding/learning-goal` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| B-01 | Home dashboard | `/dashboard` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| C-01 | Problem type recommendations | `/practice/recommendations` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| C-02 | Problem list | `/practice/problems` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| C-03 | Retry modal | `/practice/problems` | user chooses to solve a previously attempted or retry-eligible problem. | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| D-01 | Short-answer writing 51 | `/writing/51` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| D-02 | Answer writing 52 | `/writing/52` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| D-03 | Long-form writing 53 | `/writing/53` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| D-04 | Essay writing 54 | `/writing/54` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| D-M1 | Submission confirmation | `/writing/51, /writing/52, /writing/53, /writing/54` | user submits a writing answer. | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| D-M2 | AI analysis loading | `writing submission flow` | submission accepted and feedback/report generation is pending. | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| E-01 | Short-answer feedback | `/writing/feedback/short/:id` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| E-02 | Long-form feedback | `/writing/feedback/long/:id` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| R-01 | Comparison report | `/writing/reports/:id/compare` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| R-02 | Next problem recommendation | `/practice/next` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| F-01 | My library | `/library` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| F-M1 | PDF export modal | `/library, /writing/feedback/short/:id, /writing/feedback/long/:id, /writing/reports/:id/compare` | user exports feedback or report content. | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| G-01 | Language settings | `/settings/language` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| H-01 | Admin problem management | `/admin/problems` | page | admin | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| D-M3 | Autosave warning | `/writing/51, /writing/52, /writing/53, /writing/54` | autosave failure, delay, or conflicting save state. | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| X-01 | Product landing | `/` | page | public | BLOCKED | missing agent-integration-results.json<br>missing ai-ux-review row<br>1 console/page errors captured |
| X-02 | Growth dashboard | `/growth` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| X-03 | Paywall | `/paywall` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| X-04 | Subscription management | `/subscription` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| X-05 | Profile editing | `/profile` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| X-06 | Password reset | `/password-reset` | page | public | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| X-07 | Weakness-based recommendations | `/practice/weakness` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| X-08 | Organization admin dashboard | `/admin/org` | page | admin | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| X-09 | Notification settings | `/settings/notifications` | page | user | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| X-10 | Admin user management | `/admin/users` | page | admin | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| X-11 | Auth error | `/auth/error` | page | public | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |
| X-12 | Auth verify-email | `/auth/verify-email` | page | public | BLOCKED | missing security-navigation-results row<br>missing agent-integration-results.json<br>missing ai-ux-review row |

