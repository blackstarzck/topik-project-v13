# 추천 카드 Footer CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/practice/recommendations`의 `다른 추천` 카드에서 `이어 풀기` 버튼을 카드 본문이 아닌 Ant Design `Card.actions` footer에 배치한다.

**Architecture:** 대표 추천 카드는 그대로 두고 `SecondaryRecommendationCard`만 기존 공용 footer 패턴(`app-card-footer-actions`)을 사용한다. 카드 데이터, 링크, 그리드, 반응형 breakpoint는 변경하지 않으며 DOM 위치 회귀 테스트로 범위를 고정한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Ant Design `Card`, Vitest, Testing Library, Playwright

---

### Task 1: Footer 위치 회귀 테스트

**Files:**
- Modify: `tests/components/practice/RecommendationsView.test.tsx`

- [x] **Step 1: 실패 테스트 작성**

계산형 추천 bundle 테스트에서 두 secondary CTA를 찾고 각 버튼이 `.ant-card-actions` 안에 있으며 `.ant-card-body` 밖에 있는지 검증한다.

```tsx
const continueButtons = screen.getAllByRole("button", {
  name: koMessages.practice.recommendations.continueProblem,
});
expect(continueButtons).toHaveLength(2);
for (const button of continueButtons) {
  expect(button.closest(".ant-card-actions")).toBeTruthy();
  expect(button.closest(".ant-card-body")).toBeNull();
  expect(
    button.closest(".ant-card")?.querySelector(".app-card-footer-actions"),
  ).toBeTruthy();
}
```

- [x] **Step 2: RED 확인**

Run: `pnpm exec vitest run tests/components/practice/RecommendationsView.test.tsx`

Expected: 기존 CTA가 `.ant-card-body` 안에 있어 새 assertion이 실패한다.

### Task 2: Secondary 카드 footer 구현과 검증

**Files:**
- Modify: `src/components/practice/RecommendationItemCards.tsx`
- Test: `tests/components/practice/RecommendationsView.test.tsx`
- Modify: `tests/e2e/screens/recommendations-fallback-ui.spec.ts`

- [x] **Step 1: 최소 구현**

`SecondaryRecommendationCard`에 flex layout과 공용 footer class를 적용하고 기존 Link/Button을 `actions`로 이동한다.

```tsx
const secondaryCardClassNames = {
  body: "flex-1",
  actions: "app-card-footer-actions [&>li]:!px-3 [&>li]:!pb-3",
};

<AppCard
  className="flex h-full flex-col"
  classNames={secondaryCardClassNames}
  actions={[
    <Link
      key="continue"
      href={ctaHref(card) as never}
      className="block w-full"
    >
      <Button block>
        {t("continueProblem")}
        <ArrowRight size={16} aria-hidden="true" />
      </Button>
    </Link>,
  ]}
  size="small"
  title={
    card.questionNo
      ? tCommon("questionNo", { no: card.questionNo })
      : t("recommendationFallback")
  }
  extra={
    card.estimatedMinutes ? (
      <RecommendationBadge>
        {tCommon("minutes", { minutes: card.estimatedMinutes })}
      </RecommendationBadge>
    ) : null
  }
>
  <Text strong>{title}</Text>
  {card.reason ? (
    <Paragraph className="mt-2" type="secondary" ellipsis={{ rows: 2 }}>
      {card.reason}
    </Paragraph>
  ) : null}
  <WeaknessTags tags={card.weaknessTags} />
</AppCard>
```

- [x] **Step 2: GREEN 및 정적 검증**

Run:

```powershell
pnpm exec vitest run tests/components/practice/RecommendationsView.test.tsx
pnpm lint
pnpm typecheck
pnpm check:ui-contract
```

Expected: 모두 exit code 0.

- [x] **Step 3: 실제 화면 검증**

Run:

```powershell
pnpm exec playwright test tests/e2e/screens/recommendations-fallback-ui.spec.ts --project=mobile-360
pnpm exec playwright test tests/e2e/screens/recommendations-fallback-ui.spec.ts --project=desktop-1280
```

Expected: success/loading/error 흐름이 통과하고, desktop/mobile에서 secondary CTA footer가 카드 하단에 정렬되며 대표 CTA와 링크 대상은 유지된다.

- [x] **Step 4: diff 검토**

Run: `git diff --check && git diff -- src/components/practice/RecommendationItemCards.tsx tests/components/practice/RecommendationsView.test.tsx`

Expected: whitespace 오류가 없고 변경이 두 파일의 의도한 범위에 한정된다. Git stage/commit/push는 별도 사용자 승인 전 수행하지 않는다.
