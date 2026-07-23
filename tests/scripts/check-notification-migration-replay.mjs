#!/usr/bin/env node

// Kept under tests so the repository's trusted production-script allowlist stays immutable.
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const RETIRED_UP_MIGRATIONS = [
  "20260612180000_notification_dispatcher.sql",
  "20260612180100_register_notification_cron.sql",
  "20260612190000_notification_email_pipeline.sql",
  "20260612190100_email_transport_fail_user.sql",
  "20260612190200_email_live_defer.sql",
  "20260612200100_marketing_consent_in_dispatch.sql",
];
const RETIRED_DOWN_MIGRATIONS = [
  "20260612190000_notification_email_pipeline.sql",
  "20260612190100_email_transport_fail_user.sql",
  "20260612190200_email_live_defer.sql",
  "20260612200100_marketing_consent_in_dispatch.sql",
];
const RETIREMENT_MARKER = "notification pipeline migration home: topik-ai";
const ALLOWED_NOTICE_ONLY_SQL = [
  "do $notification_pipeline_replay$",
  "begin",
  "raise notice 'notification pipeline replay skipped; canonical migration home is topik-ai';",
  "end",
  "$notification_pipeline_replay$;",
].join(" ");

function withoutSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/--.*$/gmu, "");
}

function normalizeExecutableSql(sql) {
  return withoutSqlComments(sql).trim().replace(/\s+/gu, " ");
}

function inspectMigration(rootDir, relativePath) {
  const sql = readFileSync(path.join(rootDir, relativePath), "utf8");
  const failures = [];
  if (!sql.includes(RETIREMENT_MARKER)) {
    failures.push(`${relativePath} must declare the topik-ai migration home.`);
  }
  if (normalizeExecutableSql(sql) !== ALLOWED_NOTICE_ONLY_SQL) {
    failures.push(`${relativePath} must be a replay-safe no-op after ownership transfer.`);
  }
  return failures;
}

export function evaluateNotificationMigrationReplay({ rootDir = ROOT } = {}) {
  const failures = [];
  for (const file of RETIRED_UP_MIGRATIONS) {
    failures.push(...inspectMigration(rootDir, path.join("supabase", "migrations", file)));
  }
  for (const file of RETIRED_DOWN_MIGRATIONS) {
    failures.push(...inspectMigration(rootDir, path.join("supabase", "migrations", "down", file)));
  }
  return { failures };
}

export function formatNotificationMigrationReplayReport(result) {
  if (result.failures.length === 0) {
    return "[notification-migration-replay] PASS: retired v13 pipeline migrations are replay-safe no-ops.";
  }
  return [
    "[notification-migration-replay] FAIL:",
    ...result.failures.map((failure) => `- ${failure}`),
  ].join("\n");
}

function main() {
  const result = evaluateNotificationMigrationReplay();
  const report = formatNotificationMigrationReplayReport(result);
  if (result.failures.length > 0) {
    console.error(report);
    process.exit(1);
  }
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
