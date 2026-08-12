import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDir).find((name) =>
  name.endsWith("_consent_account_deletion_rls.sql"),
);
const migrationPath = migrationName
  ? join(migrationsDir, migrationName)
  : join(migrationsDir, "__missing_consent_account_deletion_rls.sql");
const sql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";

describe("consent and account-deletion RLS hardening migration", () => {
  it("removes direct authenticated consent inserts", () => {
    expect(migrationName).toBeTruthy();
    expect(sql).toMatch(
      /drop policy if exists user_consents_owner_insert on public\.user_consents/i,
    );
    expect(sql).toMatch(
      /create policy user_consents_no_direct_insert[\s\S]*for insert to authenticated[\s\S]*with check \(false\)/i,
    );
    expect(sql).toMatch(
      /revoke insert on table public\.user_consents from authenticated/i,
    );
  });

  it("defines a locked-down active-user helper and applies it to private rows", () => {
    expect(sql).toMatch(
      /create or replace function private\.is_active_user\(\)[\s\S]*security definer[\s\S]*set search_path = pg_catalog, public/i,
    );
    expect(sql).toMatch(
      /revoke all on function private\.is_active_user\(\) from public, anon/i,
    );
    expect(sql).toMatch(
      /grant execute on function private\.is_active_user\(\) to authenticated/i,
    );

    for (const table of [
      "profiles",
      "learning_goals",
      "problem_attempts",
      "writing_drafts",
      "writing_submissions",
      "writing_feedback",
      "feedback_dimension_scores",
      "sentence_feedback",
      "comparison_reports",
      "recommendation_runs",
      "recommendation_items",
      "library_items",
      "study_events",
      "export_files",
      "subscriptions",
      "payment_history",
      "notification_settings",
      "notification_log",
      "user_consents",
      "user_notifications",
      "user_marketing_consent",
      "pdf_export_quota_usages",
      "pdf_export_quota_resets",
      "pdf_export_quota_reset_targets",
      "writing_submission_metrics",
    ]) {
      expect(sql).toContain(`on public.${table}`);
    }
    expect(sql).not.toMatch(/on public\.(organizations|org_members|assignments|assignment_submissions)/i);
    expect(sql.match(/as restrictive/gi)?.length).toBeGreaterThanOrEqual(25);
  });

  it("keeps published public catalog reads while deleted JWTs lose private catalog paths", () => {
    expect(sql).toMatch(
      /create policy problems_active_or_public_select[\s\S]*as restrictive for select to authenticated[\s\S]*publish_status = 'published'[\s\S]*visibility = 'public'[\s\S]*private\.is_active_user\(\)/i,
    );
    expect(sql).toMatch(
      /create policy problems_active_insert[\s\S]*as restrictive for insert to authenticated[\s\S]*private\.is_active_user\(\)/i,
    );
    expect(sql).toMatch(
      /create policy problems_active_update[\s\S]*as restrictive for update to authenticated[\s\S]*private\.is_active_user\(\)/i,
    );
    expect(sql).toMatch(
      /create policy problems_active_delete[\s\S]*as restrictive for delete to authenticated[\s\S]*private\.is_active_user\(\)/i,
    );
    expect(sql).toMatch(
      /create policy problem_assets_active_or_public_select[\s\S]*as restrictive for select to authenticated[\s\S]*publish_status = 'published'[\s\S]*visibility = 'public'[\s\S]*private\.is_active_user\(\)/i,
    );
    for (const action of ["insert", "update", "delete"]) {
      expect(sql).toMatch(
        new RegExp(
          `create policy problem_assets_active_${action}[\\s\\S]*as restrictive for ${action} to authenticated[\\s\\S]*private\\.is_active_user\\(\\)`,
          "i",
        ),
      );
    }
  });

  it("guards every audited user-data SECURITY DEFINER RPC and revokes the stale submit RPC", () => {
    expect(sql).toMatch(
      /create or replace function private\.assert_active_user\(\)[\s\S]*account_inactive[\s\S]*42501/i,
    );

    for (const functionName of [
      "get_dashboard_kpi",
      "get_writing_submission_history_context",
      "replace_stale_writing_draft",
      "create_comparison_report_with_metrics",
      "claim_pdf_export_quota",
      "is_nickname_available",
      "list_user_library_problem_items",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `create or replace function public\\.${functionName}\\([\\s\\S]*?as \\$\\$[\\s\\S]*?perform private\\.assert_active_user\\(\\)[\\s\\S]*?\\$\\$;`,
          "i",
        ),
      );
    }

    expect(sql).toMatch(
      /revoke execute on function public\.submit_writing_with_feedback\(jsonb, jsonb, jsonb, jsonb\)[\s\S]{0,20}from authenticated/i,
    );
    expect(sql).not.toMatch(
      /revoke execute on function public\.list_user_library_problem_items\(\)\s+from authenticated/i,
    );
    expect(sql).toMatch(
      /create or replace function public\.list_user_library_problem_items\(\)[\s\S]*returns table \(\s*item_id uuid,\s*problem_id uuid,\s*title text,\s*question_no smallint,\s*answer_text text,\s*tags text\[\],\s*saved_at timestamptz,\s*availability_status text,\s*availability_reason text,\s*can_retry boolean\s*\)/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.list_user_library_problem_items\(\)\s+to authenticated/i,
    );
  });

  it("revokes every moved implementation by its post-rename private name", () => {
    const normalizedSql = sql
      .replace(/\s+/g, " ")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")");
    const movedFunctions = [
      ["get_dashboard_kpi", ""],
      ["get_writing_submission_history_context", "uuid[]"],
      ["replace_stale_writing_draft", "uuid, text, bigint, text"],
      [
        "create_comparison_report_with_metrics",
        "uuid, uuid, jsonb, text, text",
      ],
      ["claim_pdf_export_quota", "uuid, uuid[]"],
      ["is_nickname_available", "text"],
      ["list_user_library_problem_items", ""],
    ] as const;

    for (const [name, signature] of movedFunctions) {
      const oldCall = `private.${name}(${signature})`;
      const renamedCall = `private.${name}_unchecked(${signature})`;
      expect(normalizedSql).toContain(
        `alter function ${oldCall} rename to ${name}_unchecked; revoke all on function ${renamedCall}`,
      );
      expect(normalizedSql).not.toContain(
        `rename to ${name}_unchecked; revoke all on function ${oldCall}`,
      );
    }
  });

  it("makes avatars private and gates owner storage access", () => {
    expect(sql).toMatch(
      /update storage\.buckets[\s\S]*set public = false[\s\S]*where id = 'avatars'/i,
    );
    expect(sql).toMatch(
      /drop policy if exists avatars_public_read on storage\.objects/i,
    );
    expect(sql).toMatch(
      /create policy avatars_owner_select[\s\S]*for select to authenticated[\s\S]*private\.is_active_user\(\)/i,
    );
    for (const policy of [
      "avatars_owner_insert",
      "avatars_owner_update",
      "avatars_owner_delete",
      "exports_owner_select",
      "exports_owner_insert",
      "exports_owner_delete",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `create policy ${policy}[\\s\\S]*?private\\.is_active_user\\(\\)`,
          "i",
        ),
      );
    }
    expect(sql).not.toMatch(/create policy avatars_public_read/i);
  });

  it("allows status and deleted_at changes only through the idempotent deletion RPC", () => {
    expect(sql).toMatch(
      /revoke update on table public\.profiles from authenticated[\s\S]*grant update \([\s\S]*display_name[\s\S]*\) on table public\.profiles to authenticated/i,
    );
    expect(sql).toMatch(
      /create or replace function private\.protect_profile_columns\(\)[\s\S]*security invoker[\s\S]*current_user <> pg_get_userbyid[\s\S]*profiles\.status and profiles\.deleted_at can only be changed by account lifecycle RPCs/i,
    );
    expect(sql).toMatch(
      /create or replace function public\.request_account_deletion\(\)[\s\S]*security definer[\s\S]*status = 'active'[\s\S]*deleted_at is null/i,
    );
    expect(sql).not.toMatch(/app\.request_account_deletion|set_config\('app\.request_account_deletion'/i);
  });

  it("exposes only the caller account status through the account-state RPC", () => {
    expect(sql).toMatch(
      /create or replace function public\.get_my_account_state\(\)[\s\S]*returns text[\s\S]*security definer/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.get_my_account_state\(\) to authenticated/i,
    );
    expect(sql).not.toMatch(
      /get_my_account_state\(\)[\s\S]*returns[\s\S]{0,80}deleted_at/i,
    );
  });
});
