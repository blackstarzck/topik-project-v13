import { describe, expect, it } from "vitest";

import { tokenizeQ51Prompt } from "../../../src/lib/writing/q51-prompt";

describe("tokenizeQ51Prompt", () => {
  it("turns compact and spaced Korean blank markers into blank tokens", () => {
    expect(
      tokenizeQ51Prompt("안녕하세요 (ㄱ) 입니다. 다시 ( ㄴ ) 주세요."),
    ).toEqual([
      { type: "text", value: "안녕하세요 " },
      { type: "blank", label: "ㄱ" },
      { type: "text", value: " 입니다. 다시 " },
      { type: "blank", label: "ㄴ" },
      { type: "text", value: " 주세요." },
    ]);
  });

  it("keeps unknown parenthesized text as normal text", () => {
    expect(tokenizeQ51Prompt("제목: 안내 (공지)입니다.")).toEqual([
      { type: "text", value: "제목: 안내 (공지)입니다." },
    ]);
  });
});
