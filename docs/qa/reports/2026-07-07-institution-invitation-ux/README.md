# Institution Invitation Modal QA Evidence (2026-07-07)

## Scope

- Target: `InstitutionInvitationModal` layout for institution invitation response states.
- Method: Playwright screenshot capture against a temporary local QA route.
- Route used during capture: `/terms/qa-institution-invitation-modal`.
- The temporary QA route was removed after capture; committed artifacts are the screenshots and manifest only.
- Viewports:
  - Desktop: `1280x900`
  - Mobile: `390x844`

## Notes

- `accepted`, `declined`, `expired`, `withdrawn`, and `alreadyResponded` show the resolved state and disable accept/decline actions.
- `unauthenticated` shows the sign-in retry CTA instead of accept/decline.
- `failed` keeps accept/decline available so the user can retry.
- `invalid` verifies the missing `invitation_id` disabled-action state.

## Evidence

| Viewport | State | Screenshot |
| --- | --- | --- |
| Desktop | accepted | [institution-invitation-modal-desktop-accepted.png](./institution-invitation-modal-desktop-accepted.png) |
| Desktop | declined | [institution-invitation-modal-desktop-declined.png](./institution-invitation-modal-desktop-declined.png) |
| Desktop | expired | [institution-invitation-modal-desktop-expired.png](./institution-invitation-modal-desktop-expired.png) |
| Desktop | withdrawn | [institution-invitation-modal-desktop-withdrawn.png](./institution-invitation-modal-desktop-withdrawn.png) |
| Desktop | already responded | [institution-invitation-modal-desktop-already-responded.png](./institution-invitation-modal-desktop-already-responded.png) |
| Desktop | unauthenticated | [institution-invitation-modal-desktop-unauthenticated.png](./institution-invitation-modal-desktop-unauthenticated.png) |
| Desktop | failed | [institution-invitation-modal-desktop-failed.png](./institution-invitation-modal-desktop-failed.png) |
| Desktop | invalid invitation id | [institution-invitation-modal-desktop-invalid.png](./institution-invitation-modal-desktop-invalid.png) |
| Mobile | accepted | [institution-invitation-modal-mobile-accepted.png](./institution-invitation-modal-mobile-accepted.png) |
| Mobile | declined | [institution-invitation-modal-mobile-declined.png](./institution-invitation-modal-mobile-declined.png) |
| Mobile | expired | [institution-invitation-modal-mobile-expired.png](./institution-invitation-modal-mobile-expired.png) |
| Mobile | withdrawn | [institution-invitation-modal-mobile-withdrawn.png](./institution-invitation-modal-mobile-withdrawn.png) |
| Mobile | already responded | [institution-invitation-modal-mobile-already-responded.png](./institution-invitation-modal-mobile-already-responded.png) |
| Mobile | unauthenticated | [institution-invitation-modal-mobile-unauthenticated.png](./institution-invitation-modal-mobile-unauthenticated.png) |
| Mobile | failed | [institution-invitation-modal-mobile-failed.png](./institution-invitation-modal-mobile-failed.png) |
| Mobile | invalid invitation id | [institution-invitation-modal-mobile-invalid.png](./institution-invitation-modal-mobile-invalid.png) |

The generated capture metadata is in [screenshot-manifest.json](./screenshot-manifest.json).
