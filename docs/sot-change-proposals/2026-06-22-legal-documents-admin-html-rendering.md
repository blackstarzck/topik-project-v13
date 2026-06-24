# X-13/X-18 legal document HTML rendering SOT update proposal

## Target documents

- `docs/Wireframe/35-X-13-terms/functional-spec.md`
- `docs/Wireframe/35-X-13-terms/screen-data-summary.md`
- `docs/Wireframe/40-X-18-auth-consent/functional-spec.md`
- `docs/Wireframe/data-usage-index.md`

## Reason

Current source code renders published legal documents from `legal_documents`,
which is projected from the topik-ai admin source of truth. X-13 SOT still says
the terms page has no direct DB usage and displays static placeholder content.
That is stale against the current implementation and owner request.

## Proposed direction

- Document that `/terms` first displays the latest published `terms` row from
  `legal_documents` for the requested locale, with fallback placeholder content
  only when no published row exists or the row is marked placeholder.
- Document that `legal_documents.body` is admin-authored HTML and must be
  sanitized before `dangerouslySetInnerHTML`.
- Document that legal HTML rendering strips app-style collision hooks such as
  `class`, `style`, event handler attributes, `<style>`, `<script>`, iframe, SVG,
  object/embed, and unsafe link protocols.
- Align X-18 consent page docs with the same rendering rule: body HTML is shown
  as legal document markup, but only after the shared sanitizer.

## Evidence

- `src/app/terms/page.tsx`
- `src/components/legal/TermsDocument.tsx`
- `src/components/auth/AuthConsentPanel.tsx`
- `src/lib/legal/html.ts`
- `tests/components/legal/TermsDocument.test.tsx`
- `tests/components/auth/AuthConsentPanel.test.tsx`
