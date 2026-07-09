import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260709153000_profiles_optional_gender_phone.sql",
  ),
  "utf8",
);

describe("optional profile gender and phone migration", () => {
  it("stages profile CHECK constraints with NOT VALID before validation", () => {
    expect(migration).toMatch(
      /add constraint profiles_gender_check[\s\S]*?\)\s+not valid;/i,
    );
    expect(migration).toMatch(
      /validate constraint profiles_gender_check;/i,
    );
    expect(migration).toMatch(
      /add constraint profiles_phone_number_digits_check[\s\S]*?\)\s+not valid;/i,
    );
    expect(migration).toMatch(
      /validate constraint profiles_phone_number_digits_check;/i,
    );
  });
});
