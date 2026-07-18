import type { Json } from "../supabase/types";
import { isQuestionNo, type QuestionNo } from "./types";

export const CLIENT_RECOVERY_DB_NAME = "talkpik-client-recovery";
export const CLIENT_RECOVERY_STORE_NAME = "writing-drafts";
export const CLIENT_RECOVERY_VERSION = 1;
export const CLIENT_RECOVERY_MAX_BYTES = 256 * 1024;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RETENTION_MS = 7 * DAY_MS;

export type ClientRecoveryRetention = "default" | "extended";
export type ClientSubmissionIntent = {
  createdAt: string;
  fingerprint: string;
  intentId: string;
  state: "pending" | "ambiguous";
};

export type ClientRecoveryRecordV1 = {
  answerJson: Json | null;
  answerText: string;
  canonicalQuestionId: string | null;
  draftId: string | null;
  expiresAt: string;
  firstStoredAt: string;
  importId: string | null;
  key: string;
  payloadHash: string | null;
  problemId: string;
  questionNo: QuestionNo;
  retention: ClientRecoveryRetention;
  savedAt: string;
  schemaVersion: 1;
  serverSyncedAt?: string;
  submissionIntent?: ClientSubmissionIntent;
  userId: string;
};

export type ClientRecoveryScope = Pick<
  ClientRecoveryRecordV1,
  "problemId" | "questionNo" | "userId"
>;

export type ClientRecoverySaveInput = Pick<
  ClientRecoveryRecordV1,
  | "answerJson"
  | "answerText"
  | "canonicalQuestionId"
  | "draftId"
  | "importId"
  | "payloadHash"
  | "problemId"
  | "questionNo"
  | "userId"
>;

export type ClientRecoveryLoadResult =
  | { record: ClientRecoveryRecordV1; status: "found" }
  | { status: "missing" | "corrupt" | "expired" }
  | { schemaVersion: number; status: "incompatible" };

export interface ClientRecoveryStorageAdapter {
  delete(key: string): Promise<void>;
  deleteIfUnchanged(
    key: string,
    expected: ClientRecoveryRecordV1,
  ): Promise<boolean>;
  get(key: string): Promise<unknown | undefined>;
  list(): Promise<unknown[]>;
  put(value: unknown): Promise<void>;
  putIfUnchanged(
    key: string,
    expected: ClientRecoveryRecordV1,
    replacement: ClientRecoveryRecordV1,
  ): Promise<boolean>;
}

export interface SubmissionIntentPersistence {
  clear(intentId: string): Promise<void>;
  find(fingerprint: string): Promise<ClientSubmissionIntent | null>;
  markAmbiguous(intentId: string): Promise<void>;
  persist(intent: ClientSubmissionIntent): Promise<void>;
}

export type ClientRecoveryErrorCode =
  | "incompatible_record"
  | "invalid_record"
  | "quota_exceeded"
  | "record_changed"
  | "record_expired"
  | "record_missing"
  | "record_too_large"
  | "storage_failed"
  | "storage_unavailable";

const SAFE_ERROR_MESSAGES: Record<ClientRecoveryErrorCode, string> = {
  incompatible_record: "The recovery record version is not supported.",
  invalid_record: "The recovery record is invalid.",
  quota_exceeded: "The recovery record could not be stored.",
  record_changed: "The recovery record changed in another tab.",
  record_expired: "The recovery record retention period has ended.",
  record_missing: "The recovery record does not exist.",
  record_too_large: "The recovery record is too large.",
  storage_failed: "The recovery storage operation failed.",
  storage_unavailable: "Client recovery storage is unavailable.",
};

export class ClientRecoveryError extends Error {
  constructor(readonly code: ClientRecoveryErrorCode) {
    super(SAFE_ERROR_MESSAGES[code]);
    this.name = "ClientRecoveryError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function timestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? parsed
    : null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
) {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function validateSubmissionIntent(
  value: unknown,
): value is ClientSubmissionIntent {
  if (!isRecord(value)) return false;
  return (
    hasExactKeys(value, ["createdAt", "fingerprint", "intentId", "state"]) &&
    timestamp(value.createdAt) !== null &&
    isNonEmptyString(value.fingerprint) &&
    isNonEmptyString(value.intentId) &&
    (value.state === "pending" || value.state === "ambiguous")
  );
}

function canonicalize(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const child = value[key];
      if (child === undefined) throw new ClientRecoveryError("invalid_record");
      result[key] = canonicalize(child);
    }
    return result;
  }
  throw new ClientRecoveryError("invalid_record");
}

function canonicalRecordEnvelope(record: ClientRecoveryRecordV1) {
  return {
    key: record.key,
    metadata: {
      canonicalQuestionId: record.canonicalQuestionId,
      draftId: record.draftId,
      expiresAt: record.expiresAt,
      firstStoredAt: record.firstStoredAt,
      importId: record.importId,
      payloadHash: record.payloadHash,
      problemId: record.problemId,
      questionNo: record.questionNo,
      retention: record.retention,
      savedAt: record.savedAt,
      schemaVersion: record.schemaVersion,
      ...(record.serverSyncedAt === undefined
        ? {}
        : { serverSyncedAt: record.serverSyncedAt }),
      ...(record.submissionIntent === undefined
        ? {}
        : { submissionIntent: record.submissionIntent }),
      userId: record.userId,
    },
    value: {
      answerJson: record.answerJson,
      answerText: record.answerText,
    },
  };
}

export function measureClientRecoveryRecordBytes(
  record: ClientRecoveryRecordV1,
) {
  const canonical = JSON.stringify(
    canonicalize(canonicalRecordEnvelope(record)),
  );
  return new TextEncoder().encode(canonical).byteLength;
}

function validateRecord(value: unknown): value is ClientRecoveryRecordV1 {
  if (!isRecord(value)) return false;
  const required = [
    "answerJson",
    "answerText",
    "canonicalQuestionId",
    "draftId",
    "expiresAt",
    "firstStoredAt",
    "importId",
    "key",
    "payloadHash",
    "problemId",
    "questionNo",
    "retention",
    "savedAt",
    "schemaVersion",
    "userId",
  ];
  if (!hasExactKeys(value, required, ["serverSyncedAt", "submissionIntent"])) {
    return false;
  }
  if (
    value.schemaVersion !== 1 ||
    !isNonEmptyString(value.key) ||
    !isNonEmptyString(value.userId) ||
    !isNonEmptyString(value.problemId) ||
    !isQuestionNo(value.questionNo) ||
    typeof value.answerText !== "string" ||
    !isNullableString(value.canonicalQuestionId) ||
    !isNullableString(value.importId) ||
    !isNullableString(value.payloadHash) ||
    !isNullableString(value.draftId) ||
    (value.retention !== "default" && value.retention !== "extended") ||
    (value.serverSyncedAt !== undefined &&
      timestamp(value.serverSyncedAt) === null) ||
    (value.submissionIntent !== undefined &&
      !validateSubmissionIntent(value.submissionIntent))
  ) {
    return false;
  }
  try {
    canonicalize(value.answerJson);
  } catch {
    return false;
  }
  const firstStoredAt = timestamp(value.firstStoredAt);
  const savedAt = timestamp(value.savedAt);
  const expiresAt = timestamp(value.expiresAt);
  if (firstStoredAt === null || savedAt === null || expiresAt === null) {
    return false;
  }
  if (savedAt < firstStoredAt) return false;
  const cap = firstStoredAt + MAX_RETENTION_MS;
  const expectedExpiry =
    value.retention === "extended" ? cap : Math.min(savedAt + DAY_MS, cap);
  return expiresAt === expectedExpiry;
}

export function buildClientRecoveryKey(scope: ClientRecoveryScope) {
  if (
    !isNonEmptyString(scope.userId) ||
    !isNonEmptyString(scope.problemId) ||
    scope.userId.includes(":") ||
    scope.problemId.includes(":") ||
    !isQuestionNo(scope.questionNo)
  ) {
    throw new ClientRecoveryError("invalid_record");
  }
  return `${scope.userId}:${scope.problemId}:${scope.questionNo}`;
}

function isQuotaExceeded(error: unknown) {
  return isRecord(error) && error.name === "QuotaExceededError";
}

function sameRecoveryValue(
  current: ClientRecoveryRecordV1,
  input: ClientRecoverySaveInput,
) {
  try {
    return (
      current.answerText === input.answerText &&
      JSON.stringify(canonicalize(current.answerJson)) ===
        JSON.stringify(canonicalize(input.answerJson)) &&
      current.canonicalQuestionId === input.canonicalQuestionId &&
      current.importId === input.importId &&
      current.payloadHash === input.payloadHash &&
      current.draftId === input.draftId
    );
  } catch {
    return false;
  }
}

function sameStoredRecord(
  current: unknown,
  expected: ClientRecoveryRecordV1,
): boolean {
  if (!validateRecord(current)) return false;
  try {
    return (
      JSON.stringify(canonicalize(canonicalRecordEnvelope(current))) ===
      JSON.stringify(canonicalize(canonicalRecordEnvelope(expected)))
    );
  } catch {
    return false;
  }
}

export class ClientRecoveryRepository {
  private readonly now: () => number;

  constructor(
    private readonly storage: ClientRecoveryStorageAdapter,
    options: { now?: () => number } = {},
  ) {
    this.now = options.now ?? Date.now;
  }

  async save(
    input: ClientRecoverySaveInput,
    options: { retention?: ClientRecoveryRetention } = {},
  ): Promise<ClientRecoveryRecordV1> {
    const key = buildClientRecoveryKey(input);
    const now = this.now();
    let existing: ClientRecoveryRecordV1 | undefined;
    let raw: unknown;
    try {
      raw = await this.storage.get(key);
    } catch {
      throw new ClientRecoveryError("storage_failed");
    }
    if (isRecord(raw) && typeof raw.schemaVersion === "number") {
      if (raw.schemaVersion !== 1) {
        throw new ClientRecoveryError("incompatible_record");
      }
      if (
        validateRecord(raw) &&
        raw.key === key &&
        raw.userId === input.userId
      ) {
        existing = raw;
      } else if (raw !== undefined) {
        throw new ClientRecoveryError("invalid_record");
      }
    } else if (raw !== undefined) {
      throw new ClientRecoveryError("invalid_record");
    }

    if (
      existing &&
      Date.parse(existing.firstStoredAt) + MAX_RETENTION_MS <= now
    ) {
      await this.safeDeleteIfUnchanged(key, existing);
      throw new ClientRecoveryError("record_expired");
    }

    const firstStoredAt =
      existing?.firstStoredAt ?? new Date(now).toISOString();
    const firstStoredAtMs = Date.parse(firstStoredAt);
    const savedAt = new Date(now).toISOString();
    const retention = options.retention ?? existing?.retention ?? "default";
    const expiresAt = new Date(
      retention === "extended"
        ? firstStoredAtMs + MAX_RETENTION_MS
        : Math.min(now + DAY_MS, firstStoredAtMs + MAX_RETENTION_MS),
    ).toISOString();
    const sameValue = existing ? sameRecoveryValue(existing, input) : false;
    const candidate: ClientRecoveryRecordV1 = {
      ...input,
      expiresAt,
      firstStoredAt,
      key,
      retention,
      savedAt,
      schemaVersion: 1,
      ...(sameValue && existing?.serverSyncedAt
        ? { serverSyncedAt: existing.serverSyncedAt }
        : {}),
      ...(sameValue && existing?.submissionIntent
        ? { submissionIntent: existing.submissionIntent }
        : {}),
    };
    if (!validateRecord(candidate)) {
      throw new ClientRecoveryError("invalid_record");
    }
    if (
      measureClientRecoveryRecordBytes(candidate) > CLIENT_RECOVERY_MAX_BYTES
    ) {
      throw new ClientRecoveryError("record_too_large");
    }
    await this.putWithQuotaRecovery(candidate);
    return candidate;
  }

  async load(
    scope: ClientRecoveryScope,
    options: { deleteProvenUserMismatch?: boolean } = {},
  ): Promise<ClientRecoveryLoadResult> {
    const key = buildClientRecoveryKey(scope);
    let raw: unknown;
    try {
      raw = await this.storage.get(key);
    } catch {
      throw new ClientRecoveryError("storage_failed");
    }
    if (raw === undefined) return { status: "missing" };
    if (!isRecord(raw) || typeof raw.schemaVersion !== "number") {
      return { status: "corrupt" };
    }
    if (raw.schemaVersion !== 1) {
      return { schemaVersion: raw.schemaVersion, status: "incompatible" };
    }
    if (!validateRecord(raw)) {
      if (
        options.deleteProvenUserMismatch &&
        raw.key === key &&
        typeof raw.userId === "string" &&
        raw.userId !== scope.userId
      ) {
        await this.safeDelete(key);
      }
      return { status: "corrupt" };
    }
    if (
      raw.key !== key ||
      raw.userId !== scope.userId ||
      raw.problemId !== scope.problemId ||
      raw.questionNo !== scope.questionNo
    ) {
      if (options.deleteProvenUserMismatch && raw.userId !== scope.userId) {
        await this.safeDelete(key);
      }
      return { status: "corrupt" };
    }
    try {
      if (measureClientRecoveryRecordBytes(raw) > CLIENT_RECOVERY_MAX_BYTES) {
        return { status: "corrupt" };
      }
    } catch {
      return { status: "corrupt" };
    }
    if (Date.parse(raw.expiresAt) <= this.now()) {
      await this.safeDeleteIfUnchanged(key, raw);
      return { status: "expired" };
    }
    return { record: raw, status: "found" };
  }

  async markServerSynced(scope: ClientRecoveryScope, syncedAt: string) {
    if (timestamp(syncedAt) === null) {
      throw new ClientRecoveryError("invalid_record");
    }
    const loaded = await this.load(scope);
    if (loaded.status !== "found") return loaded;
    const record = { ...loaded.record, serverSyncedAt: syncedAt };
    await this.putWithQuotaRecovery(record);
    return { record, status: "found" } as const;
  }

  async findSubmissionIntent(
    scope: ClientRecoveryScope,
    fingerprint: string,
  ): Promise<ClientSubmissionIntent | null> {
    const loaded = await this.load(scope);
    if (loaded.status === "missing" || loaded.status === "expired") return null;
    if (loaded.status !== "found") {
      throw new ClientRecoveryError("invalid_record");
    }
    return loaded.record.submissionIntent?.fingerprint === fingerprint
      ? loaded.record.submissionIntent
      : null;
  }

  async persistSubmissionIntent(
    scope: ClientRecoveryScope,
    intent: ClientSubmissionIntent,
  ) {
    if (!validateSubmissionIntent(intent)) {
      throw new ClientRecoveryError("invalid_record");
    }
    const loaded = await this.load(scope);
    if (loaded.status !== "found") {
      throw new ClientRecoveryError("record_missing");
    }
    const updated = await this.putRecordIfUnchanged(loaded.record, {
      ...loaded.record,
      submissionIntent: intent,
    });
    if (!updated) throw new ClientRecoveryError("record_changed");
  }

  async markSubmissionIntentAmbiguous(
    scope: ClientRecoveryScope,
    intentId: string,
  ) {
    const loaded = await this.load(scope);
    if (loaded.status !== "found") {
      throw new ClientRecoveryError("record_missing");
    }
    const current = loaded.record.submissionIntent;
    if (!current || current.intentId !== intentId) return;
    const updated = await this.putRecordIfUnchanged(loaded.record, {
      ...loaded.record,
      submissionIntent: { ...current, state: "ambiguous" },
    });
    if (!updated) throw new ClientRecoveryError("record_changed");
  }

  async clearSubmissionIntent(scope: ClientRecoveryScope, intentId: string) {
    const loaded = await this.load(scope);
    if (loaded.status === "missing" || loaded.status === "expired") return;
    if (loaded.status !== "found") {
      throw new ClientRecoveryError("invalid_record");
    }
    if (loaded.record.submissionIntent?.intentId !== intentId) return;
    const { submissionIntent: _submissionIntent, ...record } = loaded.record;
    void _submissionIntent;
    const updated = await this.putRecordIfUnchanged(loaded.record, record);
    if (!updated) throw new ClientRecoveryError("record_changed");
  }

  async clearAfterServerSync(
    scope: ClientRecoveryScope,
    expected: ClientRecoveryRecordV1,
  ): Promise<boolean> {
    if (expected.serverSyncedAt === undefined) return false;
    return this.clearIfUnchanged(scope, expected);
  }

  async clearIfUnchanged(
    scope: ClientRecoveryScope,
    expected: ClientRecoveryRecordV1,
  ): Promise<boolean> {
    const key = buildClientRecoveryKey(scope);
    if (expected.key !== key || !validateRecord(expected)) return false;
    try {
      return await this.storage.deleteIfUnchanged(key, expected);
    } catch {
      throw new ClientRecoveryError("storage_failed");
    }
  }

  async clearForLogout(userId: string) {
    let values: unknown[];
    try {
      values = await this.storage.list();
    } catch {
      throw new ClientRecoveryError("storage_failed");
    }
    for (const value of values) {
      if (
        validateRecord(value) &&
        value.userId === userId &&
        value.serverSyncedAt !== undefined &&
        isExactRecoveryKey(value) &&
        isWithinRecoverySizeLimit(value)
      ) {
        await this.safeDeleteIfUnchanged(value.key, value);
      }
    }
  }

  async sweepExpired(): Promise<number> {
    let values: unknown[];
    try {
      values = await this.storage.list();
    } catch {
      throw new ClientRecoveryError("storage_failed");
    }

    const now = this.now();
    let deleted = 0;
    for (const value of values) {
      if (
        validateRecord(value) &&
        isExactRecoveryKey(value) &&
        isWithinRecoverySizeLimit(value) &&
        Date.parse(value.expiresAt) <= now &&
        (await this.safeDeleteIfUnchanged(value.key, value))
      ) {
        deleted += 1;
      }
    }
    return deleted;
  }

  async clearForAccountDeletion(userId: string) {
    await this.clearUserRecords(userId);
  }

  private async clearUserRecords(userId: string) {
    let values: unknown[];
    try {
      values = await this.storage.list();
    } catch {
      throw new ClientRecoveryError("storage_failed");
    }
    for (const value of values) {
      if (
        isRecord(value) &&
        value.userId === userId &&
        typeof value.key === "string"
      ) {
        await this.safeDelete(value.key);
      }
    }
  }

  private async safeDelete(key: string) {
    try {
      await this.storage.delete(key);
    } catch {
      throw new ClientRecoveryError("storage_failed");
    }
  }

  private async safeDeleteIfUnchanged(
    key: string,
    expected: ClientRecoveryRecordV1,
  ) {
    try {
      return await this.storage.deleteIfUnchanged(key, expected);
    } catch {
      throw new ClientRecoveryError("storage_failed");
    }
  }

  private async putRecordIfUnchanged(
    expected: ClientRecoveryRecordV1,
    replacement: ClientRecoveryRecordV1,
  ) {
    if (
      !validateRecord(replacement) ||
      measureClientRecoveryRecordBytes(replacement) > CLIENT_RECOVERY_MAX_BYTES
    ) {
      throw new ClientRecoveryError("invalid_record");
    }
    try {
      return await this.storage.putIfUnchanged(
        expected.key,
        expected,
        replacement,
      );
    } catch {
      throw new ClientRecoveryError("storage_failed");
    }
  }

  private async putWithQuotaRecovery(record: ClientRecoveryRecordV1) {
    try {
      await this.storage.put(record);
      return;
    } catch (error) {
      if (!isQuotaExceeded(error)) {
        throw new ClientRecoveryError("storage_failed");
      }
    }

    let values: unknown[] = [];
    try {
      values = await this.storage.list();
    } catch {
      // A single retry still occurs below without unsafe deletion.
    }
    const now = this.now();
    const candidates = values
      .filter(validateRecord)
      .filter(
        (candidate) =>
          candidate.key !== record.key &&
          isExactRecoveryKey(candidate) &&
          isWithinRecoverySizeLimit(candidate) &&
          (Date.parse(candidate.expiresAt) <= now ||
            candidate.serverSyncedAt !== undefined),
      )
      .sort((left, right) => {
        const leftExpired = Date.parse(left.expiresAt) <= now;
        const rightExpired = Date.parse(right.expiresAt) <= now;
        if (leftExpired !== rightExpired) return leftExpired ? -1 : 1;
        const leftTime = leftExpired ? left.expiresAt : left.serverSyncedAt!;
        const rightTime = rightExpired
          ? right.expiresAt
          : right.serverSyncedAt!;
        return Date.parse(leftTime) - Date.parse(rightTime);
      });
    for (const candidate of candidates) {
      await this.safeDeleteIfUnchanged(candidate.key, candidate);
    }

    try {
      await this.storage.put(record);
    } catch (error) {
      throw new ClientRecoveryError(
        isQuotaExceeded(error) ? "quota_exceeded" : "storage_failed",
      );
    }
  }
}

function isExactRecoveryKey(record: ClientRecoveryRecordV1) {
  try {
    return record.key === buildClientRecoveryKey(record);
  } catch {
    return false;
  }
}

function isWithinRecoverySizeLimit(record: ClientRecoveryRecordV1) {
  try {
    return (
      measureClientRecoveryRecordBytes(record) <= CLIENT_RECOVERY_MAX_BYTES
    );
  } catch {
    return false;
  }
}

export function createRecoverySubmissionIntentPersistence(
  repository: ClientRecoveryRepository,
  scope: ClientRecoveryScope,
): SubmissionIntentPersistence {
  return {
    clear: (intentId) => repository.clearSubmissionIntent(scope, intentId),
    find: (fingerprint) => repository.findSubmissionIntent(scope, fingerprint),
    markAmbiguous: (intentId) =>
      repository.markSubmissionIntentAmbiguous(scope, intentId),
    persist: (intent) => repository.persistSubmissionIntent(scope, intent),
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export function createIndexedDbClientRecoveryStorage(
  getFactory: () => IDBFactory | undefined = () => globalThis.indexedDB,
): ClientRecoveryStorageAdapter {
  let databasePromise: Promise<IDBDatabase> | undefined;

  function openDatabase() {
    if (databasePromise) return databasePromise;
    const factory = getFactory();
    if (!factory) {
      return Promise.reject(new ClientRecoveryError("storage_unavailable"));
    }
    databasePromise = new Promise((resolve, reject) => {
      const request = factory.open(
        CLIENT_RECOVERY_DB_NAME,
        CLIENT_RECOVERY_VERSION,
      );
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(CLIENT_RECOVERY_STORE_NAME)) {
          database.createObjectStore(CLIENT_RECOVERY_STORE_NAME, {
            keyPath: "key",
          });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = undefined;
        };
        resolve(database);
      };
      request.onerror = () => {
        databasePromise = undefined;
        reject(new ClientRecoveryError("storage_unavailable"));
      };
      request.onblocked = () => {
        databasePromise = undefined;
        reject(new ClientRecoveryError("storage_unavailable"));
      };
    });
    return databasePromise;
  }

  return {
    async delete(key) {
      const database = await openDatabase();
      const transaction = database.transaction(
        CLIENT_RECOVERY_STORE_NAME,
        "readwrite",
      );
      transaction.objectStore(CLIENT_RECOVERY_STORE_NAME).delete(key);
      await transactionDone(transaction);
    },
    async deleteIfUnchanged(key, expected) {
      const database = await openDatabase();
      const transaction = database.transaction(
        CLIENT_RECOVERY_STORE_NAME,
        "readwrite",
      );
      const store = transaction.objectStore(CLIENT_RECOVERY_STORE_NAME);
      const request = store.get(key);
      let deleted = false;
      request.onsuccess = () => {
        if (!sameStoredRecord(request.result, expected)) return;
        store.delete(key);
        deleted = true;
      };
      await transactionDone(transaction);
      return deleted;
    },
    async get(key) {
      const database = await openDatabase();
      const transaction = database.transaction(
        CLIENT_RECOVERY_STORE_NAME,
        "readonly",
      );
      return requestResult(
        transaction.objectStore(CLIENT_RECOVERY_STORE_NAME).get(key),
      );
    },
    async list() {
      const database = await openDatabase();
      const transaction = database.transaction(
        CLIENT_RECOVERY_STORE_NAME,
        "readonly",
      );
      return requestResult(
        transaction.objectStore(CLIENT_RECOVERY_STORE_NAME).getAll(),
      );
    },
    async put(value) {
      const database = await openDatabase();
      const transaction = database.transaction(
        CLIENT_RECOVERY_STORE_NAME,
        "readwrite",
      );
      transaction.objectStore(CLIENT_RECOVERY_STORE_NAME).put(value);
      await transactionDone(transaction);
    },
    async putIfUnchanged(key, expected, replacement) {
      const database = await openDatabase();
      const transaction = database.transaction(
        CLIENT_RECOVERY_STORE_NAME,
        "readwrite",
      );
      const store = transaction.objectStore(CLIENT_RECOVERY_STORE_NAME);
      const request = store.get(key);
      let updated = false;
      request.onsuccess = () => {
        if (!sameStoredRecord(request.result, expected)) return;
        store.put(replacement);
        updated = true;
      };
      await transactionDone(transaction);
      return updated;
    },
  };
}
