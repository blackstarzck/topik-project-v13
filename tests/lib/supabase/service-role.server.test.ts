import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getPublicEnvMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: helpers.createClientMock,
}));

vi.mock("../../../src/lib/supabase/env", () => ({
  getPublicEnv: helpers.getPublicEnvMock,
}));

import { createSupabaseServiceRoleClient } from "../../../src/lib/supabase/service-role.server";

const ORIGINAL_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("Supabase service-role client", () => {
  beforeEach(() => {
    helpers.createClientMock.mockReset();
    helpers.getPublicEnvMock.mockReset();
    helpers.getPublicEnvMock.mockReturnValue({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  afterEach(() => {
    if (ORIGINAL_SERVICE_ROLE_KEY === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_SERVICE_ROLE_KEY;
    }
  });

  it("removes a leading BOM and surrounding whitespace before creating headers", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      "\uFEFF sb_secret_service_role_test \r\n";

    createSupabaseServiceRoleClient();

    expect(helpers.createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_secret_service_role_test",
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
  });

  it("rejects a service-role key that is empty after normalization", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "\uFEFF \r\n";

    expect(() => createSupabaseServiceRoleClient()).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY is required/,
    );
    expect(helpers.createClientMock).not.toHaveBeenCalled();
  });
});
