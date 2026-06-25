# Auto UI Locale Detection Proposal

## Background

TALKPIK already supports UI locale settings through `profiles.ui_locale` and the `NEXT_LOCALE` cookie. New visitors and new OAuth users currently fall back to the Korean baseline unless they manually change the setting.

## Proposed Behavior

- Use the browser/device language hint as an initial UI locale hint.
- Supported UI locales remain `ko`, `en`, and `vi`.
- Resolution order:
  1. authenticated `profiles.ui_locale`, except `ui_locale_source='default'`
  2. supported `NEXT_LOCALE` cookie value
  3. supported `Accept-Language` request header value
  4. stored default profile locale or `ko`
- Persist only the resolved locale and provenance:
  - `legacy`: existing rows before this feature
  - `default`: bootstrap fallback with no usable hint
  - `auto`: request/browser hint
  - `manual`: explicit user choice

## Boundaries

- This affects UI language only.
- It does not change `learning_locale`, AI feedback language, problem content language, billing, admin behavior, or legal document authoring.
- Raw language header values are not stored or logged.
- Manual user choice always overrides automatic hints.

## Implementation Notes

- Server locale resolution reads `Accept-Language` only after non-default profile and cookie fail.
- Email sign-up stores the active rendered UI locale in Supabase Auth metadata.
- OAuth/auth-completion users whose profile was created with `ui_locale_source='default'` render consent and completion checks with the same effective locale, then can be corrected once from the current request hint before consent documents are recorded.
- Existing users remain `legacy` until they manually change language or another explicit migration is approved.
