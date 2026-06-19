import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateNotificationOwnerRead,
  formatNotificationOwnerReadReport
} from "../../scripts/check-notification-owner-read.mjs";

let tempDirs = [];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "v13-notification-owner-read-"));
  tempDirs.push(root);
  return root;
}

function writeDataFile(root, content) {
  const dir = join(root, "src/components/notifications");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "notifications-data.ts"), content, "utf8");
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("check-notification-owner-read", () => {
  it("passes when v13 reads delivery history by owner user_id only", () => {
    const root = createTempRoot();
    writeDataFile(
      root,
      `
export async function fetchDeliveryHistory(userId, limit = 5) {
  return supabase
    .from("notification_delivery_attempts")
    .select("id, channel, template_key, status, sent_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
}
`
    );

    const result = evaluateNotificationOwnerRead({ rootDir: root });

    expect(result).toEqual({ failures: [] });
    expect(formatNotificationOwnerReadReport(result)).toBe(
      "Notification owner-read boundary check passed."
    );
  });

  it("fails when the owner filter is removed", () => {
    const root = createTempRoot();
    writeDataFile(
      root,
      `
export async function fetchDeliveryHistory(userId, limit = 5) {
  return supabase
    .from("notification_delivery_attempts")
    .select("id, channel, template_key, status, sent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
}
`
    );

    const result = evaluateNotificationOwnerRead({ rootDir: root });

    expect(result.failures).toContain('fetchDeliveryHistory must include .eq("user_id", userId).');
  });

  it("fails when v13 starts reading admin dispatch detail rows", () => {
    const root = createTempRoot();
    writeDataFile(
      root,
      `
export async function fetchDeliveryHistory(userId, limit = 5) {
  return supabase
    .from("notification_delivery_attempts")
    .select("id, channel, template_key, status, sent_at, created_at")
    .eq("user_id", userId)
    .eq("dispatch_id", "dispatch-1")
    .order("created_at", { ascending: false })
    .limit(limit);
}
`
    );

    const result = evaluateNotificationOwnerRead({ rootDir: root });

    expect(result.failures).toContain(
      "v13 must not read notification_delivery_attempts by dispatch_id; topik-ai owns admin dispatch detail reads."
    );
  });
});
