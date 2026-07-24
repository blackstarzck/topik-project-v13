import type { User } from "@supabase/supabase-js";

import { bootstrapProfile } from "@/lib/auth/profile";
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

type ClientFactory = () => Promise<SupabaseServerClient>;

export type LegalLocale = Tables<"profiles">["ui_locale"];

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
  | "is_placeholder"
  | "source_policy_id"
>;

export class LegalDocumentsUnavailableError extends Error {
  readonly code = "legal_documents_unavailable";

  constructor() {
    super("Required legal documents are unavailable.");
    this.name = "LegalDocumentsUnavailableError";
  }
}

const FALLBACK_LOCALE: LegalLocale = "ko";
const LEGAL_LOCALES = new Set<LegalLocale>(["ko", "en", "vi"]);
const RANDOM_NICKNAME_PREFIX = "talkpik";
const RANDOM_NICKNAME_LENGTH = 6;
const RANDOM_NICKNAME_SPACE = 36 ** RANDOM_NICKNAME_LENGTH;
const REQUIRED_DOCUMENT_TYPES = new Set<RequiredConsentDocument["doc_type"]>([
  "privacy",
  "terms",
]);

function coerceLegalLocale(value: string | null | undefined): LegalLocale {
  return LEGAL_LOCALES.has(value as LegalLocale)
    ? (value as LegalLocale)
    : FALLBACK_LOCALE;
}

function rowTime(row: RequiredConsentDocument): number {
  const parsed = Date.parse(row.effective_at ?? row.created_at);
  if (!Number.isFinite(parsed)) {
    throw new LegalDocumentsUnavailableError();
  }
  return parsed;
}

function latestByDocType(
  rows: RequiredConsentDocument[],
): RequiredConsentDocument[] {
  const latest = new Map<
    RequiredConsentDocument["doc_type"],
    { ambiguous: boolean; row: RequiredConsentDocument; time: number }
  >();

  for (const row of rows) {
    const time = rowTime(row);
    const current = latest.get(row.doc_type);
    if (!current || time > current.time) {
      latest.set(row.doc_type, { ambiguous: false, row, time });
      continue;
    }
    if (time === current.time && row.id !== current.row.id) {
      latest.set(row.doc_type, { ...current, ambiguous: true });
    }
  }

  if ([...latest.values()].some(({ ambiguous }) => ambiguous)) {
    throw new LegalDocumentsUnavailableError();
  }

  return [...latest.values()]
    .map(({ row }) => row)
    .sort((a, b) => a.doc_type.localeCompare(b.doc_type));
}

function isTrustedOfficialDocument(row: RequiredConsentDocument): boolean {
  return (
    typeof row.source_policy_id === "string" &&
    row.source_policy_id.trim().length > 0 &&
    row.is_placeholder === false
  );
}

function isCompletionRpcCandidate(row: RequiredConsentDocument): boolean {
  return row.source_policy_id !== null || row.is_placeholder === true;
}

function hasCompleteRequiredSet(rows: RequiredConsentDocument[]): boolean {
  const available = new Set(rows.map((row) => row.doc_type));
  return [...REQUIRED_DOCUMENT_TYPES].every((docType) =>
    available.has(docType),
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
      "id, doc_type, version, locale, title, summary, body, effective_at, created_at, is_placeholder, source_policy_id",
    )
    .eq("locale", locale)
    .eq("status", "published")
    .eq("requires_consent", true)
    .not("source_policy_id", "is", null)
    .eq("is_placeholder", false);

  if (error) {
    throw new Error(
      `Failed to load required legal documents: ${error.message}`,
    );
  }

  return latestByDocType(
    ((data ?? []) as RequiredConsentDocument[]).filter(
      isTrustedOfficialDocument,
    ),
  );
}

async function fetchCompletionRpcCandidateDocuments(
  locale: LegalLocale,
  createClient: ClientFactory,
): Promise<RequiredConsentDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("legal_documents")
    .select(
      "id, doc_type, version, locale, title, summary, body, effective_at, created_at, is_placeholder, source_policy_id",
    )
    .eq("locale", locale)
    .eq("status", "published")
    .eq("requires_consent", true);

  if (error) {
    throw new Error(
      `Failed to validate legal document projection: ${error.message}`,
    );
  }

  return latestByDocType(
    ((data ?? []) as RequiredConsentDocument[]).filter(
      isCompletionRpcCandidate,
    ),
  );
}

async function assertCompletionRpcProjectionMatches(
  locale: string | null | undefined,
  requiredDocuments: RequiredConsentDocument[],
  createClient: ClientFactory,
): Promise<void> {
  const requestedLocale = coerceLegalLocale(locale);
  let rpcDocuments = await fetchCompletionRpcCandidateDocuments(
    requestedLocale,
    createClient,
  );
  if (rpcDocuments.length === 0 && requestedLocale !== FALLBACK_LOCALE) {
    rpcDocuments = await fetchCompletionRpcCandidateDocuments(
      FALLBACK_LOCALE,
      createClient,
    );
  }

  const requiredByType = new Map(
    requiredDocuments.map((document) => [document.doc_type, document.id]),
  );
  const projectionMatches =
    rpcDocuments.length === requiredDocuments.length &&
    rpcDocuments.every(
      (document) => requiredByType.get(document.doc_type) === document.id,
    );

  if (!projectionMatches) {
    throw new LegalDocumentsUnavailableError();
  }
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
  if (hasCompleteRequiredSet(localized)) {
    return localized;
  }
  if (requestedLocale !== FALLBACK_LOCALE) {
    const fallback = await fetchRequiredConsentDocuments(
      FALLBACK_LOCALE,
      createClient,
    );
    if (hasCompleteRequiredSet(fallback)) return fallback;
  }
  throw new LegalDocumentsUnavailableError();
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
  await assertCompletionRpcProjectionMatches(
    locale,
    requiredDocuments,
    createClient,
  );
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
