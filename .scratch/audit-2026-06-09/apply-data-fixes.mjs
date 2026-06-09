// DEV-ONLY data fixes for the wireframe UI audit (reversible). Prints counts/ids only.
//  (1) Unpublish the 4 incomplete writing PLACEHOLDER examples (seed.sql "(예시)" rows,
//      null answer_key/rubric) so default writing entry never surfaces a blocked problem.
//  (2) Publish a small deterministic set of COMPLETE q52 fixtures (real wireframe content
//      from sample-52.json, currently draft) so the documented D-02 screen is exercisable.
// NOTE: prod publication of q52 remains an ADMIN review decision (out of scope); this is dev seed.
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, assertNotProd, serviceKey } from "../review-2026-06-09/_env.mjs";
await loadEnvLocal();
const { label, url } = assertNotProd();
if (label === "prod" || label === "production") throw new Error("refusing prod");
const sb = createClient(url, serviceKey(), { auth: { persistSession: false } });

const PLACEHOLDERS = [
  "11111111-1111-1111-1111-111111111111",
  "22222222-2222-2222-2222-222222222222",
  "33333333-3333-3333-3333-333333333333",
  "44444444-4444-4444-4444-444444444444",
];
const N_Q52 = 5;

const countPub = async (qno) => {
  const { count } = await sb.from("problems").select("id", { count: "exact", head: true })
    .eq("domain", "writing").eq("question_no", qno).eq("publish_status", "published");
  return count;
};
const before = {};
for (const q of [51,52,53,54]) before[`q${q}`] = await countPub(q);
console.log("BEFORE published:", JSON.stringify(before));

// (1) Unpublish placeholders (writing only).
const { data: unpub, error: ue } = await sb.from("problems")
  .update({ publish_status: "draft", review_status: "pending", visibility: "private" })
  .in("id", PLACEHOLDERS).eq("publish_status", "published").select("id, question_no");
if (ue) throw new Error("unpublish: " + ue.message);
console.log(`Unpublished placeholders: ${unpub.length}`, unpub.map(r => `q${r.question_no}:${r.id.slice(0,8)}`));

// (2) Pick complete q52 drafts deterministically + publish.
const { data: drafts, error: de } = await sb.from("problems")
  .select("id, prompt, materials, answer_key, rubric, created_at")
  .eq("domain","writing").eq("question_no",52).neq("publish_status","published")
  .order("created_at",{ascending:true}).order("id",{ascending:true});
if (de) throw new Error("q52 drafts: " + de.message);
const isComplete = (p) => {
  const rb = p.rubric || {}; const inner = rb.rubric || rb.approved_rubric || rb;
  const summary = [inner.content, inner.structure, inner.language].filter(Boolean).length;
  const listCrit = [inner.criteria, inner["평가기준"], inner.items, inner.dimensions].find(Array.isArray);
  const crit = (listCrit ? listCrit.length : 0) || summary;
  const m = (p.materials && p.materials.blanks) || {};
  const blankHints = [m.blank_target_giyeok, m.blank_target_nieun].filter(Boolean).length;
  const promptBlanks = (p.prompt.match(/[（(]\s*[ㄱ-ㅎ]\s*[）)]/g) || []).length;
  return crit > 0 && (blankHints > 0 || promptBlanks > 0);
};
const chosen = drafts.filter(isComplete).slice(0, N_Q52);
let pubCount = 0;
for (const p of chosen) {
  const { error } = await sb.from("problems")
    .update({ publish_status: "published", review_status: "approved", visibility: "public" })
    .eq("id", p.id);
  if (error) throw new Error("publish q52 " + p.id + ": " + error.message);
  pubCount++;
}
console.log(`Published complete q52 fixtures: ${pubCount}`, chosen.map(p => p.id.slice(0,8)));

const after = {};
for (const q of [51,52,53,54]) after[`q${q}`] = await countPub(q);
console.log("AFTER published:", JSON.stringify(after));
console.log("DONE");
