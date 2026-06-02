"use client";

// X-13 이용약관 placeholder 본문.
//
// 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면. 정식 법무 검토
// 약관은 운영 진입 전 별도 작업으로 게시되며, 현 화면은 회원가입 동의 라벨/
// 랜딩 헤더에서 연결되는 최소 disclosure placeholder다.
//
// "use client": antd 복합 컴포넌트(Typography.Title/Paragraph, Card)를
// 서버 컴포넌트에서 쓰면 prod-only React #130 크래시가 나므로 필수.

import Link from "next/link";
import { Card, Space, Typography } from "antd";

const { Title, Paragraph, Text } = Typography;

export function TermsContent() {
  return (
    <Card style={{ maxWidth: 720, margin: "0 auto" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* §1 법적 고지 페이지 (제목 + 임시 약관 안내) */}
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            이용약관
          </Title>
          <Paragraph style={{ marginBottom: 0 }}>
            본 페이지는 TALKPIK AI 서비스의 임시 이용약관 안내입니다. 정식
            이용약관은 운영 시작 전 별도 게시 예정이며, 그 시점에 본 페이지가
            공식 약관으로 갱신됩니다.
          </Paragraph>
          <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
            현재 문구는 법무 검토 전 placeholder이며, 확정된 법적 효력을 갖는
            약관이 아닙니다.
          </Paragraph>
        </div>

        {/* §2 임시 약관 요약 */}
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>
            임시 안내
          </Title>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              본 서비스는 TOPIK 글쓰기 학습을 보조하는 도구입니다.
            </li>
            <li style={{ marginBottom: 8 }}>
              학습 데이터는 학습 품질 개선 목적에만 사용됩니다.
            </li>
            <li style={{ marginBottom: 8 }}>
              개인정보 처리 방식은{" "}
              <Link href="/privacy">개인정보처리방침</Link> 페이지를
              참고해주세요.
            </li>
            <li>
              정식 약관이 게시되면 가입 시 다시 동의를 받습니다. 현재 가입은
              본 임시 안내에 대한 동의로 처리됩니다.
            </li>
          </ul>
        </div>

        {/* §3 운영 문의 안내 — 존재하지 않는 채널을 꾸며내지 않는다 */}
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>
            문의
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            정식 약관 게시 전까지는 별도의 고객지원 채널이 준비되지
            않았습니다. 가입 후 사용 중 인증 관련 문제가 발생하면 인증 오류
            페이지의 안내를 참고해주세요.
          </Paragraph>
        </div>

        {/* §4 Escape 링크 — 홈 / 회원가입 / 개인정보처리방침 */}
        <Paragraph style={{ marginBottom: 0 }}>
          <Text type="secondary">바로가기: </Text>
          <Link href="/">홈</Link>
          {" · "}
          <Link href="/sign-up">가입으로 돌아가기</Link>
          {" · "}
          <Link href="/privacy">개인정보처리방침</Link>
        </Paragraph>
      </Space>
    </Card>
  );
}
