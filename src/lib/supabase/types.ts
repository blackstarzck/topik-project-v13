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
 * Other tables (library_items, study_events, export_files,
 * admin_audit_logs) exist in the database but are not typed here; add them
 * as Phase 6 consumes them or regenerate via
 * `pnpm dlx supabase gen types typescript --local`.
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
          nickname: string | null;
          avatar_path: string | null;
          ui_locale: "ko" | "en" | "vi";
          app_role:
            | "learner"
            | "content_admin"
            | "org_admin"
            | "platform_admin";
          plan_label: string;
          status: "active" | "blocked" | "deleted";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          nickname?: string | null;
          avatar_path?: string | null;
          ui_locale?: "ko" | "en" | "vi";
          app_role?:
            | "learner"
            | "content_admin"
            | "org_admin"
            | "platform_admin";
          plan_label?: string;
          status?: "active" | "blocked" | "deleted";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          nickname?: string | null;
          avatar_path?: string | null;
          ui_locale?: "ko" | "en" | "vi";
          app_role?:
            | "learner"
            | "content_admin"
            | "org_admin"
            | "platform_admin";
          plan_label?: string;
          status?: "active" | "blocked" | "deleted";
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
            | "topic_fit";
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
            | "topic_fit";
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
            | "topic_fit";
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
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
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
