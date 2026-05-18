# Ant Design Review Checklist

Use this checklist before calling UI work complete.

## Component Use

- [ ] AntD components are used for common UI controls.
- [ ] Custom controls are justified by product need.
- [ ] Component props were checked with MCP or official docs when uncertain.
- [ ] Deprecated AntD components are not introduced in new UI work.
- [ ] Static APIs such as `message`, `Modal`, and `notification` are used with
      awareness of `ConfigProvider` context limitations.

## Theme And Tokens

- [ ] Global theme is centralized.
- [ ] Brand, radius, font, and color decisions use AntD tokens.
- [ ] Hardcoded colors are rare and justified.
- [ ] Component-specific styling uses component tokens where possible.
- [ ] Local font is applied consistently.

## Layout

- [ ] The page uses an app/workspace structure, not a marketing hero.
- [ ] Navigation is stable and predictable.
- [ ] The primary task is visible and visually dominant.
- [ ] Cards are not nested inside cards.
- [ ] Mobile layout has no horizontal overflow.
- [ ] Text does not overlap controls or other text.

## Feedback States

- [ ] Loading state exists.
- [ ] Empty state exists.
- [ ] Error state exists.
- [ ] Success state exists where relevant.
- [ ] Disabled buttons have clear reason or nearby validation.
- [ ] Destructive actions require confirmation.

## Learning Workflow

- [ ] The page answers what the learner is doing now.
- [ ] The page shows what changed after an action.
- [ ] The page provides a next learning action.
- [ ] AI tutor support does not hide critical controls.
- [ ] Exam and writing workflows preserve user input.

## Accessibility

- [ ] Form fields have labels.
- [ ] Icon-only buttons have accessible labels and tooltips.
- [ ] Keyboard focus remains visible.
- [ ] Color is not the only status indicator.
- [ ] Dialogs and drawers have predictable close behavior.

## Ant Design Values

- [ ] Natural: controls are where users expect them.
- [ ] Certain: similar actions look and behave consistently.
- [ ] Meaningful: each element supports a real learning task.
- [ ] Growing: results connect to progress, review, or next practice.

## Final Decision

If any required item fails, do not call the UI complete. Fix the issue or record
the remaining risk clearly.
