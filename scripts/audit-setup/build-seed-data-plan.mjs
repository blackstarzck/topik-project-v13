#!/usr/bin/env node
// =====================================================================
// Phase 1.5 — Seed data PLAN builder.
// Plan: docs/ai-workflow/ia-implementation-verification-execution-plan.md §7.5 (Step 1.5.1)
//
// Pure planner. Derives deterministic Supabase seed PRECONDITIONS from
// ia-manifest.json. This script NEVER touches the database — it only emits
// <auditDir>/seed-plan.json describing what verify-seed-data.mjs must create
// or verify. Public/seed-independent routes are explicitly seedAllowed:false so
// missing seed data can never block unrelated public evidence.
// =====================================================================

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  REPO_ROOT,
  resolveAuditDir,
  ensureAuditDir,
  runIdFromAuditDir,
  gitMeta,
  evidenceBundleId,
  generatedAt,
  loadManifest,
  writeJson,
} from "./ia-audit-lib.mjs";

// Minimal .env.local loader (mirrors build-storage-state.mjs) so the CLI sees
// SUPABASE_ENV_LABEL / NEXT_PUBLIC_SUPABASE_URL. Never overrides inherited env.
// Called only from main() — never at import time, so tests stay hermetic.
export function loadEnvLocal(filePath = join(REPO_ROOT, ".env.local")) {
  if (!existsSync(filePath)) return;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Explicit per-IA seed spec for data-backed routes. Anything not listed gets
// generic actor-only handling derived from the manifest (audience/route/packs).
// `tables` = the domain tables the route reads; `owner` = route is owner-scoped
// (needs an owner + wrong-owner record); `adminRole` = admin route's required role.
export const SEED_SPEC = {
  "X-07": {
    tables: [
      "writing_submissions",
      "writing_feedback",
      "feedback_dimension_scores",
      "recommendation_runs",
      "recommendation_items",
      "problems",
    ],
    note: "weakness page: >=5 dimension-scored submissions across >=2 dimensions + an active, non-expired weakness recommendation run with >=2 items",
  },
  "B-01": {
    tables: ["recommendation_runs", "recommendation_items", "writing_submissions"],
    note: "dashboard: recent activity + recommendation cards",
  },
  "X-02": {
    tables: ["feedback_dimension_scores", "recommendation_runs", "recommendation_items"],
    note: "growth dashboard analytics",
  },
  "C-01": {
    tables: ["recommendation_runs", "recommendation_items"],
    note: "problem-type recommendations",
  },
  "E-01": {
    tables: ["writing_submissions", "writing_feedback", "feedback_dimension_scores", "sentence_feedback"],
    owner: true,
    note: "short-answer feedback owner row (/:id)",
  },
  "E-02": {
    tables: ["writing_submissions", "writing_feedback", "feedback_dimension_scores", "sentence_feedback"],
    owner: true,
    note: "long-form feedback owner row (/:id)",
  },
  "R-01": {
    tables: ["comparison_reports", "writing_submissions"],
    owner: true,
    note: "comparison report owner row (/:id)",
  },
  "R-02": {
    tables: ["recommendation_runs", "recommendation_items"],
    note: "next-problem recommendation",
  },
  "F-01": {
    tables: ["library_items", "writing_submissions"],
    note: "library saved items",
  },
  "H-01": {
    tables: ["problems", "admin_audit_logs"],
    adminRole: "content_admin",
    note: "admin problem management + audit log",
  },
  "X-08": {
    tables: ["profiles"],
    adminRole: "org_admin",
    note: "org admin dashboard (org-scoped)",
  },
  "X-10": {
    tables: ["profiles", "admin_audit_logs"],
    adminRole: "platform_admin",
    owner: true,
    note: "user management — needs an other-user target row",
  },
};

const ADMIN_ROLE_BY_IA = {
  "H-01": "content_admin",
  "X-08": "org_admin",
  "X-10": "platform_admin",
};

// Mirror of build-storage-state.mjs classification so the plan records the same
// target verdict the verifier will enforce.
export function classifyTargetEnv(env = process.env) {
  const label = (env.SUPABASE_ENV_LABEL ?? "").toLowerCase();
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let classification;
  if (label === "prod" || label === "production") classification = "prod";
  else if (["dev", "development", "staging", "preview"].includes(label)) classification = "dev";
  else if (label === "local") classification = "local";
  else if (/127\.0\.0\.1|localhost/.test(url)) classification = "local";
  else classification = "unknown-treat-as-prod";
  return { classification, label: label || "(unset)", url };
}

function isOwnerScenario(entry, spec) {
  if (spec?.owner) return true;
  const route = entry.routeOrHostRoute ?? "";
  if (/:[A-Za-z]/.test(route) || /\/\[[^\]]+\]/.test(route)) return true;
  return (entry.packs ?? []).includes("OWNER-CHECK");
}

export function buildSeedPlanRows(manifestEntries, target) {
  return manifestEntries.map((entry) => {
    const { iaCode, audience = "user", routeOrHostRoute = "unknown", routeType = "page" } = entry;
    const spec = SEED_SPEC[iaCode];

    const base = {
      iaCode,
      screenName: entry.screenName ?? iaCode,
      routeOrHostRoute,
      audience,
      routeType,
      targetEnvironment: target.url,
      targetClassification: target.classification,
    };

    if (audience === "public") {
      return {
        ...base,
        requiredRole: "not-applicable",
        requiredTables: [],
        ownerRecordKey: null,
        wrongOwnerRecordKey: null,
        adminTargetRecordKey: null,
        seedAllowed: false,
        seedPreconditions: "public route — no authenticated actor or seed precondition required",
        notApplicableReason: "public route",
        blockingIfMissing: false,
        specStatus: "not-applicable-public",
      };
    }

    const isAdmin = audience === "admin";
    const requiredRole = isAdmin ? (ADMIN_ROLE_BY_IA[iaCode] ?? "content_admin") : "learner";
    const owner = isOwnerScenario(entry, spec);

    return {
      ...base,
      requiredRole,
      requiredTables: spec?.tables ?? ["profiles"],
      ownerRecordKey: owner ? `${iaCode}-owner` : null,
      wrongOwnerRecordKey: owner ? `${iaCode}-wrong-owner` : null,
      adminTargetRecordKey: isAdmin ? `${iaCode}-admin-target` : null,
      seedAllowed: true,
      seedPreconditions:
        spec?.note ??
        `authenticated ${requiredRole} actor with a matching profiles row (scenario-specific domain rows not yet specified — generic actor only)`,
      // Only routes with an explicit data spec block final evidence when their
      // rows are missing. Generic actor-only routes do not block on seed data.
      blockingIfMissing: Boolean(spec),
      specStatus: spec ? "specified" : "generic-actor-only",
    };
  });
}

export function buildSeedPlan(auditDir, env = process.env) {
  const runId = runIdFromAuditDir(auditDir);
  const meta = gitMeta();
  const bundleId = evidenceBundleId({ runId, ...meta });
  const manifest = loadManifest(auditDir);
  const target = classifyTargetEnv(env);
  const rows = buildSeedPlanRows(manifest.entries ?? [], target).map((row) => ({
    runId,
    sourceCommit: meta.sourceCommit,
    dirtyState: meta.dirtyState,
    evidenceBundleId: bundleId,
    phase: "phase-1.5-seed-plan",
    ...row,
    generatedBy: "build-seed-data-plan.mjs",
    generatedAt: generatedAt(),
  }));

  const seedDependent = rows.filter((row) => row.seedAllowed && row.blockingIfMissing);
  return {
    runId,
    sourceCommit: meta.sourceCommit,
    dirtyState: meta.dirtyState,
    evidenceBundleId: bundleId,
    generatedBy: "build-seed-data-plan.mjs",
    generatedAt: generatedAt(),
    targetClassification: target.classification,
    targetEnvironment: target.url,
    summary: {
      total: rows.length,
      seedAllowed: rows.filter((r) => r.seedAllowed).length,
      seedDependentBlocking: seedDependent.length,
      publicSkipped: rows.filter((r) => !r.seedAllowed).length,
      specified: rows.filter((r) => r.specStatus === "specified").length,
      genericActorOnly: rows.filter((r) => r.specStatus === "generic-actor-only").length,
    },
    rows,
  };
}

function main() {
  loadEnvLocal();
  const auditDir = resolveAuditDir();
  ensureAuditDir(auditDir);
  const plan = buildSeedPlan(auditDir);
  const outPath = `${auditDir}/seed-plan.json`;
  writeJson(outPath, plan);
  console.log(`build-seed-data-plan.mjs: wrote ${outPath}`);
  console.log(
    `  total=${plan.summary.total} seedAllowed=${plan.summary.seedAllowed} ` +
      `specified=${plan.summary.specified} genericActorOnly=${plan.summary.genericActorOnly} ` +
      `publicSkipped=${plan.summary.publicSkipped} target=${plan.targetClassification}`,
  );
}

// Run only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("build-seed-data-plan.mjs")) {
  main();
}
