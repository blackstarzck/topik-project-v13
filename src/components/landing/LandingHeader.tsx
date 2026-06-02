"use client";

// X-01 §1 헤더/내비
//   - 로고, 주요 메뉴(4개 이하), 로그인/시작 버튼
//   - 제약: 메뉴 4개 이하, 로고 클릭은 랜딩 상단 이동
//   - 예외: 로그인 사용자는 "시작" 대신 "대시보드" CTA 표시
//
// Plain anchor links scroll to in-page sections (로고 = 상단 이동). Auth state
// is resolved server-side and passed in so anonymous visitors keep the public
// default with no client session round-trip.

import { Button, Space } from "antd";
import Link from "next/link";

type NavItem = { label: string; href: string };

// 제약: 메뉴 4개 이하.
const NAV_ITEMS: NavItem[] = [
  { label: "기능", href: "#features" },
  { label: "미리보기", href: "#preview" },
  { label: "이용약관", href: "/terms" },
];

type Props = {
  isAuthenticated: boolean;
};

export function LandingHeader({ isAuthenticated }: Props) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 0",
        borderBottom: "1px solid var(--app-border, #f0f0f0)",
        flexWrap: "wrap",
      }}
    >
      {/* 로고 클릭 = 랜딩 상단(#top) 이동 */}
      <a
        href="#top"
        style={{
          fontWeight: 700,
          fontSize: 20,
          color: "inherit",
          textDecoration: "none",
        }}
        aria-label="TALKPIK 홈 상단으로 이동"
      >
        TALKPIK<span style={{ color: "#1677ff" }}> AI</span>
      </a>

      <nav aria-label="주요 메뉴">
        <Space size="large" wrap>
          {NAV_ITEMS.map((item) =>
            item.href.startsWith("#") ? (
              <a
                key={item.href}
                href={item.href}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {item.label}
              </Link>
            ),
          )}
        </Space>
      </nav>

      {/* 예외: 로그인 사용자는 대시보드 CTA */}
      {isAuthenticated ? (
        <Link href="/dashboard">
          <Button type="primary">대시보드</Button>
        </Link>
      ) : (
        <Space>
          <Link href="/login">
            <Button>로그인</Button>
          </Link>
          <Link href="/sign-up">
            <Button type="primary">무료 시작</Button>
          </Link>
        </Space>
      )}
    </header>
  );
}
