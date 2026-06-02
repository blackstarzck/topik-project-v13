"use client";

import { useState } from "react";
import { Button, Space, Typography } from "antd";
import { useRouter } from "next/navigation";

import { AuthMascot } from "@/components/auth/AuthMascot";

const { Title, Paragraph } = Typography;

type HeroProps = {
  /**
   * description §1/§3 exception: a logged-in visitor sees a 대시보드 CTA
   * instead of 무료 시작/로그인. Defaults to the public (logged-out) variant.
   */
  isAuthenticated?: boolean;
};

export function Hero({ isAuthenticated = false }: HeroProps) {
  const router = useRouter();
  // §3 제약: "클릭 후 중복 이동 차단" — once a primary CTA is pressed we lock
  // it so a double-click can't fire a second navigation.
  const [navigating, setNavigating] = useState(false);

  function go(href: string) {
    if (navigating) return;
    setNavigating(true);
    router.push(href);
  }

  return (
    <section
      id="top"
      style={{
        textAlign: "center",
        padding: "56px 16px 24px",
      }}
    >
      {/* §5 마스코트 — 첫 화면 CTA와 겹치지 않게 카피 위에 배치, 대체 텍스트 필수 */}
      <AuthMascot
        alt="TALKPIK 학습 도우미 캐릭터"
        emoji="🐥"
        size={64}
      />
      <Title level={1} style={{ marginTop: 16 }}>
        TOPIK 글쓰기, AI와 함께 끝까지
      </Title>
      <Paragraph style={{ fontSize: 18 }}>
        학습 목표를 정하고, 문제를 풀고, AI 피드백으로 약점을 좁히세요. TOPIK
        51~54번 글쓰기 환경을 그대로 재현합니다.
      </Paragraph>
      {isAuthenticated ? (
        <Space size="middle" style={{ marginTop: 24 }}>
          <Button
            type="primary"
            size="large"
            loading={navigating}
            onClick={() => go("/dashboard")}
          >
            대시보드로 이동
          </Button>
        </Space>
      ) : (
        <Space size="middle" style={{ marginTop: 24 }}>
          <Button
            type="primary"
            size="large"
            loading={navigating}
            onClick={() => go("/sign-up")}
          >
            무료 시작
          </Button>
          <Button
            size="large"
            disabled={navigating}
            onClick={() => go("/login")}
          >
            로그인
          </Button>
        </Space>
      )}
    </section>
  );
}
