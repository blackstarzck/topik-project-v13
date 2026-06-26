import { afterEach, describe, expect, it, vi } from "vitest";

import {
  filterVisibleProblemIds,
  isWritingProblemVisibleToCaller,
} from "@/lib/problems/visibility";

function makeClient(result: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue(result),
  };
}

describe("problem visibility RPC helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns visible ids from the filter RPC", async () => {
    const client = makeClient({
      data: [{ problem_id: "p-2" }],
      error: null,
    });

    await expect(
      filterVisibleProblemIds(client as never, ["p-1", "p-2", "p-2"]),
    ).resolves.toEqual(new Set(["p-2"]));
    expect(client.rpc).toHaveBeenCalledWith(
      "filter_visible_writing_problem_ids",
      { p_problem_ids: ["p-1", "p-2"] },
    );
  });

  it("falls back to the requested ids in non-production when the filter RPC is not migrated yet", async () => {
    const client = makeClient({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.filter_visible_writing_problem_ids(p_problem_ids) in the schema cache",
      },
    });

    await expect(
      filterVisibleProblemIds(client as never, ["p-1", "p-2"]),
    ).resolves.toEqual(new Set(["p-1", "p-2"]));
  });

  it("throws non-migration RPC failures", async () => {
    const client = makeClient({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(
      filterVisibleProblemIds(client as never, ["p-1"]),
    ).rejects.toThrow("filterVisibleProblemIds: permission denied");
  });

  it("falls back to visible for the single-problem RPC in non-production while migration is pending", async () => {
    const client = makeClient({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.is_writing_problem_visible_to_caller(p_problem_id, p_question_no) in the schema cache",
      },
    });

    await expect(
      isWritingProblemVisibleToCaller(client as never, "p-1", 51),
    ).resolves.toBe(true);
  });

  it("does not fall back for a missing visibility RPC in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const client = makeClient({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.filter_visible_writing_problem_ids(p_problem_ids) in the schema cache",
      },
    });

    await expect(
      filterVisibleProblemIds(client as never, ["p-1"]),
    ).rejects.toThrow(
      "filterVisibleProblemIds: Could not find the function public.filter_visible_writing_problem_ids(p_problem_ids) in the schema cache",
    );
  });
});
