import { describe, expect, test } from "vitest";

import { problemTagIconName } from "../../../src/components/practice/problem-tag-icons";

describe("problemTagIconName", () => {
  test("maps visible Korean problem tags to Iconsax icon names", () => {
    expect(problemTagIconName("교육")).toBe("Teacher");
    expect(problemTagIconName("학교 교육")).toBe("Book1");
    expect(problemTagIconName("문의")).toBe("MessageQuestion");
    expect(problemTagIconName("주거와 환경")).toBe("House2");
    expect(problemTagIconName("동식물")).toBe("Tree");
    expect(problemTagIconName("설명")).toBe("DocumentText");
    expect(problemTagIconName("전문 분야")).toBe("Briefcase");
    expect(problemTagIconName("과학")).toBe("Microscope");
    expect(problemTagIconName("사회")).toBe("People");
    expect(problemTagIconName("제도")).toBe("Courthouse");
    expect(problemTagIconName("문제 해결 제안")).toBe("LampCharge");
    expect(problemTagIconName("가격")).toBe("DollarCircle");
    expect(problemTagIconName("건강")).toBe("Health");
    expect(problemTagIconName("쇼핑")).toBe("ShoppingBag");
    expect(problemTagIconName("신체")).toBe("Health");
  });

  test("normalizes admin metadata prefixes before matching known tag icons", () => {
    expect(problemTagIconName("subject:교육")).toBe("Teacher");
    expect(problemTagIconName("subject:학교_교육")).toBe("Book1");
    expect(problemTagIconName("purpose:문의")).toBe("MessageQuestion");
    expect(problemTagIconName("speech_act:설명")).toBe("DocumentText");
    expect(problemTagIconName("subject:주거와_환경")).toBe("House2");
  });

  test("infers icons from common admin metadata prefixes and keywords", () => {
    expect(problemTagIconName("type:public_inquiry")).toBe("MessageQuestion");
    expect(problemTagIconName("type:notice_guidance")).toBe("DocumentText");
    expect(problemTagIconName("type:private_request")).toBe("TaskSquare");
    expect(problemTagIconName("topic:advantage_problem_solution")).toBe(
      "LampCharge",
    );
    expect(problemTagIconName("topic:topik52_complete_paragraph_source")).toBe(
      "DocumentText",
    );
    expect(problemTagIconName("source_difficulty:5")).toBe("Chart");
    expect(problemTagIconName("target:TOPIK_3급")).toBe("MedalStar");
    expect(problemTagIconName("review:approved")).toBe("ShieldTick");
    expect(problemTagIconName("subject:기술")).toBe("Cpu");
    expect(problemTagIconName("subject:경제")).toBe("DollarCircle");
    expect(problemTagIconName("subject:환경")).toBe("Tree");
    expect(problemTagIconName("writing")).toBe("DocumentText");
  });

  test("uses structured and generic fallbacks for unknown metadata", () => {
    expect(problemTagIconName("metadata:unknown_value")).toBe("Category");
    expect(problemTagIconName("unknown")).toBe("Tag2");
  });

  test("falls back to the generic tag icon for unmapped tags", () => {
    expect(problemTagIconName("unknown")).toBe("Tag2");
  });
});
