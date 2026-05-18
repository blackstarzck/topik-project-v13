# Visualization, Motion, And Illustration

This file applies Ant Design visualization, motion, and illustration guidance to
TALKPIK AI.

## Visualization

Use charts only when they help the learner make a decision.

Good uses:

- Score trend across mock exams.
- Weak point distribution by TOPIK skill.
- Writing score breakdown.
- Weekly learning time trend.
- Accuracy by problem type.

Avoid:

- Decorative charts with no decision value.
- Multiple chart colors without meaning.
- Tiny charts that are hard to read.

Rules:

- Prefer Ant Design Charts or AntV-compatible patterns.
- Use consistent color semantics across charts.
- Label axes and units.
- Provide empty and loading states.
- Add short text summaries near charts.

## Motion

Motion should clarify change, not entertain.

Good uses:

- Drawer opening for AI tutor or OMR.
- Step transition in setup flow.
- Small loading transition while feedback is generated.
- Hover/focus affordance on interactive cards.

Avoid:

- Continuous decorative motion.
- Motion on exam-critical content.
- Large page transitions that delay repeated learning work.

Rules:

- Prefer `transform` and `opacity`.
- Keep motion short and subtle.
- Respect reduced motion settings when implemented.
- Do not animate text in long reading or writing tasks.

## Illustration

Use illustration only when it improves comprehension or emotional recovery.

Good uses:

- Empty state for no saved vocabulary.
- Result state after mock exam.
- Exception state for failed network or unavailable AI feedback.
- Onboarding or first-use help.

Avoid:

- Large decorative illustrations on dashboard work areas.
- Illustrations that push primary learning actions below the fold.
- Generic AI-themed art that does not explain the task.

## Image-Based Official Examples

Many Ant Design Design pages include visual correct/incorrect examples. AI tools
may miss details if only alt text is available.

When a visual example matters:

1. Open the official page in a browser.
2. Inspect the image visually.
3. Convert the observed rule into text in this folder or in the implementation
   notes.
4. Apply that text rule in code.

Do not assume that links alone are enough for image-heavy design rules.

