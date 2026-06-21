"use client";

// "use client": renders antd compound skeletons (<Skeleton.Button>). See
// SettingsPageSkeleton for the full RSC note. (<Divider> is not a compound.)
import { Divider, Skeleton } from "antd";

import { SettingsPageSkeleton } from "@/components/shared/SettingsPageSkeleton";

/**
 * `/settings/notifications` route loading skeleton — mirrors NotificationPrefsForm
 * (`.notification-settings-redesign`: 알림 채널 3열 그리드 → Divider → 학습 루틴 행 →
 * Divider → 받을 알림 토글 행 → 저장) so navigation shows a layout-matched skeleton
 * instead of the shared AppLoading spinner.
 */
export default function NotificationsSettingsLoading() {
  return (
    <SettingsPageSkeleton>
      <div className="notification-settings-redesign">
        {/* 알림 채널: 헤더 + 설명 + 3열 채널 카드 */}
        <div className="flex flex-col gap-2">
          <Skeleton.Button active size="small" className="w-[88px]" />
          <Skeleton.Button active size="small" className="w-[180px]" />
          <div className="notification-settings-channel-grid mt-4">
            <Skeleton.Button active block className="!h-16" />
            <Skeleton.Button active block className="!h-16" />
            <Skeleton.Button active block className="!h-16" />
          </div>
        </div>

        <Divider className="notification-settings-divider" />

        {/* 학습 루틴: 헤더 + 설명 + label 좌 / control 우 행 4개 */}
        <div className="flex flex-col gap-2">
          <Skeleton.Button active size="small" className="w-[88px]" />
          <Skeleton.Button active size="small" className="w-[200px]" />
          <div className="mt-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="notification-settings-row">
                <div className="notification-settings-row-label">
                  <Skeleton.Button active size="small" className="w-[72px]" />
                </div>
                <div className="notification-settings-row-control">
                  <Skeleton.Button
                    active
                    block
                    size="large"
                    className="!w-[220px] max-w-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Divider className="notification-settings-divider" />

        {/* 받을 알림: 헤더 + 설명 + 토글 행 3개(좌: 제목/설명, 우: 스위치) */}
        <div className="flex flex-col gap-2">
          <Skeleton.Button active size="small" className="w-[88px]" />
          <Skeleton.Button active size="small" className="w-[200px]" />
          <div className="mt-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="notification-settings-type-row">
                <div className="notification-settings-type-copy">
                  <Skeleton.Button active size="small" className="w-[120px]" />
                  <Skeleton.Button active size="small" className="w-[180px]" />
                </div>
                <Skeleton.Button active size="small" className="!w-11" />
              </div>
            ))}
          </div>
        </div>

        {/* 저장 버튼 */}
        <Skeleton.Button active className="w-[96px]" />
      </div>
    </SettingsPageSkeleton>
  );
}
