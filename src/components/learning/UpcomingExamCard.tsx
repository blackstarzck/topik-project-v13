import { Card, Statistic, Typography } from "antd";
import dayjs from "dayjs";

const { Paragraph } = Typography;

type Props = {
  examDate: string | null;
};

export function UpcomingExamCard({ examDate }: Props) {
  if (!examDate) return null;
  const exam = dayjs(examDate).startOf("day");
  const daysLeft = exam.diff(dayjs().startOf("day"), "day");
  if (daysLeft < 0) return null;
  return (
    <Card title="예정된 시험">
      <Statistic
        value={exam.format("YYYY-MM-DD")}
        valueStyle={{ fontSize: 20 }}
      />
      <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
        남은 일수: {daysLeft === 0 ? "오늘" : `D-${daysLeft}`}
      </Paragraph>
    </Card>
  );
}
