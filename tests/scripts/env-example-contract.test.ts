import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const expectedLocalEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ENV_LABEL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_GA_MEASUREMENT_ID",
  "E2E_STUDENT_EMAIL",
  "E2E_STUDENT_PASSWORD",
  "SUPABASE_TEST_PASSWORD",
  "TALKPIK_API_BASE_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "NOTIFICATION_WORKER_SECRET",
];

describe(".env.example contract", () => {
  it("documents every active .env.local key used by local e2e and server flows", () => {
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");

    for (const key of expectedLocalEnvKeys) {
      expect(example, `${key} should be documented`).toMatch(
        new RegExp(`^#?\\s*${key}=`, "m"),
      );
    }
  });
});
