import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
  },
  reporter: [["list"]],
});
