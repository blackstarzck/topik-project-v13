"use client";

import { Button, Card, Col, Row, Tag, Typography } from "antd";
import { useState } from "react";
import { AdminOrgAssignmentModal } from "./AdminOrgAssignmentModal";

const { Title, Paragraph } = Typography;

/**
 * X-08 region 3 운영 카드.
 *
 * description.md 제약: "카드 3개 이하, 카드 CTA 1개, 권한별 노출 제어."
 *
 * 정직성 원칙:
 *  - 과제 생성: assignments 테이블에 실제로 기록되는 동선(모달). 단, 기관
 *    생성(부트스트랩) RPC 가 없어 기관이 없으면 생성이 막힘 → 모달 안에서 정직하게
 *    안내한다.
 *  - 공지 발송: 실제 발송 인프라(이메일/SMS/Zalo)는 연동 예정 → 외부 스텁.
 *  - 리포트 다운로드: 집계 리포트 생성/내보내기 파이프라인 연동 예정 → 외부 스텁.
 */
export function AdminOrgOperationsCards() {
  const [assignmentOpen, setAssignmentOpen] = useState(false);

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card size="small" style={{ height: "100%" }}>
            <Title level={5} style={{ marginTop: 0 }}>
              과제 생성
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              학습자에게 부여할 과제를 만듭니다.
            </Paragraph>
            <Button type="primary" onClick={() => setAssignmentOpen(true)}>
              과제 만들기
            </Button>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card size="small" style={{ height: "100%" }}>
            <Title level={5} style={{ marginTop: 0 }}>
              공지 발송 <Tag color="default">연동 예정</Tag>
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              기관 공지 발송(이메일/알림)은 발송 인프라 연동 예정입니다.
            </Paragraph>
            <Button disabled>공지 발송</Button>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card size="small" style={{ height: "100%" }}>
            <Title level={5} style={{ marginTop: 0 }}>
              리포트 다운로드 <Tag color="default">연동 예정</Tag>
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              기관 집계 리포트 내보내기는 리포트 파이프라인 연동 예정입니다.
            </Paragraph>
            <Button disabled>리포트 다운로드</Button>
          </Card>
        </Col>
      </Row>

      <AdminOrgAssignmentModal
        open={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
      />
    </>
  );
}
