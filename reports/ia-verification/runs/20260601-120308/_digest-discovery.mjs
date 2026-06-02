// Parse the conformance-discovery workflow output into an actionable backlog digest.
import { readFileSync } from "node:fs";
const p = "C:/Users/admin/AppData/Local/Temp/claude/C--Users-admin-Desktop-workspace-topik-project-v13/eb57df7d-32c0-457e-b697-bf765e11bc1b/tasks/wpcmhpjxd.output";
const root = JSON.parse(readFileSync(p, "utf8"));
const shards = root.result?.results ?? root.results ?? [];

const byNeed = {};
let totalGaps = 0;
const migrations = [];
const externals = [];

console.log("================ PER-SHARD SUMMARY + MIGRATION/EXTERNAL NEEDS ================");
for (const { name, res } of shards) {
  console.log(`\n##### ${name} #####`);
  console.log("SUMMARY: " + (res.shardSummary ?? "").replace(/\s+/g, " ").slice(0, 600));
  for (const m of res.shardMigrationNeeds ?? []) { migrations.push(`[${name}] ${m}`); }
  for (const e of res.shardExternalDeps ?? []) { externals.push(`[${name}] ${e}`); }
  for (const ia of res.iaGaps ?? []) {
    for (const g of ia.gaps ?? []) {
      totalGaps++;
      (byNeed[g.need] ??= []).push({ shard: name, ia: ia.iaCode, feature: g.feature, status: g.currentStatus, effort: g.effort, detail: g.needDetail });
    }
  }
}

console.log("\n\n================ CONSOLIDATED NEW MIGRATION NEEDS ================");
migrations.forEach((m, i) => console.log(`${i + 1}. ${m}`));

console.log("\n================ EXTERNAL-PROVIDER DEPS ================");
externals.forEach((e, i) => console.log(`${i + 1}. ${e}`));

console.log(`\n================ GAP COUNTS (total ${totalGaps}) ================`);
for (const need of Object.keys(byNeed)) console.log(`${need}: ${byNeed[need].length}`);

function dump(need, withDetail) {
  const items = byNeed[need] ?? [];
  console.log(`\n================ ${need} (${items.length}) ================`);
  for (const it of items) {
    const base = `[${it.ia}/${it.effort ?? "?"}/${it.status}] ${it.feature}`.replace(/\s+/g, " ");
    console.log("- " + base.slice(0, 200));
    if (withDetail && it.detail) console.log("    -> " + it.detail.replace(/\s+/g, " ").slice(0, 320));
  }
}

dump("db-migration", true);
dump("external-provider", true);
dump("i18n-catalog", true);
dump("component-only", false);
dump("evidence-only", false);
dump("none", false);
