# Design review/fix workflows — Runbook

Three workflows + one helper, built 2026-06-05. All read the `docs/` source-of-truth
(DESIGN.md, docs/ant-design/*, docs/Wireframe/*/description.md + hifi.png) and the audit
report. Admin is out of scope everywhere (admin wireframes were removed from this
repo 2026-06-11; the admin console is the separate topik-ai app).

| name | file | mode | what it does |
| --- | --- | --- | --- |
| `design-review-by-page` | `.claude/workflows/design-review-by-page.{js,brief.md}` | read-only audit | Static per-page audit of 35 pages vs 4 axes → confirmed findings report |
| `design-fix-from-review` | `.claude/workflows/design-fix-from-review.{js,brief.md}` | dry-run plan | Parse the audit report → cluster → PROPOSE remediation diffs (NO writes) |
| `design-visual-verify` | `.claude/workflows/design-visual-verify.js` | read-only visual | **Render each page + multimodal image analysis** vs DESIGN/ant-design/description/hifi |
| render helper | `scripts/design-review/render-shot.mjs` | tool | Capture a hydrated screenshot of a route (reuses the dev server) |

Artifacts: `docs/design-review-result/20260605-design-review.md` (audit, 143 findings),
`…/20260605-fix-dryrun-pilot-B-01-X-13.md` (fix dry-run pilot).

## How to run
Ask Claude (e.g. "design-visual-verify 돌려줘"), or watch via `/workflows`. Args are JSON.
- Audit:   `design-review-by-page`  args `{ "only": ["B-01"] }` (omit `only` = all 35)
- Fix plan:`design-fix-from-review` args `{ "only": ["B-01","X-13"] }` — DRY-RUN, never writes
- Visual:  `design-visual-verify`   args `{ "only": ["X-13"], "viewports": [360,1280] }`

## Visual verification — prereqs & tiers
- **Dev server must be running on :3000** (reused, never double-booted — Next 16 single-dev lock).
  Start from repo root with `pnpm dev` if absent; poll `http://localhost:3000` for 200.
- **Canonical origin**: public pages → `http://localhost:3000`; authed (workspace) pages →
  `http://127.0.0.1:3000` (the storageState cookie is bound to 127.0.0.1; `allowedDevOrigins`
  whitelists it so pages hydrate).
- **Authed pages** reuse the Playwright storageState `tests/e2e/auth-state/student.json`.
  ⚠️ It **expires 2026-06-08** — regenerate (re-run the e2e login / `pnpm test:e2e`) when stale,
  else workspace pages 307 to /login and are reported `deferred`.
- **Renderable now** (~26): all public pages + workspace non-dynamic pages.
- **Deferred** (needs setup): dynamic `[id]` pages (E-01, E-02 feedback; R-01 compare — need a
  seeded submission/report row) and modals (C-03, D-M1, D-M2, D-M3, F-M1 — need a UI trigger).

## The fix → verify loop (no fragile dual-dev)
1. `design-visual-verify` (baseline) → see current visual issues + save BEFORE evidence.
2. Apply fixes — use `design-fix-from-review` proposals; apply the EXACT ones, treat JUDGMENT
   ones as human-approval (see `design-fix-from-review.brief.md` §7 + tie-break §13).
3. `design-visual-verify` again (after) → AFTER evidence; compare against BEFORE.

(The fully-automated apply-in-isolated-worktree + reverse-patch loop is specified in
`design-fix-from-review.brief.md` v2 §3–§5/§13 but intentionally NOT auto-run: a fresh git
worktree has no node_modules and would need its own dev server on an alt port, which is heavy
and conflicts with the single-dev lock / a concurrent Codex session. Prefer the loop above.)

## Security / safety
- **Evidence screenshots are gitignored** (`screenshots/`, `.design-review-shots/`) — authed
  pages can show test-user data (PII). NEVER commit evidence images; never capture env/logs.
- `.env.local` contains a service-role key flagged for rotation — do not print/commit it; the
  visual workflow only navigates the local dev server, it does not touch secrets.
- All three workflows are read-only against source except the (not-auto-run) apply path, which
  must run in an isolated worktree on a feature branch.

## Gotchas (verified)
- Pass `/route` env vars via the **PowerShell tool**, not bash (bash mangles `/terms` → a Windows path).
- Run `render-shot.mjs` **from the repo root** (pnpm non-flat node_modules; `playwright` won't
  resolve from %TEMP%).
- A `next dev` error overlay still returns HTTP 200 → judge DOM/console + the image, not status.
- The small dark "N" badge bottom-left in dev screenshots is the Next.js dev indicator, not a bug.

## Note on tracking
`.claude/*` is gitignored, so these workflow files live locally by default. If you want them
committed, add `!.claude/workflows/` (and the files) to `.gitignore`. `scripts/design-review/`
and `docs/design-review-result/*.md` ARE tracked.
