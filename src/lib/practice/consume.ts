"use client";

import { createSupabaseBrowserClient } from "../supabase/browser";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

/**
 * Phase 7-D follow-up (R-02 / X-07) — mark a recommendation item consumed.
 *
 * When the learner clicks "학습 시작" on a recommended problem we flip the
 * matching `recommendation_items` row to `status='consumed'` so the same
 * suggestion doesn't keep resurfacing. RLS allows this directly from the
 * browser: migration 20260520121100_rls_policies.sql declares
 * `recommendation_items_owner_update` (`for update to authenticated using
 * user_id = auth.uid()`), so an owner-scoped update needs NO service role
 * and NO RPC.
 *
 * Fire-and-forget contract (mirrors logStudyEvent): the returned Promise
 * NEVER rejects. The UI calls this then immediately navigates, so a failed
 * update must never block the learner or surface an error. In jsdom tests
 * `getPublicEnv()` throws (no NEXT_PUBLIC_* vars) — that throw is swallowed
 * here, which keeps the existing view tests green without mocking Supabase.
 *
 * `itemId` may be null/undefined for fallback suggestions (random / same
 * question_no / tag-fallback) that have no backing recommendation row — in
 * that case we no-op silently.
 */
export async function consumeRecommendationItem(
  itemId: string | null | undefined,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<void> {
  if (!itemId) return;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("recommendation_items")
      .update({ status: "consumed" })
      .eq("id", itemId)
      .eq("user_id", user.id)
      .eq("status", "active");
    if (error) {
      console.warn("consumeRecommendationItem: update failed", error.message);
    }
  } catch (err) {
    // Swallow everything (missing env in tests, network, RLS, transient).
    console.warn("consumeRecommendationItem: swallowed error", err);
  }
}
