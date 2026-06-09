// Inspect q52 draft candidates' rubric/answer_key/materials SHAPE (keys + lengths,
// not full content) to confirm normalizeWritingProblem would mark them non-blocked.
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, assertNotProd, serviceKey } from "../review-2026-06-09/_env.mjs";
await loadEnvLocal();
const { url } = assertNotProd();
const sb = createClient(url, serviceKey(), { auth: { persistSession: false } });

const { data, error } = await sb.from("problems")
  .select("id, prompt, materials, answer_key, rubric, created_at")
  .eq("domain", "writing").eq("question_no", 52)
  .neq("publish_status", "published")
  .order("created_at", { ascending: true })
  .limit(6);
if (error) throw error;

const keys = (o) => (o && typeof o === "object" ? Object.keys(o) : []);
for (const p of data) {
  const m = p.materials || {}, rb = p.rubric || {}, ak = p.answer_key || {};
  // mimic normalizer rubric candidate resolution (top-level rubric obj)
  const rbInner = rb.rubric || rb.approved_rubric || rb;
  const conds = rbInner.conditions || rbInner["조건"] || rbInner.tasks;
  const crit = rbInner.criteria || rbInner["평가기준"] || rbInner.items || rbInner.dimensions;
  const blankLabels = (p.prompt.match(/[（(]\s*[ㄱ-ㅎ]\s*[）)]/g) || []);
  const mBlanks = m.blanks || {};
  console.log(JSON.stringify({
    id: p.id.slice(0,8),
    rubricKeys: keys(rb), rubricInnerKeys: keys(rbInner),
    conds: Array.isArray(conds) ? conds.length : (conds ? 1 : 0),
    crit: Array.isArray(crit) ? crit.length : (crit ? 1 : 0),
    rubricSummary: [rbInner.content,rbInner.structure,rbInner.language].filter(Boolean).length,
    promptBlanks: blankLabels.length,
    mBlanksKeys: keys(mBlanks),
    blankHints: [mBlanks.blank_target_giyeok, mBlanks.blank_target_nieun].filter(Boolean).length,
    akKeys: keys(ak),
  }));
}
console.log("DONE");
