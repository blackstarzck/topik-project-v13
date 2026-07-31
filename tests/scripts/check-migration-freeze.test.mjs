import { describe, expect, it } from "vitest";

import {
  ARCHIVE_TARGET,
  LEARNER_FREEZE_WATERMARK,
  evaluateMigrationFreeze,
  isExemptPath,
  parseNameStatusZ,
} from "../../scripts/check-migration-freeze.mjs";

const FORWARD = "supabase/migrations/20260714140000_writing_problem_identity_registry_cutover.sql";
const DOWN = "supabase/migrations/down/20260714140000_writing_problem_identity_registry_cutover.sql";
const ABOVE_WATERMARK = "supabase/migrations/20260801000000_new_learner_change.sql";

describe("learner migration freeze guard", () => {
  it("pins the watermark and the delegation target", () => {
    expect(LEARNER_FREEZE_WATERMARK).toBe("20260729120000");
    expect(ARCHIVE_TARGET).toContain("migrations-v13");
  });

  it("exempts rollback assets and the history index", () => {
    expect(isExemptPath(DOWN)).toBe(true);
    expect(isExemptPath("supabase/migrations/INDEX.md")).toBe(true);
    expect(isExemptPath(FORWARD)).toBe(false);
  });

  it("passes a change set that touches only exempt paths", () => {
    const result = evaluateMigrationFreeze([
      { status: "A", path: DOWN },
      { status: "M", path: "supabase/migrations/INDEX.md" },
      { status: "M", path: "src/app/page.tsx" },
    ]);
    expect(result).toEqual({ violations: [], inspected: 0 });
  });

  it("refuses a new forward migration and names where it belongs", () => {
    const { violations } = evaluateMigrationFreeze([{ status: "A", path: ABOVE_WATERMARK }]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("new forward migration authored here");
    expect(violations[0]).toContain("migrations-v13");
  });

  it("refuses edits and deletes of frozen history, citing the parity proof", () => {
    for (const status of ["M", "D"]) {
      const { violations } = evaluateMigrationFreeze([{ status, path: FORWARD }]);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain(`frozen history changed (${status})`);
      expect(violations[0]).toContain("parity proof");
    }
  });

  it("refuses a rename or copy of frozen history", () => {
    const { violations } = evaluateMigrationFreeze([
      { status: "R", path: FORWARD, renamedTo: "supabase/migrations/20260714140000_renamed.sql" },
      { status: "C", path: FORWARD, renamedTo: "supabase/migrations/20260714140000_copy.sql" },
    ]);
    expect(violations).toHaveLength(2);
    expect(violations[0]).toContain("renamed to");
    expect(violations[1]).toContain("copied to");
    for (const issue of violations) expect(issue).toContain("exact name");
  });

  it("refuses an unexpected non-migration file in the flat directory", () => {
    const { violations } = evaluateMigrationFreeze([
      { status: "A", path: "supabase/migrations/notes.txt" },
    ]);
    expect(violations[0]).toContain("unexpected file");
  });

  it("still refuses an edit above the watermark, without the parity claim", () => {
    // Nothing above the watermark is in the archive, so the reason is ownership
    // rather than byte parity. The message must not overclaim.
    const { violations } = evaluateMigrationFreeze([{ status: "M", path: ABOVE_WATERMARK }]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).not.toContain("parity proof");
    expect(violations[0]).toContain("Fix it forward from topik-ai");
  });

  it("parses NUL-delimited name-status output including renames", () => {
    expect(parseNameStatusZ(`M\0${FORWARD}\0A\0${DOWN}\0`)).toEqual([
      { status: "M", path: FORWARD },
      { status: "A", path: DOWN },
    ]);
    expect(parseNameStatusZ(`R100\0${FORWARD}\0${ABOVE_WATERMARK}\0`)).toEqual([
      { status: "R", path: FORWARD, renamedTo: ABOVE_WATERMARK },
    ]);
    expect(parseNameStatusZ("")).toEqual([]);
  });
});
