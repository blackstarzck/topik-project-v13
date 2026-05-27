#!/usr/bin/env node
// One-shot mechanical fixer for 30 historical ledgers (P2-5 follow-up).
// Adds `Cross-model review:` line at end of `## Verification State` section.
// For the 2 listed special files, also adds `Untouched relevant docs and reason: none`
// at end of `## Docs Consulted` section.
// Not committed.

import { readFile, writeFile } from "node:fs/promises";

const CROSS_MODEL_LINE =
  "- Cross-model review: degraded — historical, pre-rule (single-AI authored before 2026-05-21 cross-review rule was introduced)";
const UNTOUCHED_LINE = "- Untouched relevant docs and reason: none";

const filesNeedingCrossModel = [
  "docs/ai-workflow/runs/2026/05/18/20260518-1658-context-management-hardening.md",
  "docs/ai-workflow/runs/2026/05/18/20260518-1702-readme-ai-workflow.md",
  "docs/ai-workflow/runs/2026/05/18/20260518-1706-public-github-publish.md",
  "docs/ai-workflow/runs/2026/05/18/20260518-1719-fallback-protocol.md",
  "docs/ai-workflow/runs/2026/05/18/20260518-1751-git-publication-decision.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-0834-serverless-dev-spec-recommendation.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-0841-auth-ai-boundary-recommendation.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-0940-development-stack-freeze.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1014-docs-readme-map.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1031-agent-index-compression.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1042-spec-consolidation-consistency.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1116-ai-workflow-analysis.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1338-local-skill-pack.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1437-report-template-readability.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1441-agents-skills-readme.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1445-remove-ai-vercel-boundary.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1503-practical-agent-skills.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1530-root-readme-collaboration-guide.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1537-serverless-spec.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1539-report-readability.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1551-package-install.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1557-run-ledger-date-folders.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1601-agents-objectivity-assumptions.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1613-node-version-sync.md",
  "docs/ai-workflow/runs/2026/05/19/20260519-1635-paper-sitemap-ia-pages.md",
  "docs/ai-workflow/runs/2026/05/20/20260520-1000-route-scope-alignment.md",
  "docs/ai-workflow/runs/2026/05/20/20260520-1030-remove-assistant-support-scope.md",
  "docs/ai-workflow/runs/2026/05/20/20260520-1043-schema-analysis.md",
  "docs/ai-workflow/runs/2026/05/20/20260520-1149-schema-parallel-analysis.md",
  "docs/ai-workflow/runs/2026/05/20/20260520-1530-schema-implementation.md",
];

const filesNeedingUntouched = new Set([
  "docs/ai-workflow/runs/2026/05/20/20260520-1149-schema-parallel-analysis.md",
  "docs/ai-workflow/runs/2026/05/20/20260520-1530-schema-implementation.md",
]);

// Inserts `insertLine` as the last bullet of the section started by `sectionHeader`
// (e.g., "## Verification State"). The line is appended right before the next
// `## ` header at column 0, or at end-of-file if none follows.
// Preserves CRLF/LF line ending used by the file.
function insertAtEndOfSection(content, sectionHeader, insertLine) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  let sectionStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === sectionHeader) {
      sectionStart = i;
      break;
    }
  }
  if (sectionStart === -1) {
    throw new Error(`Section not found: ${sectionHeader}`);
  }
  // Find next `## ` header after the section start
  let sectionEnd = lines.length; // default: end of file
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      sectionEnd = i;
      break;
    }
  }
  // Walk backwards from sectionEnd to find last non-blank line
  let insertAt = sectionEnd;
  while (insertAt > sectionStart + 1 && lines[insertAt - 1].trim() === "") {
    insertAt--;
  }
  // Insert the new bullet at `insertAt` (after the last content line of the section)
  const newLines = [
    ...lines.slice(0, insertAt),
    insertLine,
    ...lines.slice(insertAt),
  ];
  return newLines.join(eol);
}

let count = 0;
for (const file of filesNeedingCrossModel) {
  const original = await readFile(file, "utf8");
  let updated = insertAtEndOfSection(original, "## Verification State", CROSS_MODEL_LINE);
  if (filesNeedingUntouched.has(file)) {
    updated = insertAtEndOfSection(updated, "## Docs Consulted", UNTOUCHED_LINE);
  }
  if (updated === original) {
    throw new Error(`No change made to ${file}`);
  }
  await writeFile(file, updated, "utf8");
  count++;
  console.log(`updated: ${file}${filesNeedingUntouched.has(file) ? " (both fields)" : ""}`);
}
console.log(`\nDone. ${count} files updated.`);
