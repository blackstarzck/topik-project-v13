#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateAdminBoundary } from "./check-admin-boundary.mjs";

const ROOT = process.cwd();
const PROPOSAL_PATH =
  "docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md";
const REQUIRED_CONTEXT_TERMS = [
  "v13",
  "topik-ai",
  "notification_delivery_attempts",
  "check:migration-boundary",
  "harness:admin-boundary",
  "harness:admin-boundary:production",
  "--dispatch",
  "--require",
  "production",
  "subscription_plans",
  "subscriptions",
  "payment_history",
  "legal_documents",
  "user_consents",
  "profiles.nationality",
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
  "migration baseline squash",
  "historical admin migration quarantine",
  "future admin SQL changes must be authored in topik-ai",
];

function fileExists(relativePath, rootDir = ROOT) {
  try {
    return statSync(path.join(rootDir, relativePath)).isFile();
  } catch {
    return false;
  }
}

function readText(relativePath, rootDir = ROOT) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function unique(values) {
  return [...new Set(values)].sort();
}

export function evaluateAdminBoundaryProposal({ rootDir = ROOT } = {}) {
  const failures = [];
  if (!fileExists(PROPOSAL_PATH, rootDir)) {
    return {
      failures: [`Missing admin ownership transfer proposal: ${PROPOSAL_PATH}`],
      coveredTerms: [],
      expectedTerms: [],
    };
  }

  const proposal = readText(PROPOSAL_PATH, rootDir);
  const boundary = evaluateAdminBoundary({ rootDir });
  const expectedTerms = unique(boundary.docWarnings.map((warning) => warning.term));

  for (const term of expectedTerms) {
    if (!proposal.includes(term)) {
      failures.push(`Proposal does not cover active-doc warning term: ${term}`);
    }
  }

  for (const term of REQUIRED_CONTEXT_TERMS) {
    if (!proposal.includes(term)) {
      failures.push(`Proposal is missing required context term: ${term}`);
    }
  }

  return {
    failures,
    coveredTerms: expectedTerms.filter((term) => proposal.includes(term)),
    expectedTerms,
  };
}

export function formatAdminBoundaryProposalReport(result) {
  if (result.failures.length > 0) {
    return [
      "[admin-boundary-proposal] FAIL: transfer proposal does not cover the current active-doc warnings.",
      ...result.failures.map((failure) => `- ${failure}`),
    ].join("\n");
  }

  return [
    "[admin-boundary-proposal] PASS: transfer proposal covers all active-doc warning terms.",
    ...result.coveredTerms.map((term) => `- ${term}`),
  ].join("\n");
}

function main() {
  const result = evaluateAdminBoundaryProposal();
  const report = formatAdminBoundaryProposalReport(result);
  if (result.failures.length > 0) {
    console.error(report);
    process.exit(1);
  }
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
