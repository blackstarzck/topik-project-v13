"use client";

// "use client": renders antd compound skeletons (<Skeleton.Button>). See
// SettingsPageSkeleton for the full RSC note.
import { Skeleton } from "antd";

import { AppCard } from "@/components/shared/AppCard";
import { SettingsPageSkeleton } from "@/components/shared/SettingsPageSkeleton";

/**
 * `/settings/account` route loading skeleton — mirrors the account screen
 * (three bordered login-method cards + account-status rows + logout + 회원 탈퇴 카드)
 * so navigation shows a layout-matched skeleton instead of the shared AppLoading
 * spinner. The account page has no subtitle, so the header skeleton omits it.
 */
export default function AccountSettingsLoading() {
  return (
    <SettingsPageSkeleton subtitle={false}>
      <div className="account-settings-redesign">
        {/* 로그인 방법: 개별 테두리 카드 3개 */}
        <section className="app-cards-bordered">
          <div className="account-login-methods">
            <AppCard className="account-login-method">
              <div className="w-full">
                <Skeleton active avatar paragraph={{ rows: 1 }} />
              </div>
            </AppCard>
            <AppCard className="account-login-method">
              <div className="w-full">
                <Skeleton active avatar paragraph={{ rows: 1 }} />
              </div>
            </AppCard>
            <AppCard className="account-login-method">
              <div className="w-full">
                <Skeleton active avatar paragraph={{ rows: 1 }} />
              </div>
            </AppCard>
          </div>
        </section>

        {/* 계정 상태: label 좌 / value 우 행 4개 */}
        <div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="account-status-row">
              <Skeleton.Button active size="small" className="w-[80px]" />
              <div className="flex justify-end">
                <Skeleton.Button active size="small" className="w-[64px]" />
              </div>
            </div>
          ))}
        </div>

        {/* 로그아웃 버튼: 실제 버튼은 desktop min-width 144px / mobile 100% */}
        <div className="flex justify-end">
          <Skeleton.Button active className="w-full md:w-[144px]" />
        </div>

        {/* 회원 탈퇴(danger-zone) 카드 */}
        <section className="account-delete-section">
          <AppCard className="account-delete-card">
            <div className="flex flex-col gap-2">
              <Skeleton.Button active size="small" className="w-[100px]" />
              <Skeleton
                active
                title={false}
                paragraph={{ rows: 1, width: "80%" }}
              />
              <div className="account-delete-actions">
                <Skeleton.Button active className="w-[110px]" />
              </div>
            </div>
          </AppCard>
        </section>
      </div>
    </SettingsPageSkeleton>
  );
}
