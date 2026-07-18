import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
  }),
}));

import { POST } from "../../../../src/app/api/internal/client-operational-events/route";

const event = {
  code: "operation_failed",
  feature: "notification_inbox",
  operation: "mark_read",
  result: "failure",
  correlationId: "2f1d4b86-44cf-4d66-8a23-2d1bf847c21a",
} as const;

function request(body: unknown) {
  return new Request(
    "http://localhost/api/internal/client-operational-events",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/internal/client-operational-events", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("accepts and logs only a revalidated allowlisted event", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await POST(request(event));

    expect(response.status).toBe(202);
    expect(info).toHaveBeenCalledWith("client_operational_event", event);
  });

  it("rejects unauthenticated delivery without logging", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await POST(request(event));

    expect(response.status).toBe(401);
    expect(info).not.toHaveBeenCalled();
  });

  it("rejects extra user-content fields without echoing or logging them", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(
      request({ ...event, answer: "private learner answer" }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private learner answer");
    expect(info).not.toHaveBeenCalled();
  });
});
