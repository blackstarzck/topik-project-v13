import { describe, expect, test, vi, beforeEach } from "vitest";

// Mock next/headers before importing the function
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/font/local", () => ({
  default: () => ({ className: "mock-font", variable: "mock-font-variable" }),
}));

import { cookies } from "next/headers";
import { resolveInitialAppearance } from "../../src/app/layout";

describe("resolveInitialAppearance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns "light" when no cookie is set', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const result = await resolveInitialAppearance();
    expect(result).toBe("light");
  });

  test('returns "light" when cookie is "dark" because Awesomic is light-fixed', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === "theme-appearance" ? { name, value: "dark" } : undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const result = await resolveInitialAppearance();
    expect(result).toBe("light");
  });

  test('returns "light" when cookie is "light"', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === "theme-appearance" ? { name, value: "light" } : undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const result = await resolveInitialAppearance();
    expect(result).toBe("light");
  });

  test('returns "light" for invalid cookie value (fail-safe fallback)', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === "theme-appearance" ? { name, value: "purple" } : undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const result = await resolveInitialAppearance();
    expect(result).toBe("light");
  });
});
