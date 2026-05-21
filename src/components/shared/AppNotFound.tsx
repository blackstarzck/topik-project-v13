import Link from "next/link";
import { Button, Result } from "antd";

export function AppNotFound() {
  return (
    <Result
      status="404"
      title="페이지를 찾을 수 없습니다"
      subTitle="요청하신 경로가 존재하지 않거나 이동되었습니다."
      extra={
        <Link href="/dashboard">
          <Button type="primary">대시보드로 이동</Button>
        </Link>
      }
    />
  );
}
