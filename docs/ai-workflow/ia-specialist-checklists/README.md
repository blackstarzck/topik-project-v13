# IA Specialist Checklists

This directory defines the judgment criteria used by specialist agents during IA remediation work.

These documents do not change product scope, route authority, IA labels, or audit scripts by themselves. They refine how agents judge evidence while executing the separate IA remediation workflow.

## Document Set

| Document | Use |
| --- | --- |
| [00-shared-rating-rubric.md](./00-shared-rating-rubric.md) | Rating labels and evidence rules shared by every specialist. |
| [01-coordinator-checklist.md](./01-coordinator-checklist.md) | Root coordinator intake, queue, packet, and merge control. |
| [02-ia-shard-reviewer-checklist.md](./02-ia-shard-reviewer-checklist.md) | IA-level route, source, pack, and page-flow review. |
| [03-ux-ui-reviewer-checklist.md](./03-ux-ui-reviewer-checklist.md) | Layout, task order, responsive behavior, and accessibility review. |
| [04-form-error-reviewer-checklist.md](./04-form-error-reviewer-checklist.md) | Forms, validation, errors, retry, and recovery review. |
| [05-hosted-surface-reviewer-checklist.md](./05-hosted-surface-reviewer-checklist.md) | Hosted modal, modal/state, and modal/toast review. |
| [06-security-data-reviewer-checklist.md](./06-security-data-reviewer-checklist.md) | Auth, owner scope, RBAC, token, PII, and data-boundary review. |
| [07-ai-ux-reviewer-checklist.md](./07-ai-ux-reviewer-checklist.md) | AI writing, analysis, feedback, recommendation, and async-status review. |
| [08-ops-policy-reviewer-checklist.md](./08-ops-policy-reviewer-checklist.md) | Deferred scope, policy, rate limit, email, audit, and operations review. |
| [09-automation-owner-checklist.md](./09-automation-owner-checklist.md) | Evidence regeneration, audit artifact, and script ownership review. |
| [10-reconciliation-final-verifier-checklist.md](./10-reconciliation-final-verifier-checklist.md) | Final label reconciliation and closeout review. |
| [11-monitor-agent-checklist.md](./11-monitor-agent-checklist.md) | Read-only process monitoring for queue, packet, evidence, and cross-IA lifecycle risk. |
| [11-monitor-agent-checklist.md](./11-monitor-agent-checklist.md) | Read-only monitor checks for queue, packets, stale evidence, write conflicts, and cross-IA lifecycle health. |

## Required Companion Docs

- [IA remediation multi-agent execution plan](../ia-remediation-multi-agent-execution-plan.md)
- [IA review profile map](../ia-review-profiles/ia-review-profile-map.json)
- [IA page implementation verification procedure](../ia-page-implementation-verification.md)
- [Context and packets](../context-and-packets.md)
- [Agent packets](../agent-packets.md)

## Operating Rules

- Every specialist must apply [00-shared-rating-rubric.md](./00-shared-rating-rubric.md).
- Every IA task packet must include the matching profile row from [ia-review-profile-map.json](../ia-review-profiles/ia-review-profile-map.json).
- Specialists are read-only reviewers unless the IA execution agent explicitly assigns an implementation slice.
- A specialist result is advisory until the IA execution agent reconciles it into the IA task packet.
- A page-flow concern that crosses IA boundaries must be recorded as a cross-IA lifecycle item, not silently fixed inside one IA.

## Research Basis

The detailed checklist items use external and community sources as review inspiration only. Active project docs remain authoritative.

| Source | Applied To |
| --- | --- |
| [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/) | Accessibility, keyboard, focus, labels, status, target sizing, and error checks. |
| [WAI-ARIA APG Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Hosted modal focus, close, inert background, and trigger-return checks. |
| [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) and [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) | Auth, session, access control, input validation, logging, and data-boundary checks. |
| [GOV.UK error message](https://design-system.service.gov.uk/components/error-message/) and [error summary](https://design-system.service.gov.uk/components/error-summary/) guidance | Form validation, error placement, error summary, and recovery-copy checks. |
| [NN/g usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) | System status, user control, consistency, prevention, and recovery checks. |
| [Google People + AI Guidebook feedback loops](https://pair.withgoogle.com/guidebook/chapters/feedback-and-controls/design-ai-feedback-loops) | AI transparency, feedback, user control, and improvement-loop checks. |
| [Playwright best practices](https://playwright.dev/docs/best-practices) | User-visible evidence, isolation, resilient locators, and web-first assertions. |
| [W3C ARIA Practices issue on content-heavy dialogs](https://github.com/w3c/aria-practices/issues/442) | Community signal for content-heavy modal focus review. |
| [Reddit QA discussion on Playwright structure](https://www.reddit.com/r/QualityAssurance/comments/1248csz/playwright_framework_best_practicesstructure/) | Community signal that test structure must be explicit enough for repeatable ownership. |
