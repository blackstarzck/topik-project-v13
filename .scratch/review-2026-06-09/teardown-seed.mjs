// Phase 5 teardown — delete ONLY the rows this review created via app flow
// (R-01 comparison_report + F-01 library_item), recorded in _seed-teardown.json.
// Preserves the 5 existing audit submissions/feedback. Refuses prod. No secrets printed.
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { loadEnvLocal, assertNotProd, serviceKey } from "./_env.mjs";

const STUDENT = "4d447f42-7e82-4afd-937c-864b1af92ff7";
const AUDIT = new Set([
  "a0d17000-0000-4000-8000-000000000051", "a0d17000-0000-4000-8000-000000000052",
  "a0d17000-0000-4000-8000-000000000053", "a0d17000-0000-4000-8000-000000000054",
  "a0d17000-0000-4000-8000-000000000055",
]);

await loadEnvLocal();
const { label } = assertNotProd();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey(), { auth: { persistSession: false } });
console.log(`env=${label}`);

const td = JSON.parse(await readFile(".design-review-shots/20260609/_seed-teardown.json", "utf8"));
console.log("teardown targets:", JSON.stringify({ library_items: td.library_items, comparison_reports: td.comparison_reports }));

// Safety: none of the targets may be an audit submission id.
for (const id of [...(td.library_items ?? []), ...(td.comparison_reports ?? [])]) {
  if (AUDIT.has(id)) throw new Error(`refusing: ${id} is an audit row`);
}

for (const id of td.comparison_reports ?? []) {
  const { error } = await sb.from("comparison_reports").delete().eq("id", id).eq("user_id", STUDENT);
  console.log(`comparison_reports ${id}: ${error ? "ERR " + error.message : "deleted"}`);
}
for (const id of td.library_items ?? []) {
  const { error } = await sb.from("library_items").delete().eq("id", id).eq("user_id", STUDENT);
  console.log(`library_items ${id}: ${error ? "ERR " + error.message : "deleted"}`);
}

// Verify: audit submissions + feedback intact; my seed rows gone.
const { data: subs } = await sb.from("writing_submissions").select("id").eq("user_id", STUDENT);
const { data: lib } = await sb.from("library_items").select("id").eq("user_id", STUDENT);
const { data: rep } = await sb.from("comparison_reports").select("id").eq("user_id", STUDENT);
const subIds = (subs ?? []).map((s) => s.id);
const auditPresent = [...AUDIT].every((id) => subIds.includes(id));
console.log(`\nVERIFY: student submissions=${subIds.length} (audit 5 present=${auditPresent}), library_items=${(lib ?? []).length}, comparison_reports=${(rep ?? []).length}`);
console.log(auditPresent && (subs ?? []).length === 5 ? "OK: audit data preserved, seed rows removed" : "WARN: unexpected state — inspect manually");
