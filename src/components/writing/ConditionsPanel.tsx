"use client";

import { Alert, Card, List, Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";

const { Text } = Typography;

/**
 * problems.rubric 는 자유 JSON. 명세가 요구하는 표시는:
 *  - D-02 §2 조건 카드 (조건 4개 이하, 핵심 조건 항상 노출)
 *  - D-03 §4 평가 기준 카드 (기준 5개 이하)
 *  - D-04 §1 루브릭 요약 (3항목)
 *  - 예외: 기준 계산 실패 → 수동 체크 안내로 대체
 *
 * 우리는 rubric 에서 다음 키들을 관용적으로 읽는다(없으면 폴백):
 *  - conditions: string[]      (작성 조건)
 *  - criteria:   string[]      (평가 기준)
 *  - { label, weight } 객체 배열도 허용.
 */
export type ProblemRubric = unknown;

type ParsedRubric = {
  conditions: string[];
  criteria: string[];
};

// 가중치 라벨 접미사 포매터. 라벨 본문은 rubric 데이터(서버/DB)에서 오고,
// "(N점)" 같은 표시 접미사만 UI 문구이므로 호출부가 i18n 포매터를 주입한다.
// 미지정 시(서버 측 parseRubric 단독 사용 등) 기본 한국어 접미사로 폴백.
type WeightFormatter = (weight: number) => string;
const defaultWeightFormatter: WeightFormatter = (weight) => ` (${weight}점)`;

function asStringList(
  value: unknown,
  max: number,
  formatWeight: WeightFormatter,
): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === "string") {
      out.push(v);
    } else if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const label =
        typeof obj.label === "string"
          ? obj.label
          : typeof obj.name === "string"
            ? obj.name
            : typeof obj.text === "string"
              ? obj.text
              : null;
      if (label) {
        const weight =
          typeof obj.weight === "number" ? formatWeight(obj.weight) : "";
        out.push(`${label}${weight}`);
      }
    }
    if (out.length >= max) break;
  }
  return out;
}

export function parseRubric(
  rubric: ProblemRubric,
  formatWeight: WeightFormatter = defaultWeightFormatter,
): ParsedRubric | null {
  if (!rubric || typeof rubric !== "object") return null;
  const obj = rubric as Record<string, unknown>;
  const conditions = asStringList(obj.conditions ?? obj.조건, 4, formatWeight);
  const criteria = asStringList(
    obj.criteria ?? obj.평가기준 ?? obj.items ?? obj.dimensions,
    5,
    formatWeight,
  );
  if (conditions.length === 0 && criteria.length === 0) return null;
  return { conditions, criteria };
}

type Props = {
  questionNo: 52 | 53 | 54;
  rubric: ProblemRubric;
  /**
   * §예외 — 조건/기준 로드 실패 여부. true 면 수동 체크 안내(폴백)로 대체.
   * page route 에서 rubric 조회가 실패하면 caller 가 주입.
   */
  loadFailed?: boolean;
};

// questionNo → 카탈로그 키 매핑. next-intl 타입은 동적 문자열을 좁히지
// 못하므로 키 매핑을 명시해 둔다.
const TITLE_KEYS: Record<52 | 53 | 54, string> = {
  52: "title52",
  53: "title53",
  54: "title54",
};

const MANUAL_NOTE_KEYS: Record<52 | 53 | 54, string> = {
  52: "manualNote52",
  53: "manualNote53",
  54: "manualNote54",
};

export function ConditionsPanel({ questionNo, rubric, loadFailed }: Props) {
  const t = useTranslations("writing.conditions");
  const parsed = loadFailed
    ? null
    : parseRubric(rubric, (weight) => t("weightSuffix", { weight }));
  const title = t(TITLE_KEYS[questionNo] as never);

  // §예외 — 기준 계산 실패 또는 데이터 없음 → 수동 체크 안내.
  if (!parsed) {
    return (
      <Card size="small" title={title}>
        <Alert
          type="info"
          showIcon
          message={t("manualCheck")}
          description={t(MANUAL_NOTE_KEYS[questionNo] as never)}
        />
      </Card>
    );
  }

  return (
    <Card size="small" title={title}>
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        {parsed.conditions.length > 0 ? (
          <div>
            <Text strong style={{ fontSize: 13 }}>
              {t("conditionsLabel")}
            </Text>
            <List
              size="small"
              dataSource={parsed.conditions.slice(0, 4)}
              renderItem={(c, i) => (
                <List.Item style={{ padding: "4px 0" }}>
                  <Space align="start">
                    <Tag color={i === 0 ? "blue" : "default"}>
                      {i === 0 ? t("required") : i + 1}
                    </Tag>
                    <Text>{c}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        ) : null}
        {parsed.criteria.length > 0 ? (
          <div>
            <Text strong style={{ fontSize: 13 }}>
              {t("criteriaLabel")}
            </Text>
            <List
              size="small"
              dataSource={parsed.criteria.slice(0, 5)}
              renderItem={(c) => (
                <List.Item style={{ padding: "4px 0" }}>
                  <Text type="secondary">• {c}</Text>
                </List.Item>
              )}
            />
          </div>
        ) : null}
      </Space>
    </Card>
  );
}
