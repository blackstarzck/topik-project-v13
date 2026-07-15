import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL(
    "../../e2e/_setup/canonical-cross-app-live-fixture.ts",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();
const providerSource = readFileSync(
  new URL(
    "../../e2e/flows/writing-submission-provider-live.spec.ts",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();

describe("canonical live fixture cleanup safety", () => {
  it("quarantines the question and aborts when another user owns references", () => {
    expect(source).toContain("set service_status = 'excluded'");
    expect(source).toContain("canonical_fixture_external_reference");
    expect(source).toContain("parent_submission_id in");
    expect(source).toContain("child.draft_id in");
    expect(source).toContain("metric.submission_id in");
    expect(source).toContain("metric.user_id <>");
    expect(source).toContain("report.user_id <>");
    expect(source).toContain("item.submission_id in");
    expect(source).toContain("item.attempt_id in");
    expect(source).toContain("item.report_id in");
    expect(source).toContain("event.submission_id in");
    expect(source).toContain("event.attempt_id in");
    expect(source).toContain("public.assignment_submissions");
    for (const table of [
      "writing_submissions",
      "writing_drafts",
      "problem_attempts",
      "recommendation_items",
      "library_items",
      "study_events",
    ]) {
      expect(source).toMatch(
        new RegExp(`from public\\.${table}[\\s\\S]*?user_id <>`),
      );
    }
  });

  it("performs owner-scoped cleanup in one locked transaction", () => {
    expect(source).toContain("`begin;");
    expect(source).toContain("lock table");
    expect(source).toContain("in share row exclusive mode");
    expect(source).toContain("canonical_fixture_reference_cleanup_incomplete");
    expect(source).toContain("set local session_replication_role = replica");
    expect(source).toContain("commit;`");
    expect(source).toContain("and submission.user_id =");
    expect(source).toContain("and draft.user_id =");
    expect(source).toContain("and attempt.user_id =");
    expect(source).toContain("where item.user_id =");
  });

  it("recovers the provider intent id from the draft before cleanup", () => {
    expect(providerSource).toContain("v_intent_id uuid := coalesce");
    expect(providerSource).toContain("where draft_id =");
    expect(providerSource).toContain("where intent_id = v_intent_id");
  });
});
