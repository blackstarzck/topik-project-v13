// Verify the 5 conformance migrations actually applied on dev (read-only).
// Run: node --env-file=.env.local reports/ia-verification/runs/20260601-120308/_verify-migrations.mjs
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const label = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();
if (!url || !key) { console.error("MISSING_ENV"); process.exit(2); }
console.log(`env=${label} url=${url}\n`);
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let ok = true;
const mark = (cond) => (cond ? "OK " : ((ok = false), "XX "));

// 1) New tables exist (service-role count bypasses RLS).
const tables = ["subscriptions", "subscription_plans", "payment_history", "notification_settings", "notification_log", "organizations", "org_members", "assignments", "assignment_submissions"];
console.log("--- tables ---");
for (const t of tables) {
  const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
  console.log(`${mark(!error)} table ${t.padEnd(24)} ${error ? "MISSING: " + error.message : "count=" + count}`);
}

// 2) subscription_plans seed (expect 3).
const { data: plans, error: pErr } = await db.from("subscription_plans").select("plan_key, price_cents, recommended");
console.log(`\n--- subscription_plans seed ---\n${mark(!pErr && (plans ?? []).length >= 3)} seededPlans=${(plans ?? []).length} ${pErr ? pErr.message : JSON.stringify(plans)}`);

// 3) profiles new columns.
const { error: colErr } = await db.from("profiles").select("id, learning_locale, content_prefs").limit(1);
console.log(`\n--- profiles new columns ---\n${mark(!colErr)} profiles.learning_locale + content_prefs ${colErr ? "MISSING: " + colErr.message : "present"}`);

// 4) New RPCs exist. Calling with service-role (auth.uid()=null) -> our guards raise
//    'unauthenticated'/'forbidden' (proves the function exists). PGRST202 = missing.
const rpcs = [
  ["get_admin_user_stats", {}],
  ["get_admin_org_dashboard", {}],
  ["get_admin_audit_logs", {}],
  ["list_user_problems", {}],
  ["get_admin_users", {}],
];
console.log("\n--- RPCs (exists if NOT PGRST202/'could not find') ---");
for (const [fn, args] of rpcs) {
  const { error } = await db.rpc(fn, args);
  const missing = error && (/PGRST202/i.test(error.code ?? "") || /could not find the function/i.test(error.message ?? ""));
  console.log(`${mark(!missing)} rpc ${fn.padEnd(24)} ${missing ? "MISSING" : error ? "exists (raised: " + error.message.slice(0, 60) + ")" : "exists (returned data)"}`);
}

console.log("\n" + (ok ? "RESULT: MIGRATIONS_VERIFIED" : "RESULT: SOME_MISSING"));
process.exit(ok ? 0 : 1);
