// NOTE: Server-only by convention. RSC callers should use getLibraryDashboard.
import type { LibraryDashboardView } from "./types";
import { buildLibraryDashboardFromRows as buildDashboard } from "./dashboard-builder";
import {
  queryLibraryDashboardRows,
  type ClientFactory,
} from "./dashboard-query";

export { buildLibraryDashboardFromRows } from "./dashboard-builder";
export type { LibraryDashboardRows } from "./dashboard-builder";

export async function getLibraryDashboard(
  userId: string,
  createClient: ClientFactory | undefined = undefined,
): Promise<LibraryDashboardView> {
  const rows = await queryLibraryDashboardRows(userId, createClient);
  return buildDashboard(rows);
}
