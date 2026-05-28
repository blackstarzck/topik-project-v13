# IA Verification Phase 1 Setup Results

## One-Line Result

IA 검수 자동화의 첫 뼈대는 생성됐지만, 실제 IA 판정은 아직 `BLOCKED`입니다.

## Created Automation

- `scripts/audit-setup/build-ia-manifest.mjs`
- `scripts/audit-setup/verify-doc-receipts.mjs`
- `scripts/audit-setup/validate-ia-source-map.mjs`
- `scripts/audit-setup/build-agent-dispatch-plan.mjs`
- `scripts/verify-ia-coverage.mjs`
- `scripts/merge-ia-audit-results.mjs`
- `scripts/validate-ia-audit-report.mjs`
- `package.json` `test:ia:*` commands
- `.gitignore` exception so durable `scripts/audit-setup/*.mjs` files are tracked

## Current Evidence

- Manifest: `34` IA entries.
- Source map: `34/34` IA rows pass source-anchor detection.
- Support route failure: `/auth/sign-out` route handler is still missing.
- Dispatch plan: `34` IA entries assigned exactly once across `6` shards.
- Document receipt gate: blocked because `doc-receipts.json` does not exist.
- Static gate: blocked because document receipts are missing.
- Final audit labels: `34 BLOCKED`, `0 PASS`.
- Final audit validator: pass, because no invalid `PASS` labels were emitted.

## Verification Commands

- `pnpm exec vitest run tests/scripts/ia-audit-scripts.test.ts`: pass.
- `pnpm test`: pass.
- `pnpm test:ia:manifest`: pass.
- `pnpm test:ia:source-map`: pass.
- `pnpm test:ia:dispatch`: pass.
- `pnpm test:ia:docs`: blocked.
- `pnpm test:ia:static`: blocked.
- `pnpm test:ia:merge`: pass.
- `pnpm test:ia:validate`: pass.
- `pnpm lint`: fail due existing React lint errors outside the IA audit scripts.
- `pnpm exec tsc --noEmit --pretty false`: fail due existing `tests/theme/theme-context.test.tsx` implicit-any error.

## Next Steps

1. Create `doc-receipts.json` for all 34 IA entries.
2. Generate browser, hosted-surface, and security/navigation evidence.
3. Add agent integration rows or record single-session integration.
4. Run AI UX review.
5. Collect real human confirmation for judgment-sensitive items.
