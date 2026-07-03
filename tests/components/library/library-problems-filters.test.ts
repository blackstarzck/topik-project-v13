import { describe, expect, it } from "vitest";

import type { SubmissionEnrichment } from "../../../src/components/library/library-enrich-data";
import {
  applyLibraryProblemsFilters,
  countLibraryProblemsFilters,
  matchesLibraryProblemsFilter,
  type LibraryProblemsFilterEntry,
  type LibraryProblemsFilterKey,
} from "../../../src/components/library/library-problems-filters";

function submissionEntry(id: string): LibraryProblemsFilterEntry {
  return { kind: "submission", item: { id } };
}

function problemEntry(
  availabilityStatus: "available" | "soft_unavailable" | "hard_unavailable",
): LibraryProblemsFilterEntry {
  return { kind: "problem", item: { availabilityStatus } };
}

function enrichment(
  feedbackStatus: SubmissionEnrichment["feedbackStatus"],
): SubmissionEnrichment {
  return { feedbackStatus, scoreTotal: null, scoreMax: null, summary: null };
}

const enrich = new Map<string, SubmissionEnrichment>([
  ["sub-complete", enrichment("complete")],
  ["sub-failed", enrichment("failed")],
]);

describe("matchesLibraryProblemsFilter", () => {
  it("treats submissions without enrichment as pending", () => {
    const entry = submissionEntry("sub-unknown");
    expect(matchesLibraryProblemsFilter(entry, "statusPending", enrich)).toBe(
      true,
    );
    expect(matchesLibraryProblemsFilter(entry, "statusComplete", enrich)).toBe(
      false,
    );
  });

  it("matches submission status from enrichment", () => {
    const entry = submissionEntry("sub-complete");
    expect(matchesLibraryProblemsFilter(entry, "submissions", enrich)).toBe(
      true,
    );
    expect(matchesLibraryProblemsFilter(entry, "statusComplete", enrich)).toBe(
      true,
    );
    expect(matchesLibraryProblemsFilter(entry, "statusPending", enrich)).toBe(
      false,
    );
    expect(matchesLibraryProblemsFilter(entry, "problems", enrich)).toBe(false);
  });

  it("matches problem availability keys only for problem rows", () => {
    const soft = problemEntry("soft_unavailable");
    const hard = problemEntry("hard_unavailable");
    const available = problemEntry("available");

    expect(matchesLibraryProblemsFilter(soft, "problems", enrich)).toBe(true);
    expect(matchesLibraryProblemsFilter(soft, "providedEnded", enrich)).toBe(
      true,
    );
    expect(matchesLibraryProblemsFilter(hard, "unavailable", enrich)).toBe(
      true,
    );
    expect(
      matchesLibraryProblemsFilter(available, "providedEnded", enrich),
    ).toBe(false);
    expect(matchesLibraryProblemsFilter(soft, "submissions", enrich)).toBe(
      false,
    );
  });
});

describe("countLibraryProblemsFilters", () => {
  it("counts every filter key over the given entries", () => {
    const counts = countLibraryProblemsFilters(
      [
        submissionEntry("sub-complete"),
        submissionEntry("sub-failed"),
        submissionEntry("sub-unknown"),
        problemEntry("available"),
        problemEntry("soft_unavailable"),
        problemEntry("hard_unavailable"),
      ],
      enrich,
    );

    expect(counts).toEqual({
      submissions: 3,
      statusPending: 1,
      statusAnalyzing: 0,
      statusComplete: 1,
      statusFailed: 1,
      problems: 3,
      providedEnded: 1,
      unavailable: 1,
    });
  });
});

describe("applyLibraryProblemsFilters", () => {
  const entries = [
    submissionEntry("sub-complete"),
    submissionEntry("sub-failed"),
    problemEntry("soft_unavailable"),
  ];

  it("returns everything when no card is checked", () => {
    expect(
      applyLibraryProblemsFilters(
        entries,
        new Set<LibraryProblemsFilterKey>(),
        enrich,
      ),
    ).toBe(entries);
  });

  it("keeps the union of the checked cards", () => {
    const result = applyLibraryProblemsFilters(
      entries,
      new Set<LibraryProblemsFilterKey>(["statusComplete", "providedEnded"]),
      enrich,
    );
    expect(result).toEqual([
      submissionEntry("sub-complete"),
      problemEntry("soft_unavailable"),
    ]);
  });

  it("returns an empty list when nothing matches", () => {
    const result = applyLibraryProblemsFilters(
      entries,
      new Set<LibraryProblemsFilterKey>(["statusAnalyzing"]),
      enrich,
    );
    expect(result).toEqual([]);
  });
});
