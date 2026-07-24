import { describe, expect, it } from "vitest";

import { collectSystemReportDiagnostics } from "../../src/lib/system-report-diagnostics";

describe("collectSystemReportDiagnostics", () => {
  it("returns only the approved coarse fields and strips query/hash data", () => {
    const diagnostics = collectSystemReportDiagnostics({
      pathname: "/terms?invite=secret#private",
      locale: "ko",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
      viewportWidth: 1280.9,
      viewportHeight: 799.7,
    });

    expect(diagnostics).toEqual({
      pathname: "/terms",
      browser: "edge",
      os: "windows",
      deviceType: "desktop",
      viewportWidth: 1280,
      viewportHeight: 799,
      locale: "ko",
    });
    expect(Object.keys(diagnostics).sort()).toEqual(
      [
        "browser",
        "deviceType",
        "locale",
        "os",
        "pathname",
        "viewportHeight",
        "viewportWidth",
      ].sort(),
    );
    expect(JSON.stringify(diagnostics)).not.toContain("Mozilla");
    expect(JSON.stringify(diagnostics)).not.toContain("secret");
    expect(JSON.stringify(diagnostics)).not.toContain("private");
  });

  it("coarsens an iPhone Safari environment", () => {
    expect(
      collectSystemReportDiagnostics({
        pathname: "/auth/error",
        locale: "vi",
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
        viewportWidth: 390,
        viewportHeight: 844,
      }),
    ).toEqual({
      pathname: "/auth/error",
      browser: "safari",
      os: "ios",
      deviceType: "mobile",
      viewportWidth: 390,
      viewportHeight: 844,
      locale: "vi",
    });
  });

  it("uses explicit coarse fallbacks for an unrecognized environment", () => {
    expect(
      collectSystemReportDiagnostics({
        pathname: "not-a-path",
        locale: "unsupported",
        userAgent: "",
        viewportWidth: Number.NaN,
        viewportHeight: -5,
      }),
    ).toEqual({
      pathname: "/",
      browser: "other",
      os: "other",
      deviceType: "unknown",
      viewportWidth: 0,
      viewportHeight: 0,
      locale: "ko",
    });
  });
});
