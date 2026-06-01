# UX/UI Reviewer Checklist

## Purpose

Judge whether the IA surface supports the intended user task, visual hierarchy, responsive layout, accessibility basics, and state clarity.

## Required Inputs

- IA profile row.
- IA wireframe and description.
- Current implemented route or host surface.
- Screenshots or browser evidence for mobile, tablet, and desktop when available.
- Relevant audit findings.

## Applies When

- Any visible page, hosted modal, modal/state, or modal/toast is remediated.

## Does Not Apply When

- The task is a server-only route handler or audit-script-only change.

## Checklist Items

- [ ] The primary user job is visible and not split across competing primary CTAs.
- [ ] Heading, section order, and CTA order match the task.
- [ ] Wireframe elements are present or intentionally superseded by documented implementation.
- [ ] Loading, saving, analyzing, blocked, empty, and error states explain current status.
- [ ] Text and controls remain readable on mobile, tablet, and desktop.
- [ ] Keyboard focus follows task order.
- [ ] Error and status text is specific enough for recovery.
- [ ] Deferred features are not presented as currently working.

## Detailed Checklist Matrix

### Task And Information Architecture Fit

- [ ] The IA page has exactly one dominant user job for the current state.
- [ ] The first viewport makes the page purpose clear without reading documentation.
- [ ] The H1, primary CTA, and first content block all support the same user job.
- [ ] The page does not mix onboarding, settings, admin, writing, and reporting jobs in one surface unless the IA explicitly requires it.
- [ ] The user can tell whether they are starting, continuing, reviewing, editing, confirming, or recovering.
- [ ] The page tells the user what is already done and what still needs action when the flow is multi-step.
- [ ] The route's current location is visible in navigation or page context.
- [ ] Breadcrumb, sidebar, tab, or section marker is present when the route is not a first-touch page.
- [ ] The IA page does not depend on hidden knowledge from a previous page.
- [ ] Direct-entry users see enough context to continue safely.

### Visual Hierarchy And Layout

- [ ] Heading levels follow the visible hierarchy and do not skip meaningfully important structure.
- [ ] The most important action is visually prominent but not oversized for an operational tool.
- [ ] Secondary actions are visible but do not compete with the primary action.
- [ ] Destructive actions use distinct placement, color, label, and confirmation when applicable.
- [ ] Dense dashboard/list pages support scanning without marketing-style spacing.
- [ ] Repeated cards, rows, or panels have consistent spacing, titles, metadata, and action placement.
- [ ] Page sections are not nested as cards inside cards.
- [ ] Fixed headers, sidebars, and footers do not hide content or controls.
- [ ] Long text wraps without clipping, overlap, or horizontal scrolling at supported breakpoints.
- [ ] Empty space is used to clarify grouping, not to hide missing content.
- [ ] Icons have consistent size, stroke, alignment, and accessible labels where needed.
- [ ] Button labels are action-specific and not repeated ambiguously across the page.

### Responsive And Viewport Behavior

- [ ] Mobile 360 px layout keeps the primary task visible and usable.
- [ ] Tablet 768 px layout keeps navigation and content order coherent.
- [ ] Desktop 1280 px layout does not stretch reading lines, controls, or cards beyond useful width.
- [ ] Sticky or fixed UI is tested at every supported breakpoint.
- [ ] Tables, charts, lists, and forms have a documented responsive treatment.
- [ ] Horizontal overflow is absent except for intentionally scrollable data tables.
- [ ] Touch targets are usable with thumb interaction on mobile.
- [ ] Mobile keyboard opening does not hide required fields or submit controls.
- [ ] Modal or drawer surfaces fit on short mobile viewports.
- [ ] Loading and error states use the same responsive constraints as the default state.

### Interaction And Control States

- [ ] Every interactive element has default, hover, focus, active, disabled, loading, and error state where applicable.
- [ ] Disabled controls either have an obvious reason or nearby explanatory text.
- [ ] Loading buttons prevent duplicate actions while preserving a recovery path.
- [ ] Tabs, segmented controls, filters, and pagination show selected/current state.
- [ ] Search/filter reset behavior is visible when results are narrowed.
- [ ] Sort order is visible and reversible where sorting exists.
- [ ] Back, cancel, close, save, submit, retry, and export controls use consistent placement across comparable IA pages.
- [ ] Keyboard shortcuts are not required to complete the main task.
- [ ] Pointer-only gestures have keyboard and touch alternatives.
- [ ] Drag or reorder interactions have a non-drag alternative when they affect core work.

### State Coverage

- [ ] Default state is covered.
- [ ] Loading state is covered.
- [ ] Slow loading state is covered when the action can take more than a moment.
- [ ] Empty state is covered.
- [ ] Empty-after-filter state is covered when filters/search exist.
- [ ] Permission-denied state is covered when route audience is restricted.
- [ ] Subscription/paywall-limited state is covered when relevant.
- [ ] Error state is covered.
- [ ] Retryable failure state is covered.
- [ ] Non-retryable failure state is covered.
- [ ] Offline or network-failure state is covered where the main action depends on network.
- [ ] Expired-session state is covered for protected pages.
- [ ] Success/complete state is covered after the main action.
- [ ] Partial-save or draft state is covered for writing/editing IA.

### Accessibility Basics

- [ ] Keyboard-only users can reach and operate every control.
- [ ] Focus order matches visual and task order.
- [ ] Focus indicator is visible and not obscured.
- [ ] Accessible names match visible labels for buttons, links, fields, tabs, and icon controls.
- [ ] Form labels are persistent and not placeholder-only.
- [ ] Error messages are programmatically associated with fields where possible.
- [ ] Status changes are perceivable by assistive technology where implementation supports it.
- [ ] Color is not the only way to identify status, score, chart series, errors, or required fields.
- [ ] Text contrast is sufficient for normal, muted, disabled, warning, and error text.
- [ ] Non-text content has useful alt text or is hidden from assistive technology when decorative.
- [ ] Motion or animation does not block the task and respects reduced-motion expectations where implemented.
- [ ] Target size or spacing meets the project accessibility baseline.

### Copy And Microcopy

- [ ] CTA text starts with the user action, not vague nouns.
- [ ] Page copy avoids implementation details, database names, provider internals, and raw error codes.
- [ ] Status copy says what is happening now and what the user can do.
- [ ] Empty-state copy gives a useful next action.
- [ ] Error copy gives recovery, not only failure.
- [ ] Confirmation copy names the consequence of final or destructive actions.
- [ ] Deferred-scope copy avoids promises like "payment complete", "notification sent", or "AI score final" unless implemented.
- [ ] Korean/English mixed copy is intentional and matches language settings scope.
- [ ] Admin copy distinguishes content admin, org admin, and platform admin actions.
- [ ] Privacy-sensitive copy explains why data is requested when the reason is not obvious.

### IA-Specific Visual Checks

- [ ] Writing pages make prompt, answer area, save state, and submit path visible together.
- [ ] Feedback pages separate original answer, feedback, score/status, and next action.
- [ ] Report pages provide chart fallback, legend/label clarity, and plain-language summary.
- [ ] Recommendation pages explain why the recommendation is shown and what to do next.
- [ ] Library pages support search, scan, select, export, and empty-history states.
- [ ] Settings pages distinguish saved, unsaved, saving, failed, and persisted preference states.
- [ ] Auth pages keep trust, privacy, and recovery copy visible without exposing raw provider details.
- [ ] Admin pages distinguish list, detail, create, edit, delete, audit, and permission states.

### UX/UI Evidence To Capture

- [ ] Screenshot or trace for mobile, tablet, and desktop.
- [ ] Screenshot or trace for default, loading, empty, error, and blocked states when applicable.
- [ ] Keyboard traversal notes for the main task path.
- [ ] Focus-return evidence for modal/drawer paths.
- [ ] Copy review notes for deferred features and security-sensitive states.
- [ ] Before/after screenshots when remediation changes visual hierarchy.
- [ ] Browser console notes when visual behavior depends on runtime data.
- [ ] Explicit `N/A` reason for any state not applicable to the IA profile.

## Research-Backed Detailed Checks

- [ ] Page title and H1 make the current task clear without relying on sidebar text.
- [ ] Status is visible for loading, saving, submitting, analyzing, retrying, blocked, and failed states.
- [ ] Primary, secondary, destructive, and cancel actions are visually and semantically distinct.
- [ ] Destructive or final actions are separated from safe navigation and require confirmation when required by pack.
- [ ] Keyboard-only path reaches every interactive control in meaningful order.
- [ ] Focus is visible, not hidden under sticky headers, modals, or overlays.
- [ ] Buttons, icon buttons, links, and tabs have accessible names that match visible labels.
- [ ] Touch targets are at least 24 CSS px or have enough spacing to avoid accidental activation.
- [ ] Status messages are announced or otherwise perceivable without moving focus unnecessarily.
- [ ] Error copy uses the user's task language and gives a next action.
- [ ] Empty states explain why there is no content and what the user can do next.
- [ ] Responsive checks include 360, 768, and 1280 px or the project-approved breakpoint set.
- [ ] Charts, badges, color-coded status, and progress indicators do not rely on color alone.
- [ ] Layout does not trap key actions below scroll, behind fixed UI, or inside nested cards.
- [ ] Skeletons, spinners, and progress indicators do not mask permanent failure.
- [ ] The visual hierarchy matches repeated use, not only first-time explanation.

## Rating Criteria

- `PASS`: task, hierarchy, state clarity, responsiveness, and accessibility basics are evidenced.
- `PARTIAL`: visible behavior exists but one important state, viewport, or focus path is missing evidence.
- `FAIL`: the UI blocks the intended task, misleads users, or contradicts active docs.
- `BLOCKED`: screenshots, browser access, or implementation evidence cannot be obtained.
- `N/A`: only for non-visible server-only work.

## Required Evidence

- Screenshot or browser evidence.
- IA wireframe or description references.
- State evidence for relevant loading/error/empty/blocked cases.
- Accessibility or keyboard-focus observations.

## Result Packet Fields

- `taskFit`
- `visualHierarchy`
- `responsiveEvidence`
- `stateClarity`
- `accessibilityFindings`
- `copyRisks`

## External References

- NN/g usability heuristics.
- WCAG 2.2 focus order.
- WCAG 2.2 error identification.
- WCAG 2.2 labels or instructions.
- [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [WCAG 2.2 target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

## Project-Specific No-Pass Rules

- Do not pass if only the default page view was checked and the IA requires loading, error, empty, or blocked states.
- Do not pass if UI copy promises billing, notification transport, or another deferred feature as active.
- Do not pass an interactive IA without keyboard-only and responsive evidence.
