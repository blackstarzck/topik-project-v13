# Hidden Writing Problem UX Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 숨김/비공개/비활성/만료된 쓰기 문제를 사용자의 상태별 흐름에서 일관되게 보존, 차단, 안내한다.

**Architecture:** 문제 노출 가능 여부를 한 곳에서 판단하는 availability contract를 만들고, 문제 목록/내 서재/작성 화면/제출 실패 모달이 같은 계약을 소비하게 한다. 신규 풀이와 제출은 막고, 사용자가 이미 만든 제출 기록과 서재 ledger는 보존한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Ant Design, Supabase/Postgres RPC, Vitest, Playwright.

---

## Non-Negotiable Product Contract

| 사용자 상태 | Soft unavailable: `published + public + lifecycle_status != active` | Hard unavailable: `visibility != public` 또는 `publish_status != published` 또는 row 없음 |
| --- | --- | --- |
| 새 탐색/추천 | 신규 후보로 추천하지 않는다. 목록에 남는 경우 disabled row + 사유 표시. | 신규 후보에 노출하지 않는다. |
| 문제 목록 `/practice/problems` | 행이 내려오면 disabled, 클릭/Enter/CTA 모두 막고 `lifecycle_reason` 표시. | RLS/API 결과에 없어야 한다. |
| 내 서재 문제 탭 | 항목 유지, 제목 표시 가능, `제공 종료` 배지, 다시 풀기 비활성, 사유 표시. | 항목 유지, 문제 제목/본문 미노출, placeholder 제목, 다시 풀기 비활성. |
| 기존 제출/피드백/리포트 | 그대로 보존. 다시 풀기 CTA는 비활성 또는 문제 목록으로 대체. | 그대로 보존. 다시 풀기 CTA는 비활성 또는 문제 목록으로 대체. |
| 작성 화면을 이미 열어 둔 사용자 | 제출 시 서버가 거절한다. 답안은 화면에 남고, 모달은 재시도 대신 보존 안내 + 문제 목록 이동을 제공. | 제출 시 서버가 거절한다. 답안은 화면에 남고, 모달은 재시도 대신 보존 안내 + 문제 목록 이동을 제공. |
| 숨김 후 직접 deep link 재진입 | 문제 본문은 보여주지 않고 “제출할 수 없는 문제” 화면을 표시한다. draft가 있으면 보존 안내를 표시한다. | 문제 본문/제목을 보여주지 않고 “더 이상 제공되지 않는 문제” placeholder를 표시한다. draft가 있으면 보존 안내를 표시한다. |

Current SOT/code constraints to preserve:

- `docs/sot-change-proposals/writing-submission-guard-sot-update-2026-06-17.md` says 숨김 문제는 제출되지 않는다.
- `supabase/migrations/20260617055040_guard_writing_submission_problem_visibility.sql` rejects writing submission unless problem is `published`, `public`, and `active`.
- `supabase/migrations/20260608120100_problems_lifecycle_expiry.sql` defines inactive/expired as C-02 row deactivation + reason display.
- Do not add or expand admin UI. This repo remains user-facing.
- Do not change existing SOT documents directly. Add a proposal under `docs/sot-change-proposals/`.

## UX Flow Checklist

Every implementation task must keep these user interactions working:

1. User opens `/practice/problems`, sees a soft unavailable row, clicks the row: nothing navigates, no retry modal opens, reason text is visible.
2. User tabs to the same row and presses Enter/Space: nothing navigates, no retry modal opens.
3. User opens `/library?tab=problems`, searches for a saved soft unavailable problem: row remains visible, badge is shown, retry is disabled, reason is shown.
4. User opens `/library?tab=problems`, searches for a saved hard unavailable problem: ledger row remains visible, placeholder title is shown, retry is disabled, no hidden problem title/body leaks.
5. User opens an active writing problem, writes an answer, admin hides/deactivates the problem before submit: submission fails with a deterministic “problem unavailable” modal; answer remains in the editor; primary action goes to `/practice/problems`.
6. User reloads a hidden problem deep link with an existing draft: no problem body is rendered; draft preservation is explained; submission is not available.
7. User views an old feedback/submission for the hidden problem: report content remains visible; retry action does not deep-link into a now-unavailable problem.

## File Map

Create:

- `src/lib/problems/availability.ts` — canonical availability contract and mapping helpers.
- `tests/lib/problems/availability.test.ts` — status matrix tests.
- `supabase/migrations/20260623170000_library_problem_availability_rpc.sql` — user-owned library problem RPC that preserves saved rows without leaking hard-hidden content.
- `docs/sot-change-proposals/2026-06-23-hidden-writing-problem-ux-contract.md` — SOT update proposal for the user-facing contract.

Modify:

- `src/lib/supabase/types.ts` — add RPC result typing after migration.
- `src/lib/library/types.ts` — extend `LibraryProblemView` with availability fields.
- `src/lib/library/server.ts` — use the RPC for saved problem rows.
- `src/lib/library/queries.ts` — use the same RPC client-side for saved problem rows.
- `src/components/library/LibrarySavedProblemsTab.tsx` — show badges/reasons and disable retry correctly.
- `messages/ko.json`, `messages/en.json`, `messages/vi.json` — add labels for availability states and deterministic submit failure.
- `src/app/(workspace)/writing/_components/WritingQuestionRoute.tsx` — fetch draft preservation state for explicit hidden problem deep links.
- `src/components/writing/WritingPageContent.tsx` — render unavailable problem state.
- `src/components/writing/SubmissionFailedModal.tsx` — branch deterministic problem-unavailable failures away from generic retry.
- `src/lib/writing/server-actions.ts` — expose a stable error kind for `problem_not_submittable`.
- `src/components/feedback/FeedbackPageContent.tsx`, `src/components/feedback/NextActionBar.tsx`, `src/components/reports/ComparisonReportView.tsx` — avoid active retry links when the referenced problem is unavailable.
- `docs/Wireframe/data-usage-index.md` only through a separate SOT proposal, not direct edit in this task.

Modify tests:

- `tests/lib/library/server.test.ts`
- `tests/components/practice/problem-list-data.test.ts`
- `tests/components/practice/ProblemListView.test.tsx`
- `tests/components/library/LibraryTabs.test.tsx` or add `tests/components/library/LibrarySavedProblemsTab.test.tsx`
- `tests/components/writing/WritingEditor.submit-flow.test.tsx`
- `tests/components/writing/SubmissionFailedModal.test.tsx`
- `tests/lib/writing/server-actions.test.ts`
- `tests/e2e/screens/library.spec.ts`
- `tests/e2e/screens/submission-confirm-modal.spec.ts` or add `tests/e2e/screens/hidden-problem-ux.spec.ts`

---

## Task 1: Write The SOT Change Proposal

**Files:**

- Create: `docs/sot-change-proposals/2026-06-23-hidden-writing-problem-ux-contract.md`

- [ ] **Step 1: Create the proposal with the exact contract**

Use this content:

```markdown
# 2026-06-23 숨김/비활성 쓰기 문제 사용자 UX 계약 SOT 변경 제안

## 목적

운영자가 쓰기 문제를 숨김, 비공개, 비활성, 만료 상태로 바꿨을 때 학습자에게 이미 보이던 문제, 작성 중 답안, 내 서재 항목, 기존 제출 기록이 어떻게 보여야 하는지 정한다.

## 한 줄 요약

새 풀이와 제출은 막고, 사용자가 이미 만든 학습 기록은 보존하되, 문제 본문을 계속 노출하면 안 되는 상태에서는 placeholder와 제공 종료 안내만 보여준다.

## 상태 구분

| 상태 | 기준 | 사용자-facing 의미 |
| --- | --- | --- |
| 사용 가능 | `publish_status='published'`, `visibility='public'`, `lifecycle_status='active'` | 새 풀이, 다시 풀기, 제출 가능 |
| Soft unavailable | `publish_status='published'`, `visibility='public'`, `lifecycle_status in ('inactive','expired')` | 문제 존재와 제목은 표시 가능하지만 새 풀이/제출 불가 |
| Hard unavailable | `publish_status!='published'` 또는 `visibility!='public'` 또는 row 없음 | 문제 본문/제목을 새로 노출하지 않고 저장 ledger만 placeholder로 유지 |

## 사용자별 동작

| 사용자 상태 | 권장 동작 |
| --- | --- |
| 새 탐색/추천 | 사용 가능 문제만 추천 후보로 제공한다. |
| 문제 목록 | soft unavailable row는 비활성화하고 사유를 표시한다. hard unavailable row는 목록에 노출하지 않는다. |
| 작성 중 | 제출 직전 서버가 상태를 다시 확인한다. 사용 불가 상태면 제출을 저장하지 않고 답안 보존 안내를 표시한다. |
| 내 서재 문제 탭 | 저장 항목은 유지한다. soft unavailable은 제목 + 제공 종료 배지, hard unavailable은 placeholder + 제공 종료 배지를 표시한다. 다시 풀기는 비활성화한다. |
| 기존 제출/피드백/리포트 | 과거 학습 기록으로 보존한다. 단, 다시 풀기 CTA는 사용 가능 문제일 때만 제공한다. |

## 현재 구현과 맞춰야 할 지점

- DB 제출 guard는 이미 숨김/비공개/비활성 문제 제출을 거절한다.
- 내 서재 문제 탭은 RLS로 문제 row가 사라지면 ledger 항목도 화면에서 빠질 수 있어 보완이 필요하다.
- 일반 제출 실패 모달은 현재 다시 시도를 유도하므로, `problem_not_submittable`은 별도 UX로 분리해야 한다.

## 대상 문서 / 수정 이유 / 수정 방향

| 대상 문서 | 수정 이유 | 수정 방향 |
| --- | --- | --- |
| `docs/Wireframe/06-C-02-problem-list/functional-spec.md` | 비활성 문제 행 동작을 명확히 해야 한다. | disabled row, 사유 표시, 클릭/키보드 진입 차단을 수용 기준에 추가한다. |
| `docs/Wireframe/18-F-01-my-library/functional-spec.md` | 저장 문제가 숨김 처리될 때 ledger 보존 방식이 빠져 있다. | 제공 종료 배지, placeholder, 다시 풀기 비활성화를 상태/오류와 수용 기준에 추가한다. |
| `docs/Wireframe/12-D-M1-submission-confirmation-modal/functional-spec.md` | 제출 직전 상태 변경 실패가 일반 실패와 구분되어야 한다. | 문제 사용 불가 실패는 재시도 대신 답안 보존 안내와 문제 목록 이동을 제공한다고 추가한다. |
| `docs/Wireframe/data-usage-index.md` | 새 RPC와 availability 필드가 역색인에 필요하다. | RPC와 반환 필드를 추가한다. |

## 검증 기준

- `/practice/problems`에서 soft unavailable row는 비활성화되고 사유가 보인다.
- `/library?tab=problems`에서 soft/hard unavailable 저장 항목이 사라지지 않는다.
- 작성 중 상태 변경 후 제출하면 답안이 사라지지 않고 deterministic 안내가 나온다.
- 기존 제출/피드백/리포트는 유지된다.
```

- [ ] **Step 2: Confirm no existing SOT was edited**

Run:

```powershell
git diff -- docs/Wireframe docs/sot-change-proposals
```

Expected: only the new proposal file appears under `docs/sot-change-proposals/`.

---

## Task 2: Add Central Availability Contract

**Files:**

- Create: `src/lib/problems/availability.ts`
- Create: `tests/lib/problems/availability.test.ts`

- [ ] **Step 1: Write failing availability tests**

Create `tests/lib/problems/availability.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  getProblemAvailability,
  type ProblemAvailabilityInput,
} from "../../../src/lib/problems/availability";

function row(
  patch: Partial<ProblemAvailabilityInput>,
): ProblemAvailabilityInput {
  return {
    publishStatus: "published",
    visibility: "public",
    lifecycleStatus: "active",
    lifecycleReason: null,
    ...patch,
  };
}

describe("getProblemAvailability", () => {
  it("allows published public active problems", () => {
    expect(getProblemAvailability(row({}))).toEqual({
      state: "available",
      canShowProblemIdentity: true,
      canStart: true,
      canSubmit: true,
      labelKey: null,
      reason: null,
    });
  });

  it("keeps public inactive problems identifiable but blocks start and submit", () => {
    expect(
      getProblemAvailability(
        row({
          lifecycleStatus: "inactive",
          lifecycleReason: "품질 점검 중",
        }),
      ),
    ).toEqual({
      state: "soft_unavailable",
      canShowProblemIdentity: true,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
      reason: "품질 점검 중",
    });
  });

  it("keeps public expired problems identifiable but blocks start and submit", () => {
    expect(
      getProblemAvailability(
        row({
          lifecycleStatus: "expired",
          lifecycleReason: null,
        }),
      ),
    ).toEqual({
      state: "soft_unavailable",
      canShowProblemIdentity: true,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
      reason: null,
    });
  });

  it("treats archived problems as hard unavailable", () => {
    expect(
      getProblemAvailability(row({ publishStatus: "archived" })),
    ).toMatchObject({
      state: "hard_unavailable",
      canShowProblemIdentity: false,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
    });
  });

  it("treats private problems as hard unavailable", () => {
    expect(
      getProblemAvailability(row({ visibility: "private" })),
    ).toMatchObject({
      state: "hard_unavailable",
      canShowProblemIdentity: false,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
    });
  });

  it("treats missing problem rows as hard unavailable", () => {
    expect(getProblemAvailability(null)).toMatchObject({
      state: "hard_unavailable",
      canShowProblemIdentity: false,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
    });
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
pnpm vitest run tests/lib/problems/availability.test.ts
```

Expected: FAIL because `src/lib/problems/availability.ts` does not exist.

- [ ] **Step 3: Implement the contract**

Create `src/lib/problems/availability.ts`:

```ts
export type ProblemPublishStatus = "draft" | "published" | "archived";
export type ProblemVisibility = "private" | "public" | "org";
export type ProblemLifecycleStatus = "active" | "inactive" | "expired";

export type ProblemAvailabilityState =
  | "available"
  | "soft_unavailable"
  | "hard_unavailable";

export type ProblemAvailabilityInput = {
  publishStatus: ProblemPublishStatus | string | null | undefined;
  visibility: ProblemVisibility | string | null | undefined;
  lifecycleStatus: ProblemLifecycleStatus | string | null | undefined;
  lifecycleReason: string | null | undefined;
};

export type ProblemAvailability = {
  state: ProblemAvailabilityState;
  canShowProblemIdentity: boolean;
  canStart: boolean;
  canSubmit: boolean;
  labelKey: "providedEnded" | null;
  reason: string | null;
};

export function getProblemAvailability(
  input: ProblemAvailabilityInput | null,
): ProblemAvailability {
  if (!input) {
    return {
      state: "hard_unavailable",
      canShowProblemIdentity: false,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
      reason: null,
    };
  }

  const published = input.publishStatus === "published";
  const publicVisible = input.visibility === "public";
  const active = input.lifecycleStatus === "active";

  if (published && publicVisible && active) {
    return {
      state: "available",
      canShowProblemIdentity: true,
      canStart: true,
      canSubmit: true,
      labelKey: null,
      reason: null,
    };
  }

  if (published && publicVisible) {
    return {
      state: "soft_unavailable",
      canShowProblemIdentity: true,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
      reason: input.lifecycleReason ?? null,
    };
  }

  return {
    state: "hard_unavailable",
    canShowProblemIdentity: false,
    canStart: false,
    canSubmit: false,
    labelKey: "providedEnded",
    reason: null,
  };
}
```

- [ ] **Step 4: Verify**

Run:

```powershell
pnpm vitest run tests/lib/problems/availability.test.ts
```

Expected: PASS.

---

## Task 3: Add Library Problem Availability RPC

**Files:**

- Create: `supabase/migrations/20260623170000_library_problem_availability_rpc.sql`
- Modify: `src/lib/supabase/types.ts`
- Modify: `tests/lib/library/server.test.ts`

- [ ] **Step 1: Add SQL migration**

Create `supabase/migrations/20260623170000_library_problem_availability_rpc.sql`:

```sql
-- =====================================================================
-- Preserve saved library problem ledger rows when the underlying problem
-- becomes unavailable, without leaking hard-hidden problem identity.
-- =====================================================================

create or replace function public.list_user_library_problem_items()
returns table (
  item_id uuid,
  problem_id uuid,
  title text,
  question_no smallint,
  tags text[],
  saved_at timestamptz,
  availability_status text,
  availability_reason text,
  can_retry boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  return query
  select
    li.id as item_id,
    li.problem_id,
    case
      when p.id is not null
       and p.publish_status = 'published'
       and p.visibility = 'public'
      then p.title
      else null
    end as title,
    case
      when p.id is not null
       and p.publish_status = 'published'
       and p.visibility = 'public'
      then p.question_no
      else null
    end as question_no,
    coalesce(li.tags, '{}'::text[]) as tags,
    li.saved_at,
    case
      when p.id is null then 'hard_unavailable'
      when p.publish_status = 'published'
       and p.visibility = 'public'
       and p.lifecycle_status = 'active'
      then 'available'
      when p.publish_status = 'published'
       and p.visibility = 'public'
      then 'soft_unavailable'
      else 'hard_unavailable'
    end as availability_status,
    case
      when p.id is null then '문제를 찾을 수 없습니다.'
      when p.publish_status = 'published'
       and p.visibility = 'public'
       and p.lifecycle_status <> 'active'
      then p.lifecycle_reason
      else null
    end as availability_reason,
    (
      p.id is not null
      and p.publish_status = 'published'
      and p.visibility = 'public'
      and p.lifecycle_status = 'active'
    ) as can_retry
  from public.library_items li
  left join public.problems p on p.id = li.problem_id
  where li.user_id = caller_id
    and li.item_type = 'problem'
  order by li.saved_at desc;
end;
$$;

revoke all on function public.list_user_library_problem_items() from public;
grant execute on function public.list_user_library_problem_items() to authenticated;
comment on function public.list_user_library_problem_items() is
  'Returns the caller-owned saved problem library rows with availability metadata. Hard-hidden problem identity is not exposed.';
```

- [ ] **Step 2: Add Supabase type mirror**

In `src/lib/supabase/types.ts`, add an RPC entry for `list_user_library_problem_items` matching the SQL result:

```ts
list_user_library_problem_items: {
  Args: Record<PropertyKey, never>;
  Returns: Array<{
    item_id: string;
    problem_id: string | null;
    title: string | null;
    question_no: number | null;
    tags: string[];
    saved_at: string;
    availability_status:
      | "available"
      | "soft_unavailable"
      | "hard_unavailable";
    availability_reason: string | null;
    can_retry: boolean;
  }>;
};
```

- [ ] **Step 3: Add a server data-layer test before implementation**

Extend `tests/lib/library/server.test.ts` with a mock `rpc` method and this case:

```ts
it("preserves hard-unavailable saved problem rows as placeholders", async () => {
  const create = async () =>
    ({
      from: () => {
        throw new Error("problems tab should use list_user_library_problem_items");
      },
      rpc: async (name: string) => {
        expect(name).toBe("list_user_library_problem_items");
        return {
          data: [
            {
              item_id: "li-hidden",
              problem_id: "p-hidden",
              title: null,
              question_no: null,
              tags: ["saved"],
              saved_at: "2026-06-23T00:00:00Z",
              availability_status: "hard_unavailable",
              availability_reason: "문제를 찾을 수 없습니다.",
              can_retry: false,
            },
          ],
          error: null,
        };
      },
    }) as never;

  const out = await listLibraryItems("u", "problems", create);
  expect(out).toEqual([
    {
      kind: "problem",
      id: "p-hidden",
      title: null,
      question_no: null,
      item_id: "li-hidden",
      tags: ["saved"],
      availabilityStatus: "hard_unavailable",
      availabilityReason: "문제를 찾을 수 없습니다.",
      canRetry: false,
    },
  ]);
});
```

- [ ] **Step 4: Run the failing test**

Run:

```powershell
pnpm vitest run tests/lib/library/server.test.ts
```

Expected: FAIL because the problem tab still uses a direct `problems` join.

---

## Task 4: Wire Library Data And Saved Problem UX

**Files:**

- Modify: `src/lib/library/types.ts`
- Modify: `src/lib/library/server.ts`
- Modify: `src/lib/library/queries.ts`
- Modify: `src/components/library/LibrarySavedProblemsTab.tsx`
- Modify: `messages/ko.json`, `messages/en.json`, `messages/vi.json`
- Add or modify: `tests/components/library/LibrarySavedProblemsTab.test.tsx`

- [ ] **Step 1: Extend `LibraryProblemView`**

In `src/lib/library/types.ts`, change `LibraryProblemView` to:

```ts
export type LibraryProblemAvailabilityStatus =
  | "available"
  | "soft_unavailable"
  | "hard_unavailable";

export type LibraryProblemView = {
  kind: "problem";
  /** Underlying `problems.id`, retained even when the problem is unavailable. */
  id: string;
  title: string | null;
  question_no: number | null;
  item_id: string;
  tags: string[];
  availabilityStatus: LibraryProblemAvailabilityStatus;
  availabilityReason: string | null;
  canRetry: boolean;
};
```

- [ ] **Step 2: Replace problem joins with the RPC**

In both `src/lib/library/server.ts` and `src/lib/library/queries.ts`, make the `problems` tab call `list_user_library_problem_items` and map rows:

```ts
async function joinProblems(
  supabase: SupabaseServerClient,
  _items: LibraryItemRow[],
): Promise<LibraryProblemView[]> {
  const { data, error } = await supabase.rpc(
    "list_user_library_problem_items",
  );
  if (error) {
    throw new Error(`listLibraryItems(problems) rpc: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    kind: "problem",
    id: row.problem_id ?? row.item_id,
    title: row.title ?? null,
    question_no: typeof row.question_no === "number" ? row.question_no : null,
    item_id: row.item_id,
    tags: Array.isArray(row.tags) ? row.tags : [],
    availabilityStatus: row.availability_status,
    availabilityReason: row.availability_reason ?? null,
    canRetry: row.can_retry === true,
  }));
}
```

For `src/lib/library/queries.ts`, use the same shape with the browser client type.

- [ ] **Step 3: Add i18n keys**

Add these keys under `library.saved` in all three message files:

```json
{
  "providedEnded": "제공 종료",
  "unavailablePlaceholderTitle": "더 이상 제공되지 않는 문제",
  "unavailableDefaultReason": "이 문제는 더 이상 새로 풀 수 없습니다.",
  "retryUnavailable": "다시 풀 수 없음"
}
```

English:

```json
{
  "providedEnded": "No longer available",
  "unavailablePlaceholderTitle": "Problem no longer available",
  "unavailableDefaultReason": "This problem can no longer be started.",
  "retryUnavailable": "Unavailable"
}
```

Vietnamese:

```json
{
  "providedEnded": "Đã ngừng cung cấp",
  "unavailablePlaceholderTitle": "Bài không còn được cung cấp",
  "unavailableDefaultReason": "Bạn không thể bắt đầu lại bài này.",
  "retryUnavailable": "Không khả dụng"
}
```

- [ ] **Step 4: Update saved problem row rendering**

In `src/components/library/LibrarySavedProblemsTab.tsx`, change row rendering so unavailable rows are not wrapped in `Link`:

```tsx
const title = item.title ?? t("unavailablePlaceholderTitle");
const unavailable = !item.canRetry;
const reason =
  item.availabilityReason ??
  (unavailable ? t("unavailableDefaultReason") : null);

<LibraryItemRow
  key={item.item_id}
  itemId={item.item_id}
  tab="problems"
  tags={item.tags}
  trailingActions={[
    item.canRetry ? (
      <Link
        key="retry"
        href={
          writingProblemHref({
            questionNo: item.question_no,
            problemId: item.id,
          }) as never
        }
      >
        <Button type="primary" size="small">
          {t("retry")}
        </Button>
      </Link>
    ) : (
      <Button key="retry" disabled size="small">
        {t("retryUnavailable")}
      </Button>
    ),
  ]}
>
  <div className="flex w-full flex-col gap-1">
    <div className="flex flex-wrap items-center gap-2">
      <Text strong>{title}</Text>
      {unavailable ? <Tag>{t("providedEnded")}</Tag> : null}
    </div>
    {reason ? <Text type="secondary">{reason}</Text> : null}
  </div>
</LibraryItemRow>
```

- [ ] **Step 5: Test saved problem unavailable rendering**

Add `tests/components/library/LibrarySavedProblemsTab.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ko from "../../../messages/ko.json";
import { LibrarySavedProblemsTab } from "../../../src/components/library/LibrarySavedProblemsTab";

vi.mock("../../../src/lib/library/queries", () => ({
  useLibraryItems: () => ({
    data: undefined,
    isLoading: false,
    error: null,
  }),
}));

describe("LibrarySavedProblemsTab", () => {
  it("keeps unavailable saved problem rows and disables retry", () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <LibrarySavedProblemsTab
          initialItems={[
            {
              kind: "problem",
              id: "p-hidden",
              title: null,
              question_no: null,
              item_id: "li-hidden",
              tags: [],
              availabilityStatus: "hard_unavailable",
              availabilityReason: "문제를 찾을 수 없습니다.",
              canRetry: false,
            },
          ]}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("더 이상 제공되지 않는 문제")).toBeInTheDocument();
    expect(screen.getByText("제공 종료")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 풀 수 없음" })).toBeDisabled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Verify**

Run:

```powershell
pnpm vitest run tests/lib/library/server.test.ts tests/components/library/LibrarySavedProblemsTab.test.tsx
```

Expected: PASS.

---

## Task 5: Writing Deep Link And Submit Failure UX

**Files:**

- Modify: `src/app/(workspace)/writing/_components/WritingQuestionRoute.tsx`
- Modify: `src/components/writing/WritingPageContent.tsx`
- Modify: `src/components/writing/SubmissionFailedModal.tsx`
- Modify: `src/lib/writing/server-actions.ts`
- Modify: `messages/ko.json`, `messages/en.json`, `messages/vi.json`
- Modify tests under `tests/components/writing/` and `tests/lib/writing/server-actions.test.ts`

- [ ] **Step 1: Add stable submit error kind**

In `src/lib/writing/server-actions.ts`, add:

```ts
export type SubmitWritingErrorKind = "problem_unavailable" | "generic";

export function classifySubmitWritingError(message: string): SubmitWritingErrorKind {
  return message.includes("problem_not_submittable") ||
    message.includes(WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE)
    ? "problem_unavailable"
    : "generic";
}
```

Change `toSubmitWritingErrorMessage` to use `classifySubmitWritingError`.

- [ ] **Step 2: Add tests for the error kind**

In `tests/lib/writing/server-actions.test.ts`, add:

```ts
import { classifySubmitWritingError } from "../../../src/lib/writing/server-actions";

it("classifies problem_not_submittable as deterministic problem unavailable", () => {
  expect(classifySubmitWritingError("problem_not_submittable")).toBe(
    "problem_unavailable",
  );
});

it("classifies network submit errors as generic", () => {
  expect(classifySubmitWritingError("fetch failed")).toBe("generic");
});
```

- [ ] **Step 3: Add deterministic modal copy**

Add under `writing.submit` in all message files:

```json
{
  "problemUnavailableTitle": "이 문제는 더 이상 제출할 수 없어요.",
  "problemUnavailableDescription": "작성한 답안은 화면에 남아 있습니다. 이 문제는 제공 상태가 바뀌어 새 제출을 저장하지 않습니다.",
  "goToProblemList": "다른 문제 선택"
}
```

English:

```json
{
  "problemUnavailableTitle": "This problem can no longer be submitted.",
  "problemUnavailableDescription": "Your answer remains on this screen. The problem availability changed, so no new submission was saved.",
  "goToProblemList": "Choose another problem"
}
```

Vietnamese:

```json
{
  "problemUnavailableTitle": "Bài này không thể nộp được nữa.",
  "problemUnavailableDescription": "Câu trả lời của bạn vẫn còn trên màn hình. Trạng thái bài đã thay đổi nên hệ thống không lưu bài nộp mới.",
  "goToProblemList": "Chọn bài khác"
}
```

- [ ] **Step 4: Branch `SubmissionFailedModal`**

Add a prop:

```ts
errorKind?: "problem_unavailable" | "generic";
```

When `errorKind === "problem_unavailable"`, render:

- warning/error `Alert` with `problemUnavailableTitle`
- description with `problemUnavailableDescription`
- secondary button: close
- primary button: `Link href="/practice/problems"` with `goToProblemList`
- no retry button

- [ ] **Step 5: Update editor submit failure call sites**

Where `SubmissionFailedModal` is rendered, pass:

```tsx
errorKind={
  submit.error instanceof Error &&
  submit.error.message.includes("현재 제출할 수 없는 문제입니다")
    ? "problem_unavailable"
    : "generic"
}
```

If submit error state is normalized elsewhere, prefer the exported `classifySubmitWritingError`.

- [ ] **Step 6: Preserve draft state on hidden deep links**

In `WritingQuestionRoute.tsx`, when `problemId` exists and `problem` is null, validate UUID format and call `getActiveDraft(user.id, problemId)` so the unavailable page can say a draft exists:

```ts
const draft =
  problem && !startFresh
    ? await getActiveDraft(user.id, problem.id)
    : problemId && !startFresh
      ? await getActiveDraft(user.id, problemId)
      : null;
```

Use the existing UUID validation helper or extract it from `src/lib/writing/server.ts` instead of duplicating regex in multiple files.

- [ ] **Step 7: Render unavailable writing state**

In `WritingPageContent.tsx`, when `problem` is null and `draft` is non-null, render an `Empty` state with:

- title: “이 문제는 더 이상 제출할 수 없어요.”
- description: “작성 중이던 답안은 보존되어 있습니다. 다른 문제를 선택해 계속 학습해 주세요.”
- primary action: `/practice/problems`
- no retry action if the explicit problem id is known unavailable

- [ ] **Step 8: Test modal behavior**

Create or modify `tests/components/writing/SubmissionFailedModal.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ko from "../../../messages/ko.json";
import { SubmissionFailedModal } from "../../../src/components/writing/SubmissionFailedModal";

describe("SubmissionFailedModal", () => {
  it("does not offer retry for problem unavailable failures", () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <SubmissionFailedModal
          open
          submitError="현재 제출할 수 없는 문제입니다. 다른 문제를 선택해 주세요."
          errorKind="problem_unavailable"
          onRetry={vi.fn()}
          onClose={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("이 문제는 더 이상 제출할 수 없어요.")).toBeInTheDocument();
    expect(screen.queryByTestId("submission-failed-retry")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다른 문제 선택" })).toHaveAttribute(
      "href",
      "/practice/problems",
    );
  });
});
```

- [ ] **Step 9: Verify**

Run:

```powershell
pnpm vitest run tests/lib/writing/server-actions.test.ts tests/components/writing/SubmissionFailedModal.test.tsx tests/components/writing/WritingEditor.submit-flow.test.tsx
```

Expected: PASS.

---

## Task 6: Problem List And Retry Action Guard

**Files:**

- Modify: `src/components/practice/ProblemTable.tsx`
- Modify: `src/components/practice/ProblemListView.tsx`
- Modify: `tests/components/practice/ProblemListView.test.tsx`
- Modify: `src/components/feedback/NextActionBar.tsx`
- Modify: `src/components/feedback/FeedbackPageContent.tsx`
- Modify: `src/components/reports/ComparisonReportView.tsx`

- [ ] **Step 1: Ensure disabled rows cannot open retry modal**

`ProblemTable.tsx` already has `isDisabled(row)`. Add a regression test in `ProblemListView.test.tsx` that renders an inactive row, clicks the row and the disabled button area, and asserts no retry modal appears:

```tsx
expect(screen.queryByTestId("retry-modal")).not.toBeInTheDocument();
```

- [ ] **Step 2: Verify keyboard guard**

In the same test, focus the inactive row and fire Enter:

```tsx
fireEvent.keyDown(row, { key: "Enter" });
expect(screen.queryByTestId("retry-modal")).not.toBeInTheDocument();
```

- [ ] **Step 3: Guard feedback retry actions**

When feedback pages build a retry href, introduce a small server-side availability lookup before passing retry props. If unavailable:

- hide the retry card, or
- render it disabled with `제공 종료`

Use the same product rule: old feedback remains visible, new retry is blocked.

- [ ] **Step 4: Verify problem-list tests**

Run:

```powershell
pnpm vitest run tests/components/practice/problem-list-data.test.ts tests/components/practice/ProblemListView.test.tsx tests/components/practice/RetryModal.test.tsx
```

Expected: PASS.

---

## Task 7: End-To-End UX Verification

**Files:**

- Add: `tests/e2e/screens/hidden-problem-ux.spec.ts`
- Possibly modify: `tests/e2e/screens/library.spec.ts`

- [ ] **Step 1: Add E2E fixture setup**

Create a Playwright test that:

1. Reads `.env.local`.
2. Uses `student@audit.local`.
3. Reads password only from `SUPABASE_TEST_PASSWORD` at runtime.
4. Uses service role only for fixture setup and cleanup.
5. Creates one active public writing problem, one soft unavailable saved problem, one hard unavailable saved problem, one draft, and one library item per scenario.

- [ ] **Step 2: Verify library flow**

In `hidden-problem-ux.spec.ts`:

```ts
test("saved unavailable problems remain in library with disabled retry", async ({ page }) => {
  await loginAsStudent(page);
  const fixture = await createHiddenProblemFixture();

  await page.goto("/library?tab=problems", { waitUntil: "networkidle" });
  await page.getByTestId("library-search").locator("input").fill(fixture.marker);

  await expect(page.getByText("제공 종료")).toBeVisible();
  await expect(page.getByRole("button", { name: /다시 풀 수 없음/ })).toBeDisabled();
  await expect(page.getByText("더 이상 제공되지 않는 문제")).toBeVisible();
});
```

- [ ] **Step 3: Verify already-open submit failure**

In the same spec:

```ts
test("submit after problem deactivation preserves answer and does not offer retry", async ({ page }) => {
  await loginAsStudent(page);
  const fixture = await createActiveWritingProblemFixture();

  await page.goto(`/writing/short-answer-writing-51?problem=${fixture.problemId}`, {
    waitUntil: "networkidle",
  });
  const answer = "a".repeat(90);
  await page.locator("textarea").first().fill(answer);

  await deactivateProblem(fixture.problemId, "품질 점검 중");
  await page.locator("button.ant-btn-primary").first().click();
  await page.getByTestId("submission-confirm-submit").click();

  await expect(page.getByTestId("submission-failed-modal")).toBeVisible();
  await expect(page.getByTestId("submission-failed-retry")).toHaveCount(0);
  await expect(page.locator("textarea").first()).toHaveValue(answer);
  await expect(page.getByRole("link", { name: "다른 문제 선택" })).toHaveAttribute(
    "href",
    "/practice/problems",
  );
});
```

- [ ] **Step 4: Run focused E2E**

Run:

```powershell
pnpm exec playwright test tests/e2e/screens/hidden-problem-ux.spec.ts --project=chromium
```

Expected: PASS with no page errors, console errors, or 500 responses.

---

## Task 8: Final Verification And Handoff

**Files:**

- No new code files.

- [ ] **Step 1: Run focused unit/component tests**

Run:

```powershell
pnpm vitest run tests/lib/problems/availability.test.ts tests/lib/library/server.test.ts tests/components/library/LibrarySavedProblemsTab.test.tsx tests/lib/writing/server-actions.test.ts tests/components/writing/SubmissionFailedModal.test.tsx tests/components/practice/ProblemListView.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```powershell
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Run focused E2E**

Run:

```powershell
pnpm exec playwright test tests/e2e/screens/hidden-problem-ux.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 5: SOT completion report**

Final report must include:

- 읽은 SOT: `README.md`, `docs/prd.md`, `docs/Wireframe/06-C-02-problem-list/functional-spec.md`, `docs/Wireframe/18-F-01-my-library/functional-spec.md`, `docs/Wireframe/12-D-M1-submission-confirmation-modal/functional-spec.md`, `docs/sot-change-proposals/writing-submission-guard-sot-update-2026-06-17.md`, relevant migrations.
- 확인한 요구사항: 신규 노출 차단, 기존 기록 보존, 내 서재 ledger 보존, deterministic submit failure UX.
- 충돌 여부: grace 제출 허용은 현행 guard와 충돌하므로 구현하지 않음.
- 갱신 필요 문서: existing SOT 직접 수정 없음, new SOT proposal created.

## Self-Review

Spec coverage:

- 새 탐색/추천 차단: Task 6.
- 문제 목록 disabled UX: Task 6.
- 내 서재 ledger 보존: Task 3 and Task 4.
- 작성 중 제출 실패 UX: Task 5 and Task 7.
- hidden deep link/draft preservation: Task 5.
- 기존 제출/피드백 보존 and retry guard: Task 6.
- SOT proposal: Task 1.

Critic notes:

- The widest risk is the new SECURITY DEFINER RPC. It must return only caller-owned `library_items` and must not expose hard-hidden problem title/body.
- Do not weaken `private.assert_writing_problem_submittable`; it is the final server safety boundary.
- Do not solve this by only hiding buttons in React. The core submission guard must remain in Postgres.
- Do not directly edit active Wireframe SOT in the implementation pass. Keep SOT changes in the proposal file until accepted.

Execution handoff:

- Recommended execution mode: Subagent-driven by independent slices: DB/RPC, library UI, writing submit UX, E2E verification.
- Inline execution is also possible if the implementer updates the checklist after each task and runs focused tests before moving on.
