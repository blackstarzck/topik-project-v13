const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
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
