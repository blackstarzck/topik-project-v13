# 2026-07-03 Login Withdrawn Message SOT Proposal

## Context

User request: replace the inline `Alert` shown for `/login?reason=withdrawn`
with an Ant Design `Message` that appears at the top of the login page.

## Current SOT

- `docs/Wireframe/02-A-02-login/description.md` currently says dormant /
  withdrawn accounts, server errors, and session expiry are shown as inline
  notices.
- `docs/sot-change-proposals/2026-06-22-account-deletion-self-service.md`
  describes the account deletion redirect as `/login?reason=withdrawn` with an
  inline notice.

## Proposed Change

Only the withdrawn account reason changes presentation:

- `/login?reason=withdrawn` opens a global Ant Design `Message` at the top
  of the viewport.
- The copy remains unchanged:
  `탈퇴 처리된 계정이에요. 탈퇴 후 30일 이내에는 고객센터를 통해 복구를 요청할 수 있어요.`
- The inline login `Alert` is not rendered for `reason=withdrawn`.
- Other login notices remain unchanged:
  - `reason=session_expired` stays inline.
  - `reason=dormant` stays inline.
  - `reason=blocked` stays inline unless a separate product decision changes it.
  - OAuth embedded-browser warnings and failed-attempt hints stay inline.

## Rationale

The user-facing goal is to make the withdrawn-account state feel like a brief
global login result while avoiding a larger persistent feedback surface.

## Acceptance Criteria

1. Visiting `/login?reason=withdrawn` shows the unchanged withdrawn-account
   message in an Ant Design Message.
2. The inline `login-session-notice` Alert is absent for `reason=withdrawn`.
3. The Message fits within both mobile and desktop viewports.
4. Existing password login, magic-link login, Google login, and other login
   inline notices are not regressed.

## Suggested SOT Updates If Accepted

- Update `docs/Wireframe/02-A-02-login/description.md` exception text to say
  withdrawn account reasons use a top Message while the other listed
  exceptions remain inline.
- Update `docs/sot-change-proposals/2026-06-22-account-deletion-self-service.md`
  or supersede its relevant acceptance criteria to avoid saying withdrawn uses
  an inline notice.
