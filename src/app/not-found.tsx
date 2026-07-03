// D-5 (QA 2026-06-12): 루트 세그먼트 404. 이 파일이 없으면 워크스페이스 밖
// 미존재 경로가 Next 기본(영문, 앱 셸 없음) 404로 떨어진다. 루트 레이아웃이
// NextIntlClientProvider + AntdRegistry + AppProviders를 제공하므로
// AppNotFound를 그대로 재사용한다.
import { AppNotFound } from "@/components/shared/AppNotFound";

export default function RootNotFound() {
  return <AppNotFound />;
}
