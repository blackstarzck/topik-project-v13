# Security/Data Reviewer Checklist

## Purpose

Review authentication, authorization, owner scope, RBAC, direct-id handling, token handling, PII, storage, and server/client trust boundaries.

## Required Inputs

- IA profile row.
- Route audience map from `docs/sitemap.md`.
- Required packs, especially `AUTH`, `GUARD`, `DATA`, `OWNER-CHECK`, `DIRECT-ID`, `ADMIN`, `RBAC`, `ORG-SCOPE`, `PRIVILEGE`, `PII`, `TOKEN`, `SECURITY`, `STORAGE`, and `SESSION`.
- Current implementation and security test evidence.

## Applies When

- The IA is protected, data-bearing, auth-related, admin-only, owner-scoped, id-based, PII-bearing, token-related, or export/storage-related.

## Does Not Apply When

- The IA is public, static, and has no auth, data, token, or trust-boundary behavior.

## Checklist Items

- [ ] Public/user/admin audience behavior matches the route audience map.
- [ ] Direct protected URL access redirects or blocks correctly.
- [ ] User-owned records cannot be viewed or changed by another user.
- [ ] Admin routes enforce the correct admin role and do not over-grant.
- [ ] Invalid, missing, malformed, unauthorized, and deleted ids are handled.
- [ ] Logout and expired sessions remove access to protected data.
- [ ] Raw tokens, secrets, provider errors, and service keys are not exposed.
- [ ] Exported/generated files are owner-scoped and safe-path constrained.
- [ ] PII is requested, displayed, masked, and updated only as documented.

## Detailed Checklist Matrix

### Authentication

- [ ] Public route works without session.
- [ ] Protected user route rejects logged-out access.
- [ ] Admin route rejects logged-out access.
- [ ] Expired session produces safe redirect or blocked state.
- [ ] Logout invalidates protected route access after reload.
- [ ] Browser back after logout does not reveal protected data after reload.
- [ ] Login failure does not reveal sensitive account state unless docs allow it.
- [ ] Email verification state is handled.
- [ ] Password reset token expiry is handled.
- [ ] Callback errors are canonicalized before display.
- [ ] Raw provider errors are not shown in UI or URL.
- [ ] Session state is not trusted from client-only checks.

### Authorization And Roles

- [ ] User route allows normal authenticated user.
- [ ] User route does not allow access to another user's private data.
- [ ] Content admin route requires content-admin authority.
- [ ] Org admin route requires org-admin authority.
- [ ] Platform admin route requires platform-admin authority.
- [ ] Lower admin cannot access higher-admin surface.
- [ ] Admin cannot mutate records outside assigned scope.
- [ ] Role escalation attempt is blocked.
- [ ] Hidden UI control is not the only access control.
- [ ] Server/RLS boundary is documented for data-bearing IA.
- [ ] Access failure returns safe UI and safe status behavior.

### Direct ID And Object Ownership

- [ ] Missing id is handled.
- [ ] Malformed id is handled.
- [ ] Nonexistent id is handled.
- [ ] Deleted id is handled.
- [ ] Another user's id is handled.
- [ ] Another organization's id is handled where relevant.
- [ ] Admin id access follows role rules.
- [ ] Id in query, path, body, and stored state is treated consistently.
- [ ] Id-based error copy does not leak record existence when unsafe.
- [ ] Pagination, filters, and exports preserve the same owner constraint.

### Data Display And Mutation

- [ ] Data list uses real owner/role scope.
- [ ] Empty state does not reveal hidden records.
- [ ] Search does not reveal hidden records by count or metadata.
- [ ] Sort/filter cannot bypass scope.
- [ ] Mutation validates actor, target, and action.
- [ ] Mutation failure leaves prior data safe.
- [ ] Optimistic UI rolls back on authorization failure.
- [ ] Cached data is cleared or refetched after logout/role change.
- [ ] Client state does not persist sensitive data longer than needed.
- [ ] Export/download scope matches visible data scope.

### Token, Secret, PII, And Logs

- [ ] Tokens are not visible in UI.
- [ ] Tokens are not retained in URL after exchange when implementation controls it.
- [ ] Service-role keys are never exposed to client routes.
- [ ] Provider raw errors are logged server-side only when needed.
- [ ] Logs exclude secrets, tokens, raw PII, and full answer content unless approved.
- [ ] PII fields are minimized.
- [ ] PII edits require current user ownership.
- [ ] PII display is masked or limited where appropriate.
- [ ] Export filenames and paths do not leak private identifiers.
- [ ] Screenshots used as evidence avoid unnecessary PII exposure.

### Evidence To Capture

- [ ] Logged-out route access evidence.
- [ ] Normal-user route access evidence.
- [ ] Cross-user access denial evidence.
- [ ] Admin role access evidence.
- [ ] Lower-role denial evidence.
- [ ] Invalid/malformed/deleted id evidence.
- [ ] Logout/back/reload evidence.
- [ ] Token/raw-error exposure check evidence.
- [ ] Storage/export owner-scope evidence.
- [ ] Log/audit evidence where required.

## Research-Backed Detailed Checks

- [ ] Authentication state is checked for logged-out, logged-in, expired-session, and logged-out-after-back-button paths.
- [ ] Public auth pages avoid account enumeration through copy, timing assumptions, redirects, and visible provider reasons.
- [ ] Password reset and email verification tokens are single-purpose, expiry-aware, and not logged or shown to the user.
- [ ] Callback `next` or redirect targets are relative-only and cannot become open redirects.
- [ ] Session cookies or tokens are not handled in client-visible code unless the route profile explicitly requires browser handling.
- [ ] Authorization is enforced server-side or through documented RLS, not only by hidden UI controls.
- [ ] Horizontal access is tested with another user's id for every owner-scoped route.
- [ ] Vertical access is tested by trying user access to admin routes and lower-admin access to higher-admin routes.
- [ ] Admin role changes cannot grant permissions above the actor's own authority.
- [ ] Organization-scoped admin data cannot cross organization boundaries.
- [ ] Invalid, missing, deleted, malformed, and unauthorized ids produce distinct safe user outcomes where the product requires distinction.
- [ ] Data lists, search, filters, and exports preserve owner/role scope across pagination and empty states.
- [ ] PII fields show only the minimum needed value and avoid leaking through URL, logs, screenshots, or export filenames.
- [ ] Storage paths and export filenames cannot be guessed to retrieve another user's artifact.
- [ ] User-controlled input is validated by allowlist or strict schema before it affects queries, redirects, file paths, or logs.
- [ ] Security logs capture actionable event type and correlation data without secrets, tokens, raw PII, or provider internals.
- [ ] Error states fail closed when authorization, data ownership, or role evidence is uncertain.

## Rating Criteria

- `PASS`: access, data, id, session, and trust-boundary behavior are evidenced for the IA profile.
- `PARTIAL`: main access path works but horizontal, vertical, session, or id evidence is incomplete.
- `FAIL`: unauthorized access, data leakage, unsafe token exposure, or role escalation is possible.
- `BLOCKED`: security verification cannot run because roles, data, storage, or environment are unavailable.
- `N/A`: no security/data concern applies to the IA profile.

## Required Evidence

- Auth state evidence.
- Role or owner-scope evidence.
- Invalid and unauthorized id evidence when relevant.
- Logout or expired-session evidence when relevant.
- Storage/export evidence when relevant.

## Result Packet Fields

- `audienceBoundary`
- `ownerBoundary`
- `roleBoundary`
- `idHandling`
- `sessionHandling`
- `tokenAndSecretExposure`
- `storageBoundary`

## External References

- OWASP WSTG authorization testing.
- OWASP WSTG logout testing.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Project-Specific No-Pass Rules

- Do not pass owner-scoped IA without horizontal access evidence.
- Do not pass admin IA without vertical access and audit-evidence review.
- Do not pass auth IA if raw provider errors or tokens are exposed in UI or URL.
- Do not pass protected IA when access is blocked only in UI but not proven at the data or route boundary.
