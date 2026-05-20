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
