import { describe, expect, it } from "vitest";
import {
  combine53Sections,
  emptyChecklist,
  ESSAY_CHECKLIST_KEYS,
  isLongFormDraftJson,
} from "../../../src/lib/writing/types";

describe("isLongFormDraftJson — strict shape guard (Codex P1-2)", () => {
  it("rejects null / undefined / non-object", () => {
    expect(isLongFormDraftJson(null)).toBe(false);
    expect(isLongFormDraftJson(undefined)).toBe(false);
    expect(isLongFormDraftJson("string")).toBe(false);
    expect(isLongFormDraftJson(42)).toBe(false);
  });

  it("rejects object with wrong _v", () => {
    expect(isLongFormDraftJson({ _v: "55.v1" })).toBe(false);
    expect(isLongFormDraftJson({ _v: "53.v0" })).toBe(false);
  });

  it("rejects 53.v1 shape missing sections", () => {
    expect(isLongFormDraftJson({ _v: "53.v1" })).toBe(false);
    expect(isLongFormDraftJson({ _v: "53.v1", sections: null })).toBe(false);
    expect(isLongFormDraftJson({ _v: "53.v1", sections: { intro: "x" } })).toBe(
      false,
    ); // missing body, conclusion
  });

  it("accepts valid 53.v1 with all three sections as strings", () => {
    expect(
      isLongFormDraftJson({
        _v: "53.v1",
        sections: { intro: "도입", body: "전개", conclusion: "마무리" },
      }),
    ).toBe(true);
  });

  it("rejects 53.v1 with non-string section", () => {
    expect(
      isLongFormDraftJson({
        _v: "53.v1",
        sections: { intro: 123, body: "전개", conclusion: "마무리" },
      }),
    ).toBe(false);
  });

  it("rejects 54.v1 missing text or checklist", () => {
    expect(isLongFormDraftJson({ _v: "54.v1" })).toBe(false);
    expect(isLongFormDraftJson({ _v: "54.v1", text: "x" })).toBe(false);
    expect(isLongFormDraftJson({ _v: "54.v1", text: 123, checklist: {} })).toBe(
      false,
    );
  });

  it("rejects 54.v1 checklist missing IA keys or invalid status", () => {
    // missing keys
    expect(
      isLongFormDraftJson({
        _v: "54.v1",
        text: "x",
        checklist: { intro: "unchecked" }, // only 1 of 6
      }),
    ).toBe(false);
    // invalid status
    const bad = emptyChecklist() as Record<string, string>;
    bad.intro = "DONE"; // not in ALLOWED_STATUS
    expect(
      isLongFormDraftJson({ _v: "54.v1", text: "x", checklist: bad }),
    ).toBe(false);
  });

  it("accepts valid 54.v1 with text + 6-key 3-state checklist", () => {
    expect(
      isLongFormDraftJson({
        _v: "54.v1",
        text: "에세이 본문",
        checklist: emptyChecklist(),
      }),
    ).toBe(true);
  });
});

describe("combine53Sections — concatenation for submit", () => {
  it("joins intro/body/conclusion with double newlines", () => {
    expect(combine53Sections({ intro: "A", body: "B", conclusion: "C" })).toBe(
      "A\n\nB\n\nC",
    );
  });
  it("filters out empty/whitespace-only sections", () => {
    expect(combine53Sections({ intro: "A", body: "  ", conclusion: "C" })).toBe(
      "A\n\nC",
    );
    expect(combine53Sections({ intro: "", body: "", conclusion: "" })).toBe("");
  });
});

describe("emptyChecklist + ESSAY_CHECKLIST_KEYS", () => {
  it("emptyChecklist has all 6 IA keys with status 'unchecked'", () => {
    const c = emptyChecklist();
    expect(Object.keys(c)).toHaveLength(6);
    for (const k of ESSAY_CHECKLIST_KEYS) {
      expect(c[k]).toBe("unchecked");
    }
  });
});
