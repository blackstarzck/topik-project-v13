#!/usr/bin/env node
// Read-only dev verification for the retained writing-history repository.
// It impersonates each submission owner only inside one Management SQL
// transaction and reports aggregate counts; user/submission IDs are never
// printed. SUPABASE_PROJECT_REF is required to prevent an implicit target.

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!token || !projectRef) {
  console.error(
    "SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.",
  );
  process.exit(1);
}

const sql = String.raw`
create temporary table writing_history_coverage_result (
  expected_count integer not null,
  actual_count integer not null,
  missing_identity_count integer not null
);

do $verify$
declare
  owner_row record;
  actual_count integer;
begin
  for owner_row in
    select
      submission.user_id,
      array_agg(submission.id order by submission.id) as submission_ids,
      count(*)::integer as expected_count,
      count(*) filter (
        where identity.problem_id is null
      )::integer as missing_identity_count
    from public.writing_submissions submission
    left join private.problem_identities identity
      on identity.problem_id = submission.problem_id
     and identity.domain = 'writing'
    group by submission.user_id
  loop
    perform set_config(
      'request.jwt.claim.sub',
      owner_row.user_id::text,
      true
    );
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', owner_row.user_id::text, 'role', 'authenticated')::text,
      true
    );
    select count(*)::integer
      into actual_count
      from public.get_writing_submission_history_context(
        owner_row.submission_ids
      );
    insert into writing_history_coverage_result(
      expected_count,
      actual_count,
      missing_identity_count
    ) values (
      owner_row.expected_count,
      actual_count,
      owner_row.missing_identity_count
    );
  end loop;
end
$verify$;

select
  coalesce(sum(expected_count), 0)::integer as expected_count,
  coalesce(sum(actual_count), 0)::integer as actual_count,
  coalesce(sum(missing_identity_count), 0)::integer as missing_identity_count,
  count(*) filter (where expected_count <> actual_count)::integer as mismatched_owner_count
from writing_history_coverage_result;
`;

const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);
const text = await response.text();
if (!response.ok) {
  const safeDetail = text
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      "[uuid]",
    )
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .slice(0, 800);
  console.error(
    `History coverage query failed (HTTP ${response.status}): ${safeDetail}`,
  );
  process.exit(1);
}

const rows = JSON.parse(text);
const result = Array.isArray(rows) ? rows[0] : null;
const expected = Number(result?.expected_count ?? -1);
const actual = Number(result?.actual_count ?? -1);
const mismatchedOwners = Number(result?.mismatched_owner_count ?? -1);
const missingIdentities = Number(result?.missing_identity_count ?? -1);
if (
  expected < 0 ||
  actual !== expected ||
  mismatchedOwners !== 0 ||
  missingIdentities !== 0
) {
  console.error(
    `Writing history coverage failed: expected=${expected}, actual=${actual}, mismatchedOwners=${mismatchedOwners}, missingIdentities=${missingIdentities}`,
  );
  process.exit(1);
}

console.log(
  `Writing history coverage passed: ${actual}/${expected}, mismatchedOwners=0, missingIdentities=0`,
);
