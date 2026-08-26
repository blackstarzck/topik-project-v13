"use client";

// "use client" is required: these skeletons render antd compound subcomponents
// (<Skeleton.Button> / <Skeleton.Avatar>). In a React Server Component an antd
// compound member resolves to `undefined` (RSC client-reference proxy) → runtime
// "Element type is invalid". Same rationale as dashboard/loading.tsx.
import { Skeleton } from "antd";
import type { ReactNode } from "react";

import { SettingsPageFrame } from "@/components/shared/SettingsPageFrame";

/**
 * 설정 그룹(프로필 · 계정 · 언어 · 학습 목표 · 알림) route loading 스켈레톤의 공유 셸.
 *
 * 각 페이지와 동일한 `SettingsPageFrame` + 헤더 영역을 그대로 그려
 * route 전환 시 AppLoading 스피너 대신 레이아웃 매칭 스켈레톤으로 통일한다
 * (dashboard/loading.tsx와 같은 패턴). 본문 스켈레톤은 children으로 주입한다.
 */
export function SettingsPageSkeleton({
  subtitle = true,
  children,
}: {
  /** 페이지 부제목(서브타이틀) 노출 여부. 계정 설정처럼 부제목이 없는 화면은 false. */
  subtitle?: boolean;
  children: ReactNode;
}) {
  return (
    <SettingsPageFrame>
      <div className="app-page-header">
        <div className="app-page-header__titles flex-1">
          <Skeleton
            active
            title={{ width: 160 }}
            paragraph={subtitle ? { rows: 1, width: "72%" } : false}
          />
        </div>
      </div>
      {children}
    </SettingsPageFrame>
  );
}

/** 세로형 폼 필드 스켈레톤(라벨 위 / 컨트롤 아래) — 프로필 입력 필드용. */
export function SkeletonField() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton.Button active size="small" className="w-[120px]" />
      <Skeleton.Button active block size="large" />
    </div>
  );
}

/**
 * 가로형 필드 행 스켈레톤(라벨 좌 / 컨트롤 우) — `.settings-field-row` 그리드를
 * 그대로 재사용해 언어 · 학습 목표 화면의 행 레이아웃과 일치시킨다.
 */
export function SkeletonFieldRow() {
  return (
    <div className="settings-field-row">
      <div className="settings-field-row-label">
        <Skeleton.Button active size="small" className="w-[100px]" />
      </div>
      <div className="settings-field-row-control">
        <Skeleton.Button active block size="large" />
      </div>
    </div>
  );
}
