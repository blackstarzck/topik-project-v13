// Read-only live probe: (1) does new list_user_problems RPC apply (C-02)?
// (2) find a complete q52 draft to publish. Prints ids/flags only — no secrets/PII text.
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, assertNotProd, serviceKey } from "../review-2026-06-09/_env.mjs";

await loadEnvLocal();
const { label, url } = assertNotProd();
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const svc = serviceKey();
const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const PW = process.env.SUPABASE_TEST_PASSWORD ?? "";
console.log(`env=${label}`);

// --- (1) RPC test as the student (SECURITY INVOKER needs a real auth.uid) ---
const userClient = createClient(url, anon, { auth: { persistSession: false } });
const { error: signErr } = await userClient.auth.signInWithPassword({ email: EMAIL, password: PW });
if (signErr) { console.log("SIGNIN_FAIL:", signErr.message); }
else {
  const { data, error } = await userClient.rpc("list_user_problems", {
    filter: { domain: "writing" }, sort: "recent", page: 1, page_size: 50,
  });
  if (error) console.log("RPC_ERROR:", error.message);
  else {
    const rows = data ?? [];
    const sample = rows[0] ?? {};
    const hasNewCols = "writing_submission_count" in sample && "solve_state" in sample && "latest_submission_id" in sample;
    const submitted = rows.filter(r => r.solve_state === "submitted");
    console.log(`RPC rows=${rows.length} hasNewCols=${hasNewCols} submittedRows=${submitted.length}`);
    console.log("  solve_states:", JSON.stringify(rows.map(r => ({ q: r.question_no, s: r.solve_state, subs: r.writing_submission_count, lsid: r.latest_submission_id ? "Y" : "-" })).slice(0, 12)));
  }
}

// --- (2) find complete q52 drafts (service role) ---
const sb = createClient(url, svc, { auth: { persistSession: false } });
const { data: q52, error: qe } = await sb
  .from("problems")
  .select("id, title, publish_status, materials, answer_key, rubric, created_at")
  .eq("domain", "writing").eq("question_no", 52);
if (qe) { console.log("q52 err:", qe.message); }
else {
  const score = (p) => {
    const m = p.materials || {}, ak = p.answer_key || {}, rb = p.rubric || {};
    const hasMat = m && typeof m === "object" && Object.keys(m).length > 3;
    const hasAk = ak && typeof ak === "object" && Object.keys(ak).length > 0;
    const hasRb = rb && typeof rb === "object" && Object.keys(rb).length > 0;
    return { hasMat, hasAk, hasRb, ok: hasMat && (hasAk || hasRb) };
  };
  const published = q52.filter(p => p.publish_status === "published");
  const drafts = q52.filter(p => p.publish_status !== "published");
  const goodDrafts = drafts.map(p => ({ id: p.id, ...score(p) })).filter(x => x.ok);
  console.log(`\nq52 total=${q52.length} published=${published.length} drafts=${drafts.length} completeDrafts=${goodDrafts.length}`);
  console.log("  published ids:", published.map(p => p.id.slice(0,8)));
  console.log("  first 5 complete draft candidates:", JSON.stringify(goodDrafts.slice(0,5), null, 0));
}
console.log("\nDONE");
