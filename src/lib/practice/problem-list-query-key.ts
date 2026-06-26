import type { ProblemFilter, ProblemSort } from "./types";

export const USER_PROBLEMS_RPC_QUERY_KEY_ROOT = [
  "list-user-problems-rpc",
] as const;

export function userProblemsRpcKey(params: {
  filter: ProblemFilter;
  sort: ProblemSort;
  page: number;
  pageSize: number;
  userId?: string;
}) {
  return [...USER_PROBLEMS_RPC_QUERY_KEY_ROOT, params] as const;
}
