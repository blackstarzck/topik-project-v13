# SOT Change Proposal: Sign-up Country/Region Code

## Target SOT

- `docs/Wireframe/01-A-01-sign-up/description.md`
- `docs/Wireframe/01-A-01-sign-up/functional-spec.md`
- `docs/Wireframe/01-A-01-sign-up/screen-data-summary.md`
- `docs/Wireframe/data-usage-index.md`
- `supabase/migrations/INDEX.md`
- `docs/Wireframe/27-X-05-profile-editing/functional-spec.md` if country/region becomes editable from profile settings
- Legal/privacy SOT when the formal privacy notice is updated

## Reason

The product request adds a country/region attribute during sign-up and persists it to `public.profiles`. Current A-01 SOT lists name, email, password, and terms, but does not define country/region collection or storage.

Follow-up research changed the storage decision: do not store country names, flag URLs, or CDN paths in the database. Store only an ISO 3166-1 alpha-2 uppercase code.

## Proposed Direction

- Add `nationality_country_code` as nullable profile metadata on `public.profiles`.
- Store only ISO 3166-1 alpha-2 uppercase codes such as `KR`, `VN`, `US`, and `JP`.
- Keep existing users compatible by making `profiles.nationality_country_code` nullable.
- Label the sign-up field as "Country/region" / "국가/지역" instead of "Nationality" / "국적" to reduce identity and political sensitivity.
- Render flags from a local SVG package (`country-flag-icons`) in the sign-up UI; do not depend on an external CDN/API at runtime.
- Use `Intl.DisplayNames` for localized country/region labels.
- Pass `nationality_country_code` through Supabase Auth metadata and seed `profiles.nationality_country_code` in `public.handle_new_user()`.
- Do not add admin user-management scope.

## Acceptance Criteria

- `/sign-up` starts with only the name field visible.
- After a valid name, the country/region selector appears.
- After a valid country/region selection, email appears.
- Existing progressive behavior remains: previous fields stay visible and editable.
- Email sign-up sends `options.data.display_name` and `options.data.nationality_country_code`.
- `public.profiles.nationality_country_code` exists, accepts `NULL` for existing users, and checks uppercase two-letter codes against the supported country/region code list.
- `public.handle_new_user()` seeds `profiles.nationality_country_code` from auth metadata.
- Supabase type snapshot includes `profiles.nationality_country_code` in `Row`, `Insert`, and `Update`.
- Tests cover unit form flow, e2e sign-up payload, migration shape, and type snapshot.

## Open Follow-up

- Decide whether country/region should later become editable in `/profile`.
- Decide whether `country_code` should replace `nationality_country_code` in a future neutral naming cleanup.
- Update formal privacy/legal copy before production launch to explain the purpose and handling of country/region data.
