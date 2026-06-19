#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const REMOVED_ADMIN_ISLAND_TERMS = [
  "admin_update_problem",
  "admin_delete_problem",
  "admin_add_problem_asset",
  "admin_remove_problem_asset",
  "admin_toggle_problem_publish",
  "admin_change_user_role",
  "get_admin_user_stats",
  "get_admin_audit_logs",
  "get_admin_org_dashboard",
  "organizations",
  "org_members",
  "assignments",
  "assignment_submissions",
  "is_org_member",
  "is_org_manager",
];

const TOPIK_AI_ADMIN_TERMS = [
  "get_admin_users",
  "admin_set_user_status",
  "admin_list_audit_logs",
  "admin_set_admin_app_role",
  "admin_list_admin_app_roles",
  "admin_audit_logs",
  "notification_templates",
  "notification_groups",
  "notification_dispatches",
  "operation_notices",
  "operation_faqs",
  "operation_faq_curations",
  "operation_faq_metrics",
  "operation_events",
  "operation_policies",
  "operation_policy_histories",
  "community_posts",
  "community_post_admin_notes",
  "community_reports",
  "commerce_point_policies",
  "commerce_point_ledgers",
  "commerce_point_expirations",
  "commerce_coupons",
  "commerce_coupon_subscription_templates",
  "commerce_refunds",
  "system_metadata_groups",
  "system_metadata_group_items",
  "system_logs",
];

const SHARED_ALLOWED_TERMS = [
  "notification_delivery_attempts",
  "notification_settings",
  "user_notifications",
  "user_marketing_consent",
];

const ALLOWED_CODE_REFERENCES = new Map([
  [
    "src/app/api/notifications/dispatch-email/route.ts",
    new Set([
      // Transition endpoint retained until topik-ai production cron and real
      // attempt state transitions are verified.
      "notification_templates",
      "notification_groups",
      "notification_dispatches",
    ]),
  ],
  [
    "src/lib/events/study-events.ts",
    new Set([
      // Historical PII rationale explaining why old org-admin dashboard payloads
      // must never include learner writing bodies.
      "get_admin_org_dashboard",
    ]),
  ],
  [
    "src/lib/supabase/types.ts",
    new Set([
      // Generated/manual snapshot comments record removed Phase 6 admin RPCs.
      "admin_toggle_problem_publish",
      "admin_change_user_role",
      "get_admin_org_dashboard",
      // Historical Phase 6 type snapshot remains until a dedicated Supabase
      // type regeneration/removal pass. Runtime admin ownership is topik-ai.
      "admin_audit_logs",
    ]),
  ],
  [
    "tests/lib/supabase/phase-6-types.test.ts",
    new Set([
      // Regression assertion documents that these RPCs were removed from v13.
      "admin_toggle_problem_publish",
      "admin_change_user_role",
      "get_admin_org_dashboard",
      // Historical type regression only; v13 app code must not use this admin
      // audit sink after the topik-ai ownership transfer.
      "admin_audit_logs",
    ]),
  ],
  [
    "tests/scripts/check-admin-boundary.test.mjs",
    new Set([
      // The boundary checker's own fixture strings intentionally include
      // forbidden terms to prove the checker fails on real regressions.
      "admin_update_problem",
      "get_admin_users",
      "notification_templates",
      "notification_dispatches",
      "operation_faqs",
      "commerce_coupons",
      "system_metadata_groups",
      "admin_audit_logs",
    ]),
  ],
  [
    "tests/scripts/check-admin-boundary-proposal.test.mjs",
    new Set([
      // Proposal coverage fixture strings intentionally include warning terms
      // to prove every active-doc warning must be covered by the proposal.
      "admin_update_problem",
      "get_admin_users",
      "admin_set_user_status",
      "admin_audit_logs",
      "notification_templates",
      "notification_groups",
      "notification_dispatches",
      "admin_list_audit_logs",
      "admin_set_admin_app_role",
      "admin_list_admin_app_roles",
      "operation_notices",
      "operation_faqs",
      "operation_faq_curations",
      "operation_faq_metrics",
      "operation_events",
      "operation_policies",
      "operation_policy_histories",
      "community_posts",
      "community_post_admin_notes",
      "community_reports",
      "commerce_point_policies",
      "commerce_point_ledgers",
      "commerce_point_expirations",
      "commerce_coupons",
      "commerce_coupon_subscription_templates",
      "commerce_refunds",
      "system_metadata_groups",
      "system_metadata_group_items",
      "system_logs",
    ]),
  ],
]);

const CODE_DIRS = ["src", "tests"];
const DOC_FILES_TO_WARN = [
  "docs/Wireframe/data-usage-index.md",
  "docs/ia.md",
  "docs/superpowers/plans/2026-06-17-talkpik-qa-notification-remediation-plan.md",
];

const SKIP_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "playwright-report",
  "test-results",
]);

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
    files.push(path.join(relativeDir, entry.name));
  }
  return files;
}

function readText(relativeFile, rootDir = ROOT) {
  return readFileSync(path.join(rootDir, relativeFile), "utf8");
}

export function findTermsInText(relativeFile, text, terms) {
  const file = normalizeRelative(relativeFile);
  return terms
    .filter((term) => text.includes(term))
    .map((term) => ({ file, term }));
}

function findTerms(relativeFile, terms, rootDir = ROOT) {
  let text;
  try {
    text = readText(relativeFile, rootDir);
  } catch {
    return [];
  }
  return findTermsInText(relativeFile, text, terms);
}

function normalizeRelative(relativeFile) {
  return relativeFile.split(path.sep).join("/");
}

function isAllowedCodeReference(hit) {
  const allowed = ALLOWED_CODE_REFERENCES.get(normalizeRelative(hit.file));
  return allowed?.has(hit.term) ?? false;
}

function fileExists(relativeFile, rootDir = ROOT) {
  try {
    return statSync(path.join(rootDir, relativeFile)).isFile();
  } catch {
    return false;
  }
}

export function evaluateAdminBoundary({ rootDir = ROOT } = {}) {
  const codeFiles = CODE_DIRS.flatMap((dir) => walkFiles(dir, rootDir));
  const codeFailures = codeFiles
    .flatMap((file) =>
      findTerms(file, [...REMOVED_ADMIN_ISLAND_TERMS, ...TOPIK_AI_ADMIN_TERMS], rootDir),
    )
    .filter((hit) => !isAllowedCodeReference(hit));

  const docWarnings = DOC_FILES_TO_WARN.filter((file) => fileExists(file, rootDir)).flatMap((file) =>
    findTerms(file, [...REMOVED_ADMIN_ISLAND_TERMS, ...TOPIK_AI_ADMIN_TERMS], rootDir),
  );

  const sharedEvidence = codeFiles.flatMap((file) =>
    findTerms(file, SHARED_ALLOWED_TERMS, rootDir),
  );

  return { codeFailures, docWarnings, sharedEvidence };
}

export function formatAdminBoundaryReport(result) {
  const lines = [];
  if (result.codeFailures.length > 0) {
    lines.push("[admin-boundary] FAIL: v13 code/tests reference admin-owned objects.");
    for (const hit of result.codeFailures) {
      lines.push(`- ${hit.file}: ${hit.term}`);
    }
    lines.push(
      "Move admin management to topik-ai or document a new SOT-approved exception before using these objects in v13.",
    );
    return lines.join("\n");
  }

  lines.push("[admin-boundary] PASS: v13 code/tests do not reference removed or topik-ai-owned admin objects.");

  if (result.sharedEvidence.length > 0) {
    lines.push("[admin-boundary] Shared user-facing objects still referenced as expected:");
    for (const hit of result.sharedEvidence) {
      lines.push(`- ${hit.file}: ${hit.term}`);
    }
  }

  if (result.docWarnings.length > 0) {
    lines.push(
      "[admin-boundary] WARN: active docs still mention removed/topik-ai admin terms. Track via docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md before editing active SOT.",
    );
    for (const hit of result.docWarnings) {
      lines.push(`- ${hit.file}: ${hit.term}`);
    }
  }

  return lines.join("\n");
}

function main() {
  const result = evaluateAdminBoundary();
  const report = formatAdminBoundaryReport(result);
  if (result.codeFailures.length > 0) {
    console.error(report);
    process.exit(1);
  }
  if (result.docWarnings.length > 0) {
    console.warn(report);
    return;
  }
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
