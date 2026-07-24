import {
  SYSTEM_REPORT_LOCALES,
  type SystemReportBrowser,
  type SystemReportDeviceType,
  type SystemReportDiagnostics,
  type SystemReportLocale,
  type SystemReportOperatingSystem,
} from "@/lib/system-reports";

const POSTGRES_INTEGER_MAX = 2_147_483_647;

type DiagnosticsInput = {
  pathname: string;
  locale: string;
  userAgent?: string;
  viewportWidth?: number;
  viewportHeight?: number;
};

function coarseBrowser(userAgent: string): SystemReportBrowser {
  if (/\b(?:Edg|EdgiOS|EdgA)\//i.test(userAgent)) return "edge";
  if (/\b(?:Chrome|CriOS)\//i.test(userAgent)) return "chrome";
  if (/\b(?:Firefox|FxiOS)\//i.test(userAgent)) return "firefox";
  if (/\bSafari\//i.test(userAgent) && /\bVersion\//i.test(userAgent)) {
    return "safari";
  }
  return "other";
}

function coarseOperatingSystem(userAgent: string): SystemReportOperatingSystem {
  if (/\b(?:iPhone|iPad|iPod)\b/i.test(userAgent)) return "ios";
  if (/\bAndroid\b/i.test(userAgent)) return "android";
  if (/\bWindows\b/i.test(userAgent)) return "windows";
  if (/\b(?:Macintosh|Mac OS X)\b/i.test(userAgent)) return "macos";
  if (/\bLinux\b/i.test(userAgent)) return "linux";
  return "other";
}

function coarseDeviceType(userAgent: string): SystemReportDeviceType {
  if (!userAgent.trim()) return "unknown";
  if (/\b(?:iPad|Tablet)\b/i.test(userAgent)) return "tablet";
  if (/\bAndroid\b/i.test(userAgent) && !/\bMobile\b/i.test(userAgent)) {
    return "tablet";
  }
  if (/\b(?:Mobile|iPhone|iPod)\b/i.test(userAgent)) return "mobile";
  if (/\b(?:Windows|Macintosh|Mac OS X|Linux|CrOS)\b/i.test(userAgent)) {
    return "desktop";
  }
  return "unknown";
}

function safeViewportDimension(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(POSTGRES_INTEGER_MAX, Math.max(0, Math.trunc(value)));
}

function safePathname(pathname: string): string {
  const withoutPrivateParts = pathname.split(/[?#]/, 1)[0] ?? "";
  return withoutPrivateParts.startsWith("/") ? withoutPrivateParts : "/";
}

function safeLocale(locale: string): SystemReportLocale {
  return SYSTEM_REPORT_LOCALES.includes(locale as SystemReportLocale)
    ? (locale as SystemReportLocale)
    : "ko";
}

/**
 * Builds the complete diagnostics object sent with a system report.
 * Raw user-agent, referrer, query, hash and IP data never enter the result.
 */
export function collectSystemReportDiagnostics({
  pathname,
  locale,
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
  viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth,
  viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight,
}: DiagnosticsInput): SystemReportDiagnostics {
  return {
    pathname: safePathname(pathname),
    browser: coarseBrowser(userAgent),
    os: coarseOperatingSystem(userAgent),
    deviceType: coarseDeviceType(userAgent),
    viewportWidth: safeViewportDimension(viewportWidth),
    viewportHeight: safeViewportDimension(viewportHeight),
    locale: safeLocale(locale),
  };
}
