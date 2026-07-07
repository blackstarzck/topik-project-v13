import { existsSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ className: "mock-font", variable: "mock-font-variable" }),
}));

vi.mock("@ant-design/nextjs-registry", () => ({
  AntdRegistry: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../src/i18n/request", () => ({
  resolveLocale: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getMessages: vi.fn(),
}));

vi.mock("../../src/app/providers", () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => children,
}));

import { metadata } from "../../src/app/layout";

describe("Root metadata", () => {
  it("registers the public thumbnail as the Open Graph and Twitter preview image", () => {
    expect(existsSync(join(process.cwd(), "public/assets/thumnail.png"))).toBe(
      true,
    );
    expect(metadata.metadataBase?.toString()).toBe("http://127.0.0.1:3000/");
    expect(metadata.openGraph).toMatchObject({
      images: [
        {
          url: "/assets/thumnail.png",
          width: 1672,
          height: 941,
          alt: "TALKPIK AI",
        },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [
        {
          url: "/assets/thumnail.png",
          alt: "TALKPIK AI",
        },
      ],
    });
  });
});
