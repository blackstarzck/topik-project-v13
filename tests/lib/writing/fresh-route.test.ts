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
