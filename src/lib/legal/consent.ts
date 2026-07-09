import type { User } from "@supabase/supabase-js";

import { bootstrapProfile } from "@/lib/auth/profile";
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/lib/supabase/types";

type ClientFactory = () => Promise<SupabaseServerClient>;

export type LegalLocale = Tables<"profiles">["ui_locale"];
export type ConsentSource = TablesInsert<"user_consents">["source"];

export type RequiredConsentDocument = Pick<
  Tables<"legal_documents">,
  | "id"
  | "doc_type"
  | "version"
  | "locale"
  | "title"
  | "summary"
  | "body"
  | "effective_at"
  | "created_at"
>;

const FALLBACK_LOCALE: LegalLocale = "ko";
const LEGAL_LOCALES = new Set<LegalLocale>(["ko", "en", "vi"]);
const RANDOM_NICKNAME_PREFIX = "talkpik";
const RANDOM_NICKNAME_LENGTH = 6;
const RANDOM_NICKNAME_SPACE = 36 ** RANDOM_NICKNAME_LENGTH;

function coerceLegalLocale(value: string | null | undefined): LegalLocale {
  return LEGAL_LOCALES.has(value as LegalLocale)
    ? (value as LegalLocale)
    : FALLBACK_LOCALE;
}

function rowTime(row: RequiredConsentDocument): number {
  return Date.parse(row.effective_at ?? row.created_at);
}

function latestByDocType(
  rows: RequiredConsentDocument[],
): RequiredConsentDocument[] {
  const latest = new Map<
    RequiredConsentDocument["doc_type"],
    RequiredConsentDocument
  >();

  for (const row of rows) {
    const current = latest.get(row.doc_type);
    if (!current || rowTime(row) > rowTime(current)) {
      latest.set(row.doc_type, row);
    }
  }

  return [...latest.values()].sort((a, b) =>
    a.doc_type.localeCompare(b.doc_type),
  );
}

async function fetchRequiredConsentDocuments(
  locale: LegalLocale,
  createClient: ClientFactory,
): Promise<RequiredConsentDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("legal_documents")
    .select(
      "id, doc_type, version, locale, title, summary, body, effective_at, created_at",
    )
    .eq("locale", locale)
    .eq("status", "published")
    .eq("requires_consent", true)
    // Trust only documents that came through the admin projection
    // (source_policy_id set) or seeded placeholders. Rows inserted directly into
    // legal_documents (e.g. E2E test seeds, which never set source_policy_id and
    // are not placeholders) must never surface in the consent gate.
    .or("source_policy_id.not.is.null,is_placeholder.is.true");

  if (error) {
    throw new Error(
      `Failed to load required legal documents: ${error.message}`,
    );
  }

  return latestByDocType(data ?? []);
}

export async function getRequiredConsentDocuments(
  locale: string | null | undefined,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<RequiredConsentDocument[]> {
  const requestedLocale = coerceLegalLocale(locale);
  const localized = await fetchRequiredConsentDocuments(
    requestedLocale,
    createClient,
  );
  if (localized.length > 0 || requestedLocale === FALLBACK_LOCALE) {
    return localized;
  }
  return fetchRequiredConsentDocuments(FALLBACK_LOCALE, createClient);
}

export async function getMissingRequiredConsentDocuments(
  userId: string,
  locale: string | null | undefined,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<RequiredConsentDocument[]> {
  const requiredDocuments = await getRequiredConsentDocuments(
    locale,
    createClient,
  );
  if (requiredDocuments.length === 0) return [];

  const supabase = await createClient();
  const documentIds = requiredDocuments.map((doc) => doc.id);
  const { data, error } = await supabase
    .from("user_consents")
    .select("document_id")
    .eq("user_id", userId)
    .in("document_id", documentIds);

  if (error) {
    throw new Error(`Failed to load user consents: ${error.message}`);
  }

  const acceptedIds = new Set((data ?? []).map((row) => row.document_id));
  return requiredDocuments.filter((doc) => !acceptedIds.has(doc.id));
}

export async function recordRequiredConsents(
  userId: string,
  documents: RequiredConsentDocument[],
  source: ConsentSource = "signup",
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<void> {
  if (documents.length === 0) return;

  const supabase = await createClient();
  const rows: TablesInsert<"user_consents">[] = documents.map((doc) => ({
    user_id: userId,
    document_id: doc.id,
    doc_type: doc.doc_type,
    version: doc.version,
    source,
  }));
  const { error } = await supabase.from("user_consents").insert(rows);

  if (error) {
    throw new Error(`Failed to record user consents: ${error.message}`);
  }
}

function readUserDisplayName(user: User): string | null {
  for (const key of ["display_name", "full_name", "name"] as const) {
    const value = user.user_metadata?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function generateRandomNickname(
  random: () => number = Math.random,
): string {
  const value = Math.floor(random() * RANDOM_NICKNAME_SPACE)
    .toString(36)
    .padStart(RANDOM_NICKNAME_LENGTH, "0")
    .slice(0, RANDOM_NICKNAME_LENGTH);
  return `${RANDOM_NICKNAME_PREFIX}-${value}`;
}

export async function backfillOAuthDisplayName(
  user: User,
  createClient: ClientFactory = createSupabaseServerClient,
  random: () => number = Math.random,
): Promise<Tables<"profiles">> {
  const profile = await bootstrapProfile(user.id, createClient);
  const patch: Partial<Pick<Tables<"profiles">, "display_name" | "nickname">> =
    {};

  if (!profile.display_name?.trim()) {
    const displayName = readUserDisplayName(user);
    if (displayName) patch.display_name = displayName;
  }

  if (
    profile.nickname == null ||
    (typeof profile.nickname === "string" &&
      profile.nickname.trim().length === 0)
  ) {
    patch.nickname = generateRandomNickname(random);
  }

  if (Object.keys(patch).length === 0) return profile;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to backfill OAuth profile: ${error.message}`);
  }

  return data ?? { ...profile, ...patch };
}
