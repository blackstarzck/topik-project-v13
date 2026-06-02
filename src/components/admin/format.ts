/**
 * Cluster-local formatting + PII-masking helpers shared by the admin surfaces
 * (H-01 / X-08 / X-10). Kept framework-free so both server and client files can
 * import without a `"use client"` boundary.
 */

/** Locale date (date only). Render inside <span suppressHydrationWarning>. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ko-KR");
  } catch {
    return iso;
  }
}

/** Locale date-time. Render inside <span suppressHydrationWarning>. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

/** Short UUID for table display: `00000000…`. */
export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return `${id.slice(0, 8)}…`;
}

/**
 * Mask an email so an admin can recognize the account without the full PII.
 * `kim.minji@example.com` -> `ki•••@example.com`.
 * (description.md 제약: "개인정보는 일부 마스킹".)
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const at = email.indexOf("@");
  if (at <= 0) return "•••";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(local.length - 2, 1))}${domain}`;
}

/** Clamp a status/error string to the documented 60-char ceiling (H-01 region 5). */
export function clampStatus(message: string, max = 60): string {
  if (message.length <= max) return message;
  return `${message.slice(0, max - 1)}…`;
}

/** Ellipsize a long title/label for table cells. */
export function ellipsis(value: string | null | undefined, max = 36): string {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Summarize a free-form JSON payload to its top-level key names only — never the
 * values (could leak emails/answers/tokens). Used in audit/event tables.
 */
export function summarizePayload(payload: unknown): string {
  if (payload == null || typeof payload !== "object") return "—";
  const keys = Object.keys(payload as Record<string, unknown>);
  if (keys.length === 0) return "—";
  const shown = keys.slice(0, 4).join(", ");
  return keys.length > 4 ? `${shown}, …` : shown;
}

/** Korean labels reused across admin tables. */
export const ROLE_LABEL: Record<string, string> = {
  learner: "학습자",
  content_admin: "콘텐츠 관리자",
  org_admin: "기관 관리자",
  platform_admin: "플랫폼 관리자",
};

export const USER_STATUS_LABEL: Record<string, string> = {
  active: "활성",
  blocked: "차단",
  deleted: "삭제",
};

export const PUBLISH_LABEL: Record<string, string> = {
  draft: "초안",
  published: "공개",
  archived: "보관",
};

export const REVIEW_LABEL: Record<string, string> = {
  pending: "검토 대기",
  approved: "승인",
  rejected: "반려",
};

export const DOMAIN_LABEL: Record<string, string> = {
  reading: "읽기",
  listening: "듣기",
  writing: "쓰기",
};

export const VISIBILITY_LABEL: Record<string, string> = {
  private: "비공개",
  public: "공개",
  org: "기관",
};

/** Human label for audit-log action codes. */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "profile.role_change": "권한 변경",
  "profile.status_change": "상태 변경",
  "problem.update": "문제 수정",
  "problem.delete": "문제 삭제",
  "problem.publish_change": "공개 전환",
  "problem_asset.add": "자료 추가",
  "problem_asset.remove": "자료 삭제",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}
