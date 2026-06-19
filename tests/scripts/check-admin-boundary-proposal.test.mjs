import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateAdminBoundaryProposal,
  formatAdminBoundaryProposalReport,
} from "../../scripts/check-admin-boundary-proposal.mjs";

let tempDirs = [];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "v13-admin-boundary-proposal-"));
  tempDirs.push(root);
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "tests"), { recursive: true });
  mkdirSync(join(root, "docs", "Wireframe"), { recursive: true });
  mkdirSync(join(root, "docs", "superpowers", "plans"), { recursive: true });
  mkdirSync(join(root, "docs", "sot-change-proposals"), { recursive: true });
  return root;
}

function write(root, relativePath, content) {
  const file = join(root, relativePath);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content, "utf8");
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("check-admin-boundary-proposal", () => {
  it("keeps the checked-in transfer proposal free of known mojibake markers", () => {
    const proposal = readFileSync(
      "docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md",
      "utf8",
    );

    expect(proposal).toContain("v13 is the user-facing app");
    expect(proposal).toContain("harness:admin-boundary:production");
    expect(proposal).toContain("--dispatch");
    expect(proposal).toContain("--require");
    expect(proposal).toContain("payment_history");
    expect(proposal).toContain("legal_documents");
    expect(proposal).toContain("profiles.nationality");
    expect(proposal).toContain("admin_list_audit_logs");
    expect(proposal).toContain("admin_set_admin_app_role");
    expect(proposal).toContain("admin_list_admin_app_roles");
    expect(proposal).toContain("migration baseline squash");
    expect(proposal).toContain("historical admin migration quarantine");
    expect(proposal).toContain("future admin SQL changes must be authored in topik-ai");
    expect(proposal).not.toMatch(/[�諛뚮뺤援섏寃湲嫄紐]/);
  });

  it("passes when the proposal covers every active-doc warning term", () => {
    const root = createTempRoot();
    write(root, "docs/Wireframe/data-usage-index.md", "admin_update_problem get_admin_users");
    write(
      root,
      "docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md",
      [
        "v13 topik-ai production",
        "notification_delivery_attempts",
        "check:migration-boundary",
        "harness:admin-boundary",
        "harness:admin-boundary:production",
        "--dispatch",
        "--require",
        "subscription_plans",
        "subscriptions",
        "payment_history",
        "legal_documents",
        "user_consents",
        "profiles.nationality",
        "admin_audit_logs",
        "admin_list_audit_logs",
        "admin_set_admin_app_role",
        "admin_list_admin_app_roles",
        "admin_set_user_status",
        "admin_update_problem",
        "get_admin_users",
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
      ].join("\n"),
    );

    const result = evaluateAdminBoundaryProposal({ rootDir: root });

    expect(result.failures).toEqual([]);
    expect(result.coveredTerms).toEqual(["admin_update_problem", "get_admin_users"]);
    expect(formatAdminBoundaryProposalReport(result)).toContain("PASS");
  });

  it("fails when active-doc warnings are not covered by the proposal", () => {
    const root = createTempRoot();
    write(root, "docs/Wireframe/data-usage-index.md", "admin_update_problem");
    write(
      root,
      "docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md",
      "v13 topik-ai production notification_delivery_attempts check:migration-boundary harness:admin-boundary harness:admin-boundary:production --dispatch --require",
    );

    const result = evaluateAdminBoundaryProposal({ rootDir: root });

    expect(result.failures).toContain(
      "Proposal does not cover active-doc warning term: admin_update_problem",
    );
  });

  it("fails when the proposal is missing required transfer context", () => {
    const root = createTempRoot();
    write(root, "docs/Wireframe/data-usage-index.md", "admin_update_problem");
    write(
      root,
      "docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md",
      "admin_update_problem",
    );

    const result = evaluateAdminBoundaryProposal({ rootDir: root });

    expect(result.failures).toContain("Proposal is missing required context term: topik-ai");
    expect(result.failures).toContain("Proposal is missing required context term: --dispatch");
    expect(result.failures).toContain("Proposal is missing required context term: payment_history");
    expect(result.failures).toContain("Proposal is missing required context term: admin_set_admin_app_role");
    expect(result.failures).toContain("Proposal is missing required context term: system_logs");
    expect(result.failures).toContain("Proposal is missing required context term: migration baseline squash");
    expect(result.failures).toContain("Proposal is missing required context term: future admin SQL changes must be authored in topik-ai");
    expect(formatAdminBoundaryProposalReport(result)).toContain("FAIL");
  });
});
