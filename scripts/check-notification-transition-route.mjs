#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const TRANSITION_ROUTE_PATH = "/api/notifications/dispatch-email";
const TRANSITION_ROUTE_KEY = "apiNotificationsDispatchEmail";
const TRANSITION_ROUTE_ID = "api-notifications-dispatch-email";
const SCAN_DIRS = ["src", "tests"];

const ALLOWED_REFERENCES = new Set([
  "src/app/api/notifications/dispatch-email/route.ts",
  "src/lib/routes.ts",
  "tests/scripts/check-admin-boundary.test.mjs",
  "tests/scripts/check-notification-transition-route.test.mjs",
]);

const SKIP_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "playwright-report",
  "test-results",
]);

function normalize(relativeFile) {
  return relativeFile.split(path.sep).join("/");
}

function walkFiles(relativeDir, rootDir = ROOT) {
  const absolute = path.join(rootDir, relativeDir);
  const files = [];
  let entries;
  try {
    entries = readdirSync(absolute, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...walkFiles(path.join(relativeDir, entry.name), rootDir));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|md|mdx)$/.test(entry.name)) continue;
    files.push(normalize(path.join(relativeDir, entry.name)));
  }

  return files;
}

function readText(relativeFile, rootDir = ROOT) {
  return readFileSync(path.join(rootDir, relativeFile), "utf8");
}

function findTransitionReferences(relativeFile, text) {
  return [TRANSITION_ROUTE_PATH, TRANSITION_ROUTE_KEY, TRANSITION_ROUTE_ID]
    .filter((term) => text.includes(term))
    .map((term) => ({ file: normalize(relativeFile), term }));
}

export function evaluateNotificationTransitionRoute({ rootDir = ROOT } = {}) {
  const files = SCAN_DIRS.flatMap((dir) => walkFiles(dir, rootDir));
  const hits = files.flatMap((file) => {
    let text;
    try {
      text = readText(file, rootDir);
    } catch {
      return [];
    }
    return findTransitionReferences(file, text);
  });

  const unexpectedCallers = hits.filter((hit) => !ALLOWED_REFERENCES.has(hit.file));
  const allowedEvidence = hits.filter((hit) => ALLOWED_REFERENCES.has(hit.file));

  return { unexpectedCallers, allowedEvidence };
}

export function formatNotificationTransitionRouteReport(result) {
  const lines = [];
  if (result.unexpectedCallers.length > 0) {
    lines.push("[notification-transition-route] FAIL: unexpected v13 caller/reference found.");
    for (const hit of result.unexpectedCallers) {
      lines.push(`- ${hit.file}: ${hit.term}`);
    }
    lines.push("Move worker invocation to topik-ai or approve the transition in docs/prd.md.");
    return lines.join("\n");
  }

  lines.push("[notification-transition-route] PASS: no v13 app/client caller references the transition email worker.");
  if (result.allowedEvidence.length > 0) {
    lines.push("[notification-transition-route] Allowed transition evidence:");
    for (const hit of result.allowedEvidence) {
      lines.push(`- ${hit.file}: ${hit.term}`);
    }
  }
  return lines.join("\n");
}

function main() {
  const result = evaluateNotificationTransitionRoute();
  const report = formatNotificationTransitionRouteReport(result);
  if (result.unexpectedCallers.length > 0) {
    console.error(report);
    process.exit(1);
  }
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
