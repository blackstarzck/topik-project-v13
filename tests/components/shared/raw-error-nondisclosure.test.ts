import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const USER_ERROR_SURFACES = [
  "src/app/(workspace)/onboarding/learning-goal/OnboardingNavCta.tsx",
  "src/components/dashboard/DashboardAlertsCard.tsx",
  "src/components/feedback/SaveToLibraryButton.tsx",
  "src/components/learning/LearningGoalForm.tsx",
  "src/components/library/ExportPdfButton.tsx",
  "src/components/library/LibraryItemRow.tsx",
  "src/components/library/LibraryWorkspace.tsx",
  "src/components/notifications/NotificationBell.tsx",
  "src/components/practice/ProblemBookmarkToggle.tsx",
  "src/components/profile/ExamGoalForm.tsx",
  "src/components/profile/ProfileForm.tsx",
  "src/components/settings/LanguageForm.tsx",
  "src/components/settings/NotificationPrefsForm.tsx",
  "src/components/settings/PaywallShell.tsx",
  "src/components/settings/SubscriptionShell.tsx",
  "src/components/practice/ProblemListView.tsx",
  "src/components/library/LibraryExportsTab.tsx",
  "src/components/library/LibraryReportsTab.tsx",
  "src/components/library/LibrarySavedProblemsTab.tsx",
  "src/components/library/LibrarySubmissionsTab.tsx",
  "src/components/reports/ComparisonTargetDrawer.tsx",
  "src/lib/export/pdf-export-client.ts",
];

const OPERATIONAL_FAILURE_SURFACES = [
  "src/components/library/LibraryItemRow.tsx",
  "src/components/notifications/NotificationBell.tsx",
  "src/components/profile/ProfileForm.tsx",
  "src/lib/export/pdf-export-client.ts",
];

const SERVER_AND_TOOL_FAILURE_SURFACES = [
  "src/app/auth/callback/route.ts",
  "src/app/auth/sign-out/route.ts",
  "src/app/auth/account-inactive/route.ts",
  "src/components/auth/AuthEntrySessionGuard.tsx",
  "src/components/auth/CallbackFragmentFallback.tsx",
  "scripts/backfill-comparison-blank-metrics.mjs",
  "scripts/design-review/full-ui-state-capture-qa.mjs",
  "tests/e2e/screens/notification-db-route-path.spec.ts",
];

describe("user-facing error nondisclosure", () => {
  it.each(USER_ERROR_SURFACES)(
    "does not render raw error.message in %s",
    (file) => {
      const source = readFileSync(file, "utf8");

      expect(source).not.toMatch(
        /\b(?:query|list|err|error)\??\.message\b|String\((?:err|error)\)/,
      );
    },
  );
});

describe("sanitized client operational failure events", () => {
  it.each(OPERATIONAL_FAILURE_SURFACES)(
    "uses the allowlisted no-sink event boundary in %s",
    (file) => {
      const source = readFileSync(file, "utf8");

      expect(source).toContain("createClientOperationalEvent");
      expect(source).toContain("emitClientOperationalEvent");
    },
  );
});

describe("sanitized server and privileged-tool failures", () => {
  it.each(SERVER_AND_TOOL_FAILURE_SURFACES)(
    "does not write provider or database error messages in %s",
    (file) => {
      const source = readFileSync(file, "utf8");

      expect(source).not.toMatch(
        /(?:console\.(?:error|info|warn)|throw new Error|\.push)\([^\n]*(?:error|result)\??\.message/,
      );
      expect(source).not.toMatch(
        /console\.(?:error|info|warn)\([^;\n]*,\s*(?:err|error|result)\s*\)/,
      );
      expect(source).not.toContain("errorDescription,");
    },
  );

  it("does not print user-linked comparison previews", () => {
    const source = readFileSync(
      "scripts/backfill-comparison-blank-metrics.mjs",
      "utf8",
    );

    expect(source).not.toContain("candidatePreview");
    expect(source).not.toContain("skippedPreview");
  });
});
