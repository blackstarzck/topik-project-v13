import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateNotificationTransitionRoute,
  formatNotificationTransitionRouteReport,
} from "../../scripts/check-notification-transition-route.mjs";

let tempDirs = [];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "v13-notification-transition-route-"));
  tempDirs.push(root);
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "tests"), { recursive: true });
  return root;
}

function write(root, relativePath, content) {
  const file = join(root, relativePath);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content, "utf8");
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("check-notification-transition-route", () => {
  it("allows the transition route file and route registry references", () => {
    const root = createTempRoot();
    write(root, "src/app/api/notifications/dispatch-email/route.ts", "/api/notifications/dispatch-email");
    write(root, "src/lib/routes.ts", "apiNotificationsDispatchEmail api-notifications-dispatch-email");

    const result = evaluateNotificationTransitionRoute({ rootDir: root });

    expect(result.unexpectedCallers).toEqual([]);
    expect(result.allowedEvidence).toContainEqual({
      file: "src/app/api/notifications/dispatch-email/route.ts",
      term: "/api/notifications/dispatch-email",
    });
  });

  it("fails when client code calls the transition worker path", () => {
    const root = createTempRoot();
    write(root, "src/components/WorkerButton.tsx", "fetch('/api/notifications/dispatch-email')");

    const result = evaluateNotificationTransitionRoute({ rootDir: root });

    expect(result.unexpectedCallers).toContainEqual({
      file: "src/components/WorkerButton.tsx",
      term: "/api/notifications/dispatch-email",
    });
    expect(formatNotificationTransitionRouteReport(result)).toContain("FAIL: unexpected v13 caller/reference found");
  });

  it("fails when code imports the transition route constant outside the registry", () => {
    const root = createTempRoot();
    write(root, "src/lib/worker.ts", "const path = APP_ROUTES.apiNotificationsDispatchEmail;");

    const result = evaluateNotificationTransitionRoute({ rootDir: root });

    expect(result.unexpectedCallers).toContainEqual({
      file: "src/lib/worker.ts",
      term: "apiNotificationsDispatchEmail",
    });
  });
});
