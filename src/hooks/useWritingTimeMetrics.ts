"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { WritingTimeMetricsSnapshot } from "@/lib/writing/metrics";

/**
 * Typing counts as "active" while the last input happened within this
 * window; the 1s tick outside it accrues elapsed time only. 30s matches
 * the contract comment on writing_submission_metrics.
 */
const ACTIVE_IDLE_WINDOW_MS = 30_000;

/**
 * Owns the writing workspace timer that used to be a bare
 * `useState + setInterval` pair in each 51~54 workspace, and additionally
 * measures typing-engaged time for the writing_submission_metrics contract
 * (learning-data collection Phase 1).
 *
 * - `elapsedSeconds`  — same on-screen counter as before (WritingExamShell).
 * - `markInputActivity()` — call from answer onChange handlers.
 * - `getTimeMetricsSnapshot()` — read refs (not state) so the submit
 *   callback gets current values regardless of closure staleness.
 */
export function useWritingTimeMetrics() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedRef = useRef(0);
  const activeSecondsRef = useRef(0);
  const lastInputAtRef = useRef(0);
  const startedAtRef = useRef<string | null>(null);
  if (startedAtRef.current === null) {
    startedAtRef.current = new Date().toISOString();
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      elapsedRef.current += 1;
      if (
        lastInputAtRef.current > 0 &&
        Date.now() - lastInputAtRef.current < ACTIVE_IDLE_WINDOW_MS
      ) {
        activeSecondsRef.current += 1;
      }
      setElapsedSeconds(elapsedRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const markInputActivity = useCallback(() => {
    lastInputAtRef.current = Date.now();
  }, []);

  const getTimeMetricsSnapshot =
    useCallback((): WritingTimeMetricsSnapshot => {
      return {
        elapsedSeconds: elapsedRef.current,
        activeSeconds: Math.min(activeSecondsRef.current, elapsedRef.current),
        startedAt: startedAtRef.current ?? new Date().toISOString(),
      };
    }, []);

  return { elapsedSeconds, markInputActivity, getTimeMetricsSnapshot };
}
