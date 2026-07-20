import { describe, expect, it } from "vitest";

import {
  STANDARD_PLAYWRIGHT_TEST_IGNORE,
  SUPABASE_DEV_PROJECT_REF,
  SUPABASE_PROD_PROJECT_REF,
  assertLocalPublicMutationTarget,
  assertLocalPrivilegedMutationTarget,
  assertLoopbackRuntimeTarget,
  assertPublicDevMutationTarget,
  assertPublicRemoteReadTarget,
  hasPrivilegedEnvironment,
  parseSupabaseTarget,
  resolveStandardPlaywrightSafety,
} from "../../scripts/lib/supabase-target-safety.mjs";
import * as targetSafety from "../../scripts/lib/supabase-target-safety.mjs";

const DEV_URL = `https://${SUPABASE_DEV_PROJECT_REF}.supabase.co`;
const PROD_URL = `https://${SUPABASE_PROD_PROJECT_REF}.supabase.co`;

function decoratedOriginUrls(origin) {
  return [
    `${origin}/api`,
    `${origin}/.`,
    `${origin}/%2e`,
    `${origin}?`,
    `${origin}#`,
    origin.replace("://", "://@"),
  ];
}

function canonicalizedLoopbackBypasses(port) {
  return [
    `http://127.1:${port}`,
    `http://2130706433:${port}`,
    `http://0x7f000001:${port}`,
    `http://0177.0.0.1:${port}`,
    `http://127.\t0.0.1:${port}`,
    `http://127.0.\n0.1:${port}`,
    `http://127.0.0.\r1:${port}`,
  ];
}

function publicEnvironment(overrides = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    NEXT_PUBLIC_SUPABASE_URL: DEV_URL,
    SUPABASE_ENV_LABEL: "dev",
    ...overrides,
  };
}

function localPrivilegedEnvironment(overrides = {}) {
  return publicEnvironment({
    E2E_ALLOW_DEV_DB_MUTATION: "1",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_ENV_LABEL: "local",
    SUPABASE_LOCAL_STACK: "1",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_local_test",
    ...overrides,
  });
}

function localPublicMutationEnvironment(overrides = {}) {
  return publicEnvironment({
    E2E_ALLOW_DEV_DB_MUTATION: "1",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_ENV_LABEL: "local",
    SUPABASE_LOCAL_STACK: "1",
    ...overrides,
  });
}

function capturedError(action) {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the safety policy to reject the target.");
}

function runtimeGuard(env) {
  expect(typeof targetSafety.assertRuntimeSupabaseTarget).toBe("function");
  return targetSafety.assertRuntimeSupabaseTarget(env);
}

function legacyJwt(role) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.signature`;
}

describe("Supabase target parsing", () => {
  it("exports the approved development and production project refs", () => {
    expect(SUPABASE_DEV_PROJECT_REF).toBe("fglggyfvzjdsbyckinqa");
    expect(SUPABASE_PROD_PROJECT_REF).toBe("eymlabowhfgtxbiqwxqh");
  });

  it.each([
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
  ])("classifies a loopback URL as local: %s", (url) => {
    expect(parseSupabaseTarget(url)).toMatchObject({ kind: "local" });
  });

  it.each([
    [DEV_URL, "development", SUPABASE_DEV_PROJECT_REF],
    [PROD_URL, "production", SUPABASE_PROD_PROJECT_REF],
  ])("classifies an approved hosted URL: %s", (url, environment, ref) => {
    expect(parseSupabaseTarget(url)).toEqual({
      environment,
      kind: "remote",
      ref,
    });
  });

  it.each([
    "not-a-url",
    "ftp://127.0.0.1:54321",
    "https://unknown-project.supabase.co",
    "https://fglggyfvzjdsbyckinqa.supabase.co.attacker.test",
  ])("fails closed for malformed or unknown targets", (url) => {
    const error = capturedError(() => parseSupabaseTarget(url));

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/supabase target is not approved/i);
    expect(error.message).not.toContain(url);
  });

  it.each([
    ...decoratedOriginUrls("http://127.0.0.1:54321"),
    ...decoratedOriginUrls(DEV_URL),
  ])("rejects a non-root or raw-decorated Supabase origin: %s", (url) => {
    expect(() => parseSupabaseTarget(url)).toThrow(
      /supabase target is not approved/i,
    );
  });

  it.each([
    ...canonicalizedLoopbackBypasses(54321),
    `https://%66${SUPABASE_DEV_PROJECT_REF.slice(1)}.supabase.co`,
    `https://${SUPABASE_DEV_PROJECT_REF.slice(0, 4)}\t${SUPABASE_DEV_PROJECT_REF.slice(4)}.supabase.co`,
  ])("rejects a raw origin that URL parsing would canonicalize: %s", (url) => {
    const error = capturedError(() => parseSupabaseTarget(url));

    expect(error.message).toMatch(/supabase target is not approved/i);
    expect(error.message).not.toContain(url);
  });
});

describe("public Supabase key policy", () => {
  it.each([
    [
      { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_browser_safe " },
      "sb_publishable_browser_safe",
    ],
    [{ NEXT_PUBLIC_SUPABASE_ANON_KEY: legacyJwt("anon") }, legacyJwt("anon")],
  ])("accepts an approved browser key", (env, expected) => {
    expect(typeof targetSafety.resolvePublicSupabaseKey).toBe("function");
    expect(targetSafety.resolvePublicSupabaseKey(env)).toBe(expected);
  });

  it.each([
    "sb_publishable_",
    "sb_secret_public_variable",
    legacyJwt("service_role"),
    "malformed.jwt",
    "unknown-public-key",
  ])("rejects an unsafe public key without echoing it", (value) => {
    expect(typeof targetSafety.resolvePublicSupabaseKey).toBe("function");
    const error = capturedError(() =>
      targetSafety.resolvePublicSupabaseKey({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: value,
      }),
    );

    expect(error.message).toMatch(/public supabase key is not approved/i);
    expect(error.message).not.toContain(value);
  });

  it("rejects every populated public-key variable when one contains a secret", () => {
    expect(typeof targetSafety.resolvePublicSupabaseKey).toBe("function");
    expect(() =>
      targetSafety.resolvePublicSupabaseKey({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_legacy_public_slot",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_safe",
      }),
    ).toThrow(/public supabase key is not approved/i);
  });

  it("applies public-key validation inside the hosted target guard", () => {
    expect(() =>
      assertPublicRemoteReadTarget(
        publicEnvironment({
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: legacyJwt("service_role"),
        }),
      ),
    ).toThrow(/public supabase key is not approved/i);
  });
});

describe("public hosted policies", () => {
  it("accepts only the hardcoded development project at the live target boundary", () => {
    expect(typeof targetSafety.assertLiveDevProjectTarget).toBe("function");
    expect(
      targetSafety.assertLiveDevProjectTarget({
        projectRef: SUPABASE_DEV_PROJECT_REF,
        supabaseUrl: DEV_URL,
      }),
    ).toEqual({
      environment: "development",
      kind: "remote",
      ref: SUPABASE_DEV_PROJECT_REF,
    });
  });

  it.each([
    [PROD_URL, SUPABASE_PROD_PROJECT_REF],
    ["https://callercontrolled.supabase.co", "callercontrolled"],
    [PROD_URL, SUPABASE_DEV_PROJECT_REF],
  ])(
    "rejects a production, unknown, or mismatched live target without echoing it",
    (supabaseUrl, projectRef) => {
      expect(typeof targetSafety.assertLiveDevProjectTarget).toBe("function");
      const error = capturedError(() =>
        targetSafety.assertLiveDevProjectTarget({ projectRef, supabaseUrl }),
      );

      expect(error.message).toMatch(/live development target is not approved/i);
      expect(error.message).not.toContain(supabaseUrl);
      expect(error.message).not.toContain(projectRef);
    },
  );

  it.each([DEV_URL, PROD_URL])(
    "allows public read-only access to an approved hosted target",
    (url) => {
      expect(
        assertPublicRemoteReadTarget(
          publicEnvironment({ NEXT_PUBLIC_SUPABASE_URL: url }),
        ),
      ).toMatchObject({ kind: "remote" });
    },
  );

  it.each([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_ACCESS_TOKEN",
  ])("rejects public hosted access when %s is present", (key) => {
    const env = publicEnvironment({ [key]: "HIGH_PRIVILEGE_SENTINEL" });

    expect(hasPrivilegedEnvironment(env)).toBe(true);
    expect(() => assertPublicRemoteReadTarget(env)).toThrow(
      /public remote access forbids privileged credentials/i,
    );
  });

  it("allows the separate public development mutation mode only with every explicit proof", () => {
    expect(
      assertPublicDevMutationTarget(
        publicEnvironment({ E2E_ALLOW_DEV_DB_MUTATION: "1" }),
        { expectedProjectRef: SUPABASE_DEV_PROJECT_REF },
      ),
    ).toEqual({
      environment: "development",
      kind: "remote",
      ref: SUPABASE_DEV_PROJECT_REF,
    });
  });

  it.each([undefined, {}])(
    "rejects public development mutation when expectedProjectRef is not explicitly provided",
    (options) => {
      expect(() =>
        assertPublicDevMutationTarget(
          publicEnvironment({ E2E_ALLOW_DEV_DB_MUTATION: "1" }),
          options,
        ),
      ).toThrow(/public development mutation is not approved/i);
    },
  );

  it.each([
    ["missing mutation flag", { E2E_ALLOW_DEV_DB_MUTATION: undefined }],
    ["spoofed label", { SUPABASE_ENV_LABEL: "local" }],
    ["production URL", { NEXT_PUBLIC_SUPABASE_URL: PROD_URL }],
    ["Preview automation", { VERCEL_ENV: "preview" }],
  ])("rejects public development mutation with %s", (_case, overrides) => {
    expect(() =>
      assertPublicDevMutationTarget(publicEnvironment(overrides), {
        expectedProjectRef: SUPABASE_DEV_PROJECT_REF,
      }),
    ).toThrow(/public development mutation is not approved/i);
  });

  it("rejects a caller-provided expected ref that does not match the hardcoded development ref", () => {
    expect(() =>
      assertPublicDevMutationTarget(
        publicEnvironment({ E2E_ALLOW_DEV_DB_MUTATION: "1" }),
        { expectedProjectRef: SUPABASE_PROD_PROJECT_REF },
      ),
    ).toThrow(/public development mutation is not approved/i);
  });
});

describe("application runtime target policy", () => {
  it("allows only the production project in Vercel Production", () => {
    expect(
      runtimeGuard({
        NEXT_PUBLIC_SUPABASE_URL: PROD_URL,
        VERCEL_ENV: "production",
      }),
    ).toMatchObject({ environment: "production", kind: "remote" });

    expect(() =>
      runtimeGuard({
        NEXT_PUBLIC_SUPABASE_URL: DEV_URL,
        VERCEL_ENV: "production",
      }),
    ).toThrow(/runtime supabase target is not approved/i);
  });

  it("allows only the development project in Vercel Preview", () => {
    expect(
      runtimeGuard({
        NEXT_PUBLIC_SUPABASE_URL: DEV_URL,
        VERCEL_ENV: "preview",
      }),
    ).toMatchObject({ environment: "development", kind: "remote" });

    expect(() =>
      runtimeGuard({
        NEXT_PUBLIC_SUPABASE_URL: PROD_URL,
        VERCEL_ENV: "preview",
      }),
    ).toThrow(/runtime supabase target is not approved/i);
  });

  it("allows the development project when VERCEL_ENV is absent or development", () => {
    for (const vercelEnv of [undefined, "development"]) {
      expect(
        runtimeGuard({
          NEXT_PUBLIC_SUPABASE_URL: DEV_URL,
          VERCEL_ENV: vercelEnv,
        }),
      ).toMatchObject({ environment: "development", kind: "remote" });
    }
  });

  it("allows an explicit loopback local stack outside hosted Vercel runtimes", () => {
    expect(
      runtimeGuard({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_LOCAL_STACK: "1",
      }),
    ).toMatchObject({ hostname: "127.0.0.1", kind: "local" });
  });

  it.each([
    ["production using development", { NEXT_PUBLIC_SUPABASE_URL: DEV_URL, VERCEL_ENV: "production" }],
    ["preview using production", { NEXT_PUBLIC_SUPABASE_URL: PROD_URL, VERCEL_ENV: "preview" }],
    ["local using production", { NEXT_PUBLIC_SUPABASE_URL: PROD_URL }],
    ["local loopback without explicit stack proof", { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }],
    ["unknown hosted project", { NEXT_PUBLIC_SUPABASE_URL: "https://unknown.supabase.co" }],
    ["unknown Vercel environment", { NEXT_PUBLIC_SUPABASE_URL: DEV_URL, VERCEL_ENV: "staging" }],
  ])("rejects %s", (_case, env) => {
    expect(() => runtimeGuard(env)).toThrow(
      /runtime supabase target is not approved/i,
    );
  });
});

describe("local privileged mutation policy", () => {
  it.each(["http://127.0.0.1:54321", "http://[::1]:54321"])(
    "allows a numeric loopback host for privileged local mutation: %s",
    (url) => {
      expect(
        assertLocalPrivilegedMutationTarget(
          localPrivilegedEnvironment({ NEXT_PUBLIC_SUPABASE_URL: url }),
        ),
      ).toMatchObject({ kind: "local" });
    },
  );

  it("rejects the DNS name localhost for privileged local mutation", () => {
    expect(() =>
      assertLocalPrivilegedMutationTarget(
        localPrivilegedEnvironment({
          NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
        }),
      ),
    ).toThrow(/local privileged mutation is not approved/i);
  });

  it.each(decoratedOriginUrls("http://127.0.0.1:54321"))(
    "rejects a non-root or raw-decorated privileged target: %s",
    (url) => {
      expect(() =>
        assertLocalPrivilegedMutationTarget(
          localPrivilegedEnvironment({ NEXT_PUBLIC_SUPABASE_URL: url }),
        ),
      ).toThrow(/local privileged mutation is not approved/i);
    },
  );

  it.each(canonicalizedLoopbackBypasses(54321))(
    "rejects a canonicalized privileged loopback spelling: %s",
    (url) => {
      const error = capturedError(() =>
        assertLocalPrivilegedMutationTarget(
          localPrivilegedEnvironment({ NEXT_PUBLIC_SUPABASE_URL: url }),
        ),
      );

      expect(error.message).toMatch(/local privileged mutation is not approved/i);
      expect(error.message).not.toContain(url);
    },
  );

  it.each([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_ACCESS_TOKEN",
  ])("allows %s only for an explicitly enabled loopback stack", (key) => {
    const env = localPrivilegedEnvironment({
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      [key]: "LOCAL_PRIVILEGED_SENTINEL",
    });

    expect(assertLocalPrivilegedMutationTarget(env)).toMatchObject({
      kind: "local",
    });
  });

  it.each([
    ["local-stack flag", { SUPABASE_LOCAL_STACK: undefined }],
    ["mutation flag", { E2E_ALLOW_DEV_DB_MUTATION: undefined }],
    ["privileged credential", { SUPABASE_SERVICE_ROLE_KEY: undefined }],
  ])("rejects local mutation without the %s", (_case, overrides) => {
    expect(() =>
      assertLocalPrivilegedMutationTarget(
        localPrivilegedEnvironment(overrides),
      ),
    ).toThrow(/local privileged mutation is not approved/i);
  });

  it("rejects a remote target even when labels and local flags are spoofed", () => {
    expect(() =>
      assertLocalPrivilegedMutationTarget(
        localPrivilegedEnvironment({ NEXT_PUBLIC_SUPABASE_URL: DEV_URL }),
      ),
    ).toThrow(/local privileged mutation is not approved/i);
  });

  it("never echoes URL, ref, credential, or email values in errors", () => {
    const values = [
      "sensitive-host.invalid",
      "sensitive-ref",
      "SENSITIVE_KEY_VALUE",
      "sensitive-user@example.test",
    ];
    const error = capturedError(() =>
      assertLocalPrivilegedMutationTarget({
        E2E_ALLOW_DEV_DB_MUTATION: "1",
        E2E_STUDENT_EMAIL: values[3],
        NEXT_PUBLIC_SUPABASE_URL: `https://${values[0]}/${values[1]}`,
        SUPABASE_LOCAL_STACK: "1",
        SUPABASE_SERVICE_ROLE_KEY: values[2],
      }),
    );

    for (const value of values) expect(error.message).not.toContain(value);
  });
});

describe("local public-key mutation policy", () => {
  it.each(["http://127.0.0.1:54321", "http://[::1]:54321"])(
    "allows an explicitly enabled numeric loopback target: %s",
    (url) => {
      expect(
        assertLocalPublicMutationTarget(
          localPublicMutationEnvironment({ NEXT_PUBLIC_SUPABASE_URL: url }),
        ),
      ).toMatchObject({ kind: "local" });
    },
  );

  it.each([
    ["DNS localhost", { NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" }],
    ["missing local-stack flag", { SUPABASE_LOCAL_STACK: undefined }],
    ["missing mutation opt-in", { E2E_ALLOW_DEV_DB_MUTATION: undefined }],
    ["hosted target", { NEXT_PUBLIC_SUPABASE_URL: DEV_URL }],
  ])("rejects %s", (_case, overrides) => {
    expect(() =>
      assertLocalPublicMutationTarget(
        localPublicMutationEnvironment(overrides),
      ),
    ).toThrow(/local public mutation is not approved/i);
  });
});

describe("standard Playwright safety contract", () => {
  it("keeps phase smoke excluded and excludes topik-ai-owned live remote suites", () => {
    expect(STANDARD_PLAYWRIGHT_TEST_IGNORE).toEqual([
      "**/phase-6-smoke.spec.mjs",
    ]);
  });

  it("returns the standard ignore list only after local privileged proof passes", () => {
    expect(
      resolveStandardPlaywrightSafety(localPrivilegedEnvironment()),
    ).toEqual({
      baseUrl: "http://127.0.0.1:3000",
      testIgnore: STANDARD_PLAYWRIGHT_TEST_IGNORE,
    });
  });

  it.each([
    "http://localhost:3000",
    "https://127.0.0.1:3443",
    "http://[::1]:3000",
  ])("returns an explicitly configured loopback app runtime: %s", (baseUrl) => {
    expect(
      resolveStandardPlaywrightSafety(
        localPrivilegedEnvironment({ E2E_BASE_URL: baseUrl }),
      ),
    ).toMatchObject({ baseUrl });
  });

  it.each([
    "https://preview.example.test",
    "http://127.0.0.1.evil.test:3000",
    "http://user:password@127.0.0.1:3000",
    "http://127.0.0.1:3000?mode=unsafe",
    "http://[::1]:3000#unsafe",
  ])("rejects a non-loopback or decorated app runtime", (baseUrl) => {
    const error = capturedError(() =>
      resolveStandardPlaywrightSafety(
        localPrivilegedEnvironment({ E2E_BASE_URL: baseUrl }),
      ),
    );

    expect(error.message).toMatch(/playwright runtime is not approved/i);
    expect(error.message).not.toContain(baseUrl);
  });

  it.each(decoratedOriginUrls("http://127.0.0.1:3000"))(
    "directly rejects a non-root or raw-decorated app runtime: %s",
    (baseUrl) => {
      expect(() => assertLoopbackRuntimeTarget(baseUrl)).toThrow(
        /playwright runtime is not approved/i,
      );
    },
  );

  it.each(canonicalizedLoopbackBypasses(3000))(
    "directly rejects a canonicalized runtime loopback spelling: %s",
    (baseUrl) => {
      const error = capturedError(() =>
        assertLoopbackRuntimeTarget(baseUrl),
      );

      expect(error.message).toMatch(/playwright runtime is not approved/i);
      expect(error.message).not.toContain(baseUrl);
    },
  );

  it("fails during config evaluation for a hosted target", () => {
    expect(() =>
      resolveStandardPlaywrightSafety(
        localPrivilegedEnvironment({ NEXT_PUBLIC_SUPABASE_URL: DEV_URL }),
      ),
    ).toThrow(/local privileged mutation is not approved/i);
  });
});
