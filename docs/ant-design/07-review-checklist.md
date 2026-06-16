# Ant Design Review Checklist

Use this checklist before calling UI work complete.

## Component Use

- [ ] AntD components are used for common UI controls.
- [ ] Custom controls are justified by product need.
- [ ] Component props were checked with MCP or official docs when uncertain.
- [ ] Deprecated AntD components are not introduced in new UI work.
- [ ] Static APIs such as `message`, `Modal`, and `notification` are used with
      awareness of `ConfigProvider` context limitations.
- [ ] When changing AntD component styling or behavior, `antd info <Component>
      --format json` was checked before editing and `antd lint <changed-path>
      --format json` was run afterward when available.

## Theme And Tokens

- [ ] Global theme is centralized.
- [ ] A single theme source of truth is identified for the change.
- [ ] Brand, radius, font, and color decisions are projected through the AntD
      adapter (`theme.token` / `theme.components`) instead of local CSS.
- [ ] Hardcoded colors are rare and justified.
- [ ] Component-specific styling uses component tokens where possible.
- [ ] Selected, hover, active, disabled, border, radius, and active-bar states
      for AntD components are controlled by component tokens or a scoped
      `ConfigProvider`, not Tailwind utilities or broad CSS overrides.
- [ ] Local font is applied consistently.
- [ ] Tailwind utilities read shared project theme variables through the
      Tailwind adapter (`@theme inline` + `--app-*`), not a separate Tailwind
      palette or copied token values.
- [ ] If a theme token was added or changed, both the AntD adapter and Tailwind
      adapter were updated or explicitly marked unaffected.
- [ ] Any new `--app-*` bridge variable has a documented source token, use case,
      and matching theme contract test update.
- [ ] AntD components and Tailwind-authored surfaces remain visually aligned in
      light and dark appearances.
- [ ] `--app-*` CSS variables are declared on `html` or `:root`, not via
      `style={}` on a wrapper component.
- [ ] No `--app-*` variable holds a `var(--ant-*)` chain; each holds a resolved
      actual value safe for SSR.
- [ ] Resolved `--app-*` values are present on first render (injected from
      `src/app/layout.tsx` server-side, not deferred to client JS).
- [ ] Portal-rendered AntD surfaces (Modal, Drawer, Notification, Tooltip) have
      been verified to display correct `--app-*` colors in a running build.
- [ ] `src/styles/global.css` uses `@theme inline` (not bare `@theme`) for any
      Tailwind v4 `--app-*` variable bridging.
- [ ] No project-authored visual inline style was added for colors,
      backgrounds, borders, radii, padding, or component states.
- [ ] Any inline style visible in DevTools is identified as either
      library-generated output, server-side theme bridge injection on `<html>`,
      or a documented runtime geometry exception.
- [ ] No selector targets AntD generated classes such as
      `css-dev-only-do-not-override-*`.
- [ ] Runtime theme or appearance switching uses React state or context, not a
      module-level constant.

## Layout

- [ ] The page uses an app/workspace structure, not a marketing hero.
- [ ] Navigation is stable and predictable.
- [ ] The primary task is visible and visually dominant.
- [ ] Cards are not nested inside cards.
- [ ] Card-internal rows do not look like mini cards; permanent bordered,
      rounded row containers are justified only for standalone selectable tiles
      or grouped inputs.
- [ ] Card-internal status chips and counts use filled surfaces without outline
      borders unless they are selectable filters or form choices.
- [ ] Card-level CTA buttons are placed in Ant Design `Card.actions`, not inside
      card body content, and the footer/actions area is borderless by default.
- [ ] Whole-card titles and right-side status/count metadata use Ant Design
      `Card` `title`/`extra`, not custom header rows inside the body.
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
