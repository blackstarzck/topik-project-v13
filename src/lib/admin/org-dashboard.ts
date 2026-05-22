export type AdminRecentEvent = {
  event_type: string;
  occurred_at: string;
  user_id: string | null;
  payload: unknown;
};

export type AdminOrgDashboardData = {
  learner_count: number;
  active_7d_count: number;
  submissions_7d_count: number;
  recent_events: AdminRecentEvent[];
};

const EMPTY: AdminOrgDashboardData = {
  learner_count: 0,
  active_7d_count: 0,
  submissions_7d_count: 0,
  recent_events: [],
};

export function fromRpcRow(data: unknown): AdminOrgDashboardData {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return EMPTY;
  const r = row as Record<string, unknown>;
  return {
    learner_count: typeof r.learner_count === "number" ? r.learner_count : 0,
    active_7d_count:
      typeof r.active_7d_count === "number" ? r.active_7d_count : 0,
    submissions_7d_count:
      typeof r.submissions_7d_count === "number" ? r.submissions_7d_count : 0,
    recent_events: Array.isArray(r.recent_events)
      ? (r.recent_events as AdminRecentEvent[])
      : [],
  };
}
