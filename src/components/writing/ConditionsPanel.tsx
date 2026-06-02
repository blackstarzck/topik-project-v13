"use client";

import { Alert, Card, List, Space, Tag, Typography } from "antd";

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

function asStringList(value: unknown, max: number): string[] {
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
          typeof obj.weight === "number" ? ` (${obj.weight}점)` : "";
        out.push(`${label}${weight}`);
      }
    }
    if (out.length >= max) break;
  }
  return out;
}

export function parseRubric(rubric: ProblemRubric): ParsedRubric | null {
  if (!rubric || typeof rubric !== "object") return null;
  const obj = rubric as Record<string, unknown>;
  const conditions = asStringList(obj.conditions ?? obj.조건, 4);
  const criteria = asStringList(
    obj.criteria ?? obj.평가기준 ?? obj.items ?? obj.dimensions,
    5,
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

const TITLE: Record<52 | 53 | 54, string> = {
  52: "작성 조건",
  53: "평가 기준",
  54: "조건 · 루브릭",
};

const MANUAL_NOTE: Record<52 | 53 | 54, string> = {
  52: "이 문제의 조건 정보를 불러오지 못했어요. 지문의 빈칸 조건을 직접 확인하며 작성해 주세요.",
  53: "평가 기준을 불러오지 못했어요. 자료 반영·문단 구성·분량을 스스로 점검하며 작성해 주세요.",
  54: "루브릭을 불러오지 못했어요. 서론·본론·결론 구조와 근거를 직접 점검하며 작성해 주세요.",
};

export function ConditionsPanel({ questionNo, rubric, loadFailed }: Props) {
  const parsed = loadFailed ? null : parseRubric(rubric);

  // §예외 — 기준 계산 실패 또는 데이터 없음 → 수동 체크 안내.
  if (!parsed) {
    return (
      <Card size="small" title={TITLE[questionNo]}>
        <Alert
          type="info"
          showIcon
          message="수동으로 확인해 주세요"
          description={MANUAL_NOTE[questionNo]}
        />
      </Card>
    );
  }

  return (
    <Card size="small" title={TITLE[questionNo]}>
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        {parsed.conditions.length > 0 ? (
          <div>
            <Text strong style={{ fontSize: 13 }}>
              작성 조건
            </Text>
            <List
              size="small"
              dataSource={parsed.conditions.slice(0, 4)}
              renderItem={(c, i) => (
                <List.Item style={{ padding: "4px 0" }}>
                  <Space align="start">
                    <Tag color={i === 0 ? "blue" : "default"}>
                      {i === 0 ? "필수" : i + 1}
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
              평가 기준
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
