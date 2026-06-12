import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

// ---- env ----
function loadEnvLocal() {
  const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const EVID = "docs/qa/reports/qa-report-20260612-1205-evidence";
mkdirSync(EVID, { recursive: true });

function sb() { return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }); }
const createdSubs = [];
const createdReports = [];

async function userId() {
  const c = sb();
  const u = await c.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (u.error) throw u.error;
  const found = u.data.users.find((x) => x.email?.toLowerCase() === EMAIL.toLowerCase());
  if (!found) throw new Error("student user not found");
  return found.id;
}
async function publishedProblem(qno) {
  const c = sb();
  const p = await c.from("problems").select("id").eq("domain", "writing").eq("question_no", qno).eq("publish_status", "published").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (p.error) throw p.error;
  if (!p.data?.id) throw new Error(`no published q${qno}`);
  return p.data.id;
}
const DIMS = ["grammar","vocab","structure","content","expression","topic_fit"];

async function seedShort(uid) {
  const c = sb(); const pid = await publishedProblem(51); const id = randomUUID();
  const ans = "저는 회의 일정 때문에 금요일 오후 세 시에 만날 수 있습니다.\n장소는 회사 근처 카페가 좋겠습니다.";
  await c.from("writing_submissions").insert({ id, user_id: uid, problem_id: pid, question_no: 51, answer_text: ans, char_count: ans.length, feedback_status: "complete" });
  await c.from("writing_feedback").insert({ submission_id: id, user_id: uid, status: "complete", score_total: 82, score_max: 100, overall_summary: "QA 시드 단답 피드백입니다.", ai_model: "qa-fixture", ai_model_version: "E-01" });
  await c.from("feedback_dimension_scores").insert(DIMS.map((d,i)=>({ submission_id: id, user_id: uid, dimension: d, score: 70+i*3, score_max: 100, summary: `${d} 요약`, weakness_level: ((i%5)+1) })));
  await c.from("sentence_feedback").insert([
    { submission_id: id, user_id: uid, sentence_index: 0, original_text: "원문1", corrected_text: "수정1", comment: "코멘트1" },
    { submission_id: id, user_id: uid, sentence_index: 1, original_text: "원문2", corrected_text: "수정2", comment: "코멘트2" },
  ]);
  createdSubs.push(id); return id;
}
async function seedLong(uid) {
  const c = sb(); const pid = await publishedProblem(53); const id = randomUUID();
  const lines = ["첫째, 자료의 변화는 방문자 수 증가입니다.","둘째, 온라인 신청 비율이 높아졌습니다.","그러므로 기관은 모바일 안내를 강화해야 합니다.","또한 오프라인 안내도 유지해야 합니다.","마지막으로 두 방식의 균형이 중요합니다."];
  const ans = lines.join("\n");
  await c.from("writing_submissions").insert({ id, user_id: uid, problem_id: pid, question_no: 53, answer_text: ans, char_count: ans.length, feedback_status: "complete" });
  await c.from("writing_feedback").insert({ submission_id: id, user_id: uid, status: "complete", score_total: 74, score_max: 100, overall_summary: "QA 시드 장문 피드백입니다.", ai_model: "qa-fixture", ai_model_version: "E-02" });
  await c.from("feedback_dimension_scores").insert(DIMS.map((d,i)=>({ submission_id: id, user_id: uid, dimension: d, score: 68+i*3, score_max: 100, summary: `${d} 요약`, weakness_level: ((i%5)+1) })));
  await c.from("sentence_feedback").insert(lines.map((tx,i)=>({ submission_id: id, user_id: uid, sentence_index: i, original_text: tx, corrected_text: `${tx} (수정 ${i+1})`, comment: `문장 ${i+1} 제안` })));
  createdSubs.push(id); return id;
}
async function seedReport(uid) {
  const c = sb(); const pid = await publishedProblem(53);
  const prev = randomUUID(); const cur = randomUUID(); const rep = randomUUID();
  const prevAns = "이전 답안은 짧고 근거가 부족합니다.";
  const curAns = "현재 답안은 구조가 분명하고 근거가 충분합니다.\n두 번째 문장도 더 명확합니다.";
  await c.from("writing_submissions").insert([
    { id: prev, user_id: uid, problem_id: pid, question_no: 53, answer_text: prevAns, char_count: prevAns.length, feedback_status: "complete" },
    { id: cur, user_id: uid, problem_id: pid, question_no: 53, answer_text: curAns, char_count: curAns.length, feedback_status: "complete", parent_submission_id: prev },
  ]);
  await c.from("writing_feedback").insert([
    { submission_id: prev, user_id: uid, status: "complete", score_total: 68, score_max: 100, overall_summary: "이전 요약", ai_model: "qa-fixture", ai_model_version: "R-01" },
    { submission_id: cur, user_id: uid, status: "complete", score_total: 82, score_max: 100, overall_summary: "현재 요약", ai_model: "qa-fixture", ai_model_version: "R-01" },
  ]);
  await c.from("feedback_dimension_scores").insert(DIMS.flatMap((d,i)=>[
    { submission_id: prev, user_id: uid, dimension: d, score: 65+i*2, score_max: 100, summary: `이전 ${d}`, weakness_level: 3 },
    { submission_id: cur, user_id: uid, dimension: d, score: 75+i*2, score_max: 100, summary: `현재 ${d}`, weakness_level: 2 },
  ]));
  await c.from("comparison_reports").insert({ id: rep, user_id: uid, current_submission_id: cur, previous_submission_id: prev, metrics: { score_delta: 14, dimension_deltas: Object.fromEntries(DIMS.map(d=>[d,10])), char_delta: curAns.length-prevAns.length, no_previous: false }, narrative: "현재 답안이 구조와 근거 면에서 향상되었습니다.", ai_model: "qa-fixture" });
  createdSubs.push(prev, cur); createdReports.push(rep); return rep;
}

async function cleanup() {
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return;
  const c = sb();
  for (const id of createdReports) await c.from("comparison_reports").delete().eq("id", id);
  for (const id of createdSubs) {
    await c.from("comparison_reports").delete().eq("current_submission_id", id);
    await c.from("library_items").delete().eq("submission_id", id);
    await c.from("sentence_feedback").delete().eq("submission_id", id);
    await c.from("feedback_dimension_scores").delete().eq("submission_id", id);
    await c.from("writing_feedback").delete().eq("submission_id", id);
    await c.from("writing_submissions").delete().eq("id", id);
  }
}

// ---- capture helpers ----
async function hydrationProof(page) {
  return await page.evaluate(() => {
    const els = document.querySelectorAll("button, a, input, [role]");
    for (const el of els) for (const k in el) if (k.startsWith("__reactFiber$") || k.startsWith("__reactProps$")) return true;
    return false;
  });
}
async function capture(ctx, route, slug, vp) {
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  let status = null;
  page.on("response", (r) => { if (r.url() === BASE + route || r.url() === BASE + route + "/") status = r.status(); });
  let finalUrl = "";
  try {
    const resp = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 25000 });
    if (resp && status == null) status = resp.status();
    await page.waitForTimeout(700);
    finalUrl = page.url().replace(BASE, "");
    const hyd = await hydrationProof(page);
    const file = `${slug}-${vp}.png`;
    await page.screenshot({ path: path.join(EVID, file), fullPage: false });
    await page.close();
    return { route, finalUrl, status, hydrated: hyd, consoleErrors: errs.filter(e=>!e.includes("favicon")), screenshot: file };
  } catch (e) {
    finalUrl = page.url().replace(BASE, "");
    await page.close().catch(()=>{});
    return { route, finalUrl, status, hydrated: false, consoleErrors: errs, error: String(e).slice(0,200) };
  }
}
async function anonRedirect(ctx, route) {
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(400);
    const finalUrl = page.url().replace(BASE, "");
    await page.close();
    return { route, finalUrl, redirectedToLogin: /^\/login/.test(finalUrl) };
  } catch (e) { await page.close().catch(()=>{}); return { route, error: String(e).slice(0,120) }; }
}

// ---- run ----
const uid = await userId();
const shortId = await seedShort(uid);
const longId = await seedLong(uid);
const reportId = await seedReport(uid);

const browser = await chromium.launch();
const results = { seeds: { shortId, longId, reportId }, public: [], protected: [], anon: [], mobile: [] };

// PUBLIC (no auth), desktop
const pubCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const PUBLIC = [
  ["/","x01-landing"],["/sign-up","a01-signup"],["/login","a02-login"],
  ["/password-reset","x06-password-reset"],["/password-reset/confirm","x16-password-reset-confirm"],
  ["/auth/error","x11-auth-error"],["/auth/error?reason=otp_expired","x11-auth-error-otp"],
  ["/auth/verify-email?email=student%40audit.local","x12-verify-email"],
  ["/terms","x13-terms"],["/privacy","x14-privacy"],
  ["/auth/callback-fragment","x17-callback-fragment"],
];
for (const [r,s] of PUBLIC) results.public.push(await capture(pubCtx, r, s, "1280"));
await pubCtx.close();

// PROTECTED (authed), desktop
const authCtx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json", viewport: { width: 1280, height: 800 } });
const PROT = [
  ["/dashboard","b01-dashboard"],["/practice/recommendations","c01-recommendations"],
  ["/practice/problems","c02-problem-list"],["/practice/next","r02-next"],
  ["/practice/weakness","x07-weakness"],
  ["/writing/short-answer-writing-51","d01-writing-51"],["/writing/answer-writing-52","d02-writing-52"],
  ["/writing/long-form-writing-53","d03-writing-53"],["/writing/essay-writing-54","d04-writing-54"],
  [`/writing/feedback/short/${shortId}`,"e01-short-feedback"],
  [`/writing/feedback/long/${longId}`,"e02-long-feedback"],
  [`/writing/reports/${reportId}/compare`,"r01-compare"],
  ["/library","f01-library"],["/growth","x02-growth"],["/profile","x05-profile"],
  ["/settings/language","g01-language"],["/settings/notifications","x09-notifications"],
  ["/subscription","x04-subscription"],["/paywall","x03-paywall"],
  ["/onboarding/learning-goal","a03-learning-goal"],
  ["/auth/consent","auth-consent"],["/auth/post-auth","auth-post-auth"],
];
for (const [r,s] of PROT) results.protected.push(await capture(authCtx, r, s, "1280"));

// MOBILE 360 subset (responsive spot-check)
const mobCtx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json", viewport: { width: 360, height: 720 } });
const MOB = [["/dashboard","b01-dashboard"],["/practice/problems","c02-problem-list"],["/writing/long-form-writing-53","d03-writing-53"],["/library","f01-library"],["/paywall","x03-paywall"]];
for (const [r,s] of MOB) results.mobile.push(await capture(mobCtx, r, s, "360"));
await mobCtx.close();
await authCtx.close();

// ANON redirect check (no auth) for all 22 protected
const anonCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const ALL_PROT = ["/auth/post-auth","/auth/consent","/dashboard","/growth","/library","/profile","/settings/language","/settings/notifications","/practice/recommendations","/practice/problems","/practice/next","/practice/weakness","/writing/short-answer-writing-51","/writing/answer-writing-52","/writing/long-form-writing-53","/writing/essay-writing-54","/writing/feedback/short/abc-id","/writing/feedback/long/abc-id","/writing/reports/abc-id/compare","/onboarding/learning-goal","/subscription","/paywall"];
for (const r of ALL_PROT) results.anon.push(await anonRedirect(anonCtx, r));
await anonCtx.close();

await browser.close();
await cleanup();

console.log(JSON.stringify(results, null, 1));
