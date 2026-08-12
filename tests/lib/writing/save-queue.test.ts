import { describe, expect, it, vi } from "vitest";

import {
  SaveQueueFlushError,
  createLatestOnlySaveQueue,
} from "../../../src/lib/writing/save-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function nextTurn() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("latest-only save queue", () => {
  it("runs one save at a time and collapses pending work to the latest snapshot", async () => {
    const saves = [deferred<string>(), deferred<string>()];
    const save = vi
      .fn<(snapshot: { answer: string }) => Promise<string>>()
      .mockImplementationOnce(() => saves[0].promise)
      .mockImplementationOnce(() => saves[1].promise);
    const queue = createLatestOnlySaveQueue({ save });

    const first = queue.request({ answer: "first" });
    const replaced = queue.request({ answer: "second" });
    const latest = queue.request({ answer: "third" });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenNthCalledWith(1, { answer: "first" });
    await expect(replaced).resolves.toMatchObject({
      revision: 2,
      status: "superseded",
    });

    saves[0].resolve("saved-first");
    await nextTurn();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenNthCalledWith(2, { answer: "third" });
    await expect(first).resolves.toEqual({
      isLatest: false,
      result: "saved-first",
      revision: 1,
      status: "saved",
    });
    expect(queue.getState()).toMatchObject({
      hasUnsaved: true,
      lastSavedRevision: 1,
      latestRevision: 3,
      status: "saving",
    });

    saves[1].resolve("saved-third");
    await expect(latest).resolves.toEqual({
      isLatest: true,
      result: "saved-third",
      revision: 3,
      status: "saved",
    });
    await expect(queue.awaitIdle()).resolves.toEqual({
      lastSavedRevision: 3,
      latestRevision: 3,
      status: "idle",
    });
    expect(queue.getUnsavedSnapshot()).toBeUndefined();
  });

  it("does not retry a failed latest save until an explicit flush or retry", async () => {
    const save = vi
      .fn<(snapshot: { answer: string }) => Promise<string>>()
      .mockRejectedValueOnce(new Error("private provider detail"))
      .mockResolvedValueOnce("saved-after-retry");
    const queue = createLatestOnlySaveQueue({ save });

    await expect(queue.request({ answer: "keep me" })).resolves.toEqual({
      isLatest: true,
      revision: 1,
      status: "failed",
    });
    await nextTurn();

    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.getState()).toMatchObject({
      failedRevision: 1,
      hasUnsaved: true,
      status: "failed",
    });
    expect(queue.getUnsavedSnapshot()).toEqual({ answer: "keep me" });
    await expect(queue.awaitIdle()).resolves.toMatchObject({
      failedRevision: 1,
      status: "failed",
    });

    await expect(queue.flush()).resolves.toBe("saved-after-retry");
    expect(save).toHaveBeenCalledTimes(2);
    expect(queue.getState()).toMatchObject({
      hasUnsaved: false,
      status: "idle",
    });
  });

  it("lets flush wait for the latest pending save and throws a typed safe failure", async () => {
    const first = deferred<string>();
    const latest = deferred<string>();
    const save = vi
      .fn<(snapshot: string) => Promise<string>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => latest.promise);
    const queue = createLatestOnlySaveQueue({ save });

    void queue.request("one");
    void queue.request("two");
    const flushed = queue.flush();
    first.resolve("old");
    await nextTurn();
    latest.resolve("new");

    await expect(flushed).resolves.toBe("new");

    const failing = createLatestOnlySaveQueue({
      save: async () => {
        throw new Error("raw database error");
      },
    });
    void failing.request("answer content");
    await expect(failing.flush()).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof SaveQueueFlushError &&
        error.message === "The latest save did not complete." &&
        !error.message.includes("database") &&
        !error.message.includes("answer")
      );
    });
  });

  it("emits deterministic sanitized outcomes and stops callbacks after dispose", async () => {
    const active = deferred<string>();
    const outcomes: Array<Record<string, unknown>> = [];
    const queue = createLatestOnlySaveQueue({
      save: () => active.promise,
      onOutcome: (outcome) => outcomes.push(outcome),
    });

    const inFlight = queue.request({ answer: "secret answer" });
    const pending = queue.request({ answer: "new secret answer" });
    queue.dispose();

    await expect(inFlight).resolves.toEqual({
      revision: 1,
      status: "disposed",
    });
    await expect(pending).resolves.toEqual({ revision: 2, status: "disposed" });
    await expect(queue.request({ answer: "later" })).resolves.toEqual({
      revision: 3,
      status: "disposed",
    });
    await expect(queue.awaitIdle()).resolves.toEqual({ status: "disposed" });
    active.resolve("ignored");
    await nextTurn();

    expect(outcomes).toEqual([]);
    expect(JSON.stringify(queue.getState())).not.toContain("answer");
  });

  it("supports void saves and omits save results from callbacks", async () => {
    const outcomes: unknown[] = [];
    const queue = createLatestOnlySaveQueue({
      save: async () => undefined,
      onOutcome: (outcome) => outcomes.push(outcome),
    });

    void queue.request({ answer: "private answer" });
    await expect(queue.flush()).resolves.toBeUndefined();
    expect(outcomes).toEqual([
      { isLatest: true, revision: 1, status: "saved" },
    ]);
    expect(JSON.stringify(outcomes)).not.toContain("answer");
  });
});
