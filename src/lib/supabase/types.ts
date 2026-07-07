/**
 * Schema-aligned Supabase type snapshot for TALKPIK AI.
 *
 * Source of truth: `supabase/migrations/*.sql` (16 canonical migrations) plus
 * the trigger migration added in Phase 2 (`20260521120000_auth_user_profile_bootstrap.sql`).
 *
 * Regenerate after schema changes:
 *
 *     pnpm dlx supabase gen types typescript --local > src/lib/supabase/types.ts
 *
 * Until Supabase CLI is wired into CI, this file is a hand-aligned snapshot.
 * As of Phase 5 it covers: `profiles`, `learning_goals`, `problems`,
 * `problem_assets`, `problem_attempts`, `recommendation_runs`,
 * `recommendation_items` (Phase 2–4) + `writing_drafts`,
 * `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`,
 * `sentence_feedback`, `comparison_reports` (Phase 5).
 * Phase 6 extends the snapshot to cover `library_items`, `study_events`,
 * `export_files`, `admin_audit_logs`, the new `profiles.notification_prefs`
 * column, and the SECURITY DEFINER RPCs introduced in migration
 * `20260521140000_phase_6_rpc_and_admin.sql` (`get_dashboard_kpi`,
 * `get_admin_org_dashboard`, `admin_change_user_role`,
 * `admin_toggle_problem_publish`).
 *
 * Fallback evidence: Supabase CLI requires docker for local stack — host
 * environment lacks docker, so this file is hand-aligned against the
 * canonical migration SQL (`supabase/migrations/202605201205*.sql`). Phase 6
 * CI shall regenerate via the CLI and diff against this snapshot.
 *
 * Schema vs TS gaps (acceptable — same as `supabase gen types` output):
 * - SQL `smallint check (... in (51,52,53,54))` becomes `number`, not the
 *   narrowed union. Use a domain-layer validator (zod) at the fetch site
 *   when the union matters.
 * - SQL `numeric(5,2)` becomes `number`. `supabase-js` returns it as a JS
 *   number; precision loss is possible near the limit. Fine for scores 0–100.
 * - SQL array types render as `string[] | null` etc., matching the column
 *   nullability. Default-`'{}'` columns stay as `string[]` (not nullable).
 *
 * Do not hand-edit individual rows; prefer regenerating via the CLI command
 * above so the type and the migrations stay aligned by construction.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          nationality_country_code: string | null;
          nickname: string | null;
          avatar_path: string | null;
          ui_locale: "ko" | "en" | "vi";
          ui_locale_source: "legacy" | "default" | "auto" | "manual";
          app_role:
            | "learner"
            | "content_admin"
            | "org_admin"
            | "platform_admin";
          plan_label: string;
          status: "active" | "blocked" | "deleted";
          notification_prefs: Json;
          // 20260602120200 — G-01 settings: preferred learning-content language
          // (null = follow ui_locale) + content preferences object.
          learning_locale: "ko" | "en" | "vi" | null;
          content_prefs: Json;
          // Phase 7-E Task 10 — self-introduction (max 160 chars, CHECK constraint).
          bio: string | null;
          affiliation_code: string | null;
          // 20260622120000 — 회원 탈퇴 요청 시각. status=deleted 전환 시 기록.
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          nationality_country_code?: string | null;
          nickname?: string | null;
          avatar_path?: string | null;
          ui_locale?: "ko" | "en" | "vi";
          ui_locale_source?: "legacy" | "default" | "auto" | "manual";
          app_role?:
            | "learner"
            | "content_admin"
            | "org_admin"
            | "platform_admin";
          plan_label?: string;
          status?: "active" | "blocked" | "deleted";
          notification_prefs?: Json;
          learning_locale?: "ko" | "en" | "vi" | null;
          content_prefs?: Json;
          bio?: string | null;
          affiliation_code?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          nationality_country_code?: string | null;
          nickname?: string | null;
          avatar_path?: string | null;
          ui_locale?: "ko" | "en" | "vi";
          ui_locale_source?: "legacy" | "default" | "auto" | "manual";
          app_role?:
            | "learner"
            | "content_admin"
            | "org_admin"
            | "platform_admin";
          plan_label?: string;
          status?: "active" | "blocked" | "deleted";
          notification_prefs?: Json;
          learning_locale?: "ko" | "en" | "vi" | null;
          content_prefs?: Json;
          bio?: string | null;
          affiliation_code?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_goals: {
        Row: {
          user_id: string;
          topik_level: "TOPIK_I" | "TOPIK_II";
          target_grade: number;
          exam_date: string | null;
          weekly_goal_minutes: number | null;
          weak_areas: string[];
          is_active: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          topik_level: "TOPIK_I" | "TOPIK_II";
          target_grade: number;
          exam_date?: string | null;
          weekly_goal_minutes?: number | null;
          weak_areas?: string[];
          is_active?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          topik_level?: "TOPIK_I" | "TOPIK_II";
          target_grade?: number;
          exam_date?: string | null;
          weekly_goal_minutes?: number | null;
          weak_areas?: string[];
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_goals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      problems: {
        Row: {
          id: string;
          source: "ai_generated" | "curated";
          author_id: string | null;
          domain: "reading" | "listening" | "writing";
          question_no: number | null;
          topik_level: number;
          difficulty: number | null;
          title: string;
          prompt: string;
          materials: Json | null;
          answer_key: Json | null;
          rubric: Json | null;
          explanation: string | null;
          tags: string[];
          publish_status: "draft" | "published" | "archived";
          review_status: "pending" | "approved" | "rejected";
          review_workflow_status: string | null;
          topic_category_code: string | null;
          lifecycle_status: "active" | "inactive" | "expired";
          lifecycle_reason: string | null;
          expires_at: string | null;
          visibility: "private" | "public" | "org";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source?: "ai_generated" | "curated";
          author_id?: string | null;
          domain: "reading" | "listening" | "writing";
          question_no?: number | null;
          topik_level: number;
          difficulty?: number | null;
          title: string;
          prompt: string;
          materials?: Json | null;
          answer_key?: Json | null;
          rubric?: Json | null;
          explanation?: string | null;
          tags?: string[];
          publish_status?: "draft" | "published" | "archived";
          review_status?: "pending" | "approved" | "rejected";
          review_workflow_status?: string | null;
          topic_category_code?: string | null;
          lifecycle_status?: "active" | "inactive" | "expired";
          lifecycle_reason?: string | null;
          expires_at?: string | null;
          visibility?: "private" | "public" | "org";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source?: "ai_generated" | "curated";
          author_id?: string | null;
          domain?: "reading" | "listening" | "writing";
          question_no?: number | null;
          topik_level?: number;
          difficulty?: number | null;
          title?: string;
          prompt?: string;
          materials?: Json | null;
          answer_key?: Json | null;
          rubric?: Json | null;
          explanation?: string | null;
          tags?: string[];
          publish_status?: "draft" | "published" | "archived";
          review_status?: "pending" | "approved" | "rejected";
          review_workflow_status?: string | null;
          topic_category_code?: string | null;
          lifecycle_status?: "active" | "inactive" | "expired";
          lifecycle_reason?: string | null;
          expires_at?: string | null;
          visibility?: "private" | "public" | "org";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "problems_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      problem_assets: {
        Row: {
          id: string;
          problem_id: string;
          storage_path: string;
          asset_type: "image" | "audio";
          sort_order: number;
        };
        Insert: {
          id?: string;
          problem_id: string;
          storage_path: string;
          asset_type: "image" | "audio";
          sort_order?: number;
        };
        Update: {
          id?: string;
          problem_id?: string;
          storage_path?: string;
          asset_type?: "image" | "audio";
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "problem_assets_problem_id_fkey";
            columns: ["problem_id"];
            isOneToOne: false;
            referencedRelation: "problems";
            referencedColumns: ["id"];
          },
        ];
      };
      problem_attempts: {
        Row: {
          id: string;
          user_id: string;
          problem_id: string;
          selected_answer: Json | null;
          is_correct: boolean | null;
          score: number | null;
          status: "started" | "submitted" | "reviewed";
          started_at: string;
          submitted_at: string | null;
          bookmarked: boolean;
          time_spent_seconds: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          problem_id: string;
          selected_answer?: Json | null;
          is_correct?: boolean | null;
          score?: number | null;
          status?: "started" | "submitted" | "reviewed";
          started_at?: string;
          submitted_at?: string | null;
          bookmarked?: boolean;
          time_spent_seconds?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          problem_id?: string;
          selected_answer?: Json | null;
          is_correct?: boolean | null;
          score?: number | null;
          status?: "started" | "submitted" | "reviewed";
          started_at?: string;
          submitted_at?: string | null;
          bookmarked?: boolean;
          time_spent_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "problem_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "problem_attempts_problem_id_fkey";
            columns: ["problem_id"];
            isOneToOne: false;
            referencedRelation: "problems";
            referencedColumns: ["id"];
          },
        ];
      };
      recommendation_runs: {
        Row: {
          id: string;
          user_id: string;
          source_type:
            | "dashboard"
            | "feedback"
            | "weakness"
            | "next_problem";
          source_id: string | null;
          reason_summary: string | null;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_type:
            | "dashboard"
            | "feedback"
            | "weakness"
            | "next_problem";
          source_id?: string | null;
          reason_summary?: string | null;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_type?:
            | "dashboard"
            | "feedback"
            | "weakness"
            | "next_problem";
          source_id?: string | null;
          reason_summary?: string | null;
          created_at?: string;
          expires_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recommendation_runs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recommendation_items: {
        Row: {
          id: string;
          run_id: string;
          user_id: string;
          problem_id: string;
          rank: number;
          reason: string | null;
          estimated_minutes: number | null;
          weakness_tags: string[] | null;
          status: "active" | "consumed" | "expired";
        };
        Insert: {
          id?: string;
          run_id: string;
          user_id: string;
          problem_id: string;
          rank: number;
          reason?: string | null;
          estimated_minutes?: number | null;
          weakness_tags?: string[] | null;
          status?: "active" | "consumed" | "expired";
        };
        Update: {
          id?: string;
          run_id?: string;
          user_id?: string;
          problem_id?: string;
          rank?: number;
          reason?: string | null;
          estimated_minutes?: number | null;
          weakness_tags?: string[] | null;
          status?: "active" | "consumed" | "expired";
        };
        Relationships: [
          {
            foreignKeyName: "recommendation_items_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "recommendation_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendation_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendation_items_problem_id_fkey";
            columns: ["problem_id"];
            isOneToOne: false;
            referencedRelation: "problems";
            referencedColumns: ["id"];
          },
        ];
      };
      writing_drafts: {
        Row: {
          id: string;
          user_id: string;
          problem_id: string;
          question_no: number;
          answer_text: string | null;
          answer_json: Json | null;
          char_count: number | null;
          autosave_status:
            | "clean"
            | "dirty"
            | "syncing"
            | "failed"
            | "superseded";
          last_saved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          problem_id: string;
          question_no: number;
          answer_text?: string | null;
          answer_json?: Json | null;
          char_count?: number | null;
          autosave_status?:
            | "clean"
            | "dirty"
            | "syncing"
            | "failed"
            | "superseded";
          last_saved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          problem_id?: string;
          question_no?: number;
          answer_text?: string | null;
          answer_json?: Json | null;
          char_count?: number | null;
          autosave_status?:
            | "clean"
            | "dirty"
            | "syncing"
            | "failed"
            | "superseded";
          last_saved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "writing_drafts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "writing_drafts_problem_id_fkey";
            columns: ["problem_id"];
            isOneToOne: false;
            referencedRelation: "problems";
            referencedColumns: ["id"];
          },
        ];
      };
      writing_submissions: {
        Row: {
          id: string;
          user_id: string;
          problem_id: string;
          draft_id: string | null;
          question_no: number;
          answer_text: string;
          answer_json: Json | null;
          char_count: number;
          submitted_at: string;
          feedback_status: "pending" | "analyzing" | "complete" | "failed";
          parent_submission_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          problem_id: string;
          draft_id?: string | null;
          question_no: number;
          answer_text: string;
          answer_json?: Json | null;
          char_count: number;
          submitted_at?: string;
          feedback_status?:
            | "pending"
            | "analyzing"
            | "complete"
            | "failed";
          parent_submission_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          problem_id?: string;
          draft_id?: string | null;
          question_no?: number;
          answer_text?: string;
          answer_json?: Json | null;
          char_count?: number;
          submitted_at?: string;
          feedback_status?:
            | "pending"
            | "analyzing"
            | "complete"
            | "failed";
          parent_submission_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "writing_submissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "writing_submissions_problem_id_fkey";
            columns: ["problem_id"];
            isOneToOne: false;
            referencedRelation: "problems";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "writing_submissions_draft_id_fkey";
            columns: ["draft_id"];
            isOneToOne: false;
            referencedRelation: "writing_drafts";
            referencedColumns: ["id"];
          },
        ];
      };
      writing_feedback: {
        Row: {
          submission_id: string;
          user_id: string;
          status: "partial" | "complete" | "failed";
          score_total: number | null;
          score_max: number | null;
          overall_summary: string | null;
          ai_model: string | null;
          ai_model_version: string | null;
          raw_ai_result: Json | null;
          generated_at: string;
        };
        Insert: {
          submission_id: string;
          user_id: string;
          status?: "partial" | "complete" | "failed";
          score_total?: number | null;
          score_max?: number | null;
          overall_summary?: string | null;
          ai_model?: string | null;
          ai_model_version?: string | null;
          raw_ai_result?: Json | null;
          generated_at?: string;
        };
        Update: {
          submission_id?: string;
          user_id?: string;
          status?: "partial" | "complete" | "failed";
          score_total?: number | null;
          score_max?: number | null;
          overall_summary?: string | null;
          ai_model?: string | null;
          ai_model_version?: string | null;
          raw_ai_result?: Json | null;
          generated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "writing_feedback_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: true;
            referencedRelation: "writing_submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "writing_feedback_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback_dimension_scores: {
        Row: {
          id: string;
          submission_id: string;
          user_id: string;
          dimension:
            | "grammar"
            | "vocab"
            | "structure"
            | "content"
            | "expression"
            | "topic_fit"
            | "language";
          score: number | null;
          score_max: number | null;
          summary: string | null;
          weakness_level: number | null;
        };
        Insert: {
          id?: string;
          submission_id: string;
          user_id: string;
          dimension:
            | "grammar"
            | "vocab"
            | "structure"
            | "content"
            | "expression"
            | "topic_fit"
            | "language";
          score?: number | null;
          score_max?: number | null;
          summary?: string | null;
          weakness_level?: number | null;
        };
        Update: {
          id?: string;
          submission_id?: string;
          user_id?: string;
          dimension?:
            | "grammar"
            | "vocab"
            | "structure"
            | "content"
            | "expression"
            | "topic_fit"
            | "language";
          score?: number | null;
          score_max?: number | null;
          summary?: string | null;
          weakness_level?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_dimension_scores_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "writing_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      sentence_feedback: {
        Row: {
          id: string;
          submission_id: string;
          user_id: string;
          sentence_index: number;
          original_text: string | null;
          corrected_text: string | null;
          comment: string | null;
        };
        Insert: {
          id?: string;
          submission_id: string;
          user_id: string;
          sentence_index: number;
          original_text?: string | null;
          corrected_text?: string | null;
          comment?: string | null;
        };
        Update: {
          id?: string;
          submission_id?: string;
          user_id?: string;
          sentence_index?: number;
          original_text?: string | null;
          corrected_text?: string | null;
          comment?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sentence_feedback_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "writing_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      comparison_reports: {
        Row: {
          id: string;
          user_id: string;
          current_submission_id: string;
          previous_submission_id: string | null;
          metrics: Json;
          narrative: string | null;
          ai_model: string | null;
          generated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          current_submission_id: string;
          previous_submission_id?: string | null;
          metrics: Json;
          narrative?: string | null;
          ai_model?: string | null;
          generated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          current_submission_id?: string;
          previous_submission_id?: string | null;
          metrics?: Json;
          narrative?: string | null;
          ai_model?: string | null;
          generated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comparison_reports_current_submission_id_fkey";
            columns: ["current_submission_id"];
            isOneToOne: false;
            referencedRelation: "writing_submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparison_reports_previous_submission_id_fkey";
            columns: ["previous_submission_id"];
            isOneToOne: false;
            referencedRelation: "writing_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      library_items: {
        Row: {
          id: string;
          user_id: string;
          item_type: "attempt" | "submission" | "report" | "export" | "problem";
          attempt_id: string | null;
          submission_id: string | null;
          report_id: string | null;
          export_id: string | null;
          problem_id: string | null;
          note: string | null;
          tags: string[];
          saved_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_type:
            | "attempt"
            | "submission"
            | "report"
            | "export"
            | "problem";
          attempt_id?: string | null;
          submission_id?: string | null;
          report_id?: string | null;
          export_id?: string | null;
          problem_id?: string | null;
          note?: string | null;
          tags?: string[];
          saved_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_type?:
            | "attempt"
            | "submission"
            | "report"
            | "export"
            | "problem";
          attempt_id?: string | null;
          submission_id?: string | null;
          report_id?: string | null;
          export_id?: string | null;
          problem_id?: string | null;
          note?: string | null;
          tags?: string[];
          saved_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "library_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      export_files: {
        Row: {
          id: string;
          user_id: string;
          source_type: "submission" | "report" | "library_selection";
          source_id: string | null;
          storage_path: string;
          options: Json | null;
          status: "queued" | "ready" | "failed";
          created_at: string;
          ready_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_type: "submission" | "report" | "library_selection";
          source_id?: string | null;
          storage_path: string;
          options?: Json | null;
          status?: "queued" | "ready" | "failed";
          created_at?: string;
          ready_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_type?: "submission" | "report" | "library_selection";
          source_id?: string | null;
          storage_path?: string;
          options?: Json | null;
          status?: "queued" | "ready" | "failed";
          created_at?: string;
          ready_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "export_files_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pdf_export_quota_policies: {
        Row: {
          id: string;
          subject_scope: "user";
          resource_scope: "problem";
          period_unit: "day" | "week" | "month";
          period_timezone: string;
          limit_count: number;
          priority: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subject_scope?: "user";
          resource_scope?: "problem";
          period_unit?: "day" | "week" | "month";
          period_timezone?: string;
          limit_count?: number;
          priority?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subject_scope?: "user";
          resource_scope?: "problem";
          period_unit?: "day" | "week" | "month";
          period_timezone?: string;
          limit_count?: number;
          priority?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pdf_export_quota_usages: {
        Row: {
          id: string;
          policy_id: string;
          user_id: string;
          problem_id: string;
          export_file_id: string | null;
          period_start: string;
          period_end: string;
          status: "reserved" | "committed" | "released";
          reserved_at: string;
          committed_at: string | null;
          released_at: string | null;
          release_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          policy_id: string;
          user_id: string;
          problem_id: string;
          export_file_id?: string | null;
          period_start: string;
          period_end: string;
          status?: "reserved" | "committed" | "released";
          reserved_at?: string;
          committed_at?: string | null;
          released_at?: string | null;
          release_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          policy_id?: string;
          user_id?: string;
          problem_id?: string;
          export_file_id?: string | null;
          period_start?: string;
          period_end?: string;
          status?: "reserved" | "committed" | "released";
          reserved_at?: string;
          committed_at?: string | null;
          released_at?: string | null;
          release_reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pdf_export_quota_usages_policy_id_fkey";
            columns: ["policy_id"];
            isOneToOne: false;
            referencedRelation: "pdf_export_quota_policies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pdf_export_quota_usages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pdf_export_quota_usages_problem_id_fkey";
            columns: ["problem_id"];
            isOneToOne: false;
            referencedRelation: "problems";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pdf_export_quota_usages_export_file_id_fkey";
            columns: ["export_file_id"];
            isOneToOne: false;
            referencedRelation: "export_files";
            referencedColumns: ["id"];
          },
        ];
      };
      pdf_export_quota_resets: {
        Row: {
          id: string;
          reset_scope: "user" | "group" | "global";
          problem_id: string | null;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reset_scope: "user" | "group" | "global";
          problem_id?: string | null;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reset_scope?: "user" | "group" | "global";
          problem_id?: string | null;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pdf_export_quota_resets_problem_id_fkey";
            columns: ["problem_id"];
            isOneToOne: false;
            referencedRelation: "problems";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pdf_export_quota_resets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pdf_export_quota_reset_targets: {
        Row: {
          reset_id: string;
          user_id: string;
          materialized_at: string;
        };
        Insert: {
          reset_id: string;
          user_id: string;
          materialized_at?: string;
        };
        Update: {
          reset_id?: string;
          user_id?: string;
          materialized_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pdf_export_quota_reset_targets_reset_id_fkey";
            columns: ["reset_id"];
            isOneToOne: false;
            referencedRelation: "pdf_export_quota_resets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pdf_export_quota_reset_targets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      study_events: {
        Row: {
          id: string;
          user_id: string;
          /**
           * Frozen catalog (see library_events_exports.sql:118):
           * 'practice_started' | 'attempt_submitted' | 'draft_autosaved' |
           * 'submission_submitted' | 'feedback_viewed' | 'report_viewed' |
           * 'recommendation_clicked' | 'export_downloaded'
           * Column type stays `text` so future ledger additions don't break the
           * snapshot; the enum lives in src/lib/events/study-events.ts.
           */
          event_type: string;
          occurred_at: string;
          problem_id: string | null;
          submission_id: string | null;
          attempt_id: string | null;
          session_id: string | null;
          payload: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          occurred_at?: string;
          problem_id?: string | null;
          submission_id?: string | null;
          attempt_id?: string | null;
          session_id?: string | null;
          payload?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_type?: string;
          occurred_at?: string;
          problem_id?: string | null;
          submission_id?: string | null;
          attempt_id?: string | null;
          session_id?: string | null;
          payload?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "study_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_audit_logs: {
        Row: {
          id: string;
          admin_user_id: string;
          action: string;
          target_table: string;
          target_id: string;
          diff: Json | null;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id: string;
          action: string;
          target_table: string;
          target_id: string;
          diff?: Json | null;
          payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_user_id?: string;
          action?: string;
          target_table?: string;
          target_id?: string;
          diff?: Json | null;
          payload?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_user_id_fkey";
            columns: ["admin_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // -------------------------------------------------------------------
      // Billing (20260602120100_billing.sql) — X-03 / account billing.
      // -------------------------------------------------------------------
      subscription_plans: {
        Row: {
          plan_key: string;
          name: string;
          cadence: "monthly" | "quarterly" | "yearly";
          price_cents: number;
          currency: string;
          features: Json;
          recommended: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          plan_key: string;
          name: string;
          cadence: "monthly" | "quarterly" | "yearly";
          price_cents: number;
          currency?: string;
          features?: Json;
          recommended?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan_key?: string;
          name?: string;
          cadence?: "monthly" | "quarterly" | "yearly";
          price_cents?: number;
          currency?: string;
          features?: Json;
          recommended?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_key: string | null;
          billing_cadence: "monthly" | "quarterly" | "yearly";
          status: "active" | "canceled" | "past_due" | "trialing" | "paused";
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at: string | null;
          provider: string | null;
          provider_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_key?: string | null;
          billing_cadence: "monthly" | "quarterly" | "yearly";
          status?: "active" | "canceled" | "past_due" | "trialing" | "paused";
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at?: string | null;
          provider?: string | null;
          provider_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_key?: string | null;
          billing_cadence?: "monthly" | "quarterly" | "yearly";
          status?: "active" | "canceled" | "past_due" | "trialing" | "paused";
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at?: string | null;
          provider?: string | null;
          provider_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_key_fkey";
            columns: ["plan_key"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["plan_key"];
          },
        ];
      };
      payment_history: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string | null;
          amount_cents: number;
          currency: string;
          status: "paid" | "failed" | "refunded" | "pending";
          receipt_url: string | null;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id?: string | null;
          amount_cents: number;
          currency?: string;
          status: "paid" | "failed" | "refunded" | "pending";
          receipt_url?: string | null;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription_id?: string | null;
          amount_cents?: number;
          currency?: string;
          status?: "paid" | "failed" | "refunded" | "pending";
          receipt_url?: string | null;
          paid_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_history_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      // -------------------------------------------------------------------
      // Notifications (20260602120200_notifications_and_settings.sql) — X-09.
      // -------------------------------------------------------------------
      notification_settings: {
        Row: {
          user_id: string;
          reminder_time: string | null;
          reminder_days: Json;
          channels: Json;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          reminder_time?: string | null;
          reminder_days?: Json;
          channels?: Json;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          reminder_time?: string | null;
          reminder_days?: Json;
          channels?: Json;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_log: {
        Row: {
          id: string;
          user_id: string;
          channel: string;
          template_key: string;
          status: "sent" | "failed" | "pending";
          payload: Json | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          channel: string;
          template_key: string;
          status: "sent" | "failed" | "pending";
          payload?: Json | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          channel?: string;
          template_key?: string;
          status?: "sent" | "failed" | "pending";
          payload?: Json | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // -------------------------------------------------------------------
      // Legal (20260608120000_legal_documents_and_consents.sql) — A-01/X-13/X-14.
      // -------------------------------------------------------------------
      legal_documents: {
        Row: {
          id: string;
          doc_type: "terms" | "privacy";
          version: string;
          locale: "ko" | "en" | "vi";
          title: string;
          body: string;
          summary: string | null;
          is_placeholder: boolean;
          requires_consent: boolean;
          status: "draft" | "published" | "archived";
          effective_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          doc_type: "terms" | "privacy";
          version: string;
          locale?: "ko" | "en" | "vi";
          title: string;
          body: string;
          summary?: string | null;
          is_placeholder?: boolean;
          requires_consent?: boolean;
          status?: "draft" | "published" | "archived";
          effective_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          doc_type?: "terms" | "privacy";
          version?: string;
          locale?: "ko" | "en" | "vi";
          title?: string;
          body?: string;
          summary?: string | null;
          is_placeholder?: boolean;
          requires_consent?: boolean;
          status?: "draft" | "published" | "archived";
          effective_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_consents: {
        Row: {
          id: string;
          user_id: string;
          document_id: string;
          doc_type: "terms" | "privacy";
          version: string;
          source: "signup" | "re_consent" | "settings";
          accepted_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id: string;
          doc_type: "terms" | "privacy";
          version: string;
          source?: "signup" | "re_consent" | "settings";
          accepted_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          document_id?: string;
          doc_type?: "terms" | "privacy";
          version?: string;
          source?: "signup" | "re_consent" | "settings";
          accepted_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_consents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_consents_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "legal_documents";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      claim_pdf_export_quota: {
        Args: {
          p_user_id: string;
          p_problem_ids: string[];
        };
        Returns: Json;
      };
      commit_pdf_export_quota: {
        Args: {
          p_user_id: string;
          p_usage_ids: string[];
          p_export_file_id: string;
        };
        Returns: undefined;
      };
      release_pdf_export_quota: {
        Args: {
          p_user_id: string;
          p_usage_ids: string[];
          p_reason?: string | null;
        };
        Returns: undefined;
      };
      accept_affiliation_invite: {
        Args: {
          p_code: string;
          p_confirmed: boolean;
        };
        Returns: Json;
      };
      claim_affiliation_code: {
        Args: {
          p_code: string;
        };
        Returns: string | null;
      };
      complete_auth_gate: {
        Args: {
          p_display_name: string | null;
          p_nickname: string | null;
          p_nationality_country_code: string | null;
          p_accept_required_consents: boolean;
        };
        Returns: undefined;
      };
      filter_visible_writing_problem_ids: {
        Args: {
          p_problem_ids: string[];
        };
        Returns: {
          problem_id: string;
        }[];
      };
      create_external_writing_submission: {
        Args: {
          submission: Json;
        };
        Returns: string;
      };
      get_dashboard_kpi: {
        Args: Record<string, never>;
        Returns: {
          today_attempts: number;
          total_attempts: number;
          exam_days_left: number | null;
          streak_days: number;
        }[];
      };
      list_user_library_problem_items: {
        Args: Record<string, never>;
        Returns: {
          item_id: string;
          problem_id: string | null;
          title: string | null;
          question_no: number | null;
          tags: string[] | null;
          saved_at: string;
          availability_status: string;
          availability_reason: string | null;
          can_retry: boolean;
        }[];
      };
      is_nickname_available: {
        Args: {
          candidate: string;
        };
        Returns: boolean;
      };
      is_writing_problem_visible_to_caller: {
        Args: {
          p_problem_id: string;
          p_question_no: number;
        };
        Returns: boolean;
      };
      request_account_deletion: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      list_user_problems: {
        Args: {
          filter?: Json;
          sort?: string;
          page?: number;
          page_size?: number;
        };
        Returns: {
          problem_id: string;
          title: string;
          domain: string;
          topik_level: number | null;
          question_no: number | null;
          difficulty: number | null;
          tags: string[] | null;
          attempt_count: number | null;
          is_solved: boolean | null;
          last_attempt_at: string | null;
          created_at: string;
          total_count: number;
          solve_state: "none" | "attempted" | "submitted";
          has_draft: boolean;
          draft_status: string | null;
          writing_submission_count: number;
          latest_submission_id: string | null;
          latest_submission_at: string | null;
          writing_feedback_status: string | null;
          lifecycle_status: "active" | "inactive" | "expired";
          lifecycle_reason: string | null;
          publish_status: "draft" | "published" | "archived";
          review_status: "pending" | "approved" | "rejected";
        }[];
      };
      sync_external_writing_feedback: {
        Args: {
          target_submission_id: string;
          next_status: string;
          feedback?: Json | null;
          dimensions?: Json;
          sentences?: Json;
        };
        Returns: string;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
