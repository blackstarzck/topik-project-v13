// Seed the DEV-only data fixtures the audit found missing on the cloud dev DB:
//  (1) published writing/reading problems 51-54 (+reading) — mirror supabase/seed.sql fixed UUIDs
//  (2) a learning_goals row for student@audit.local (so /dashboard stops redirecting to onboarding)
// Idempotent (upsert). Read NO secrets to stdout. Service-role; dev/local/staging/preview only.
// Run: node --env-file=.env.local reports/ia-verification/runs/20260601-120308/_seed-dev-fixtures.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const label = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();
const allowed = ["dev", "development", "local", "staging", "preview"];
if (!url || !key) { console.error("MISSING_ENV: url/service-role key not loaded"); process.exit(2); }
if (!allowed.includes(label)) {
  console.error(`REFUSED: SUPABASE_ENV_LABEL='${label}' not in [${allowed.join(",")}] — prod-safety guard.`);
  process.exit(2);
}
console.log(`env=${label} url=${url}`);

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const STUDENT_ID = "4d447f42-7e82-4afd-937c-864b1af92ff7";

const problems = [
  { id: "11111111-1111-1111-1111-111111111111", source: "curated", domain: "writing", question_no: 51, topik_level: 2, difficulty: 2,
    title: "TOPIK 51번 — 안내문 빈칸 쓰기 (예시)",
    prompt: "다음 글의 (㉠)과 (㉡)에 들어갈 알맞은 표현을 쓰십시오.\n\n안녕하십니까. 다음 주 토요일에 한국 문화 체험 행사가 있습니다. 참가하고 싶으신 분은 (㉠). 자세한 사항은 (㉡).",
    materials: null, tags: ["audit_seed", "writing", "51"], publish_status: "published", review_status: "approved", visibility: "public" },
  { id: "22222222-2222-2222-2222-222222222222", source: "curated", domain: "writing", question_no: 52, topik_level: 2, difficulty: 3,
    title: "TOPIK 52번 — 설명문 빈칸 쓰기 (예시)",
    prompt: "다음 글의 (㉠)과 (㉡)에 들어갈 알맞은 표현을 쓰십시오.\n\n사람들은 행복을 위해 노력한다. 행복은 사람마다 다르지만 (㉠). 반대로 (㉡).",
    materials: null, tags: ["audit_seed", "writing", "52"], publish_status: "published", review_status: "approved", visibility: "public" },
  { id: "33333333-3333-3333-3333-333333333333", source: "curated", domain: "writing", question_no: 53, topik_level: 2, difficulty: 4,
    title: "TOPIK 53번 — 도표 분석 (예시)",
    prompt: "다음을 참고하여 '스마트폰 사용 시간 변화'에 대한 글을 200~300자로 쓰십시오.",
    materials: { chart: { type: "bar", data: [{ year: 2018, hours: 2.1 }, { year: 2020, hours: 3.4 }, { year: 2022, hours: 4.2 }, { year: 2024, hours: 4.8 }], options: { y_axis: "일평균 사용 시간 (시간)", x_axis: "연도" } } },
    tags: ["audit_seed", "writing", "53"], publish_status: "published", review_status: "approved", visibility: "public" },
  { id: "44444444-4444-4444-4444-444444444444", source: "curated", domain: "writing", question_no: 54, topik_level: 2, difficulty: 5,
    title: "TOPIK 54번 — 주제 글쓰기 (예시)",
    prompt: "다음을 주제로 자신의 생각을 600~700자로 쓰십시오.\n\n주제: 현대 사회에서 협력의 중요성",
    materials: null, tags: ["audit_seed", "writing", "54"], publish_status: "published", review_status: "approved", visibility: "public" },
  { id: "55555555-5555-5555-5555-555555555555", source: "curated", domain: "reading", question_no: null, topik_level: 2, difficulty: 2,
    title: "TOPIK 읽기 (예시 지문)",
    prompt: "다음 글을 읽고 물음에 답하십시오.\n\n한국의 사계절은 뚜렷한 변화를 보인다. 봄에는 ...",
    materials: null, tags: ["audit_seed", "reading"], publish_status: "published", review_status: "approved", visibility: "public" },
];

const goal = {
  user_id: STUDENT_ID, topik_level: "TOPIK_II", target_grade: 4, exam_date: "2026-09-13",
  weekly_goal_minutes: 180, weak_areas: [], is_active: true,
};

async function upsert(table, rows, onConflict, ignoreDuplicates) {
  const { error } = await admin.from(table).upsert(rows, { onConflict, ignoreDuplicates });
  if (error) { console.error(`${table} upsert FAILED: ${error.message}`); process.exit(1); }
  console.log(`OK ${table}: ${rows.length} row(s) upserted (onConflict=${onConflict}, ignoreDuplicates=${ignoreDuplicates})`);
}

await upsert("problems", problems, "id", true);
await upsert("learning_goals", [goal], "user_id", false);

const { data: pv, error: pe } = await admin.from("problems").select("question_no, publish_status").in("question_no", [51, 52, 53, 54]);
const { data: gv, error: ge } = await admin.from("learning_goals").select("user_id, topik_level, target_grade, is_active").eq("user_id", STUDENT_ID);
if (pe || ge) { console.error("VERIFY query error:", pe?.message ?? ge?.message); process.exit(1); }
console.log(`VERIFY: published writing problems 51-54 present=${(pv ?? []).filter((r) => r.publish_status === "published").length}/4; student learning_goal rows=${(gv ?? []).length}`);
console.log(JSON.stringify({ problems51_54: pv, studentGoal: gv }, null, 2));
console.log("RESULT: DATA_FIXTURES_SEEDED");
process.exit(0);
