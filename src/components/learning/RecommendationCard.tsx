import Link from "next/link";
import { Button, Card, Tag, Typography } from "antd";

const { Paragraph } = Typography;

type Props = {
  title: string;
  reason?: string | null;
  estimatedMinutes?: number | null;
  ctaHref: string;
};

export function RecommendationCard({
  title,
  reason,
  estimatedMinutes,
  ctaHref,
}: Props) {
  return (
    <Card
      title={title.length > 28 ? `${title.slice(0, 28)}…` : title}
      extra={
        estimatedMinutes ? (
          <Tag color="blue">{estimatedMinutes}분</Tag>
        ) : null
      }
    >
      {reason ? (
        <Paragraph
          type="secondary"
          ellipsis={{ rows: 2 }}
          style={{ marginBottom: 12 }}
        >
          {reason}
        </Paragraph>
      ) : null}
      <Link href={ctaHref as never}>
        <Button type="primary" block>
          이어 풀기
        </Button>
      </Link>
    </Card>
  );
}
