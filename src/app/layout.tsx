import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "./providers";
import "../styles/global.css";

export const metadata: Metadata = {
  title: {
    default: "TALKPIK AI",
    template: "%s | TALKPIK AI",
  },
  description: "TOPIK learning workspace for practice, writing, and feedback.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
