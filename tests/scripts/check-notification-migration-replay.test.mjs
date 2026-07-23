import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateNotificationMigrationReplay,
  formatNotificationMigrationReplayReport,
} from "../../scripts/check-notification-migration-replay.mjs";

const UP_FILES = [
  "20260612180000_notification_dispatcher.sql",
  "20260612180100_register_notification_cron.sql",
  "20260612190000_notification_email_pipeline.sql",
  "20260612190100_email_transport_fail_user.sql",
  "20260612190200_email_live_defer.sql",
  "20260612200100_marketing_consent_in_dispatch.sql",
];
const DOWN_FILES = UP_FILES.slice(2);
const NOOP = `-- notification pipeline migration home: topik-ai\n\n`;
let roots = [];

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "notification-replay-"));
  roots.push(root);
  for (const file of UP_FILES) {
    const target = join(root, "supabase", "migrations", file);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, NOOP, "utf8");
  }
  for (const file of DOWN_FILES) {
    const target = join(root, "supabase", "migrations", "down", file);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, NOOP, "utf8");
  }
  return root;
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

describe("check-notification-migration-replay", () => {
  it("accepts retired migrations that only retain ownership evidence", () => {
    const result = evaluateNotificationMigrationReplay({ rootDir: createFixture() });
    expect(result).toEqual({ failures: [] });
    expect(formatNotificationMigrationReplayReport(result)).toContain("PASS");
  });

  it("rejects executable dispatcher DDL in a retired migration", () => {
    const root = createFixture();
    writeFileSync(
      join(root, "supabase", "migrations", UP_FILES[0]),
      `${NOOP}create or replace function private.dispatch_notifications() returns void language sql as $$ select 1 $$;\n`,
      "utf8",
    );

    expect(evaluateNotificationMigrationReplay({ rootDir: root }).failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "20260612180000_notification_dispatcher.sql must be a replay-safe no-op after ownership transfer.",
        ),
      ]),
    );
  });
});
