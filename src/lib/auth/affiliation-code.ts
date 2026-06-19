import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export const AFFILIATION_CODE_PARAM = "aff";
export const AFFILIATION_CODE_STORAGE_KEY = "talkpik:affiliation-code";

const AFFILIATION_CODE_TTL_MS = 24 * 60 * 60 * 1000;
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
  return storeAffiliationCode(
    searchParams.get(AFFILIATION_CODE_PARAM) ?? "",
    capturedAt,
  )?.code ?? null;
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

export function buildAffiliationMetadata(now = Date.now()): AffiliationMetadata {
  const affiliationCode = readStoredAffiliationCode(now);
  return affiliationCode ? { affiliation_code: affiliationCode } : {};
}

export async function claimStoredAffiliationCode(
  now = Date.now(),
): Promise<ClaimAffiliationCodeResult> {
  const affiliationCode = readStoredAffiliationCode(now);
  if (!affiliationCode) return "empty";

  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("claim_affiliation_code", {
      p_code: affiliationCode,
    });
    if (error) return "failed";
    clearStoredAffiliationCode();
    return "claimed";
  } catch {
    return "failed";
  }
}
