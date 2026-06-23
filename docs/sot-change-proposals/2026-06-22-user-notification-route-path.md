# User notification route path implementation brief

Date: 2026-06-22

## Scope

User-facing in-app notifications should use the notification movement path when
one is present. If no movement path is present, clicking the notification should
only mark it as read and should not change the current page.

## Acceptance Criteria

- B-01 dashboard notification rows and the workspace notification bell share
  one destination resolver.
- A blank, null, missing, or external destination does not navigate.
- A valid internal route path navigates after the read-state update is attempted.
- Legacy `link_url` remains a fallback until existing rows and SOT documents are
  fully migrated.

## SOT Update Needed

- `docs/Wireframe/04-B-01-home-dashboard/functional-spec.md`
- `docs/Wireframe/31-X-09-notification-settings/functional-spec.md`
- `docs/Wireframe/data-usage-index.md`
- `supabase/migrations/INDEX.md` and a forward migration if the DB route column
  is source-controlled in this repository.

## Current Evidence

As of this implementation, the connected dev Supabase schema still exposes
`user_notifications.link_url` but does not expose an additional route column in
`information_schema.columns`. The code should therefore tolerate both the legacy
field and the newly added route-path field when it appears.
