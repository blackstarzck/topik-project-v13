"use server";

import { redirect } from "next/navigation";

import { sanitizeAuthCompletionNext } from "@/lib/auth/completion-routes";
import {
  getMissingRequiredProfileFields,
  isRequiredProfileInputValid,
  normalizeAuthCompletionProfileInput,
} from "@/lib/auth/profile-completion";
import { requireActiveSession } from "@/lib/auth/profile";
import { getMissingRequiredConsentDocuments } from "@/lib/legal/consent";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuthConsentActionError = "required" | "nickname-taken" | "save-failed";

function buildConsentRetryPath(
  next: string,
  error: AuthConsentActionError,
): string {
  const params = new URLSearchParams({ next, error });
  return `/auth/consent?${params.toString()}`;
}

function isNicknameUniqueError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  const text = `${String(candidate.message ?? "")} ${String(
    candidate.details ?? "",
  )}`.toLowerCase();
  return (
    candidate.code === "23505" ||
    text.includes("profiles_nickname_lower_uniq") ||
    text.includes("nickname_taken")
  );
}

function isRequiredCompletionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; details?: unknown };
  const text = `${String(candidate.message ?? "")} ${String(
    candidate.details ?? "",
  )}`.toLowerCase();
  return text.includes("auth_completion_required");
}

export async function completeAuthGateAction(formData: FormData) {
  const next = sanitizeAuthCompletionNext(
    formData.get("next")?.toString(),
    "/auth/post-auth?intent=login",
  );

  const { user, profile } = await requireActiveSession();
  const missingProfileFields = getMissingRequiredProfileFields(profile);
  const input = normalizeAuthCompletionProfileInput({
    display_name: formData.get("display_name")?.toString(),
    nickname: formData.get("nickname")?.toString(),
    nationality_country_code: formData
      .get("nationality_country_code")
      ?.toString(),
  });
  const fieldsToValidate = new Set(missingProfileFields);
  if (formData.has("nickname")) {
    fieldsToValidate.add("nickname");
  }

  const hasInvalidProfileInput = [...fieldsToValidate].some(
    (field) => !isRequiredProfileInputValid(field, input),
  );
  if (hasInvalidProfileInput) {
    redirect(buildConsentRetryPath(next, "required"));
  }

  const supabase = await createSupabaseServerClient();
  const createClient = async () => supabase;
  const missingDocuments = await getMissingRequiredConsentDocuments(
    user.id,
    profile.ui_locale,
    createClient,
  );
  const acceptRequiredConsents = missingDocuments.length > 0;
  if (acceptRequiredConsents && formData.get("accept") === null) {
    redirect(buildConsentRetryPath(next, "required"));
  }

  const { error } = await supabase.rpc("complete_auth_gate", {
    p_display_name: input.display_name,
    p_nickname: input.nickname,
    p_nationality_country_code: input.nationality_country_code,
    p_accept_required_consents: acceptRequiredConsents,
  });

  if (error) {
    if (isNicknameUniqueError(error)) {
      redirect(buildConsentRetryPath(next, "nickname-taken"));
    }
    if (isRequiredCompletionError(error)) {
      redirect(buildConsentRetryPath(next, "required"));
    }
    redirect(buildConsentRetryPath(next, "save-failed"));
  }

  redirect(next);
}

export const acceptRequiredConsentsAction = completeAuthGateAction;
