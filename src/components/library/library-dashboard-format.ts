const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;
const EN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getKstParts(iso: string | null): DateParts | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
  };
}

export function formatDashboardMonthDay(
  iso: string | null,
  locale: string,
): string | null {
  const parts = getKstParts(iso);
  if (!parts) return null;
  if (locale.startsWith("ko")) return `${parts.month}월 ${parts.day}일`;
  if (locale.startsWith("vi")) return `${pad2(parts.day)}/${pad2(parts.month)}`;
  return `${EN_MONTHS[parts.month - 1]} ${parts.day}`;
}

export function formatDashboardDate(iso: string): string {
  const parts = getKstParts(iso);
  if (!parts) return iso.slice(0, 10);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function formatDashboardShortDateTime(iso: string): string {
  const parts = getKstParts(iso);
  if (!parts) return iso.slice(0, 16).replace("T", " ");
  return `${pad2(parts.month)}. ${pad2(parts.day)}. ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function formatDashboardDateTime(iso: string): string {
  const parts = getKstParts(iso);
  if (!parts) return iso.slice(0, 16).replace("T", " ");
  return `${parts.year}. ${parts.month}. ${parts.day}. ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function formatDashboardRelativeTime(
  iso: string,
  locale = "ko",
  nowMs = Date.now(),
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16).replace("T", " ");

  const elapsedMs = Math.max(0, nowMs - date.getTime());
  if (elapsedMs < MINUTE_MS) {
    return locale.startsWith("ko")
      ? "방금 전"
      : new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
          0,
          "second",
        );
  }

  const bucket = getRelativeTimeBucket(elapsedMs);
  if (locale.startsWith("ko")) {
    return formatKoreanRelativeTime(bucket.value, bucket.unit);
  }

  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(
    -bucket.value,
    bucket.unit,
  );
}

export function formatDashboardInactiveDuration(
  iso: string | null,
  locale = "ko",
  nowMs = Date.now(),
): string | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const elapsedMs = Math.max(0, nowMs - date.getTime());
  const bucket = getInactiveDurationBucket(elapsedMs);

  if (locale.startsWith("ko")) {
    return formatKoreanInactiveDuration(bucket.value, bucket.unit);
  }

  if (locale.startsWith("vi")) {
    return formatVietnameseInactiveDuration(bucket.value, bucket.unit);
  }

  return formatEnglishInactiveDuration(bucket.value, bucket.unit);
}

function getRelativeTimeBucket(elapsedMs: number): {
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
} {
  if (elapsedMs < HOUR_MS) {
    return { value: Math.floor(elapsedMs / MINUTE_MS), unit: "minute" };
  }
  if (elapsedMs < DAY_MS) {
    return { value: Math.floor(elapsedMs / HOUR_MS), unit: "hour" };
  }
  if (elapsedMs < WEEK_MS) {
    return { value: Math.floor(elapsedMs / DAY_MS), unit: "day" };
  }
  if (elapsedMs < MONTH_MS) {
    return { value: Math.floor(elapsedMs / WEEK_MS), unit: "week" };
  }
  if (elapsedMs < YEAR_MS) {
    return { value: Math.floor(elapsedMs / MONTH_MS), unit: "month" };
  }
  return { value: Math.floor(elapsedMs / YEAR_MS), unit: "year" };
}

type InactiveDurationUnit = "year" | "month" | "week" | "day";

function getInactiveDurationBucket(elapsedMs: number): {
  value: number;
  unit: InactiveDurationUnit;
} {
  if (elapsedMs >= YEAR_MS) {
    return { value: Math.floor(elapsedMs / YEAR_MS), unit: "year" };
  }
  if (elapsedMs >= MONTH_MS) {
    return { value: Math.floor(elapsedMs / MONTH_MS), unit: "month" };
  }
  if (elapsedMs >= WEEK_MS) {
    return { value: Math.floor(elapsedMs / WEEK_MS), unit: "week" };
  }
  return { value: Math.floor(elapsedMs / DAY_MS), unit: "day" };
}

function formatKoreanInactiveDuration(
  value: number,
  unit: InactiveDurationUnit,
): string {
  const labels: Record<InactiveDurationUnit, string> = {
    year: "년",
    month: "개월",
    week: "주",
    day: "일",
  };

  return `${value}${labels[unit]}`;
}

function formatVietnameseInactiveDuration(
  value: number,
  unit: InactiveDurationUnit,
): string {
  const labels: Record<InactiveDurationUnit, string> = {
    year: "năm",
    month: "tháng",
    week: "tuần",
    day: "ngày",
  };

  return `${value} ${labels[unit]}`;
}

function formatEnglishInactiveDuration(
  value: number,
  unit: InactiveDurationUnit,
): string {
  const labels: Record<InactiveDurationUnit, string> = {
    year: "year",
    month: "month",
    week: "week",
    day: "day",
  };
  const label = labels[unit];

  return `${value} ${value === 1 ? label : `${label}s`}`;
}

function formatKoreanRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
): string {
  if (unit === "week" && value === 1) return "일주일 전";

  const labels: Record<Intl.RelativeTimeFormatUnit, string> = {
    second: "초",
    seconds: "초",
    minute: "분",
    minutes: "분",
    hour: "시간",
    hours: "시간",
    day: "일",
    days: "일",
    week: "주",
    weeks: "주",
    month: "개월",
    months: "개월",
    quarter: "분기",
    quarters: "분기",
    year: "년",
    years: "년",
  };

  return `${value}${labels[unit]} 전`;
}
