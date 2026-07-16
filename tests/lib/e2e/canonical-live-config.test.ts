import { describe, expect, it } from "vitest";

import { resolveCanonicalLiveConfig } from "../../e2e/_setup/canonical-cross-app-live-fixture";

function safeEnv(overrides: Record<string, string> = {}) {
  return {
    E2E_CANONICAL_CROSS_APP: "1",
    E2E_ALLOW_DEV_DB_MUTATION: "1",
    NODE_ENV: "test",
    SUPABASE_ENV_LABEL: "test",
    NEXT_PUBLIC_SUPABASE_URL: "https://devproject.supabase.co",
    SUPABASE_PROJECT_REF: "devproject",
    E2E_EXPECTED_SUPABASE_PROJECT_REF: "devproject",
    E2E_ADMIN_EMAIL: "admin@example.test",
    E2E_ADMIN_PASSWORD: "password",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    E2E_EXISTING_HISTORY_SUBMISSION_ID: "history-id",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    E2E_STUDENT_EMAIL: "student@example.test",
    SUPABASE_TEST_PASSWORD: "password",
    SUPABASE_ACCESS_TOKEN: "access-token",
    ...overrides,
  };
}

describe("resolveCanonicalLiveConfig", () => {
  it("requires URL, management project, and expected project refs to agree", () => {
    expect(() =>
      resolveCanonicalLiveConfig(
        safeEnv({ E2E_EXPECTED_SUPABASE_PROJECT_REF: "otherdev" }),
      ),
    ).toThrow("E2E_EXPECTED_SUPABASE_PROJECT_REF");
  });

  it("accepts an explicitly matched non-production target", () => {
    expect(resolveCanonicalLiveConfig(safeEnv()).projectRef).toBe("devproject");
  });
});
