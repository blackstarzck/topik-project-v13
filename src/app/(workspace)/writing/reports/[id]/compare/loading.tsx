"use client";

import { Skeleton } from "antd";
import { ReportPageHeader } from "@/components/shared/ReportPageHeader";

function HeaderActionsSkeleton() {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 lg:justify-end">
      <Skeleton.Button active className="w-[120px]" />
      <Skeleton.Button active className="w-[120px]" />
      <Skeleton.Button active className="w-[120px]" />
      <Skeleton.Button active className="w-[88px]" />
    </div>
  );
}

export default function CompareReportLoading() {
  return (
    <div
      data-testid="comparison-page-loading"
      className="relative flex min-h-full w-full flex-col overflow-x-hidden bg-background"
    >
      <ReportPageHeader
        testId="comparison-page-header"
        title={<Skeleton.Button active className="w-[160px]" />}
        actions={<HeaderActionsSkeleton />}
      />

      <div className="app-workspace-body app-workspace-body--workspace flex w-full flex-col gap-20 px-4 pt-[100px] pb-32 sm:px-6 sm:pb-40">
        <section className="min-w-0 py-2">
          <div className="mb-6 flex justify-end">
            <Skeleton.Button active className="w-[140px]" />
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            <Skeleton active avatar paragraph={{ rows: 1 }} />
            <Skeleton active avatar paragraph={{ rows: 1 }} />
          </div>
        </section>

        <section className="min-w-0 py-2">
          <Skeleton active paragraph={{ rows: 2 }} />
        </section>

        <section className="min-w-0 py-2">
          <Skeleton active paragraph={{ rows: 8 }} />
        </section>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <section key={index} className="min-w-0 py-2">
              <Skeleton active paragraph={{ rows: 2 }} />
            </section>
          ))}
        </div>

        <section className="min-w-0 py-2">
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton active paragraph={{ rows: 5 }} />
            <Skeleton active paragraph={{ rows: 5 }} />
          </div>
        </section>
      </div>
    </div>
  );
}
