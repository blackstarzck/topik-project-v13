import { describe, expect, it } from "vitest";
// @ts-expect-error — untyped .mjs audit script under test
import * as plan from "../../scripts/audit-setup/build-seed-data-plan.mjs";

type PlanRow = {
  iaCode: string;
  seedAllowed: boolean;
  requiredTables: string[];
  requiredRole: string;
  blockingIfMissing: boolean;
  ownerRecordKey: string | null;
  wrongOwnerRecordKey: string | null;
  adminTargetRecordKey: string | null;
  specStatus: string;
  targetClassification: string;
};
type ManifestEntry = { iaCode: string; audience: string; routeOrHostRoute: string; routeType: string; packs: string[] };
type Target = { classification: string; label: string; url: string };

const buildSeedPlanRows = plan.buildSeedPlanRows as (entries: ManifestEntry[], target: Target) => PlanRow[];
const classifyTargetEnv = plan.classifyTargetEnv as (env: Record<string, string | undefined>) => Target;
const SEED_SPEC = plan.SEED_SPEC as Record<string, { tables: string[] }>;

const devTarget: Target = { classification: "dev", label: "dev", url: "https://x.supabase.co" };

const manifest: ManifestEntry[] = [
  { iaCode: "A-02", audience: "public", routeOrHostRoute: "/login", routeType: "page", packs: ["AUTH"] },
  { iaCode: "X-07", audience: "user", routeOrHostRoute: "/practice/weakness", routeType: "page", packs: ["RECOMMEND"] },
  { iaCode: "E-01", audience: "user", routeOrHostRoute: "/writing/feedback/short/:id", routeType: "page", packs: ["OWNER-CHECK"] },
  { iaCode: "H-01", audience: "admin", routeOrHostRoute: "/admin/problems", routeType: "page", packs: ["ADMIN", "RBAC"] },
  { iaCode: "G-01", audience: "user", routeOrHostRoute: "/settings/language", routeType: "page", packs: ["FORM"] },
];

describe("buildSeedPlanRows", () => {
  const rows = buildSeedPlanRows(manifest, devTarget);
  const find = (code: string) => rows.find((r) => r.iaCode === code) as PlanRow;

  it("marks public routes seedAllowed:false with no required tables or blocking", () => {
    const a02 = find("A-02");
    expect(a02.seedAllowed).toBe(false);
    expect(a02.requiredTables).toEqual([]);
    expect(a02.blockingIfMissing).toBe(false);
    expect(a02.requiredRole).toBe("not-applicable");
  });

  it("expands a specified data route (X-07) with its real tables and learner role", () => {
    const x07 = find("X-07");
    expect(x07.seedAllowed).toBe(true);
    expect(x07.requiredRole).toBe("learner");
    expect(x07.requiredTables).toContain("feedback_dimension_scores");
    expect(x07.requiredTables).toContain("recommendation_items");
    expect(x07.blockingIfMissing).toBe(true);
    expect(x07.specStatus).toBe("specified");
  });

  it("flags owner-scoped routes with owner + wrong-owner record keys", () => {
    const e01 = find("E-01");
    expect(e01.ownerRecordKey).toBe("E-01-owner");
    expect(e01.wrongOwnerRecordKey).toBe("E-01-wrong-owner");
  });

  it("assigns the admin role and an admin target key for admin routes", () => {
    const h01 = find("H-01");
    expect(h01.requiredRole).toBe("content_admin");
    expect(h01.adminTargetRecordKey).toBe("H-01-admin-target");
  });

  it("treats unspecified user routes as generic actor-only (non-blocking)", () => {
    const g01 = find("G-01");
    expect(g01.specStatus).toBe("generic-actor-only");
    expect(g01.blockingIfMissing).toBe(false);
    expect(g01.requiredTables).toEqual(["profiles"]);
    expect(g01.requiredRole).toBe("learner");
  });

  it("propagates the target classification onto every row", () => {
    expect(rows.every((r) => r.targetClassification === "dev")).toBe(true);
  });
});

describe("classifyTargetEnv", () => {
  it("classifies an explicit dev label as dev", () => {
    expect(classifyTargetEnv({ SUPABASE_ENV_LABEL: "dev", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }).classification).toBe("dev");
  });

  it("classifies an explicit prod label as prod", () => {
    expect(classifyTargetEnv({ SUPABASE_ENV_LABEL: "prod" }).classification).toBe("prod");
  });

  it("classifies a localhost url as local", () => {
    expect(classifyTargetEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }).classification).toBe("local");
  });

  it("treats an unknown/unlabeled remote target as unsafe (unknown-treat-as-prod)", () => {
    expect(classifyTargetEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://mystery.supabase.co" }).classification).toBe("unknown-treat-as-prod");
  });
});

describe("SEED_SPEC integrity", () => {
  it("keeps X-07 the weakness scenario with the full recommendation + dimension chain", () => {
    expect(SEED_SPEC["X-07"].tables).toEqual(
      expect.arrayContaining(["writing_submissions", "feedback_dimension_scores", "recommendation_runs", "recommendation_items"]),
    );
  });
});
