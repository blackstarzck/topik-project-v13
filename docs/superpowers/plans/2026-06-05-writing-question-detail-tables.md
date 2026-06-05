# Writing Question Detail Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align writing pages 51, 52, 53, and 54 so each question type has a concrete Supabase data contract while preserving the existing user-facing writing flow.

**Architecture:** Keep `problems` as the common parent table because submissions, drafts, feedback, problem lists, and recommendations already depend on `problem_id`. Add one 1:1 detail table per writing type, plus normalized answer/material tables where the screen data needs row-level consistency. Keep `problems.materials`, `answer_key`, and `rubric` only as temporary projection/fallback fields until the app loader is migrated.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Supabase Postgres, SQL migrations, Supabase MCP or Supabase CLI.

---

## Final Decision

Use this structure:

| Layer | Decision |
| --- | --- |
| Common parent | Keep `public.problems` |
| 51 detail | Add `public.writing_problem_51_details` and `public.writing_problem_51_answers` |
| 52 detail | Add `public.writing_problem_52_details` and `public.writing_problem_52_answers` |
| 53 detail | Add `public.writing_problem_53_details`, chart tables, and table-data tables |
| 54 detail | Add `public.writing_problem_54_details` |
| User answers | Keep `writing_drafts`, `writing_submissions`, and feedback tables |
| JSONB-only plan | Rejected |
| Fully separate `writing_51_problems`/`writing_52_problems` tables | Rejected because it breaks common `problem_id` flows |

## Why

| 기준 | 결정 |
| --- | --- |
| 데이터 정합성 | 51/52/53/54 화면 데이터가 서로 다르므로 유형별 상세 테이블이 필요하다. |
| 기존 앱 호환성 | `problems.id`를 유지해야 기존 draft/submission/feedback/RPC 연결이 깨지지 않는다. |
| 관리자 관리성 | JSONB-only는 다음 관리자 입력 폼과 검증 규칙을 모호하게 만든다. |
| 마이그레이션 위험 | 공통 부모 + 상세 테이블은 완전 분리보다 안전하고 JSONB-only보다 명확하다. |
| 관리자 UI 범위 | 이 repo에서는 관리자 UI를 만들지 않는다. DB 계약과 user-facing 앱 호환만 다룬다. |

---

## File Map

- Modify: `supabase/migrations/*` only after Supabase CLI or MCP SQL tooling is available.
- Modify: `supabase/seed.sql` after the schema migration exists.
- Create: `src/lib/writing/problem-details.ts` for app-side normalized types and projection helpers.
- Modify: `src/lib/writing/server.ts` so the loader can prefer detail tables and fallback to existing `problems` JSON fields.
- Modify: `src/components/writing/LongFormEditor.tsx` only if the loader return type changes.
- Create: `tests/lib/writing/problem-details.test.ts`.
- Modify: `tests/integration/writing-flow.test.ts`.
- Already updated: the four `screen-data-summary.md` files to remove candidate wording.

---

## Task 0: Supabase Tooling Gate

**Files:**
- No file changes.

- [ ] **Step 1: Check MCP SQL tool availability**

Run tool discovery for Supabase SQL tools.

Expected available tool names include one of:

```text
execute_sql
list_projects
apply SQL/query tool for Supabase
```

Current session result:

```text
No callable Supabase SQL tool is visible.
```

- [ ] **Step 2: Check Supabase CLI**

Run:

```powershell
supabase --version
```

Current session result:

```text
The term 'supabase' is not recognized
```

- [ ] **Step 3: Pick the allowed DB path**

| Tool state | Allowed DB work |
| --- | --- |
| MCP SQL tool available | Iterate SQL with MCP, then create migration using project practice. |
| Supabase CLI available | Run `supabase migration new writing_question_detail_tables`. |
| Neither available | Do not create a migration filename by hand. Stop DB apply and report blocked. |

---

## Task 1: Create Detail Table Migration

**Files:**
- Create: generated migration from `supabase migration new writing_question_detail_tables`

- [ ] **Step 1: Create migration with CLI**

Run only when CLI is available:

```powershell
supabase migration new writing_question_detail_tables
```

Expected: one new SQL file appears under `supabase/migrations/`.

- [ ] **Step 2: Add table SQL**

Add this SQL to the generated migration:

```sql
create table public.writing_problem_51_details (
  problem_id uuid primary key references public.problems(id) on delete cascade,
  problem_type text not null default 'D-01' check (problem_type = 'D-01'),
  instruction_text text not null,
  passage_text text not null,
  blank_items jsonb not null default '[]'::jsonb check (jsonb_typeof(blank_items) = 'array'),
  answer_min_length smallint not null default 10 check (answer_min_length >= 0),
  answer_max_length smallint not null default 120 check (answer_max_length >= answer_min_length and answer_max_length <= 120),
  expression_hints text[] not null default '{}',
  ai_guide_cards jsonb not null default '[]'::jsonb check (jsonb_typeof(ai_guide_cards) = 'array'),
  model_answer_visibility text not null default 'after_submit' check (model_answer_visibility in ('hidden','after_submit','always')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.writing_problem_51_answers (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.writing_problem_51_details(problem_id) on delete cascade,
  blank_key text not null,
  answer_text text not null,
  is_primary boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.writing_problem_52_details (
  problem_id uuid primary key references public.problems(id) on delete cascade,
  problem_type text not null default 'D-02' check (problem_type = 'D-02'),
  instruction_text text not null,
  passage_text text not null,
  blank_items jsonb not null default '[]'::jsonb check (jsonb_typeof(blank_items) = 'array'),
  answer_min_length smallint not null default 10 check (answer_min_length >= 0),
  answer_max_length smallint not null default 160 check (answer_max_length >= answer_min_length and answer_max_length <= 160),
  context_guide_cards jsonb not null default '[]'::jsonb check (jsonb_typeof(context_guide_cards) = 'array'),
  context_keywords text[] not null default '{}',
  connector_suggestions text[] not null default '{}',
  rubric_summary jsonb not null default '[]'::jsonb check (jsonb_typeof(rubric_summary) = 'array'),
  related_learning_cards jsonb not null default '[]'::jsonb check (jsonb_typeof(related_learning_cards) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.writing_problem_52_answers (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.writing_problem_52_details(problem_id) on delete cascade,
  blank_key text not null,
  answer_text text not null,
  is_primary boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.writing_problem_53_details (
  problem_id uuid primary key references public.problems(id) on delete cascade,
  problem_type text not null default 'D-03' check (problem_type = 'D-03'),
  instruction_text text not null,
  topic_text text not null,
  recommended_min_length smallint not null default 200,
  recommended_max_length smallint not null default 300,
  answer_min_length smallint not null default 120,
  writing_sections text[] not null default array['intro','body','conclusion'],
  editor_tools text[] not null default '{}',
  ai_guide_cards jsonb not null default '[]'::jsonb check (jsonb_typeof(ai_guide_cards) = 'array'),
  feedback_criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(feedback_criteria) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (answer_min_length <= recommended_min_length),
  check (recommended_min_length <= recommended_max_length and recommended_max_length <= 300)
);

create table public.writing_problem_53_charts (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.writing_problem_53_details(problem_id) on delete cascade,
  title text not null,
  chart_type text not null check (chart_type in ('bar','line','pie','combo')),
  x_label text,
  y_label text,
  sort_order int not null default 0
);

create table public.writing_problem_53_chart_points (
  id uuid primary key default gen_random_uuid(),
  chart_id uuid not null references public.writing_problem_53_charts(id) on delete cascade,
  label text not null,
  series_name text not null,
  numeric_value numeric not null,
  sort_order int not null default 0
);

create table public.writing_problem_53_tables (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.writing_problem_53_details(problem_id) on delete cascade,
  title text not null,
  sort_order int not null default 0
);

create table public.writing_problem_53_table_cells (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.writing_problem_53_tables(id) on delete cascade,
  row_label text not null,
  column_label text not null,
  cell_value text not null,
  sort_order int not null default 0
);

create table public.writing_problem_54_details (
  problem_id uuid primary key references public.problems(id) on delete cascade,
  problem_type text not null default 'D-04' check (problem_type = 'D-04'),
  exam_label text not null default 'TOPIK II 쓰기',
  prompt_text text not null,
  instruction_text text not null,
  conditions jsonb not null default '[]'::jsonb check (jsonb_typeof(conditions) = 'array'),
  recommended_min_length smallint not null default 600,
  recommended_max_length smallint not null default 700,
  answer_min_length smallint not null default 300,
  display_max_length smallint not null default 700,
  recommended_time_min smallint not null default 40,
  recommended_time_max smallint not null default 60,
  writing_sections text[] not null default array['intro','body','conclusion'],
  structure_guide_cards jsonb not null default '[]'::jsonb check (jsonb_typeof(structure_guide_cards) = 'array'),
  diagnosis_items jsonb not null default '[]'::jsonb check (jsonb_typeof(diagnosis_items) = 'array'),
  checklist_items jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist_items) = 'array'),
  editor_tools text[] not null default '{}',
  related_learning_links jsonb not null default '[]'::jsonb check (jsonb_typeof(related_learning_links) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (answer_min_length <= recommended_min_length),
  check (recommended_min_length <= recommended_max_length),
  check (recommended_max_length <= display_max_length),
  check (recommended_time_min <= recommended_time_max)
);
```

- [ ] **Step 3: Add question-number validation trigger**

Add this SQL below the table definitions:

```sql
create or replace function private.assert_writing_detail_question_no()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  expected_question_no smallint;
  actual_question_no smallint;
begin
  expected_question_no := case tg_table_name
    when 'writing_problem_51_details' then 51
    when 'writing_problem_52_details' then 52
    when 'writing_problem_53_details' then 53
    when 'writing_problem_54_details' then 54
    else null
  end;

  select question_no
    into actual_question_no
    from public.problems
   where id = new.problem_id
     and domain = 'writing';

  if actual_question_no is null then
    raise exception 'writing detail requires a writing problem parent';
  end if;

  if actual_question_no <> expected_question_no then
    raise exception 'writing detail table % requires question_no %, got %',
      tg_table_name, expected_question_no, actual_question_no;
  end if;

  return new;
end;
$$;

create trigger trg_writing_problem_51_details_question_no
before insert or update of problem_id on public.writing_problem_51_details
for each row execute function private.assert_writing_detail_question_no();

create trigger trg_writing_problem_52_details_question_no
before insert or update of problem_id on public.writing_problem_52_details
for each row execute function private.assert_writing_detail_question_no();

create trigger trg_writing_problem_53_details_question_no
before insert or update of problem_id on public.writing_problem_53_details
for each row execute function private.assert_writing_detail_question_no();

create trigger trg_writing_problem_54_details_question_no
before insert or update of problem_id on public.writing_problem_54_details
for each row execute function private.assert_writing_detail_question_no();
```

- [ ] **Step 4: Add RLS**

Add this SQL:

```sql
alter table public.writing_problem_51_details enable row level security;
alter table public.writing_problem_51_answers enable row level security;
alter table public.writing_problem_52_details enable row level security;
alter table public.writing_problem_52_answers enable row level security;
alter table public.writing_problem_53_details enable row level security;
alter table public.writing_problem_53_charts enable row level security;
alter table public.writing_problem_53_chart_points enable row level security;
alter table public.writing_problem_53_tables enable row level security;
alter table public.writing_problem_53_table_cells enable row level security;
alter table public.writing_problem_54_details enable row level security;
```

Mirror the existing `problems` read policy: authenticated users can read detail rows only when the parent `problems` row is visible to them. Admin mutations should happen through existing or new admin RPCs, not direct table writes from clients.

---

## Task 2: Seed Detail Rows

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Insert one detail row per seeded writing problem**

For each seeded `problems` row with `domain = 'writing' and question_no in (51,52,53,54)`, insert exactly one matching detail row.

Expected:
- 51 row exists in `writing_problem_51_details`.
- 52 row exists in `writing_problem_52_details`.
- 53 row exists in `writing_problem_53_details`.
- 54 row exists in `writing_problem_54_details`.

- [ ] **Step 2: Insert answer rows for 51 and 52**

For each blank in 51 and 52, insert answer rows into:

```text
writing_problem_51_answers
writing_problem_52_answers
```

Expected: every `blank_key` referenced by `blank_items` has at least one answer row.

- [ ] **Step 3: Insert chart/table rows for 53**

Insert:

```text
writing_problem_53_charts
writing_problem_53_chart_points
writing_problem_53_tables
writing_problem_53_table_cells
```

Expected: the 53 screen can be reconstructed without reading `problems.materials`.

---

## Task 3: Add App-Side Types and Loader Projection

**Files:**
- Create: `src/lib/writing/problem-details.ts`
- Modify: `src/lib/writing/server.ts`
- Test: `tests/lib/writing/problem-details.test.ts`

- [ ] **Step 1: Add type tests**

Create `tests/lib/writing/problem-details.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { isWritingQuestionDetailKind } from "@/lib/writing/problem-details";

describe("writing question detail helpers", () => {
  it("recognizes supported writing question detail kinds", () => {
    expect(isWritingQuestionDetailKind(51)).toBe(true);
    expect(isWritingQuestionDetailKind(52)).toBe(true);
    expect(isWritingQuestionDetailKind(53)).toBe(true);
    expect(isWritingQuestionDetailKind(54)).toBe(true);
    expect(isWritingQuestionDetailKind(55)).toBe(false);
  });
});
```

- [ ] **Step 2: Create helper module**

Create `src/lib/writing/problem-details.ts`:

```ts
export type WritingQuestionDetailKind = 51 | 52 | 53 | 54;

export function isWritingQuestionDetailKind(
  value: unknown,
): value is WritingQuestionDetailKind {
  return value === 51 || value === 52 || value === 53 || value === 54;
}
```

- [ ] **Step 3: Keep current loader compatible**

Do not remove `problems.materials` yet. Update `src/lib/writing/server.ts` only after generated Supabase types include the new tables or after a typed RPC/view exists.

Expected short-term behavior:
- Existing user pages keep loading from `problems`.
- New detail tables become the source for admin and future loader migration.

---

## Task 4: Update Admin RPC Contract Later

**Files:**
- Future migration only.

- [ ] **Step 1: Do not add admin UI in this repo**

This task is intentionally blocked until the separate admin app work starts.

- [ ] **Step 2: Plan write path**

Future write path should be one RPC per type:

```text
admin_upsert_writing_problem_51_detail
admin_upsert_writing_problem_52_detail
admin_upsert_writing_problem_53_detail
admin_upsert_writing_problem_54_detail
```

Expected: RPC validates parent `problems.question_no`, writes detail rows, and updates the compatibility projection fields if the current user app still reads them.

---

## Task 5: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
pnpm test -- tests/lib/writing/problem-details.test.ts tests/integration/writing-flow.test.ts
```

Expected: pass.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
pnpm typecheck
```

Expected: pass.

- [ ] **Step 3: Verify DB locally when CLI is available**

Run:

```powershell
supabase db reset
```

Expected: migrations and seed apply.

- [ ] **Step 4: Verify question-number trigger**

Run:

```sql
insert into public.writing_problem_51_details (
  problem_id,
  instruction_text,
  passage_text,
  blank_items
)
select id, 'bad insert', 'bad passage', '[]'::jsonb
from public.problems
where domain = 'writing' and question_no = 52
limit 1;
```

Expected: fail with `writing detail table writing_problem_51_details requires question_no 51`.

---

## Acceptance Criteria

- The four writing screen summaries no longer use “관리 포인트 후보” for schema decisions.
- `problems` remains the shared parent.
- 51, 52, 53, and 54 each have a dedicated detail table.
- 51 and 52 answers are row-level data, not hidden only inside JSONB.
- 53 chart and table data are row-level data.
- 54 conditions, structure guide, diagnosis items, and checklist items have a dedicated detail table.
- Existing draft/submission/feedback tables remain unchanged.
- Existing user pages keep working during the transition.
- Supabase DB apply is completed through MCP or CLI before implementation is marked complete.

## Known Blocker

In the current Codex session, Supabase CLI is not installed and the installed Supabase plugin has not exposed callable SQL tools. Per the Supabase workflow, do not invent a migration filename while the migration tool is unavailable. DB apply remains blocked until MCP SQL tools or Supabase CLI are available.
