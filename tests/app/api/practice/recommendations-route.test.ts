import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const fetchProfileStatusMock = vi.fn();
const queryRecommendationBundleForUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

vi.mock("@/lib/auth/profile", () => ({
  fetchProfileStatus: (...args: unknown[]) => fetchProfileStatusMock(...args),
  isActiveStatus: (status: unknown) => status === "active",
}));

vi.mock("@/lib/practice/recommendations", () => ({
  queryRecommendationBundleForUser: (...args: unknown[]) =>
    queryRecommendationBundleForUserMock(...args),
}));

import { GET } from "../../../../src/app/api/practice/recommendations/route";

describe("GET /api/practice/recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "student@example.com",
          email_confirmed_at: "2026-06-29T00:00:00.000Z",
        },
      },
    });
    fetchProfileStatusMock.mockResolvedValue("active");
    queryRecommendationBundleForUserMock.mockResolvedValue({
      recommendations: [],
    });
  });

  it("rejects unauthenticated requests", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    const response = await GET(
      new Request("http://localhost/api/practice/recommendations"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(queryRecommendationBundleForUserMock).not.toHaveBeenCalled();
  });

  it("rejects email-unverified sessions before loading recommendations", async () => {
    getUserMock.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-1",
          email: "student@example.com",
          email_confirmed_at: null,
        },
      },
    });

    const response = await GET(
      new Request("http://localhost/api/practice/recommendations?type=51"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "email_unverified",
    });
    expect(queryRecommendationBundleForUserMock).not.toHaveBeenCalled();
  });

  it("rejects inactive profiles before loading recommendations", async () => {
    fetchProfileStatusMock.mockResolvedValueOnce("blocked");

    const response = await GET(
      new Request("http://localhost/api/practice/recommendations?type=51"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "account_inactive",
    });
    expect(queryRecommendationBundleForUserMock).not.toHaveBeenCalled();
  });

  it("loads recommendations for verified sessions", async () => {
    const response = await GET(
      new Request("http://localhost/api/practice/recommendations?type=52"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ recommendations: [] });
    expect(queryRecommendationBundleForUserMock).toHaveBeenCalledWith(
      "user-1",
      52,
    );
    expect(fetchProfileStatusMock).toHaveBeenCalled();
  });
});
