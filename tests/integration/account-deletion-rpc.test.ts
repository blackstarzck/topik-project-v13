import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  assertLocalPrivilegedMutationTarget,
  assertLocalPublicMutationTarget,
} from "../../scripts/lib/supabase-target-safety.mjs";

/**
 * Integration test for the account-deletion RPC, protected profile columns,
 * and the deleted-account RLS fail-close boundary.
 *
 * Requires the Supabase CLI local stack (docker). Skipped when
 * `SUPABASE_LOCAL_STACK !== "1"`.
 */

const ENABLED = process.env.SUPABASE_LOCAL_STACK === "1";
const LOCAL_PRIVILEGED_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const DELETION_CLOCK_ASSERTION_ENABLED =
  ENABLED &&
  typeof LOCAL_PRIVILEGED_KEY === "string" &&
  LOCAL_PRIVILEGED_KEY.trim().length > 0;

if (ENABLED) {
  assertLocalPublicMutationTarget(process.env);
}
if (DELETION_CLOCK_ASSERTION_ENABLED) {
  assertLocalPrivilegedMutationTarget(process.env);
}

describe.skipIf(!ENABLED)("account deletion RPC integration", () => {
  async function signUpActiveUser(label: string) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data, error } = await supabase.auth.signUp({
      email: `${label}+${Date.now()}-${Math.random()}@example.com`,
      password: "p@ssw0rd-strong-1234",
    });
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error("signup did not return a user id");
    return { supabase, userId };
  }

  function createLocalAdminClient() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      LOCAL_PRIVILEGED_KEY!,
      { auth: { persistSession: false } },
    );
  }

  async function expectPrivateRowsHidden(
    supabase: SupabaseClient,
    table:
      | "profiles"
      | "learning_goals"
      | "notification_settings"
      | "study_events",
    userId: string,
  ) {
    const ownerColumn = table === "profiles" ? "id" : "user_id";
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq(ownerColumn, userId);
    if (error) throw error;
    expect(data).toEqual([]);
  }

  async function expectRpcBlocked(
    result: PromiseLike<{ error: { message?: string } | null }>,
  ) {
    const { error } = await result;
    expect(error).toBeTruthy();
    expect(error?.message).toContain("account_inactive");
  }

  it("blocks direct status/deleted_at changes and keeps deletion RPC-only", async () => {
    const { supabase, userId } = await signUpActiveUser("delete-guard-test");

    const { error: directStatusError } = await supabase
      .from("profiles")
      .update({ status: "deleted" })
      .eq("id", userId);
    expect(directStatusError).toBeTruthy();

    const { error: directTimestampError } = await supabase
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", userId);
    expect(directTimestampError).toBeTruthy();

    const { data: stateBefore, error: stateBeforeError } = await supabase.rpc(
      "get_my_account_state",
    );
    if (stateBeforeError) throw stateBeforeError;
    expect(stateBefore).toBe("active");

    const { data: activeLibraryRows, error: activeLibraryError } =
      await supabase.rpc("list_user_library_problem_items");
    expect(activeLibraryError).toBeNull();
    expect(Array.isArray(activeLibraryRows)).toBe(true);

    const { error: rpcError } = await supabase.rpc("request_account_deletion");
    expect(rpcError).toBeNull();
  });

  it("fail-closes private tables and Storage for an already-issued deleted-user JWT", async () => {
    const { supabase, userId } = await signUpActiveUser("delete-rls-test");
    const avatarPath = `${userId}/before-delete.png`;
    const exportPath = `exports/${userId}/before-delete.pdf`;
    const publicProblemId = crypto.randomUUID();
    const privateProblemId = crypto.randomUUID();

    const { error: problemInsertError } = await supabase
      .from("problems")
      .insert([
        {
          id: publicProblemId,
          source: "ai_generated",
          author_id: userId,
          domain: "reading",
          topik_level: 2,
          title: "public after deletion",
          prompt: "public prompt",
          publish_status: "published",
          visibility: "public",
        },
        {
          id: privateProblemId,
          source: "ai_generated",
          author_id: userId,
          domain: "reading",
          topik_level: 2,
          title: "private after deletion",
          prompt: "private prompt",
          publish_status: "draft",
          visibility: "private",
        },
      ]);
    if (problemInsertError) throw problemInsertError;

    const { error: goalError } = await supabase.from("learning_goals").insert({
      user_id: userId,
      topik_level: "TOPIK_II",
      target_grade: 4,
      weekly_goal_minutes: 120,
    });
    if (goalError) throw goalError;

    const { error: settingsError } = await supabase
      .from("notification_settings")
      .insert({ user_id: userId });
    if (settingsError) throw settingsError;

    const { error: eventError } = await supabase.from("study_events").insert({
      user_id: userId,
      event_type: "draft_autosaved",
      payload: { source: "account-deletion-integration" },
    });
    if (eventError) throw eventError;

    const { error: avatarUploadError } = await supabase.storage
      .from("avatars")
      .upload(
        avatarPath,
        new Blob(["avatar-before-delete"], { type: "image/png" }),
        { contentType: "image/png" },
      );
    if (avatarUploadError) throw avatarUploadError;

    const { error: exportUploadError } = await supabase.storage
      .from("generated-exports")
      .upload(exportPath, new Blob(["%PDF-1.4"], { type: "application/pdf" }), {
        contentType: "application/pdf",
      });
    if (exportUploadError) throw exportUploadError;

    const {
      data: { session: sessionBeforeDeletion },
    } = await supabase.auth.getSession();
    expect(sessionBeforeDeletion?.access_token).toBeTruthy();

    const { error: deleteError } = await supabase.rpc(
      "request_account_deletion",
    );
    if (deleteError) throw deleteError;

    const {
      data: { session: sessionAfterDeletion },
    } = await supabase.auth.getSession();
    expect(sessionAfterDeletion?.access_token).toBe(
      sessionBeforeDeletion?.access_token,
    );

    const { data: state, error: stateError } = await supabase.rpc(
      "get_my_account_state",
    );
    if (stateError) throw stateError;
    expect(state).toBe("deleted");

    await expectPrivateRowsHidden(supabase, "profiles", userId);
    await expectPrivateRowsHidden(supabase, "learning_goals", userId);
    await expectPrivateRowsHidden(supabase, "notification_settings", userId);
    await expectPrivateRowsHidden(supabase, "study_events", userId);

    const { data: catalogRows, error: catalogError } = await supabase
      .from("problems")
      .select("id")
      .in("id", [publicProblemId, privateProblemId])
      .order("id");
    if (catalogError) throw catalogError;
    expect(catalogRows).toEqual([{ id: publicProblemId }]);

    const { data: resetRows, error: resetRowsError } = await supabase
      .from("pdf_export_quota_reset_targets")
      .select("reset_id")
      .eq("user_id", userId);
    if (resetRowsError) throw resetRowsError;
    expect(resetRows).toEqual([]);

    const { error: goalInsertAfterDeletionError } = await supabase
      .from("learning_goals")
      .upsert({
        user_id: userId,
        topik_level: "TOPIK_I",
        target_grade: 2,
      });
    expect(goalInsertAfterDeletionError).toBeTruthy();

    const { error: settingsInsertAfterDeletionError } = await supabase
      .from("notification_settings")
      .upsert({
        user_id: userId,
        reminder_days: ["monday"],
      });
    expect(settingsInsertAfterDeletionError).toBeTruthy();

    const { error: eventInsertAfterDeletionError } = await supabase
      .from("study_events")
      .insert({
        user_id: userId,
        event_type: "draft_autosaved",
      });
    expect(eventInsertAfterDeletionError).toBeTruthy();

    const { error: profileUpdateAfterDeletionError } = await supabase
      .from("profiles")
      .update({ display_name: "must-not-update" })
      .eq("id", userId)
      .select("id")
      .single();
    expect(profileUpdateAfterDeletionError).toBeTruthy();

    const { error: avatarDownloadError } = await supabase.storage
      .from("avatars")
      .download(avatarPath);
    expect(avatarDownloadError).toBeTruthy();

    const { error: avatarSignedUrlError } = await supabase.storage
      .from("avatars")
      .createSignedUrl(avatarPath, 60);
    expect(avatarSignedUrlError).toBeTruthy();

    const { error: avatarUploadAfterDeletionError } = await supabase.storage
      .from("avatars")
      .upload(
        `${userId}/after-delete.png`,
        new Blob(["avatar-after-delete"], { type: "image/png" }),
        { contentType: "image/png" },
      );
    expect(avatarUploadAfterDeletionError).toBeTruthy();

    const { error: exportDownloadError } = await supabase.storage
      .from("generated-exports")
      .download(exportPath);
    expect(exportDownloadError).toBeTruthy();

    const { error: exportUploadAfterDeletionError } = await supabase.storage
      .from("generated-exports")
      .upload(
        `exports/${userId}/after-delete.pdf`,
        new Blob(["%PDF-1.4"], { type: "application/pdf" }),
        { contentType: "application/pdf" },
      );
    expect(exportUploadAfterDeletionError).toBeTruthy();

    const unknownId = crypto.randomUUID();
    await expectRpcBlocked(supabase.rpc("get_dashboard_kpi"));
    await expectRpcBlocked(
      supabase.rpc("get_writing_submission_history_context", {
        p_submission_ids: [],
      }),
    );
    await expectRpcBlocked(
      supabase.rpc("replace_stale_writing_draft", {
        p_draft_id: unknownId,
        p_current_question_id: "deleted-user-guard",
        p_current_import_id: 1,
        p_current_payload_hash: "deleted-user-guard",
      }),
    );
    await expectRpcBlocked(
      supabase.rpc("create_comparison_report_with_metrics", {
        current_id: unknownId,
        previous_id: null,
        metrics: {},
        narrative: "",
        ai_model: "integration-test",
      }),
    );
    await expectRpcBlocked(
      supabase.rpc("claim_pdf_export_quota", {
        p_user_id: userId,
        p_problem_ids: [publicProblemId],
      }),
    );
    await expectRpcBlocked(
      supabase.rpc("is_nickname_available", {
        candidate: "deleted-user-candidate",
      }),
    );

    const { error: staleSubmitError } = await supabase.rpc(
      "submit_writing_with_feedback",
      {
        submission: {},
        feedback: {},
        dimensions: [],
        sentences: [],
      },
    );
    expect(staleSubmitError).toBeTruthy();

    await expectRpcBlocked(supabase.rpc("list_user_library_problem_items"));

    // The narrow state/deletion RPCs intentionally remain callable after
    // ordinary private-table RLS has failed closed. Repeated deletion is safe.
    const { error: secondDeletionError } = await supabase.rpc(
      "request_account_deletion",
    );
    expect(secondDeletionError).toBeNull();

    const { error: recoverError } = await supabase
      .from("profiles")
      .update({ status: "active" })
      .eq("id", userId)
      .select("id")
      .single();
    expect(recoverError).toBeTruthy();

    const { data: finalState, error: finalStateError } = await supabase.rpc(
      "get_my_account_state",
    );
    if (finalStateError) throw finalStateError;
    expect(finalState).toBe("deleted");
  });

  it.skipIf(!DELETION_CLOCK_ASSERTION_ENABLED)(
    "keeps the first deleted_at value across repeated deletion requests (requires a local privileged test key)",
    async () => {
      const { supabase, userId } = await signUpActiveUser(
        "delete-clock-idempotency-test",
      );
      const admin = createLocalAdminClient();

      const { error: firstDeletionError } = await supabase.rpc(
        "request_account_deletion",
      );
      if (firstDeletionError) throw firstDeletionError;

      const { data: firstState, error: firstReadError } = await admin
        .from("profiles")
        .select("deleted_at")
        .eq("id", userId)
        .single();
      if (firstReadError) throw firstReadError;
      expect(firstState.deleted_at).toBeTruthy();

      const { error: secondDeletionError } = await supabase.rpc(
        "request_account_deletion",
      );
      if (secondDeletionError) throw secondDeletionError;

      const { data: secondState, error: secondReadError } = await admin
        .from("profiles")
        .select("deleted_at")
        .eq("id", userId)
        .single();
      if (secondReadError) throw secondReadError;
      expect(secondState.deleted_at).toBe(firstState.deleted_at);
    },
  );

  it("does not expose another user's account state through the minimal RPC", async () => {
    const first = await signUpActiveUser("account-state-first");
    const second = await signUpActiveUser("account-state-second");

    const { error: deleteFirstError } = await first.supabase.rpc(
      "request_account_deletion",
    );
    if (deleteFirstError) throw deleteFirstError;

    const { data: secondState, error: secondStateError } =
      await second.supabase.rpc("get_my_account_state");
    if (secondStateError) throw secondStateError;
    expect(secondState).toBe("active");

    const { data: firstState, error: firstStateError } =
      await first.supabase.rpc("get_my_account_state");
    if (firstStateError) throw firstStateError;
    expect(firstState).toBe("deleted");
  });
});
