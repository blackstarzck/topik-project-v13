# Sign-up Cooldown Evidence

Date: 2026-06-14

## Screenshots

- Desktop: `.scratch/ui-screenshots/signup-cooldown-2026-06-14/desktop-1280.png`
- Mobile: `.scratch/ui-screenshots/signup-cooldown-2026-06-14/mobile-360.png`

## Screenshot State

- Route: `/sign-up`
- Storage key: `talkpik:sign-up:cooldown-until`
- Scenario: cooldown timestamp is preserved across page reload.
- Countdown text observed:
  - Desktop: `41초 후 다시 보낼 수 있어요`
  - Mobile: `43초 후 다시 보낼 수 있어요`
- Submit button text: `회원가입`
- Submit button disabled: `true`
- Bottom login active link count: `0`
- Disabled login text visible: `true`
- Disabled submit computed style:
  - `backgroundColor`: `rgba(0, 0, 0, 0.04)`
  - `color`: `rgba(0, 0, 0, 0.45)`

## Verification Commands

```powershell
corepack pnpm exec vitest run tests/components/auth/SignUpForm.test.tsx tests/components/auth/AuthPromptExperience.test.tsx tests/components/auth/PasswordResetRequestForm.test.tsx
```

Result: 3 files, 16 tests passed.

```powershell
corepack pnpm typecheck
```

Result: passed.

```powershell
corepack pnpm lint
```

Result: passed with 0 errors and 6 pre-existing warnings.

```powershell
corepack pnpm exec prettier --check src/components/auth/SignUpForm.tsx src/components/auth/AuthPromptExperience.tsx src/lib/auth/use-email-cooldown.ts tests/components/auth/SignUpForm.test.tsx tests/e2e/flows/sign-up.spec.ts
```

Result: passed. `src/styles/global.css` was intentionally excluded to avoid unrelated whole-file formatting churn in an already non-Prettier-formatted stylesheet.

```powershell
$env:E2E_BASE_URL='http://127.0.0.1:3000'; corepack pnpm exec playwright test tests/e2e/flows/sign-up.spec.ts --project=desktop-1280 --project=mobile-360 --no-deps
```

Result: 12 tests passed.
