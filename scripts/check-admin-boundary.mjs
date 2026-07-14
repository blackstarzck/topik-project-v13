#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
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

const ALLOWED_SOURCE_REFERENCES = new Map([
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
    "src/app/terms/page.tsx",
    new Set([
      // Documentation-only reference. The comment explains that admin publishes
      // policies via operation_policies which are projected into the v13-owned
      // legal_documents table; this page reads legal_documents only (no direct
      // admin table access). See the product boundary in docs/prd.md.
      "operation_policies",
    ]),
  ],
  [
    "src/components/legal/TermsDocument.tsx",
    new Set([
      // Documentation-only reference explaining the admin operation_policies ->
      // v13 legal_documents projection. The renderer consumes doc.body from
      // legal_documents; it never queries operation_policies. See docs/prd.md.
      "operation_policies",
    ]),
  ],
  [
    "src/lib/legal/documents.ts",
    new Set([
      // Documentation-only reference. All queries here target legal_documents
      // (the user-facing projection of admin operation_policies); v13 has
      // read-only access and never touches operation_policies directly. See docs/prd.md.
      "operation_policies",
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
]);

const SOURCE_DIRS = ["src"];

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

function isAllowedSourceReference(hit) {
  const allowed = ALLOWED_SOURCE_REFERENCES.get(normalizeRelative(hit.file));
  return allowed?.has(hit.term) ?? false;
}

export function evaluateAdminBoundary({ rootDir = ROOT } = {}) {
  const sourceFiles = SOURCE_DIRS.flatMap((dir) => walkFiles(dir, rootDir));
  const termFailures = sourceFiles
    .flatMap((file) =>
      findTerms(
        file,
        [...REMOVED_ADMIN_ISLAND_TERMS, ...TOPIK_AI_ADMIN_TERMS],
        rootDir,
      ),
    )
    .filter((hit) => !isAllowedSourceReference(hit));
  const routeFailures = sourceFiles.flatMap((file) => {
    const normalizedFile = normalizeRelative(file);
    const isAdminRouteFile =
      /^src\/app\/(?:.*\/)?(?:admin|\(admin\))(?:\/|$)/iu.test(normalizedFile);
    const exposesAdminRoute =
      normalizedFile === "src/lib/routes.ts" &&
      /["'`]\/admin(?:\/|["'`])/iu.test(readText(file, rootDir));
    return isAdminRouteFile || exposesAdminRoute
      ? [{ file: normalizedFile, term: "admin route" }]
      : [];
  });
  const codeFailures = [...routeFailures, ...termFailures];

  const sharedEvidence = sourceFiles.flatMap((file) =>
    findTerms(file, SHARED_ALLOWED_TERMS, rootDir),
  );

  return { codeFailures, sharedEvidence };
}

export function formatAdminBoundaryReport(result) {
  const lines = [];
  if (result.codeFailures.length > 0) {
    lines.push(
      "[admin-boundary] FAIL: v13 source references admin-owned objects.",
    );
    for (const hit of result.codeFailures) {
      lines.push(`- ${hit.file}: ${hit.term}`);
    }
    lines.push(
      "Move admin management to topik-ai or approve the product boundary in docs/prd.md before using these objects in v13.",
    );
    return lines.join("\n");
  }

  lines.push(
    "[admin-boundary] PASS: v13 source does not reference removed or topik-ai-owned admin objects.",
  );

  if (result.sharedEvidence.length > 0) {
    lines.push(
      "[admin-boundary] Shared user-facing objects still referenced as expected:",
    );
    for (const hit of result.sharedEvidence) {
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
  console.log(report);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
