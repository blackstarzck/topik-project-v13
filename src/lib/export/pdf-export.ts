"use client";

/**
 * Phase 6 PDF export helper (F-M1).
 *
 * Implements browser print-to-PDF as the Tier 1 MVP export path:
 *   1. Insert a tracking row into `export_files` with `options.source =
 *      'browser_print'` and `storage_path = 'browser-print://<uuid>'`. The
 *      row is `status='ready'` immediately — no queue worker (OOS-6).
 *   2. Fire-and-forget log a `study_events` row (`event_type =
 *      'export_downloaded'`). Errors are swallowed so the user-visible
 *      print dialog never blocks on telemetry.
 *   3. Call `window.print()` when running in a browser. SSR/Node callers
 *      (vitest) skip the print invocation but still complete the DB write.
 *
 * RLS contract (see `20260521140000_phase_6_rpc_and_admin.sql` §4.2):
 *   - `source_type='submission'`  → `source_id` must reference caller's
 *     `writing_submissions` row.
 *   - `source_type='report'`      → `source_id` must reference caller's
 *     `comparison_reports` row.
 *   - `source_type='library_selection'` → `source_id` MUST be `null`.
 *
 * The client helper enforces the library_selection null-id rule before
 * the round-trip so we never see a wasted RLS reject.
 */

import { createSupabaseBrowserClient } from "../supabase/browser";

export type PdfExportSourceType = "submission" | "report" | "library_selection";

export type PdfExportInput = {
  sourceType: PdfExportSourceType;
  sourceId: string | null;
};

export type PdfExportResult = {
  exportId: string;
};

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

function generateExportToken(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback (older runtimes): timestamp + Math.random. Acceptable because
  // storage_path is only an opaque marker for "browser print" rows.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function triggerPdfExport(
  input: PdfExportInput,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<PdfExportResult> {
  // 1. Validate the library_selection invariant up-front.
  if (input.sourceType === "library_selection" && input.sourceId !== null) {
    throw new Error(
      "triggerPdfExport: source_id must be null when sourceType='library_selection'",
    );
  }
  if (input.sourceType !== "library_selection" && !input.sourceId) {
    throw new Error(
      `triggerPdfExport: source_id is required when sourceType='${input.sourceType}'`,
    );
  }

  const supabase = createClient();

  // 2. Resolve the calling user — RLS needs `user_id = auth.uid()`.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("triggerPdfExport: not authenticated");

  const storagePath = `browser-print://${generateExportToken()}`;

  // 3. Insert the export_files ledger row.
  const { data, error } = await supabase
    .from("export_files")
    .insert({
      user_id: user.id,
      source_type: input.sourceType,
      source_id:
        input.sourceType === "library_selection" ? null : input.sourceId,
      storage_path: storagePath,
      options: { source: "browser_print" },
      status: "ready",
      ready_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data) throw new Error("triggerPdfExport: empty insert result");

  const exportId = data.id;

  // 4. Fire-and-forget study_events insert. Telemetry failure must not
  //    abort the print flow — swallow and move on.
  //    supabase-js returns a PromiseLike (no `.catch`); use `.then(onFulfilled,
  //    onRejected)` to swallow rejections.
  void supabase
    .from("study_events")
    .insert({
      user_id: user.id,
      event_type: "export_downloaded",
      payload: {
        source_type: input.sourceType,
        source_id:
          input.sourceType === "library_selection" ? null : input.sourceId,
      },
    })
    .then(
      () => undefined,
      () => undefined,
    );

  // 5. Browser-only: open the native print dialog. In SSR/vitest the
  //    `window` global is undefined and we skip silently. The DB row above
  //    has already been written, which is what callers test for.
  if (typeof window !== "undefined" && typeof window.print === "function") {
    window.print();
  }

  return { exportId };
}
