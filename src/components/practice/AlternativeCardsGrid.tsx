"use client";

import { Button, Col, Empty, Row, Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/shared/AppCard";
import { writingProblemHref } from "@/lib/writing/routes";

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

/** maps difficulty (1..5) to a practice.common translation key. */
function difficultyKey(difficulty: number | null | undefined): string | null {
  if (difficulty == null) return null;
  if (difficulty <= 1) return "difficultyVeryEasy";
  if (difficulty === 2) return "difficultyEasy";
  if (difficulty === 3) return "difficultyNormal";
  if (difficulty === 4) return "difficultyHardish";
  return "difficultyHard";
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
  const t = useTranslations("practice.next");
  const tCommon = useTranslations("practice.common");
  const router = useRouter();

  if (alternatives.length === 0) {
    return (
      <div>
        <Title level={5}>{t("alternativesTitle")}</Title>
        <Empty description={t("alternativesEmpty")} />
      </div>
    );
  }

  return (
    <div>
      <Title level={5}>{t("alternativesTitle")}</Title>
      <Row gutter={[12, 12]}>
        {alternatives.slice(0, 3).map((a) => {
          const diffKey = difficultyKey(a.difficulty);
          const diffLabel = diffKey
            ? tCommon(diffKey as Parameters<typeof tCommon>[0])
            : null;
          if (a.locked) {
            return (
              <Col key={a.id} xs={24} md={8}>
                <AppCard
                  data-testid={`alt-locked-${a.id}`}
                  style={{ opacity: 0.7, background: "#fafafa" }}
                  title={
                    <Space>
                      <span aria-hidden>🔒</span>
                      <Tag color="default">
                        {a.questionNo != null
                          ? tCommon("questionNo", { no: a.questionNo })
                          : a.domain}
                      </Tag>
                    </Space>
                  }
                >
                  <Space
                    orientation="vertical"
                    size="small"
                    style={{ width: "100%" }}
                  >
                    <Text type="secondary">{t("lockedNotice")}</Text>
                    <Button
                      size="small"
                      onClick={() => router.push("/paywall" as never)}
                    >
                      {t("upgradeInfo")}
                    </Button>
                  </Space>
                </AppCard>
              </Col>
            );
          }

          const handleClick = () => {
            if (onSelect) {
              onSelect(a);
            } else {
              router.push(
                writingProblemHref({
                  questionNo: a.questionNo,
                  problemId: a.id,
                }) as never,
              );
            }
          };

          return (
            <Col key={a.id} xs={24} md={8}>
              <AppCard
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
                      {a.questionNo != null
                        ? tCommon("questionNo", { no: a.questionNo })
                        : a.domain}
                    </Tag>
                    {diffLabel ? <Tag color="purple">{diffLabel}</Tag> : null}
                    {a.estimatedMinutes != null ? (
                      <Tag color="cyan">
                        {tCommon("minutes", { minutes: a.estimatedMinutes })}
                      </Tag>
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
              </AppCard>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}
