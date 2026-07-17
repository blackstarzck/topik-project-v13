import { describe, expect, it } from "vitest";
import {
  classifySupabaseRestRequest,
  hasTrackedRequestsSettled,
  isTrackedRuntimeUrl,
  isUnexpectedTrackedResponse,
  selectCanonicalProblemId,
  shouldCollectRuntimeConsoleError,
} from "../e2e/support/writing-composer-runtime";

const origins = {
  appOrigin: "http://127.0.0.1:3317",
  supabaseOrigin: "https://sample.supabase.co",
};

describe("selectCanonicalProblemId", () => {
  it("returns the validated problem UUID for the requested Q53 or Q54 row", () => {
    const rows = [
      {
        item_number: 53,
        problem_id: "11111111-1111-4111-8111-111111111111",
      },
      {
        item_number: 54,
        problem_id: "22222222-2222-4222-8222-222222222222",
      },
    ];

    expect(selectCanonicalProblemId(rows, 53)).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(selectCanonicalProblemId(rows, 54)).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("rejects a missing requested row or problem ID", () => {
    expect(() => selectCanonicalProblemId([], 53)).toThrow(/Q53/);
    expect(() => selectCanonicalProblemId([{ item_number: 54 }], 54)).toThrow(
      /problem_id/,
    );
  });

  it("rejects an invalid problem ID", () => {
    expect(() =>
      selectCanonicalProblemId(
        [{ item_number: 53, problem_id: "not-a-uuid" }],
        53,
      ),
    ).toThrow(/UUID/);
  });
});

describe("isTrackedRuntimeUrl", () => {
  it("accepts only the app and configured Supabase origins", () => {
    expect(isTrackedRuntimeUrl("http://127.0.0.1:3317/writing", origins)).toBe(
      true,
    );
    expect(
      isTrackedRuntimeUrl(
        "https://sample.supabase.co/rest/v1/problems",
        origins,
      ),
    ).toBe(true);
    expect(
      isTrackedRuntimeUrl("https://www.googletagmanager.com/gtm.js", origins),
    ).toBe(false);
    expect(
      isTrackedRuntimeUrl(
        "https://www.google-analytics.com/g/collect",
        origins,
      ),
    ).toBe(false);
  });
});

describe("isUnexpectedTrackedResponse", () => {
  it("flags tracked responses at or above 400", () => {
    expect(
      isUnexpectedTrackedResponse(
        "http://127.0.0.1:3317/api/writing",
        400,
        origins,
      ),
    ).toBe(true);
    expect(
      isUnexpectedTrackedResponse(
        "https://sample.supabase.co/rest/v1/problems",
        503,
        origins,
      ),
    ).toBe(true);
    expect(
      isUnexpectedTrackedResponse(
        "http://127.0.0.1:3317/api/writing",
        399,
        origins,
      ),
    ).toBe(false);
  });

  it("ignores external responses at or above 400", () => {
    expect(
      isUnexpectedTrackedResponse(
        "https://www.googletagmanager.com/gtm.js",
        500,
        origins,
      ),
    ).toBe(false);
  });
});

describe("shouldCollectRuntimeConsoleError", () => {
  it("collects console errors from the app and Supabase origins", () => {
    expect(
      shouldCollectRuntimeConsoleError(
        "http://127.0.0.1:3317/_next/static/chunk.js",
        origins,
      ),
    ).toBe(true);
    expect(
      shouldCollectRuntimeConsoleError(
        "https://sample.supabase.co/rest/v1/problems",
        origins,
      ),
    ).toBe(true);
  });

  it("ignores console errors from external analytics origins", () => {
    expect(
      shouldCollectRuntimeConsoleError(
        "https://www.googletagmanager.com/gtm.js",
        origins,
      ),
    ).toBe(false);
    expect(
      shouldCollectRuntimeConsoleError(
        "https://www.google-analytics.com/g/collect",
        origins,
      ),
    ).toBe(false);
  });

  it("collects console errors without a location URL", () => {
    expect(shouldCollectRuntimeConsoleError("", origins)).toBe(true);
  });
});

describe("classifySupabaseRestRequest", () => {
  it.each(["GET", "HEAD", "OPTIONS"])(
    "continues the read method %s on Supabase REST",
    (method) => {
      expect(
        classifySupabaseRestRequest(
          "https://sample.supabase.co/rest/v1/problems?select=id",
          method,
          origins.supabaseOrigin,
        ),
      ).toBe("continue");
    },
  );

  it("fulfills the expected study_events analytics POST", () => {
    expect(
      classifySupabaseRestRequest(
        "https://sample.supabase.co/rest/v1/study_events?columns=user_id",
        "POST",
        origins.supabaseOrigin,
      ),
    ).toBe("fulfill-expected-analytics");
  });

  it.each([
    "https://sample.supabase.co/rest/v1/rpc/get_available_writing_questions",
    "https://sample.supabase.co/rest/v1/rpc/get_available_writing_questions?p_item_number=53",
  ])("continues the exact known read-only POST RPC %s", (url) => {
    expect(
      classifySupabaseRestRequest(url, "POST", origins.supabaseOrigin),
    ).toBe("continue");
  });

  it("blocks unrelated Supabase REST mutations and unknown POST RPCs", () => {
    expect(
      classifySupabaseRestRequest(
        "https://sample.supabase.co/rest/v1/writing_drafts?id=eq.1",
        "PATCH",
        origins.supabaseOrigin,
      ),
    ).toBe("block-unexpected-mutation");
    expect(
      classifySupabaseRestRequest(
        "https://sample.supabase.co/rest/v1/rpc/unknown_read",
        "POST",
        origins.supabaseOrigin,
      ),
    ).toBe("block-unexpected-mutation");
    expect(
      classifySupabaseRestRequest(
        "https://sample.supabase.co/rest/v1/study_events?id=eq.1",
        "DELETE",
        origins.supabaseOrigin,
      ),
    ).toBe("block-unexpected-mutation");
  });

  it("continues app and external URLs", () => {
    expect(
      classifySupabaseRestRequest(
        "http://127.0.0.1:3317/api/writing",
        "POST",
        origins.supabaseOrigin,
      ),
    ).toBe("continue");
    expect(
      classifySupabaseRestRequest(
        "https://www.googletagmanager.com/collect",
        "DELETE",
        origins.supabaseOrigin,
      ),
    ).toBe("continue");
  });
});

describe("hasTrackedRequestsSettled", () => {
  it("requires no pending requests and a 300ms quiet window", () => {
    expect(hasTrackedRequestsSettled(1, 1_000, 2_000)).toBe(false);
    expect(hasTrackedRequestsSettled(0, 1_000, 1_299)).toBe(false);
    expect(hasTrackedRequestsSettled(0, 1_000, 1_300)).toBe(true);
  });
});
