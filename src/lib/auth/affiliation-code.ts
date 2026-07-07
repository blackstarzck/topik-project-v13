import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export const AFFILIATION_CODE_PARAM = "aff";
export const AFFILIATION_CODE_STORAGE_KEY = "talkpik:affiliation-code";

const AFFILIATION_CODE_TTL_MS = 30 * 60 * 1000;
const AFFILIATION_CODE_PATTERN = /^[A-Za-z0-9_-]{2,64}$/;

export type StoredAffiliationCode = {
  code: string;
  capturedAt: number;
  expiresAt: number;
};

export type AffiliationMetadata = {
  affiliation_code?: string;
};

export type ClaimAffiliationCodeResult = "empty" | "claimed" | "failed";
export type AcceptAffiliationInviteResult =
  | "empty"
  | "accepted"
  | "invalid"
  | "already_affiliated_same"
  | "already_affiliated_other"
  | "profile_not_found"
  | "failed";

const ACCEPT_AFFILIATION_INVITE_RESULTS = new Set<
  Exclude<AcceptAffiliationInviteResult, "empty">
>([
  "accepted",
  "invalid",
  "already_affiliated_same",
  "already_affiliated_other",
  "profile_not_found",
  "failed",
]);

type SupabaseRpcErrorLike = {
  code?: string;
  message?: string;
};

type ProfileAffiliationSnapshot = {
  affiliation_code: string | null;
  status?: "active" | "blocked" | "deleted" | null;
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeAffiliationCode(
  value: string | null | undefined,
): string | null {
  const code = value?.trim() ?? "";
  return AFFILIATION_CODE_PATTERN.test(code) ? code : null;
}

function parseStoredAffiliationCode(raw: string): StoredAffiliationCode | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAffiliationCode>;
    const code = normalizeAffiliationCode(parsed.code);
    if (!code) return null;
    if (
      typeof parsed.capturedAt !== "number" ||
      !Number.isFinite(parsed.capturedAt) ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      return null;
    }
    return {
      code,
      capturedAt: parsed.capturedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function storeAffiliationCode(
  value: string,
  capturedAt = Date.now(),
): StoredAffiliationCode | null {
  const code = normalizeAffiliationCode(value);
  const storage = getStorage();
  if (!code || !storage) return null;

  const stored = {
    code,
    capturedAt,
    expiresAt: capturedAt + AFFILIATION_CODE_TTL_MS,
  };
  storage.setItem(AFFILIATION_CODE_STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

export function captureAffiliationCodeFromSearch(
  searchParams: URLSearchParams,
  capturedAt = Date.now(),
): string | null {
  if (!searchParams.has(AFFILIATION_CODE_PARAM)) return null;
  return (
    storeAffiliationCode(
      searchParams.get(AFFILIATION_CODE_PARAM) ?? "",
      capturedAt,
    )?.code ?? null
  );
}

export function clearStoredAffiliationCode() {
  getStorage()?.removeItem(AFFILIATION_CODE_STORAGE_KEY);
}

export function readStoredAffiliationCode(now = Date.now()): string | null {
  const storage = getStorage();
  const raw = storage?.getItem(AFFILIATION_CODE_STORAGE_KEY);
  if (!storage || !raw) return null;

  const stored = parseStoredAffiliationCode(raw);
  if (!stored || stored.expiresAt <= now) {
    storage.removeItem(AFFILIATION_CODE_STORAGE_KEY);
    return null;
  }

  return stored.code;
}

export function buildAffiliationMetadata(
  now = Date.now(),
): AffiliationMetadata {
  const affiliationCode = readStoredAffiliationCode(now);
  return affiliationCode ? { affiliation_code: affiliationCode } : {};
}

function parseAcceptInviteResult(data: unknown): AcceptAffiliationInviteResult {
  if (
    typeof data === "object" &&
    data !== null &&
    "status" in data &&
    typeof data.status === "string" &&
    ACCEPT_AFFILIATION_INVITE_RESULTS.has(
      data.status as Exclude<AcceptAffiliationInviteResult, "empty">,
    )
  ) {
    return data.status as AcceptAffiliationInviteResult;
  }

  return "failed";
}

function shouldUseLegacyClaimFallback(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const rpcError = error as SupabaseRpcErrorLike;
  return (
    rpcError.code === "PGRST202" &&
    typeof rpcError.message === "string" &&
    rpcError.message.includes("accept_affiliation_invite")
  );
}

async function readProfileAffiliationAfterLegacyClaim(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  affiliationCode: string,
): Promise<AcceptAffiliationInviteResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return "failed";

  const { data, error } = await supabase
    .from("profiles")
    .select("affiliation_code,status")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return "failed";
  if (!data) return "profile_not_found";

  const profile = data as ProfileAffiliationSnapshot;
  if (profile.status && profile.status !== "active") return "failed";

  const currentAffiliationCode = normalizeAffiliationCode(
    profile.affiliation_code,
  );
  if (currentAffiliationCode === affiliationCode) return "accepted";
  if (currentAffiliationCode) return "already_affiliated_other";
  return "failed";
}

async function claimWithLegacyRpcFallback(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  affiliationCode: string,
): Promise<AcceptAffiliationInviteResult> {
  const { error } = await supabase.rpc("claim_affiliation_code", {
    p_code: affiliationCode,
  });
  if (error) return "failed";

  return readProfileAffiliationAfterLegacyClaim(supabase, affiliationCode);
}

export async function acceptStoredAffiliationInvite(
  now = Date.now(),
): Promise<AcceptAffiliationInviteResult> {
  const affiliationCode = readStoredAffiliationCode(now);
  if (!affiliationCode) return "empty";

  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("accept_affiliation_invite", {
      p_code: affiliationCode,
      p_confirmed: true,
    });
    if (error && shouldUseLegacyClaimFallback(error)) {
      const result = await claimWithLegacyRpcFallback(
        supabase,
        affiliationCode,
      );
      if (result === "accepted") {
        clearStoredAffiliationCode();
      }
      return result;
    }
    if (error) return "failed";

    const result = parseAcceptInviteResult(data);
    if (
      result === "accepted" ||
      result === "already_affiliated_same" ||
      result === "invalid" ||
      result === "profile_not_found"
    ) {
      clearStoredAffiliationCode();
    }
    return result;
  } catch {
    return "failed";
  }
}

export async function claimStoredAffiliationCode(
  now = Date.now(),
): Promise<ClaimAffiliationCodeResult> {
  const result = await acceptStoredAffiliationInvite(now);
  if (result === "empty") return "empty";
  if (result === "accepted" || result === "already_affiliated_same") {
    return "claimed";
  }
  return "failed";
}
