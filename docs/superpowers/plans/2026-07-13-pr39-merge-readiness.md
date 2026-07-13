# PR 39 Merge Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every reproduced PR #39 trust-boundary, skill-authority, UI-token, SOT-lifecycle, and fresh-clone skill-mirror gap without changing product runtime behavior.

**Architecture:** Keep the existing base-owned UI ratchet, but materialize both its source and an exact minimal npm dependency runtime from the base Git tree into an ephemeral runner-owned directory before any candidate package manager or lifecycle code can run. Scan every Markdown file under canonical skill directories and bind structured authority envelopes to the concrete Git action/target. Extend the existing TypeScript AST resolver instead of adding a second scanner, and make exact SOT lifecycle records block prefix fallback. Treat repository ruleset enforcement as a merge acceptance criterion because bootstrap PR code cannot protect its own workflow.

**Tech Stack:** GitHub Actions, Node.js ESM, TypeScript compiler API, Vitest, pnpm, Git.

---

### Task 1: Isolate the trusted UI runner

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/lib/ui-contract-trust.mjs`
- Modify: `tests/scripts/ui-contract-trust.test.mjs`
- Create: `tests/scripts/ci-trust-boundary.test.mjs`
- Create: `config/ui-contract-runtime/package.json`
- Create: `config/ui-contract-runtime/package-lock.json`

- [ ] Add failing tests proving the trusted path is outside `GITHUB_WORKSPACE`, is freshly created under `RUNNER_TEMP`, runs before candidate package-manager/lifecycle code, rejects non-regular Git tree modes, and includes the runner plus minimal runtime manifests in the scanner digest.
- [ ] Run `pnpm exec vitest run tests/scripts/ci-trust-boundary.test.mjs tests/scripts/ui-contract-trust.test.mjs` and confirm the new assertions fail for the current fixed workspace path and missing digest entry.
- [ ] Add an exact minimal `postcss`/`typescript` npm lockfile. In the workflow, set `umask 077`, create `mktemp -d "$RUNNER_TEMP/ui-contract.XXXXXXXX"`, verify canonical containment and base Git modes (`100644`/`100755`), materialize base source/runtime manifests, install with base-owned `npm ci --ignore-scripts --no-audit --no-fund` and an empty trusted user config, and trap cleanup.
- [ ] Run the trusted check before `corepack enable` or any candidate install. Never use candidate `packageManager`, `.npmrc`, `.pnpmfile.cjs`, workspace `node_modules`, `NODE_PATH`, or symlinks in this step; perform the normal candidate install only afterward.
- [ ] Add `scripts/run-trusted-ui-contract.mjs` and the runtime manifests to `UI_SCANNER_SOURCE_PATHS`. Reject unlisted transitive local imports. For an approved migration, never execute candidate scanner code: run the base scanner against candidate source using base semantics, then let the new scanner become authoritative only after merge.
- [ ] Test preclaimed workspace symlinks, candidate lifecycle/config sentinels, trusted dependency resolution, digest-first rejection, approved migration base scanning, unlisted imports, cleanup, and the explicit bootstrap marker `BOOTSTRAP_NOT_INDEPENDENTLY_TAMPER_PROOF`.

### Task 2: Make skill authority discovery and guards fail closed

**Files:**
- Modify: `scripts/check-agent-skill-policy.mjs`
- Modify: `tests/scripts/check-agent-skill-policy.test.mjs`
- Modify: `.codex/skills/using-superpowers/references/codex-tools.md`
- Modify: `.codex/skills/writing-skills/testing-skills-with-subagents.md`

- [ ] Add failing tests for a transitively referenced `helper.md`, stage authority reused for commit, a target-mismatched push, and `collab` publication from a nested skill.
- [ ] Confirm RED with `pnpm exec vitest run tests/scripts/check-agent-skill-policy.test.mjs`.
- [ ] Scan every regular Markdown file under canonical `.codex/skills` directories, with realpath containment, symlink rejection, and bounded file count/size. This avoids ambiguous prose-reference parsing and filename-based bypasses.
- [ ] Replace fuzzy adjacent authority prose with a machine-parseable action envelope. Require action-specific stage/commit authority and exact literal remote/ref/base authority for push/PR commands; reject omitted/dynamic/URL targets, `--all`, `--mirror`, and mismatched flag placement. Apply the protected `collab` rule to every discovered surface, including `HEAD:main`.
- [ ] Rewrite the two referenced skill documents so they preserve the local-edit-only default and pass the stricter checker.
- [ ] Confirm GREEN with the focused test and `pnpm check:agent-skill-policy`.

### Task 3: Resolve static raw visual tokens through normal TypeScript forms

**Files:**
- Modify: `scripts/lib/ui-contract.mjs`
- Modify: `tests/scripts/check-ui-contract.test.mjs`
- Modify: `config/ui-contract-baseline.json`

- [ ] Add failing scanner cases for object property access, shorthand JSX spread, constant string concatenation, and local imported constants.
- [ ] Confirm RED with `pnpm exec vitest run tests/scripts/check-ui-contract.test.mjs`.
- [ ] Change the scanner signature/caller to receive source entries. Reuse `resolveStyleBinding`, `resolveLocalModule`, and `findLocalSymbol` for immutable `const` bindings across lexical and local named/default/alias imports; enumerate object/shorthand/spread properties with cycle/depth guards and preserve the consumer path/line.
- [ ] Restrict concatenation to statically immutable literal segments/no-substitution templates. Add non-regression cases for canonical `src/theme` tokens and `DifficultyMeter` allowances so resolving a token definition does not report a raw consumer violation.
- [ ] Bump the bootstrap scanner version exactly `2 -> 3` once, regenerate the exact baseline only after every scanner/digest change, and keep the migration manifest empty because PR #39 is still the unmerged bootstrap.
- [ ] Confirm GREEN with the focused scanner tests and exact-base `pnpm check:ui-contract`.

### Task 4: Make exact SOT lifecycle and prefix normalization consistent

**Files:**
- Modify: `scripts/check-sot-registry.mjs`
- Modify: `tests/scripts/check-sot-registry.test.mjs`
- Regenerate: `docs/INDEX.md` only if generated content changes

- [ ] Add failing tests showing proposed/superseded exact children block active prefix inheritance, ambiguous normalized exact lifecycle entries fail closed, and non-canonical prefixes (`//`, `\\`, leading slash, `.`/`..`, missing trailing slash) are rejected.
- [ ] Confirm RED with `pnpm exec vitest run tests/scripts/check-sot-registry.test.mjs`.
- [ ] Reject duplicate normalized exact paths across lifecycle statuses. Resolve the unique exact record before active-prefix lookup; return no active owner for inactive exact records; require the stored `pathPrefix` to equal its canonical POSIX form exactly.
- [ ] Confirm GREEN with the focused test and `pnpm check:sot-registry`.

### Task 5: Make Claude skill availability reproducible in a fresh clone

**Files:**
- Modify: `.gitignore`
- Modify: `scripts/sync-agent-skills.mjs`
- Modify: `package.json`
- Create/modify: tracked `.claude/skills/<skill>/SKILL.md` proxy manifests generated from canonical `.codex/skills`
- Create: `tests/scripts/sync-agent-skills.test.mjs`

- [ ] Add a failing tracked-only temp-repository test (built from `git ls-files`) proving the current clone lacks canonical Claude skill entrypoints.
- [ ] Generate small tracked proxy `SKILL.md` files with canonical frontmatter and an executable instruction to read the canonical skill completely and resolve every relative reference from the canonical directory; do not duplicate full skill trees.
- [ ] Add sync/check package scripts and run the check in CI so proxy drift fails.
- [ ] Verify 1:1 tracked canonical/proxy coverage, frontmatter match, target existence/containment/non-symlink, stale proxy detection, and check-only no-write. Preserve the existing tracked dynamic skill and do not delete allowlist-external local Claude skills.
- [ ] Narrow `.gitignore` to track only proxy `*/SKILL.md` entrypoints while keeping generated mirror content ignored. Confirm the focused test and `pnpm check:agent-skills` pass.

### Task 6: Full verification and independent review

**Files:**
- Review all task-owned changes; no commit, push, PR comment, merge, or repository-setting mutation is authorized by this plan.

- [ ] Run focused policy, SOT, scanner, trust-boundary, and skill-sync tests.
- [ ] Run `pnpm check:sot-registry`, `pnpm check:agent-skill-policy`, `pnpm check:ui-contract`, and `pnpm check:worktree-lifecycle`.
- [ ] Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check`.
- [ ] Run an independent code-reviewer and critic pass against every original reproduction.
- [ ] Independently reproduce the exact-head trusted check outside the PR-defined workflow and record the bootstrap limitation.
- [ ] Merge gate (external, not mutated by this plan): `main` ruleset/branch protection must require the exact CI check, Code Owner review, and protection for workflow/CODEOWNERS changes. Do not claim repository-level merge readiness until verified active; PR #39's self-defined bootstrap CI is not independent proof.
- [ ] After any authorized push, require the exact head SHA GitHub Actions run to be green; local verification alone cannot satisfy this hosted gate.
- [ ] Leave a verified local diff checkpoint; stage/commit/push only after separate user authorization.
