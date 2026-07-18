import { describe, expect, it } from "vitest";

import {
  CLIENT_RECOVERY_DB_NAME,
  CLIENT_RECOVERY_MAX_BYTES,
  CLIENT_RECOVERY_STORE_NAME,
  CLIENT_RECOVERY_VERSION,
  ClientRecoveryError,
  ClientRecoveryRepository,
  buildClientRecoveryKey,
  createRecoverySubmissionIntentPersistence,
  createIndexedDbClientRecoveryStorage,
  measureClientRecoveryRecordBytes,
  type ClientRecoveryRecordV1,
  type ClientRecoveryStorageAdapter,
} from "../../../src/lib/writing/client-recovery";

const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse("2026-07-18T00:00:00.000Z");

class MemoryStorage implements ClientRecoveryStorageAdapter {
  beforeConditionalDelete?: () => void;
  beforeConditionalPut?: () => void;
  readonly deleted: string[] = [];
  readonly records = new Map<string, unknown>();
  putAttempts = 0;
  quotaFailures = 0;

  async get(key: string) {
    return this.records.get(key);
  }

  async put(value: unknown) {
    this.putAttempts += 1;
    if (this.quotaFailures > 0) {
      this.quotaFailures -= 1;
      throw new DOMException("private quota detail", "QuotaExceededError");
    }
    const key = (value as { key: string }).key;
    this.records.set(key, structuredClone(value));
  }

  async delete(key: string) {
    this.deleted.push(key);
    this.records.delete(key);
  }

  async deleteIfUnchanged(key: string, expected: ClientRecoveryRecordV1) {
    this.beforeConditionalDelete?.();
    this.beforeConditionalDelete = undefined;
    const current = this.records.get(key) as ClientRecoveryRecordV1 | undefined;
    if (JSON.stringify(current) !== JSON.stringify(expected)) {
      return false;
    }
    await this.delete(key);
    return true;
  }

  async putIfUnchanged(
    key: string,
    expected: ClientRecoveryRecordV1,
    replacement: ClientRecoveryRecordV1,
  ) {
    this.beforeConditionalPut?.();
    this.beforeConditionalPut = undefined;
    const current = this.records.get(key) as ClientRecoveryRecordV1 | undefined;
    if (JSON.stringify(current) !== JSON.stringify(expected)) return false;
    this.records.set(key, structuredClone(replacement));
    return true;
  }

  async list() {
    return [...this.records.values()].map((value) => structuredClone(value));
  }
}

function scope(overrides: Partial<{ userId: string; problemId: string }> = {}) {
  return {
    problemId: "problem-1",
    questionNo: 54 as const,
    userId: "user-1",
    ...overrides,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    ...scope(),
    answerJson: { _v: "54.v1", text: "device draft" },
    answerText: "device draft",
    canonicalQuestionId: "topik-writing-54-0001",
    draftId: "draft-1",
    importId: "701",
    payloadHash: "payload-hash",
    ...overrides,
  } as const;
}

function record(overrides: Partial<ClientRecoveryRecordV1> = {}) {
  const base: ClientRecoveryRecordV1 = {
    ...input(),
    expiresAt: new Date(START + DAY).toISOString(),
    firstStoredAt: new Date(START).toISOString(),
    key: buildClientRecoveryKey(scope()),
    retention: "default",
    savedAt: new Date(START).toISOString(),
    schemaVersion: 1,
  };
  return { ...base, ...overrides };
}

describe("client recovery record", () => {
  it("uses the fixed native IndexedDB contract and opens lazily in SSR", async () => {
    expect({
      db: CLIENT_RECOVERY_DB_NAME,
      maxBytes: CLIENT_RECOVERY_MAX_BYTES,
      store: CLIENT_RECOVERY_STORE_NAME,
      version: CLIENT_RECOVERY_VERSION,
    }).toEqual({
      db: "talkpik-client-recovery",
      maxBytes: 256 * 1024,
      store: "writing-drafts",
      version: 1,
    });

    const storage = createIndexedDbClientRecoveryStorage(() => undefined);
    await expect(storage.get("user:problem:54")).rejects.toMatchObject({
      code: "storage_unavailable",
    });
  });

  it("preserves firstStoredAt and enforces default and extended retention caps", async () => {
    let now = START;
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => now,
    });

    const first = await repository.save(input());
    expect(first).toMatchObject({
      expiresAt: new Date(START + DAY).toISOString(),
      firstStoredAt: new Date(START).toISOString(),
      retention: "default",
      savedAt: new Date(START).toISOString(),
      schemaVersion: 1,
    });

    now = START + 2 * DAY;
    const extended = await repository.save(input({ answerText: "newer" }), {
      retention: "extended",
    });
    expect(extended.firstStoredAt).toBe(first.firstStoredAt);
    expect(extended.savedAt).toBe(new Date(now).toISOString());
    expect(extended.expiresAt).toBe(new Date(START + 7 * DAY).toISOString());

    now = START + 6 * DAY;
    const repeated = await repository.save(input({ answerText: "latest" }), {
      retention: "extended",
    });
    expect(repeated.firstStoredAt).toBe(first.firstStoredAt);
    expect(repeated.expiresAt).toBe(new Date(START + 7 * DAY).toISOString());
  });

  it("does not report an already seven-day-expired record as newly recoverable", async () => {
    let now = START;
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => now,
    });
    const first = await repository.save(input(), { retention: "extended" });

    now = START + 7 * DAY + 1;
    await expect(
      repository.save(input({ answerText: "after-cap" }), {
        retention: "extended",
      }),
    ).rejects.toMatchObject({ code: "record_expired" });
    expect(storage.deleted).toEqual([first.key]);
    expect(storage.records.has(first.key)).toBe(false);

    await expect(
      repository.save(input({ answerText: "explicit-retry" })),
    ).resolves.toMatchObject({
      answerText: "explicit-retry",
      firstStoredAt: new Date(now).toISOString(),
    });
  });

  it("measures canonical metadata and value bytes and rejects oversize before write", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START,
    });
    expect(measureClientRecoveryRecordBytes(record())).toBeGreaterThan(0);

    await expect(
      repository.save(input({ answerText: "가".repeat(100_000) })),
    ).rejects.toMatchObject({ code: "record_too_large" });
    expect(storage.putAttempts).toBe(0);
  });

  it("loads only the exact current record and keeps incompatible or corrupt data inert", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START,
    });
    const key = buildClientRecoveryKey(scope());

    storage.records.set(key, record());
    await expect(repository.load(scope())).resolves.toMatchObject({
      record: { key, userId: "user-1" },
      status: "found",
    });

    storage.records.set(key, { ...record(), schemaVersion: 2 });
    await expect(repository.load(scope())).resolves.toEqual({
      schemaVersion: 2,
      status: "incompatible",
    });
    expect(storage.deleted).toEqual([]);

    storage.records.set(key, { ...record(), schemaVersion: 0 });
    await expect(repository.load(scope())).resolves.toEqual({
      schemaVersion: 0,
      status: "incompatible",
    });

    storage.records.set(key, { ...record(), userId: "user-2" });
    await expect(repository.load(scope())).resolves.toEqual({
      status: "corrupt",
    });
    expect(storage.records.has(key)).toBe(true);

    await expect(
      repository.load(scope(), { deleteProvenUserMismatch: true }),
    ).resolves.toEqual({ status: "corrupt" });
    expect(storage.records.has(key)).toBe(false);
  });

  it("quarantines current-version oversize data and safely deletes expired data", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START + 2 * DAY,
    });
    const key = buildClientRecoveryKey(scope());
    storage.records.set(key, record({ answerText: "x".repeat(300_000) }));

    await expect(repository.load(scope())).resolves.toEqual({
      status: "corrupt",
    });
    expect(storage.records.has(key)).toBe(true);

    storage.records.set(key, record());
    await expect(repository.load(scope())).resolves.toEqual({
      status: "expired",
    });
    expect(storage.records.has(key)).toBe(false);
  });

  it("clears only the exact record after confirmed server sync", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START,
    });
    const userOne = await repository.save(input());
    const userOneOther = await repository.save(
      input({ problemId: "problem-2", draftId: "draft-2" }),
    );
    const userTwo = await repository.save(
      input({ userId: "user-2", draftId: "draft-3" }),
    );

    const marked = await repository.markServerSynced(
      scope(),
      new Date(START).toISOString(),
    );
    expect(marked.status).toBe("found");
    if (marked.status !== "found") throw new Error("expected marked record");
    await repository.clearAfterServerSync(scope(), marked.record);
    expect(storage.records.has(userOne.key)).toBe(false);
    expect(storage.records.has(userOneOther.key)).toBe(true);
    expect(storage.records.has(userTwo.key)).toBe(true);
  });

  it("atomically clears an exact unsynced record only when explicitly selected", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START,
    });
    const selected = await repository.save(input());

    await expect(repository.clearIfUnchanged(scope(), selected)).resolves.toBe(
      true,
    );
    expect(storage.records.has(selected.key)).toBe(false);
  });

  it("does not clear a newer same-scope record written after the sync check", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START,
    });
    await repository.save(input());
    const marked = await repository.markServerSynced(
      scope(),
      new Date(START).toISOString(),
    );
    expect(marked.status).toBe("found");
    if (marked.status !== "found") throw new Error("expected marked record");

    const newer = record({
      answerText: "other tab latest",
    });
    storage.records.set(newer.key, newer);

    await expect(
      repository.clearAfterServerSync(scope(), marked.record),
    ).resolves.toBe(false);
    expect(storage.records.get(newer.key)).toEqual(newer);
  });

  it("clears only safe server-synced current records on logout", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START,
    });
    const unsynced = await repository.save(
      input({ problemId: "unsynced", draftId: "draft-unsynced" }),
    );
    const synced = await repository.save(
      input({ problemId: "synced", draftId: "draft-synced" }),
    );
    await repository.markServerSynced(
      scope({ problemId: "synced" }),
      new Date(START).toISOString(),
    );
    const otherUser = await repository.save(
      input({ userId: "user-2", draftId: "draft-user-2" }),
    );
    const future = {
      ...record({
        key: "user-1:future:54",
        problemId: "future",
      }),
      schemaVersion: 2,
    };
    const corrupt = {
      ...record({
        key: "user-1:corrupt:54",
        problemId: "corrupt",
        serverSyncedAt: new Date(START).toISOString(),
      }),
      rawError: "private provider detail",
    };
    const oversize = record({
      answerText: "x".repeat(300_000),
      key: "user-1:oversize:54",
      problemId: "oversize",
      serverSyncedAt: new Date(START).toISOString(),
    });
    storage.records.set(future.key, future);
    storage.records.set(corrupt.key, corrupt);
    storage.records.set(oversize.key, oversize);

    await repository.clearForLogout("user-1");
    expect(storage.records.has(synced.key)).toBe(false);
    expect(storage.records.has(unsynced.key)).toBe(true);
    expect(storage.records.has(future.key)).toBe(true);
    expect(storage.records.has(corrupt.key)).toBe(true);
    expect(storage.records.has(oversize.key)).toBe(true);
    expect(storage.records.has(otherUser.key)).toBe(true);
  });

  it("does not delete a newer recovery record written by another tab during logout", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START,
    });
    await repository.save(input());
    const marked = await repository.markServerSynced(
      scope(),
      new Date(START).toISOString(),
    );
    if (marked.status !== "found") throw new Error("expected marked record");
    const newer = { ...marked.record, answerText: "newer tab content" };
    storage.beforeConditionalDelete = () => {
      storage.records.set(newer.key, newer);
    };

    await repository.clearForLogout("user-1");

    expect(storage.records.get(newer.key)).toEqual(newer);
  });

  it("sweeps expired synced and unsynced records without touching future or malformed records", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START + 3 * DAY,
    });
    const expiredUnsynced = record({
      key: "user-1:expired-unsynced:54",
      problemId: "expired-unsynced",
    });
    const expiredSynced = record({
      key: "user-1:expired-synced:54",
      problemId: "expired-synced",
      serverSyncedAt: new Date(START).toISOString(),
    });
    const unexpired = record({
      expiresAt: new Date(START + 7 * DAY).toISOString(),
      key: "user-1:unexpired:54",
      problemId: "unexpired",
      retention: "extended",
    });
    const future = { ...record(), key: "future", schemaVersion: 2 };
    const malformed = { key: "malformed", userId: "user-1" };
    for (const value of [
      expiredUnsynced,
      expiredSynced,
      unexpired,
      future,
      malformed,
    ]) {
      storage.records.set(value.key, value);
    }

    await expect(repository.sweepExpired()).resolves.toBe(2);
    expect(storage.records.has(expiredUnsynced.key)).toBe(false);
    expect(storage.records.has(expiredSynced.key)).toBe(false);
    expect(storage.records.has(unexpired.key)).toBe(true);
    expect(storage.records.has(future.key)).toBe(true);
    expect(storage.records.has(malformed.key)).toBe(true);
  });

  it("treats confirmed account deletion as direct disposal including future records", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START,
    });
    const current = await repository.save(input());
    const otherUser = await repository.save(
      input({ userId: "user-2", draftId: "draft-user-2" }),
    );
    const future = {
      ...record({
        key: "user-1:future:54",
        problemId: "future",
      }),
      schemaVersion: 2,
    };
    storage.records.set(future.key, future);

    await repository.clearForAccountDeletion("user-1");
    expect(storage.records.has(current.key)).toBe(false);
    expect(storage.records.has(future.key)).toBe(false);
    expect(storage.records.has(otherUser.key)).toBe(true);
  });

  it("cleans expired or server-synced safe candidates on quota and retries once", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START + 3 * DAY,
    });
    const currentKey = buildClientRecoveryKey(scope());
    const expiredSynced = record({
      key: "user-1:expired:54",
      problemId: "expired",
      serverSyncedAt: new Date(START).toISOString(),
    });
    const oldSynced = record({
      expiresAt: new Date(START + 7 * DAY).toISOString(),
      key: "user-1:synced:54",
      problemId: "synced",
      retention: "extended",
      savedAt: new Date(START + DAY).toISOString(),
      serverSyncedAt: new Date(START + DAY).toISOString(),
    });
    const expiredUnsynced = record({
      key: "user-1:unsynced:54",
      problemId: "unsynced",
    });
    const currentSynced = record({
      key: currentKey,
      serverSyncedAt: new Date(START).toISOString(),
    });
    for (const candidate of [
      oldSynced,
      expiredUnsynced,
      currentSynced,
      expiredSynced,
    ]) {
      storage.records.set(candidate.key, candidate);
    }
    storage.quotaFailures = 1;

    await repository.save(input({ answerText: "latest" }));

    expect(storage.putAttempts).toBe(2);
    expect(storage.deleted).toEqual([
      expiredUnsynced.key,
      expiredSynced.key,
      oldSynced.key,
    ]);
    expect(storage.records.has(expiredUnsynced.key)).toBe(false);
    expect(storage.records.has(currentKey)).toBe(true);
  });

  it("does not delete a quota candidate replaced by another tab", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START + 3 * DAY,
    });
    const expired = record({
      key: "user-1:expired:54",
      problemId: "expired",
    });
    const newer = { ...expired, answerText: "newer tab content" };
    storage.records.set(expired.key, expired);
    storage.beforeConditionalDelete = () => {
      storage.records.set(newer.key, newer);
    };
    storage.quotaFailures = 1;

    await repository.save(input({ answerText: "latest" }));

    expect(storage.records.get(newer.key)).toEqual(newer);
  });

  it("returns a typed safe error after one quota retry and never deletes unsynced records", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START,
    });
    const unsynced = record({
      key: "user-2:other:54",
      problemId: "other",
      userId: "user-2",
    });
    storage.records.set(unsynced.key, unsynced);
    storage.quotaFailures = 2;

    let error: unknown;
    try {
      await repository.save(input());
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ClientRecoveryError);
    expect(error).toMatchObject({ code: "quota_exceeded" });
    expect(String(error)).not.toContain("private quota detail");
    expect(storage.putAttempts).toBe(2);
    expect(storage.records.has(unsynced.key)).toBe(true);
  });

  it("persists, reuses, marks, and clears submission intent inside the recovery record", async () => {
    const storage = new MemoryStorage();
    const repository = new ClientRecoveryRepository(storage, {
      now: () => START,
    });
    await repository.save(input());
    const persistence = createRecoverySubmissionIntentPersistence(
      repository,
      scope(),
    );
    const intent = {
      createdAt: new Date(START).toISOString(),
      fingerprint: "fingerprint-1",
      intentId: "11111111-1111-4111-8111-111111111111",
      state: "pending" as const,
    };

    await expect(persistence.find(intent.fingerprint)).resolves.toBeNull();
    await persistence.persist(intent);
    await expect(persistence.find(intent.fingerprint)).resolves.toEqual(intent);
    await expect(persistence.find("different-fingerprint")).resolves.toBeNull();

    await persistence.markAmbiguous(intent.intentId);
    await expect(persistence.find(intent.fingerprint)).resolves.toMatchObject({
      state: "ambiguous",
    });

    await persistence.clear(intent.intentId);
    await expect(persistence.find(intent.fingerprint)).resolves.toBeNull();
    const loaded = await repository.load(scope());
    expect(loaded).toMatchObject({
      record: { answerText: "device draft" },
      status: "found",
    });
    expect(loaded.status === "found" && loaded.record.submissionIntent).toBe(
      undefined,
    );
  });

  it.each(["persist", "mark", "clear"] as const)(
    "does not overwrite a newer cross-tab answer while trying to %s a submission intent",
    async (operation) => {
      const storage = new MemoryStorage();
      const repository = new ClientRecoveryRepository(storage, {
        now: () => START,
      });
      await repository.save(input());
      const persistence = createRecoverySubmissionIntentPersistence(
        repository,
        scope(),
      );
      const intent = {
        createdAt: new Date(START).toISOString(),
        fingerprint: "fingerprint-race",
        intentId: "11111111-1111-4111-8111-111111111111",
        state: "pending" as const,
      };
      if (operation !== "persist") await persistence.persist(intent);
      const newer = record({
        answerJson: { _v: "54.v1", text: "other tab latest" },
        answerText: "other tab latest",
        savedAt: new Date(START + 1_000).toISOString(),
      });
      storage.beforeConditionalPut = () =>
        storage.records.set(newer.key, newer);

      const attempt =
        operation === "persist"
          ? persistence.persist(intent)
          : operation === "mark"
            ? persistence.markAmbiguous(intent.intentId)
            : persistence.clear(intent.intentId);

      await expect(attempt).rejects.toMatchObject({ code: "record_changed" });
      expect(storage.records.get(newer.key)).toEqual(newer);
    },
  );
});
