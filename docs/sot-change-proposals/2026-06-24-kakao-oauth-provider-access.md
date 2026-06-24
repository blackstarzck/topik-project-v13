# Kakao OAuth Provider Access Proposal

## Context

Kakao OAuth is now configured in Supabase Auth. The current auth SOT documents only describe Google OAuth and correctly state that Google OAuth must not be started inside KakaoTalk's embedded browser because Google blocks embedded user agents with `disallowed_useragent`.

The app should preserve the Google embedded-browser guard and expose Kakao as a separate OAuth provider path.

## Proposed Policy

- Keep blocking Google OAuth from KakaoTalk, LINE, Instagram, Facebook, and NAVER in-app browsers before leaving the app.
- Add a Kakao social auth button on login and sign-up screens.
- Start Kakao auth with Supabase `signInWithOAuth({ provider: "kakao" })`.
- Reuse the existing `/auth/callback` and `/auth/post-auth` handling for Kakao.
- Reuse the existing sign-up claim bridge before post-auth so affiliation metadata behavior stays aligned with Google OAuth sign-up.
- Do not expose provider tokens, raw OAuth errors, client secrets, or provider configuration values in the UI.

## Acceptance Criteria

- On `/login`, clicking the Kakao button starts Supabase Kakao OAuth with `next=/auth/post-auth?intent=login`.
- On `/sign-up`, clicking the Kakao button starts Supabase Kakao OAuth through `/auth/claim-affiliation?next=/auth/post-auth?intent=sign-up`.
- On KakaoTalk embedded browsers, clicking the Google button shows the existing external-browser guidance instead of navigating to Google's blocked OAuth page.
- Existing Google OAuth behavior remains unchanged in normal browsers.
- Existing auth callback, consent, and post-auth gates handle Kakao sessions the same way as Google OAuth sessions.

## Documents To Update If Accepted

- `docs/Wireframe/01-A-01-sign-up/description.md`
- `docs/Wireframe/01-A-01-sign-up/functional-spec.md`
- `docs/Wireframe/02-A-02-login/description.md`
- `docs/Wireframe/02-A-02-login/functional-spec.md`
- `docs/Wireframe/40-X-18-auth-consent/functional-spec.md`
- `docs/flow/user-flow.md`
- `docs/flow/sitemap.md`
