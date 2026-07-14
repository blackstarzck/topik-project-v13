import { describe, expect, it } from "vitest";

import {
  ensureE2EStudentUser,
  findE2EStudentUserId,
  resolveE2EStudentConfig,
  type E2EAdminClientLike,
  type E2EStudentConfig,
} from "../e2e/_setup/e2e-student-fixture";

describe("e2e student fixture config", () => {
  const baseEnv = {
    E2E_STUDENT_EMAIL: "student@example.com",
    E2E_STUDENT_PASSWORD: "Password123!",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_ENV_LABEL: "local",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_local",
  };

  it("uses the dedicated e2e student password before the shared test password", () => {
    expect(
      resolveE2EStudentConfig({
        ...baseEnv,
        SUPABASE_TEST_PASSWORD: "SharedPassword123!",
      }),
    ).toMatchObject({
      email: "student@example.com",
      password: "Password123!",
    });
  });

  it("falls back to SUPABASE_TEST_PASSWORD for existing local setups", () => {
    const env = { ...baseEnv, E2E_STUDENT_PASSWORD: undefined };

    expect(
      resolveE2EStudentConfig({
        ...env,
        SUPABASE_TEST_PASSWORD: "SharedPassword123!",
      }),
    ).toMatchObject({
      email: "student@example.com",
      password: "SharedPassword123!",
    });
  });

  it("requires a service role key because setup creates the account directly", () => {
    const env = { ...baseEnv, SUPABASE_SERVICE_ROLE_KEY: undefined };

    expect(() => resolveE2EStudentConfig(env)).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("refuses production-labeled Supabase targets", () => {
    expect(() =>
      resolveE2EStudentConfig({
        ...baseEnv,
        SUPABASE_ENV_LABEL: "prod",
      }),
    ).toThrow(/production/i);
  });

  it("refuses unknown environment labels before creating accounts", () => {
    expect(() =>
      resolveE2EStudentConfig({
        ...baseEnv,
        SUPABASE_ENV_LABEL: "customer-demo",
      }),
    ).toThrow(/known non-production label/i);
  });
});

describe("e2e student fixture account setup", () => {
  const config: E2EStudentConfig = {
    email: "student@example.com",
    envLabel: "local",
    password: "Password123!",
    publishableKey: "sb_publishable_local",
    serviceRoleKey: "sb_secret_local",
    supabaseUrl: "http://127.0.0.1:54321",
  };

  function createAdminDouble(
    users: Array<{ email?: string; id: string }> = [],
  ) {
    const calls = {
      createUser: [] as unknown[],
      profileUpdate: [] as unknown[],
      updateUserById: [] as unknown[],
    };
    const admin = {
      auth: {
        admin: {
          createUser: async (attributes: unknown) => {
            calls.createUser.push(attributes);
            return {
              data: { user: { email: config.email, id: "new-user-id" } },
              error: null,
            };
          },
          listUsers: async () => ({
            data: { users },
            error: null,
          }),
          updateUserById: async (userId: string, attributes: unknown) => {
            calls.updateUserById.push({ attributes, userId });
            return {
              data: { user: { email: config.email, id: userId } },
              error: null,
            };
          },
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "profile-id", status: "active" },
              error: null,
            }),
          }),
        }),
        update: (values: unknown) => ({
          eq: async () => {
            calls.profileUpdate.push(values);
            return { error: null };
          },
        }),
      }),
    } as unknown as E2EAdminClientLike;

    return { admin, calls };
  }

  it("creates and confirms the e2e student when no matching auth user exists", async () => {
    const { admin, calls } = createAdminDouble();

    await expect(ensureE2EStudentUser(admin, config)).resolves.toEqual({
      userId: "new-user-id",
    });

    expect(calls.createUser).toEqual([
      expect.objectContaining({
        email: config.email,
        email_confirm: true,
        password: config.password,
      }),
    ]);
    expect(calls.updateUserById).toEqual([]);
    expect(calls.profileUpdate).toEqual([
      expect.objectContaining({
        display_name: "E2E Student",
        nationality_country_code: "KR",
      }),
    ]);
  });

  it("updates password and email confirmation when the e2e student already exists", async () => {
    const { admin, calls } = createAdminDouble([
      { email: config.email, id: "existing-user-id" },
    ]);

    await expect(ensureE2EStudentUser(admin, config)).resolves.toEqual({
      userId: "existing-user-id",
    });

    expect(calls.createUser).toEqual([]);
    expect(calls.updateUserById).toEqual([
      {
        attributes: expect.objectContaining({
          email_confirm: true,
          password: config.password,
        }),
        userId: "existing-user-id",
      },
    ]);
  });

  it("finds the existing e2e student without invalidating its authenticated session", async () => {
    const { admin, calls } = createAdminDouble([
      { email: config.email, id: "existing-user-id" },
    ]);

    await expect(findE2EStudentUserId(admin, config.email)).resolves.toBe(
      "existing-user-id",
    );

    expect(calls.createUser).toEqual([]);
    expect(calls.updateUserById).toEqual([]);
    expect(calls.profileUpdate).toEqual([]);
  });
});
