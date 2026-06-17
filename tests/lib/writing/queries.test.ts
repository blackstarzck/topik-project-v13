import { describe, expect, it, vi } from "vitest";

import { fetchFeedbackStatus } from "../../../src/lib/writing/queries";

describe("fetchFeedbackStatus", () => {
  it("uses the server sync route before falling back to Supabase polling", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ feedback_status: "complete" }), {
        status: 200,
      }),
    );
    const supabase = {
      from: vi.fn(),
    };

    const result = await fetchFeedbackStatus(
      "00000000-0000-0000-0000-000000000099",
      () => supabase as never,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/writing/evaluation-status?submissionId=00000000-0000-0000-0000-000000000099",
      { cache: "no-store" },
    );
    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toBe("complete");
  });
});
