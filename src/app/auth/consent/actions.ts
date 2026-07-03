"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  localeFromRequestHints,
  type RequestLocaleSource,
} from "@/i18n/detection";
import { LOCALE_COOKIE, type Locale } from "@/i18n/locales";
import { requireVerifiedActiveSession } from "@/lib/auth/access-gate";
import { sanitizeAuthCompletionNext } from "@/lib/auth/completion-routes";
import {
  getMissingRequiredProfileFields,
  isRequiredProfileInputValid,
  normalizeAuthCompletionProfileInput,
} from "@/lib/auth/profile-completion";
import { getMissingRequiredConsentDocuments } from "@/lib/legal/consent";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuthConsentActionError = "required" | "nickname-taken" | "save-failed";
type SupabaseRpcErrorLike = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

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

function getRpcFailureCategory(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "auth_completion_rpc_failed";
  }
  const candidate = error as SupabaseRpcErrorLike;
  const text = `${String(candidate.message ?? "")} ${String(
    candidate.details ?? "",
  )}`.toLowerCase();

  if (candidate.code === "PGRST202") {
    return "auth_completion_rpc_missing_or_stale";
  }
  if (candidate.code === "42501" || text.includes("permission denied")) {
    return "auth_completion_rpc_permission_denied";
  }
  if (isRequiredCompletionError(error)) {
    return "auth_completion_required";
  }
  if (isNicknameUniqueError(error)) {
    return "auth_completion_nickname_conflict";
  }
  return "auth_completion_rpc_failed";
}

function logAuthCompletionRpcFailure({
  error,
  missingConsentCount,
  missingProfileFieldCount,
  next,
}: {
  error: unknown;
  missingConsentCount: number;
  missingProfileFieldCount: number;
  next: string;
}) {
  const candidate =
    error && typeof error === "object" ? (error as SupabaseRpcErrorLike) : {};

  console.error("auth_consent_rpc_failed", {
    category: getRpcFailureCategory(error),
    code: typeof candidate.code === "string" ? candidate.code : candidate.code,
    details:
      typeof candidate.details === "string"
        ? candidate.details
        : candidate.details,
    hint: typeof candidate.hint === "string" ? candidate.hint : candidate.hint,
    message:
      typeof candidate.message === "string"
        ? candidate.message
        : candidate.message,
    missingConsentCount,
    missingProfileFieldCount,
    next,
    route: "/auth/consent",
  });
}

async function getRequestLocaleSeed(): Promise<{
  locale: Locale;
  source: RequestLocaleSource;
} | null> {
  let cookieLocale: string | null | undefined;
  try {
    const cookieStore = await cookies();
    cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  } catch {
    cookieLocale = null;
  }

  let acceptLanguage: string | null | undefined;
  try {
    const headerStore = await headers();
    acceptLanguage = headerStore.get("accept-language");
  } catch {
    acceptLanguage = null;
  }

  const hint = localeFromRequestHints({ cookieLocale, acceptLanguage });
  if (!hint.locale || !hint.source) return null;
  return { locale: hint.locale, source: hint.source };
}

export async function completeAuthGateAction(formData: FormData) {
  const next = sanitizeAuthCompletionNext(
    formData.get("next")?.toString(),
    "/auth/post-auth?intent=login",
  );

  const { user, profile } = await requireVerifiedActiveSession();
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
  const localeSeed =
    profile.ui_locale_source === "default"
      ? await getRequestLocaleSeed()
      : null;
  const localeForDocuments = localeSeed?.locale ?? profile.ui_locale;

  const missingDocuments = await getMissingRequiredConsentDocuments(
    user.id,
    localeForDocuments,
    createClient,
  );
  const acceptRequiredConsents = missingDocuments.length > 0;
  if (acceptRequiredConsents && formData.get("accept") === null) {
    redirect(buildConsentRetryPath(next, "required"));
  }

  const rpcInput: {
    p_display_name: string | null;
    p_nickname: string | null;
    p_nationality_country_code: string | null;
    p_accept_required_consents: boolean;
    p_ui_locale?: Locale;
    p_ui_locale_source?: RequestLocaleSource;
  } = {
    p_display_name: input.display_name,
    p_nickname: input.nickname,
    p_nationality_country_code: input.nationality_country_code,
    p_accept_required_consents: acceptRequiredConsents,
  };
  if (localeSeed) {
    rpcInput.p_ui_locale = localeSeed.locale;
    rpcInput.p_ui_locale_source = localeSeed.source;
  }

  const { error } = await supabase.rpc("complete_auth_gate", rpcInput);

  if (error) {
    logAuthCompletionRpcFailure({
      error,
      missingConsentCount: missingDocuments.length,
      missingProfileFieldCount: missingProfileFields.length,
      next,
    });
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
