# Context Ledger — i18n Infrastructure (G-01 foundation)

## Run Metadata

- Run id: 20260602-i18n-infrastructure-g01
- Created: 2026-06-02
- Updated: 2026-06-02
- Main session owner: Claude Code (Opus 4.8 1M)
- Host: Claude Code
- Status: complete (pending browser evidence — see QA Gate)

## Task

- User goal: Build the i18n INFRASTRUCTURE so the user's language preference
  actually re-renders the UI. G-01 discovery flagged that `ui_locale` persists
  but no screen renders in the chosen language because there is no message
  catalog.
- Accepted scope:
  - next-intl WITHOUT i18n routing (cookie/user-pref locale; no `/[locale]`).
  - Server locale resolver: authenticated `profiles.ui_locale` → `NEXT_LOCALE`
    cookie → `'ko'`. Supported: ko (baseline), en, vi.
  - Root layout: `<html lang={locale}>` + provider with active locale + messages.
  - `messages/ko.json` + `en.json` + `vi.json` STARTER catalog (common actions,
    workspace side-nav, landing header, 1-2 representative screens).
  - G-01 LanguageForm: persist `ui_locale` (already wired) AND set `NEXT_LOCALE`
    cookie + refresh so the switch takes effect immediately.
  - Migrate STARTER surfaces (side-nav, landing header, common buttons, G-01
    screen) to `t()` to prove end-to-end switching.
  - Ledger note + incremental migration plan + how to add a language.
- Out of scope:
  - Migrating EVERY string (later content task).
  - URL-locale routing / route restructuring.
  - Editing `supabase/migrations/`.
- Current next action: complete — see Verification State.

## Docs Consulted

- Exact files read:
  - `CLAUDE.md`, `AGENTS.md` (workflow + Korean response tone).
  - `docs/Wireframe/20-G-01-language-settings/functional-spec.md` (G-01 spec).
  - `src/app/layout.tsx`, `src/app/providers.tsx`, `src/app/(workspace)/layout.tsx`.
  - `src/components/settings/LanguageForm.tsx`, `src/app/(workspace)/settings/language/page.tsx`.
  - `src/lib/settings/{server,mutations,types}.ts`.
  - `src/components/app/{SidebarNav,WorkspaceShell,AppHeader}.tsx`, `src/lib/routes.ts`.
  - `src/components/landing/{LandingHeader,Hero}.tsx`, `src/app/page.tsx`.
  - `src/lib/auth/{profile,session}.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/types.ts`.
  - `src/contexts/theme-context.tsx` (cookie + initial-seed pattern to mirror).
  - `tests/components/settings/LanguageForm.test.tsx`, `tests/theme/layout-hydration.test.ts`.
- Extracted requirements:
  - Locale resolution order is explicit (user pref → cookie → ko).
  - LanguageForm currently relies on query invalidation only; that does NOT
    re-render the server-resolved locale. Needs cookie write + `router.refresh()`.
  - `layout-hydration.test.ts` navigates the exact tree
    `<html>`→`<body>`→`<AntdRegistry>`→`<AppProviders>`. Provider must NOT be
    inserted between AntdRegistry and AppProviders, or that test breaks.
  - `LanguageForm.test.tsx` asserts Korean labels via substring `/English/`,
    `/Tiếng Việt/`; ko.json values must preserve current Korean text.
- Doc conflicts: none.
- Untouched relevant docs and reason:
  - `docs/prd.md`, `docs/spec.md` — product specs unchanged by infra wiring.
  - `docs/sitemap.md` — no route changes (no URL-locale routing added).

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-06-02 | Use next-intl WITHOUT routing, not custom dict loader | Documented cookie/user-pref pattern; handles RSC/client split (`getTranslations` server, `useTranslations` client) out of the box; lower risk than hand-rolled RSC-safe context | task brief option A |
| 2026-06-02 | `getRequestConfig` returns `{locale, messages}`; no routing module | next-intl supports non-routed locale by reading the request (cookie/session) directly | next-intl docs |
| 2026-06-02 | Place `NextIntlClientProvider` INSIDE `AppProviders` (client), pass `locale`+`messages` as props from root layout | Keeps root layout JSX tree intact so `layout-hydration.test.ts` tree navigation still works | tests/theme/layout-hydration.test.ts |
| 2026-06-02 | Resolve locale in a shared `resolveLocale()` server helper reused by `getRequestConfig` AND root layout | Single source of truth; layout needs the same value for `<html lang>` | code |
| 2026-06-02 | LanguageForm writes `NEXT_LOCALE` cookie + `router.refresh()` on save | Cookie is the resolver fallback for the just-saved value before the next `getUser` round-trip; refresh re-runs server render so UI switches immediately | task brief #4 |
| 2026-06-02 | ko.json migrated values copied verbatim from current source strings | Keep existing unit tests green | tests |

## Active Files

- Files expected to change:
  - ADD `src/i18n/request.ts`, `src/i18n/locales.ts`, `messages/{ko,en,vi}.json`.
  - EDIT `next.config.ts` (next-intl plugin), `package.json` (dep).
  - EDIT `src/app/layout.tsx`, `src/app/providers.tsx`.
  - EDIT `src/components/settings/LanguageForm.tsx`.
  - EDIT migrated surfaces: `SidebarNav.tsx` + `routes.ts` (label source),
    `LandingHeader.tsx`, `Hero.tsx`, `AppHeader.tsx`.
- Files explicitly not to touch: `supabase/migrations/**` (untouched).
- Files changed (final):
  - ADDED: `src/i18n/locales.ts`, `src/i18n/request.ts`, `src/i18n/messages.d.ts`,
    `messages/ko.json`, `messages/en.json`, `messages/vi.json`,
    `tests/lib/i18n/locale-resolution.test.ts`,
    `tests/lib/i18n/catalog-parity.test.ts`.
  - EDITED: `next.config.ts`, `package.json` (+`pnpm-lock.yaml`),
    `src/app/layout.tsx`, `src/app/providers.tsx`,
    `src/app/(workspace)/settings/language/page.tsx`,
    `src/components/settings/LanguageForm.tsx`,
    `src/components/app/{SidebarNav,WorkspaceShell,AppHeader}.tsx`,
    `src/lib/routes.ts`,
    `src/components/landing/{LandingHeader,Hero}.tsx`,
    `tests/components/settings/LanguageForm.test.tsx`,
    `tests/theme/layout-hydration.test.ts`.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes.
- Child result packets integrated: not applicable (single-session, no child agents).
- Verification state current: yes (typecheck/lint/test all exit 0).
- Remaining risks listed: yes (browser runtime verification pending).

## Verification State

- Required checks: `pnpm -s typecheck`, `pnpm -s lint` (0 errors), `pnpm -s test`.
- Checks run + latest results (2026-06-02):
  - `pnpm -s typecheck` → exit 0 (0 errors). Note: next-intl's strict type
    augmentation (src/i18n/messages.d.ts) surfaced one `Translator` key-type
    mismatch in SidebarNav; fixed by deriving `NavTranslate`/`NavKey` from
    `useTranslations<"nav">` and casting the plain-string `labelKey` at the
    single call site.
  - `pnpm -s lint` → exit 0 (0 errors; pre-existing warnings only).
  - `pnpm -s test` → exit 0 (505 total, 502 passed, 0 failed, 3 skipped).
    +12 new tests vs baseline (i18n locale-resolution + catalog-parity +
    2 new layout-hydration locale-threading cases).
- Known failures: known flaky `writing-flow notFound questionId=99` (passes in
  isolation) — passed on the final run; ignored per task brief regardless.
- Cross-model review: pending (docs-only-adjacent infra; flag for evidence phase).
- Architecture Pass: n/a (not a phase-complete gate; infra wiring).
- QA Gate: degraded — cannot boot dev server in this environment.
  - blocker: no dev server / browser available here.
  - alternative verification: typecheck + lint + unit tests green; root-layout
    locale threading covered by extending layout-hydration test.
  - residual risk: visible locale switch in a live browser is UNVERIFIED — must
    be confirmed in evidence phase (see runtime-verification notes in report).

## Risks And Follow-Up

- Remaining risks: runtime re-render of locale switch not browser-verified here.
- Assumptions: next-intl 4.13 API (`getRequestConfig`, `NextIntlClientProvider`,
  `useTranslations`, `getTranslations`) — pinned at install.

## i18n Setup Summary (what now exists)

- `src/i18n/locales.ts` — supported locales (`ko` baseline, `en`, `vi`),
  `DEFAULT_LOCALE`, `LOCALE_COOKIE` (`NEXT_LOCALE`), `asLocale()` guard.
- `src/i18n/request.ts` — `resolveLocale()` (profiles.ui_locale → NEXT_LOCALE
  cookie → ko, all failures degrade gracefully) + the default
  `getRequestConfig` returning `{ locale, messages }`. NO URL routing.
- `src/i18n/messages.d.ts` — next-intl type augmentation against ko.json so
  `t()` keys are type-checked.
- `next.config.ts` — wrapped with `createNextIntlPlugin("./src/i18n/request.ts")`.
- `src/app/layout.tsx` — `<html lang={resolveLocale()}>` + passes locale +
  `getMessages()` into `AppProviders`.
- `src/app/providers.tsx` — `NextIntlClientProvider` nested INSIDE the client
  `AppProviders` (keeps the root-layout RSC tree shape for the hydration test).
- `messages/{ko,en,vi}.json` — starter catalog (namespaces: `common`, `app`,
  `nav`, `landing`, `settings.language`). Parity enforced by a unit test.

## Migrated starter surfaces (proves end-to-end switching)

- Side-nav: `src/lib/routes.ts` (added `labelKey` + lock = message key) +
  `src/components/app/SidebarNav.tsx` (`useTranslations("nav")`).
- Workspace shell/header: `WorkspaceShell.tsx` (drawer title), `AppHeader.tsx`
  (menu aria-label + brand) — `useTranslations("app")`.
- Landing header: `LandingHeader.tsx` (`useTranslations("landing")`).
- Landing hero: `Hero.tsx` (`useTranslations("landing")`).
- G-01 screen: `LanguageForm.tsx` (`settings.language` + `common`) and
  `settings/language/page.tsx` heading (server `getTranslations`).

## Incremental string-migration plan (what remains)

Migrate cluster by cluster; for each string: add the key to `messages/ko.json`
with the EXACT current Korean text (keeps unit tests green), add `en`/`vi`,
then swap the literal for `t()` / `getTranslations`. Run the catalog-parity
test after each batch. Suggested order (highest user visibility first):

1. Auth surfaces — `src/components/auth/*` (LoginForm, SignUpForm,
   PasswordReset*, AuthErrorCard) + `src/app/login|sign-up|password-reset/*`.
2. Dashboard (B-01) — `src/components/dashboard/*` + dashboard page.
3. Practice (C-01/C-02/R-02/X-07) — `src/components/practice/*`.
4. Writing + feedback (D-0x/E-0x/R-01) — `src/components/writing/*`,
   `src/components/feedback/*`, `src/components/reports/*`.
5. Library (F-01) — `src/components/library/*`.
6. Growth (X-02) — `src/components/growth/*`.
7. Profile + remaining settings (X-05/X-09) — `src/components/profile/*`,
   `NotificationPrefsForm.tsx`.
8. Subscription/paywall (X-03/X-04) — `src/components/settings/Subscription*`.
9. Admin (H-01/X-08/X-10/X-15) — `src/components/admin/*`.
10. Landing leftovers — `FeatureCard.tsx`, `ProductPreview.tsx`, page feature copy.
11. Shared/system — `src/components/shared/*` (AppError/AppLoading/AppNotFound/
    PlaceholderPage), legal pages, route `metadata.title` strings.

Notes:
- Page `metadata.title` is set at module scope and can't call `getTranslations`
  there directly; use `generateMetadata()` per page when migrating titles.
- Keep namespaces aligned to IA/feature areas (e.g. `auth`, `dashboard`,
  `practice`) for reviewable diffs.

## How to add a new language (e.g. `ja`)

1. Add the code to `LOCALES` in `src/i18n/locales.ts`.
2. Add the enum value to `profiles.ui_locale` (DB migration — owned by the
   user; NOT edited here) AND to the `ui_locale` union in
   `src/lib/supabase/types.ts` + `src/lib/settings/types.ts`.
3. Create `messages/ja.json` with the SAME key set as `ko.json` (the
   catalog-parity unit test enforces this).
4. Add a radio option in `LanguageForm.tsx` (`optionJa` key) + the option label.
5. No routing or resolver changes needed — `resolveLocale()` + `asLocale()`
   pick it up automatically.

## Runtime-verification notes (EVIDENCE phase)

Cannot boot a dev server here. Confirm in a browser:
- Set `/settings/language` to English, Save → side-nav, app header, drawer
  title, landing header/hero, and the G-01 screen re-render in English WITHOUT
  a manual reload (router.refresh path), and `<html lang>` becomes `en`.
- Repeat for Tiếng Việt.
- Anonymous visitor with `NEXT_LOCALE=en` cookie → landing renders in English.
- New login: a user whose `profiles.ui_locale=vi` lands in Vietnamese on first
  authenticated render (profile beats cookie).
- No hydration mismatch warning in the console (SSR lang == client locale).
