// Parse the full-feature build output into a follow-up backlog (remaining + proposed shared changes).
import { readFileSync } from "node:fs";
const p = "C:/Users/admin/AppData/Local/Temp/claude/C--Users-admin-Desktop-workspace-topik-project-v13/eb57df7d-32c0-457e-b697-bf765e11bc1b/tasks/wsms0xmg8.output";
const root = JSON.parse(readFileSync(p, "utf8"));
const clusters = [...(root.result?.buildW1 ?? []), ...(root.result?.buildW2 ?? [])];

const seen = new Set();
const catalogChanges = [];
const docChanges = [];
const stubs = [];

console.log("================ PER-CLUSTER REMAINING (follow-up backlog) ================");
for (const { name, res } of clusters) {
  seen.add(name);
  console.log(`\n##### ${name} #####`);
  for (const ia of res.iaResults ?? []) {
    const rem = ia.remaining ?? [];
    console.log(`  [${ia.iaCode}] ${ia.status}  built=${(ia.built ?? []).length} remaining=${rem.length}`);
    for (const r of rem) console.log(`     - ${String(r).replace(/\s+/g, " ").slice(0, 220)}`);
    for (const s of ia.externalStubs ?? []) stubs.push(`[${ia.iaCode}] ${s}`);
    for (const d of ia.proposedDocChanges ?? []) docChanges.push(`[${ia.iaCode}] ${d.file}: ${d.change}`);
    for (const c of ia.proposedCatalogChanges ?? []) catalogChanges.push(`[${ia.iaCode}] ${typeof c === "string" ? c : JSON.stringify(c)}`);
  }
}

console.log("\n\n================ MISSING PACKETS (no structured output) ================");
for (const n of ["public-auth", "onboarding-dashboard", "feedback-reports-recommendations", "practice-writing", "library-settings-billing", "admin"]) {
  if (!seen.has(n)) console.log(`- ${n} (packet lost — derive remaining from discovery digest + current src)`);
}

console.log("\n================ PROPOSED CATALOG CHANGES (coordinator applies) ================");
catalogChanges.forEach((c, i) => console.log(`${i + 1}. ${c.replace(/\s+/g, " ").slice(0, 300)}`));
console.log("\n================ PROPOSED DOC CHANGES (coordinator applies) ================");
docChanges.forEach((d, i) => console.log(`${i + 1}. ${d.replace(/\s+/g, " ").slice(0, 300)}`));
console.log("\n================ EXTERNAL STUBS (need keys to wire) ================");
stubs.forEach((s, i) => console.log(`${i + 1}. ${s.replace(/\s+/g, " ").slice(0, 220)}`));
