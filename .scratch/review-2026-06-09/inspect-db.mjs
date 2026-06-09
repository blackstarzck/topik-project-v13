// Read-only dev DB inspection for the 2026-06-09 page-review seeding decision.
// Prints COUNTS + IDs only — never keys, never answer/PII text.
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, assertNotProd, serviceKey } from "./_env.mjs";

const STUDENT_ID = "4d447f42-7e82-4afd-937c-864b1af92ff7";

await loadEnvLocal();
const { label, url } = assertNotProd();
const key = serviceKey();
if (!key) throw new Error("No service role key in .env.local");
console.log(`env=${label} url=${url.replace(/^https?:\/\//, "").slice(0, 12)}...`);

const sb = createClient(url, key, { auth: { persistSession: false } });

// Published writing problems by question_no.
const { data: probs, error: pe } = await sb
  .from("problems")
  .select("id, question_no, publish_status, domain")
  .eq("domain", "writing");
if (pe) throw new Error("problems: " + pe.message);
const byQ = {};
for (const p of probs ?? []) {
  const k = `q${p.question_no}`;
  byQ[k] = byQ[k] || { total: 0, published: 0, sampleId: null };
  byQ[k].total++;
  if (p.publish_status === "published") {
    byQ[k].published++;
    if (!byQ[k].sampleId) byQ[k].sampleId = p.id;
  }
}
console.log("\n== writing problems by question_no ==");
console.log(JSON.stringify(byQ, null, 2));

// Student submissions.
const { data: subs, error: se } = await sb
  .from("writing_submissions")
  .select("id, question_no, problem_id, feedback_status, parent_submission_id")
  .eq("user_id", STUDENT_ID);
if (se) throw new Error("submissions: " + se.message);
console.log(`\n== student submissions: ${subs?.length ?? 0} ==`);
for (const s of (subs ?? []).slice(0, 12)) {
  console.log(`  ${s.id}  q=${s.question_no} fb=${s.feedback_status} parent=${s.parent_submission_id ? "Y" : "-"}`);
}

// Feedback rows for those submissions.
const subIds = (subs ?? []).map((s) => s.id);
let fbCount = 0;
if (subIds.length) {
  const { data: fbs } = await sb
    .from("writing_feedback")
    .select("submission_id, status, score_total")
    .in("submission_id", subIds);
  fbCount = fbs?.length ?? 0;
}
console.log(`\n== writing_feedback for student subs: ${fbCount} ==`);

// Comparison reports.
const { data: reports } = await sb
  .from("comparison_reports")
  .select("id, current_submission_id")
  .limit(50);
const studentReports = (reports ?? []).filter((r) =>
  subIds.includes(r.current_submission_id),
);
console.log(`\n== comparison_reports (recent 20): ${reports?.length ?? 0}, matching student: ${studentReports.length} ==`);
for (const r of studentReports.slice(0, 5)) console.log(`  ${r.id}`);

// Library items.
const { data: lib } = await sb
  .from("library_items")
  .select("id, submission_id, saved_at")
  .eq("user_id", STUDENT_ID);
console.log(`\n== library_items for student: ${lib?.length ?? 0} ==`);

console.log("\nDONE");
