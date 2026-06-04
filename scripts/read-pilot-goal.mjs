#!/usr/bin/env node
// Parse the machine-derivable §Goal block from docs/ui-redesign/PLAN.md so the
// DOCUMENT ALONE sets the goal (objective / in.files / in.routes / out.absolute
// / done) — no human goal-setting, and not an agent self-report: real tooling
// consumes it. Notably M1 (dev-route-smoke) auto-sources its pilot smoke routes
// from here. No YAML dependency — the block has a small, stable shape.
//
// PLAN.md §Goal is the source of truth; to retarget (e.g. next cluster) edit the
// block's in.routes/in.files and every consumer follows automatically.
//
// CLI:  node scripts/read-pilot-goal.mjs           # prints JSON
//       node scripts/read-pilot-goal.mjs --routes  # prints "/login,/dashboard"
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PLAN_REL = "docs/ui-redesign/PLAN.md";

// First ```yaml fenced block following a "## Goal" heading.
export function extractGoalYaml(md) {
  const m = String(md).match(/##\s+Goal[\s\S]*?```yaml\n([\s\S]*?)\n```/);
  return m ? m[1] : null;
}

// `key: ["a", "b"]` → ["a","b"].
function inlineArray(text, key) {
  const m = text.match(new RegExp(`\\b${key}:\\s*\\[([^\\]]*)\\]`));
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

// `- item` entries nested under `key:` (deeper indent); stops on dedent.
function nestedList(text, key) {
  const lines = text.split(/\r?\n/);
  // Key line may carry a trailing `# comment`.
  const ki = lines.findIndex((l) =>
    new RegExp(`^(\\s*)${key}:\\s*(?:#.*)?$`).test(l),
  );
  if (ki === -1) return [];
  const keyIndent = (lines[ki].match(/^(\s*)/) || ["", ""])[1].length;
  const items = [];
  for (let i = ki + 1; i < lines.length; i += 1) {
    const l = lines[i];
    if (l.trim() === "") continue;
    const indent = (l.match(/^(\s*)/) || ["", ""])[1].length;
    if (indent <= keyIndent) break;
    // List item, optional surrounding quotes, optional trailing `# comment`.
    const m = l.match(/^\s*-\s*["']?(.*?)["']?\s*(?:#.*)?$/);
    if (!m) break;
    if (m[1]) items.push(m[1]);
  }
  return items;
}

// Pure: parse a PLAN.md markdown string → goal object (or null). Exported for tests.
export function parsePilotGoal(md) {
  const yaml = extractGoalYaml(md);
  if (!yaml) return null;
  return {
    in: { files: nestedList(yaml, "files"), routes: inlineArray(yaml, "routes") },
    out: { absolute: nestedList(yaml, "absolute") },
    done: nestedList(yaml, "done"),
  };
}

export function readPilotGoal(root = process.cwd()) {
  return parsePilotGoal(readFileSync(join(root, PLAN_REL), "utf8"));
}

export function readPilotGoalRoutes(root = process.cwd()) {
  const g = readPilotGoal(root);
  return g && Array.isArray(g.in.routes) ? g.in.routes : [];
}

const isMain =
  process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("read-pilot-goal.mjs");
if (isMain) {
  const goal = readPilotGoal();
  if (!goal) {
    process.stderr.write(`no §Goal yaml block found in ${PLAN_REL}\n`);
    process.exit(1);
  }
  if (process.argv[2] === "--routes") process.stdout.write(goal.in.routes.join(","));
  else process.stdout.write(`${JSON.stringify(goal, null, 2)}\n`);
}
