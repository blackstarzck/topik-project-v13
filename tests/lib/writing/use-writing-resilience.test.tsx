// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ClientRecoveryRepository,
  type ClientRecoverySaveInput,
  type ClientRecoveryStorageAdapter,
} from "../../../src/lib/writing/client-recovery";
import { useWritingResilience } from "../../../src/lib/writing/use-writing-resilience";
import type { WritingResilienceSnapshot } from "../../../src/lib/writing/writing-resilience";
import type { WritingDraftRow } from "../../../src/lib/writing/types";

const NOW = "2026-07-18T00:00:00.000Z";

function memoryRepository() {
  const values = new Map<string, unknown>();
  const storage: ClientRecoveryStorageAdapter = {
    delete: async (key) => void values.delete(key),
    deleteIfUnchanged: async (key, expected) => {
      if (JSON.stringify(values.get(key)) !== JSON.stringify(expected)) {
        return false;
      }
      values.delete(key);
      return true;
    },
    get: async (key) => values.get(key),
    list: async () => [...values.values()],
    put: async (value) => {
      const key = (value as { key: string }).key;
      values.set(key, value);
    },
    putIfUnchanged: async (key, expected, replacement) => {
      if (JSON.stringify(values.get(key)) !== JSON.stringify(expected)) {
        return false;
      }
      values.set(key, replacement);
      return true;
    },
  };
  return new ClientRecoveryRepository(storage, {
    now: () => Date.parse(NOW),
  });
}

function snapshot(answerText: string): WritingResilienceSnapshot {
  return {
    draft: {
      answer_json: { _v: "54.v1", text: answerText },
      answer_text: answerText,
      autosave_status: "clean",
      canonical_import_id: 701,
      canonical_payload_hash: "hash",
      canonical_question_id: "question-54",
      char_count: answerText.length,
      last_saved_at: NOW,
      problem_id: "problem-1",
      question_no: 54,
      user_id: "user-1",
    },
    draftId: "draft-1",
  };
}

function serverRow(answerText: string): WritingDraftRow {
  return {
    answer_json: { _v: "54.v1", text: answerText },
    answer_text: answerText,
    autosave_status: "clean",
    canonical_import_id: 701,
    canonical_payload_hash: "hash",
    canonical_question_id: "question-54",
    char_count: answerText.length,
    created_at: NOW,
    id: "draft-1",
    last_saved_at: NOW,
    legacy_cutover_snapshot: null,
    problem_id: "problem-1",
    question_no: 54,
    question_snapshot: null,
    updated_at: NOW,
    user_id: "user-1",
  };
}

afterEach(() => vi.restoreAllMocks());

describe("useWritingResilience", () => {
  it("uses the initial snapshot for submit, exposes intent persistence, and cleans up the channel", async () => {
    const repository = memoryRepository();
    const sweepExpired = vi.spyOn(repository, "sweepExpired");
    const dispose = vi.fn();
    const publish = vi.fn();
    const createRecoveryCoordinator = vi.fn(() => ({ dispose, publish }));
    const saveServer = vi.fn(async (draft) =>
      serverRow(draft.answer_text ?? ""),
    );
    const { result, unmount } = renderHook(() =>
      useWritingResilience({
        createRecoveryCoordinator,
        initialSnapshot: snapshot("initial"),
        repository,
        restorePrior: (record, current) => ({
          draft: {
            ...current.draft,
            answer_json: record.answerJson,
            answer_text: record.answerText,
            char_count: record.answerText.length,
          },
          draftId: record.draftId,
        }),
        saveServer,
      }),
    );

    await waitFor(() => expect(result.current.state.hydrated).toBe(true));
    expect(sweepExpired).toHaveBeenCalledOnce();
    await act(async () => {
      await result.current.prepareForSubmit();
    });
    expect(saveServer).toHaveBeenCalledWith(
      expect.objectContaining({ answer_text: "initial" }),
    );

    const intent = {
      createdAt: NOW,
      fingerprint: "fingerprint-1",
      intentId: "intent-1",
      state: "pending" as const,
    };
    await result.current.intentPersistence.persist(intent);
    await expect(
      result.current.intentPersistence.find(intent.fingerprint),
    ).resolves.toEqual(intent);
    expect(publish).toHaveBeenCalled();

    unmount();
    expect(dispose).toHaveBeenCalledOnce();
  }, 10_000);

  it("reloads exact storage on cross-tab metadata and exposes a conflict without payload broadcasting", async () => {
    const repository = memoryRepository();
    let notifyConflict: (() => void) | undefined;
    const createRecoveryCoordinator = vi.fn(({ onConflict }) => {
      notifyConflict = () =>
        onConflict({
          eventId: "other-tab",
          key: "user-1:problem-1:54",
          savedAt: NOW,
          schemaVersion: 1,
        });
      return { dispose: vi.fn(), publish: vi.fn() };
    });
    const { result } = renderHook(() =>
      useWritingResilience({
        createRecoveryCoordinator,
        initialSnapshot: snapshot("current"),
        repository,
        restorePrior: (record, current) => ({
          draft: {
            ...current.draft,
            answer_json: record.answerJson,
            answer_text: record.answerText,
            char_count: record.answerText.length,
          },
          draftId: record.draftId,
        }),
        saveServer: async (draft) => serverRow(draft.answer_text ?? ""),
      }),
    );
    await waitFor(() => expect(result.current.state.hydrated).toBe(true));

    const prior: ClientRecoverySaveInput = {
      answerJson: { _v: "54.v1", text: "other-tab-answer" },
      answerText: "other-tab-answer",
      canonicalQuestionId: "question-54",
      draftId: "draft-1",
      importId: "701",
      payloadHash: "hash",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    };
    await repository.save(prior);
    act(() => notifyConflict?.());

    await waitFor(() =>
      expect(result.current.state.conflict?.prior.answerText).toBe(
        "other-tab-answer",
      ),
    );
    expect(createRecoveryCoordinator).toHaveBeenCalledWith({
      key: "user-1:problem-1:54",
      onConflict: expect.any(Function),
    });
  }, 10_000);
});
