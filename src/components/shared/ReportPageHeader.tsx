import type { ReactNode } from "react";
import { Typography } from "antd";

const { Title } = Typography;

type Props = {
  testId: string;
  title: ReactNode;
  actions: ReactNode;
};

export function ReportPageHeader({ testId, title, actions }: Props) {
  return (
    <div
      data-testid={testId}
      className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      <div
        data-testid="report-page-header-inner"
        className="app-workspace-body app-workspace-body--workspace flex w-full flex-col gap-3 px-4 py-4 pr-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:pr-20"
      >
        <div data-testid="report-page-header-title" className="min-w-0">
          <Title level={3} className="!m-0 text-2xl">
            {title}
          </Title>
        </div>
        <div
          data-testid="report-page-header-actions"
          className="w-full shrink-0 lg:w-auto"
        >
          {actions}
        </div>
      </div>
    </div>
  );
}
