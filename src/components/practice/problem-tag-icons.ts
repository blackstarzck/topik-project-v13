import { createElement } from "react";
import {
  Airplane,
  Book1,
  Briefcase,
  Bus,
  Brush,
  Category,
  Chart,
  Coffee,
  Courthouse,
  Cpu,
  Cup,
  DocumentText,
  DollarCircle,
  Global,
  Health,
  House2,
  LampCharge,
  MedalStar,
  MessageQuestion,
  Microscope,
  People,
  ShieldTick,
  ShoppingBag,
  Tag2,
  TaskSquare,
  Teacher,
  Tree,
  type Icon,
  type IconProps,
} from "iconsax-react";

type ProblemTagIcon = {
  Icon: Icon;
  name: string;
};

const iconMeta = (Icon: Icon, name: string): ProblemTagIcon => ({ Icon, name });

const FALLBACK_PROBLEM_TAG_ICON = iconMeta(Tag2, "Tag2");
const STRUCTURED_METADATA_FALLBACK_ICON = iconMeta(Category, "Category");

const PROBLEM_TAG_ICONS: Record<string, ProblemTagIcon> = {
  교육: iconMeta(Teacher, "Teacher"),
  "학교 교육": iconMeta(Book1, "Book1"),
  문의: iconMeta(MessageQuestion, "MessageQuestion"),
  "주거와 환경": iconMeta(House2, "House2"),
  동식물: iconMeta(Tree, "Tree"),
  설명: iconMeta(DocumentText, "DocumentText"),
  "전문 분야": iconMeta(Briefcase, "Briefcase"),
  과학: iconMeta(Microscope, "Microscope"),
  사회: iconMeta(People, "People"),
  제도: iconMeta(Courthouse, "Courthouse"),
  "문제 해결 제안": iconMeta(LampCharge, "LampCharge"),
  가격: iconMeta(DollarCircle, "DollarCircle"),
  건강: iconMeta(Health, "Health"),
  쇼핑: iconMeta(ShoppingBag, "ShoppingBag"),
  신체: iconMeta(Health, "Health"),
  "개인 일상": iconMeta(House2, "House2"),
  일상생활: iconMeta(House2, "House2"),
  의류: iconMeta(ShoppingBag, "ShoppingBag"),
  식음료: iconMeta(Coffee, "Coffee"),
  "공공 서비스": iconMeta(Courthouse, "Courthouse"),
  "여가와 오락": iconMeta(Cup, "Cup"),
  "일과 직업": iconMeta(Briefcase, "Briefcase"),
  "대인 관계": iconMeta(People, "People"),
  기후: iconMeta(Tree, "Tree"),
  여행: iconMeta(Airplane, "Airplane"),
  교통: iconMeta(Bus, "Bus"),
  예술: iconMeta(Brush, "Brush"),
  문화: iconMeta(Global, "Global"),
  경제: iconMeta(DollarCircle, "DollarCircle"),
  기술: iconMeta(Cpu, "Cpu"),
  환경: iconMeta(Tree, "Tree"),
  심리: iconMeta(Health, "Health"),
  "생활 과학": iconMeta(Microscope, "Microscope"),
};

const STRUCTURED_METADATA_PREFIXES = new Set([
  "category",
  "grammar",
  "metadata",
  "purpose",
  "review",
  "scenario",
  "scenario_type",
  "source_difficulty",
  "speech_act",
  "subject",
  "tag",
  "target",
  "text_type",
  "topic",
  "topik",
  "type",
]);

const TAG_ICON_INFERENCE_RULES: Array<{
  icon: ProblemTagIcon;
  keywords: readonly string[];
  prefixes?: readonly string[];
}> = [
  {
    icon: iconMeta(Chart, "Chart"),
    keywords: ["difficulty", "난이도"],
    prefixes: ["source_difficulty"],
  },
  {
    icon: iconMeta(MedalStar, "MedalStar"),
    keywords: ["target", "grade", "급"],
    prefixes: ["target", "topik"],
  },
  {
    icon: iconMeta(ShieldTick, "ShieldTick"),
    keywords: ["approved", "review", "검수", "승인"],
    prefixes: ["review"],
  },
  {
    icon: iconMeta(MessageQuestion, "MessageQuestion"),
    keywords: ["inquiry", "question", "contact", "ask", "문의", "질문"],
  },
  {
    icon: iconMeta(TaskSquare, "TaskSquare"),
    keywords: ["request", "survey", "요청", "의뢰", "조사"],
  },
  {
    icon: iconMeta(DocumentText, "DocumentText"),
    keywords: [
      "description",
      "explanation",
      "guidance",
      "notice",
      "paragraph",
      "source",
      "text",
      "writing",
      "안내",
      "공지",
      "설명",
      "쓰기",
    ],
  },
  {
    icon: iconMeta(LampCharge, "LampCharge"),
    keywords: [
      "advice",
      "effort",
      "proposal",
      "recommendation",
      "response",
      "solution",
      "문제",
      "제안",
      "해결",
    ],
  },
  {
    icon: iconMeta(Teacher, "Teacher"),
    keywords: [
      "class",
      "education",
      "learning",
      "school",
      "study",
      "교육",
      "학습",
    ],
  },
  {
    icon: iconMeta(DollarCircle, "DollarCircle"),
    keywords: ["cost", "economy", "price", "경제", "가격", "비용"],
  },
  {
    icon: iconMeta(Cpu, "Cpu"),
    keywords: ["ai", "code", "digital", "technology", "기술"],
  },
  {
    icon: iconMeta(Microscope, "Microscope"),
    keywords: ["science", "과학"],
  },
  {
    icon: iconMeta(Tree, "Tree"),
    keywords: [
      "animal",
      "climate",
      "environment",
      "plant",
      "recycle",
      "resource",
      "동물",
      "식물",
      "환경",
    ],
  },
  {
    icon: iconMeta(Health, "Health"),
    keywords: ["body", "health", "psychology", "건강", "몸", "신체", "심리"],
  },
  {
    icon: iconMeta(Courthouse, "Courthouse"),
    keywords: [
      "institution",
      "policy",
      "public",
      "rule",
      "system",
      "공공",
      "제도",
    ],
  },
  {
    icon: iconMeta(People, "People"),
    keywords: ["relationship", "social", "society", "관계", "사회"],
  },
  {
    icon: iconMeta(ShoppingBag, "ShoppingBag"),
    keywords: ["clothes", "shopping", "의류", "쇼핑"],
  },
  {
    icon: iconMeta(Airplane, "Airplane"),
    keywords: ["travel", "여행"],
  },
  {
    icon: iconMeta(Bus, "Bus"),
    keywords: ["traffic", "transport", "교통"],
  },
  {
    icon: iconMeta(Brush, "Brush"),
    keywords: ["art", "예술"],
  },
  {
    icon: iconMeta(Global, "Global"),
    keywords: ["culture", "문화"],
  },
];

function normalizeTagValue(value: string): string {
  return value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function tagParts(tag: string): {
  prefix: string | null;
  raw: string;
  value: string;
} {
  const raw = tag.trim();
  const prefixEnd = raw.indexOf(":");

  if (prefixEnd === -1) {
    return {
      prefix: null,
      raw,
      value: normalizeTagValue(raw),
    };
  }

  return {
    prefix: raw.slice(0, prefixEnd).trim().toLowerCase(),
    raw,
    value: normalizeTagValue(raw.slice(prefixEnd + 1)),
  };
}

function valueHasKeyword(value: string, keyword: string): boolean {
  return value.toLowerCase().includes(keyword.toLowerCase());
}

function inferProblemTagIcon(
  value: string,
  prefix: string | null,
): ProblemTagIcon | null {
  return (
    TAG_ICON_INFERENCE_RULES.find(
      ({ keywords, prefixes }) =>
        (prefix !== null && prefixes?.includes(prefix)) ||
        keywords.some((keyword) => valueHasKeyword(value, keyword)),
    )?.icon ?? null
  );
}

function problemTagIconMeta(tag: string): ProblemTagIcon {
  const { prefix, raw, value } = tagParts(tag);

  return (
    PROBLEM_TAG_ICONS[raw] ??
    PROBLEM_TAG_ICONS[value] ??
    inferProblemTagIcon(value, prefix) ??
    (prefix !== null && STRUCTURED_METADATA_PREFIXES.has(prefix)
      ? STRUCTURED_METADATA_FALLBACK_ICON
      : FALLBACK_PROBLEM_TAG_ICON)
  );
}

export function ProblemTagIcon({ tag, ...props }: IconProps & { tag: string }) {
  return createElement(problemTagIconMeta(tag).Icon, props);
}

export function problemTagIconName(tag: string): string {
  return problemTagIconMeta(tag).name;
}
