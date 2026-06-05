# AI Agent Contract

This file is the short, mandatory contract for every AI agent working in this repository. Keep it small.

## Project State

This repository now has a foundation implementation. `src/` and `package.json`
exist, with the Next.js App Router scaffold, Supabase/auth/theme foundations,
and some learning and feedback surfaces already started.

Treat `docs/` as the source of truth for product intent, architecture decisions,
workflow rules, quality gates, and intended behavior. Treat current source as
the implementation reference for behavior that already exists. Before changing
behavior, reconcile current source code with accepted docs. Do not silently
invent product behavior.

Use [README.md](README.md) and [docs/README.md](docs/README.md) for human-friendly navigation.

## Non-Negotiable Rules

- **Admin scope boundary**: this repo is the user-facing app. Do NOT build, extend, or remediate admin features (IA `H-01`/`X-08`/`X-10`/`X-15`) or add admin-oriented schema/migrations now; admin is owned in a separate folder and is synced LATER. Do not delete the existing (frozen) admin code. This supersedes any handoff/IA-audit text listing admin as in-scope. See [docs/admin-scope-boundary.md](docs/admin-scope-boundary.md).
- Do not run a fresh grill-me/domain-discovery interview for covered product scope. The product/domain decisions already live in `docs/`.
- If the user request conflicts with active docs, stop and report the conflict with exact file references.
- For net-new scope, product pivots, or requirements not covered by active docs, do not implement directly. First produce either a docs update proposal or a user-approved implementation brief with acceptance criteria.
- Fail closed for doc conflicts, missing approval, destructive actions, secret exposure risk, and security uncertainty.
- User-facing replies must follow [docs/user-communication-style.md](docs/user-communication-style.md). This is mandatory for every AI agent and applies to every user-facing reply, plan, report, handoff, review, and summary.

## Development Status Explanation Format

When explaining development status to the user, follow this format:

1. 한 줄 요약: 비개발자도 이해할 수 있게 말한다.
2. 사용자가 겪는 현상: 화면에서 실제로 어떤 문제가 보이는지 설명한다.
3. 쉬운 원인: 기술 용어 없이 비유나 일상어로 설명한다.
4. 개발자용 원인: 필요한 경우에만 괄호로 짧게 덧붙인다.
5. 해결 방법: 지금 어떤 작업을 할 건지 단계별로 말한다.
6. 영향 범위: 로그인, 회원가입, 결제 등 어떤 기능에 영향이 있는지 말한다.
7. 내가 확인할 것: 사용자가 직접 확인해야 할 게 있으면 알려준다.

## Objectivity And Assumptions

- Do not default to agreeing with the user. Evaluate requests objectively against
  the active docs, current code, security constraints, and implementation risk.
- If the user's request is incorrect, incomplete, risky, or conflicts with
  active docs, state that clearly with concrete references.
- Do not invent product behavior, architecture decisions, data rules, security
  rules, UX flows, or business logic that are not present in active docs or
  explicitly approved by the user.
- When required behavior is missing from active docs, first ask a clarifying
  question or propose a docs update / implementation brief with acceptance
  criteria. Do not implement from assumption.
- Reasonable implementation details may be inferred only when they are low-risk,
  reversible, and directly implied by existing docs, code patterns, or tool
  conventions.
- When making any inference, state the inference and its basis before relying on
  it for implementation.

## Detailed References

- Human docs map: [docs/README.md](docs/README.md)
