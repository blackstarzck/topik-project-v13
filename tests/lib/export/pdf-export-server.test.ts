import { describe, expect, it, vi } from "vitest";

import {
  assertMonthlyPdfExportLimit,
  PdfExportRequestError,
} from "../../../src/lib/export/pdf-export-server";

describe("assertMonthlyPdfExportLimit", () => {
  it("allows the third monthly PDF export attempt", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            neq: vi.fn(() => ({
              gte: vi.fn(() => ({
                lt: vi.fn(async () => ({ count: 2, error: null })),
              })),
            })),
          })),
        })),
      })),
    };

    await expect(
      assertMonthlyPdfExportLimit(
        supabase as never,
        "user-1",
        new Date("2026-06-17T12:00:00.000Z"),
      ),
    ).resolves.toBeUndefined();
  });

  it("blocks the fourth monthly PDF export attempt", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            neq: vi.fn(() => ({
              gte: vi.fn(() => ({
                lt: vi.fn(async () => ({ count: 3, error: null })),
              })),
            })),
          })),
        })),
      })),
    };

    await expect(
      assertMonthlyPdfExportLimit(
        supabase as never,
        "user-1",
        new Date("2026-06-17T12:00:00.000Z"),
      ),
    ).rejects.toBeInstanceOf(PdfExportRequestError);
  });
});
