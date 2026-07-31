import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { inspect } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const SENTINEL = "SENTINEL-CREDENTIAL-9f3a";
const TEAM_ID = "team_fixture";
const PROJECT = "topik-project-v13";
const DOMAIN = "talkpik.example.com";
const LOCAL_APP_DATA = path.join(tmpdir(), "talkpik-vercel-credential-fixture");
const CREDENTIAL_FILE = path.join(
  LOCAL_APP_DATA,
  "TalkpikPipeline",
  "credentials",
  "vercel.env",
);
const SHA = {
  source: "1".repeat(40),
  tree: "2".repeat(40),
  stg: "3".repeat(40),
  candidate: "4".repeat(40),
  main: "5".repeat(40),
  previous: "6".repeat(40),
  stgMerged: "7".repeat(40),
};
const BASELINE_SHA = "8".repeat(40);

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function vercel() {
  return import("../../scripts/lib/ai-release-vercel.mjs");
}

async function executor() {
  return import("../../scripts/lib/ai-release-executor.mjs");
}

async function promotion() {
  return import("../../scripts/lib/ai-release-promotion.mjs");
}

function fileStatus(kind) {
  return {
    isSymbolicLink: () => kind === "symlink",
    isFile: () => kind === "file",
    isDirectory: () => kind === "directory",
  };
}

function missingFileError() {
  return Object.assign(new Error("no such file"), { code: "ENOENT" });
}

function fakeFilesystem({ contents = null, symlinks = [] } = {}) {
  const links = new Set(symlinks);
  const directories = new Set();
  let directory = path.dirname(CREDENTIAL_FILE);
  for (;;) {
    directories.add(directory);
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  const classify = (target) => {
    if (links.has(target)) return "symlink";
    if (target === CREDENTIAL_FILE) return contents === null ? null : "file";
    return directories.has(target) ? "directory" : null;
  };
  return {
    lstatSync(target) {
      const kind = classify(target);
      if (kind === null) throw missingFileError();
      return fileStatus(kind);
    },
    statSync(target) {
      const kind = classify(target);
      if (kind === null) throw missingFileError();
      return fileStatus(kind === "symlink" ? "file" : kind);
    },
    readFileSync(target) {
      if (target !== CREDENTIAL_FILE || contents === null) throw missingFileError();
      return contents;
    },
  };
}

async function fileCredentialProvider(contents = `VERCEL_TOKEN=${SENTINEL}\nVERCEL_TEAM_ID=${TEAM_ID}\n`) {
  const { createVercelCredentialProvider } = await vercel();
  return createVercelCredentialProvider({
    localAppData: LOCAL_APP_DATA,
    env: {},
    ...fakeFilesystem({ contents }),
  });
}

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  };
}

function fetchRecorder(routes) {
  const calls = [];
  return {
    calls,
    implementation(target, init = {}) {
      const url = new URL(String(target));
      calls.push({ url, href: url.toString(), method: init.method ?? "GET", init });
      for (const route of routes) {
        if (route.match(url, init)) {
          return Promise.resolve(jsonResponse(route.status ?? 200, route.body ?? {}));
        }
      }
      return Promise.resolve(jsonResponse(404, {}));
    },
  };
}

function deploymentEntry({ uid, sha, state = "READY", target = "production", branch = "stg" }) {
  return {
    uid,
    state,
    target,
    meta: { githubCommitSha: sha, githubCommitRef: branch },
  };
}

function readOnlyRoutes() {
  return [
    {
      match: (url) => url.pathname === "/v6/deployments" && url.searchParams.get("target") === "preview",
      body: {
        deployments: [
          deploymentEntry({ uid: "dpl_preview_001", sha: SHA.stgMerged, target: "preview" }),
        ],
      },
    },
    {
      match: (url) =>
        url.pathname === "/v6/deployments" && url.searchParams.get("target") === "production",
      body: {
        deployments: [
          deploymentEntry({ uid: "dpl_production_002", sha: SHA.main, state: "ERROR" }),
          deploymentEntry({ uid: "dpl_production_001", sha: SHA.previous }),
        ],
      },
    },
    {
      match: (url) => url.pathname === "/v13/deployments/dpl_preview_001",
      body: { id: "dpl_preview_001", readyState: "READY", target: "preview" },
    },
    {
      match: (url) => url.pathname === `/v4/aliases/${DOMAIN}`,
      body: { deployment: { id: "dpl_production_001" } },
    },
    {
      match: (url) => url.pathname === `/v9/projects/${PROJECT}/env`,
      body: {
        envs: [
          { key: "NEXT_PUBLIC_SUPABASE_URL", target: ["preview"], gitBranch: null, type: "plain" },
          { key: "PRODUCTION_ONLY", target: ["production"], gitBranch: null, type: "encrypted" },
        ],
      },
    },
  ];
}

async function readOnlyAdapter(routes = readOnlyRoutes()) {
  const { createVercelAdapter } = await vercel();
  const recorded = fetchRecorder(routes);
  const adapter = createVercelAdapter({
    credentialProvider: await fileCredentialProvider(),
    fetchImplementation: recorded.implementation,
    sleep: () => Promise.resolve(),
    clock: () => 0,
  });
  return { adapter, recorded };
}

describe("vercel credential provider", () => {
  it("never exposes the credential through serialization, printing, or inspection", async () => {
    const provider = await fileCredentialProvider();

    expect(provider.source()).toBe("file");
    expect(provider.teamId()).toBe(TEAM_ID);
    expect(provider.authorizationHeader()).toBe(`Bearer ${SENTINEL}`);
    expect(Object.isFrozen(provider)).toBe(true);

    for (const rendered of [
      JSON.stringify(provider),
      JSON.stringify({ provider }),
      String(provider),
      `${provider}`,
      provider.toString(),
      provider.inspect(),
      inspect(provider),
      inspect({ provider }, { depth: 5 }),
    ]) {
      expect(rendered).not.toContain(SENTINEL);
    }
    expect(JSON.parse(JSON.stringify(provider))).toEqual({
      recordType: "VercelCredentialProviderV1",
      source: "file",
    });
  });

  it("rejects a credential file that carries any key outside the two allowed names", async () => {
    const { createVercelCredentialProvider, VERCEL_CREDENTIAL_ALLOWED_KEYS } = await vercel();

    expect(VERCEL_CREDENTIAL_ALLOWED_KEYS).toEqual(["VERCEL_TOKEN", "VERCEL_TEAM_ID"]);
    for (const contents of [
      `VERCEL_TOKEN=${SENTINEL}\nVERCEL_PROJECT_ID=prj_extra\n`,
      `VERCEL_TOKEN=${SENTINEL}\nSUPABASE_SERVICE_ROLE_KEY=${SENTINEL}\n`,
      `VERCEL_TEAM_ID=${TEAM_ID}\n`,
      `VERCEL_TOKEN=${SENTINEL}\nVERCEL_TOKEN=${SENTINEL}\n`,
      "not-an-assignment\n",
    ]) {
      let thrown = null;
      try {
        createVercelCredentialProvider({
          localAppData: LOCAL_APP_DATA,
          env: {},
          ...fakeFilesystem({ contents }),
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown?.code).toBe("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
      expect(thrown?.message).toBe("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
      expect(String(thrown?.stack ?? "")).not.toContain(SENTINEL);
    }
  });

  it("rejects a credential file reached through a symbolic or reparse ancestor", async () => {
    const { createVercelCredentialProvider } = await vercel();
    const contents = `VERCEL_TOKEN=${SENTINEL}\n`;

    for (const symlink of [CREDENTIAL_FILE, path.dirname(CREDENTIAL_FILE), LOCAL_APP_DATA]) {
      expect(() =>
        createVercelCredentialProvider({
          localAppData: LOCAL_APP_DATA,
          env: {},
          ...fakeFilesystem({ contents, symlinks: [symlink] }),
        }),
      ).toThrowError("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
    }
  });

  it("falls back to the environment token and reports VERCEL_TOKEN_MISSING when nothing is prepared", async () => {
    const { createVercelCredentialProvider } = await vercel();

    const fallback = createVercelCredentialProvider({
      localAppData: LOCAL_APP_DATA,
      env: { VERCEL_TOKEN: SENTINEL },
      ...fakeFilesystem(),
    });
    expect(fallback.source()).toBe("env");
    expect(fallback.teamId()).toBeNull();
    expect(JSON.stringify(fallback)).not.toContain(SENTINEL);

    for (const env of [{}, { VERCEL_TOKEN: "" }, { VERCEL_TOKEN: "   " }]) {
      expect(() =>
        createVercelCredentialProvider({
          localAppData: LOCAL_APP_DATA,
          env,
          ...fakeFilesystem(),
        }),
      ).toThrowError("VERCEL_TOKEN_MISSING");
    }
  });
});

describe("vercel adapter request safety", () => {
  it("sends the credential only in the Authorization header and keeps it out of every result", async () => {
    const { adapter, recorded } = await readOnlyAdapter();

    const results = {
      preview: await adapter.findDeploymentByCommit({
        projectId: PROJECT,
        commitSha: SHA.stgMerged,
        target: "preview",
      }),
      ready: await adapter.waitForReady({
        deploymentId: "dpl_preview_001",
        maxAttempts: 2,
        intervalMs: 10,
      }),
      alias: await adapter.getAliasTarget({ domain: DOMAIN }),
      previous: await adapter.findPreviousReadyProduction({
        projectId: PROJECT,
        beforeDeploymentId: "dpl_production_002",
      }),
      scope: await adapter.verifyPreviewEnvironmentScope({ projectId: PROJECT, branch: "stg" }),
      missing: await adapter.findDeploymentByCommit({
        projectId: PROJECT,
        commitSha: SHA.candidate,
        target: "preview",
      }),
    };

    expect(results.preview).toEqual({
      deploymentId: "dpl_preview_001",
      state: "READY",
      target: "preview",
      branch: "stg",
    });
    expect(results.ready).toEqual({ state: "READY" });
    expect(results.alias).toEqual({ deploymentId: "dpl_production_001" });
    expect(results.previous).toEqual({ deploymentId: "dpl_production_001", state: "READY" });
    expect(results.scope).toEqual({ environmentScope: "topik-dev" });
    expect(results.missing).toBeNull();
    expect(JSON.stringify(results)).not.toContain(SENTINEL);

    expect(recorded.calls.length).toBeGreaterThan(0);
    for (const call of recorded.calls) {
      expect(call.method).toBe("GET");
      expect(call.href).not.toContain(SENTINEL);
      expect(call.init.headers.authorization).toBe(`Bearer ${SENTINEL}`);
      expect(call.init.redirect).toBe("error");
      expect(call.init.body).toBeUndefined();
      expect(call.url.searchParams.get("teamId")).toBe(TEAM_ID);
      const withoutAuthorization = {
        ...call.init,
        headers: { ...call.init.headers, authorization: null },
      };
      expect(JSON.stringify({ href: call.href, init: withoutAuthorization })).not.toContain(
        SENTINEL,
      );
    }
  });

  it("keeps the credential out of every failure message and stack", async () => {
    const { createVercelAdapter } = await vercel();
    const recorded = fetchRecorder([
      { match: (url) => url.pathname === "/v6/deployments", status: 500 },
      { match: (url) => url.pathname.startsWith("/v13/deployments/"), status: 500 },
      { match: (url) => url.pathname.startsWith("/v4/aliases/"), status: 500 },
      { match: (url) => url.pathname.endsWith("/env"), status: 500 },
    ]);
    const adapter = createVercelAdapter({
      credentialProvider: await fileCredentialProvider(),
      fetchImplementation: recorded.implementation,
      sleep: () => Promise.resolve(),
      clock: () => 0,
    });
    const failures = [];
    for (const attempt of [
      () => adapter.findDeploymentByCommit({ projectId: PROJECT, commitSha: SHA.main, target: "production" }),
      () => adapter.waitForReady({ deploymentId: "dpl_x", maxAttempts: 1, intervalMs: 1 }),
      () => adapter.getAliasTarget({ domain: DOMAIN }),
      () => adapter.findPreviousReadyProduction({ projectId: PROJECT, beforeDeploymentId: "dpl_x" }),
      () => adapter.verifyPreviewEnvironmentScope({ projectId: PROJECT, branch: "stg" }),
    ]) {
      try {
        await attempt();
        throw new Error("expected a failure");
      } catch (error) {
        failures.push(error);
      }
    }

    expect(failures).toHaveLength(5);
    for (const error of failures) {
      expect(error.name).toBe("VercelError");
      expect(error.code).toBe("VERCEL_API_UNAVAILABLE");
      expect(error.message).toBe(error.code);
      expect(String(error.stack ?? "")).not.toContain(SENTINEL);
      expect(JSON.stringify({ code: error.code, message: error.message, ...error })).not.toContain(
        SENTINEL,
      );
    }
  });

  it("stops waiting for READY after a finite number of attempts", async () => {
    const { createVercelAdapter } = await vercel();
    const recorded = fetchRecorder([
      {
        match: (url) => url.pathname === "/v13/deployments/dpl_slow",
        body: { id: "dpl_slow", readyState: "BUILDING", target: "production" },
      },
    ]);
    const sleeps = [];
    const adapter = createVercelAdapter({
      credentialProvider: await fileCredentialProvider(),
      fetchImplementation: recorded.implementation,
      sleep: (milliseconds) => {
        sleeps.push(milliseconds);
        return Promise.resolve();
      },
      clock: () => 0,
    });

    await expect(
      adapter.waitForReady({ deploymentId: "dpl_slow", maxAttempts: 3, intervalMs: 25 }),
    ).rejects.toThrowError("VERCEL_NOT_READY");
    expect(recorded.calls).toHaveLength(3);
    expect(sleeps).toEqual([25, 25]);

    const failed = fetchRecorder([
      {
        match: (url) => url.pathname === "/v13/deployments/dpl_failed",
        body: { id: "dpl_failed", readyState: "ERROR", target: "production" },
      },
    ]);
    const strict = createVercelAdapter({
      credentialProvider: await fileCredentialProvider(),
      fetchImplementation: failed.implementation,
      sleep: () => Promise.resolve(),
      clock: () => 0,
    });
    await expect(
      strict.waitForReady({ deploymentId: "dpl_failed", maxAttempts: 5, intervalMs: 1 }),
    ).rejects.toThrowError("VERCEL_NOT_READY");
    expect(failed.calls).toHaveLength(1);
  });

  it("asks the environment endpoint for names and scope only, never for values", async () => {
    const { adapter, recorded } = await readOnlyAdapter();

    expect(await adapter.verifyPreviewEnvironmentScope({ projectId: PROJECT, branch: "stg" })).toEqual(
      { environmentScope: "topik-dev" },
    );
    const [call] = recorded.calls;
    expect(call.url.pathname).toBe(`/v9/projects/${PROJECT}/env`);
    expect([...call.url.searchParams.keys()].sort()).toEqual(["gitBranch", "teamId"]);
    expect(call.url.searchParams.get("gitBranch")).toBe("stg");
    for (const forbidden of ["decrypt", "source", "value", "values"]) {
      expect(call.url.searchParams.has(forbidden)).toBe(false);
    }
    expect(call.href).not.toContain("decrypt");

    const unscoped = await readOnlyAdapter([
      {
        match: (url) => url.pathname === `/v9/projects/${PROJECT}/env`,
        body: {
          envs: [{ key: "OTHER", target: ["production"], gitBranch: null }],
        },
      },
    ]);
    expect(
      await unscoped.adapter.verifyPreviewEnvironmentScope({ projectId: PROJECT, branch: "stg" }),
    ).toEqual({ environmentScope: null });
  });

  it("writes only when assigning an alias and re-reads the alias to confirm it", async () => {
    const { createVercelAdapter } = await vercel();
    let aliasTarget = "dpl_production_000";
    const recorded = fetchRecorder([
      {
        match: (url, init) =>
          url.pathname === "/v2/deployments/dpl_production_001/aliases" && init.method === "POST",
        body: { uid: "dpl_production_001", alias: DOMAIN },
      },
      {
        match: (url) => url.pathname === `/v4/aliases/${DOMAIN}`,
        get body() {
          return { deployment: { id: aliasTarget } };
        },
      },
    ]);
    const adapter = createVercelAdapter({
      credentialProvider: await fileCredentialProvider(),
      fetchImplementation: (target, init) => {
        if (init?.method === "POST") aliasTarget = "dpl_production_001";
        return recorded.implementation(target, init);
      },
      sleep: () => Promise.resolve(),
      clock: () => 0,
    });

    expect(await adapter.assignAlias({ deploymentId: "dpl_production_001", domain: DOMAIN })).toEqual(
      { assigned: true },
    );
    expect(recorded.calls.map((call) => call.method)).toEqual(["POST", "GET"]);
    expect(recorded.calls.filter((call) => call.method !== "GET")).toHaveLength(1);
    expect(recorded.calls[0].url.pathname).toBe("/v2/deployments/dpl_production_001/aliases");
    expect(recorded.calls[0].init.body).toBe(JSON.stringify({ alias: DOMAIN }));

    const mismatched = fetchRecorder([
      {
        match: (url, init) =>
          url.pathname === "/v2/deployments/dpl_production_001/aliases" && init.method === "POST",
        body: { uid: "dpl_production_001" },
      },
      {
        match: (url) => url.pathname === `/v4/aliases/${DOMAIN}`,
        body: { deployment: { id: "dpl_production_000" } },
      },
    ]);
    const drifting = createVercelAdapter({
      credentialProvider: await fileCredentialProvider(),
      fetchImplementation: mismatched.implementation,
      sleep: () => Promise.resolve(),
      clock: () => 0,
    });
    await expect(
      drifting.assignAlias({ deploymentId: "dpl_production_001", domain: DOMAIN }),
    ).rejects.toThrowError("VERCEL_ALIAS_MISMATCH");
  });

  it("uses GET for every read method and never any other verb", async () => {
    const { adapter, recorded } = await readOnlyAdapter();

    await adapter.findDeploymentByCommit({
      projectId: PROJECT,
      commitSha: SHA.stgMerged,
      target: "preview",
    });
    await adapter.waitForReady({ deploymentId: "dpl_preview_001", maxAttempts: 1, intervalMs: 1 });
    await adapter.getAliasTarget({ domain: DOMAIN });
    await adapter.findPreviousReadyProduction({
      projectId: PROJECT,
      beforeDeploymentId: "dpl_production_002",
    });
    await adapter.verifyPreviewEnvironmentScope({ projectId: PROJECT, branch: "stg" });

    expect(recorded.calls).toHaveLength(5);
    expect(new Set(recorded.calls.map((call) => call.method))).toEqual(new Set(["GET"]));
    for (const call of recorded.calls) {
      expect(call.init.body).toBeUndefined();
      expect(call.init.headers["content-type"]).toBeUndefined();
    }
    expect(Object.keys(adapter).sort()).toEqual([
      "assignAlias",
      "findDeploymentByCommit",
      "findPreviousReadyProduction",
      "getAliasTarget",
      "verifyPreviewEnvironmentScope",
      "waitForReady",
    ]);
    expect(Object.isFrozen(adapter)).toBe(true);
  });

  it("reports a missing deployment separately from an unavailable API", async () => {
    const { adapter } = await readOnlyAdapter();

    await expect(
      adapter.waitForReady({ deploymentId: "dpl_absent", maxAttempts: 1, intervalMs: 1 }),
    ).rejects.toThrowError("VERCEL_DEPLOYMENT_NOT_FOUND");
    await expect(
      adapter.findPreviousReadyProduction({ projectId: PROJECT, beforeDeploymentId: "dpl_absent" }),
    ).rejects.toThrowError("VERCEL_DEPLOYMENT_NOT_FOUND");
    const empty = await readOnlyAdapter([
      { match: (url) => url.pathname === `/v4/aliases/${DOMAIN}`, status: 404 },
    ]);
    expect(await empty.adapter.getAliasTarget({ domain: DOMAIN })).toBeNull();
  });

  it("refuses to build an adapter without a sealed credential provider", async () => {
    const { createVercelAdapter } = await vercel();

    for (const credentialProvider of [null, undefined, {}, { authorizationHeader: () => "" }]) {
      expect(() =>
        createVercelAdapter({ credentialProvider, fetchImplementation: () => {} }),
      ).toThrowError("VERCEL_TOKEN_MISSING");
    }
    expect(() =>
      createVercelAdapter({
        credentialProvider: {
          authorizationHeader: () => "",
          teamId: () => null,
          source: () => "env",
        },
        fetchImplementation: null,
      }),
    ).toThrowError("VERCEL_API_UNAVAILABLE");
  });

  it("refuses a base URL that would carry the credential over a plain connection", async () => {
    const { createVercelAdapter } = await vercel();
    const credentialProvider = await fileCredentialProvider();

    for (const baseUrl of [
      "http://api.vercel.com",
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "ftp://api.vercel.com",
      "not-a-url",
    ]) {
      expect(() =>
        createVercelAdapter({
          credentialProvider,
          fetchImplementation: () => {
            throw new Error("must not run");
          },
          baseUrl,
        }),
      ).toThrowError("VERCEL_API_UNAVAILABLE");
    }
    expect(
      createVercelAdapter({
        credentialProvider,
        fetchImplementation: () => Promise.resolve(jsonResponse(200, {})),
        baseUrl: "https://api.vercel.test",
      }),
    ).toBeDefined();
  });

  it("abandons a request that never answers and reports it as an unavailable API", async () => {
    const { createVercelAdapter } = await vercel();
    const signals = [];
    const adapter = createVercelAdapter({
      credentialProvider: await fileCredentialProvider(),
      fetchImplementation: (target, init) => {
        signals.push(init?.signal ?? null);
        return new Promise(() => {});
      },
      sleep: () => Promise.resolve(),
      clock: () => 0,
      requestTimeoutMs: 5,
    });

    await expect(
      adapter.findDeploymentByCommit({
        projectId: PROJECT,
        commitSha: SHA.stgMerged,
        target: "preview",
      }),
    ).rejects.toThrowError("VERCEL_API_UNAVAILABLE");
    await expect(
      adapter.waitForReady({ deploymentId: "dpl_preview_001", maxAttempts: 1, intervalMs: 1 }),
    ).rejects.toThrowError("VERCEL_API_UNAVAILABLE");
    expect(signals).toHaveLength(2);
    for (const signal of signals) {
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(true);
    }
  });
});

describe("vercel observation mapping", () => {
  function securityAudit() {
    const payload = {
      schemaVersion: 1,
      recordType: "SecurityArtifactDiffAuditV1",
      baseline: { ref: BASELINE_SHA, commitHash: digest(BASELINE_SHA) },
      refs: ["collab/main", "collab/stg", "origin/main"],
      snapshots: [
        { ref: "collab/main", commitHash: digest(SHA.stg) },
        { ref: "collab/stg", commitHash: digest(SHA.stg) },
        { ref: "origin/main", commitHash: digest(SHA.source) },
      ],
      findings: [],
      summary: { refCount: 3, scannedPathCount: 24, findingCount: 0 },
    };
    return { ...payload, fingerprint: digest(JSON.stringify(payload)) };
  }

  function migrationEvidence() {
    return {
      productionProjectIdentityHash: digest("production-project"),
      remoteTrackerDigest: digest("tracker"),
      trackerIsExactManifestPrefix: true,
      schemaRpcRlsGrantFingerprint: digest("schema-rpc-rls-grant"),
      appliedMigrationManifestDigest: digest("applied-migrations"),
      backupPitrEvidenceDigest: digest("backup-pitr"),
      pinnedToolchainDigest: digest("supabase-cli-action"),
      previousMaxTimestamp: "20260722000000",
      newMigrations: [
        {
          path: "supabase/migrations/20260723000000_forward_fix.sql",
          timestamp: "20260723000000",
          sha256: digest("forward migration"),
        },
      ],
      historicalChanges: [],
      dryRunDigest: digest("planned apply"),
      applyDigest: digest("planned apply"),
      destructiveSql: false,
      grantRevocation: false,
      compatibilityBreak: false,
      nMinusOneTopikDevPassed: true,
      nTopikDevPassed: true,
      autoApplyEnabled: false,
    };
  }

  async function runUpToProduction() {
    const { advancePromotionRun, createApprovalPolicy, createPromotionRun } = await promotion();
    const {
      buildCandidateVerifiedEvent,
      buildDbGateEvaluatedEvent,
      buildMainMergeVerifiedEvent,
      buildMainPrOpenEvent,
      buildStgPrOpenEvent,
      buildStgReadyEvent,
    } = await executor();
    const { candidateMergeObservation, mainMergeObservation, mainPullRequestObservation, stgPullRequestObservation, stgReadyObservation } =
      await import("../../scripts/lib/ai-release-git.mjs");
    const { previewObservation } = await vercel();

    let record = createPromotionRun({
      runId: "promotion-20260723-11111111",
      now: "2026-07-23T10:00:00.000Z",
      sourceSha: SHA.source,
      sourceTreeHash: SHA.tree,
      stgBaseSha: SHA.stg,
      securityAudit: securityAudit(),
      expectedSecurityRefs: ["collab/main", "collab/stg", "origin/main"],
      expectedBaselineSha: BASELINE_SHA,
      controlPlaneReady: true,
      stgReady: true,
      vercelDomain: DOMAIN,
      vercelProject: PROJECT,
    });
    let policy = createApprovalPolicy({
      contractFingerprint: record.contractFingerprint,
      profileFingerprint: record.profileFingerprint,
    });
    const advance = (event) => {
      const result = advancePromotionRun(record, {
        expectedRevision: record.revision,
        expectedFingerprint: record.fingerprint,
        policy,
        event,
      });
      record = result.record;
      policy = result.policy;
    };

    advance(
      buildCandidateVerifiedEvent({
        at: "2026-07-23T10:01:00.000Z",
        record,
        observed: candidateMergeObservation({
          candidateBranch: record.target.candidateBranch,
          candidateSha: SHA.candidate,
          baseSha: SHA.stg,
          sourceSha: SHA.source,
          parents: [SHA.stg, SHA.source],
        }),
      }),
    );
    advance(
      buildStgPrOpenEvent({
        at: "2026-07-23T10:02:00.000Z",
        record,
        observed: stgPullRequestObservation({
          headBranch: record.target.candidateBranch,
          headSha: SHA.candidate,
        }),
      }),
    );
    advance(
      buildStgReadyEvent({
        at: "2026-07-23T10:03:00.000Z",
        record,
        observed: stgReadyObservation({
          stgSha: SHA.stgMerged,
          parents: [SHA.stg, SHA.candidate],
          preview: previewObservation({
            deployment: {
              deploymentId: "dpl_preview_001",
              state: "READY",
              target: "preview",
              branch: "stg",
            },
            project: PROJECT,
            expectedStgSha: SHA.stgMerged,
            environmentScope: "topik-dev",
          }),
        }),
      }),
    );
    advance(
      buildDbGateEvaluatedEvent({
        at: "2026-07-23T10:04:00.000Z",
        record,
        observed: { migrationEvidence: migrationEvidence() },
      }),
    );
    advance({
      type: "PROD_APPROVAL_GRANTED",
      at: "2026-07-23T10:05:00.000Z",
      approvalFingerprint: record.approval.approvalFingerprint,
    });
    advance(
      buildMainPrOpenEvent({
        at: "2026-07-23T10:06:00.000Z",
        record,
        observed: mainPullRequestObservation({ headSha: record.target.stgSha }),
      }),
    );
    advance(
      buildMainMergeVerifiedEvent({
        at: "2026-07-23T10:07:00.000Z",
        record,
        observed: mainMergeObservation({
          mainBaseSha: SHA.previous,
          mainSha: SHA.main,
          headSha: record.target.stgSha,
          parents: [SHA.previous, record.target.stgSha],
        }),
      }),
    );
    return { advance, record: () => record };
  }

  it("feeds the real preview validator and the real STG_READY assembler", async () => {
    const { validateVercelPreviewEvidence } = await promotion();
    const { previewObservation } = await vercel();

    const observation = previewObservation({
      deployment: {
        deploymentId: "dpl_preview_001",
        state: "READY",
        target: "preview",
        branch: "stg",
      },
      project: PROJECT,
      expectedStgSha: SHA.stgMerged,
      environmentScope: "topik-dev",
    });
    expect(observation).toEqual({
      deploymentId: "dpl_preview_001",
      commitSha: SHA.stgMerged,
      project: PROJECT,
      state: "READY",
      target: "preview",
      branch: "stg",
      environmentScope: "topik-dev",
    });
    expect(
      validateVercelPreviewEvidence(observation, SHA.stgMerged, { expectedProject: PROJECT }),
    ).toEqual({ ok: true, code: "STG_PREVIEW_READY" });
    expect(
      validateVercelPreviewEvidence(
        previewObservation({
          deployment: {
            deploymentId: "dpl_preview_001",
            state: "BUILDING",
            target: "preview",
            branch: "stg",
          },
          project: PROJECT,
          expectedStgSha: SHA.stgMerged,
          environmentScope: null,
        }),
        SHA.stgMerged,
        { expectedProject: PROJECT },
      ),
    ).toEqual({ ok: false, code: "STG_PREVIEW_GATE_BLOCKED" });
    expect(() =>
      previewObservation({
        deployment: {
          deploymentId: "dpl_preview_001",
          commitSha: SHA.main,
          state: "READY",
          target: "preview",
          branch: "stg",
        },
        project: PROJECT,
        expectedStgSha: SHA.stgMerged,
        environmentScope: "topik-dev",
      }),
    ).toThrowError("EXECUTOR_PREVIEW_EVIDENCE_INVALID");
  });

  it("feeds the real production validator and reaches RELEASED through the real assembler", async () => {
    const { validateVercelProductionEvidence } = await promotion();
    const { buildProductionEvaluatedEvent } = await executor();
    const { productionObservation } = await vercel();
    const walk = await runUpToProduction();

    const deployment = productionObservation({
      deployment: {
        deploymentId: "dpl_production_002",
        commitSha: SHA.main,
        state: "READY",
        target: "production",
      },
      project: PROJECT,
      domain: DOMAIN,
      alias: DOMAIN,
      aliasSwitched: true,
      smoke: { smokePassed: true, smokeReadOnly: true, checkCount: 2, failedCheckCount: 0 },
      previousReady: { deploymentId: "dpl_production_001", state: "READY" },
    });
    expect(
      validateVercelProductionEvidence(deployment, {
        expectedMainSha: SHA.main,
        requiredProject: PROJECT,
        requiredAlias: DOMAIN,
        requiredDomain: DOMAIN,
      }),
    ).toEqual({ ok: true, code: "PRODUCTION_READY" });

    walk.advance(
      buildProductionEvaluatedEvent({
        at: "2026-07-23T10:08:00.000Z",
        record: walk.record(),
        observed: { deployment },
      }),
    );
    expect(walk.record().state).toBe("RELEASED");
    expect(walk.record().vercel.smokeStatus).toBe("PASSED");
    expect(walk.record().vercel.deploymentId).toBe("dpl_production_002");
  });

  it("maps a failed smoke run into the real alias rollback path with databaseChanged false", async () => {
    const { validateVercelProductionEvidence, validateVercelRollbackEvidence } = await promotion();
    const { buildAliasRollbackVerifiedEvent, buildProductionEvaluatedEvent } = await executor();
    const { productionObservation, rollbackObservation } = await vercel();
    const walk = await runUpToProduction();

    const deployment = productionObservation({
      deployment: {
        deploymentId: "dpl_production_002",
        commitSha: SHA.main,
        state: "READY",
        target: "production",
      },
      project: PROJECT,
      domain: DOMAIN,
      alias: DOMAIN,
      aliasSwitched: true,
      smoke: { smokePassed: false, smokeReadOnly: true, checkCount: 2, failedCheckCount: 1 },
      previousReady: { deploymentId: "dpl_production_001", state: "READY" },
    });
    expect(
      validateVercelProductionEvidence(deployment, {
        expectedMainSha: SHA.main,
        requiredProject: PROJECT,
        requiredAlias: DOMAIN,
        requiredDomain: DOMAIN,
      }),
    ).toEqual({
      ok: false,
      code: "ALIAS_ROLLBACK_REQUIRED",
      rollbackDeploymentId: "dpl_production_001",
      rollbackScope: "ALIAS_ONLY",
      databaseRollbackAllowed: false,
    });

    walk.advance(
      buildProductionEvaluatedEvent({
        at: "2026-07-23T10:08:00.000Z",
        record: walk.record(),
        observed: { deployment },
      }),
    );
    expect(walk.record().state).toBe("ALIAS_ROLLBACK_REQUIRED");
    expect(walk.record().vercel.rollbackDeploymentId).toBe("dpl_production_001");

    const rollback = rollbackObservation({
      deployment: { deploymentId: "dpl_production_001", state: "READY" },
      alias: DOMAIN,
    });
    expect(rollback).toEqual({
      rollbackDeploymentId: "dpl_production_001",
      rollbackDeploymentState: "READY",
      alias: DOMAIN,
      databaseChanged: false,
    });
    expect(
      validateVercelRollbackEvidence(rollback, {
        requiredDeploymentId: "dpl_production_001",
        requiredAlias: DOMAIN,
      }),
    ).toEqual({ ok: true, code: "ALIAS_ROLLBACK_VERIFIED" });

    walk.advance(
      buildAliasRollbackVerifiedEvent({
        at: "2026-07-23T10:09:00.000Z",
        record: walk.record(),
        observed: { rollback },
      }),
    );
    expect(walk.record().state).toBe("PRESERVED");
    expect(walk.record().blocker).toBe("PRODUCTION_SMOKE_FAILED_ALIAS_ROLLED_BACK");
  });

  it("always reports databaseChanged as false and refuses to be told otherwise", async () => {
    const { rollbackObservation } = await vercel();

    for (const deployment of [
      { deploymentId: "dpl_a", state: "READY", databaseChanged: true },
      { deploymentId: "dpl_a", state: "READY", databaseChanged: "true" },
      { deploymentId: "dpl_a", state: "READY" },
    ]) {
      expect(rollbackObservation({ deployment, alias: DOMAIN }).databaseChanged).toBe(false);
    }
    expect(
      Object.keys(rollbackObservation({
        deployment: { deploymentId: "dpl_a", state: "READY" },
        alias: DOMAIN,
      })).sort(),
    ).toEqual(["alias", "databaseChanged", "rollbackDeploymentId", "rollbackDeploymentState"]);
  });

  it("refuses to build production evidence from a smoke run that is not read-only", async () => {
    const { productionObservation } = await vercel();

    expect(() =>
      productionObservation({
        deployment: {
          deploymentId: "dpl_production_002",
          commitSha: SHA.main,
          state: "READY",
          target: "production",
        },
        project: PROJECT,
        domain: DOMAIN,
        alias: DOMAIN,
        aliasSwitched: true,
        smoke: { smokePassed: true, smokeReadOnly: false, checkCount: 1, failedCheckCount: 0 },
        previousReady: null,
      }),
    ).toThrowError("EXECUTOR_SMOKE_MUST_BE_READ_ONLY");
  });
});

describe("read-only production smoke runner", () => {
  function smokeRecorder(statuses) {
    const calls = [];
    return {
      calls,
      implementation(target, init = {}) {
        calls.push({ href: String(target), init });
        const status = statuses.shift();
        if (status === "throw") return Promise.reject(new Error("network refused"));
        return Promise.resolve({
          status,
          get body() {
            throw new Error("smoke runner must not read the response body");
          },
          json: () => {
            throw new Error("smoke runner must not read the response body");
          },
          text: () => {
            throw new Error("smoke runner must not read the response body");
          },
        });
      },
    };
  }

  it("issues plain GET requests without any authentication header", async () => {
    const { runReadOnlySmoke } = await vercel();
    const recorded = smokeRecorder([200, 307]);

    expect(
      await runReadOnlySmoke({
        baseUrl: `https://${DOMAIN}`,
        checks: [
          { path: "/", expectedStatus: 200 },
          { path: "/auth/login", expectedStatus: 307 },
        ],
        fetchImplementation: recorded.implementation,
        timeoutMs: 5000,
      }),
    ).toEqual({ smokePassed: true, smokeReadOnly: true, checkCount: 2, failedCheckCount: 0 });

    expect(recorded.calls.map((call) => call.href)).toEqual([
      `https://${DOMAIN}/`,
      `https://${DOMAIN}/auth/login`,
    ]);
    for (const call of recorded.calls) {
      expect(call.init.method).toBe("GET");
      expect(call.init.redirect).toBe("manual");
      expect(call.init.headers).toBeUndefined();
      expect(call.init.body).toBeUndefined();
      for (const key of Object.keys(call.init)) {
        expect(key).not.toMatch(/auth|header|cookie|credential|token/iu);
      }
    }
  });

  it("counts an unexpected status or a refused request as a failed check", async () => {
    const { runReadOnlySmoke } = await vercel();

    expect(
      await runReadOnlySmoke({
        baseUrl: `https://${DOMAIN}`,
        checks: [
          { path: "/", expectedStatus: 200 },
          { path: "/health", expectedStatus: 200 },
          { path: "/writing", expectedStatus: 200 },
        ],
        fetchImplementation: smokeRecorder([200, 500, "throw"]).implementation,
      }),
    ).toEqual({ smokePassed: false, smokeReadOnly: true, checkCount: 3, failedCheckCount: 2 });
  });

  it("refuses checks that would leave the production origin or carry an unusable status", async () => {
    const { runReadOnlySmoke } = await vercel();
    const attempt = (checks) =>
      runReadOnlySmoke({
        baseUrl: `https://${DOMAIN}`,
        checks,
        fetchImplementation: () => {
          throw new Error("must not run");
        },
      });

    for (const checks of [
      [],
      [{ path: "https://evil.example.com/", expectedStatus: 200 }],
      [{ path: "//evil.example.com/", expectedStatus: 200 }],
      [{ path: "relative", expectedStatus: 200 }],
      [{ path: "/", expectedStatus: 99 }],
      [{ path: "/", expectedStatus: "200" }],
      [null],
    ]) {
      await expect(attempt(checks)).rejects.toThrowError("EXECUTOR_SMOKE_CHECK_INVALID");
    }
    await expect(
      runReadOnlySmoke({
        baseUrl: "ftp://talkpik.example.com",
        checks: [{ path: "/", expectedStatus: 200 }],
        fetchImplementation: () => {
          throw new Error("must not run");
        },
      }),
    ).rejects.toThrowError("EXECUTOR_SMOKE_CHECK_INVALID");
  });

  it("counts a check that never answers as failed instead of hanging", async () => {
    const { runReadOnlySmoke } = await vercel();
    const signals = [];

    expect(
      await runReadOnlySmoke({
        baseUrl: `https://${DOMAIN}`,
        checks: [{ path: "/", expectedStatus: 200 }],
        fetchImplementation: (target, init) => {
          signals.push(init?.signal ?? null);
          return new Promise(() => {});
        },
        timeoutMs: 5,
      }),
    ).toEqual({ smokePassed: false, smokeReadOnly: true, checkCount: 1, failedCheckCount: 1 });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[0].aborted).toBe(true);
  });
});

describe("credential location follows the shared pipeline folder", () => {
  const roots = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function sharedRoot() {
    const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), "talkpik-shared-cred-")));
    roots.push(root);
    return root;
  }

  function filesystemFor(expectedFile, contents) {
    const directories = new Set();
    let directory = path.dirname(expectedFile);
    for (;;) {
      directories.add(directory);
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
    const classify = (target) => {
      if (target === expectedFile) return contents === null ? null : "file";
      return directories.has(target) ? "directory" : null;
    };
    return {
      lstatSync(target) {
        const kind = classify(target);
        if (kind === null) throw missingFileError();
        return fileStatus(kind);
      },
      statSync(target) {
        const kind = classify(target);
        if (kind === null) throw missingFileError();
        return fileStatus(kind);
      },
      readFileSync(target) {
        if (target !== expectedFile || contents === null) throw missingFileError();
        return contents;
      },
    };
  }

  it("reads the credential from the configured shared folder, not the personal folder", async () => {
    const { createVercelCredentialProvider } = await vercel();
    const shared = sharedRoot();
    const expected = path.join(shared, "credentials", "vercel.env");

    const provider = createVercelCredentialProvider({
      localAppData: "C:\Users\someone\AppData\Local",
      env: { TALKPIK_PIPELINE_SHARED_ROOT: shared },
      ...filesystemFor(expected, `VERCEL_TOKEN=${SENTINEL}\n`),
    });

    expect(provider.source()).toBe("file");
    expect(inspect(provider)).not.toContain(SENTINEL);
  });

  it("does not fall back to the personal folder when a shared folder is configured", async () => {
    const { createVercelCredentialProvider } = await vercel();
    const shared = sharedRoot();
    const personal = path.join(
      "C:\Users\someone\AppData\Local",
      "TalkpikPipeline",
      "credentials",
      "vercel.env",
    );

    expect(() =>
      createVercelCredentialProvider({
        localAppData: "C:\Users\someone\AppData\Local",
        env: { TALKPIK_PIPELINE_SHARED_ROOT: shared },
        ...filesystemFor(personal, `VERCEL_TOKEN=${SENTINEL}\n`),
      }),
    ).toThrowError("VERCEL_TOKEN_MISSING");
  });
});

describe("credential lookup never depends on the real filesystem", () => {
  const roots = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function realRoot(prefix) {
    const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), prefix)));
    roots.push(root);
    return root;
  }

  it("reads the credential even when the personal folder path is redirected on the real disk", async () => {
    const { createVercelCredentialProvider } = await vercel();
    const target = realRoot("talkpik-cred-target-");
    const parent = realRoot("talkpik-cred-parent-");
    const redirected = path.join(parent, "redirected");
    try {
      symlinkSync(target, redirected, "junction");
    } catch {
      return;
    }

    const expected = path.join(redirected, "TalkpikPipeline", "credentials", "vercel.env");
    const directories = new Set();
    let directory = path.dirname(expected);
    for (;;) {
      directories.add(directory);
      const next = path.dirname(directory);
      if (next === directory) break;
      directory = next;
    }
    const classify = (entry) =>
      entry === expected ? "file" : directories.has(entry) ? "directory" : null;

    const provider = createVercelCredentialProvider({
      localAppData: redirected,
      env: {},
      lstatSync(entry) {
        const kind = classify(entry);
        if (kind === null) throw missingFileError();
        return fileStatus(kind);
      },
      statSync(entry) {
        const kind = classify(entry);
        if (kind === null) throw missingFileError();
        return fileStatus(kind);
      },
      readFileSync(entry) {
        if (entry !== expected) throw missingFileError();
        return `VERCEL_TOKEN=${SENTINEL}\n`;
      },
    });

    expect(provider.source()).toBe("file");
  });
});
