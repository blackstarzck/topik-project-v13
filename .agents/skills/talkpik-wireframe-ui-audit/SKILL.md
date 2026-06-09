---
name: talkpik-wireframe-ui-audit
description: Use when auditing, periodically governing, or preparing evidence-backed reports for TALKPIK UI screens against docs/Wireframe/** reference images, screen specs, routes, Playwright screenshots, responsive states, and Ant Design quality criteria.
---

# TALKPIK Wireframe UI Audit

Use this skill to compare implemented TALKPIK screens against the documented
screen source of truth under `docs/Wireframe/**`. Default to read-only audit and
evidence collection. Do not treat design reference images as pixel-perfect test
baselines.

Report to the user in Korean.

When agent delegation is available, run this skill with a separate read-only
`designer` agent for objective UI analysis. Delegation is required for any target
folder missing either `wireframe.png` or `hifi.png`, and recommended for every
full `audit` run. The lead agent owns cataloging, capture, evidence quality, and
final triage; the designer agent owns visual/UX observations and must not edit
files. Prefer one batched designer-agent pass per audit run over spawning one
agent per folder, unless the target set is too large or materially different.

## Modes

- `catalog`: Map wireframe folders to routes, reference images, and screen type.
- `capture`: Capture current desktop/tablet/mobile screenshots and render health.
- `audit`: Compare current screens against docs, `hifi.png`, and `wireframe.png`.
- `triage`: Classify confirmed findings as `P0`, `P1`, `P2`, `Nit`, or `Deferred`.
- `fix-plan`: Propose minimal fixes without editing files.
- `apply-safe`: Apply only explicitly requested low-risk mechanical fixes.
- `verify`: Re-capture and run required tests after fixes.

Default mode is `audit`. `audit`, `catalog`, `capture`, `triage`, and `fix-plan`
are read-only against source code.

## Designer Agent Delegation

Use a separate designer-capable agent whenever the runtime supports it:

- Codex: prefer a native subagent with the `designer` role.
- Claude: prefer the project-supported Task/subagent surface with a designer
  role or designer-oriented prompt.
- Other runtimes: use the closest read-only design-review agent. If no separate
  agent is available, record `designer-agent-unavailable` in the evidence and
  continue with the structured audit rubric below.

The goal is not "another agent said so." The goal is to separate visual/UX
observation from final severity judgment and force every claim to name its
evidence, confidence, and source-of-truth anchor.

Trigger the designer agent at the start of `audit` after cataloging and before
final triage when:

- any target folder has no `wireframe.png`,
- any target folder has no `hifi.png`,
- a folder has neither image,
- the user explicitly requests objective designer analysis,
- visual claims would otherwise rely on the lead agent's subjective judgment.

The designer agent input packet must include:

- target folder and IA code,
- mapped route and screen classification,
- which reference images are present or missing,
- relevant `description.md`, `functional-spec.md`, and `screen-data-summary.md`
  facts,
- current screenshot paths when captured,
- Ant Design checklist constraints that apply,
- explicit instruction to avoid pixel-perfect claims and avoid new product
  scope.

The designer agent output must be objective and evidence-backed. Ask it to return
structured findings with:

- `folder`,
- `route`,
- `missing_reference_images`,
- `objective_observations`,
- `layout_or_hierarchy_risks`,
- `doc_alignment_risks`,
- `responsive_or_accessibility_risks`,
- `evidence`,
- `confidence`,
- `recommended_next_action`.

For folders missing `wireframe.png` or `hifi.png`, the designer agent should
analyze from documented screen intent, current capture, Ant Design criteria, and
observable information architecture. Missing reference images lower visual
confidence; they are not a defect by themselves. If docs and current capture are
also insufficient, the correct outcome is `Deferred`, not a speculative finding.

## Required Reading

Always read:

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/sitemap.md`
4. `docs/ia.md`
5. `docs/ant-design/07-review-checklist.md`

For each target screen folder under `docs/Wireframe/**`, read when present:

1. `description.md`
2. `functional-spec.md`
3. `screen-data-summary.md`
4. `hifi.png`
5. `wireframe.png`
6. other `*.png` reference images

For automation details, also check:

- `docs/design-review-result/DESIGN-WORKFLOWS-RUNBOOK.md`
- `scripts/design-review/render-shot.mjs`
- `playwright.config.ts`
- `TESTING.md`

## Scope Rules

Default include:

- `docs/Wireframe/**`
- `docs/sitemap.md`
- `docs/ia.md`
- `docs/ant-design/**`
- `docs/design-review-result/**`
- `scripts/design-review/**`
- `tests/e2e/**`
- relevant `src/app/**`, `src/components/**`, and `src/styles/**`

Default exclude unless explicitly requested:

- admin expansion or remediation
- Supabase migrations
- auth policy changes
- billing, subscription, paywall implementation
- package or dependency changes
- deployment configuration
- production data
- secrets, tokens, private keys, service role keys, and `.env*` values

Admin-oriented IA folders `H-01`, `X-08`, `X-10`, and `X-15` are out of scope
for normal user-facing audit. Mark them `admin-frozen` instead of auditing them
as active user screens.

## Screen Classification

Classify every wireframe folder before audit:

- `user-active`: implemented user-facing route or flow.
- `public-active`: public route such as landing, login, terms, privacy.
- `modal-transient`: modal or transient state that needs a UI trigger.
- `dynamic-id`: route needs a seeded submission/report/problem id.
- `deferred-shell`: documented shell for deferred scope; check honesty, not full behavior.
- `admin-frozen`: admin-oriented scope currently excluded.
- `unmapped`: route cannot be mapped with enough confidence.

Do not turn `deferred-shell`, `admin-frozen`, `dynamic-id`, or `modal-transient`
into defects without evidence that the current implementation violates the
documented boundary.

## Workflow

### 1. Catalog

Build a matrix with:

- folder name and IA code,
- route from `functional-spec.md` `Route:` first,
- fallback route from `docs/sitemap.md`,
- available reference images,
- reference image status: `complete`, `missing-hifi`, `missing-wireframe`, or
  `missing-both`,
- whether designer-agent analysis is required,
- docs present or missing,
- screen classification,
- auth requirement,
- dynamic seed or modal trigger requirement,
- likely source files when known.

Treat missing `hifi.png` or `wireframe.png` as lower visual confidence, not
automatic failure.

### 2. Capture

Prefer existing project tooling:

- Use `scripts/design-review/render-shot.mjs` when a dev server is already
  running.
- Use Playwright e2e setup when authenticated storage state is required.
- Capture 360, 768, and 1280 widths when responsive behavior matters.

Record:

- screenshot paths,
- final URL,
- login redirect status,
- console/page errors,
- Next error overlay status,
- body text length,
- viewport,
- timestamp.

Never commit screenshots that may include authenticated test-user data unless
the project has explicitly approved that evidence path.

### 3. Audit

Compare in layers:

1. `description.md` and `functional-spec.md` for source-of-truth behavior.
2. `wireframe.png` for major information architecture and area presence.
3. `hifi.png` for visual direction, hierarchy, and intended experience.
4. Designer agent analysis when reference images are missing or when delegated.
5. Ant Design checklist for component, token, layout, state, accessibility, and
   learning workflow quality.
6. Browser capture for render health, responsive layout, and actual current
   state.

When `wireframe.png` or `hifi.png` is missing, do not invent an intended visual
baseline. Use the designer agent's objective analysis as a bounded substitute for
visual review, anchored to docs, captures, and Ant Design criteria. The final
report must clearly label these cases as reduced-reference audits.

Do not require pixel-perfect matching. Convert subjective design claims into
observable evidence, such as:

- primary task area prominence,
- visible CTA placement,
- writing/editor area size and treatment,
- number and position of blocking alerts,
- left/center/right workspace structure,
- missing or displaced support panels,
- responsive overflow, clipping, or overlap,
- loading, empty, error, success, and disabled states,
- route bounce or hydration failure.

### 4. Triage

Each finding must include:

- stable id,
- folder and route,
- screen classification,
- severity,
- category,
- observed current behavior,
- expected behavior from docs or reference image,
- evidence paths,
- designer-agent evidence path when used or `designer-agent-unavailable`,
- likely source files,
- confidence,
- recommended next action.

Severity:

- `P0`: screen unusable, data loss, auth/security issue, major render failure,
  or learner cannot complete the core task.
- `P1`: core learning flow mismatch, major hifi/wireframe divergence, missing
  primary CTA, mobile blocker, or source-of-truth contradiction.
- `P2`: visual hierarchy, token, spacing, heading, state, or copy drift that
  reduces quality but does not block the flow.
- `Nit`: small polish issue with low user impact.
- `Deferred`: cannot verify without seed/auth/modal trigger, or intentionally
  outside current product scope.

Use `Deferred` honestly. Do not invent evidence.

### 5. Fix Planning

In `fix-plan`, propose changes only. Group them by:

- page-specific fix,
- shared writing component fix,
- shared layout/component fix,
- docs conflict requiring decision,
- deferred setup needed.

Recommend CSS/layout/component composition before behavior changes. Do not
suggest new product scope when docs do not authorize it.

### 6. Safe Apply

Only use `apply-safe` when the user explicitly asks to edit. Even then, apply
only low-risk mechanical fixes such as:

- replacing a raw component with an approved wrapper when behavior is unchanged,
- fixing a documented heading/label omission,
- resolving obvious responsive overflow,
- adjusting token usage to match existing project patterns.

Do not automatically apply:

- CTA priority changes,
- information architecture changes,
- copy strategy changes,
- modal behavior changes,
- route additions or removals,
- admin changes,
- billing/payment work,
- database/auth changes,
- theme token creation,
- dependency changes.

After any UI/code change, run verification appropriate to the change. For this
project, UI/code changes require `pnpm test:e2e` before claiming completion.

## Output

Write dated evidence under:

`docs/design-review-result/wireframe-ui-audit/<YYYY-MM-DD>/`

Write the human-readable report as HTML, not Markdown. The report filename must
be derived from the audited target:

- Prefer the `docs/Wireframe/*` folder name when auditing a wireframe folder,
  e.g. `04-B-01-home-dashboard.html`.
- If there is no mapped wireframe folder, derive the name from the route by
  removing the leading slash and replacing `/`, `:`, `[`, `]`, `?`, `&`, and
  other non-alphanumeric separators with `-`, e.g. `/writing/feedback/short/:id`
  -> `writing-feedback-short-id.html`.
- For a multi-screen run, write one HTML report per target plus an optional
  `index.html`. Do not use `summary.md` as the primary report.

Attach evidence images in the HTML report with relative `<img>` paths and
captions. Include at minimum the current captures that support the verdict, and
include reference images (`hifi.png`, `wireframe.png`) when present and useful
for the claim. Keep image paths relative to the HTML file so the report can be
opened locally without rewriting links.

Recommended files:

- `catalog.json`
- `page-results.json`
- `designer-agent-results.json`
- `<wireframe-folder-or-route-slug>.html`
- `index.html` for multi-screen runs when useful
- `screenshots/<folder>/current-<viewport>.png`
- `screenshots/<folder>/reference-hifi.png`
- `screenshots/<folder>/reference-wireframe.png`
- `screenshots/<folder>/render-manifest.json`
- `screenshots/<folder>/findings.json`
- `screenshots/<folder>/designer-analysis.md`

For short ad-hoc audits, a single `<wireframe-folder-or-route-slug>.html` plus
the screenshot manifest is acceptable.

## Report Shape

Use this structure:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>Wireframe UI Audit - {{target}} - {{date}}</title>
  </head>
  <body>
    <h1>Wireframe UI Audit - {{target}} - {{date}}</h1>
    <p><strong>Scope:</strong> {{folders_or_routes}}</p>
    <p><strong>Mode:</strong> {{mode}}</p>
    <p><strong>Coverage:</strong> {{audited}}/{{targeted}}, {{deferred}}, {{unmapped}}</p>

    <h2>Verdict</h2>
    <p>{{Pass | Conditional | Fail | Block}} with reason.</p>

    <h2>Findings</h2>
    <table>
      <thead>
        <tr>
          <th>id</th>
          <th>severity</th>
          <th>route</th>
          <th>category</th>
          <th>claim</th>
          <th>evidence</th>
          <th>next action</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{{id}}</td>
          <td>{{severity}}</td>
          <td>{{route}}</td>
          <td>{{category}}</td>
          <td>{{claim}}</td>
          <td>{{evidence_links}}</td>
          <td>{{next_action}}</td>
        </tr>
      </tbody>
    </table>

    <h2>Evidence Images</h2>
    <figure>
      <img src="screenshots/{{folder}}/current-1280.png" alt="{{target}} current desktop capture" />
      <figcaption>Current desktop capture.</figcaption>
    </figure>
    <figure>
      <img src="screenshots/{{folder}}/reference-hifi.png" alt="{{target}} hifi reference" />
      <figcaption>Reference hifi image, when present.</figcaption>
    </figure>

    <h2>Deferred</h2>
    <p>{{items_that_need_seed_auth_modal_trigger_or_are_out_of_scope}}</p>

    <h2>Evidence</h2>
    <p>{{screenshots_manifests_commands_docs_consulted}}</p>

    <h2>Verification</h2>
    <p>{{commands_run_results_skipped_checks_residual_risk}}</p>
  </body>
</html>
```

## Stop Conditions

Stop when:

- all target folders are cataloged,
- all renderable targets have screenshots or a clear deferred reason,
- findings have evidence,
- unresolved verifier objections are reported,
- requested fixes are verified or explicitly deferred.

Never claim a screen is aligned without current screenshot evidence or a clear
document-only limitation.
