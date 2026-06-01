# Hosted Surface Reviewer Checklist

## Purpose

Review hosted modals, modal/state surfaces, and modal/toast surfaces in their actual host-route context.

## Required Inputs

- IA profile row.
- Host route and trigger path.
- Required packs, especially `MODAL`, `STATE`, `LOADING`, `ASYNC`, `AUTOSAVE`, `FAILURE`, `IRREVERSIBLE-ACTION`, `EXPORT`, and `STORAGE`.
- Browser evidence from the host route.

## Applies When

- Route type is `hosted modal`, `modal/state`, or `modal/toast`.

## Does Not Apply When

- The IA is a standalone page or server-only route handler.

## Checklist Items

- [ ] Host route and trigger are verified.
- [ ] Surface opens only from intended trigger states.
- [ ] Focus moves into modal and returns to trigger when closed.
- [ ] Escape, close button, backdrop, and browser back behavior are defined where applicable.
- [ ] Mobile layout keeps the surface usable.
- [ ] Irreversible actions require confirmation and cannot repeat accidentally.
- [ ] Async and loading states prevent duplicate actions and explain status.
- [ ] Toast or warning state is visible long enough and has a recovery route when needed.

## Detailed Checklist Matrix

### Host And Trigger

- [ ] Host route is documented.
- [ ] Trigger control is visible in the correct host state.
- [ ] Trigger control has accessible name and clear label.
- [ ] Trigger is not available in states where the surface would be invalid.
- [ ] Trigger handles loading or disabled state.
- [ ] Trigger can be reached by keyboard.
- [ ] Trigger can be activated by keyboard.
- [ ] Trigger can be activated by pointer/touch.
- [ ] Trigger records enough context for the hosted surface to open with the right data.
- [ ] Direct rendering outside the host is not used as final proof.

### Modal Semantics And Focus

- [ ] Surface has dialog/modal semantics appropriate to implementation.
- [ ] Surface has visible or programmatic title.
- [ ] Initial focus target matches surface type.
- [ ] Confirmation modal focuses safe action or title according to risk.
- [ ] Content-heavy modal supports reading from heading/content.
- [ ] Focus remains inside modal while active.
- [ ] Tab and Shift+Tab cycle predictably.
- [ ] Focus returns to trigger on close.
- [ ] Focus moves to next logical element if trigger disappears.
- [ ] Focus is not hidden behind sticky headers or offscreen content.

### Close And Navigation

- [ ] Close button exists when user can cancel.
- [ ] Cancel action is distinct from destructive confirmation.
- [ ] Escape behavior is defined and tested.
- [ ] Backdrop click behavior is defined and tested.
- [ ] Browser back behavior is defined and tested.
- [ ] Browser forward behavior is defined for stateful overlays when applicable.
- [ ] Refresh behavior is safe.
- [ ] Deep-link behavior is either supported or safely rejected.
- [ ] Closing does not lose unsaved data without warning when relevant.
- [ ] Closing after completion moves the user to the right next state.

### Side Effects

- [ ] Confirmation modal names the irreversible outcome.
- [ ] Confirmation action cannot be submitted twice.
- [ ] Async modal/state blocks duplicate work.
- [ ] Async modal/state shows pending, success, failure, and timeout where applicable.
- [ ] Export modal validates owner and artifact availability before download.
- [ ] Retry modal preserves selected problem/user context.
- [ ] Autosave warning explains conflict, stale draft, and recovery.
- [ ] Analysis loading state does not imply guaranteed completion.
- [ ] Failure state gives retry, return, or support path as documented.
- [ ] Side effects are not triggered by opening the modal alone unless documented.

### Visual And Responsive

- [ ] Modal fits 360 px mobile width.
- [ ] Modal fits short mobile viewport.
- [ ] Primary and secondary actions remain visible.
- [ ] Scrollable content keeps title and action context understandable.
- [ ] Background page does not visually compete with active surface.
- [ ] Toast/warning is not hidden behind fixed navigation.
- [ ] Toast/warning remains visible long enough for the content length.
- [ ] Touch targets meet size/spacing baseline.
- [ ] Error and status states use more than color.
- [ ] Loading indicator has descriptive text.

### Evidence To Capture

- [ ] Host-route screenshot before trigger.
- [ ] Opened surface screenshot.
- [ ] Keyboard focus entry evidence.
- [ ] Focus containment evidence.
- [ ] Focus return evidence.
- [ ] Close/cancel evidence.
- [ ] Browser back/refresh evidence when relevant.
- [ ] Side-effect duplicate prevention evidence.
- [ ] Failure/recovery evidence.
- [ ] Mobile viewport evidence.

## Research-Backed Detailed Checks

- [ ] Modal has a programmatic role/name appropriate to the implementation pattern.
- [ ] Modal title is visible or programmatically available.
- [ ] Initial focus lands on the most useful element for the modal purpose.
- [ ] Content-heavy dialogs can start focus at the heading or content container when that improves reading order.
- [ ] Short action dialogs can focus the first safe action when that improves task completion.
- [ ] Focus cannot escape to the page behind the modal while modal behavior is active.
- [ ] Background content is inert or otherwise unavailable to keyboard and assistive technology while modal is active.
- [ ] Escape, close button, cancel button, backdrop click, and route back behavior are each defined.
- [ ] Closing the modal returns focus to the trigger or to the next logical workflow element if the trigger no longer exists.
- [ ] Browser back closes transient hosted state before navigating away when that is the documented behavior.
- [ ] Browser refresh on the host route has a safe result for open, pending, and completed modal states.
- [ ] Irreversible modal actions have confirmation copy that names the outcome.
- [ ] Loading modal/state prevents duplicate work and offers a safe wait, cancel, or retry path when documented.
- [ ] Toast/warning content is available long enough for reading and is not the sole place where critical recovery is explained.
- [ ] Mobile viewport keeps title, main content, and primary actions reachable without overlapping browser chrome.
- [ ] Modal evidence is collected through the host trigger, not by direct rendering alone.

## Rating Criteria

- `PASS`: host trigger, modal/state behavior, focus, back/close, and required edge states are evidenced.
- `PARTIAL`: the hosted surface appears but one required behavior lacks evidence.
- `FAIL`: the surface opens in the wrong context, traps focus, loses state, or repeats side effects.
- `BLOCKED`: host route, trigger state, or browser evidence cannot be obtained.
- `N/A`: route type is not a hosted surface.

## Required Evidence

- Host route evidence.
- Trigger evidence.
- Open and close evidence.
- Focus-return evidence.
- Back/refresh evidence when stateful.

## Result Packet Fields

- `hostRoute`
- `triggerPath`
- `surfaceBehavior`
- `focusBehavior`
- `backRefreshBehavior`
- `sideEffectControls`

## External References

- WCAG 2.2 focus order.
- NN/g usability heuristics.
- [WAI-ARIA APG Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [W3C ARIA Practices content-heavy dialog issue](https://github.com/w3c/aria-practices/issues/442)

## Project-Specific No-Pass Rules

- Do not pass a hosted IA by opening or mocking the surface outside the host route.
- Do not pass modal/state IA without proving how the user enters and exits the state.
- Do not pass modal IA without focus entry, focus containment, and focus return evidence.
