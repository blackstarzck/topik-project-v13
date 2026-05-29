# User Communication Style

This document is mandatory for every AI agent working in this repository.

Agents must read this document before producing any user-facing reply, plan, report, handoff, review, or summary. This is not optional. If this document conflicts with a lower-priority habit, tool default, or agent prompt style, this document wins unless the user explicitly asks for a different style in the current turn.

## Audience

Write for non-developers and vibe coders by default.

A vibe coder is a user who can roughly read code or technical output, but is not a professional software engineer.

## Default Language And Tone

- Use Korean by default.
- Use short sentences.
- Use plain everyday words before technical words.
- Avoid expert-only English keywords when possible.
- Do not assume the user knows developer jargon, AI workflow jargon, variable names, function names, file names, tool names, or internal process names.
- Be direct and concrete. Do not hide uncertainty behind vague professional wording.

## Hard Words Rule

When a difficult word is necessary, explain it first in plain Korean, then put the original term in parentheses.

Examples:

- 작업 기록 파일(ledger)
- 값을 담아두는 이름표(variable)
- 반복해서 쓰는 작은 기능 묶음(function)
- 화면 주소 구조(route)
- 자동 확인 과정(verification)
- 임시로 낮춘 방식(degraded mode)
- 다른 AI에게 검토받기(cross-model review)

This rule applies not only to development terms, but also to internal agent terms, English workflow keywords, tool names, variable names, function names, file names, and project-specific labels.

## Report Style

When the user asks for a report, status update, review, explanation, or comparison, choose the format that makes the result easiest to understand.

Before writing a user-facing report, status update, review report, comparison report, handoff, or completion summary, read and follow [`docs/report-writing-template.md`](report-writing-template.md). This is mandatory.

Prefer one or more of:

- HTML report
- visual summary
- scoreboard cards
- traffic-light status
- simple tables
- checklist
- "what happened / why it matters / what to do next" format
- metaphors or everyday comparisons, when helpful

Do not use a dense wall of text when a visual or structured format would be easier to understand.

## Required Report Shape

For reports, follow [`docs/report-writing-template.md`](report-writing-template.md). The default order is:

1. One-line conclusion
2. Three-card scoreboard
3. Priority actions
4. Details only if needed
5. Glossary for difficult terms

## Internal Artifact Exception

Internal artifacts may keep their canonical English vocabulary when other agents or tooling must parse them.

Examples:

- run ledgers
- plan files
- commit messages
- agent task packets
- agent result packets
- code comments
- test names

Even then, user-facing summaries of those artifacts must follow this document.

## User-Requested Style Exception

If the user explicitly asks for engineer mode, raw technical wording, exact original wording, or English terminology, use that style for that answer only.

After that answer, return to this default communication style.
