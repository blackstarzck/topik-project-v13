import { Spin } from "antd";

export function AppLoading({ tip = "불러오는 중..." }: { tip?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4rem 1rem",
      }}
    >
      <Spin tip={tip} size="large" />
    </div>
  );
}
