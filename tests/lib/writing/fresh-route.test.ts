import { describe, expect, it } from "vitest";

import { writingHrefAfterDraftPersisted } from "../../../src/lib/writing/fresh-route";

describe("writing fresh route persistence", () => {
  it("consumes only fresh=1 after the first draft save", () => {
    expect(
      writingHrefAfterDraftPersisted(
        "/writing/essay-writing-54?problem=problem-1&fresh=1&retrySubmission=submission-1#answer",
      ),
    ).toBe(
      "/writing/essay-writing-54?problem=problem-1&retrySubmission=submission-1#answer",
    );
  });

  it("preserves the encoded return target when consuming fresh=1", () => {
    expect(
      writingHrefAfterDraftPersisted(
        "/writing/essay-writing-54?problem=problem-1&fresh=1&returnTo=%2Fpractice%2Fproblems%3Fpage%3D2%23results#answer",
      ),
    ).toBe(
      "/writing/essay-writing-54?problem=problem-1&returnTo=%2Fpractice%2Fproblems%3Fpage%3D2%23results#answer",
    );
  });

  it("leaves routes without the one-shot flag unchanged", () => {
    expect(
      writingHrefAfterDraftPersisted(
        "/writing/short-answer-writing-51?problem=problem-1",
      ),
    ).toBeNull();
    expect(
      writingHrefAfterDraftPersisted(
        "/writing/short-answer-writing-51?problem=problem-1&fresh=0",
      ),
    ).toBeNull();
  });
});
