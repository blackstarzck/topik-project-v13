# Institution Question Exposure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기관 코드별 TOPIK 쓰기 문항 노출 정책을 v13 사용자 앱의 모든 writing problem 노출 경로에 동일하게 적용한다.

**Architecture:** DB에 기관 노출 공통 predicate를 만들고, 목록/직접 진입/추천/약점/성장/제출 guard가 같은 predicate를 사용하게 한다. `problems` row 자체를 archive/unarchive하지 않고, read time에 `profiles.affiliation_code`와 `topik_writing_question_institution_exposure` 매핑을 비교한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase Postgres/RPC/RLS, Vitest, Playwright.

## Execution Status (2026-06-26)

- Implemented the DB predicate/RPC migration and wired it into `list_user_problems`, direct writing entry, next-problem, weakness, recommendation, and submit-guard paths.
- Moved the recommendations data path from browser Supabase joins to an authenticated server API route.
- Addressed code-review findings: private owner-aware helpers are service-role only; batch filtering is restricted to writing problems; recommendation/run summary avoids leaking hidden-run free text; candidate scans page past hidden rows before deciding there are no visible results.
- Test coverage was added through SQL contract tests, server helper tests, route/data tests, existing E2E fixture updates, and a `SUPABASE_LOCAL_STACK=1` gated integration test. A separate new Playwright file was not added; existing route E2E files were extended instead.
- Verification run after implementation: focused Vitest passed, `pnpm typecheck` passed, `pnpm lint` passed with existing warnings only, `git diff --check` passed, Prettier check passed, and targeted Playwright passed with one retry-only flaky `/practice/next` SSR context error.

---

## Source Context

- Primary handoff: `docs/todo/v13-institution-question-exposure-handoff-2026-06-26.md`
- Project rules: `AGENTS.md`, `README.md`, `TESTING.md`, `package.json`
- Current worktree: `C:\Users\admin\Desktop\workspace\topik-project\v13-dev`
- Current branch at planning time: `codex/dev`
- Parallel agents consulted:
  - DB/RPC explorer: migration helper, `list_user_problems`, submit guard, `materials.question_id` risk
  - App explorer: writing direct route, practice routes, recommendations client join
  - Test engineer: SQL contract tests, Supabase local gated tests, route-focused E2E

## Scope Decisions

- Implement in `v13-dev`, not `C:\Users\admin\Desktop\workspace\topik-project\v13`.
- Do not add admin UI, admin workflows, or institution catalog validation in v13.
- Treat `profiles.affiliation_code` as opaque text. Apply `btrim`; keep case-sensitive matching unless product explicitly changes the contract.
- For synced writing problems, `materials->>'question_id'` is required for institution visibility. Legacy rows without `question_id` should not become user-facing writing candidates unless fixtures are updated to include a test question id.
- Existing submissions, library history, and feedback history are not deleted. New entry and new submission are blocked when the problem is hidden by institution predicate.
- `recommendation_items` cleanup is out of scope; existing hidden recommendation rows are filtered at read time.

## File Structure

### Create

- `supabase/migrations/20260626110000_writing_institution_visibility_predicate.sql`
  - Defines `public.is_writing_problem_visible_to_caller(uuid, smallint)`.
  - Defines `public.filter_visible_writing_problem_ids(uuid[])`.
  - Redefines latest `public.list_user_problems(...)` with institution predicate in the `visible` CTE.
  - Redefines `private.assert_writing_problem_submittable(...)` with the same predicate.
- `src/lib/problems/visibility.ts`
  - Server-side typed helpers around the new visibility RPCs.
- `src/lib/practice/recommendations.ts`
  - Server-only recommendation bundle query using server Supabase client and visibility helper.
- `src/app/api/practice/recommendations/route.ts`
  - Authenticated API route for recommendation tab changes.
- `tests/lib/supabase/institution-writing-exposure-migration.test.ts`
  - SQL contract tests for helper, list RPC, and submit guard.
- `tests/integration/institution-writing-exposure.test.ts`
  - `SUPABASE_LOCAL_STACK=1` gated DB/RPC behavior tests.
- `tests/e2e/flows/institution-writing-exposure.spec.ts`
  - Route-focused E2E covering list, next, recommendations, weakness, growth, and direct writing access.

### Modify

- `supabase/migrations/INDEX.md`
  - Add the new migration row.
- `src/lib/supabase/types.ts`
  - Add `is_writing_problem_visible_to_caller` and `filter_visible_writing_problem_ids` function entries.
- `src/lib/writing/server.ts`
  - Filter `getWritingProblem` candidates through the visibility helper.
- `src/lib/practice/next.ts`
  - Filter recommendation rows and fallback candidates through the visibility helper.
- `src/lib/practice/weakness.ts`
  - Filter recommendation rows and tag fallback candidates through the visibility helper.
- `src/components/practice/recommendations-data.ts`
  - Replace browser Supabase joins with `fetch("/api/practice/recommendations?...")`.
- `src/components/practice/RecommendationsView.tsx`
  - Keep current rendering, consume the same hook result shape.
- `tests/lib/writing/server.test.ts`
  - Cover hidden explicit direct problem access.
- `tests/lib/practice/next.test.ts`
  - Cover hidden recommendation and fallback candidates.
- `tests/lib/practice/weakness.test.ts`
  - Cover hidden recommendation and tag fallback candidates.
- `tests/components/practice/recommendations-data.test.ts`
  - Cover API fetch behavior and timeout behavior after the data layer changes.
- Existing E2E fixtures that insert writing problems
  - Add `materials.question_id` to synthetic writing problem rows so fixtures remain publicly visible unless intentionally hidden by exposure mapping.

---

## Task 1: Lock SQL Contract Tests

**Files:**
- Create: `tests/lib/supabase/institution-writing-exposure-migration.test.ts`
- Modify: `tests/lib/supabase/submit-writing-rpc.test.ts`
- Modify: `tests/lib/supabase/list-user-problems-sort-migration.test.ts`

- [ ] **Step 1: Add a migration contract test for the new helper**

Create `tests/lib/supabase/institution-writing-exposure-migration.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");

function readMigrations() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
    .join("\n");
}

function normalizedSql() {
  return readMigrations().replace(/\s+/g, " ").toLowerCase();
}

describe("institution writing exposure migration contract", () => {
  it("defines a security-definer caller visibility predicate", () => {
    const sql = normalizedSql();

    expect(sql).toContain(
      "create or replace function public.is_writing_problem_visible_to_caller",
    );
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog, public");
    expect(sql).toContain("caller_id uuid := auth.uid()");
    expect(sql).toContain("profiles");
    expect(sql).toContain("affiliation_code");
    expect(sql).toContain("materials->>'question_id'");
    expect(sql).toContain("topik_writing_question_institution_exposure");
    expect(sql).toContain("e.institution_code = caller_code");
    expect(sql).toContain("e.item_number = p_question_no");
  });

  it("exposes a batch filter for server recommendation paths", () => {
    const sql = normalizedSql();

    expect(sql).toContain(
      "create or replace function public.filter_visible_writing_problem_ids",
    );
    expect(sql).toContain("p.id = any(p_problem_ids)");
    expect(sql).toContain(
      "public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
    );
    expect(sql).toContain(
      "grant execute on function public.filter_visible_writing_problem_ids(uuid[]) to authenticated",
    );
  });

  it("uses the institution predicate from list and submit guards", () => {
    const sql = normalizedSql();

    expect(sql).toContain(
      "or public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
    );
    expect(sql).toContain(
      "and public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
    );
  });
});
```

- [ ] **Step 2: Strengthen existing SQL tests**

In `tests/lib/supabase/submit-writing-rpc.test.ts`, add:

```ts
expect(normalized).toContain(
  "and public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
);
```

In `tests/lib/supabase/list-user-problems-sort-migration.test.ts`, add:

```ts
expect(normalized).toContain(
  "public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
);
```

- [ ] **Step 3: Run the SQL contract tests and confirm failure**

Run:

```powershell
pnpm vitest run tests/lib/supabase/institution-writing-exposure-migration.test.ts tests/lib/supabase/submit-writing-rpc.test.ts tests/lib/supabase/list-user-problems-sort-migration.test.ts
```

Expected: FAIL because the helper migration does not exist yet.

---

## Task 2: Add DB Predicate Migration

**Files:**
- Create: `supabase/migrations/20260626110000_writing_institution_visibility_predicate.sql`
- Modify: `supabase/migrations/INDEX.md`
- Modify: `src/lib/supabase/types.ts`
- Test: `tests/lib/supabase/institution-writing-exposure-migration.test.ts`

- [ ] **Step 1: Add the visibility helper and batch filter**

Create `supabase/migrations/20260626110000_writing_institution_visibility_predicate.sql` with these first sections:

```sql
-- =====================================================================
-- Institution-scoped writing problem visibility.
--
-- Contract:
-- - No exposure mapping rows for a question => public to all authenticated users.
-- - One or more mapping rows => visible only when profiles.affiliation_code
--   matches one of the mapped institution codes.
-- - This is a read-time visibility layer over service_status/publish/lifecycle;
--   it must not archive or unarchive public.problems rows.
-- =====================================================================

create or replace function public.is_writing_problem_visible_to_caller(
  p_problem_id uuid,
  p_question_no smallint
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  caller_id uuid := auth.uid();
  caller_code text;
  v_question_id text;
begin
  if caller_id is null then
    return false;
  end if;

  select nullif(btrim(affiliation_code), '')
    into caller_code
    from public.profiles
   where id = caller_id;

  select nullif(p.materials->>'question_id', '')
    into v_question_id
    from public.problems p
   where p.id = p_problem_id
     and p.domain = 'writing'
     and p.question_no = p_question_no;

  if v_question_id is null then
    return false;
  end if;

  return not exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = v_question_id
       and e.item_number = p_question_no
  )
  or exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = v_question_id
       and e.item_number = p_question_no
       and e.institution_code = caller_code
  );
end;
$$;

revoke all on function public.is_writing_problem_visible_to_caller(uuid, smallint) from public;
grant execute on function public.is_writing_problem_visible_to_caller(uuid, smallint) to authenticated;

comment on function public.is_writing_problem_visible_to_caller(uuid, smallint) is
  'Returns whether auth.uid() may see a writing problem under institution exposure rules. Mapping absence means public; mapping presence means profiles.affiliation_code must match. Requires problems.materials.question_id. 2026-06-26.';

create or replace function public.filter_visible_writing_problem_ids(
  p_problem_ids uuid[]
)
returns table (problem_id uuid)
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select p.id
    from public.problems p
   where p.id = any(coalesce(p_problem_ids, array[]::uuid[]))
     and (
       p.domain <> 'writing'
       or public.is_writing_problem_visible_to_caller(p.id, p.question_no)
     );
$$;

revoke all on function public.filter_visible_writing_problem_ids(uuid[]) from public;
grant execute on function public.filter_visible_writing_problem_ids(uuid[]) to authenticated;

comment on function public.filter_visible_writing_problem_ids(uuid[]) is
  'Batch filters problem ids through institution-scoped writing visibility for server-side recommendation and direct-entry paths. 2026-06-26.';
```

- [ ] **Step 2: Redefine latest `public.list_user_problems` in the new migration**

Copy the latest definition from `supabase/migrations/20260625185000_stabilize_user_problem_sort.sql` into the new migration, then add this condition inside the `visible` CTE after the existing `publish_status = 'published'` line:

```sql
      and (
        p.domain <> 'writing'
        or public.is_writing_problem_visible_to_caller(p.id, p.question_no)
      )
```

Keep the existing signature, return shape, sort logic, grants, and comment. Update the comment to mention institution exposure:

```sql
comment on function public.list_user_problems(jsonb, text, int, int) is
  'C-02 writing-aware filtered pagination with recommended-only filtering, exact UI sort semantics, stable tie ordering, and institution writing exposure filtering.';
```

- [ ] **Step 3: Redefine submit guard in the new migration**

Add a full `create or replace function private.assert_writing_problem_submittable(...)` definition matching the current guard, with the predicate appended:

```sql
       and p.lifecycle_status = 'active'
       and public.is_writing_problem_visible_to_caller(p.id, p.question_no)
```

Update the guard comment:

```sql
comment on function private.assert_writing_problem_submittable(uuid, smallint) is
  'Rejects writing submissions for hidden, unpublished, inactive, non-writing, question-number-mismatched, or institution-hidden problems.';
```

- [ ] **Step 4: Update `supabase/migrations/INDEX.md`**

Add a new row after the current latest 2026-06 migration:

```md
| NN | `11:00:00` | [`20260626110000_writing_institution_visibility_predicate.sql`](./20260626110000_writing_institution_visibility_predicate.sql) | Adds institution-scoped writing problem visibility helpers and applies them to `list_user_problems` and `private.assert_writing_problem_submittable` so mapping absence remains public and mapping presence requires matching `profiles.affiliation_code`. |
```

Use the next numeric sequence value already present in the file.

- [ ] **Step 5: Update Supabase type mirror**

In `src/lib/supabase/types.ts`, add under `Database["public"]["Functions"]`:

```ts
      filter_visible_writing_problem_ids: {
        Args: {
          p_problem_ids: string[];
        };
        Returns: {
          problem_id: string;
        }[];
      };
      is_writing_problem_visible_to_caller: {
        Args: {
          p_problem_id: string;
          p_question_no: number;
        };
        Returns: boolean;
      };
```

- [ ] **Step 6: Run SQL contract tests and confirm pass**

Run:

```powershell
pnpm vitest run tests/lib/supabase/institution-writing-exposure-migration.test.ts tests/lib/supabase/submit-writing-rpc.test.ts tests/lib/supabase/list-user-problems-sort-migration.test.ts
```

Expected: PASS.

---

## Task 3: Add Server Visibility Helpers

**Files:**
- Create: `src/lib/problems/visibility.ts`
- Test: reuse tests added in Tasks 4-6

- [ ] **Step 1: Create a shared helper for server-side candidate filtering**

Create `src/lib/problems/visibility.ts`:

```ts
// NOTE: server-only by convention. This file wraps DB visibility RPCs and
// should only be used from RSC, route handlers, server actions, or server libs.
import type { SupabaseServerClient } from "../supabase/server";

export async function filterVisibleProblemIds(
  supabase: SupabaseServerClient,
  problemIds: readonly string[],
): Promise<Set<string>> {
  const uniqueIds = [...new Set(problemIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Set();

  const { data, error } = await supabase.rpc("filter_visible_writing_problem_ids", {
    p_problem_ids: uniqueIds,
  });

  if (error) {
    throw new Error(`filterVisibleProblemIds: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.problem_id));
}
```

- [ ] **Step 2: Add a direct boolean helper only if code needs it**

If a direct boolean call is simpler for an explicit single problem path, add this to the same file:

```ts
export async function isWritingProblemVisibleToCaller(
  supabase: SupabaseServerClient,
  problemId: string,
  questionNo: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "is_writing_problem_visible_to_caller",
    {
      p_problem_id: problemId,
      p_question_no: questionNo,
    },
  );

  if (error) {
    throw new Error(`isWritingProblemVisibleToCaller: ${error.message}`);
  }

  return data === true;
}
```

Use `filterVisibleProblemIds` for multi-candidate code paths to avoid one RPC call per candidate.

---

## Task 4: Block Direct Writing Entry

**Files:**
- Modify: `src/lib/writing/server.ts`
- Test: `tests/lib/writing/server.test.ts`

- [ ] **Step 1: Write failing test for explicit hidden direct access**

Extend `tests/lib/writing/server.test.ts` with a client stub that supports `rpc("filter_visible_writing_problem_ids")`. Add this test:

```ts
it("returns null for an explicit problem id hidden by institution visibility", async () => {
  const { client } = makeClient([complete51]);
  const hiddenClient = {
    ...client,
    rpc: async () => ({ data: [], error: null }),
  };

  const problem = await getWritingProblem(
    51,
    COMPLETE_51_ID,
    async () => hiddenClient as never,
  );

  expect(problem).toBeNull();
});
```

Also update the existing `makeClient` return object to include a default RPC implementation:

```ts
rpc: async () => ({
  data: rows.map((row) => ({ problem_id: row.id })),
  error: null,
}),
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```powershell
pnpm vitest run tests/lib/writing/server.test.ts
```

Expected: FAIL until `getWritingProblem` applies the visibility helper.

- [ ] **Step 3: Filter `getWritingProblem` candidates**

In `src/lib/writing/server.ts`, import:

```ts
import { filterVisibleProblemIds } from "../problems/visibility";
```

After fetching `data`, before `normalizeWritingProblemRow`, replace the current `problems` derivation with:

```ts
  const nonSeedRows = (data ?? []).filter((row) => !isSeedFixtureProblem(row));
  const visibleIds = await filterVisibleProblemIds(
    supabase,
    nonSeedRows.map((row) => row.id),
  );
  const problems = nonSeedRows
    .filter((row) => visibleIds.has(row.id))
    .map((row) => normalizeWritingProblemRow(row, questionNo));
```

- [ ] **Step 4: Run test and confirm pass**

Run:

```powershell
pnpm vitest run tests/lib/writing/server.test.ts
```

Expected: PASS.

---

## Task 5: Filter Next Problem Recommendations and Fallbacks

**Files:**
- Modify: `src/lib/practice/next.ts`
- Test: `tests/lib/practice/next.test.ts`

- [ ] **Step 1: Extend next-problem mock client with visibility RPC**

In `tests/lib/practice/next.test.ts`, extend `makeClient` options:

```ts
  visibleProblemIds?: string[];
```

Add a `rpc` method to the mock client:

```ts
    rpc(name: string, args: { p_problem_ids?: string[] }) {
      if (name !== "filter_visible_writing_problem_ids") {
        throw new Error(`unexpected rpc ${name}`);
      }
      const allowed = new Set(opts.visibleProblemIds ?? args.p_problem_ids ?? []);
      return Promise.resolve({
        data: (args.p_problem_ids ?? [])
          .filter((id) => allowed.has(id))
          .map((id) => ({ problem_id: id })),
        error: null,
      });
    },
```

- [ ] **Step 2: Add tests for hidden candidates**

Add a tier 1 test:

```ts
it("tier 1: skips a recommendation hidden by institution visibility", async () => {
  const recItems: RecItem[] = [
    {
      id: "rec-hidden",
      problem_id: "p-hidden",
      rank: 1,
      reason: "hidden should not show",
      recommendation_runs: { expires_at: null },
      problems: {
        id: "p-hidden",
        title: "Hidden",
        domain: "writing",
        question_no: 53,
        publish_status: "published",
      },
    },
    {
      id: "rec-visible",
      problem_id: "p-visible",
      rank: 2,
      reason: "visible backup",
      recommendation_runs: { expires_at: null },
      problems: {
        id: "p-visible",
        title: "Visible",
        domain: "writing",
        question_no: 52,
        publish_status: "published",
      },
    },
  ];
  const create = async () =>
    makeClient({
      recItems,
      attempts: [],
      problemsAny: [],
      visibleProblemIds: ["p-visible"],
    }) as never;

  const out = await getNextProblem("user-1", create);

  expect(out?.problemId).toBe("p-visible");
});
```

Add a fallback test:

```ts
it("tier 3: skips random fallback problems hidden by institution visibility", async () => {
  const create = async () =>
    makeClient({
      recItems: [],
      attempts: [],
      problemsAny: [
        { id: "p-hidden", title: "Hidden", domain: "writing", question_no: 51 },
        { id: "p-visible", title: "Visible", domain: "writing", question_no: 52 },
      ],
      visibleProblemIds: ["p-visible"],
    }) as never;

  const out = await getNextProblem("user-1", create);

  expect(out?.problemId).toBe("p-visible");
});
```

- [ ] **Step 3: Update `next.ts`**

Import:

```ts
import { filterVisibleProblemIds } from "../problems/visibility";
```

For recommendation rows, collect candidate ids and visible ids before returning:

```ts
  const recProblems = validRecRows
    .map((row) => pickOne(row.problems))
    .filter((problem): problem is ProblemSlice & {
      publish_status: string;
      difficulty: number | null;
    } => Boolean(problem));
  const visibleRecIds = await filterVisibleProblemIds(
    supabase,
    recProblems.map((problem) => problem.id),
  );
```

Then require `visibleRecIds.has(problem.id)` inside the existing tier 1 loop.

In `pickProblemExcluding` and `fetchPublishedProblemAlternatives`, after filtering attempted/excluded ids, call `filterVisibleProblemIds` and keep only visible candidates.

- [ ] **Step 4: Run next tests**

Run:

```powershell
pnpm vitest run tests/lib/practice/next.test.ts
```

Expected: PASS.

---

## Task 6: Filter Weakness and Growth Recommendations

**Files:**
- Modify: `src/lib/practice/weakness.ts`
- Test: `tests/lib/practice/weakness.test.ts`

- [ ] **Step 1: Extend weakness mock client with visibility RPC**

In `tests/lib/practice/weakness.test.ts`, add `visibleProblemIds?: string[]` to `makeClient` options and add the same `rpc("filter_visible_writing_problem_ids")` mock shape used in Task 5.

- [ ] **Step 2: Add hidden recommendation tests**

Add:

```ts
it("skips recommendation_items hidden by institution visibility", async () => {
  const recItems: RecItem[] = [
    makeItem("i-hidden", "p-hidden", 1),
    makeItem("i-visible", "p-visible", 2),
  ];
  const create = async () =>
    makeClient({ recItems, visibleProblemIds: ["p-visible"] }) as never;

  const out = await getWeaknessRecommendations("user-1", create);

  expect(out.map((item) => item.problemId)).toEqual(["p-visible"]);
});
```

Add:

```ts
it("skips tag fallback problems hidden by institution visibility", async () => {
  const feedback: FeedbackRow[] = [
    ...row("vocab", [40, 40, 40, 40, 40]),
    ...row("content", [50, 50, 50, 50, 50]),
    ...row("grammar", [90, 90, 90, 90, 90]),
  ];
  const problems: ProblemRow[] = [
    { id: "p-hidden", title: "Hidden", domain: "writing", question_no: 53 },
    { id: "p-visible", title: "Visible", domain: "writing", question_no: 54 },
  ];
  const create = async () =>
    makeClient({
      recItems: [],
      feedback,
      problems,
      visibleProblemIds: ["p-visible"],
    }) as never;

  const out = await getWeaknessRecommendations("user-1", create);

  expect(out.map((item) => item.problemId)).toEqual(["p-visible"]);
});
```

- [ ] **Step 3: Update `weakness.ts`**

Import:

```ts
import { filterVisibleProblemIds } from "../problems/visibility";
```

After building candidate recommendation rows, call `filterVisibleProblemIds` on joined problem ids and require the set before pushing `fromItems`.

For tag fallback, call `filterVisibleProblemIds` on `probData` ids before mapping response rows.

- [ ] **Step 4: Run weakness tests**

Run:

```powershell
pnpm vitest run tests/lib/practice/weakness.test.ts
```

Expected: PASS. `/growth` inherits this fix because `src/app/(workspace)/growth/page.tsx` uses `getWeaknessRecommendations`.

---

## Task 7: Move Recommendations Data to Server API

**Files:**
- Create: `src/lib/practice/recommendations.ts`
- Create: `src/app/api/practice/recommendations/route.ts`
- Modify: `src/components/practice/recommendations-data.ts`
- Modify: `tests/components/practice/recommendations-data.test.ts`

- [ ] **Step 1: Create server query module**

Move the current `queryRecommendationBundle` logic from `src/components/practice/recommendations-data.ts` into `src/lib/practice/recommendations.ts`, but use `createSupabaseServerClient` and `filterVisibleProblemIds`.

The exported function shape:

```ts
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import { filterVisibleProblemIds } from "../problems/visibility";
import { QUESTION_NOS, type QuestionNo } from "./types";

export type RecommendationRunSummary = {
  reasonSummary: string | null;
  sourceType: string;
  createdAt: string;
};

export type RecommendationItemCard = {
  itemId: string;
  problemId: string;
  rank: number;
  reason: string | null;
  estimatedMinutes: number | null;
  weaknessTags: string[];
  title: string;
  questionNo: QuestionNo | null;
};

export type RecommendationBundle = {
  run: RecommendationRunSummary | null;
  items: RecommendationItemCard[];
  availableTypes: QuestionNo[];
};

export async function queryRecommendationBundleForUser(
  userId: string,
  questionNo: QuestionNo | null,
  createClient = createSupabaseServerClient,
): Promise<RecommendationBundle> {
  const supabase = await createClient();
  // Keep the same recommendation_runs and recommendation_items queries, scoped
  // by userId and active status. After rows are loaded, filter joined problem ids
  // through filterVisibleProblemIds before building items and availableTypes.
}
```

Implementation detail: return `availableTypes` as `QuestionNo[]`, not `Set<QuestionNo>`, because the API route must serialize JSON.

- [ ] **Step 2: Add API route**

Create `src/app/api/practice/recommendations/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  queryRecommendationBundleForUser,
} from "@/lib/practice/recommendations";
import { isValidQuestionNo } from "@/lib/practice/types";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawType = url.searchParams.get("type");
  const parsedType = rawType == null ? null : Number(rawType);
  const questionNo =
    parsedType != null && isValidQuestionNo(parsedType) ? parsedType : null;

  const bundle = await queryRecommendationBundleForUser(user.id, questionNo);
  return NextResponse.json(bundle);
}
```

- [ ] **Step 3: Replace browser Supabase query with route fetch**

In `src/components/practice/recommendations-data.ts`, remove `createSupabaseBrowserClient` usage. Keep exported types and hook, and implement:

```ts
async function queryRecommendationBundle(
  questionNo: QuestionNo | null,
): Promise<RecommendationBundle> {
  const search = questionNo == null ? "" : `?type=${questionNo}`;
  const response = await fetch(`/api/practice/recommendations${search}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`recommendations_request_failed:${response.status}`);
  }
  const raw = (await response.json()) as Omit<
    RecommendationBundle,
    "availableTypes"
  > & { availableTypes: QuestionNo[] };
  return {
    ...raw,
    availableTypes: new Set(raw.availableTypes),
  };
}
```

Preserve `withTimeout`, `fetchRecommendationBundle`, `recommendationBundleKey`, and `useRecommendationBundle`.

- [ ] **Step 4: Update recommendation data tests**

Update `tests/components/practice/recommendations-data.test.ts` to mock `global.fetch` instead of a Supabase browser client. Keep timeout coverage by passing a never-resolving fetch promise. Add a success test:

```ts
it("loads the bundle through the server API route", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      run: null,
      items: [],
      availableTypes: [51, 52],
    }),
  }));
  vi.stubGlobal("fetch", fetchMock);

  const bundle = await fetchRecommendationBundle(51, 50);

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/practice/recommendations?type=51",
    { credentials: "same-origin" },
  );
  expect([...bundle.availableTypes]).toEqual([51, 52]);
});
```

- [ ] **Step 5: Run recommendation tests**

Run:

```powershell
pnpm vitest run tests/components/practice/recommendations-data.test.ts
```

Expected: PASS.

---

## Task 8: Add Real DB/RPC Integration Coverage

**Files:**
- Create: `tests/integration/institution-writing-exposure.test.ts`
- Modify: `TESTING.md` only if a new gated test command is added. Prefer using the existing `SUPABASE_LOCAL_STACK=1` pattern without changing docs in this task.

- [ ] **Step 1: Add a `SUPABASE_LOCAL_STACK` gated integration test**

Create `tests/integration/institution-writing-exposure.test.ts` using the existing local stack convention from `tests/integration/rls-smoke.test.ts`.

Test data matrix:

```ts
const publicQuestionId = "public-q51";
const kwonQuestionId = "kwon-q51";
const luQuestionId = "lu-q51";
```

Insert three `problems` rows with `materials: { question_id: ... }` and three profiles:

```ts
const users = {
  general: { id: randomUUID(), affiliation_code: null },
  kwon: { id: randomUUID(), affiliation_code: "PROFESSOR-KWON" },
  lu: { id: randomUUID(), affiliation_code: "PROFESSOR-LU" },
};
```

Create exposure rows:

```ts
[
  { question_id: kwonQuestionId, item_number: 51, institution_code: "PROFESSOR-KWON" },
  { question_id: luQuestionId, item_number: 51, institution_code: "PROFESSOR-LU" },
]
```

For each auth user context, assert:

- general sees only public.
- Kwon sees public and Kwon.
- Lu sees public and Lu.
- `list_user_problems` `total_count` matches visible count.
- hidden submit through `submit_writing_with_feedback` fails with `problem_not_submittable`.

- [ ] **Step 2: Account for admin exposure table availability**

If local v13 migrations do not create `topik_writing_question_institution_exposure`, do not add admin table DDL to v13 migrations. Instead, make the integration test create the table in setup and drop it in teardown using a service-role SQL path if one exists in the test harness. If no SQL execution path exists, keep this test gated and document in the test skip message that it requires the topik-ai admin exposure migration to be applied to the local stack.

- [ ] **Step 3: Run the integration test when local stack is available**

Run:

```powershell
$env:SUPABASE_LOCAL_STACK='1'; pnpm vitest run tests/integration/institution-writing-exposure.test.ts
```

Expected: PASS on a local stack that includes the admin exposure table.

---

## Task 9: Add Route-Focused E2E Coverage

**Files:**
- Create: `tests/e2e/flows/institution-writing-exposure.spec.ts`
- Modify existing E2E fixtures that insert writing `problems` without `materials.question_id`

- [ ] **Step 1: Create institution exposure E2E fixtures**

Follow patterns from:

- `tests/e2e/flows/problem-list-regressions.spec.ts`
- `tests/e2e/screens/next-problem.spec.ts`
- `tests/e2e/screens/hidden-writing-problem-availability.spec.ts`

Fixture rules:

- Use `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`.
- Skip when credentials are missing.
- Skip when `SUPABASE_ENV_LABEL` is `prod` or `production`.
- Insert public, Kwon-only, and Lu-only writing problems.
- Every inserted writing problem must include `materials.question_id`.
- Insert recommendation rows pointing to each problem.
- Clean up recommendation rows, submissions, exposure rows, and problems in `afterEach`/`afterAll`.

- [ ] **Step 2: Assert route behavior**

In one desktop project run, assert:

- `/practice/problems` does not show another institution's problem.
- `/practice/next` does not show another institution's problem.
- `/practice/recommendations` does not show another institution's problem.
- `/practice/weakness` and `/growth` do not show another institution's problem.
- Direct `/writing/...?...problem=<hidden-id>` shows the existing not-found/unavailable UI, not the writing editor.

- [ ] **Step 3: Run focused E2E**

Run:

```powershell
pnpm exec playwright test tests/e2e/flows/institution-writing-exposure.spec.ts --project=desktop-1280
```

If the route layout or touch behavior changes during implementation, also run:

```powershell
pnpm exec playwright test tests/e2e/flows/institution-writing-exposure.spec.ts --project=mobile-360
```

---

## Task 10: Final Verification

**Files:** all modified files.

- [ ] **Step 1: Run focused Vitest suite**

Run:

```powershell
pnpm vitest run tests/lib/supabase/institution-writing-exposure-migration.test.ts tests/lib/supabase/submit-writing-rpc.test.ts tests/lib/supabase/list-user-problems-sort-migration.test.ts tests/lib/writing/server.test.ts tests/lib/practice/next.test.ts tests/lib/practice/weakness.test.ts tests/components/practice/recommendations-data.test.ts tests/components/practice/problem-list-data.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint and typecheck**

Run:

```powershell
pnpm lint
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run DB/RPC integration when environment is available**

Run:

```powershell
$env:SUPABASE_LOCAL_STACK='1'; pnpm vitest run tests/integration/institution-writing-exposure.test.ts
```

Expected: PASS, or SKIP with explicit message that the local stack lacks the admin exposure migration/table.

- [ ] **Step 4: Run focused E2E**

Run:

```powershell
pnpm exec playwright test tests/e2e/flows/institution-writing-exposure.spec.ts --project=desktop-1280
```

Expected: PASS.

- [ ] **Step 5: Inspect diff**

Run:

```powershell
git diff --stat
git diff --check
```

Expected: no whitespace errors, no unrelated files.

## Critic Review Incorporated

- Lists alone are insufficient; direct writing URL and submit RPC are final defenses.
- Client-side recommendation joins are insufficient; route/API must use server Supabase and DB predicate.
- Existing `recommendation_items` may point at hidden rows; read-time filtering is mandatory.
- `materials.question_id` missing rows are dangerous; tests and fixtures must include explicit `question_id` or expect hidden behavior.
- `item_number = question_no` must be part of exposure checks to avoid cross-type leakage.
- DB/RPC tests are more important than broad UI snapshots because the policy boundary lives in Postgres.

## Verification Scope Rationale

- Full `pnpm test:e2e` is not required for the first implementation pass because the change targets writing problem visibility routes, not app shell, auth middleware, global theme, or navigation contracts.
- Focused E2E plus SQL/RPC contract tests provide better proof for this change.
- If the recommendations data refactor changes visible loading/error states, add `tests/e2e/screens/recommendations-empty.spec.ts` to the focused E2E run.
