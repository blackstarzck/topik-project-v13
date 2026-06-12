import Link from "next/link";
import { Button, Empty } from "antd";

export function EmptyDashboard() {
  return (
    <Empty
      description="아직 학습 기록이 없어요. 추천 문제부터 시작해보세요."
      className="px-4 py-12"
    >
      <Link href="/practice/recommendations">
        <Button type="primary">추천 문제 보기</Button>
      </Link>
    </Empty>
  );
}
