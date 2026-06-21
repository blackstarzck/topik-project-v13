"use server";

import { redirect } from "next/navigation";

import { sanitizeNext } from "@/lib/auth/error-mapping";
import { ACCOUNT_INACTIVE_PATH } from "@/lib/auth/completion-routes";
import { bootstrapProfile, isActiveStatus } from "@/lib/auth/profile";
import { requireUser } from "@/lib/auth/session";
import {
  getMissingRequiredConsentDocuments,
  recordRequiredConsents,
} from "@/lib/legal/consent";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildConsentRetryPath(next: string): string {
  const params = new URLSearchParams({ next, error: "required" });
  return `/auth/consent?${params.toString()}`;
}

export async function acceptRequiredConsentsAction(formData: FormData) {
  const next = sanitizeNext(
    formData.get("next")?.toString(),
    "/auth/post-auth?intent=login",
  );

  if (formData.get("accept") === null) {
    redirect(buildConsentRetryPath(next));
  }

  const supabase = await createSupabaseServerClient();
  const createClient = async () => supabase;
  const user = await requireUser(createClient);
  const profile = await bootstrapProfile(user.id, createClient);
  // 회원 탈퇴(deleted)/차단(blocked) 계정은 동의 기록을 남기지 못하게 차단.
  if (!isActiveStatus(profile.status)) {
    redirect(`${ACCOUNT_INACTIVE_PATH}?status=${profile.status}`);
  }
  const missingDocuments = await getMissingRequiredConsentDocuments(
    user.id,
    profile.ui_locale,
    createClient,
  );

  await recordRequiredConsents(user.id, missingDocuments, "signup", createClient);
  redirect(next);
}
