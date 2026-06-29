import { describe, expect, it } from "vitest";
import { getWritingAvailability } from "../../../src/lib/practice/writing-availability";

type ProblemRow = {
  id: string;
  question_no: number | null;
  tags?: string[] | null;
  materials?: unknown;
};

function makeClient(opts: {
  rows: ProblemRow[];
  visibleProblemIds?: string[];
}) {
  const calls: Array<{ type: "eq"; column: string; value: unknown }> = [];
  return {
    calls,
    rpc(name: string, args: { p_problem_ids?: string[] }) {
      if (name !== "filter_visible_writing_problem_ids") {
        throw new Error(`unexpected rpc ${name}`);
      }
      const allowed = new Set(opts.visibleProblemIds ?? args.p_problem_ids);
      return Promise.resolve({
        data: (args.p_problem_ids ?? [])
          .filter((id) => allowed.has(id))
          .map((id) => ({ problem_id: id })),
        error: null,
      });
    },
    from(table: string) {
      if (table !== "problems") throw new Error(`unexpected table ${table}`);
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          calls.push({ type: "eq", column, value });
          return chain;
        },
        order: () => chain,
        limit: () => Promise.resolve({ data: opts.rows, error: null }),
      };
      return chain;
    },
  };
}

describe("getWritingAvailability", () => {
  it("returns available and locked question types from the visibility RPC", async () => {
    const client = makeClient({
      rows: [
        { id: "p-51", question_no: 51 },
        { id: "p-52", question_no: 52 },
        {
          id: "seed-53",
          question_no: 53,
          tags: ["seed:wireframe_problem_fixtures"],
        },
      ],
      visibleProblemIds: ["p-52", "seed-53"],
    });

    const availability = await getWritingAvailability(
      async () => client as never,
    );

    expect(availability).toEqual({
      availableTypes: [52],
      lockedTypes: [51, 53, 54],
      hasAny: true,
    });
    expect(client.calls).toContainEqual({
      type: "eq",
      column: "domain",
      value: "writing",
    });
    expect(client.calls).toContainEqual({
      type: "eq",
      column: "publish_status",
      value: "published",
    });
    expect(client.calls).toContainEqual({
      type: "eq",
      column: "lifecycle_status",
      value: "active",
    });
  });

  it("returns all types locked when no visible writing problem exists", async () => {
    const client = makeClient({
      rows: [
        { id: "p-51", question_no: 51 },
        { id: "p-54", question_no: 54 },
      ],
      visibleProblemIds: [],
    });

    const availability = await getWritingAvailability(
      async () => client as never,
    );

    expect(availability).toEqual({
      availableTypes: [],
      lockedTypes: [51, 52, 53, 54],
      hasAny: false,
    });
  });
});
