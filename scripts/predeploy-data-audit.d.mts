export type SeedAuditSeverity = "block" | "warn";

export type SeedAuditCheck = {
  id: string;
  table: string;
  severity: SeedAuditSeverity;
  description: string;
};

export function buildSeedAuditChecks(): SeedAuditCheck[];

export function summarizeAuditResults(
  checks: SeedAuditCheck[],
  countsById: Record<string, number>,
): {
  blockingIds: string[];
  warningIds: string[];
  totalBlockingRows: number;
};

export function assertSafeTarget(input: {
  envLabel: string;
  allowProd: boolean;
}): void;
