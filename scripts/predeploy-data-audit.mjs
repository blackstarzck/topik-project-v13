#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";

const PROD_LABELS = new Set(["prod", "production"]);

export function buildSeedAuditChecks() {
  return [
    {
      id: "audit-seed-problems",
      table: "problems",
      severity: "block",
      description: "local audit_seed sample problems",
      apply(query) {
        return query.contains("tags", ["audit_seed"]);
      },
    },
    {
      id: "wireframe-fixture-problems",
      table: "problems",
      severity: "block",
      description: "wireframe fixture problem rows",
      apply(query) {
        return query.eq("materials->>seed_source", "wireframe_problem_fixtures");
      },
    },
    {
      id: "published-wireframe-fixtures",
      table: "problems",
      severity: "block",
      description: "wireframe fixtures still visible to learners",
      apply(query) {
        return query
          .eq("materials->>seed_source", "wireframe_problem_fixtures")
          .eq("publish_status", "published")
          .eq("review_status", "approved")
          .eq("visibility", "public");
      },
    },
    {
      id: "dev-q52-seed-promotion",
      table: "problems",
      severity: "block",
      description: "q52 fixtures promoted by local seed.sql for dev only",
      apply(query) {
        return query
          .eq("materials->>seed_source", "wireframe_problem_fixtures")
          .eq("question_no", 52)
          .eq("publish_status", "published")
          .eq("review_status", "approved")
          .eq("visibility", "public");
      },
    },
    {
      id: "seed-subscription-plans",
      table: "subscription_plans",
      severity: "warn",
      description: "placeholder billing plan rows tagged as seed data",
      apply(query) {
        return query.in("plan_key", [
          "topik_monthly",
          "topik_quarterly",
          "topik_yearly",
        ]);
      },
    },
    {
      id: "placeholder-legal-documents",
      table: "legal_documents",
      severity: "block",
      description: "placeholder legal documents that must be replaced predeploy",
      apply(query) {
        return query.eq("is_placeholder", true);
      },
    },
  ];
}

export function summarizeAuditResults(checks, countsById) {
  const blockingIds = [];
  const warningIds = [];
  let totalBlockingRows = 0;

  for (const check of checks) {
    const count = countsById[check.id] ?? 0;
    if (count <= 0) continue;
    if (check.severity === "block") {
      blockingIds.push(check.id);
      totalBlockingRows += count;
    } else {
      warningIds.push(check.id);
    }
  }

  return { blockingIds, warningIds, totalBlockingRows };
}

export function assertSafeTarget({ envLabel, allowProd }) {
  const normalized = String(envLabel ?? "").trim().toLowerCase();
  if (PROD_LABELS.has(normalized) && !allowProd) {
    throw new Error(
      "Refusing to audit a production Supabase target without --allow-prod.",
    );
  }
}

function parseArgs(argv) {
  return {
    allowProd: argv.includes("--allow-prod"),
    json: argv.includes("--json"),
  };
}

function getSupabaseConfig(env) {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const envLabel = env.SUPABASE_ENV_LABEL ?? "local";

  if (!url) {
    throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url, key, envLabel };
}

async function countRows(client, check) {
  const baseQuery = client
    .from(check.table)
    .select("*", { count: "exact", head: true });
  const { count, error } = await check.apply(baseQuery);

  if (error) {
    throw new Error(
      `${check.id} query failed: ${error.message || JSON.stringify(error)}`,
    );
  }

  return count ?? 0;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const { url, key, envLabel } = getSupabaseConfig(process.env);
  assertSafeTarget({ envLabel, allowProd: args.allowProd });

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const checks = buildSeedAuditChecks();
  const rows = [];
  const countsById = {};

  for (const check of checks) {
    const count = await countRows(client, check);
    countsById[check.id] = count;
    rows.push({
      id: check.id,
      table: check.table,
      severity: check.severity,
      count,
      description: check.description,
    });
  }

  const summary = summarizeAuditResults(checks, countsById);
  if (args.json) {
    console.log(JSON.stringify({ envLabel, rows, summary }, null, 2));
  } else {
    console.log(`Predeploy data audit target: ${envLabel}`);
    for (const row of rows) {
      console.log(
        `${row.severity.toUpperCase()} ${row.id}: ${row.count} (${row.description})`,
      );
    }
    console.log(`Blocking rows: ${summary.totalBlockingRows}`);
  }

  if (summary.blockingIds.length > 0) {
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
