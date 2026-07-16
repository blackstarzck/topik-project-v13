# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable)

**Only dispatch after spec compliance review passes.**

```
Task tool (general-purpose):
  Use template at requesting-code-review/code-reviewer.md

  DESCRIPTION: [task summary, from implementer's report]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  BASELINE_DIRTY_PATHS: [paths changed before this task]
  WRITE_SCOPE: [allowed paths for this task]
  TASK_DIFF_SCOPE: [task-owned paths and hunks for `local-edit-only`, or commit range for `commit-authorized`]
  BASE_SHA: [optional; commit before task]
  HEAD_SHA: [optional; current commit when a task commit was authorized]
```

Reject overlap between `BASELINE_DIRTY_PATHS` and `WRITE_SCOPE`, edits outside `WRITE_SCOPE`, or a `TASK_DIFF_SCOPE` that includes earlier task changes.

For `local-edit-only`, the concrete task-owned patch in `TASK_DIFF_SCOPE` replaces the Git range section of the shared reviewer template. Do not use `BASE_SHA` or `HEAD_SHA`, do not derive a patch from the cumulative working tree, and do not review files or hunks outside the supplied task-owned patch. For `commit-authorized`, use the validated commit range and verify it stays inside `WRITE_SCOPE`.

Review without creating a commit. Reviewer approval verifies quality; it does not expand the implementer's authority envelope.

**In addition to standard code quality concerns, the reviewer should check:**

- Does each file have one clear responsibility with a well-defined interface?
- Are units decomposed so they can be understood and tested independently?
- Is the implementation following the file structure from the plan?
- Did this implementation create new files that are already large, or significantly grow existing files? (Don't flag pre-existing file sizes — focus on what this change contributed.)

**Code reviewer returns:** Strengths, Issues (Critical/Important/Minor), Assessment
