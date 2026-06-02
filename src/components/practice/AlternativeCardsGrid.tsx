"use client";

import { Button, Card, Col, Empty, Row, Space, Tag, Typography } from "antd";
import { useRouter } from "next/navigation";

const { Text, Title } = Typography;

/**
 * Structurally matches src/lib/practice/next.ts AlternativeProblem. Defined
 * locally (not imported) so this "use client" file keeps NO import edge to the
 * server-only-by-convention next.ts module. `reason` is required (string|null)
 * to stay assignable from the lib type at the onSelect callback boundary.
 */
type AlternativeProblem = {
  id: string;
  title: string;
  questionNo: number | null;
  domain: string;
  reason: string | null;
  estimatedMinutes?: number | null;
  difficulty?: number | null;
  locked?: boolean;
};

type Props = {
  alternatives: AlternativeProblem[];
  /** 현재 선택된 문제 id (하이라이트용). */
  selectedId?: string | null;
  /** 대안 카드를 선택할 때 호출. 미지정 시 클릭하면 바로 이동(레거시 동작). */
  onSelect?: (alt: AlternativeProblem) => void;
};

function difficultyLabel(difficulty: number | null | undefined): string | null {
  if (difficulty == null) return null;
  if (difficulty <= 1) return "쉬움";
  if (difficulty === 2) return "조금 쉬움";
  if (difficulty === 3) return "보통";
  if (difficulty === 4) return "조금 어려움";
  return "어려움";
}

/**
 * Phase 7-D Task 6 (P1-2) — R-02 대안 문제 카드 grid.
 * 제약: 대안 3개 이하, 카드 제목 28자, 카드 설명 2줄 제한.
 * 예외(§3): 권한 잠금 카드는 비활성 및 업그레이드 안내 표시.
 */
export function AlternativeCardsGrid({
  alternatives,
  selectedId,
  onSelect,
}: Props) {
  const router = useRouter();

  if (alternatives.length === 0) {
    return (
      <div>
        <Title level={5}>다른 추천</Title>
        <Empty description="추가로 추천할 문제가 없어요." />
      </div>
    );
  }

  return (
    <div>
      <Title level={5}>다른 추천</Title>
      <Row gutter={[12, 12]}>
        {alternatives.slice(0, 3).map((a) => {
          const diffLabel = difficultyLabel(a.difficulty);
          if (a.locked) {
            return (
              <Col key={a.id} xs={24} md={8}>
                <Card
                  data-testid={`alt-locked-${a.id}`}
                  style={{ opacity: 0.7, background: "#fafafa" }}
                  title={
                    <Space>
                      <span aria-hidden>🔒</span>
                      <Tag color="default">
                        {a.questionNo != null ? `${a.questionNo}번` : a.domain}
                      </Tag>
                    </Space>
                  }
                >
                  <Space
                    direction="vertical"
                    size="small"
                    style={{ width: "100%" }}
                  >
                    <Text type="secondary">
                      이 추천은 유료 플랜에서 열려요.
                    </Text>
                    <Button
                      size="small"
                      onClick={() => router.push("/paywall" as never)}
                    >
                      업그레이드 안내
                    </Button>
                  </Space>
                </Card>
              </Col>
            );
          }

          const handleClick = () => {
            if (onSelect) {
              onSelect(a);
            } else {
              router.push(`/practice/problems/${a.id}` as never);
            }
          };

          return (
            <Col key={a.id} xs={24} md={8}>
              <Card
                hoverable
                onClick={handleClick}
                data-testid={`alt-${a.id}`}
                style={
                  selectedId === a.id
                    ? { borderColor: "#1677ff", borderWidth: 2 }
                    : undefined
                }
                title={
                  <Space wrap>
                    <Tag color="default">
                      {a.questionNo != null ? `${a.questionNo}번` : a.domain}
                    </Tag>
                    {diffLabel ? <Tag color="purple">{diffLabel}</Tag> : null}
                    {a.estimatedMinutes != null ? (
                      <Tag color="cyan">{a.estimatedMinutes}분</Tag>
                    ) : null}
                  </Space>
                }
              >
                <Text strong>
                  {a.title.length > 28 ? `${a.title.slice(0, 28)}…` : a.title}
                </Text>
                {a.reason ? (
                  <div style={{ marginTop: 4 }}>
                    <Typography.Paragraph
                      type="secondary"
                      style={{ fontSize: 12, margin: 0 }}
                      ellipsis={{ rows: 2 }}
                    >
                      {a.reason}
                    </Typography.Paragraph>
                  </div>
                ) : null}
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}
