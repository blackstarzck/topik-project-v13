import { describe, expect, it } from "vitest";

import { serializeWritingAnswerSnapshot } from "../../../src/components/writing/writingAnswerSnapshot";

describe("serializeWritingAnswerSnapshot", () => {
  it("is stable for equivalent answer data", () => {
    expect(serializeWritingAnswerSnapshot({ b: "2", a: "1" })).toBe(
      serializeWritingAnswerSnapshot({ a: "1", b: "2" }),
    );
  });

  it("tracks q54 checklist changes as answer data changes", () => {
    const base = serializeWritingAnswerSnapshot({
      text: "본문",
      checklist: { intro: "unchecked" },
    });
    const changed = serializeWritingAnswerSnapshot({
      text: "본문",
      checklist: { intro: "complete" },
    });

    expect(changed).not.toBe(base);
  });
});
