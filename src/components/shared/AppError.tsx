"use client";

import { Button, Result } from "antd";

type Props = {
  error?: Error;
  reset?: () => void;
};

export function AppError({ error, reset }: Props) {
  return (
    <Result
      status="error"
      title="문제가 발생했어요"
      subTitle={error?.message ?? "다시 시도해 주세요."}
      extra={
        reset ? (
          <Button type="primary" onClick={reset}>
            다시 시도
          </Button>
        ) : null
      }
    />
  );
}
