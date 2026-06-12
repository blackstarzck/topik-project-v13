# Patterns And Components

This file maps Ant Design design patterns to component choices for TALKPIK AI.

## Navigation

Use navigation to keep the learner oriented.

Preferred components:

- `Layout`: global app frame.
- `Menu`: primary navigation.
- `Breadcrumb`: nested detail pages when needed.
- `Tabs`: peer sections inside one task.
- `Steps`: ordered workflows such as mock exam setup or writing submission.

Rules:

- Sidebar items must map to stable product areas.
- `Menu` selected, hover, active, disabled, border, active bar, and text-color
  states must come from AntD `Menu` component tokens. If only one product area
  needs a different navigation style, wrap that area in a scoped
  `ConfigProvider` instead of changing the global `Menu` theme.
- Do not restyle `Menu` internals with Tailwind utilities, broad `.ant-menu*`
  selectors, or project-authored visual inline styles.
- AntD may generate inline style attributes for runtime behavior such as inline
  menu indentation. Treat those as library output; only override them when there
  is a confirmed product bug and no token or prop can express the fix.
- Tabs are for switching views inside the same context, not for global routing.
- Steps are for workflows with a required order.
- Breadcrumbs are for deep pages such as notice detail or feedback detail.

## Feedback

Choose feedback by interruption level.

- `message`: short non-blocking confirmation.
- `notification`: system-level event that can be noticed later.
- `Alert`: persistent contextual warning or guidance inside a page.
- `Modal`: blocking decision or irreversible action.
- `Result`: final success, failure, or exception state.
- `Spin` or `Skeleton`: loading state.
- `Progress`: measurable progress.

TALKPIK examples:

- Autosaved writing draft: `message` or inline text near the editor.
- Missing problem type: form validation plus inline error.
- Submit writing answer: confirmation `Modal`.
- Mock exam completed: `Result` plus next action.
- AI feedback generation: `Spin`, `Skeleton`, or progress copy.
- Empty vocabulary list: `Empty` with action to add or review words.

## Data Entry

Preferred components:

- `Form`
- `Input`
- `Input.TextArea`
- `Select`
- `Radio`
- `Checkbox`
- `Switch`
- `Slider`
- `DatePicker`
- `Upload` if attachments are added later.

Rules:

- Required choices must be visibly required.
- Disable the main action until required choices are valid.
- Keep helper text close to the field it explains.
- Use validation messages, not generic toasts, for field errors.
- Long writing answers need stable editor height and autosave status.

## Data Display

Preferred components:

- `Table`: sortable, comparable structured data.
- `Card`: bounded summary or repeated item. In app code, use
  `src/components/shared/AppCard.tsx` for user-facing Card surfaces so themes
  have a stable `.app-card` hook. Project wrappers must wrap AntD components
  rather than replace them with custom/Tailwind-only controls.
- `Descriptions`: read-only detail metadata.
- `Statistic`: important metrics.
- `Progress`: target completion or exam progress.
- `Tag` and `Badge`: compact status labels.
- `Collapse`: optional detail sections.
- `Timeline`: chronological feedback or exam history.

`List` is deprecated in current Ant Design guidance. Do not choose it first for
new UI in this project.

Rules:

- Use `Table` for records users compare or sort.
- Use `Card` plus `Flex` or `Space` for simpler scans, feed summaries, or
  bounded repeated items.
- Do not create theme-specific Card wrappers such as `LiquidGlassCard`.
  Theme-specific surface and child-component styling belongs in the theme
  preset, scoped to `.app-card`.
- Do not use Tailwind utilities to recreate AntD component variants or states.
  Tailwind may position and constrain the component; AntD props, tokens, and
  component tokens own the component behavior and appearance.
- Use `Descriptions` for stable metadata in detail pages.
- Use `Statistic` only for numbers that matter.
- Avoid overusing cards for every section.

## Buttons

Rules:

- One primary button per local task area.
- Use secondary/default buttons for alternatives.
- Use danger buttons only for destructive actions.
- Put the verb first in button copy.
- Disable buttons only when the reason is clear; otherwise show validation.
- Use loading state for async actions.

TALKPIK examples:

- Primary: "Generate problem", "Submit answer", "Start mock exam".
- Secondary: "Save draft", "Preview rubric", "Back to list".
- Danger: "End exam", "Delete saved word".

## Copywriting

Rules:

- Use short action-oriented copy.
- Explain what changed after an action.
- Avoid vague success messages such as "Done" when the next step matters.
- Keep learning terminology consistent across pages.

Good examples:

- "Draft saved"
- "Choose a TOPIK level before generating a problem"
- "Feedback is ready. Review weak points next."

Avoid:

- "Operation successful"
- "An error occurred"
- "Please check"

## Data Format

Rules:

- Show dates consistently.
- Show score and total score together.
- Show TOPIK level and problem type in consistent labels.
- Use status tags consistently.

Recommended labels:

- `TOPIK I`
- `TOPIK II`
- `Writing 51`
- `Writing 53`
- `Draft`
- `Submitted`
- `Feedback ready`
- `Needs review`
