#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const REQUIRED_PR_SECTIONS = [
  "## Summary",
  "## Why",
  "## Docs Consulted",
  "## Review",
  "## Verification",
  "## Git Publication Decision",
  "## Risks And Skipped Checks",
];

const REQUIRED_GIT_DECISION_FIELDS = [
  "Git publication decision:",
  "Reason:",
  "Branch:",
  "Upstream:",
  "Dirty scope:",
  "Review status:",
  "Verification status:",
  "Ledger:",
  "Fallback status:",
  "Next git action:",
];

const REQUIRED_LORE_TRAILERS = [
  "Constraint",
  "Rejected",
  "Confidence",
  "Scope-risk",
  "Directive",
  "Tested",
  "Not-tested",
  "Publication-decision",
  "Review",
  "Ledger",
];

const REQUIRED_LEDGER_SECTIONS = [
  "## Docs Consulted",
  "## Verification State",
  "## Ledger/File-State Consistency",
];

const REQUIRED_PLAN_SECTIONS = [
  "## Out of Scope — Intentional Cuts",
  "## Smallest Buildable Unit",
];

const SUBAGENT_COLUMN_PATTERN = /Subagent-eligible/i;
const REVIEWER_LINE_PATTERN = /Cross-model review:\s*(.+?)\s*$/im;
const ARCH_PASS_LINE_PATTERN = /Architecture Pass:\s*(.+?)\s*$/im;
const PHASE_MARKER_LINE_PATTERN = /^[-\s]*Phase:\s*\S+/m;
// Match only the canonical phase ledger naming: <date>-<time>-phase-<N>-<slug>.md
// (or non-dated phase plans like <date>-phase-<N>-<slug>.md for the plans/ folder).
// Avoids false positives when "phase-N" appears mid-slug (e.g., "meta-audit-of-phase-3").
const PHASE_FILENAME_PATTERN = /\/\d{8}(?:-\d{4})?-phase-\d+[-_.]/;
const LIGHT_SPEC_LINE_PATTERN = /Light Spec:\s*(.+?)\s*$/im;
const LIGHT_SPEC_VALID_PATH_PATTERN =
  /^docs\/ai-workflow\/light-specs\/.+\.md$/;
const LIGHT_SPEC_SKIPPED_PATTERN = /^skipped\s*[—\-]\s*\S.*$/i;
// "Y — reason" or "N — reason" (em-dash or hyphen, non-empty reason after)
const SUBAGENT_CELL_PATTERN = /^[YN]\s*[—\-]\s*\S/;

// Audience field: either inline "Audience: user · admin · both" (new standard)
// or a "## Audience" section header (allowed for existing non-standard light specs).
// See docs/ai-workflow/planning-contracts.md §1b.
const AUDIENCE_FIELD_PATTERN = /^Audience:\s*\S+/im;
const AUDIENCE_SECTION_PATTERN = /^##\s+Audience\s*$/im;

// UI change detection patterns (UX/UI Consistency Pass — PR B).
// If any changed file matches one of these (and not all changes are test-only),
// the PR must produce a ledger with the 4-line UX/UI Consistency Pass evidence.
// See docs/ai-workflow/review-gates.md §UX/UI Consistency Pass.
const UI_CHANGE_PATTERNS = [
  /^src\/app\//,
  /^src\/components\//,
  /^src\/features\//,
  /^src\/lib\/ui\//,
  /^src\/styles\//,
  /\.css$/,
  /\.scss$/,
  /globals\.css$/i,
  /^src\/theme\//,
  /^tailwind\.config\./,
  /^postcss\.config\./,
  /^public\/icons\//,
  /^public\/images\//,
];
const UI_TEST_ONLY_PATTERNS = [
  /\.test\./,
  /\.spec\./,
  /\/__tests__\//,
];
const UXUI_PARENT_PATTERN = /^-\s+UX\/UI Consistency Pass:(.*)$/im;
const UXUI_CHILD_PATTERNS = {
  Tokens: /^\s*-\s+Tokens:(.*)$/im,
  Components: /^\s*-\s+Components:(.*)$/im,
  A11y: /^\s*-\s+A11y:(.*)$/im,
  Responsive: /^\s*-\s+Responsive:(.*)$/im,
};

// QA Gate field (PR C — Enforcement). Required when changed files match UI patterns.
// Past failure case: reports/phase-6-qa-gate-skipped-postmortem.html.
// See docs/ai-workflow/review-gates.md §QA Gate.
const QA_GATE_PATTERN = /^-\s+QA Gate:(.*)$/im;
const QA_GATE_DEGRADED_PATTERN =
  /^-\s+QA Gate:\s*degraded(\b.*)?$/im;
// degraded must contain pipe-separated triple (blocker | alternative | residual)
const QA_GATE_DEGRADED_VALID_PATTERN =
  /^-\s+QA Gate:\s*degraded\s+[—\-]\s*[^|]+\|[^|]+\|[^|]+$/im;
// release/phase ledger acceptance line for degraded
const QA_GATE_DEGRADED_ACCEPTED_PATTERN =
  /QA Gate degraded accepted by\s+\S+/im;

const IMPLEMENTATION_OR_WORKFLOW_PATTERNS = [
  /^scripts\//,
  /^\.github\//,
  /^\.agents\//,
  /^\.codex\//,
  /^\.claude\//,
  /^\.claude\/settings(?:\.local)?\.json$/,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^docs\/ai-development-workflow\.md$/,
  /^docs\/agent-index\.md$/,
  /^docs\/ai-workflow\//,
];

const LEDGER_PATTERN =
  /^docs\/ai-workflow\/runs\/\d{4}\/\d{2}\/\d{2}\/\d{8}-\d{4}-.+\.md$/;
const LEGACY_LEDGER_PATTERN =
  /^docs\/ai-workflow\/runs\/\d{8}-\d{4}-.+\.md$/;
const PLAN_FILE_PATTERN = /^docs\/ai-workflow\/plans\/.+\.md$/;
const PHASE_PLAN_PATTERN = /development-phases-and-bootstrap\.md$/;
const PLAN_TEMPLATE_PATTERN = /\/(README|.*-template)\.md$/i;
const PLAN_PHASE_PATTERN = /phase-(\d+)/;
const LIGHT_SPEC_AUDIENCE_VALUE_PATTERN = /^Audience:\s*(\S+)/im;

// Extracts Audience value from light spec body. Accepts two shapes:
//   (A) inline:   "Audience: both"
//   (B) section:  "## Audience\n\nAudience: both"   or   "## Audience\n\n`Audience: both`"
// Returns lowercased value or null.
function parseLightSpecAudience(body) {
  // Shape A: inline
  const inline = body.match(LIGHT_SPEC_AUDIENCE_VALUE_PATTERN);
  if (inline) return inline[1].toLowerCase();

  // Shape B: ## Audience section
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^##\s+Audience\s*$/i.test(lines[i])) continue;
    // scan following lines for the value
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j].trim();
      if (line.length === 0) continue;
      if (/^##\s+/.test(line)) break; // next section
      // try to extract: value can be inline word, backtick-wrapped, or 'Audience: X' format
      const m =
        line.match(/`Audience:\s*([a-z\/]+)\s*`/i) ||  // `Audience: both`
        line.match(/^Audience:\s*([a-z\/]+)/i) ||       // Audience: both
        line.match(/^([a-z\/]+)\b/i);                   // bare 'both' or 'user (admin은 ...)'
      if (m) {
        const value = m[1].toLowerCase();
        // sanity: only accept recognized values
        if (/^(user|admin|both|n\/a)$/.test(value)) return value;
      }
      // first non-empty content line decides — break either way
      break;
    }
    break;
  }
  return null;
}

function normalizePathForCheck(path) {
  return normalize(path).split(sep).join("/");
}

function okResult(errors = [], warnings = []) {
  return { ok: errors.length === 0, errors, warnings };
}

function normalizeDashes(s) {
  // Treat hyphen, en-dash, em-dash as equivalent for section heading matching.
  // Avoids the "type one wrong dash and the checker fails" footgun.
  return s.replace(/[—–‐-]/g, "—");
}

function sectionContent(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const normalizedHeading = normalizeDashes(heading);
  const start = lines.findIndex(
    (line) => normalizeDashes(line.trim()) === normalizedHeading,
  );
  if (start === -1) return null;

  const contentLines = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^##\s+/.test(line)) break;
    contentLines.push(line);
  }

  return contentLines.join("\n").trim();
}

export function checkPullRequestBody(body) {
  const errors = [];

  for (const section of REQUIRED_PR_SECTIONS) {
    const content = sectionContent(body, section);
    if (content === null) {
      errors.push(`pull request body missing required section: ${section}`);
    } else if (content.length === 0) {
      errors.push(`pull request body has empty required section: ${section}`);
    }
  }

  for (const field of REQUIRED_GIT_DECISION_FIELDS) {
    const fieldPattern = new RegExp(
      `^\\s*${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\S+`,
      "im",
    );
    if (!fieldPattern.test(body)) {
      errors.push(`pull request body missing git decision field value: ${field}`);
    }
  }

  return okResult(errors);
}

export function checkCommitMessage(message) {
  const errors = [];
  const firstLine = message.split(/\r?\n/, 1)[0] ?? "";
  const conventionalCommitPattern =
    /^(feat|fix|docs|test|refactor|perf|build|ci|chore|style|revert)(\([^)]+\))?(!)?: .+/;

  if (!conventionalCommitPattern.test(firstLine)) {
    errors.push("commit message header must follow Conventional Commits");
  }

  for (const trailer of REQUIRED_LORE_TRAILERS) {
    const trailerPattern = new RegExp(`^${trailer}:\\s*\\S+`, "im");
    if (!trailerPattern.test(message)) {
      errors.push(`commit message missing required trailer: ${trailer}`);
    }
  }

  return okResult(errors);
}

export function checkPlanFile(text, path = "<plan>", options = {}) {
  const { requireAudienceColumn = false } = options;
  const errors = [];

  for (const section of REQUIRED_PLAN_SECTIONS) {
    const content = sectionContent(text, section);
    if (content === null) {
      errors.push(`plan ${path} missing required section: ${section}`);
    } else if (content.trim().length === 0) {
      errors.push(`plan ${path} required section is empty: ${section}`);
    }
  }

  const tasksContent = sectionContent(text, "## Tasks");
  if (tasksContent !== null) {
    const lines = tasksContent.split(/\r?\n/);
    const headerIdx = lines.findIndex((l) => /^\|.*\|.*\|/.test(l));
    if (headerIdx === -1) {
      errors.push(`plan ${path} ## Tasks section requires a task table`);
    } else {
      const headerLine = lines[headerIdx];
      const cols = headerLine
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      const subagentColIdx = cols.findIndex((c) =>
        SUBAGENT_COLUMN_PATTERN.test(c),
      );
      if (subagentColIdx === -1) {
        errors.push(
          `plan ${path} task table must include a 'Subagent-eligible? (Y/N + reason)' column`,
        );
      } else {
        let rowNumber = 0;
        for (let i = headerIdx + 2; i < lines.length; i += 1) {
          const row = lines[i];
          if (!/^\|/.test(row)) break;
          rowNumber += 1;
          const cells = row
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim());
          const cell = cells[subagentColIdx] ?? "";
          if (!SUBAGENT_CELL_PATTERN.test(cell)) {
            errors.push(
              `plan ${path} task row ${rowNumber} Subagent-eligible cell must be 'Y — reason' or 'N — reason' (got: '${cell}')`,
            );
          }
        }
      }

      // Audience column required when phase Audience is 'both'
      // (planning-contracts.md §Plan Template Contract L64).
      if (requireAudienceColumn) {
        const audienceColIdx = cols.findIndex((c) => /^audience$/i.test(c));
        if (audienceColIdx === -1) {
          errors.push(
            `plan ${path} task table requires an Audience column (light spec phase Audience is 'both')`,
          );
        } else {
          let aRowNum = 0;
          for (let i = headerIdx + 2; i < lines.length; i += 1) {
            const row = lines[i];
            if (!/^\|/.test(row)) break;
            aRowNum += 1;
            const cells = row.split("|").slice(1, -1).map((c) => c.trim());
            const cell = cells[audienceColIdx] ?? "";
            if (!/^(user|admin|both|n\/a)$/i.test(cell)) {
              errors.push(
                `plan ${path} task row ${aRowNum} Audience cell must be one of 'user|admin|both|n/a' (got: '${cell}')`,
              );
            }
          }
        }
      }
    }
  }

  return okResult(errors);
}

export function checkLedgerReviewer(text) {
  const errors = [];
  const match = text.match(REVIEWER_LINE_PATTERN);
  if (!match || match[1].trim().length === 0) {
    errors.push(
      "ledger missing 'Cross-model review:' field with non-empty value (use 'degraded — <reason>' if unavailable)",
    );
  }
  return okResult(errors);
}

export function checkQaGate(text, options = {}) {
  const { phaseComplete = false } = options;
  const errors = [];
  const parentMatch = text.match(QA_GATE_PATTERN);
  if (!parentMatch || !parentMatch[1] || parentMatch[1].trim().length === 0) {
    errors.push(
      "ledger missing 'QA Gate:' field (required when changed files match UI patterns — see docs/ai-workflow/review-gates.md §QA Gate). Past failure case: reports/phase-6-qa-gate-skipped-postmortem.html",
    );
    return okResult(errors);
  }
  const value = parentMatch[1].trim();
  if (/^skipped$/i.test(value)) {
    errors.push(
      "QA Gate 'skipped' requires a reason ('skipped — <reason>')",
    );
  }
  if (/^failed$/i.test(value)) {
    errors.push(
      "QA Gate 'failed' requires a reason ('failed — <blocker>'). See review-gates.md §QA Gate.",
    );
  }
  if (QA_GATE_DEGRADED_PATTERN.test(text)) {
    if (!QA_GATE_DEGRADED_VALID_PATTERN.test(text)) {
      errors.push(
        "QA Gate 'degraded' must include pipe-separated triple: '<blocker> | <alternative verification> | <residual risk>'. degraded alone is not enough — see review-gates.md §QA Gate degraded 처리 정신",
      );
    }
    if (phaseComplete && !QA_GATE_DEGRADED_ACCEPTED_PATTERN.test(text)) {
      errors.push(
        "phase-complete ledger with 'QA Gate: degraded' requires explicit owner acceptance line: 'QA Gate degraded accepted by <owner> — <date>' (fail-closed by default)",
      );
    }
  }
  return okResult(errors);
}

export function checkUxuiConsistencyPass(text) {
  const errors = [];
  const parentMatch = text.match(UXUI_PARENT_PATTERN);
  if (!parentMatch || !parentMatch[1] || parentMatch[1].trim().length === 0) {
    errors.push(
      "ledger missing 'UX/UI Consistency Pass:' parent field with non-empty value (required when changed files match UI patterns — see docs/ai-workflow/review-gates.md §UX/UI Consistency Pass)",
    );
    return okResult(errors);
  }
  for (const [name, pattern] of Object.entries(UXUI_CHILD_PATTERNS)) {
    const m = text.match(pattern);
    if (!m || !m[1] || m[1].trim().length === 0) {
      errors.push(
        `ledger UX/UI Consistency Pass missing '${name}:' sub-field with non-empty value`,
      );
    }
  }
  return okResult(errors);
}

export function checkLedgerArchitecturePass(text, phaseComplete = false) {
  const errors = [];
  if (phaseComplete) {
    const match = text.match(ARCH_PASS_LINE_PATTERN);
    if (!match || match[1].trim().length === 0) {
      errors.push(
        "ledger for completed phase missing 'Architecture Pass:' field with non-empty value (passed | failed | skipped — <reason>)",
      );
    }
  }
  return okResult(errors);
}

function detectPhaseLedger(ledgerText, ledgerPath) {
  const normalizedPath = normalizePathForCheck(ledgerPath);
  return (
    PHASE_MARKER_LINE_PATTERN.test(ledgerText) ||
    PHASE_FILENAME_PATTERN.test(normalizedPath)
  );
}

export async function checkLightSpecPresence(root, ledgerText, ledgerPath = "") {
  const errors = [];
  if (!detectPhaseLedger(ledgerText, ledgerPath)) return okResult(errors);

  const match = ledgerText.match(LIGHT_SPEC_LINE_PATTERN);
  if (!match) {
    errors.push(
      `phase ledger ${ledgerPath || "(unnamed)"} missing 'Light Spec:' field required (path to docs/ai-workflow/light-specs/... or 'skipped — <reason>')`,
    );
    return okResult(errors);
  }

  const value = match[1].trim();

  // Explicit opt-out: "skipped — <reason>"
  if (LIGHT_SPEC_SKIPPED_PATTERN.test(value)) {
    return okResult(errors);
  }
  // Bare "skipped" without a reason is not allowed
  if (/^skipped$/i.test(value)) {
    errors.push(
      `phase ledger ${ledgerPath}: Light Spec 'skipped' requires a reason (use 'skipped — <reason>')`,
    );
    return okResult(errors);
  }

  // Otherwise must be a path under docs/ai-workflow/light-specs/
  const normalizedValue = normalizePathForCheck(value);
  if (!LIGHT_SPEC_VALID_PATH_PATTERN.test(normalizedValue)) {
    errors.push(
      `phase ledger ${ledgerPath}: Light Spec path must be under docs/ai-workflow/light-specs/ (got: '${value}')`,
    );
    return okResult(errors);
  }

  const exists = await fileExists(root, normalizedValue);
  if (!exists) {
    errors.push(`light spec file does not exist: ${normalizedValue}`);
    return okResult(errors);
  }

  // Audience field/section check (PR A extension):
  // Every phase-scoped Light Spec must declare its audience so child agents
  // and the Architecture Pass can verify the user/admin boundary.
  const lsBody = await readFile(join(root, normalizedValue), "utf8");
  if (
    !AUDIENCE_FIELD_PATTERN.test(lsBody) &&
    !AUDIENCE_SECTION_PATTERN.test(lsBody)
  ) {
    errors.push(
      `light spec ${normalizedValue} missing required Audience — add "Audience: user · admin · both" inside Domain Boundary section OR a separate "## Audience" section (see docs/ai-workflow/planning-contracts.md §1b)`,
    );
  }

  return okResult(errors);
}

export function checkPhasePlanArchitectureGate(text) {
  const errors = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const header = lines[i];
    if (!/^\|.*Phase.*\|.*Completion Gate.*\|/i.test(header)) continue;
    const sep = lines[i + 1] ?? "";
    if (!/^\|\s*-/.test(sep)) continue;

    const headerCells = header
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const gateIdx = headerCells.findIndex((c) => /Completion Gate/i.test(c));
    if (gateIdx === -1) continue;

    let rowNum = 0;
    for (let j = i + 2; j < lines.length; j += 1) {
      const row = lines[j];
      if (!/^\|/.test(row)) break;
      rowNum += 1;
      const cells = row
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      const gateCell = cells[gateIdx] ?? "";
      if (!/Architecture Pass/i.test(gateCell)) {
        errors.push(
          `phase plan row ${rowNum} (Phase ${cells[0] || "?"}) Completion Gate cell missing 'Architecture Pass'`,
        );
      }
    }

    // Only validate the first matching phase contract table
    return okResult(errors);
  }

  return okResult(errors);
}

async function readGitChangedFiles(root) {
  const status = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: root,
    encoding: "utf8",
  });

  if (status.status !== 0) {
    throw new Error(status.stderr || "git status --porcelain failed");
  }

  return status.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .map((file) => {
      const renameParts = file.split(" -> ");
      return normalizePathForCheck(renameParts.at(-1) ?? file);
    });
}

async function findExistingLedgers(root) {
  const runsDir = join(root, "docs", "ai-workflow", "runs");
  if (!existsSync(runsDir)) return [];

  async function collectLedgers(dir, relativeDir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const ledgers = [];

    for (const entry of entries) {
      const absolutePath = join(dir, entry.name);
      const relativePath = normalizePathForCheck(join(relativeDir, entry.name));
      if (entry.isDirectory()) {
        ledgers.push(...(await collectLedgers(absolutePath, relativePath)));
      } else if (LEDGER_PATTERN.test(relativePath)) {
        ledgers.push(relativePath);
      }
    }

    return ledgers;
  }

  return collectLedgers(runsDir, normalizePathForCheck(join("docs", "ai-workflow", "runs")));
}

async function fileExists(root, relativePath) {
  try {
    const stats = await stat(join(root, relativePath));
    return stats.isFile();
  } catch {
    return false;
  }
}

async function validateLedger(root, ledgerPath, errors) {
  if (!(await fileExists(root, ledgerPath))) {
    errors.push(`ledger path does not exist: ${ledgerPath}`);
    return;
  }

  const content = await readFile(join(root, ledgerPath), "utf8");
  for (const section of REQUIRED_LEDGER_SECTIONS) {
    if (!content.includes(section)) {
      errors.push(`ledger missing required section ${section}: ${ledgerPath}`);
    }
  }

  const reviewer = checkLedgerReviewer(content);
  if (!reviewer.ok) {
    for (const e of reviewer.errors) errors.push(`${ledgerPath}: ${e}`);
  }

  // "Untouched relevant docs" must have non-empty content.
  // Two valid shapes (see docs/ai-workflow/context-ledger-template.md):
  //   (A) same-line: "- Untouched relevant docs and reason: none"
  //   (B) header + indented bullets:
  //       "- Untouched relevant docs and reason:"
  //       "  - foo — reason"
  // Empty (header colon followed by blank/non-indented line) fails.
  const lines = content.split(/\r?\n/);
  let untouchedOk = false;
  let untouchedFound = false;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^\s*-?\s*Untouched relevant docs[^:]*:\s*(.*)$/i);
    if (!m) continue;
    untouchedFound = true;
    const inline = m[1].trim();
    if (inline.length > 0) {
      untouchedOk = true;
      break;
    }
    // look forward for indented bullets / non-empty content lines
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j];
      if (next.trim().length === 0) continue;
      // stop scan when next top-level item or new section starts
      if (/^##\s+/.test(next)) break;
      if (/^\S/.test(next)) break;   // non-indented → next field at same level
      // indented — but reject empty bullet markers like '  - ' or '  -'
      // (these can result from wholesale-copy of the template default).
      const indented = next.trim();
      if (/^-\s*$/.test(indented)) continue;  // empty bullet, keep scanning
      untouchedOk = true;
      break;
    }
    break;
  }
  if (!untouchedFound) {
    errors.push(
      `ledger ${ledgerPath}: missing 'Untouched relevant docs:' field (required per docs/agent-index.md §Output Requirement)`,
    );
  } else if (!untouchedOk) {
    errors.push(
      `ledger ${ledgerPath}: 'Untouched relevant docs:' field is empty (use 'none' or 'n/a' if intentional, or list with indented bullets)`,
    );
  }

  // Architecture Pass is required only for *phase* ledgers that have completed.
  // Non-phase complete ledgers (meta-workflow, docs-only, etc) are exempt.
  const isPhaseLedger = detectPhaseLedger(content, ledgerPath);
  const phaseComplete = isPhaseLedger && /Status:\s*complete/i.test(content);
  const arch = checkLedgerArchitecturePass(content, phaseComplete);
  if (!arch.ok) {
    for (const e of arch.errors) errors.push(`${ledgerPath}: ${e}`);
  }

  const ls = await checkLightSpecPresence(root, content, ledgerPath);
  if (!ls.ok) {
    for (const e of ls.errors) errors.push(`${ledgerPath}: ${e}`);
  }
}

// Resolves the phase Audience from the matching light spec.
// Returns: { found, audience, missingLightSpec, phaseNum }
// fail-closed: phase-N plan with no matching light spec is treated as an error.
async function resolvePlanAudienceFromLightSpec(root, planPath) {
  const m = planPath.match(PLAN_PHASE_PATTERN);
  if (!m) {
    return { found: false, audience: null, missingLightSpec: false, phaseNum: null };
  }
  const phaseNum = m[1];
  const lightSpecsDir = join(root, "docs", "ai-workflow", "light-specs");
  if (!existsSync(lightSpecsDir)) {
    return { found: false, audience: null, missingLightSpec: true, phaseNum };
  }
  const entries = await readdir(lightSpecsDir);
  const match = entries.find((e) =>
    new RegExp(`^phase-${phaseNum}[-_.]`).test(e),
  );
  if (!match) {
    return { found: false, audience: null, missingLightSpec: true, phaseNum };
  }
  const body = await readFile(join(lightSpecsDir, match), "utf8");
  return {
    found: true,
    audience: parseLightSpecAudience(body),
    missingLightSpec: false,
    phaseNum,
  };
}

async function validatePlanFile(root, planPath, errors) {
  // Templates and READMEs in the plans dir document the rules; skip them.
  if (PLAN_TEMPLATE_PATTERN.test(planPath)) return;

  if (!(await fileExists(root, planPath))) {
    errors.push(`plan path does not exist: ${planPath}`);
    return;
  }
  const content = await readFile(join(root, planPath), "utf8");

  // Cross-validate against the matching light spec (planning-contracts.md §1b + L64).
  // fail-closed: phase-N plan must have a matching docs/ai-workflow/light-specs/phase-N-*.md.
  const resolved = await resolvePlanAudienceFromLightSpec(root, planPath);
  if (resolved.missingLightSpec) {
    errors.push(
      `plan ${planPath}: references phase ${resolved.phaseNum} but no matching docs/ai-workflow/light-specs/phase-${resolved.phaseNum}-*.md exists (planning-contracts.md §1b)`,
    );
  }

  const result = checkPlanFile(content, planPath, {
    requireAudienceColumn: resolved.audience === "both",
  });
  if (!result.ok) {
    for (const e of result.errors) errors.push(e);
  }

  if (PHASE_PLAN_PATTERN.test(planPath)) {
    const r = checkPhasePlanArchitectureGate(content);
    if (!r.ok) {
      for (const e of r.errors) errors.push(`${planPath}: ${e}`);
    }
  }
}

function checkAgentSkillMirrors(root, errors) {
  const syncScript = join(root, "scripts", "sync-agent-skills.mjs");
  if (!existsSync(syncScript)) {
    return;
  }

  const result = spawnSync(process.execPath, [syncScript, "--check"], {
    cwd: root,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    errors.push(
      `agent skill mirrors are not in sync: ${output || "sync check failed"}`,
    );
  }
}

function needsLedger(changedFiles) {
  return changedFiles.some((file) => {
    const normalized = normalizePathForCheck(file);
    if (LEDGER_PATTERN.test(normalized)) return false;
    return IMPLEMENTATION_OR_WORKFLOW_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    );
  });
}

// UI changes detected? returns true when at least one non-test file matches
// a UI_CHANGE_PATTERN. PRs where ALL changed files are test-only are exempt.
function needsUxuiConsistencyPass(changedFiles) {
  const nonTestFiles = changedFiles.filter(
    (file) =>
      !UI_TEST_ONLY_PATTERNS.some((p) => p.test(normalizePathForCheck(file))),
  );
  return nonTestFiles.some((file) =>
    UI_CHANGE_PATTERNS.some((p) => p.test(normalizePathForCheck(file))),
  );
}

export async function checkRepositoryState({
  root = process.cwd(),
  changedFiles,
} = {}) {
  const resolvedRoot = resolve(root);
  const files = (changedFiles ?? (await readGitChangedFiles(resolvedRoot))).map(
    normalizePathForCheck,
  );
  const errors = [];
  const warnings = [];

  checkAgentSkillMirrors(resolvedRoot, errors);

  // Always validate any changed ledgers, regardless of whether implementation
  // files are also in the changeset. Ledger-only PRs must still meet new gates.
  const changedLedgers = files.filter((file) => LEDGER_PATTERN.test(file));
  const legacyLedgers = [];
  for (const file of files) {
    if (LEGACY_LEDGER_PATTERN.test(file) && (await fileExists(resolvedRoot, file))) {
      legacyLedgers.push(file);
    }
  }
  if (legacyLedgers.length > 0) {
    errors.push(
      "run ledgers must be saved under docs/ai-workflow/runs/YYYY/MM/DD/",
    );
  }
  for (const ledger of changedLedgers) {
    await validateLedger(resolvedRoot, ledger, errors);
  }

  // Always validate any changed plan files.
  const changedPlans = files.filter((file) => PLAN_FILE_PATTERN.test(file));
  for (const plan of changedPlans) {
    await validatePlanFile(resolvedRoot, plan, errors);
  }

  // Implementation/workflow changes additionally require that a ledger be in
  // the same change set.
  if (needsLedger(files)) {
    if (changedLedgers.length === 0) {
      errors.push(
        "implementation/config workflow changes require a run ledger in docs/ai-workflow/runs/YYYY/MM/DD/",
      );
    }
  }

  // UX/UI Consistency Pass — required when changed files match UI patterns
  // and not all changes are test-only. At least one changed ledger must
  // carry the 4-line evidence structure (parent + Tokens/Components/A11y/Responsive).
  if (needsUxuiConsistencyPass(files) && changedLedgers.length > 0) {
    let foundValidUxui = false;
    const uxuiErrors = [];
    for (const ledger of changedLedgers) {
      if (!(await fileExists(resolvedRoot, ledger))) continue;
      const lContent = await readFile(join(resolvedRoot, ledger), "utf8");
      const ux = checkUxuiConsistencyPass(lContent);
      if (ux.ok) {
        foundValidUxui = true;
        break;
      }
      for (const e of ux.errors) uxuiErrors.push(`${ledger}: ${e}`);
    }
    if (!foundValidUxui) {
      errors.push(
        "UI changes detected — at least one changed ledger must include valid UX/UI Consistency Pass evidence (parent field + Tokens/Components/A11y/Responsive sub-fields, all non-empty). See docs/ai-workflow/review-gates.md §UX/UI Consistency Pass",
      );
      for (const e of uxuiErrors) errors.push(e);
    }
  }

  // QA Gate (PR C — Enforcement) — required when changed files match UI patterns
  // (same detection as UX/UI Consistency Pass). At least one changed ledger must
  // carry a non-empty 'QA Gate:' field. 'degraded' alone is insufficient —
  // must include pipe-separated blocker/alternative/residual triple. Phase-complete
  // ledgers with degraded require explicit owner acceptance.
  if (needsUxuiConsistencyPass(files) && changedLedgers.length > 0) {
    let foundValidQa = false;
    const qaErrors = [];
    for (const ledger of changedLedgers) {
      if (!(await fileExists(resolvedRoot, ledger))) continue;
      const lContent = await readFile(join(resolvedRoot, ledger), "utf8");
      const phaseComplete =
        detectPhaseLedger(lContent, ledger) &&
        /Status:\s*complete/i.test(lContent);
      const qa = checkQaGate(lContent, { phaseComplete });
      if (qa.ok) {
        foundValidQa = true;
        break;
      }
      for (const e of qa.errors) qaErrors.push(`${ledger}: ${e}`);
    }
    if (!foundValidQa) {
      errors.push(
        "UI changes detected — at least one changed ledger must include valid 'QA Gate:' field (passed/failed/degraded with triple/skipped with reason). See docs/ai-workflow/review-gates.md §QA Gate. Past failure case: reports/phase-6-qa-gate-skipped-postmortem.html",
      );
      for (const e of qaErrors) errors.push(e);
    }
  }

  const existingLedgers = await findExistingLedgers(resolvedRoot);
  if (existingLedgers.length === 0) {
    warnings.push("no run ledgers found under docs/ai-workflow/runs/");
  }

  return okResult(errors, warnings);
}

async function readTextFile(path) {
  return readFile(resolve(path), "utf8");
}

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    prBodyPath: null,
    commitMessagePath: null,
    changedFilesPath: null,
    checkRepo: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--repo") {
      options.checkRepo = true;
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        options.root = next;
        index += 1;
      }
    } else if (arg === "--pr-body") {
      options.prBodyPath = argv[++index];
    } else if (arg === "--commit-message") {
      options.commitMessagePath = argv[++index];
    } else if (arg === "--changed-files") {
      options.changedFilesPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (
    !options.checkRepo &&
    !options.prBodyPath &&
    !options.commitMessagePath &&
    !options.help
  ) {
    options.checkRepo = true;
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/ai-workflow-check.mjs --repo .
  node scripts/ai-workflow-check.mjs --pr-body path/to/pr-body.md
  node scripts/ai-workflow-check.mjs --commit-message path/to/message.txt

Options can be combined. --changed-files accepts a newline-delimited file list for
repo checks; otherwise git status --porcelain is used.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const results = [];

  if (options.prBodyPath) {
    results.push({
      label: "pull request body",
      result: checkPullRequestBody(await readTextFile(options.prBodyPath)),
    });
  }

  if (options.commitMessagePath) {
    results.push({
      label: "commit message",
      result: checkCommitMessage(await readTextFile(options.commitMessagePath)),
    });
  }

  if (options.checkRepo) {
    let changedFiles;
    if (options.changedFilesPath) {
      changedFiles = (await readTextFile(options.changedFilesPath))
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    }

    results.push({
      label: "repository state",
      result: await checkRepositoryState({
        root: options.root,
        changedFiles,
      }),
    });
  }

  let exitCode = 0;
  for (const { label, result } of results) {
    if (result.ok) {
      console.log(`PASS ${label}`);
    } else {
      exitCode = 1;
      console.error(`FAIL ${label}`);
      for (const error of result.errors) {
        console.error(`- ${error}`);
      }
    }

    for (const warning of result.warnings ?? []) {
      console.warn(`WARN ${label}: ${warning}`);
    }
  }

  process.exitCode = exitCode;
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : "";
const currentPath = fileURLToPath(import.meta.url);
if (executedPath === currentPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export const internals = {
  REQUIRED_PR_SECTIONS,
  REQUIRED_GIT_DECISION_FIELDS,
  REQUIRED_LORE_TRAILERS,
  REQUIRED_LEDGER_SECTIONS,
  REQUIRED_PLAN_SECTIONS,
  AUDIENCE_FIELD_PATTERN,
  AUDIENCE_SECTION_PATTERN,
  UI_CHANGE_PATTERNS,
  UI_TEST_ONLY_PATTERNS,
  UXUI_PARENT_PATTERN,
  UXUI_CHILD_PATTERNS,
  QA_GATE_PATTERN,
  QA_GATE_DEGRADED_PATTERN,
  QA_GATE_DEGRADED_VALID_PATTERN,
  QA_GATE_DEGRADED_ACCEPTED_PATTERN,
  needsLedger,
  needsUxuiConsistencyPass,
  sectionContent,
};
