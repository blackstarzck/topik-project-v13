# SOT Change Proposal: Profile Country/Region Field

## Target SOT

- `docs/Wireframe/27-X-05-profile-editing/functional-spec.md`
- `docs/Wireframe/data-usage-index.md`
- `docs/sot-change-proposals/2026-06-17-sign-up-nationality.md`

## Reason

`profiles.nationality_country_code` is already collected during sign-up and
stored as nullable profile metadata. The profile page should let users review
and correct the same country/region value without moving account status or
learning-goal information back into `/profile`.

## Proposed Direction

- Add a country/region field to `/profile` under the profile identity fields.
- Reuse the same country list source, local flag rendering, and localized
  display-name behavior as sign-up:
  - `country-flag-icons`
  - `Intl.DisplayNames`
  - uppercase ISO 3166-1 alpha-2 country codes
- Continue storing only `profiles.nationality_country_code`; do not store
  country names, flag URLs, or external CDN references.
- Keep the product label as "Country/region" / "국가/지역" rather than
  "Nationality" / "국적" to match the existing sign-up proposal and reduce
  identity/political sensitivity.
- Keep the field optional for existing users whose profile row has `NULL`.
- Do not add admin user-management scope.

## Acceptance Criteria

- `/profile` renders the existing country/region when
  `profiles.nationality_country_code` is present.
- Existing users with `NULL` can leave the field blank.
- Editing the field marks the profile form dirty and enables Save.
- Saving sends `nationality_country_code` together with the existing profile
  draft fields.
- `getProfileSettings()` includes `nationality_country_code` in its projection.
- `updateProfile()` can patch `nationality_country_code` without clobbering
  other profile fields.
- Existing sign-up country/region behavior remains unchanged.
- Tests cover profile rendering, profile save payload, server projection, and
  mutation patch shape.

## Follow-up

- Update the active X-05 and data-usage SOT if this proposal is accepted.
- Update formal privacy/legal copy before production launch to explain the
  purpose and handling of country/region data.
