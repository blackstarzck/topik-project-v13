import { createClient, type User } from "@supabase/supabase-js";
import {
  assertLocalPrivilegedMutationTarget,
  resolvePublicSupabaseKey,
} from "../../../scripts/lib/supabase-target-safety.mjs";

export type E2EStudentConfig = {
  email: string;
  password: string;
  publishableKey: string;
  serviceRoleKey: string;
  supabaseUrl: string;
};

type AuthUserList = {
  data: { users: User[] };
  error: Error | null;
};

type AuthUserResult = {
  data: { user: User | null };
  error: Error | null;
};

type ProfileResult = {
  data: { id: string; status: string | null } | null;
  error: Error | null;
};

export type E2EAdminClientLike = {
  auth: {
    admin: {
      createUser(attributes: {
        email: string;
        email_confirm: boolean;
        password: string;
        user_metadata: Record<string, string>;
      }): Promise<AuthUserResult>;
      listUsers(params: {
        page: number;
        perPage: number;
      }): Promise<AuthUserList>;
      updateUserById(
        userId: string,
        attributes: {
          email_confirm: boolean;
          password: string;
          user_metadata: Record<string, string>;
        },
      ): Promise<AuthUserResult>;
    };
  };
  from(table: "profiles"): {
    select(columns: string): {
      eq(
        column: "id",
        value: string,
      ): {
        maybeSingle(): Promise<ProfileResult>;
      };
    };
    update(values: {
      display_name: string;
      nationality_country_code: string;
      ui_locale: string;
      ui_locale_source: string;
    }): {
      eq(column: "id", value: string): Promise<{ error: Error | null }>;
    };
  };
};

const STUDENT_METADATA = {
  display_name: "E2E Student",
  nationality_country_code: "KR",
  ui_locale: "ko",
  ui_locale_source: "manual",
};

function readRequiredEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: string,
): string {
  const value = env[key];
  if (value == null || value.trim() === "") {
    throw new Error(`${key} must be set for Playwright e2e account setup.`);
  }
  return value;
}

function readPassword(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string {
  const dedicated = env.E2E_STUDENT_PASSWORD;
  if (dedicated != null && dedicated.trim() !== "") return dedicated;
  return readRequiredEnv(env, "SUPABASE_TEST_PASSWORD");
}

function readPrivilegedKey(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey != null && serviceRoleKey.trim() !== "") {
    return serviceRoleKey;
  }
  const secretKey = env.SUPABASE_SECRET_KEY;
  if (secretKey != null && secretKey.trim() !== "") return secretKey;
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY must be set for Playwright e2e account setup.",
  );
}

export function resolveE2EStudentConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): E2EStudentConfig {
  const serviceRoleKey = readPrivilegedKey(env);
  assertLocalPrivilegedMutationTarget(env);

  return {
    email: readRequiredEnv(env, "E2E_STUDENT_EMAIL"),
    password: readPassword(env),
    publishableKey: resolvePublicSupabaseKey(env),
    serviceRoleKey,
    supabaseUrl: readRequiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL"),
  };
}

export function createE2EAdminClient(
  config: E2EStudentConfig,
): E2EAdminClientLike {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  }) as unknown as E2EAdminClientLike;
}

async function findUserByEmail(
  admin: E2EAdminClientLike,
  email: string,
): Promise<User | null> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  throw new Error(
    "Could not find e2e student user within first 10000 auth users.",
  );
}

export async function findE2EStudentUserId(
  admin: E2EAdminClientLike,
  email: string,
): Promise<string> {
  const user = await findUserByEmail(admin, email);
  if (!user) {
    throw new Error("E2E student user must exist after auth setup.");
  }
  return user.id;
}

async function waitForProfile(
  admin: E2EAdminClientLike,
  userId: string,
): Promise<{ id: string; status: string | null }> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,status")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("E2E student profile row was not created in time.");
}

export async function ensureE2EStudentUser(
  admin: E2EAdminClientLike,
  config: E2EStudentConfig,
): Promise<{ userId: string }> {
  const existing = await findUserByEmail(admin, config.email);
  const result = existing
    ? await admin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        password: config.password,
        user_metadata: STUDENT_METADATA,
      })
    : await admin.auth.admin.createUser({
        email: config.email,
        email_confirm: true,
        password: config.password,
        user_metadata: STUDENT_METADATA,
      });

  if (result.error) throw result.error;
  const userId = result.data.user?.id ?? existing?.id;
  if (!userId)
    throw new Error("Supabase did not return an e2e student user id.");

  const profile = await waitForProfile(admin, userId);
  if (profile.status !== "active") {
    throw new Error(
      `E2E student profile must be active before auth setup, got ${profile.status ?? "null"}.`,
    );
  }

  const profileUpdate = await admin
    .from("profiles")
    .update(STUDENT_METADATA)
    .eq("id", userId);
  if (profileUpdate.error) throw profileUpdate.error;

  return { userId };
}
