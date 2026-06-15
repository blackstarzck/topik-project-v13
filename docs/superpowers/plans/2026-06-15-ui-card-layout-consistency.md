# UI Card Layout Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Practice 핵심 화면의 카드, 선택 상태, 액션 footer, 페이지/섹션 위계를 공통 계약으로 정리해 `/practice/recommendations`, `/practice/problems`, `/practice/next`, `/practice/weakness`가 같은 UI 언어를 쓰도록 만든다.

**Architecture:** `AppCard`는 계속 AntD `Card` 표면 wrapper로 유지하고, 카드형 선택 동작은 별도 `SelectableAppCard` wrapper로 분리한다. 필터/탭처럼 카드가 아닌 선택 control은 억지로 카드화하지 않고 native `button` 또는 AntD `Segmented` 의미론을 유지하되 shared selected tile class만 공유한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Ant Design, Tailwind utility layer, Playwright e2e, Vitest component tests.

---

## Discussion Result

검토 에이전트 4개를 병렬 호출했다.

- Designer: 선택 카드, 필터 타일, Segmented 탭, 추천 카드를 한 컴포넌트로 합치면 접근성 의미가 흐려진다고 지적했다.
- Architect: `AppCard`에 선택 상태를 넣지 말고 `SelectableAppCard`를 추가하라는 결론을 냈다.
- Test engineer: 스타일 작업이므로 component test 외에 focused Playwright e2e와 desktop/tablet/mobile 시각 검수가 필수라고 정리했다.
- Critic: 초안은 과범위라며 practice 4개 route를 우선 처리하고 learning/dashboard/report/settings 전체 migration은 뒤로 미루라고 판정했다.

이 계획은 위 결론을 반영한다.

## Non-Goals

- billing/payment/provider SDK 또는 실결제 흐름을 추가하지 않는다.
- `/paywall`, `/subscription`의 구매/plan 동작을 변경하지 않는다.
- admin 기능, route, schema를 만들거나 수정하지 않는다.
- dashboard/learning/report/settings 전체 카드 migration을 첫 작업 범위에 넣지 않는다.
- `AppCard`를 selected, locked, analytics까지 가진 만능 compound component로 만들지 않는다.
- theme token, `--app-*` bridge, AntD `ConfigProvider` token 구조를 바꾸지 않는다.
- broad global `.ant-card*` override를 추가하지 않는다.
- 추천 로직, 문제 선택 로직, 제품 copy를 스타일 정리 명목으로 바꾸지 않는다.

## File Structure

### Shared UI

- Modify: `src/components/shared/AppCard.tsx`
  - `actions`가 있는 카드에 기본 `classNames.actions = "app-card-footer-actions"`를 병합한다.
  - `.app-card` / `.app-surface` hook과 caller `className`, `classNames`를 보존한다.
- Create: `src/components/shared/SelectableAppCard.tsx`
  - 카드형 선택 UI 전용 wrapper.
  - 내부는 반드시 `AppCard`를 사용한다.
  - `selected`, `disabled`, `locked`, keyboard Enter/Space, `aria-pressed`, `aria-disabled`를 한 곳에서 처리한다.
- Modify: `src/styles/global.css`
  - `.selectable-app-card*`와 `.app-selectable-tile*`만 추가한다.
  - 기존 `.weakness-recommendation-card*`, `.problem-type-tabs*`는 migration 완료 전 삭제하지 않는다.

### Practice Migration

- Modify: `src/components/practice/NextProblemView.tsx`
  - primary recommendation 선택 표면을 `SelectableAppCard`로 교체한다.
  - `WorkspaceFixedActionBar`는 유지한다.
- Modify: `src/components/practice/AlternativeCardsGrid.tsx`
  - alternative recommendation 선택 표면을 `SelectableAppCard`로 교체한다.
  - locked card는 선택 가능 카드와 interaction contract를 분리한다.
- Modify: `src/components/practice/WeaknessView.tsx`
  - 추천 카드 선택 표면을 `SelectableAppCard`로 교체한다.
  - 추천 시작 CTA는 기존 `logStudyEvent`, `consumeRecommendationItem`, dup-click guard를 유지한다.
- Modify: `src/components/practice/RecommendationItemCards.tsx`
  - C-01 대표/보조 추천 카드의 CTA를 body 내부 버튼에서 `Card.actions`로 옮긴다.
- Modify: `src/components/practice/ProblemTypeFilterCards.tsx`
  - native `button` 의미론과 `aria-pressed`를 유지하고 `app-selectable-tile` class contract만 적용한다.
- Keep: `src/components/practice/ProblemTypeTabs.tsx`
  - AntD `Segmented` 의미론은 유지한다. 필요 시 CSS selected 표현만 selected tile language에 맞춘다.
- Keep: `src/components/app/WorkspaceBody.tsx`
  - heading 문제를 해결하려고 `WorkspaceBody` 계약을 확장하지 않는다.

### Tests

- Modify: `tests/components/shared/SharedPilotComponents.test.tsx`
- Modify: `tests/components/practice/NextProblemView.test.tsx`
- Modify: `tests/components/practice/WeaknessView.test.tsx`
- Modify: `tests/components/practice/RecommendationsView.test.tsx`
- Modify: `tests/components/practice/ProblemListView.test.tsx`
- Modify: `tests/e2e/screens/next-problem.spec.ts`
- Modify: `tests/e2e/screens/weakness-recommendations.spec.ts`
- Use existing: `tests/e2e/screens/screens-authed.spec.ts`
- Use existing: `tests/e2e/screens/workspace-layout.spec.ts`

## Acceptance Criteria

- 모든 새 user-facing card surface는 `AppCard` 또는 `SelectableAppCard`를 통해 `.app-card` / `.app-surface` hook을 가진다.
- `AppCard`의 caller `className`, `classNames`, `actions`, `title`, `extra`, `size`, `data-testid`가 보존된다.
- 카드 레벨 CTA는 `Card.actions`와 `app-card-footer-actions`로 통일한다.
- 카드 body에는 본문, 근거, metadata만 남긴다.
- `/practice/next`와 `/practice/weakness`의 선택 카드는 mouse click과 Enter/Space keyboard 모두로 선택된다.
- 선택 상태는 색상만으로 구분하지 않고 border/shadow/check cue 또는 텍스트 상태를 함께 제공한다.
- `disabled` 또는 `locked` 상태에서는 click/keyboard selection이 실행되지 않는다.
- `/practice/next`의 fixed action bar는 카드 footer로 흡수하지 않는다.
- `/practice/problems`의 type filter는 native `button` + `aria-pressed`를 유지한다.
- `/practice/recommendations`의 AntD `Segmented` type tab keyboard behavior는 유지한다.
- `logStudyEvent`, `consumeRecommendationItem`, dup-click guard, URL filter state가 유지된다.
- mobile `360x720`, tablet `768x1024`, desktop `1280x800`에서 horizontal overflow, text overlap, CTA overlap이 없다.
- focused component tests, focused e2e, `pnpm lint`, `pnpm typecheck`가 모두 통과한다.

## Rollback Strategy

- Phase 1은 additive shared component만 추가한다. route migration 전이면 `SelectableAppCard.tsx`와 새 CSS block만 되돌리면 된다.
- Route migration은 `/practice/next` -> `/practice/weakness` -> `/practice/recommendations` -> `/practice/problems` 순서로 분리한다.
- 기존 CSS class는 migration phase에서 즉시 삭제하지 않는다. visual/e2e 검수 후 마지막 cleanup에서 제거한다.
- shared CSS 삭제는 모든 focused e2e와 desktop/mobile screenshot 검수 뒤에만 수행한다.

---

### Task 0: Baseline Inventory and Visual Checkpoints

**Files:**
- Read: `docs/Wireframe/05-C-01-problem-type-recommendations/browser-screenshot--default--desktop.png`
- Read: `docs/Wireframe/06-C-02-problem-list/browser-screenshot--default--desktop.png`
- Read: `docs/Wireframe/17-R-02-next-problem-recommendation/browser-screenshot--default--desktop.png`
- Read: `docs/Wireframe/29-X-07-weakness-based-recommendations/browser-screenshot--default--desktop.png`
- Read: `src/components/practice/NextProblemView.tsx`
- Read: `src/components/practice/AlternativeCardsGrid.tsx`
- Read: `src/components/practice/WeaknessView.tsx`
- Read: `src/components/practice/RecommendationItemCards.tsx`
- Read: `src/components/practice/ProblemTypeFilterCards.tsx`
- Read: `src/components/practice/ProblemTypeTabs.tsx`

- [ ] **Step 1: Record the current route pattern table**

Create a local implementation note in the active run log if one already exists for this work. If not, use the final implementation summary instead of adding a new doc. Capture this table before editing:

```markdown
| Route | Card Surface | Selected State | CTA Placement | Control Semantics |
| --- | --- | --- | --- | --- |
| /practice/next | AppCard | ring-2 ring-primary | fixed action bar | card role=button |
| /practice/weakness | AppCard | weakness-recommendation-card--selected | Card.actions + primary CTA | clickable card |
| /practice/recommendations | AppCard | ProblemTypeTabs Segmented | body button in RecommendationItemCards | Segmented + link cards |
| /practice/problems | AppCard + native button filter | border-text shadow-sm | list row actions | button aria-pressed |
```

- [ ] **Step 2: Run baseline focused component tests**

Run:

```powershell
pnpm exec vitest run `
  tests/components/shared/SharedPilotComponents.test.tsx `
  tests/components/practice/NextProblemView.test.tsx `
  tests/components/practice/WeaknessView.test.tsx `
  tests/components/practice/RecommendationsView.test.tsx `
  tests/components/practice/ProblemListView.test.tsx `
  tests/components/practice/SummaryCardRow.test.tsx
```

Expected: PASS or existing unrelated failures documented with test names.

- [ ] **Step 3: Run baseline focused e2e**

Start dev server if it is not already running:

```powershell
pnpm dev
```

Run focused e2e:

```powershell
pnpm exec playwright test `
  tests/e2e/screens/next-problem.spec.ts `
  tests/e2e/screens/weakness-recommendations.spec.ts `
  tests/e2e/screens/workspace-layout.spec.ts `
  --project mobile-360 --project tablet-768 --project desktop-1280
```

Expected: PASS. If auth/data setup fails, record exact failing test and missing prerequisite before editing.

---

### Task 1: Lock Shared Component Contract Tests

**Files:**
- Modify: `tests/components/shared/SharedPilotComponents.test.tsx`
- Test target: `src/components/shared/AppCard.tsx`
- Future test target: `src/components/shared/SelectableAppCard.tsx`

- [ ] **Step 1: Add failing AppCard actions class test**

Add tests equivalent to:

```tsx
import { Button } from "antd";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppCard } from "@/components/shared/AppCard";
import { SelectableAppCard } from "@/components/shared/SelectableAppCard";

it("applies shared footer action class when actions are provided", () => {
  render(
    <AppCard title="Card title" actions={[<Button key="go">Go</Button>]}>
      Body
    </AppCard>,
  );

  const actions = document.querySelector(".ant-card-actions");
  expect(actions).toHaveClass("app-card-footer-actions");
});
```

Expected before implementation: FAIL if `AppCard` does not merge `app-card-footer-actions`.

- [ ] **Step 2: Add failing SelectableAppCard accessibility tests**

Add tests equivalent to:

```tsx
it("exposes selected state with aria and shared class", () => {
  render(
    <SelectableAppCard selected onSelect={() => undefined} title="Recommended">
      Body
    </SelectableAppCard>,
  );

  const card = screen.getByRole("button", { name: /recommended/i });
  expect(card).toHaveAttribute("aria-pressed", "true");
  expect(card).toHaveClass("selectable-app-card--selected");
});

it("supports Enter and Space selection", () => {
  const onSelect = vi.fn();
  render(
    <SelectableAppCard onSelect={onSelect} title="Recommended">
      Body
    </SelectableAppCard>,
  );

  const card = screen.getByRole("button", { name: /recommended/i });
  fireEvent.keyDown(card, { key: "Enter" });
  fireEvent.keyDown(card, { key: " " });

  expect(onSelect).toHaveBeenCalledTimes(2);
});

it("does not select when disabled", () => {
  const onSelect = vi.fn();
  render(
    <SelectableAppCard disabled onSelect={onSelect} title="Recommended">
      Body
    </SelectableAppCard>,
  );

  const card = screen.getByRole("button", { name: /recommended/i });
  fireEvent.click(card);
  fireEvent.keyDown(card, { key: "Enter" });

  expect(card).toHaveAttribute("aria-disabled", "true");
  expect(onSelect).not.toHaveBeenCalled();
});
```

Expected before implementation: FAIL because `SelectableAppCard` does not exist.

- [ ] **Step 3: Run shared component tests and verify expected failures**

Run:

```powershell
pnpm exec vitest run tests/components/shared/SharedPilotComponents.test.tsx
```

Expected: FAIL on missing `SelectableAppCard` and/or missing `app-card-footer-actions` merge.

---

### Task 2: Add Shared Card Contracts

**Files:**
- Modify: `src/components/shared/AppCard.tsx`
- Create: `src/components/shared/SelectableAppCard.tsx`
- Modify: `src/styles/global.css`
- Test: `tests/components/shared/SharedPilotComponents.test.tsx`

- [ ] **Step 1: Update AppCard to merge default actions class**

Implement this shape:

```tsx
import { Card } from "antd";
import type { CardProps } from "antd";

function mergeClassNames(
  classNames: CardProps["classNames"],
  hasActions: boolean,
): CardProps["classNames"] {
  if (!hasActions) return classNames;

  return {
    ...classNames,
    actions: ["app-card-footer-actions", classNames?.actions]
      .filter(Boolean)
      .join(" "),
  };
}

export function AppCard({
  className,
  classNames,
  actions,
  ...props
}: CardProps) {
  return (
    <Card
      {...props}
      actions={actions}
      classNames={mergeClassNames(classNames, Boolean(actions?.length))}
      className={["app-card", "app-surface", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
```

- [ ] **Step 2: Add SelectableAppCard**

Create `src/components/shared/SelectableAppCard.tsx`:

```tsx
"use client";

import type { KeyboardEvent, ReactNode } from "react";
import type { CardProps } from "antd";
import { Check } from "lucide-react";
import { AppCard } from "./AppCard";

type Props = Omit<CardProps, "onSelect"> & {
  selected?: boolean;
  disabled?: boolean;
  locked?: boolean;
  selectedLabel?: ReactNode;
  onSelect?: () => void;
};

export function SelectableAppCard({
  selected = false,
  disabled = false,
  locked = false,
  selectedLabel,
  onSelect,
  className,
  children,
  role,
  tabIndex,
  onClick,
  onKeyDown,
  ...props
}: Props) {
  const interactive = typeof onSelect === "function";
  const unavailable = disabled || locked;

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    onClick?.(event);
    if (event.defaultPrevented || unavailable) return;
    onSelect?.();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || unavailable) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect?.();
  }

  return (
    <AppCard
      {...props}
      role={interactive ? "button" : role}
      tabIndex={interactive && !unavailable ? 0 : tabIndex}
      aria-pressed={interactive ? selected : undefined}
      aria-disabled={interactive && unavailable ? true : undefined}
      onClick={interactive ? handleClick : onClick}
      onKeyDown={interactive ? handleKeyDown : onKeyDown}
      className={[
        "selectable-app-card",
        selected ? "selectable-app-card--selected" : null,
        unavailable ? "selectable-app-card--disabled" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="selectable-app-card__content">
        {children}
        {selected ? (
          <span className="selectable-app-card__cue">
            <Check size={14} aria-hidden="true" />
            {selectedLabel ? <span>{selectedLabel}</span> : null}
          </span>
        ) : null}
      </div>
    </AppCard>
  );
}
```

If TypeScript requires a React import for `React.MouseEvent`, use `import type { KeyboardEvent, MouseEvent, ReactNode } from "react";` and replace `React.MouseEvent<HTMLDivElement>` with `MouseEvent<HTMLDivElement>`.

- [ ] **Step 3: Add scoped CSS hooks**

Add this block near existing `.app-card-footer-actions` styles in `src/styles/global.css`:

```css
.selectable-app-card {
  position: relative;
  transition:
    border-color var(--app-motion-duration-fast) var(--app-motion-ease-standard),
    box-shadow var(--app-motion-duration-fast) var(--app-motion-ease-standard),
    transform var(--app-motion-duration-fast) var(--app-motion-ease-standard);
}

.selectable-app-card[role="button"] {
  cursor: pointer;
}

.selectable-app-card[role="button"]:focus-visible {
  outline: 2px solid var(--app-color-primary);
  outline-offset: 2px;
}

.selectable-app-card--selected {
  border-color: var(--app-color-primary);
  box-shadow:
    var(--app-shadow-elevated),
    0 0 0 1.5px var(--app-color-primary) inset;
}

.selectable-app-card--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.selectable-app-card__content {
  position: relative;
  display: flex;
  min-width: 0;
  width: 100%;
  flex-direction: column;
  gap: 0.75rem;
}

.selectable-app-card__cue {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-color-primary);
  color: var(--app-color-background);
  padding: 0.125rem 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.app-selectable-tile {
  transition:
    border-color var(--app-motion-duration-fast) var(--app-motion-ease-standard),
    box-shadow var(--app-motion-duration-fast) var(--app-motion-ease-standard);
}

.app-selectable-tile[aria-pressed="true"] {
  border-color: var(--app-color-primary);
  box-shadow: 0 0 0 1.5px var(--app-color-primary) inset;
}

.app-selectable-tile:focus-visible {
  outline: 2px solid var(--app-color-primary);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Run AntD lint for touched shared files**

Run:

```powershell
pnpm exec antd lint src/components/shared/AppCard.tsx src/components/shared/SelectableAppCard.tsx --format json
```

Expected: no new AntD lint violations.

- [ ] **Step 5: Run shared component tests**

Run:

```powershell
pnpm exec vitest run tests/components/shared/SharedPilotComponents.test.tsx
```

Expected: PASS.

---

### Task 3: Migrate R-02 Next Problem Selection Cards

**Files:**
- Modify: `src/components/practice/NextProblemView.tsx`
- Modify: `src/components/practice/AlternativeCardsGrid.tsx`
- Modify: `tests/components/practice/NextProblemView.test.tsx`
- Modify: `tests/e2e/screens/next-problem.spec.ts`

- [ ] **Step 1: Replace primary selectable AppCard**

In `NextProblemView.tsx`, replace the primary `AppCard` selection surface with `SelectableAppCard`.

Required behavior:

```tsx
<SelectableAppCard
  selected={selected?.source === "next"}
  selectedLabel={t("selectedProblem")}
  onSelect={selectPrimary}
  data-testid="next-primary-card"
  data-problem-id={primary.problemId}
  title={...}
>
  ...
</SelectableAppCard>
```

Keep `WorkspaceFixedActionBar` and `handleStart` unchanged except for type adjustments.

- [ ] **Step 2: Replace alternative selectable AppCard**

In `AlternativeCardsGrid.tsx`, replace unlocked alternative `AppCard` with `SelectableAppCard`.

Required behavior:

```tsx
<SelectableAppCard
  selected={selectedId === alternative.id}
  onSelect={handleClick}
  data-testid="next-alternative-card"
  data-problem-id={alternative.id}
  title={...}
>
  ...
</SelectableAppCard>
```

Keep locked cards as non-selectable `AppCard` with `aria-disabled` only if needed. Do not make locked cards keyboard-selectable.

- [ ] **Step 3: Remove Tailwind ring selection**

Remove:

```tsx
className={selected?.source === "next" ? "ring-2 ring-primary" : undefined}
```

and:

```tsx
className={selectedId === alternative.id ? "ring-2 ring-primary" : undefined}
```

Expected: no `ring-2 ring-primary` remains in `NextProblemView.tsx` or `AlternativeCardsGrid.tsx`.

- [ ] **Step 4: Add component tests for keyboard and fixed CTA**

In `tests/components/practice/NextProblemView.test.tsx`, add coverage equivalent to:

```tsx
it("selects an alternative card with keyboard and starts from the fixed CTA", async () => {
  const user = userEvent.setup();
  render(<NextProblemView bundle={bundleWithPrimaryAndAlternatives} />);

  const alternative = screen.getAllByTestId("next-alternative-card")[0];
  alternative.focus();
  await user.keyboard("[Enter]");

  expect(alternative).toHaveAttribute("aria-pressed", "true");
  await user.click(screen.getByTestId("next-fixed-start"));

  expect(mockRouterPush).toHaveBeenCalledWith(
    expect.stringContaining("/writing/"),
  );
});
```

Use existing test helpers and router mocks in the file. Keep assertions testid/role based, not Korean copy based.

- [ ] **Step 5: Run Next component tests**

Run:

```powershell
pnpm exec vitest run tests/components/practice/NextProblemView.test.tsx tests/components/shared/SharedPilotComponents.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run Next e2e on all viewport projects**

Run:

```powershell
pnpm exec playwright test tests/e2e/screens/next-problem.spec.ts --project mobile-360 --project tablet-768 --project desktop-1280
```

Expected: PASS. Visually confirm selected card cue, no horizontal overflow, fixed action bar alignment.

---

### Task 4: Migrate X-07 Weakness Recommendation Cards

**Files:**
- Modify: `src/components/practice/WeaknessView.tsx`
- Modify: `src/styles/global.css`
- Modify: `tests/components/practice/WeaknessView.test.tsx`
- Modify: `tests/e2e/screens/weakness-recommendations.spec.ts`

- [ ] **Step 1: Replace recommendation cards with SelectableAppCard**

In `WeaknessView.tsx`, change recommendation cards:

```tsx
<SelectableAppCard
  selected={isSelected}
  selectedLabel={t("selectedRecommendation")}
  onSelect={() => setSelectedId(rec.problem_id)}
  title={truncateRecommendationTitle(rec.title)}
  extra={<Tag>{tCommon("questionItem", { no: rec.question_no })}</Tag>}
  actions={[...]}
  data-testid={`weakness-rec-${rec.problem_id}`}
>
  ...
</SelectableAppCard>
```

Keep action button `event.stopPropagation()` for the inner select button if the button remains. If the selected cue makes the inner select button redundant, remove the inner select button only after component tests prove keyboard selection still works.

- [ ] **Step 2: Preserve analytics and consume behavior**

Do not change:

```tsx
void logStudyEvent({
  eventType: "recommendation_clicked",
  problemId: rec.problem_id,
  payload: { source: "weakness" },
});
void consumeRecommendationItem(rec.item_id ?? null);
```

Do not remove `startedRef` or `startingId` guard.

- [ ] **Step 3: Keep compatibility CSS during migration**

Keep `.weakness-recommendation-card` and `.weakness-recommendation-card--selected` only as compatibility if still referenced. If references are removed from TSX, leave a short cleanup comment in the implementation summary and remove CSS in Task 7 after e2e passes.

- [ ] **Step 4: Add component tests**

In `tests/components/practice/WeaknessView.test.tsx`, add coverage equivalent to:

```tsx
it("changes selected recommendation with keyboard without starting navigation", async () => {
  const user = userEvent.setup();
  render(<WeaknessView {...propsWithRecommendations} />);

  const secondCard = screen.getByTestId("weakness-rec-problem-2");
  secondCard.focus();
  await user.keyboard("[Enter]");

  expect(secondCard).toHaveAttribute("aria-pressed", "true");
  expect(logStudyEvent).not.toHaveBeenCalled();
  expect(mockRouterPush).not.toHaveBeenCalled();
});

it("starts the selected recommendation once from the primary CTA", async () => {
  const user = userEvent.setup();
  render(<WeaknessView {...propsWithRecommendations} />);

  await user.click(screen.getByTestId("weakness-primary-start"));
  await user.click(screen.getByTestId("weakness-primary-start"));

  expect(logStudyEvent).toHaveBeenCalledTimes(1);
  expect(consumeRecommendationItem).toHaveBeenCalledTimes(1);
  expect(mockRouterPush).toHaveBeenCalledTimes(1);
});
```

Use the existing mock ids and helper data in the file.

- [ ] **Step 5: Run Weakness tests**

Run:

```powershell
pnpm exec vitest run tests/components/practice/WeaknessView.test.tsx tests/components/shared/SharedPilotComponents.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run Weakness e2e**

Run:

```powershell
pnpm exec playwright test tests/e2e/screens/weakness-recommendations.spec.ts --project mobile-360 --project tablet-768 --project desktop-1280
```

Expected: PASS. Confirm no duplicate title, selected card cue is visible, recommendation grid does not overflow.

---

### Task 5: Normalize C-01 Recommendation Cards and CTA Placement

**Files:**
- Modify: `src/components/practice/RecommendationItemCards.tsx`
- Modify: `src/components/practice/RecommendationsView.tsx`
- Modify: `tests/components/practice/RecommendationsView.test.tsx`

- [ ] **Step 1: Move primary recommendation CTA into Card.actions**

In `PrimaryRecommendationCard`, replace body CTA block:

```tsx
<div className="mt-4">
  <Link href={ctaHref(card) as never}>
    <Button type="primary" size="large" block>
      {t("startFromThis")}
      <ArrowRight size={18} aria-hidden="true" />
    </Button>
  </Link>
</div>
```

with `actions` on `AppCard`:

```tsx
actions={[
  <Link key="start" href={ctaHref(card) as never} className="block w-full">
    <Button type="primary" size="large" block>
      {t("startFromThis")}
      <ArrowRight size={18} aria-hidden="true" />
    </Button>
  </Link>,
]}
```

- [ ] **Step 2: Move secondary recommendation CTA into Card.actions**

Apply the same pattern in `SecondaryRecommendationCard`:

```tsx
actions={[
  <Link key="continue" href={ctaHref(card) as never} className="block w-full">
    <Button block>
      {t("continueProblem")}
      <ArrowRight size={16} aria-hidden="true" />
    </Button>
  </Link>,
]}
```

Remove the body CTA wrapper after actions are present.

- [ ] **Step 3: Keep ProblemTypeTabs semantics**

Do not replace `ProblemTypeTabs` with `SelectableAppCard`. If selected styling needs adjustment, change only scoped `.problem-type-tabs` CSS and keep AntD `Segmented`.

- [ ] **Step 4: Add Recommendations component tests**

In `tests/components/practice/RecommendationsView.test.tsx`, assert:

```tsx
expect(document.querySelectorAll(".app-card-footer-actions").length).toBeGreaterThan(0);
expect(screen.getByRole("link", { name: /start|시작|continue|이어/i })).toBeInTheDocument();
```

Prefer existing testid or route href assertions if the file already avoids localized text.

- [ ] **Step 5: Run Recommendations tests**

Run:

```powershell
pnpm exec vitest run tests/components/practice/RecommendationsView.test.tsx tests/components/shared/SharedPilotComponents.test.tsx
```

Expected: PASS.

---

### Task 6: Normalize C-02 Problem Type Filter Tiles

**Files:**
- Modify: `src/components/practice/ProblemTypeFilterCards.tsx`
- Modify: `src/styles/global.css`
- Modify: `tests/components/practice/ProblemListView.test.tsx`

- [ ] **Step 1: Keep native button and add shared tile class**

In `ProblemTypeFilterCards.tsx`, keep:

```tsx
<button type="button" aria-pressed={selected} onClick={() => onChange(option.value)}>
```

Change class composition to include shared tile hooks:

```tsx
className={[
  "app-selectable-tile flex min-w-44 flex-none items-center gap-3 rounded-default border bg-background p-4 text-left transition",
  selected ? "app-selectable-tile--selected" : "hover:border-text",
]
  .filter(Boolean)
  .join(" ")}
```

If `app-selectable-tile--selected` is added, mirror `[aria-pressed="true"]` styling in CSS:

```css
.app-selectable-tile--selected {
  border-color: var(--app-color-primary);
  box-shadow: 0 0 0 1.5px var(--app-color-primary) inset;
}
```

- [ ] **Step 2: Preserve URL/filter behavior tests**

In `tests/components/practice/ProblemListView.test.tsx`, ensure existing test coverage still proves:

```tsx
expect(screen.getByRole("button", { name: /51/ })).toHaveAttribute(
  "aria-pressed",
  "true",
);
expect(mockRouterReplace).toHaveBeenCalledWith(expect.stringContaining("type=51"));
```

Use the existing router mock and accessible names from the file.

- [ ] **Step 3: Run Problem List tests**

Run:

```powershell
pnpm exec vitest run tests/components/practice/ProblemListView.test.tsx tests/components/shared/SharedPilotComponents.test.tsx
```

Expected: PASS.

---

### Task 7: Cleanup Legacy Selection CSS and Direct Card Drift Audit

**Files:**
- Modify: `src/styles/global.css`
- Inspect: `src/components/learning/AlertsCard.tsx`
- Inspect: `src/components/learning/RecommendationCard.tsx`
- Inspect: `src/components/learning/KpiCard.tsx`
- Inspect: `src/components/shared/PlaceholderPage.tsx`
- Do not migrate learning files in this task unless all practice e2e has already passed.

- [ ] **Step 1: Confirm legacy selection classes are unused**

Run:

```powershell
rg -n "ring-2 ring-primary|weakness-recommendation-card--selected|border-text shadow-sm" src/components src/styles/global.css
```

Expected: no usage in `src/components/practice/*`. If `global.css` still contains unused compatibility classes, remove only those classes.

- [ ] **Step 2: Confirm direct AntD Card usage remains known and deferred**

Run:

```powershell
rg -n "from \"antd\"|<Card" src/components/learning src/components/shared -S
```

Expected direct card usage list is limited to known deferred files. Record them in the implementation summary:

```text
Deferred direct Card audit:
- src/components/learning/AlertsCard.tsx
- src/components/learning/RecommendationCard.tsx
- src/components/learning/KpiCard.tsx
- src/components/shared/PlaceholderPage.tsx
```

- [ ] **Step 3: Do not touch payment/subscription behavior**

Verify no modified files include:

```text
src/components/settings/PaywallShell.tsx
src/components/settings/SubscriptionShell.tsx
src/app/(workspace)/paywall/page.tsx
src/app/(workspace)/subscription/page.tsx
```

If any of these files changed only because of formatting or accidental edits, revert only your own changes to those files.

---

### Task 8: Final Verification Gate

**Files:**
- No production file edits in this task.
- Verification targets: tests and browser/e2e output.

- [ ] **Step 1: Run lint**

Run:

```powershell
pnpm lint
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run focused component tests**

Run:

```powershell
pnpm exec vitest run `
  tests/components/shared/SharedPilotComponents.test.tsx `
  tests/components/practice/NextProblemView.test.tsx `
  tests/components/practice/WeaknessView.test.tsx `
  tests/components/practice/RecommendationsView.test.tsx `
  tests/components/practice/ProblemListView.test.tsx `
  tests/components/practice/SummaryCardRow.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run focused e2e for affected routes**

Run:

```powershell
pnpm exec playwright test `
  tests/e2e/screens/next-problem.spec.ts `
  tests/e2e/screens/weakness-recommendations.spec.ts `
  tests/e2e/screens/workspace-layout.spec.ts `
  --project mobile-360 --project tablet-768 --project desktop-1280
```

Expected: PASS.

- [ ] **Step 5: Run authed screen e2e for C-01/C-02/R-02/X-07**

Run:

```powershell
pnpm exec playwright test tests/e2e/screens/screens-authed.spec.ts `
  --grep "C-01|C-02|R-02|X-07" `
  --project mobile-360 --project tablet-768 --project desktop-1280
```

Expected: PASS.

- [ ] **Step 6: Escalate to full e2e if shared blast radius widened**

Run full e2e only if implementation touched `src/styles/global.css` broadly, AntD theme tokens, Tailwind bridge, `ConfigProvider`, app shell, shared navigation, or if route impact can no longer be limited to practice pages:

```powershell
pnpm test:e2e
```

Expected if run: PASS.

## Visual QA Checklist

Check desktop `1280x800`, tablet `768x1024`, mobile `360x720` for:

- `/practice/next`: primary and alternative selected states match; fixed action bar does not overlap body; keyboard selection works.
- `/practice/weakness`: no duplicate page title; recommendation cards have consistent selected cue; primary CTA still starts selected problem once.
- `/practice/recommendations`: primary/secondary card CTA appears in footer; type tabs remain keyboard accessible.
- `/practice/problems`: type filter buttons remain dense, scannable, and do not turn into oversized cards; URL filter state still changes.
- All four routes: no horizontal overflow, no badge/title/CTA text overlap, no nested card inside card unless it is a deliberate repeated item pattern.

## Completion Report Template

Use this final report shape:

```markdown
구현 범위:
- AppCard actions class 병합
- SelectableAppCard 추가
- /practice/next, /practice/weakness, /practice/recommendations, /practice/problems UI 공통화

검증:
- pnpm lint: PASS
- pnpm typecheck: PASS
- component tests: PASS
- focused e2e mobile/tablet/desktop: PASS

남은 범위:
- learning direct AntD Card audit is deferred
- paywall/subscription behavior unchanged
```
