# Notification Settings Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/settings/notifications` behave honestly and verifiably: saved settings stop looking unsaved, custom days actually change state, delivery-history failures are visible, and external delivery copy stays clearly deferred.

**Architecture:** Keep the current Next.js App Router and Ant Design implementation. Fix state baselines inside `NotificationPrefsForm`, add a separate delivery-history load state, update notification copy, and add focused component/e2e coverage. Do not change Supabase schema or active SOT documents in this implementation.

**Tech Stack:** Next.js App Router, React, TypeScript, Ant Design, Supabase browser client, Vitest, Playwright.

---

## File Map

- Modify: `src/components/settings/NotificationPrefsForm.tsx`
  - Add `savedPrefs` as the saved baseline for the three boolean notification switches.
  - Add separate delivery-history status so load failure is not shown as an empty history.
  - Make `custom` frequency selection produce a visible custom state.
  - Split “selected channel” from “currently deliverable channel” copy/disabled logic.
- Modify: `messages/ko.json`, `messages/en.json`, `messages/vi.json`
  - Replace external-delivery copy with safer wording.
  - Add delivery-history load error copy.
  - Update no-channel helper text so it mentions in-app as the currently usable receive channel.
- Modify: `tests/components/settings/NotificationPrefsForm.test.tsx`
  - Mock notification settings/history reads.
  - Add saved-baseline, custom-frequency, and history-failure tests.
- Modify: `tests/e2e/screens/notification-settings.spec.ts`
  - Add save-success/reload persistence evidence.
  - Add dirty leave-confirm evidence.
  - Attach runtime error logs and screenshots for evidence.
- Add: `docs/sot-change-proposals/2026-06-21-x09-notification-settings-timezone-and-delivery-boundary.md`
  - Record that the current screen has a timezone selector while active SOT still says it is absent.
  - Keep active SOT unchanged until user approval.

## Task 1: SOT Proposal

**Files:**
- Create: `docs/sot-change-proposals/2026-06-21-x09-notification-settings-timezone-and-delivery-boundary.md`

- [ ] **Step 1: Write the proposal**

```markdown
# X-09 Notification Settings SOT Change Proposal

## Proposal

Keep the current timezone selector as an implemented user setting, and update X-09 SOT later to say timezone editing is implemented with the allowed values `Asia/Seoul`, `Asia/Ho_Chi_Minh`, and `UTC`.

## Delivery Boundary

Keep email/Zalo/push external delivery marked as deferred. The user-facing screen may save preferences, but must not imply external delivery has been verified as operational.
```

- [ ] **Step 2: Do not edit active SOT**

Expected: `docs/Wireframe/31-X-09-notification-settings/*` remains unchanged in this task.

## Task 2: Component Behavior Fixes

**Files:**
- Modify: `src/components/settings/NotificationPrefsForm.tsx`
- Modify: `messages/ko.json`
- Modify: `messages/en.json`
- Modify: `messages/vi.json`

- [ ] **Step 1: Add saved notification preference baseline**

Implementation shape:

```ts
const [savedPrefs, setSavedPrefs] = useState<NotificationPrefs>(() =>
  normalizePrefs(initialPrefs),
);

const prefsDirty = NOTIFICATION_PREF_KEYS.some(
  (key) => (values[key] ?? false) !== (savedPrefs[key] ?? false),
);
```

- [ ] **Step 2: Update save success baseline**

Implementation shape:

```ts
await prefsMutation.mutateAsync(computeNotificationDiff(values, savedPrefs));
setSavedPrefs(values);
```

Expected: after a switch-only save, the save button becomes disabled and leave confirmation is removed.

- [ ] **Step 3: Add separate history load state**

Implementation shape:

```ts
const [historyLoad, setHistoryLoad] = useState<HistoryLoad>({ status: "loading" });

if (historyResult.status === "rejected") {
  setLog([]);
  setHistoryLoad({ status: "error", message: historyResult.reason.message });
}
```

Expected: delivery history fetch failure displays an error alert, not the empty state.

- [ ] **Step 4: Make Custom frequency do something visible**

Implementation shape:

```ts
if (value === "custom") {
  setSettings((prev) => ({ ...prev, reminder_days: [] }));
}
```

Expected: selecting “사용자 지정” clears the day set, keeps the custom segment selected, and enables save.

- [ ] **Step 5: Update copy**

Required Korean wording:

```json
"deferredSummary": "앱 안 알림을 먼저 지원하고, 이메일/Zalo 발송은 준비 중입니다.",
"deferredNotice": "지금은 수신 채널·조건·시간을 저장합니다. 앱 안 알림은 사용할 수 있고, 이메일/Zalo 같은 외부 발송은 준비가 끝난 뒤 동작합니다.",
"noChannel": {
  "title": "사용 가능한 알림 채널이 꺼져 있습니다",
  "body": "지금 실제로 받을 수 있는 채널은 앱 안 알림입니다. 이메일과 Zalo는 희망 설정만 저장됩니다."
}
```

## Task 3: Component Tests

**Files:**
- Modify: `tests/components/settings/NotificationPrefsForm.test.tsx`

- [ ] **Step 1: Mock settings and delivery-history reads**

Implementation shape:

```ts
const fetchNotificationSettingsMock = vi.fn();
const fetchDeliveryHistoryMock = vi.fn();

vi.mock("@/components/notifications/notifications-data", () => ({
  fetchDeliveryHistory: (...args: unknown[]) => fetchDeliveryHistoryMock(...args),
}));
```

- [ ] **Step 2: Add saved-baseline test**

Expected assertions:

```ts
expect(saveButton.disabled).toBe(false);
submitForm(container);
await waitFor(() => expect(saveButton.disabled).toBe(true));
```

- [ ] **Step 3: Add custom-frequency test**

Expected assertions:

```ts
fireEvent.click(screen.getByText("사용자 지정"));
expect(screen.getByText("사용자 지정").closest(".ant-segmented-item")).toHaveClass("ant-segmented-item-selected");
expect(saveButton.disabled).toBe(false);
```

- [ ] **Step 4: Add history-failure test**

Expected assertions:

```ts
fetchDeliveryHistoryMock.mockRejectedValueOnce(new Error("history failed"));
fireEvent.click(screen.getByTestId("notification-details-toggle"));
expect(screen.getByText("발송 이력을 불러오지 못했어요")).toBeTruthy();
expect(screen.queryByText("아직 발송된 알림이 없습니다.")).toBeNull();
```

## Task 4: E2E Tests And Evidence

**Files:**
- Modify: `tests/e2e/screens/notification-settings.spec.ts`

- [ ] **Step 1: Add save/reload persistence test**

Flow:

1. Open `/settings/notifications`.
2. Toggle email checkbox.
3. Click `저장`.
4. Confirm success toast.
5. Confirm save button disabled.
6. Reload.
7. Confirm email checkbox keeps the saved state.
8. Restore original email state and save.

- [ ] **Step 2: Add leave-confirm test**

Flow:

1. Toggle a switch.
2. Click an internal link.
3. Dismiss confirm and assert the route stays `/settings/notifications`.
4. Click again, accept confirm, and assert route changes.

- [ ] **Step 3: Capture evidence**

Use `testInfo.outputPath()` and `page.screenshot()`:

```ts
await page.screenshot({ path: testInfo.outputPath("save-success.png"), fullPage: true });
await testInfo.attach("runtime-errors.json", {
  body: JSON.stringify(errors, null, 2),
  contentType: "application/json",
});
```

## Task 5: Verification

**Commands:**

```powershell
pnpm vitest run tests/components/settings/NotificationPrefsForm.test.tsx
pnpm typecheck
$env:E2E_BASE_URL="http://127.0.0.1:3100"; pnpm exec playwright test tests/e2e/screens/notification-settings.spec.ts --project=desktop-1280 --trace=on --screenshot=on
$env:E2E_BASE_URL="http://127.0.0.1:3100"; pnpm exec playwright test tests/e2e/screens/notification-settings.spec.ts --project=mobile-360 --trace=on --screenshot=on
```

**Evidence to report:**

- Command result for component tests.
- Command result for typecheck.
- Desktop and mobile Playwright result.
- Paths to screenshot/trace evidence created by Playwright.
- SOT check: read SOT, confirmed requirements, conflict status, document update proposal path.

---

## Self-Review

- Spec coverage: covers saved baseline, custom frequency, history error, copy honesty, SOT conflict handling, e2e evidence.
- Placeholder scan: no task uses TBD or open-ended “add tests” language.
- Type consistency: all new state names are local to `NotificationPrefsForm`.
