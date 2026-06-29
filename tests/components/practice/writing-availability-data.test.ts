// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWritingAvailability } from "../../../src/components/practice/writing-availability-data";

describe("fetchWritingAvailability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads writing availability through the server API route", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        availableTypes: [51],
        lockedTypes: [52, 53, 54],
        hasAny: true,
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const availability = await fetchWritingAvailability();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/practice/writing-availability",
      { credentials: "same-origin" },
    );
    expect([...availability.availableTypes]).toEqual([51]);
    expect([...availability.lockedTypes]).toEqual([52, 53, 54]);
    expect(availability.hasAny).toBe(true);
  });

  it("rejects when the availability API route fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
      })),
    );

    await expect(fetchWritingAvailability()).rejects.toThrow(
      "writing_availability_request_failed:401",
    );
  });
});
