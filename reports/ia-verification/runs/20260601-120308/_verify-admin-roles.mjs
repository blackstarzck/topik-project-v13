// One-shot verifier: confirm dev admin role elevation took effect.
// Read-only SELECT on public.profiles via service-role. Prints NO secrets.
// Run: node --env-file=.env.local reports/ia-verification/runs/20260601-120308/_verify-admin-roles.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const label = process.env.SUPABASE_ENV_LABEL ?? "(unset)";
if (!url || !key) {
  console.error("MISSING_ENV: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not loaded");
  process.exit(2);
}
console.log(`env=${label} url=${url}`);

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const expected = {
  "19c87b53-7165-4a1d-8072-d34675cb587b": "content_admin",
  "3bb2a898-4665-4f79-a1a9-6a11ab19b798": "org_admin",
  "1384e5be-d7e6-47f9-bbb7-af3fecb3e6df": "platform_admin",
  "4d447f42-7e82-4afd-937c-864b1af92ff7": "learner",
};

const { data, error } = await admin
  .from("profiles")
  .select("id, app_role")
  .in("id", Object.keys(expected));

if (error) {
  console.error("QUERY_ERROR:", error.message);
  process.exit(1);
}

const byId = Object.fromEntries((data ?? []).map((r) => [r.id, r.app_role]));
let ok = true;
for (const [id, exp] of Object.entries(expected)) {
  const got = byId[id] ?? "<no profile row>";
  const pass = got === exp;
  if (!pass) ok = false;
  console.log(`${pass ? "OK " : "XX "} expect=${exp.padEnd(15)} got=${String(got).padEnd(15)} ${id}`);
}
console.log(ok ? "RESULT: ELEVATION_VERIFIED" : "RESULT: MISMATCH");
process.exit(ok ? 0 : 1);
