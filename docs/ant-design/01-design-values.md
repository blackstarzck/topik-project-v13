# Design Values

Ant Design defines four design values: Natural, Certain, Meaningful, and
Growing. For TALKPIK AI, these values are decision gates. A UI change should
pass all four gates before it is considered aligned with Ant Design.

## Natural

Natural means the interface follows user cognition and expected behavior.

For TALKPIK AI:

- Put learning status, next task, and urgent feedback where learners naturally
  look first.
- Keep writing, solving, OMR, and feedback actions close to their content.
- Do not make the learner leave the current workflow for secondary help.
- Use familiar Ant Design controls: `Form`, `Select`, `Radio`, `Tabs`,
  `Progress`, `Steps`, `Alert`, `Drawer`, `Modal`, `Table`, `Card`, and
  `Descriptions`.
- Avoid decorative layouts that make the app feel like a marketing page.

Implementation rule:

- If the user must ask "where do I go next?", the design fails Natural.

## Certain

Certain means predictable structure, consistent components, and low ambiguity.

For TALKPIK AI:

- Use one navigation model across the app.
- Use one feedback model across the app.
- Use one form layout model for problem generation and profile settings.
- Use one list/detail model for writing feedback, vocabulary, saved problems,
  notices, and exam history.
- Use tokens and component variants instead of custom one-off CSS.

Implementation rule:

- If two similar actions look or behave differently without a clear reason, the
  design fails Certain.

## Meaningful

Meaningful means each UI element helps the learner complete a real task.

For TALKPIK AI:

- Every page must answer:
  - What is the learner doing now?
  - What changed?
  - What should the learner do next?
- Feedback must explain the result of the action, not only that something
  happened.
- AI help must support the current learning task instead of distracting from it.
- Empty states must guide the next useful action.

Implementation rule:

- If a card, panel, chart, badge, or animation does not improve a learning
  decision, remove it or simplify it.

## Growing

Growing means the product helps users discover value over time and improves with
the learner's progress.

For TALKPIK AI:

- Show progress trends, weak points, saved work, retry paths, and next practice
  suggestions.
- Make AI tutor history and reminders easy to revisit.
- Let feedback connect to "practice again" or "review similar problem".
- Keep feature discovery progressive. Do not show every advanced option at once.

Implementation rule:

- If a page shows a result but does not create a next learning path, the design
  fails Growing.

## Practical Decision Test

Before adding or changing UI, answer these questions:

- Natural: Would the learner expect this control in this location?
- Certain: Does it match existing AntD component and layout patterns?
- Meaningful: Does it help the learner finish the current task?
- Growing: Does it help the learner improve or return later?

If any answer is "no", revise before coding.
