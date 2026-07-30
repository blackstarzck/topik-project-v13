import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const temporaryRoots = [];

function temporaryRoot() {
  const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), "ai-release-executor-")));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

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

async function promotion() {
  return import("../../scripts/lib/ai-release-promotion.mjs");
}

async function executor() {
  return import("../../scripts/lib/ai-release-executor.mjs");
}

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

async function plannedRun() {
  const { createApprovalPolicy, createPromotionRun } = await promotion();
  const record = createPromotionRun(runInput());
  const policy = createApprovalPolicy({
    contractFingerprint: record.contractFingerprint,
    profileFingerprint: record.profileFingerprint,
  });
  return { record, policy };
}

async function refingerprint(record) {
  const { stableFingerprint } = await promotion();
  const payload = structuredClone(record);
  delete payload.fingerprint;
  return { ...record, fingerprint: stableFingerprint(payload) };
}

function candidateObserved() {
  return {
    candidateSha: SHA.candidate,
    candidateBranch: "chore/promote-20260723-11111111",
    baseSha: SHA.stg,
    sourceSha: SHA.source,
    parents: [SHA.stg, SHA.source],
    mergeMethod: "merge",
    noFastForward: true,
    targetBranch: "stg",
    directMainPush: false,
  };
}

function previewObserved() {
  return {
    stgSha: SHA.stgMerged,
    parents: [SHA.stg, SHA.candidate],
    mergeMethod: "merge",
    directMainPush: false,
    preview: {
      deploymentId: "dpl_preview_001",
      commitSha: SHA.stgMerged,
      project: "topik-project-v13",
      state: "READY",
      target: "preview",
      branch: "stg",
      environmentScope: "topik-dev",
    },
  };
}

function productionObserved(overrides = {}) {
  return {
    deployment: {
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
    },
  };
}

async function runAtState(target) {
  const { advancePromotionRun } = await promotion();
  const {
    buildCandidateVerifiedEvent,
    buildDbGateEvaluatedEvent,
    buildMainMergeVerifiedEvent,
    buildMainPrOpenEvent,
    buildProductionEvaluatedEvent,
    buildStgPrOpenEvent,
    buildStgReadyEvent,
  } = await executor();
  let { record, policy } = await plannedRun();
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

  if (target === "PLANNED") return record;
  advance(
    buildCandidateVerifiedEvent({
      at: "2026-07-23T10:01:00.000Z",
      record,
      observed: candidateObserved(),
    }),
  );
  if (target === "CANDIDATE_VERIFIED") return record;
  advance(
    buildStgPrOpenEvent({
      at: "2026-07-23T10:02:00.000Z",
      record,
      observed: {
        targetBranch: "stg",
        headBranch: record.target.candidateBranch,
        headSha: SHA.candidate,
      },
    }),
  );
  if (target === "STG_PR_OPEN") return record;
  advance(
    buildStgReadyEvent({
      at: "2026-07-23T10:03:00.000Z",
      record,
      observed: previewObserved(),
    }),
  );
  if (target === "STG_READY") return record;
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
      observed: {
        targetBranch: "main",
        headBranch: "stg",
        headSha: record.target.stgSha,
        mergeMethod: "merge",
        directMainPush: false,
      },
    }),
  );
  advance(
    buildMainMergeVerifiedEvent({
      at: "2026-07-23T10:07:00.000Z",
      record,
      observed: {
        mainBaseSha: SHA.previous,
        mainSha: SHA.main,
        headSha: record.target.stgSha,
        parents: [SHA.previous, record.target.stgSha],
        targetBranch: "main",
        mergeMethod: "merge",
        directMainPush: false,
      },
    }),
  );
  if (target === "PRODUCTION_VERIFYING") return record;
  advance(
    buildProductionEvaluatedEvent({
      at: "2026-07-23T10:08:00.000Z",
      record,
      observed: productionObserved(),
    }),
  );
  if (target === "RELEASED") return record;
  throw new Error(`unsupported target state ${target}`);
}

async function walkToCleaned() {
  const { advancePromotionRun } = await promotion();
  const {
    buildCandidateVerifiedEvent,
    buildCleanupVerifiedEvent,
    buildDbGateEvaluatedEvent,
    buildMainMergeVerifiedEvent,
    buildMainPrOpenEvent,
    buildProductionEvaluatedEvent,
    buildStgPrOpenEvent,
    buildStgReadyEvent,
    planNextStep,
  } = await executor();
  let { record, policy } = await plannedRun();
  const states = [record.state];
  const steps = [];

  const advance = (event) => {
    const result = advancePromotionRun(record, {
      expectedRevision: record.revision,
      expectedFingerprint: record.fingerprint,
      policy,
      event,
    });
    record = result.record;
    policy = result.policy;
    states.push(record.state);
  };

  const nextStep = () => {
    const plan = planNextStep(record);
    steps.push(plan.step);
    return plan;
  };

  nextStep();
  advance(
    buildCandidateVerifiedEvent({
      at: "2026-07-23T10:01:00.000Z",
      record,
      observed: candidateObserved(),
    }),
  );
  nextStep();
  advance(
    buildStgPrOpenEvent({
      at: "2026-07-23T10:02:00.000Z",
      record,
      observed: {
        targetBranch: "stg",
        headBranch: record.target.candidateBranch,
        headSha: SHA.candidate,
      },
    }),
  );
  nextStep();
  advance(
    buildStgReadyEvent({
      at: "2026-07-23T10:03:00.000Z",
      record,
      observed: previewObserved(),
    }),
  );
  expect(nextStep().requiresDbEvidence).toBe(true);
  advance(
    buildDbGateEvaluatedEvent({
      at: "2026-07-23T10:04:00.000Z",
      record,
      observed: { migrationEvidence: migrationEvidence() },
    }),
  );
  const awaiting = nextStep();
  expect(record.state).toBe("AWAITING_PROD_APPROVAL");
  expect(awaiting).toMatchObject({
    requiresHumanApproval: true,
    event: null,
    accountProfile: null,
  });
  advance({
    type: "PROD_APPROVAL_GRANTED",
    at: "2026-07-23T10:05:00.000Z",
    approvalFingerprint: record.approval.approvalFingerprint,
  });
  nextStep();
  advance(
    buildMainPrOpenEvent({
      at: "2026-07-23T10:06:00.000Z",
      record,
      observed: {
        targetBranch: "main",
        headBranch: "stg",
        headSha: record.target.stgSha,
        mergeMethod: "merge",
        directMainPush: false,
      },
    }),
  );
  nextStep();
  advance(
    buildMainMergeVerifiedEvent({
      at: "2026-07-23T10:07:00.000Z",
      record,
      observed: {
        mainBaseSha: SHA.previous,
        mainSha: SHA.main,
        headSha: record.target.stgSha,
        parents: [SHA.previous, record.target.stgSha],
        targetBranch: "main",
        mergeMethod: "merge",
        directMainPush: false,
      },
    }),
  );
  nextStep();
  advance(
    buildProductionEvaluatedEvent({
      at: "2026-07-23T10:08:00.000Z",
      record,
      observed: productionObserved(),
    }),
  );
  nextStep();
  advance(
    buildCleanupVerifiedEvent({
      at: "2026-07-23T10:09:00.000Z",
      record,
      observed: { stgFastForwardedToMain: true },
    }),
  );
  return { record, policy, states, steps };
}

describe("promotion executor step planner", () => {
  it("plans exactly one next step for every promotion state", async () => {
    const { PROMOTION_STATES } = await promotion();
    const { planNextStep } = await executor();

    expect(PROMOTION_STATES.length).toBeGreaterThan(0);
    for (const state of PROMOTION_STATES) {
      const plan = planNextStep({ state });
      expect(Object.keys(plan).sort()).toEqual([
        "accountProfile",
        "event",
        "reason",
        "requiresDbEvidence",
        "requiresHumanApproval",
        "step",
        "terminal",
      ]);
      expect(typeof plan.reason).toBe("string");
      if (plan.terminal) {
        expect(plan.step).toBeNull();
        expect(plan.event).toBeNull();
        continue;
      }
      expect(plan.step).toEqual(expect.any(String));
      if (plan.requiresHumanApproval) expect(plan.event).toBeNull();
      else expect(plan.event).toEqual(expect.any(String));
    }
  });

  it("maps each state to the documented step and event", async () => {
    const { planNextStep } = await executor();
    const mapping = [
      ["PLANNED", "CREATE_CANDIDATE", "CANDIDATE_VERIFIED"],
      ["CANDIDATE_VERIFIED", "OPEN_STG_PR", "STG_PR_OPEN"],
      ["STG_PR_OPEN", "MERGE_STG_PR", "STG_READY"],
      ["STG_READY", "EVALUATE_DB_GATE", "DB_GATE_EVALUATED"],
      ["DB_BASELINE_REQUIRED", "EVALUATE_DB_GATE", "DB_GATE_EVALUATED"],
      ["DB_GATE_BLOCKED", "EVALUATE_DB_GATE", "DB_GATE_EVALUATED"],
      ["PROD_APPROVED", "OPEN_MAIN_PR", "MAIN_PR_OPEN"],
      ["MAIN_PR_OPEN", "MERGE_MAIN_PR", "MAIN_MERGE_VERIFIED"],
      ["PRODUCTION_VERIFYING", "VERIFY_PRODUCTION", "PRODUCTION_EVALUATED"],
      ["ALIAS_ROLLBACK_REQUIRED", "ROLLBACK_ALIAS", "ALIAS_ROLLBACK_VERIFIED"],
      ["RELEASED", "CLEANUP_PROMOTION", "CLEANUP_VERIFIED"],
    ];
    for (const [state, step, event] of mapping) {
      expect(planNextStep({ state })).toMatchObject({ step, event, terminal: false });
    }
    for (const state of ["DB_BASELINE_REQUIRED", "DB_GATE_BLOCKED", "STG_READY"]) {
      expect(planNextStep({ state }).requiresDbEvidence).toBe(true);
    }
    for (const state of [
      "CLEANED",
      "PRESERVED",
      "PRODUCTION_FAILED",
      "SECURITY_INCIDENT_BLOCKED",
    ]) {
      expect(planNextStep({ state })).toMatchObject({ terminal: true, step: null, event: null });
    }
    expect(planNextStep({ state: "BOOTSTRAP_REQUIRED" })).toMatchObject({
      terminal: true,
      reason: "EXECUTOR_BOOTSTRAP_NEW_RUN_REQUIRED",
    });
    expect(() => planNextStep({ state: "NOT_A_STATE" })).toThrowError("EXECUTOR_STATE_UNKNOWN");
  });
});

describe("promotion executor account matrix", () => {
  it("splits every step into sub-tasks with the confirmed account per sub-task", async () => {
    const { accountForStep, EXECUTOR_ACCOUNT_MATRIX } = await executor();

    expect(
      Object.fromEntries(
        Object.entries(EXECUTOR_ACCOUNT_MATRIX).map(([step, entry]) => [
          step,
          entry.operations.map((operation) => [operation.operation, operation.account]),
        ]),
      ),
    ).toEqual({
      CREATE_CANDIDATE: [
        ["create", "blackstarzck"],
        ["push", "blackstarzck"],
      ],
      OPEN_STG_PR: [["create", "blackstarzck"]],
      MERGE_STG_PR: [
        ["merge", "guestkeduall-design"],
        ["verify", null],
      ],
      EVALUATE_DB_GATE: [["verify", null]],
      OPEN_MAIN_PR: [["create", "blackstarzck"]],
      MERGE_MAIN_PR: [
        ["merge", "guestkeduall-design"],
        ["verify", null],
      ],
      VERIFY_PRODUCTION: [["verify", null]],
      ROLLBACK_ALIAS: [["rollback", null]],
      CLEANUP_PROMOTION: [["cleanup", "guestkeduall-design"]],
    });
    expect(accountForStep("CREATE_CANDIDATE").accounts).toEqual(["blackstarzck"]);
    expect(accountForStep("MERGE_STG_PR").accounts).toEqual(["guestkeduall-design"]);
    expect(accountForStep("EVALUATE_DB_GATE").accounts).toEqual([]);
    expect(accountForStep("VERIFY_PRODUCTION").accounts).toEqual([]);
    expect(accountForStep("ROLLBACK_ALIAS").accounts).toEqual([]);
    expect(() => accountForStep("AWAIT_PROD_APPROVAL")).toThrowError("EXECUTOR_STEP_UNKNOWN");
    expect(Object.isFrozen(EXECUTOR_ACCOUNT_MATRIX)).toBe(true);
    expect(Object.isFrozen(accountForStep("CREATE_CANDIDATE").operations)).toBe(true);
  });
});

describe("promotion executor event assembly", () => {
  it("walks the real state machine from PLANNED to CLEANED with assembled events", async () => {
    const { record, policy, states, steps } = await walkToCleaned();

    expect(states).toEqual([
      "PLANNED",
      "CANDIDATE_VERIFIED",
      "STG_PR_OPEN",
      "STG_READY",
      "AWAITING_PROD_APPROVAL",
      "PROD_APPROVED",
      "MAIN_PR_OPEN",
      "PRODUCTION_VERIFYING",
      "RELEASED",
      "CLEANED",
    ]);
    expect(steps).toEqual([
      "CREATE_CANDIDATE",
      "OPEN_STG_PR",
      "MERGE_STG_PR",
      "EVALUATE_DB_GATE",
      "AWAIT_PROD_APPROVAL",
      "OPEN_MAIN_PR",
      "MERGE_MAIN_PR",
      "VERIFY_PRODUCTION",
      "CLEANUP_PROMOTION",
    ]);
    expect(record.state).toBe("CLEANED");
    expect(record.workspace.cleanupStatus).toBe("CLEANED");
    expect(record.migration.autoApplyEnabled).toBe(false);
    expect(policy).toMatchObject({ consecutiveSuccessCount: 1, mode: "CONFIRM" });
  });

  it("assembles a rollback event the real state machine accepts", async () => {
    const { advancePromotionRun } = await promotion();
    const { buildAliasRollbackVerifiedEvent } = await executor();
    const { record, policy } = await plannedRun();
    const rollbackRecord = await refingerprint({
      ...record,
      state: "ALIAS_ROLLBACK_REQUIRED",
      target: { ...record.target, stgSha: SHA.stgMerged, mainSha: SHA.main },
      vercel: {
        ...record.vercel,
        rollbackDeploymentId: "dpl_previous_ready",
        smokeStatus: "FAILED",
      },
    });
    const event = buildAliasRollbackVerifiedEvent({
      at: "2026-07-23T11:00:00.000Z",
      record: rollbackRecord,
      observed: {
        rollback: {
          rollbackDeploymentId: "dpl_previous_ready",
          rollbackDeploymentState: "READY",
          alias: "talkpik.example.com",
          databaseChanged: false,
        },
      },
    });
    const result = advancePromotionRun(rollbackRecord, {
      expectedRevision: rollbackRecord.revision,
      expectedFingerprint: rollbackRecord.fingerprint,
      policy,
      event,
    });
    expect(result.record.state).toBe("PRESERVED");
    expect(result.policy.lastResetReason).toBe("ROLLBACK");
  });

  it("refuses observations that contradict the record before submitting them", async () => {
    const {
      buildAliasRollbackVerifiedEvent,
      buildCandidateVerifiedEvent,
      buildCleanupVerifiedEvent,
      buildDbGateEvaluatedEvent,
      buildMainMergeVerifiedEvent,
      buildProductionEvaluatedEvent,
      buildStgReadyEvent,
    } = await executor();
    const { record } = await plannedRun();
    const at = "2026-07-23T10:01:00.000Z";

    expect(() =>
      buildCandidateVerifiedEvent({
        at,
        record,
        observed: { ...candidateObserved(), parents: [SHA.source, SHA.stg] },
      }),
    ).toThrowError("EXECUTOR_LINEAGE_MISMATCH");
    expect(() =>
      buildCandidateVerifiedEvent({
        at,
        record,
        observed: { ...candidateObserved(), mergeMethod: "squash" },
      }),
    ).toThrowError("EXECUTOR_MERGE_METHOD_FORBIDDEN");
    expect(() =>
      buildCandidateVerifiedEvent({
        at,
        record,
        observed: { ...candidateObserved(), noFastForward: false },
      }),
    ).toThrowError("EXECUTOR_MERGE_METHOD_FORBIDDEN");
    expect(() =>
      buildCandidateVerifiedEvent({
        at,
        record,
        observed: { ...candidateObserved(), directMainPush: true },
      }),
    ).toThrowError("EXECUTOR_DIRECT_MAIN_PUSH_FORBIDDEN");
    expect(() =>
      buildCandidateVerifiedEvent({
        at,
        record,
        observed: { ...candidateObserved(), targetBranch: "main" },
      }),
    ).toThrowError("EXECUTOR_TARGET_BRANCH_MISMATCH");
    expect(() =>
      buildCandidateVerifiedEvent({
        at,
        record,
        observed: { ...candidateObserved(), candidateBranch: "chore/promote-20260723-22222222" },
      }),
    ).toThrowError("EXECUTOR_CANDIDATE_BRANCH_MISMATCH");
    expect(() =>
      buildCandidateVerifiedEvent({ at: "not-a-timestamp", record, observed: candidateObserved() }),
    ).toThrowError("EXECUTOR_TIMESTAMP_INVALID");
    expect(() =>
      buildStgReadyEvent({ at, record, observed: previewObserved() }),
    ).toThrowError("EXECUTOR_STATE_MISMATCH");
    expect(() =>
      buildDbGateEvaluatedEvent({
        at,
        record: { ...record, state: "STG_READY" },
        observed: { migrationEvidence: migrationEvidence({ autoApplyEnabled: true }) },
      }),
    ).toThrowError("EXECUTOR_DB_AUTO_APPLY_FORBIDDEN");
    expect(() =>
      buildDbGateEvaluatedEvent({
        at,
        record: { ...record, state: "STG_READY" },
        observed: { migrationEvidence: { ...migrationEvidence(), serviceRoleKey: "canary" } },
      }),
    ).toThrowError("EXECUTOR_SECRET_FIELD_FORBIDDEN");
    expect(() =>
      buildMainMergeVerifiedEvent({
        at,
        record: { ...record, state: "MAIN_PR_OPEN", target: { ...record.target, stgSha: SHA.stgMerged } },
        observed: {
          mainBaseSha: SHA.previous,
          mainSha: SHA.main,
          headSha: SHA.stgMerged,
          parents: [SHA.stgMerged, SHA.previous],
          targetBranch: "main",
          mergeMethod: "merge",
          directMainPush: false,
        },
      }),
    ).toThrowError("EXECUTOR_LINEAGE_MISMATCH");
    expect(() =>
      buildProductionEvaluatedEvent({
        at,
        record: { ...record, state: "PRODUCTION_VERIFYING", target: { ...record.target, mainSha: SHA.main } },
        observed: productionObserved({ commitSha: SHA.previous }),
      }),
    ).toThrowError("EXECUTOR_PRODUCTION_SHA_MISMATCH");
    expect(() =>
      buildProductionEvaluatedEvent({
        at,
        record: { ...record, state: "PRODUCTION_VERIFYING", target: { ...record.target, mainSha: SHA.main } },
        observed: productionObserved({ smokeReadOnly: false }),
      }),
    ).toThrowError("EXECUTOR_SMOKE_MUST_BE_READ_ONLY");
    expect(() =>
      buildAliasRollbackVerifiedEvent({
        at,
        record: {
          ...record,
          state: "ALIAS_ROLLBACK_REQUIRED",
          vercel: { ...record.vercel, rollbackDeploymentId: "dpl_previous_ready" },
        },
        observed: {
          rollback: {
            rollbackDeploymentId: "dpl_previous_ready",
            rollbackDeploymentState: "READY",
            alias: "talkpik.example.com",
            databaseChanged: true,
          },
        },
      }),
    ).toThrowError("EXECUTOR_DATABASE_ROLLBACK_FORBIDDEN");
    expect(() =>
      buildCleanupVerifiedEvent({
        at,
        record: { ...record, state: "RELEASED" },
        observed: { stgFastForwardedToMain: false },
      }),
    ).toThrowError("EXECUTOR_STG_NOT_FAST_FORWARDED");
  });

  it("keeps assembled evidence to the closed field set the state machine reads", async () => {
    const { buildStgReadyEvent } = await executor();
    const { record } = await plannedRun();
    const observed = previewObserved();
    observed.preview.internalNote = "extra observation";
    const event = buildStgReadyEvent({
      at: "2026-07-23T10:03:00.000Z",
      record: {
        ...record,
        state: "STG_PR_OPEN",
        target: { ...record.target, candidateSha: SHA.candidate },
      },
      observed,
    });
    expect(Object.keys(event.previewEvidence).sort()).toEqual([
      "branch",
      "commitSha",
      "deploymentId",
      "environmentScope",
      "project",
      "state",
      "target",
    ]);
  });
});

describe("promotion executor preflight", () => {
  it("detects a moved stg base, identity drift, and an orphan registry lock", async () => {
    const { evaluatePreflight } = await executor();
    const { record } = await plannedRun();
    const clean = {
      stgSha: SHA.stg,
      sourceRepositoryIdentity: "blackstarzck/topik-project-v13",
      targetRepositoryIdentity: "keduall/topik-project-v13",
      registryLockPresent: false,
      verifiedAccounts: ["blackstarzck", "guestkeduall-design"],
    };

    expect(evaluatePreflight({ record, observed: clean })).toEqual({ ok: true, blockers: [] });
    expect(
      evaluatePreflight({ record, observed: { ...clean, stgSha: SHA.previous } }).blockers,
    ).toContain("PROMOTION_BASE_MOVED");
    expect(
      evaluatePreflight({
        record,
        observed: { ...clean, targetRepositoryIdentity: "other/repo" },
      }).blockers,
    ).toContain("REPOSITORY_IDENTITY_MISMATCH");
    expect(
      evaluatePreflight({ record, observed: { ...clean, registryLockPresent: true } }).blockers,
    ).toContain("PROMOTION_REGISTRY_LOCKED");
    expect(
      evaluatePreflight({ record, observed: { ...clean, verifiedAccounts: null } }).blockers,
    ).toContain("EXECUTOR_ACCOUNT_UNVERIFIED");
    expect(
      evaluatePreflight({ record, observed: { ...clean, verifiedAccounts: [] } }).blockers,
    ).toContain("EXECUTOR_ACCOUNT_UNAVAILABLE");
    expect(
      evaluatePreflight({ record, observed: { ...clean, stgSha: null } }).blockers,
    ).toContain("EXECUTOR_STG_TIP_UNVERIFIED");
    expect(() => evaluatePreflight({ record: { state: "PLANNED" }, observed: clean })).toThrowError(
      "EXECUTOR_RECORD_INVALID",
    );
  });

  it("accepts a stg tip this run itself could have produced and still blocks a third-party move", async () => {
    const { evaluatePreflight } = await executor();
    const base = {
      sourceRepositoryIdentity: "blackstarzck/topik-project-v13",
      targetRepositoryIdentity: "keduall/topik-project-v13",
      registryLockPresent: false,
      verifiedAccounts: ["blackstarzck", "guestkeduall-design"],
    };

    const pending = await runAtState("STG_PR_OPEN");
    expect(pending.target.stgSha).toBeNull();
    expect(
      evaluatePreflight({
        record: pending,
        observed: { ...base, stgSha: SHA.stgMerged, stgParents: [SHA.stg, SHA.candidate] },
      }),
    ).toEqual({ ok: true, blockers: [] });
    for (const stgParents of [
      [SHA.candidate, SHA.stg],
      [SHA.stg, SHA.previous],
      [SHA.stg],
      [],
      null,
      undefined,
    ]) {
      expect(
        evaluatePreflight({
          record: pending,
          observed: { ...base, stgSha: SHA.stgMerged, stgParents },
        }).blockers,
      ).toContain("PROMOTION_BASE_MOVED");
    }

    const released = await runAtState("RELEASED");
    expect(released.state).toBe("RELEASED");
    expect(released.target.mainSha).toBe(SHA.main);
    expect(
      evaluatePreflight({
        record: released,
        observed: { ...base, stgSha: SHA.main, stgParents: [SHA.previous, SHA.stgMerged] },
      }),
    ).toEqual({ ok: true, blockers: [] });
    expect(
      evaluatePreflight({
        record: released,
        observed: { ...base, stgSha: SHA.previous, stgParents: [] },
      }).blockers,
    ).toContain("PROMOTION_BASE_MOVED");

    const planned = await runAtState("PLANNED");
    expect(
      evaluatePreflight({
        record: planned,
        observed: { ...base, stgSha: SHA.stgMerged, stgParents: [SHA.stg, SHA.candidate] },
      }).blockers,
    ).toContain("PROMOTION_BASE_MOVED");
  });

  it("blocks the executor while a human production approval is pending", async () => {
    const { evaluatePreflight, buildHumanApprovalCommand } = await executor();
    const { record } = await walkToCleaned();
    expect(record.state).toBe("CLEANED");
    expect(
      evaluatePreflight({
        record,
        observed: {
          stgSha: SHA.stgMerged,
          sourceRepositoryIdentity: "blackstarzck/topik-project-v13",
          targetRepositoryIdentity: "keduall/topik-project-v13",
          registryLockPresent: false,
          verifiedAccounts: [],
        },
      }).blockers,
    ).toContain("EXECUTOR_RUN_TERMINAL");
    expect(() =>
      buildHumanApprovalCommand({
        repository: "C:\\repo",
        record,
        at: "2026-07-23T10:10:00.000Z",
      }),
    ).toThrowError("EXECUTOR_HUMAN_APPROVAL_NOT_PENDING");
  });
});

describe("promotion executor DB evidence loader", () => {
  function evidenceRoot() {
    const root = temporaryRoot();
    const allowed = path.join(root, "db-evidence");
    mkdirSync(allowed, { recursive: true });
    return { root, allowed };
  }

  it("refuses paths outside the allowed root and refuses symbolic evidence", async () => {
    const { loadMigrationEvidenceFile } = await executor();
    const { root, allowed } = evidenceRoot();
    const outside = path.join(root, "outside.json");
    writeFileSync(outside, JSON.stringify(migrationEvidence()), "utf8");

    expect(() =>
      loadMigrationEvidenceFile({ evidencePath: outside, allowedRoot: allowed }),
    ).toThrowError("DB_EVIDENCE_PATH_ESCAPE");
    expect(() =>
      loadMigrationEvidenceFile({
        evidencePath: path.join(allowed, "..", "outside.json"),
        allowedRoot: allowed,
      }),
    ).toThrowError("DB_EVIDENCE_PATH_ESCAPE");
    expect(() =>
      loadMigrationEvidenceFile({
        evidencePath: path.join(allowed, "missing.json"),
        allowedRoot: allowed,
      }),
    ).toThrowError("DB_EVIDENCE_UNREADABLE");
    expect(() =>
      loadMigrationEvidenceFile({ evidencePath: allowed, allowedRoot: allowed }),
    ).toThrowError("DB_EVIDENCE_UNREADABLE");

    const linkPath = path.join(allowed, "linked.json");
    let linked = false;
    try {
      symlinkSync(outside, linkPath, "file");
      linked = true;
    } catch {
      // Windows may deny link creation outside developer mode.
    }
    if (linked) {
      expect(() =>
        loadMigrationEvidenceFile({ evidencePath: linkPath, allowedRoot: allowed }),
      ).toThrowError("DB_EVIDENCE_SYMLINK");
    }
  });

  it("refuses invalid JSON and oversized evidence files", async () => {
    const { loadMigrationEvidenceFile } = await executor();
    const { allowed } = evidenceRoot();
    const broken = path.join(allowed, "broken.json");
    writeFileSync(broken, "{ not json", "utf8");
    expect(() =>
      loadMigrationEvidenceFile({ evidencePath: broken, allowedRoot: allowed }),
    ).toThrowError("DB_EVIDENCE_INVALID_JSON");

    const oversized = path.join(allowed, "oversized.json");
    writeFileSync(oversized, `{"padding":"${"a".repeat(300 * 1024)}"}`, "utf8");
    expect(() =>
      loadMigrationEvidenceFile({ evidencePath: oversized, allowedRoot: allowed }),
    ).toThrowError("DB_EVIDENCE_TOO_LARGE");
  });

  it("loads evidence the real migration gate accepts without validating it itself", async () => {
    const { validateMigrationEvidence } = await promotion();
    const { loadMigrationEvidenceFile } = await executor();
    const { allowed } = evidenceRoot();
    const file = path.join(allowed, "evidence.json");
    writeFileSync(file, `${JSON.stringify(migrationEvidence(), null, 2)}\n`, "utf8");

    const loaded = loadMigrationEvidenceFile({ evidencePath: file, allowedRoot: allowed });
    expect(loaded).toEqual(migrationEvidence());
    expect(validateMigrationEvidence(loaded)).toMatchObject({
      ok: true,
      code: "DB_GATE_PASSED_MANUAL_APPLY",
      autoApplyAllowed: false,
    });

    const blockedFile = path.join(allowed, "blocked.json");
    writeFileSync(
      blockedFile,
      JSON.stringify(migrationEvidence({ destructiveSql: true })),
      "utf8",
    );
    const blocked = loadMigrationEvidenceFile({
      evidencePath: blockedFile,
      allowedRoot: allowed,
    });
    expect(validateMigrationEvidence(blocked)).toMatchObject({
      ok: false,
      code: "DB_GATE_BLOCKED",
      recovery: "FORWARD_FIX_ONLY",
    });
  });
});

describe("promotion executor submitted evidence copy", () => {
  const RUN_ID = "promotion-20260723-11111111";

  function registryRoot() {
    const commonDir = path.join(temporaryRoot(), ".git");
    mkdirSync(commonDir, { recursive: true });
    return commonDir;
  }

  it("records the submitted event atomically at the expected path and mode", async () => {
    const { writePromotionRun } = await promotion();
    const { submittedEvidencePath, writeSubmittedEvidence } = await executor();
    const gitCommonDir = registryRoot();
    const { record } = await plannedRun();
    const runFile = writePromotionRun({ gitCommonDir, record });
    const event = {
      type: "CANDIDATE_VERIFIED",
      at: "2026-07-23T10:01:00.000Z",
      candidateSha: SHA.candidate,
      branch: record.target.candidateBranch,
    };

    const target = writeSubmittedEvidence({
      gitCommonDir,
      runId: RUN_ID,
      event,
      sequence: 2,
      now: "2026-07-23T10:01:05.000Z",
    });

    expect(target).toBe(
      path.join(
        gitCommonDir,
        "ai-pipeline",
        "promotions",
        "v1",
        "evidence",
        RUN_ID,
        "002-CANDIDATE_VERIFIED.json",
      ),
    );
    expect(
      submittedEvidencePath({
        gitCommonDir,
        runId: RUN_ID,
        sequence: 2,
        eventType: "CANDIDATE_VERIFIED",
      }),
    ).toBe(target);
    expect(JSON.parse(readFileSync(target, "utf8"))).toEqual({
      schemaVersion: 1,
      recordType: "PromotionSubmittedEvidenceV1",
      runId: RUN_ID,
      sequence: 2,
      recordedAt: "2026-07-23T10:01:05.000Z",
      event,
    });
    expect(statSync(target).mode & 0o777).toBe(statSync(runFile).mode & 0o777);
    expect(
      readdirSync(path.dirname(target)).filter((entry) => entry.endsWith(".tmp")),
    ).toEqual([]);

    expect(
      writeSubmittedEvidence({
        gitCommonDir,
        runId: RUN_ID,
        event,
        sequence: 2,
        now: "2026-07-23T10:01:06.000Z",
      }),
    ).toBe(target);
    expect(readdirSync(path.dirname(target))).toEqual(["002-CANDIDATE_VERIFIED.json"]);
  });

  it("refuses to record an event that carries a token-like key or value", async () => {
    const { writeSubmittedEvidence } = await executor();
    const gitCommonDir = registryRoot();
    const directory = path.join(
      gitCommonDir,
      "ai-pipeline",
      "promotions",
      "v1",
      "evidence",
      RUN_ID,
    );

    expect(() =>
      writeSubmittedEvidence({
        gitCommonDir,
        runId: RUN_ID,
        event: {
          type: "STG_READY",
          at: "2026-07-23T10:03:00.000Z",
          previewEvidence: { deploymentId: "dpl_1", serviceRoleKey: "canary" },
        },
        sequence: 4,
        now: "2026-07-23T10:03:05.000Z",
      }),
    ).toThrowError("PROMOTION_EVIDENCE_SECRET_FORBIDDEN");
    expect(() =>
      writeSubmittedEvidence({
        gitCommonDir,
        runId: RUN_ID,
        event: {
          type: "STG_READY",
          at: "2026-07-23T10:03:00.000Z",
          note: `ghp_${"a".repeat(30)}`,
        },
        sequence: 4,
        now: "2026-07-23T10:03:05.000Z",
      }),
    ).toThrowError("PROMOTION_EVIDENCE_SECRET_FORBIDDEN");
    expect(() =>
      writeSubmittedEvidence({
        gitCommonDir,
        runId: "not-a-run-id",
        event: { type: "STG_READY" },
        sequence: 1,
        now: "2026-07-23T10:03:05.000Z",
      }),
    ).toThrowError("PROMOTION_EVIDENCE_RUN_ID_INVALID");
    expect(() =>
      writeSubmittedEvidence({
        gitCommonDir,
        runId: RUN_ID,
        event: { type: "STG_READY" },
        sequence: 0,
        now: "2026-07-23T10:03:05.000Z",
      }),
    ).toThrowError("PROMOTION_EVIDENCE_SEQUENCE_INVALID");
    expect(existsSync(directory)).toBe(false);
  });

  it("keeps a failed evidence copy from changing the persisted transition", async () => {
    const {
      advancePromotionRun,
      persistPromotionTransition,
      readPromotionRun,
      writeApprovalPolicy,
      writePromotionRun,
    } = await promotion();
    const { buildCandidateVerifiedEvent, writeSubmittedEvidence } = await executor();
    const gitCommonDir = registryRoot();
    const { record, policy } = await plannedRun();
    writeApprovalPolicy({ gitCommonDir, policy });
    writePromotionRun({ gitCommonDir, record });
    const event = buildCandidateVerifiedEvent({
      at: "2026-07-23T10:01:00.000Z",
      record,
      observed: candidateObserved(),
    });
    const advanced = advancePromotionRun(record, {
      expectedRevision: record.revision,
      expectedFingerprint: record.fingerprint,
      policy,
      event,
    });
    persistPromotionTransition({
      currentRecord: record,
      currentPolicy: policy,
      result: advanced,
      writeRun: (nextRecord, expectedFingerprint) =>
        writePromotionRun({ gitCommonDir, record: nextRecord, expectedFingerprint }),
      writePolicy: (nextPolicy, expectedFingerprint) =>
        writeApprovalPolicy({ gitCommonDir, policy: nextPolicy, expectedFingerprint }),
    });

    let warning = null;
    try {
      writeSubmittedEvidence({
        gitCommonDir: path.join(gitCommonDir, "missing-registry"),
        runId: record.runId,
        event,
        sequence: advanced.record.journal.length,
        now: "2026-07-23T10:01:05.000Z",
      });
    } catch {
      warning = "PROMOTION_EVIDENCE_RECORDING_WARNING";
    }

    expect(warning).toBe("PROMOTION_EVIDENCE_RECORDING_WARNING");
    const persisted = readPromotionRun({ gitCommonDir, runId: record.runId });
    expect(persisted.state).toBe("CANDIDATE_VERIFIED");
    expect(persisted.fingerprint).toBe(advanced.record.fingerprint);
    expect(persisted.revision).toBe(advanced.record.revision);
  });
});

describe("promotion executor approval boundary", () => {
  it("refuses to submit a production approval event from the executor", async () => {
    const { assertExecutorSubmittableEvent, EXECUTOR_FORBIDDEN_EVENTS } = await executor();

    expect(EXECUTOR_FORBIDDEN_EVENTS).toEqual(["PROD_APPROVAL_GRANTED"]);
    expect(() =>
      assertExecutorSubmittableEvent({
        type: "PROD_APPROVAL_GRANTED",
        at: "2026-07-23T10:05:00.000Z",
        approvalFingerprint: digest("approval"),
      }),
    ).toThrowError("EXECUTOR_APPROVAL_EVENT_FORBIDDEN");
    expect(() => assertExecutorSubmittableEvent({ type: "not-a-code" })).toThrowError(
      "EXECUTOR_EVENT_INVALID",
    );
    expect(assertExecutorSubmittableEvent({ type: "CANDIDATE_VERIFIED" })).toEqual({
      type: "CANDIDATE_VERIFIED",
    });
  });
});
