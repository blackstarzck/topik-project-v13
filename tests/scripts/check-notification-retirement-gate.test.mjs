import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateNotificationRetirementGate,
  formatNotificationRetirementGateReport,
} from "../../scripts/check-notification-retirement-gate.mjs";

let tempDirs = [];

const PRODUCTION_EVIDENCE_ITEMS = [
  "topik-ai production runtime env is configured",
  "topik-ai `npm run check:vercel-worker-readiness -- --strict-env` passes",
  "topik-ai `npm run check:notification-production-evidence -- --require` passes",
  "topik-ai `npm run harness:admin-boundary:production` passes",
  "actual `notification_delivery_attempts` state moves from `pending` to `sent` or failure bookkeeping state",
  "v13 X-09 owner-read history verifies only the logged-in user's scope",
  "after verification, decide whether to remove the v13 transition route",
];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "v13-notification-retirement-gate-"));
  tempDirs.push(root);
  return root;
}

function write(root, relativePath, content) {
  const file = join(root, relativePath);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content, "utf8");
}

function writeProposal(root, checked) {
  write(
    root,
    "docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md",
    PRODUCTION_EVIDENCE_ITEMS.map((item) => `- [${checked ? "x" : " "}] ${item}.`).join("\n"),
  );
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("check-notification-retirement-gate", () => {
  it("passes while the v13 transition route is retained", () => {
    const root = createTempRoot();
    write(root, "src/app/api/notifications/dispatch-email/route.ts", "export const POST = noop;");
    writeProposal(root, false);

    const result = evaluateNotificationRetirementGate({ rootDir: root });

    expect(result.failures).toEqual([]);
    expect(result.routeExists).toBe(true);
    expect(formatNotificationRetirementGateReport(result)).toContain("route is still retained");
  });

  it("fails while the route is retained if the transfer proposal lost production checklist terms", () => {
    const root = createTempRoot();
    write(root, "src/app/api/notifications/dispatch-email/route.ts", "export const POST = noop;");
    write(
      root,
      "docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md",
      "- [ ] topik-ai production runtime env is configured.\n",
    );

    const result = evaluateNotificationRetirementGate({ rootDir: root });

    expect(result.routeExists).toBe(true);
    expect(result.failures).toContain(
      "docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md is missing production checklist term: topik-ai `npm run check:vercel-worker-readiness -- --strict-env` passes",
    );
  });

  it("fails if the route is retired before production evidence is checked", () => {
    const root = createTempRoot();
    writeProposal(root, false);

    const result = evaluateNotificationRetirementGate({ rootDir: root });

    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.missingCheckedTerms).toEqual(PRODUCTION_EVIDENCE_ITEMS);
    expect(formatNotificationRetirementGateReport(result)).toContain("FAIL");
  });

  it("passes if the route is retired after every production evidence item is checked", () => {
    const root = createTempRoot();
    writeProposal(root, true);

    const result = evaluateNotificationRetirementGate({ rootDir: root });

    expect(result.failures).toEqual([]);
    expect(result.routeExists).toBe(false);
  });
});
