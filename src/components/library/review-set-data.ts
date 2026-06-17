"use client";

/**
 * F-01 region 2 — "복습 세트로 생성" action.
 *
 * There is no dedicated review_sets table in the current schema, so we record
 * the intent as a study_events row (event_type='review_set_created') carrying
 * the selected library_items in the payload. This is real, owner-scoped data
 * (study_events RLS = auth.uid()) that the practice/recommendation surfaces can
 * later consume. The actual "play this set" routing is a follow-up; for now the
 * set is persisted and the user is told it was created.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function createReviewSet(itemIds: string[]): Promise<string> {
  if (itemIds.length === 0) throw new Error("선택한 항목이 없습니다.");
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data, error } = await supabase
    .from("study_events")
    .insert({
      user_id: user.id,
      event_type: "review_set_created",
      payload: { item_ids: itemIds, count: itemIds.length },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("복습 세트 ID를 만들지 못했습니다.");
  return data.id;
}
