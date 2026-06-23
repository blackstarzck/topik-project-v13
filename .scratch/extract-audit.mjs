import { readFile } from "node:fs/promises";

const p = "C:\\Users\\admin\\AppData\\Local\\Temp\\claude\\C--Users-admin-Desktop-workspace-topik-project-v13\\31ebb429-5815-4ca2-b480-2952220e284b\\tasks\\wd53c7odh.output";
const raw = await readFile(p, "utf8");
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  // maybe wrapped; try to find first { ... } of result
  const i = raw.indexOf('{"screens"');
  data = JSON.parse(raw.slice(i));
}

const root = data.result ?? data;
data = root;
const screens = root.screens ?? [];
const trunc = (s, n = 320) => (s == null ? "" : String(s).length > n ? String(s).slice(0, n) + "…" : String(s));

for (const s of screens) {
  const findings = s.audit?.findings ?? [];
  const counts = { conforms: 0, partial: 0, violation: 0, cannot_verify: 0 };
  for (const f of findings) counts[f.status] = (counts[f.status] ?? 0) + 1;
  const verifMap = new Map((s.verified ?? []).map((v) => [v.reqId, v.verification]));
  console.log("\n==================================================");
  console.log(`### ${s.key} — ${s.title}`);
  console.log(`reqs=${s.reqs?.requirements?.length ?? 0} findings=${findings.length} | conforms=${counts.conforms} partial=${counts.partial} violation=${counts.violation} cannot_verify=${counts.cannot_verify}`);
  if (s.reqs?.notes) console.log(`SOT notes: ${trunc(s.reqs.notes, 500)}`);
  console.log(`audit summary: ${trunc(s.audit?.summary, 600)}`);
  const flagged = findings.filter((f) => f.status !== "conforms");
  for (const f of flagged) {
    const v = verifMap.get(f.reqId);
    console.log(`\n  [${f.status.toUpperCase()} / ${f.severity}] ${f.reqId}: ${trunc(f.requirement, 200)}`);
    console.log(`    evidence: ${trunc(f.evidence, 260)}`);
    console.log(`    detail: ${trunc(f.detail, 380)}`);
    if (v) console.log(`    VERIFY: ${v.verdict}${v.correctedStatus ? ` -> ${v.correctedStatus}` : ""} | ${trunc(v.reason, 320)}`);
    else console.log(`    VERIFY: (none)`);
  }
}

console.log("\n\n==================== CRITIC ====================");
console.log(JSON.stringify(data.critic, null, 2));
