# Wireframe Functional Spec Index

이 문서는 36개 Wireframe 페이지의 기능명세 문서와 DB 사용 명세를 한곳에서 찾기 위한 인덱스입니다. 관리자 화면은 별도 관리자 앱(topik-ai) 소관이라 이 인덱스에 없습니다.

## 기준

- Active IA: `docs/Wireframe/`
- Active flow: `docs/flow/user-flow.md`
- DB source of truth: `supabase/migrations/*.sql`
- Source usage scan: `src/**`, `tests/**`, `scripts/**`

## Page Index

| IA | Screen | Route | Audience | DB links | Spec |
| --- | --- | --- | --- | ---: | --- |
| A-01 | Sign-up | `/sign-up` | public | 2 | [functional-spec.md](./01-A-01-sign-up/functional-spec.md) |
| A-02 | Login | `/login` | public | 1 | [functional-spec.md](./02-A-02-login/functional-spec.md) |
| A-03 | Learning goal setup | `/onboarding/learning-goal` | user | 2 | [functional-spec.md](./03-A-03-learning-goal-setup/functional-spec.md) |
| B-01 | Home dashboard | `/dashboard` | user | 9 | [functional-spec.md](./04-B-01-home-dashboard/functional-spec.md) |
| C-01 | Problem type recommendations | `/practice/recommendations` | user | 4 | [functional-spec.md](./05-C-01-problem-type-recommendations/functional-spec.md) |
| C-02 | Problem list | `/practice/problems` | user | 5 | [functional-spec.md](./06-C-02-problem-list/functional-spec.md) |
| C-03 | Retry modal | `/practice/problems` | user | 2 | [functional-spec.md](./07-C-03-retry-modal/functional-spec.md) |
| D-01 | Short-answer writing 51 | `/writing/short-answer-writing-51` | user | 5 | [functional-spec.md](./08-D-01-short-answer-writing-51/functional-spec.md) |
| D-02 | Answer writing 52 | `/writing/answer-writing-52` | user | 5 | [functional-spec.md](./09-D-02-answer-writing-52/functional-spec.md) |
| D-03 | Long-form writing 53 | `/writing/long-form-writing-53` | user | 5 | [functional-spec.md](./10-D-03-long-form-writing-53/functional-spec.md) |
| D-04 | Essay writing 54 | `/writing/essay-writing-54` | user | 5 | [functional-spec.md](./11-D-04-essay-writing-54/functional-spec.md) |
| D-M1 | Submission confirmation | `/writing/short-answer-writing-51, /writing/answer-writing-52, /writing/long-form-writing-53, /writing/essay-writing-54` | user | 3 | [functional-spec.md](./12-D-M1-submission-confirmation-modal/functional-spec.md) |
| D-M2 | AI analysis loading | `writing submission flow` | user | 3 | [functional-spec.md](./13-D-M2-ai-analysis-loading/functional-spec.md) |
| E-01 | Short-answer feedback | `/writing/feedback/short/:id` | user | 7 | [functional-spec.md](./14-E-01-short-answer-feedback/functional-spec.md) |
| E-02 | Long-form feedback | `/writing/feedback/long/:id` | user | 7 | [functional-spec.md](./15-E-02-long-form-feedback/functional-spec.md) |
| R-01 | Comparison report | `/writing/reports/:id/compare` | user | 6 | [functional-spec.md](./16-R-01-comparison-report/functional-spec.md) |
| R-02 | Next problem recommendation | `/practice/next` | user | 5 | [functional-spec.md](./17-R-02-next-problem-recommendation/functional-spec.md) |
| F-01 | My library | `/library` | user | 6 | [functional-spec.md](./18-F-01-my-library/functional-spec.md) |
| F-M1 | PDF export modal | `/library, /writing/feedback/short/:id, /writing/feedback/long/:id, /writing/reports/:id/compare` | user | 3 | [functional-spec.md](./19-F-M1-pdf-export-modal/functional-spec.md) |
| G-01 | Language settings | `/settings/language` | user | 1 | [functional-spec.md](./20-G-01-language-settings/functional-spec.md) |
| D-M3 | Autosave warning | `/writing/short-answer-writing-51, /writing/answer-writing-52, /writing/long-form-writing-53, /writing/essay-writing-54` | user | 2 | [functional-spec.md](./22-D-M3-autosave-warning/functional-spec.md) |
| X-01 | Product landing | `/` | public | 3 | [functional-spec.md](./23-X-01-product-landing/functional-spec.md) |
| X-02 | Growth dashboard | `/growth` | user | 5 | [functional-spec.md](./24-X-02-growth-dashboard/functional-spec.md) |
| X-03 | Paywall | `/paywall` | user | 3 | [functional-spec.md](./25-X-03-paywall/functional-spec.md) |
| X-04 | Subscription management | `/subscription` | user | 4 | [functional-spec.md](./26-X-04-subscription-management/functional-spec.md) |
| X-05 | Profile editing | `/profile` | user | 4 | [functional-spec.md](./27-X-05-profile-editing/functional-spec.md) |
| X-06 | Password reset | `/password-reset` | public | 1 | [functional-spec.md](./28-X-06-password-reset/functional-spec.md) |
| X-07 | Weakness-based recommendations | `/practice/weakness` | user | 3 | [functional-spec.md](./29-X-07-weakness-based-recommendations/functional-spec.md) |
| X-09 | Notification settings | `/settings/notifications` | user | 5 | [functional-spec.md](./31-X-09-notification-settings/functional-spec.md) |
| X-11 | Auth error | `/auth/error` | public | 1 | [functional-spec.md](./33-X-11-auth-error/functional-spec.md) |
| X-12 | Auth verify-email | `/auth/verify-email` | public | 2 | [functional-spec.md](./34-X-12-auth-verify-email/functional-spec.md) |
| X-13 | Terms | `/terms` | public | 0 | [functional-spec.md](./35-X-13-terms/functional-spec.md) |
| X-14 | Privacy policy | `/privacy` | public | 0 | [functional-spec.md](./36-X-14-privacy-policy/functional-spec.md) |
| X-16 | Password reset confirm | `/password-reset/confirm` | public | 0 | [functional-spec.md](./38-X-16-password-reset-confirm/functional-spec.md) |
| X-17 | Auth callback fragment | `/auth/callback-fragment` | public | 0 | [functional-spec.md](./39-X-17-auth-callback-fragment/functional-spec.md) |
| X-18 | Auth consent | `/auth/consent` | user | 3 | [functional-spec.md](./40-X-18-auth-consent/functional-spec.md) |

## Known Document Conflicts

- No known broken document links in this index as of the 2026-06-16 cleanup.
