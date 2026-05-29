"use client";

import { Button, Space, Typography } from "antd";
import Link from "next/link";

const { Title, Paragraph } = Typography;

export function Hero() {
  return (
    <section
      style={{
        textAlign: "center",
        padding: "64px 16px",
      }}
    >
      <Title level={1}>TOPIK 글쓰기, AI와 함께 끝까지</Title>
      <Paragraph style={{ fontSize: 18 }}>
        학습 목표를 정하고, 문제를 풀고, AI 피드백으로 약점을 좁히세요. TOPIK
        51~54번 글쓰기 환경을 그대로 재현합니다.
      </Paragraph>
      <Space size="middle" style={{ marginTop: 24 }}>
        <Link href="/sign-up">
          <Button type="primary" size="large">
            무료 시작
          </Button>
        </Link>
        <Link href="/login">
          <Button size="large">로그인</Button>
        </Link>
      </Space>
    </section>
  );
}
