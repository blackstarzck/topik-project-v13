# IA Shard Reviewer Checklist

## Purpose

Review one IA item against route authority, IA documentation, required packs, and entry/exit flow before implementation changes are accepted.

## Required Inputs

- IA profile row.
- `docs/sitemap.md`.
- `docs/IA/README.md` and the IA-specific `description.md`.
- `docs/flow/user-flow.md`.
- Required packs from [ia-page-implementation-verification.md](../ia-page-implementation-verification.md).
- Current audit evidence for the IA code.

## Applies When

- Any IA page, hosted modal, modal/state, or modal/toast is being remediated.
- A page-to-page or hosted-surface flow crosses IA boundaries.

## Does Not Apply When

- The task is only audit-script maintenance with no IA-specific judgment.

## Checklist Items

- [ ] IA code, screen name, route or host route, route type, and audience match the profile.
- [ ] Required packs match the current verification procedure.
- [ ] Entry path, exit path, browser back, refresh, and direct URL behavior are identified.
- [ ] Hosted surfaces include host route and trigger evidence.
- [ ] Page-flow edges to other IA items are listed.
- [ ] Missing or conflicting product behavior is labeled `DOC-GAP`, not guessed.
- [ ] Deferred scope is kept as `DEFERRED` and not converted into implementation work.
- [ ] HTML report observations are tied back to JSON or source evidence before use.

## Detailed Checklist Matrix

### Source Alignment

- [ ] IA code matches `docs/IA/README.md`.
- [ ] IA folder and `description.md` exist or absence is recorded.
- [ ] Sitemap route or host route matches the IA profile.
- [ ] Route type matches page, hosted modal, modal/state, modal/toast, or route handler.
- [ ] Audience matches public, user, admin, or mixed route rules.
- [ ] Required packs match the IA verification procedure.
- [ ] IA purpose matches PRD/spec where those docs govern the surface.
- [ ] Legacy-only observations are not treated as current requirements.
- [ ] Active doc conflict is labeled `DOC-GAP`.
- [ ] Deferred behavior is labeled `DEFERRED`, not implementation failure.

### Flow Entry

- [ ] Primary entry path from user flow is identified.
- [ ] Secondary entry path from navigation is identified.
- [ ] Direct URL entry behavior is identified for page routes.
- [ ] Hosted modal trigger is identified for hosted surfaces.
- [ ] Auth-required entry behavior is identified.
- [ ] Admin-required entry behavior is identified.
- [ ] Paywall/subscription-limited entry behavior is identified when relevant.
- [ ] Entry from email/token/callback is identified for auth surfaces.
- [ ] Entry with malformed query or id is identified.
- [ ] Entry from stale bookmark or deleted resource is identified when data-bound.

### Flow Exit

- [ ] Primary next action is identified.
- [ ] Safe cancel/back path is identified.
- [ ] Browser back behavior is identified.
- [ ] Browser forward behavior is identified when stateful.
- [ ] Refresh behavior is identified.
- [ ] Logout/expired-session exit is identified for protected routes.
- [ ] Error recovery route is identified.
- [ ] Empty-state next action is identified.
- [ ] Modal close behavior is identified for hosted surfaces.
- [ ] Async completion destination is identified.

### State Inventory

- [ ] Default state.
- [ ] Loading state.
- [ ] Empty state.
- [ ] Error state.
- [ ] Permission-denied state.
- [ ] Blocked/deferred state.
- [ ] Success state.
- [ ] Partial or draft state.
- [ ] Retry state.
- [ ] Rate-limit/cooldown state.
- [ ] Invalid id or not-found state.
- [ ] Cross-user or cross-role denied state.

### Cross-IA Impact

- [ ] Source IA and target IA are named for every transition.
- [ ] State passed between IA pages is identified.
- [ ] Shared route/component ownership is identified.
- [ ] Shared data contract is identified.
- [ ] Shared auth or role boundary is identified.
- [ ] Shared modal host is identified.
- [ ] Shared audit evidence is identified.
- [ ] Required re-check targets are listed after remediation.

### Evidence Review

- [ ] JSON audit evidence is present or absence is recorded.
- [ ] HTML report issue is traced to machine-readable or source evidence.
- [ ] Screenshots or traces are tied to the IA code.
- [ ] Browser checks include direct entry and flow entry where applicable.
- [ ] Tests assert user-visible behavior.
- [ ] Missing evidence is labeled by reason: behavior missing, automation missing, environment blocked, or docs gap.

## Research-Backed Detailed Checks

- [ ] Page title, primary heading, and current navigation location identify where the user is.
- [ ] User can enter the IA through the documented primary flow and direct URL when route type allows it.
- [ ] User can leave through the documented next action, cancel/back path, and error-recovery path.
- [ ] Route audience is tested for logged-out, normal user, and admin roles when relevant.
- [ ] Route type is not promoted from hosted modal/state to standalone page without explicit docs.
- [ ] Every cross-IA transition has source, destination, trigger, expected state handoff, and failure behavior.
- [ ] Browser back and forward are checked after submit, modal close, logout, and async completion when applicable.
- [ ] Refresh behavior is checked for draft, pending analysis, completed feedback, and expired-session states when applicable.
- [ ] Empty, loading, blocked, permission-denied, not-found, and deleted-resource states are separated.
- [ ] IA labels do not depend on legacy-only route observations.
- [ ] Community or heuristic findings are recorded as review prompts, not route authority.
- [ ] If an IA has no implementation target yet, the reviewer records whether the gap is implementation absence, docs absence, or deferred scope.

## Rating Criteria

- `PASS`: source mapping, pack mapping, route type, audience, and flow boundaries are complete.
- `PARTIAL`: source mapping is mostly complete but one flow or pack detail needs evidence.
- `FAIL`: active docs and implementation disagree on route, audience, route type, or required behavior.
- `BLOCKED`: IA source docs or audit artifacts are unavailable.
- `N/A`: only when the IA item is outside the assigned shard.

## Required Evidence

- IA profile row.
- Source doc references.
- Audit evidence references.
- Flow-edge list.
- Pack coverage table.

## Result Packet Fields

- `routeAuthority`
- `packCoverage`
- `entryExitBehavior`
- `flowEdges`
- `docGaps`
- `recommendedSpecialists`

## External References

- [Sitemap](../../sitemap.md)
- [IA inventory](../../IA/README.md)
- [IA verification procedure](../ia-page-implementation-verification.md)
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [NN/g usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)

## Project-Specific No-Pass Rules

- Do not pass a hosted modal or state without host-trigger evidence.
- Do not pass a route whose audience differs from the route audience map.
- Do not pass a page-flow IA without entry, exit, back, refresh, and direct-entry judgment.
