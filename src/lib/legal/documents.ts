// Read-only access to published legal_documents for the public legal pages
// (X-13 terms, X-14 privacy). legal_documents is the USER-facing projection of
// the admin operation_policies (owner decision 2026-06-22: admin is the single
// source of truth; v13 only displays). Published rows are anon-readable via RLS
// (legal_documents_published_read), so these pages work before sign-in.

import {
  createSupabasePublicServerClient,
  createSupabaseServerClient,
  type SupabasePublicServerClient,
  type SupabaseServerClient,
} from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type PublishedLegalDocument = Pick<
  Tables<"legal_documents">,
  | "id"
  | "doc_type"
  | "version"
  | "locale"
  | "title"
  | "body"
  | "summary"
  | "effective_at"
  | "is_placeholder"
>;

type LegalDocumentsClient = Pick<
  SupabaseServerClient | SupabasePublicServerClient,
  "from"
>;
type ClientFactory = () => LegalDocumentsClient | Promise<LegalDocumentsClient>;
type LegalDocType = Tables<"legal_documents">["doc_type"];
type LegalLocale = Tables<"legal_documents">["locale"];

const SELECT_COLUMNS =
  "id, doc_type, version, locale, title, body, summary, effective_at, is_placeholder";
const FALLBACK_LOCALE: LegalLocale = "ko";
const LEGAL_LOCALES = new Set<LegalLocale>(["ko", "en", "vi"]);

function coerceLegalLocale(value: string | null | undefined): LegalLocale {
  return LEGAL_LOCALES.has(value as LegalLocale)
    ? (value as LegalLocale)
    : FALLBACK_LOCALE;
}

function isAuthTokenReadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);

  return (
    message.includes("no suitable key") ||
    message.includes("wrong key type") ||
    (message.includes("jwt") &&
      (message.includes("invalid") || message.includes("expired")))
  );
}

async function fetchPublished(
  docType: LegalDocType,
  locale: LegalLocale,
  createClient: ClientFactory,
): Promise<PublishedLegalDocument | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("legal_documents")
    .select(SELECT_COLUMNS)
    .eq("doc_type", docType)
    .eq("locale", locale)
    .eq("status", "published")
    .order("effective_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load published legal document: ${error.message}`);
  }
  return (data?.[0] as PublishedLegalDocument | undefined) ?? null;
}

async function fetchPublishedWithLocaleFallback(
  docType: LegalDocType,
  requested: LegalLocale,
  createClient: ClientFactory,
): Promise<PublishedLegalDocument | null> {
  const localized = await fetchPublished(docType, requested, createClient);
  if (localized || requested === FALLBACK_LOCALE) {
    return localized;
  }
  return fetchPublished(docType, FALLBACK_LOCALE, createClient);
}

/**
 * Latest published legal document for a doc_type in the requested locale, falling
 * back to Korean when the requested locale has no published row (e.g. vi). Returns
 * null when nothing is published yet (caller renders the i18n placeholder).
 */
export async function getPublishedLegalDocument(
  docType: LegalDocType,
  locale: string | null | undefined,
  createClient: ClientFactory = createSupabaseServerClient,
  createPublicClient: ClientFactory = createSupabasePublicServerClient,
): Promise<PublishedLegalDocument | null> {
  const requested = coerceLegalLocale(locale);
  try {
    return await fetchPublishedWithLocaleFallback(
      docType,
      requested,
      createClient,
    );
  } catch (error) {
    if (!isAuthTokenReadError(error)) {
      throw error;
    }

    return fetchPublishedWithLocaleFallback(
      docType,
      requested,
      createPublicClient,
    );
  }
}
