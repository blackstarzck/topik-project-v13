import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const roots = [];
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

function tempRoot() {
  const root = realpathSync.native(
    mkdtempSync(path.join(tmpdir(), "ai-release-promotion-")),
  );
  roots.push(root);
  return root;
}

function securityAudit(overrides = {}) {
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
    ...overrides,
  };
  return { ...payload, fingerprint: digest(JSON.stringify(payload)) };
}

function legacySecurityAudit(overrides = {}) {
  const payload = {
    schemaVersion: 1,
    recordType: "SecurityArtifactAuditV1",
    refs: ["collab/main", "collab/stg", "origin/main"],
    snapshots: [
      { ref: "collab/main", commitHash: digest(SHA.stg) },
      { ref: "collab/stg", commitHash: digest(SHA.stg) },
      { ref: "origin/main", commitHash: digest(SHA.source) },
    ],
    findings: [],
    summary: { refCount: 3, scannedPathCount: 24, findingCount: 0 },
    ...overrides,
  };
  return { ...payload, fingerprint: digest(JSON.stringify(payload)) };
}

function migrationEvidence(overrides = {}) {
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
    ...overrides,
  };
}

function previewEvidence(overrides = {}) {
  return {
    deploymentId: "dpl_preview_001",
    commitSha: SHA.candidate,
    project: "topik-project-v13",
    state: "READY",
    target: "preview",
    branch: "stg",
    environmentScope: "topik-dev",
    ...overrides,
  };
}

function productionEvidence(overrides = {}) {
  return {
    deploymentId: "dpl_production_001",
    commitSha: SHA.main,
    project: "topik-project-v13",
    state: "READY",
    target: "production",
    alias: "talkpik.example.com",
    domain: "talkpik.example.com",
    smokeReadOnly: true,
    smokePassed: true,
    aliasSwitched: true,
    previousReadyDeploymentId: "dpl_previous_ready",
    previousReadyState: "READY",
    ...overrides,
  };
}

function runInput(overrides = {}) {
  return {
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
    vercelDomain: "talkpik.example.com",
    vercelProject: "topik-project-v13",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("PromotionRunV1 profiles and schema", () => {
  it("uses fixed repository and authentication profiles", async () => {
    const { PROMOTION_PROFILES, parseRepositoryIdentity, verifyRepositoryProfile } =
      await import("../../scripts/lib/ai-release-promotion.mjs");

    expect(PROMOTION_PROFILES.black).toEqual({
      name: "black",
      remote: "origin",
      repositoryIdentity: "blackstarzck/topik-project-v13",
      authLogin: "blackstarzck",
      baseBranch: "main",
    });
    expect(PROMOTION_PROFILES.keduall).toMatchObject({
      remote: "collab",
      repositoryIdentity: "keduall/topik-project-v13",
      authLogin: "guestkeduall-design",
      stgBranch: "stg",
      mainBranch: "main",
    });
    expect(parseRepositoryIdentity("git@github.com:keduall/topik-project-v13.git")).toBe(
      "keduall/topik-project-v13",
    );
    expect(parseRepositoryIdentity("https://github.com/blackstarzck/topik-project-v13.git")).toBe(
      "blackstarzck/topik-project-v13",
    );
    expect(() =>
      parseRepositoryIdentity("https://token@github.com/keduall/topik-project-v13.git"),
    ).toThrowError("REMOTE_URL_CONTAINS_USERINFO");
    expect(() =>
      verifyRepositoryProfile({
        profile: PROMOTION_PROFILES.keduall,
        remoteUrl: "git@github.com:keduall/topik-project-v13.git",
        authLogin: "keduall",
      }),
    ).toThrowError("AUTH_LOGIN_MISMATCH");
  });

  it("creates a closed, fingerprinted, secret-safe record", async () => {
    const { createPromotionRun, PROMOTION_STATES, validatePromotionRunV1 } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    const record = createPromotionRun(runInput());

    expect(record.recordType).toBe("PromotionRunV1");
    expect(record.contractVersion).toBe("3.1");
    expect(PROMOTION_STATES).toContain("SECURITY_INCIDENT_BLOCKED");
    expect(PROMOTION_STATES).not.toContain("SECURITY_AUDIT_BLOCKED");
    expect(record.profileFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(record.state).toBe("PLANNED");
    expect(record.vercel).toMatchObject({
      project: "topik-project-v13",
      domain: "talkpik.example.com",
      environment: "stg=preview;main=production",
    });
    expect(validatePromotionRunV1(record)).toEqual([]);
    expect(validatePromotionRunV1({ ...record, token: "must-not-exist" })).toContainEqual({
      code: "SECRET_FIELD_FORBIDDEN",
      path: "token",
    });
    const tampered = structuredClone(record);
    tampered.source.repositoryIdentity = "other/repo";
    expect(validatePromotionRunV1(tampered)).toContainEqual({
      code: "FINGERPRINT_MISMATCH",
      path: "fingerprint",
    });
    expect(() => createPromotionRun(runInput({ vercelDomain: "" }))).toThrowError(
      "VERCEL_CONFIGURATION_REQUIRED",
    );
  });
});

describe("security audit gate", () => {
  it.each([
    ["missing evidence", { securityAudit: null }, "SECURITY_AUDIT_REQUIRED"],
    [
      "malformed evidence",
      { securityAudit: { schemaVersion: 1 } },
      "SECURITY_AUDIT_SCHEMA_INVALID",
    ],
    [
      "legacy full-history evidence",
      { securityAudit: legacySecurityAudit() },
      "SECURITY_AUDIT_BASELINE_REQUIRED",
    ],
    [
      "wrong refs",
      {
        securityAudit: securityAudit({
          refs: ["origin/main"],
          snapshots: [{ ref: "origin/main", commitHash: digest(SHA.source) }],
          summary: { refCount: 1, scannedPathCount: 24, findingCount: 0 },
        }),
      },
      "SECURITY_AUDIT_REFS_MISMATCH",
    ],
    ["missing baseline", { expectedBaselineSha: null }, "SECURITY_AUDIT_BASELINE_REQUIRED"],
    ["wrong baseline", { expectedBaselineSha: SHA.previous }, "SECURITY_AUDIT_BASELINE_MISMATCH"],
    [
      "artifact findings",
      {
        securityAudit: securityAudit({
          findings: [
            {
              ref: "origin/main",
              path: ".scratch/a",
              rule: "TRACKED_SCRATCH_PATH",
              pathHash: digest(".scratch/a"),
              historyCommitCount: 1,
              commitHashes: [digest("commit")],
            },
          ],
          summary: { refCount: 3, scannedPathCount: 24, findingCount: 1 },
        }),
      },
      "SECURITY_ARTIFACT_FINDINGS_BLOCKED",
    ],
  ])(
    "returns a non-persistent audit block for %s",
    async (_label, overrides, blocker) => {
      const { startPromotion } = await import(
        "../../scripts/lib/ai-release-promotion.mjs"
      );

      const result = startPromotion(runInput(overrides));

      expect(result).toEqual({
        schemaVersion: 1,
        recordType: "PromotionStartResultV1",
        state: "SECURITY_AUDIT_BLOCKED",
        blocker,
        mutationAttempted: false,
      });
    },
  );

  it("keeps createPromotionRun fail-closed for missing evidence", async () => {
    const { createPromotionRun } = await import("../../scripts/lib/ai-release-promotion.mjs");

    expect(() => createPromotionRun(runInput({ securityAudit: null }))).toThrowError(
      "SECURITY_AUDIT_REQUIRED",
    );
  });

  it("rejects a zero-finding audit that was captured at a stale source or stg SHA", async () => {
    const { createPromotionRun } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    const staleSource = securityAudit({
      snapshots: [
        { ref: "collab/main", commitHash: digest(SHA.stg) },
        { ref: "collab/stg", commitHash: digest(SHA.stg) },
        { ref: "origin/main", commitHash: digest(SHA.previous) },
      ],
    });
    expect(() => createPromotionRun(runInput({ securityAudit: staleSource }))).toThrowError(
      "SECURITY_AUDIT_SOURCE_STALE",
    );
    const staleStg = securityAudit({
      snapshots: [
        { ref: "collab/main", commitHash: digest(SHA.stg) },
        { ref: "collab/stg", commitHash: digest(SHA.previous) },
        { ref: "origin/main", commitHash: digest(SHA.source) },
      ],
    });
    expect(() => createPromotionRun(runInput({ securityAudit: staleStg }))).toThrowError(
      "SECURITY_AUDIT_STG_STALE",
    );
  });

  it("creates a promotion record only from a baseline-bound diff audit", async () => {
    const { createPromotionRun, validateSecurityAuditEvidence } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    const legacy = legacySecurityAudit();

    expect(
      validateSecurityAuditEvidence(legacy, ["collab/main", "collab/stg", "origin/main"], {
        sourceSha: SHA.source,
        stgBaseSha: SHA.stg,
        stgReady: true,
      }),
    ).toEqual({ ok: true, code: "SECURITY_AUDIT_CLEAR" });
    expect(() => createPromotionRun(runInput({ securityAudit: legacy }))).toThrowError(
      "SECURITY_AUDIT_BASELINE_REQUIRED",
    );
    expect(() =>
      createPromotionRun(runInput({ expectedBaselineSha: null })),
    ).toThrowError("SECURITY_AUDIT_BASELINE_REQUIRED");
    expect(() =>
      createPromotionRun(runInput({ expectedBaselineSha: SHA.previous })),
    ).toThrowError("SECURITY_AUDIT_BASELINE_MISMATCH");
  });

  it("stores the audited baseline without moving the contract or profile fingerprint", async () => {
    const {
      PROMOTION_PROFILES,
      createPromotionRun,
      promotionProfileFingerprint,
      stableFingerprint,
      validatePromotionRunV1,
    } = await import("../../scripts/lib/ai-release-promotion.mjs");
    const audit = securityAudit();
    const record = createPromotionRun(runInput({ securityAudit: audit }));

    expect(record.security).toEqual({
      auditFingerprint: audit.fingerprint,
      baselineCommitHash: digest(BASELINE_SHA),
      refs: ["collab/main", "collab/stg", "origin/main"],
      findingCount: 0,
    });
    expect(validatePromotionRunV1(record)).toEqual([]);
    expect(record.contractFingerprint).toBe(
      stableFingerprint({
        contractVersion: "3.1",
        black: PROMOTION_PROFILES.black,
        keduall: PROMOTION_PROFILES.keduall,
        dbPolicy: "baseline-required-manual-apply-forward-fix",
        vercelPolicy: "stg-preview-main-production-exact-sha-read-only-smoke",
        approvalPolicy: "two-consecutive-successes",
      }),
    );
    expect(record.profileFingerprint).toBe(
      promotionProfileFingerprint({
        vercelProject: "topik-project-v13",
        vercelDomain: "talkpik.example.com",
      }),
    );

    const missingBaseline = structuredClone(record);
    delete missingBaseline.security.baselineCommitHash;
    expect(validatePromotionRunV1(missingBaseline)).toContainEqual({
      code: "INVALID_DIGEST",
      path: "security.baselineCommitHash",
    });
  });

  it("loads only an in-root non-symlink audit file", async () => {
    const { loadSecurityAuditEvidence } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    const root = tempRoot();
    const evidenceDir = path.join(root, "evidence");
    mkdirSync(evidenceDir);
    const evidencePath = path.join(evidenceDir, "audit.json");
    writeFileSync(evidencePath, JSON.stringify(securityAudit()));
    expect(loadSecurityAuditEvidence({ evidencePath, allowedRoot: root })).toMatchObject({
      recordType: "SecurityArtifactDiffAuditV1",
    });
    expect(() =>
      loadSecurityAuditEvidence({ evidencePath: path.join(root, "..", "outside.json"), allowedRoot: root }),
    ).toThrowError("SECURITY_EVIDENCE_PATH_ESCAPE");

    const linkPath = path.join(root, "audit-link.json");
    let linked = false;
    try {
      symlinkSync(evidencePath, linkPath, "file");
      linked = true;
    } catch {
      // Windows may deny creating symlinks outside developer mode.
    }
    if (linked) {
      expect(() => loadSecurityAuditEvidence({ evidencePath: linkPath, allowedRoot: root })).toThrowError(
        "SECURITY_EVIDENCE_SYMLINK",
      );
    }
  });
});

describe("Git promotion contract", () => {
  it("holds at bootstrap until both control plane and stg exist", async () => {
    const { createPromotionRun } = await import("../../scripts/lib/ai-release-promotion.mjs");
    expect(createPromotionRun(runInput({ controlPlaneReady: false })).state).toBe(
      "BOOTSTRAP_REQUIRED",
    );
    expect(createPromotionRun(runInput({ stgReady: false })).state).toBe("BOOTSTRAP_REQUIRED");
  });

  it("plans the candidate from exact stg and requires ordered merge parents", async () => {
    const { planCandidate, validateCandidateMerge } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    const plan = planCandidate({
      now: "2026-07-23T10:00:00.000Z",
      sourceSha: SHA.source,
      stgBaseSha: SHA.stg,
    });
    expect(plan).toEqual({
      branch: "chore/promote-20260723-11111111",
      baseSha: SHA.stg,
      sourceSha: SHA.source,
      mergeMethod: "merge",
      noFastForward: true,
      expectedParents: [SHA.stg, SHA.source],
    });
    expect(
      validateCandidateMerge({
        ...plan,
        candidateSha: SHA.candidate,
        actualParents: [SHA.stg, SHA.source],
        targetBranch: "stg",
      }),
    ).toEqual({ ok: true });
    for (const invalid of [
      { actualParents: [SHA.source, SHA.stg] },
      { mergeMethod: "squash" },
      { mergeMethod: "rebase" },
      { targetBranch: "main" },
      { noFastForward: false },
    ]) {
      expect(validateCandidateMerge({ ...plan, candidateSha: SHA.candidate, actualParents: [SHA.stg, SHA.source], targetBranch: "stg", ...invalid }).ok).toBe(false);
    }
  });
});

describe("database gate", () => {
  it("requires a complete baseline and keeps automatic apply disabled", async () => {
    const { validateMigrationEvidence } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    expect(validateMigrationEvidence(null)).toMatchObject({
      ok: false,
      code: "DB_BASELINE_REQUIRED",
      autoApplyAllowed: false,
    });
    expect(validateMigrationEvidence(migrationEvidence())).toEqual({
      ok: true,
      code: "DB_GATE_PASSED_MANUAL_APPLY",
      autoApplyAllowed: false,
      manifestDigest: digest("applied-migrations"),
      evidenceDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(validateMigrationEvidence(migrationEvidence({ autoApplyEnabled: true }))).toMatchObject({
      ok: false,
      code: "DB_AUTO_APPLY_DISABLED",
      autoApplyAllowed: false,
    });
  });

  it.each([
    ["historical drift", { historicalChanges: [{ path: "old.sql", change: "modified" }] }],
    ["timestamp regression", { newMigrations: [{ path: "x.sql", timestamp: "20260721000000", sha256: digest("x") }] }],
    ["digest mismatch", { applyDigest: digest("different") }],
    ["destructive SQL", { destructiveSql: true }],
    ["grant revoke", { grantRevocation: true }],
    ["compat break", { compatibilityBreak: true }],
    ["N-1 failure", { nMinusOneTopikDevPassed: false }],
    ["N failure", { nTopikDevPassed: false }],
  ])("blocks %s without down or tracker repair", async (_label, overrides) => {
    const { validateMigrationEvidence } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    expect(validateMigrationEvidence(migrationEvidence(overrides))).toMatchObject({
      ok: false,
      code: "DB_GATE_BLOCKED",
      autoApplyAllowed: false,
      recovery: "FORWARD_FIX_ONLY",
    });
  });

  it("never accepts production credentials in evidence", async () => {
    const { validateMigrationEvidence } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    expect(validateMigrationEvidence({ ...migrationEvidence(), serviceRoleKey: "canary" })).toMatchObject({
      ok: false,
      code: "DB_GATE_BLOCKED",
    });
  });
});

describe("Vercel evidence gates", () => {
  it("requires stg Preview READY at the exact stg SHA and topik-dev scope", async () => {
    const { validateVercelPreviewEvidence } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    expect(validateVercelPreviewEvidence(previewEvidence(), SHA.candidate, {
      expectedProject: "topik-project-v13",
    }).ok).toBe(true);
    for (const evidence of [
      previewEvidence({ target: "production" }),
      previewEvidence({ commitSha: SHA.source }),
      previewEvidence({ state: "ERROR" }),
      previewEvidence({ environmentScope: "production" }),
    ]) {
      expect(validateVercelPreviewEvidence(evidence, SHA.candidate).ok).toBe(false);
    }
  });

  it("requires exact production SHA, READY target, alias/domain and read-only smoke", async () => {
    const { validateVercelProductionEvidence, validateVercelRollbackEvidence } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    expect(
      validateVercelProductionEvidence(productionEvidence(), {
        expectedMainSha: SHA.main,
        requiredProject: "topik-project-v13",
        requiredAlias: "talkpik.example.com",
        requiredDomain: "talkpik.example.com",
      }),
    ).toEqual({ ok: true, code: "PRODUCTION_READY" });
    expect(
      validateVercelProductionEvidence(productionEvidence({ commitSha: SHA.source }), {
        expectedMainSha: SHA.main,
        requiredProject: "topik-project-v13",
        requiredAlias: "talkpik.example.com",
        requiredDomain: "talkpik.example.com",
      }).ok,
    ).toBe(false);
    expect(
      validateVercelProductionEvidence(productionEvidence({ smokePassed: false }), {
        expectedMainSha: SHA.main,
        requiredProject: "topik-project-v13",
        requiredAlias: "talkpik.example.com",
        requiredDomain: "talkpik.example.com",
      }),
    ).toMatchObject({
      ok: false,
      code: "ALIAS_ROLLBACK_REQUIRED",
      rollbackDeploymentId: "dpl_previous_ready",
      databaseRollbackAllowed: false,
    });
    expect(validateVercelRollbackEvidence({
      rollbackDeploymentId: "dpl_previous_ready",
      rollbackDeploymentState: "READY",
      alias: "talkpik.example.com",
      databaseChanged: false,
    }, {
      requiredDeploymentId: "dpl_previous_ready",
      requiredAlias: "talkpik.example.com",
    })).toEqual({ ok: true, code: "ALIAS_ROLLBACK_VERIFIED" });
    expect(validateVercelRollbackEvidence({
      rollbackDeploymentId: "dpl_previous_ready",
      rollbackDeploymentState: "ERROR",
      alias: "talkpik.example.com",
      databaseChanged: false,
    }, {
      requiredDeploymentId: "dpl_previous_ready",
      requiredAlias: "talkpik.example.com",
    }).ok).toBe(false);
  });
});

describe("production approval policy and resumable state", () => {
  it("requires two successful confirmations, then switches the same contract to AUTO", async () => {
    const {
      createApprovalPolicy,
      evaluateProductionApproval,
      recordPromotionSuccess,
    } = await import("../../scripts/lib/ai-release-promotion.mjs");
    let policy = createApprovalPolicy({
      contractFingerprint: digest("contract"),
      profileFingerprint: digest("profile"),
    });

    expect(evaluateProductionApproval(policy, digest("snapshot"))).toMatchObject({
      state: "AWAITING_PROD_APPROVAL",
      mode: "CONFIRM",
      approvalFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    policy = recordPromotionSuccess(policy, {
      productionReady: true,
      exactMainSha: true,
      aliasConnected: true,
      smokePassed: true,
      cleanupStatus: "CLEANED",
    });
    expect(policy.consecutiveSuccessCount).toBe(1);
    expect(policy.mode).toBe("CONFIRM");
    policy = recordPromotionSuccess(policy, {
      productionReady: true,
      exactMainSha: true,
      aliasConnected: true,
      smokePassed: true,
      cleanupStatus: "RELEASED",
    });
    expect(policy).toMatchObject({ consecutiveSuccessCount: 2, mode: "AUTO" });
    expect(evaluateProductionApproval(policy, digest("next"))).toMatchObject({
      state: "APPROVED",
      mode: "AUTO",
      approvalFingerprint: null,
    });
  });

  it("rejects stale approval/CAS, is idempotent, and resets on contract or failure", async () => {
    const {
      applyProductionApproval,
      createApprovalPolicy,
      createPromotionRun,
      evaluateProductionApproval,
      recordPromotionSuccess,
      resetApprovalPolicy,
      transitionPromotionRun,
    } = await import("../../scripts/lib/ai-release-promotion.mjs");
    const run = createPromotionRun(runInput());
    const unchanged = transitionPromotionRun(run, {
      expectedRevision: 0,
      expectedFingerprint: run.fingerprint,
      event: { type: "PLAN_CREATED", at: run.updatedAt },
    });
    expect(unchanged).toEqual(run);
    expect(() =>
      transitionPromotionRun(run, {
        expectedRevision: 1,
        expectedFingerprint: run.fingerprint,
        event: { type: "CANDIDATE_VERIFIED", at: "2026-07-23T10:01:00.000Z", candidateSha: SHA.candidate },
      }),
    ).toThrowError("PROMOTION_REVISION_STALE");

    const policy = createApprovalPolicy({
      contractFingerprint: run.contractFingerprint,
      profileFingerprint: run.profileFingerprint,
    });
    const decision = evaluateProductionApproval(policy, run.fingerprint);
    const awaiting = {
      ...run,
      state: "AWAITING_PROD_APPROVAL",
      approval: { ...run.approval, approvalFingerprint: decision.approvalFingerprint },
    };
    expect(() =>
      applyProductionApproval(awaiting, {
        policy,
        approvalFingerprint: digest("stale"),
      }),
    ).toThrowError("PRODUCTION_APPROVAL_STALE");
    const successfulEvidence = {
      productionReady: true,
      exactMainSha: true,
      aliasConnected: true,
      smokePassed: true,
      cleanupStatus: "CLEANED",
    };
    const autoPolicy = recordPromotionSuccess(
      recordPromotionSuccess(policy, successfulEvidence),
      successfulEvidence,
    );
    expect(resetApprovalPolicy(autoPolicy, "DEPLOYMENT_FAILURE")).toMatchObject({
      mode: "CONFIRM",
      consecutiveSuccessCount: 0,
      lastResetReason: "DEPLOYMENT_FAILURE",
    });
  });

  it("binds approval policy to repositories, auth, DB workflow, and Vercel configuration", async () => {
    const { promotionProfileFingerprint } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    const first = promotionProfileFingerprint({
      vercelProject: "topik-project-v13",
      vercelDomain: "talkpik.example.com",
    });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(promotionProfileFingerprint({
      vercelProject: "topik-project-v13",
      vercelDomain: "other.example.com",
    })).not.toBe(first);
  });

  it("persists a reset policy before a failed run update", async () => {
    const { persistPromotionTransition } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    const calls = [];
    expect(() => persistPromotionTransition({
      currentRecord: { fingerprint: digest("record-before") },
      currentPolicy: { fingerprint: digest("policy-before") },
      result: {
        record: { state: "PRODUCTION_FAILED", fingerprint: digest("record-after") },
        policy: { mode: "CONFIRM", consecutiveSuccessCount: 0, fingerprint: digest("policy-after") },
      },
      writePolicy: () => calls.push("policy"),
      writeRun: () => {
        calls.push("run");
        throw new Error("injected run write failure");
      },
    })).toThrowError("injected run write failure");
    expect(calls).toEqual(["policy", "run"]);
  });

  it("cleans only after production, smoke, stg sync, and managed workspace are verified", async () => {
    const { cleanupEligibility } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    expect(cleanupEligibility({
      productionReady: true,
      exactMainSha: true,
      smokePassed: true,
      stgFastForwardedToMain: true,
      workspaceOwnership: "managed",
      candidateBranch: "chore/promote-20260723-11111111",
    })).toEqual({
      eligible: true,
      preserveBranches: ["stg", "main"],
      removableBranches: ["chore/promote-20260723-11111111"],
    });
    expect(cleanupEligibility({
      productionReady: true,
      exactMainSha: true,
      smokePassed: false,
      stgFastForwardedToMain: true,
      workspaceOwnership: "managed",
      candidateBranch: "chore/promote-20260723-11111111",
    }).eligible).toBe(false);
  });
});

describe("registry and CLI contract", () => {
  it("writes and reads an atomic registry separate from task records", async () => {
    const { createPromotionRun, readPromotionRun, writePromotionRun } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    const commonDir = tempRoot();
    const run = createPromotionRun(runInput());
    const location = writePromotionRun({ gitCommonDir: commonDir, record: run });
    expect(location).toContain(path.join("ai-pipeline", "promotions", "v1", "runs"));
    expect(readPromotionRun({ gitCommonDir: commonDir, runId: run.runId })).toEqual(run);
    expect(readFileSync(location, "utf8")).not.toContain("token");
    expect(() => writePromotionRun({ gitCommonDir: commonDir, record: run })).toThrowError(
      "PROMOTION_RUN_EXISTS",
    );
  });

  it("persists the legacy incident state but rejects the transient audit state", async () => {
    const {
      createPromotionRun,
      readPromotionRun,
      stableFingerprint,
      validatePromotionRunV1,
      writePromotionRun,
    } = await import("../../scripts/lib/ai-release-promotion.mjs");
    const commonDir = tempRoot();
    const incidentPayload = structuredClone(createPromotionRun(runInput()));
    incidentPayload.state = "SECURITY_INCIDENT_BLOCKED";
    delete incidentPayload.fingerprint;
    const incidentRecord = {
      ...incidentPayload,
      fingerprint: stableFingerprint(incidentPayload),
    };

    expect(validatePromotionRunV1(incidentRecord)).toEqual([]);
    writePromotionRun({ gitCommonDir: commonDir, record: incidentRecord });
    expect(
      readPromotionRun({ gitCommonDir: commonDir, runId: incidentRecord.runId }),
    ).toEqual(incidentRecord);

    const auditPayload = structuredClone(incidentRecord);
    auditPayload.state = "SECURITY_AUDIT_BLOCKED";
    delete auditPayload.fingerprint;
    const auditRecord = {
      ...auditPayload,
      fingerprint: stableFingerprint(auditPayload),
    };

    expect(validatePromotionRunV1(auditRecord)).toContainEqual({
      code: "INVALID_STATE",
      path: "state",
    });
    expect(() =>
      writePromotionRun({ gitCommonDir: commonDir, record: auditRecord }),
    ).toThrowError("PROMOTION_RECORD_INVALID");
  });

  it("exposes release start/status/resume and executor package scripts", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
    expect(packageJson.scripts["release:start"]).toBe("node scripts/ai-release.mjs start");
    expect(packageJson.scripts["release:status"]).toBe("node scripts/ai-release.mjs status");
    expect(packageJson.scripts["release:resume"]).toBe("node scripts/ai-release.mjs resume");
    expect(packageJson.scripts["release:exec"]).toBe("node scripts/ai-pipeline-executor.mjs");
  });

  it("splits the lifecycle contract into bounded runnable shards", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
    expect(packageJson.scripts["check:task-lifecycle"]).toBe(
      "pnpm check:task-lifecycle:v2 && pnpm check:task-lifecycle:cleanup-finalize && pnpm check:task-lifecycle:cleanup-locks && pnpm check:task-lifecycle:cleanup-mutate && pnpm check:task-lifecycle:cleanup-recovery && pnpm check:task-lifecycle:cleanup-contract && pnpm check:task-lifecycle:autocleanup-contract && pnpm check:task-lifecycle:autocleanup-remote && pnpm check:task-lifecycle:autocleanup-worker && pnpm check:task-lifecycle:autocleanup-recovery && pnpm check:task-lifecycle:metrics && pnpm check:task-lifecycle:v3 && pnpm check:task-lifecycle:sweep && pnpm check:task-lifecycle:release && pnpm check:task-lifecycle:baseline-audit && pnpm check:task-lifecycle:executor && pnpm check:task-lifecycle:security && pnpm check:task-lifecycle:validation",
    );
    const shardNames = [
      "check:task-lifecycle:v2",
      "check:task-lifecycle:cleanup-finalize",
      "check:task-lifecycle:cleanup-locks",
      "check:task-lifecycle:cleanup-mutate",
      "check:task-lifecycle:cleanup-recovery",
      "check:task-lifecycle:cleanup-contract",
      "check:task-lifecycle:autocleanup-contract",
      "check:task-lifecycle:autocleanup-remote",
      "check:task-lifecycle:autocleanup-worker",
      "check:task-lifecycle:autocleanup-recovery",
      "check:task-lifecycle:metrics",
      "check:task-lifecycle:v3",
      "check:task-lifecycle:sweep",
      "check:task-lifecycle:release",
      "check:task-lifecycle:baseline-audit",
      "check:task-lifecycle:executor",
      "check:task-lifecycle:security",
      "check:task-lifecycle:validation",
    ];
    for (const shardName of shardNames) {
      expect(packageJson.scripts[shardName]).toMatch(/^vitest run .+ --maxWorkers=2$/u);
    }
    const coveredTests = shardNames.flatMap((shardName) =>
      packageJson.scripts[shardName].match(/tests\/scripts\/\S+\.test\.mjs/gu) ?? []);
    expect(new Set(coveredTests)).toEqual(new Set([
      "tests/scripts/ai-task-lifecycle-v2.test.mjs",
      "tests/scripts/ai-task-cleanup.test.mjs",
      "tests/scripts/ai-task-autocleanup.test.mjs",
      "tests/scripts/ai-task-metrics.test.mjs",
      "tests/scripts/ai-task-measure-cli.test.mjs",
      "tests/scripts/ai-task-lifecycle-v3.test.mjs",
      "tests/scripts/ai-task-lifecycle-v3-autocleanup.test.mjs",
      "tests/scripts/ai-task-v3-adapter.test.mjs",
      "tests/scripts/ai-task-sweep.test.mjs",
      "tests/scripts/ai-release-promotion.test.mjs",
      "tests/scripts/ai-release-baseline-audit.test.mjs",
      "tests/scripts/ai-release-executor.test.mjs",
      "tests/scripts/ai-release-git.test.mjs",
      "tests/scripts/ai-release-vercel.test.mjs",
      "tests/scripts/ai-pipeline-executor-cli.test.mjs",
      "tests/scripts/security-artifact-audit.test.mjs",
      "tests/scripts/ai-validation-evidence.test.mjs",
    ]));
  });

  it("release-start security boundary blocks audit schema errors without resetting approval", async () => {
    const { enforceReleaseSecurityResult } =
      await import("../../scripts/ai-release.mjs");
    const readPolicy = vi.fn(() => ({ fingerprint: digest("policy") }));
    const resetPolicy = vi.fn(() => ({ fingerprint: digest("reset") }));
    const writePolicy = vi.fn();
    const dependencies = { readPolicy, resetPolicy, writePolicy };

    expect(() => enforceReleaseSecurityResult({
      security: { ok: false, code: "SECURITY_AUDIT_SCHEMA_INVALID" },
      commonDir: tempRoot(),
      dependencies,
    })).toThrowError("SECURITY_AUDIT_SCHEMA_INVALID");
    expect(readPolicy).not.toHaveBeenCalled();
    expect(resetPolicy).not.toHaveBeenCalled();
    expect(writePolicy).not.toHaveBeenCalled();
  });

  it("release-start security boundary blocks artifact findings without resetting approval", async () => {
    const { enforceReleaseSecurityResult } =
      await import("../../scripts/ai-release.mjs");
    const readPolicy = vi.fn(() => ({ fingerprint: digest("policy") }));
    const resetPolicy = vi.fn(() => ({ fingerprint: digest("reset") }));
    const writePolicy = vi.fn();
    const dependencies = { readPolicy, resetPolicy, writePolicy };

    expect(() => enforceReleaseSecurityResult({
      security: { ok: false, code: "SECURITY_ARTIFACT_FINDINGS_BLOCKED" },
      commonDir: tempRoot(),
      dependencies,
    })).toThrowError("SECURITY_ARTIFACT_FINDINGS_BLOCKED");
    expect(readPolicy).not.toHaveBeenCalled();
    expect(resetPolicy).not.toHaveBeenCalled();
    expect(writePolicy).not.toHaveBeenCalled();
  });

  it("release-start security boundary resets approval for an explicit actual security incident", async () => {
    const { enforceReleaseSecurityResult } =
      await import("../../scripts/ai-release.mjs");
    const commonDir = tempRoot();
    const existingPolicy = { fingerprint: digest("policy") };
    const resetResult = { fingerprint: digest("reset") };
    const readPolicy = vi.fn(() => existingPolicy);
    const resetPolicy = vi.fn(() => resetResult);
    const writePolicy = vi.fn();
    const dependencies = { readPolicy, resetPolicy, writePolicy };

    expect(() => enforceReleaseSecurityResult({
      security: { ok: false, code: "SECURITY_INCIDENT_BLOCKED" },
      commonDir,
      dependencies,
    })).toThrowError("SECURITY_INCIDENT_BLOCKED");
    expect(readPolicy).toHaveBeenCalledOnce();
    expect(resetPolicy).toHaveBeenCalledWith(existingPolicy, "SECURITY_INCIDENT");
    expect(writePolicy).toHaveBeenCalledOnce();
    expect(writePolicy).toHaveBeenCalledWith({
      gitCommonDir: commonDir,
      policy: resetResult,
      expectedFingerprint: existingPolicy.fingerprint,
    });
  });

  it("keeps the documented release examples aligned with the public CLI", async () => {
    const { parseReleaseArguments } = await import("../../scripts/ai-release.mjs");
    const operations = readFileSync(
      path.resolve("docs/operations/ai-development-pipeline.md"),
      "utf8",
    );

    expect(operations).not.toContain("--production-domain");
    for (const flag of [
      "--run-id",
      "--vercel-project",
      "--vercel-domain",
    ]) {
      expect(operations).toContain(flag);
    }
    expect(() => parseReleaseArguments([
      "start",
      "--repo", "C:\\repo",
      "--run-id", "promotion-20260723-11111111",
      "--vercel-project", "topik-project-v13",
      "--vercel-domain", "example.com",
    ])).not.toThrow();
    expect(() => parseReleaseArguments([
      "resume",
      "--repo", "C:\\repo",
      "--run-id", "promotion-20260723-11111111",
      "--expected-revision", "0",
      "--expected-fingerprint", digest("record"),
      "--event", "PROD_APPROVAL_GRANTED",
      "--event-at", "2026-07-23T10:00:00.000Z",
      "--approval", digest("approval"),
    ])).not.toThrow();
  });

  it("skips exactly one leading -- separator and rejects any other stray --", async () => {
    const { parseReleaseArguments } = await import("../../scripts/ai-release.mjs");
    const tail = [
      "start",
      "--repo", "C:\\repo",
      "--run-id", "promotion-20260723-11111111",
      "--vercel-project", "topik-project-v13",
      "--vercel-domain", "example.com",
    ];

    expect(parseReleaseArguments(["--", ...tail])).toEqual(parseReleaseArguments(tail));
    expect(() => parseReleaseArguments(["--", "--", ...tail])).toThrowError(
      "INVALID_RELEASE_ARGUMENTS",
    );
    expect(() =>
      parseReleaseArguments([
        "start",
        "--repo", "C:\\repo",
        "--",
        "--run-id", "promotion-20260723-11111111",
        "--vercel-project", "topik-project-v13",
        "--vercel-domain", "example.com",
      ]),
    ).toThrowError("INVALID_RELEASE_ARGUMENTS");
    expect(() => parseReleaseArguments(["--"])).toThrowError("RELEASE_COMMAND_REQUIRED");
  });

  it("derives start evidence from fixed refs and rejects caller-authored transition evidence", async () => {
    const {
      assertPublicReleaseResumeEvent,
      collectReleaseStartEvidence,
      parseReleaseArguments,
    } = await import("../../scripts/ai-release.mjs");
    const repository = tempRoot();
    const audit = securityAudit({
      refs: ["collab/main", "origin/main"],
      snapshots: [
        { ref: "collab/main", commitHash: digest(SHA.stg) },
        { ref: "origin/main", commitHash: digest(SHA.source) },
      ],
      summary: { refCount: 2, scannedPathCount: 16, findingCount: 0 },
    });
    const commands = [];
    const startEvidence = collectReleaseStartEvidence({
      repoPath: repository,
      stgReady: false,
      commandRunner(command, args, options) {
        commands.push({ command, args, options });
        const key = args.join(" ");
        const stdout = new Map([
          ["remote get-url origin", "https://github.com/blackstarzck/topik-project-v13.git\n"],
          ["remote get-url collab", "https://github.com/keduall/topik-project-v13.git\n"],
          ["rev-parse --verify origin/main^{commit}", `${SHA.source}\n`],
          ["rev-parse --verify origin/main^{tree}", `${SHA.tree}\n`],
          ["rev-parse --verify collab/main^{commit}", `${SHA.stg}\n`],
        ]).get(key);
        return stdout === undefined
          ? { status: 1, stdout: "", stderr: "" }
          : { status: 0, stdout, stderr: "" };
      },
      audit: vi.fn(() => audit),
    });
    expect(startEvidence).toMatchObject({
      sourceSha: SHA.source,
      sourceTreeHash: SHA.tree,
      stgBaseSha: SHA.stg,
      expectedSecurityRefs: ["collab/main", "origin/main"],
    });
    expect(commands.every(({ options }) => options.shell === false)).toBe(true);
    expect(() => parseReleaseArguments([
      "start",
      "--repo", repository,
      "--run-id", "promotion-20260723-11111111",
      "--source-sha", SHA.source,
      "--vercel-project", "topik-project-v13",
      "--vercel-domain", "example.com",
    ])).toThrowError("INVALID_RELEASE_ARGUMENTS");
    expect(() => assertPublicReleaseResumeEvent({
      event: "CANDIDATE_VERIFIED",
      evidence: path.join(repository, "caller.json"),
    })).toThrowError("RELEASE_TRUSTED_EXECUTOR_REQUIRED");
    expect(() => assertPublicReleaseResumeEvent({
      event: "PROD_APPROVAL_GRANTED",
      approval: digest("approval"),
    })).not.toThrow();
  });
});

describe("fail-closed promotion state machine", () => {
  it("blocks skipping, reverse transitions, and fabricated production approval", async () => {
    const {
      advancePromotionRun,
      createApprovalPolicy,
      createPromotionRun,
    } = await import("../../scripts/lib/ai-release-promotion.mjs");
    const run = createPromotionRun(runInput());
    const policy = createApprovalPolicy({
      contractFingerprint: run.contractFingerprint,
      profileFingerprint: run.profileFingerprint,
    });
    for (const event of [
      { type: "PRODUCTION_EVALUATED", at: "2026-07-23T10:01:00.000Z", evidence: productionEvidence() },
      { type: "PROD_APPROVAL_GRANTED", at: "2026-07-23T10:01:00.000Z", approvalFingerprint: digest("fake") },
      { type: "CLEANUP_VERIFIED", at: "2026-07-23T10:01:00.000Z", stgFastForwardedToMain: true },
    ]) {
      expect(() => advancePromotionRun(run, {
        expectedRevision: run.revision,
        expectedFingerprint: run.fingerprint,
        policy,
        event,
      })).toThrowError("PROMOTION_TRANSITION_NOT_ALLOWED");
    }
  });

  it("rejects an approval policy bound to a different Vercel/repository profile", async () => {
    const { advancePromotionRun, createApprovalPolicy, createPromotionRun } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    const run = createPromotionRun(runInput());
    const wrongPolicy = createApprovalPolicy({
      contractFingerprint: run.contractFingerprint,
      profileFingerprint: digest("different-profile"),
    });
    expect(() => advancePromotionRun(run, {
      expectedRevision: run.revision,
      expectedFingerprint: run.fingerprint,
      policy: wrongPolicy,
      event: {
        type: "CANDIDATE_VERIFIED",
        at: "2026-07-23T10:01:00.000Z",
        candidateSha: SHA.candidate,
      },
    })).toThrowError("APPROVAL_POLICY_PROFILE_MISMATCH");
  });

  it("requires exact candidate lineage and rejects direct main promotion", async () => {
    const {
      advancePromotionRun,
      createApprovalPolicy,
      createPromotionRun,
    } = await import("../../scripts/lib/ai-release-promotion.mjs");
    const run = createPromotionRun(runInput());
    const policy = createApprovalPolicy({
      contractFingerprint: run.contractFingerprint,
      profileFingerprint: run.profileFingerprint,
    });
    const baseEvent = {
      type: "CANDIDATE_VERIFIED",
      at: "2026-07-23T10:01:00.000Z",
      candidateSha: SHA.candidate,
      branch: run.target.candidateBranch,
      baseSha: SHA.stg,
      sourceSha: SHA.source,
      actualParents: [SHA.stg, SHA.source],
      mergeMethod: "merge",
      noFastForward: true,
      targetBranch: "stg",
      directMainPush: false,
    };
    for (const event of [
      { ...baseEvent, actualParents: [SHA.source, SHA.stg] },
      { ...baseEvent, mergeMethod: "squash" },
      { ...baseEvent, directMainPush: true },
      { ...baseEvent, targetBranch: "main" },
    ]) {
      expect(() => advancePromotionRun(run, {
        expectedRevision: 0,
        expectedFingerprint: run.fingerprint,
        policy,
        event,
      })).toThrowError("CANDIDATE_LINEAGE_INVALID");
    }
  });

  it("runs the gated happy path and increments approval only after cleanup", async () => {
    const {
      advancePromotionRun,
      createApprovalPolicy,
      createPromotionRun,
    } = await import("../../scripts/lib/ai-release-promotion.mjs");
    let record = createPromotionRun(runInput());
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

    advance({
      type: "CANDIDATE_VERIFIED",
      at: "2026-07-23T10:01:00.000Z",
      candidateSha: SHA.candidate,
      branch: record.target.candidateBranch,
      baseSha: SHA.stg,
      sourceSha: SHA.source,
      actualParents: [SHA.stg, SHA.source],
      mergeMethod: "merge",
      noFastForward: true,
      targetBranch: "stg",
      directMainPush: false,
    });
    advance({
      type: "STG_PR_OPEN",
      at: "2026-07-23T10:02:00.000Z",
      targetBranch: "stg",
      headBranch: record.target.candidateBranch,
      headSha: SHA.candidate,
    });
    advance({
      type: "STG_READY",
      at: "2026-07-23T10:03:00.000Z",
      stgSha: SHA.stgMerged,
      mergeMethod: "merge",
      actualParents: [SHA.stg, SHA.candidate],
      directMainPush: false,
      previewEvidence: previewEvidence({ commitSha: SHA.stgMerged }),
    });
    advance({
      type: "DB_GATE_EVALUATED",
      at: "2026-07-23T10:04:00.000Z",
      migrationEvidence: migrationEvidence(),
    });
    expect(record.state).toBe("AWAITING_PROD_APPROVAL");
    expect(policy.consecutiveSuccessCount).toBe(0);
    const approvalFingerprint = record.approval.approvalFingerprint;
    advance({
      type: "PROD_APPROVAL_GRANTED",
      at: "2026-07-23T10:05:00.000Z",
      approvalFingerprint,
    });
    advance({
      type: "MAIN_PR_OPEN",
      at: "2026-07-23T10:06:00.000Z",
      targetBranch: "main",
      headBranch: "stg",
      headSha: SHA.stgMerged,
      mergeMethod: "merge",
      directMainPush: false,
    });
    advance({
      type: "MAIN_MERGE_VERIFIED",
      at: "2026-07-23T10:07:00.000Z",
      mainBaseSha: SHA.previous,
      mainSha: SHA.main,
      actualParents: [SHA.previous, SHA.stgMerged],
      headSha: SHA.stgMerged,
      targetBranch: "main",
      mergeMethod: "merge",
      directMainPush: false,
    });
    advance({
      type: "PRODUCTION_EVALUATED",
      at: "2026-07-23T10:08:00.000Z",
      evidence: productionEvidence(),
    });
    expect(record.state).toBe("RELEASED");
    expect(policy.consecutiveSuccessCount).toBe(0);
    advance({
      type: "CLEANUP_VERIFIED",
      at: "2026-07-23T10:09:00.000Z",
      stgFastForwardedToMain: true,
    });
    expect(record.state).toBe("CLEANED");
    expect(policy).toMatchObject({ consecutiveSuccessCount: 1, mode: "CONFIRM" });
  });

  it("rejects a stg merge without exact ordered parents or with direct push", async () => {
    const { advancePromotionRun, createApprovalPolicy, createPromotionRun } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    let record = createPromotionRun(runInput());
    const policy = createApprovalPolicy({
      contractFingerprint: record.contractFingerprint,
      profileFingerprint: record.profileFingerprint,
    });
    record = advancePromotionRun(record, {
      expectedRevision: 0,
      expectedFingerprint: record.fingerprint,
      policy,
      event: {
        type: "CANDIDATE_VERIFIED",
        at: "2026-07-23T10:01:00.000Z",
        candidateSha: SHA.candidate,
        branch: record.target.candidateBranch,
        baseSha: SHA.stg,
        sourceSha: SHA.source,
        actualParents: [SHA.stg, SHA.source],
        mergeMethod: "merge",
        noFastForward: true,
        targetBranch: "stg",
        directMainPush: false,
      },
    }).record;
    record = advancePromotionRun(record, {
      expectedRevision: record.revision,
      expectedFingerprint: record.fingerprint,
      policy,
      event: {
        type: "STG_PR_OPEN",
        at: "2026-07-23T10:02:00.000Z",
        targetBranch: "stg",
        headBranch: record.target.candidateBranch,
        headSha: SHA.candidate,
      },
    }).record;
    for (const event of [
      {
        type: "STG_READY",
        at: "2026-07-23T10:03:00.000Z",
        stgSha: SHA.stgMerged,
        mergeMethod: "merge",
        actualParents: [SHA.candidate, SHA.stg],
        directMainPush: false,
        previewEvidence: previewEvidence({ commitSha: SHA.stgMerged }),
      },
      {
        type: "STG_READY",
        at: "2026-07-23T10:03:00.000Z",
        stgSha: SHA.stgMerged,
        mergeMethod: "merge",
        actualParents: [SHA.stg, SHA.candidate],
        directMainPush: true,
        previewEvidence: previewEvidence({ commitSha: SHA.stgMerged }),
      },
    ]) {
      expect(() => advancePromotionRun(record, {
        expectedRevision: record.revision,
        expectedFingerprint: record.fingerprint,
        policy,
        event,
      })).toThrowError("STG_READY_EVIDENCE_INVALID");
    }
  });
});

// Vercel populates `target` only for production deployments. Git-connected preview
// builds come back with target=null, measured on this project: every stg and
// feature-branch deployment reported null while every main deployment reported
// "production". Requiring the literal "preview" therefore blocked a healthy stg
// Preview from ever satisfying the gate. Accepting null keeps the protection
// because "production" is still rejected and branch must still be stg.
describe("Vercel preview evidence with an unset target", () => {
  it("accepts a null target when the branch still proves it is the stg preview", async () => {
    const { validateVercelPreviewEvidence } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    expect(validateVercelPreviewEvidence(previewEvidence({ target: null }), SHA.candidate, {
      expectedProject: "topik-project-v13",
    })).toMatchObject({ ok: true, code: "STG_PREVIEW_READY" });
  });

  it("still rejects a production deployment and a non-stg branch", async () => {
    const { validateVercelPreviewEvidence } =
      await import("../../scripts/lib/ai-release-promotion.mjs");
    for (const evidence of [
      previewEvidence({ target: "production" }),
      previewEvidence({ target: null, branch: "main" }),
      previewEvidence({ target: undefined }),
      previewEvidence({ target: "" }),
    ]) {
      expect(validateVercelPreviewEvidence(evidence, SHA.candidate).ok).toBe(false);
    }
  });
});
