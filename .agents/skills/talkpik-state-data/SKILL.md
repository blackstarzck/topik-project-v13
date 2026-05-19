---
name: talkpik-state-data
description: Use when implementing or reviewing TALKPIK React state, Zustand stores, TanStack Query usage, server data ownership, URL state, forms, React Hook Form, or Zod validation.
---

# TALKPIK State And Data

This skill prevents data ownership drift between Server Components, client state, forms, and stores.

## Required Docs

Read these before editing:

1. `docs/spec.md`
2. `docs/development/stack.md`
3. The relevant behavior, page, or flow docs for the feature

## Ownership Order

Use the smallest state owner that fits:

1. Server Components, route handlers, and server actions for server-owned data and mutations.
2. React local state for component-private UI.
3. URL search params for shareable filters, tabs, pagination, and route-level view state.
4. React Hook Form for form-local state and validation flow.
5. TanStack Query only for client-side server state that cannot stay purely server-rendered.
6. Zustand only for recoverable client interaction state, cross-component coordination, or temporary UI continuity.

## Store Rules

- Keep stores focused by product area.
- Use the target stores listed in `docs/spec.md` unless an updated spec changes them.
- Do not duplicate server-derived data in Zustand unless the UI needs an editable draft or optimistic interaction state.
- Long-form writing input must be recoverable through autosave or clear draft-preservation cues.

## Validation Rules

- Use Zod for shared form, API, and AI contract validation where practical.
- Keep schema files under `src/lib/validation/` or a similarly focused boundary.
- Keep form validation behavior visible to the user with clear error states.

## Review Questions

- Is this state server-owned, shareable URL state, form state, or temporary UI continuity?
- Does a client component boundary exist only where interactivity is needed?
- Can the same data become stale in two places?
- Is optimistic state reconciled with the server response?
