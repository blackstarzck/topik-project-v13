"use client";

import { Button, Card, Col, Row, Tag, Typography } from "antd";
import Link from "next/link";

const { Title, Paragraph } = Typography;

/**
 * X-08 region 3 운영 카드.
 *
 * description.md 제약: "카드 3개 이하, 카드 CTA 1개, 권한별 노출 제어."
 *
 * 정직성 원칙: 과제 생성 / 공지 발송은 전용 백엔드(조직/과제 테이블, 알림 전송
 * 인프라)가 아직 없으므로 "준비 중" 카드로 노출하고 실제 동작을 약속하지 않는다.
 * (조직/과제 테이블 부재는 functional-spec.md 및 deferred-scope 기준)
 * "사용자 관리"는 실제 동작하는 동선(/admin/users)이므로 활성 CTA로 노출한다.
 */
export function AdminOrgOperationsCards() {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}>
        <Card size="small" style={{ height: "100%" }}>
          <Title level={5} style={{ marginTop: 0 }}>
            사용자 관리
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            학습자 권한과 상태를 확인하고 변경합니다.
          </Paragraph>
          <Link href="/admin/users">
            <Button type="primary">사용자 관리 열기</Button>
          </Link>
        </Card>
      </Col>

      <Col xs={24} md={8}>
        <Card size="small" style={{ height: "100%" }}>
          <Title level={5} style={{ marginTop: 0 }}>
            과제 생성 <Tag color="default">준비 중</Tag>
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            기관 과제 배포 기능은 준비 중입니다. 현재는 사용할 수 없습니다.
          </Paragraph>
          <Button disabled>과제 생성</Button>
        </Card>
      </Col>

      <Col xs={24} md={8}>
        <Card size="small" style={{ height: "100%" }}>
          <Title level={5} style={{ marginTop: 0 }}>
            공지 발송 <Tag color="default">준비 중</Tag>
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            기관 공지 발송 기능은 준비 중입니다. 현재는 사용할 수 없습니다.
          </Paragraph>
          <Button disabled>공지 발송</Button>
        </Card>
      </Col>
    </Row>
  );
}
