# Deferred Scope

> Last updated: 2026-05-19

This file records product or technical areas that may appear in PRD context but
are not part of the current implementation stack.

## Billing

Billing, subscriptions, paywalls, payment history, and payment provider selection
are not part of the current development stack.

Current rule:

- Do not install `stripe` or another billing SDK during initial implementation.
- Do not create payment flows until billing scope is explicitly reopened.
- If subscription labels are needed for UI mocks, use local fixture data or a simple profile field only as a placeholder.
- Choosing Stripe, Lemon Squeezy, Paddle, Toss Payments, or another provider requires a separate stack-change decision.

PRD references to membership, payment, subscription, or paywall are retained as
future product context, not current implementation requirements.

The sitemap may include `/paywall` and `/subscription` as Paper-frame UI shells.
Those routes do not reopen billing implementation scope: no billing SDK,
payment provider selection, checkout, invoices, or real payment flows should be
implemented until this file and the implementation spec are updated.

## Deferred Defaults

| Deferred or rejected | Reason |
| --- | --- |
| Stripe at MVP start | Billing is explicitly deferred for the current phase. |
| Payment provider selection | Requires a separate product and operational decision. |

## Out of Scope Markers (OOS)

Per-feature deferrals discovered during IA implementation/remediation. Each
marker names what is intentionally NOT built yet and the honest UI behavior that
must ship instead, so screen copy never promises capability that does not exist.

### OOS F-M1 · PDF export (browser-print MVP supersede)

Phase 6 PDF export is a browser-print MVP: `window.print()` via
`src/lib/export/pdf-export.ts`, triggered by a per-row `PDF로 내보내기` button.

The fuller documented F-M1 export modal — dimmed background, PDF 옵션 with
파일명 (1–60자), 항목 6개 이하 selection, 개인정보 확인 필수 consent, 미리보기,
생성·다운로드 CTA with 재시도 + 문의 affordances, and a stored-file download — is
DEFERRED until the storage/export queue lands.

Current rule:

- No antd Modal, consent checkbox, or filename field for export in Phase 6.
- The UI must not promise a stored, downloadable file beyond a disabled
  placeholder. Browser print is the only honest export path right now.

### OOS G-01 · i18n / translation coverage

The UI-language preference (`ui_locale`) is persisted, but message-catalog
translation of screen copy is deferred.

Current rule:

- The UI must not claim immediate re-translation of screens when the language
  preference changes — only the stored preference changes.
- 학습 언어 / 콘텐츠 설정 options are display-only previews; they are NOT persisted
  in Phase 6.

### OOS X-09 · Notification transport

Email / Zalo / SMS / push delivery infrastructure is deferred.

Current rule:

- `/settings/notifications` persists only the 3 boolean preferences
  (`weekly_summary` / `feedback_ready` / `study_reminder`).
- Channel selection (Zalo) and reminder-time (HH:mm) are preview-only and are
  NOT persisted.
- UI copy must not imply real delivery of any notification.

### OOS D-04 / D-M2 · Writing submit-failure support channel

A 문의 / 고객지원 link on submit or analysis failure is deferred until a
support-channel surface exists.

Current rule:

- On submit/analysis failure, the honest behavior is: keep the modal open,
  offer retry, and advise copying the answer.
- Do not render a 문의/고객지원 link or promise human support until that surface
  ships.
