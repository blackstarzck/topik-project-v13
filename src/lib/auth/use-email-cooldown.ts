"use client";

// Codex P4 D7 — VerifyEmailCard 의 localStorage 기반 cooldown 패턴을 공통화한 hook.
// X-06 PasswordResetRequestForm 신규 도입 시 이 hook 사용. X-12 VerifyEmailCard 의
// 기존 in-place 구현은 regression risk 회피 위해 그대로 유지하며, 차후 같은 hook
// 으로 refactor 권장 (별도 PR).
//
// 보안 의도:
// - localStorage timestamp 기반: 새로고침 / 탭 재방문에도 cooldown 유지 → 우회 차단.
// - SSR-safe: window 가드 + 마운트 후 useEffect 에서 복원.
// - 백그라운드 탭 drift 보정: setInterval tick 마다 localStorage 의 until 으로 다시 계산.

import { useEffect, useMemo, useRef, useState } from "react";

export const DEFAULT_COOLDOWN_SECONDS = 60;

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0초";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  if (seconds === 0) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}

function readRemaining(storageKey: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return 0;
    const until = Number(raw);
    if (!Number.isFinite(until)) return 0;
    const remainingSeconds = Math.ceil((until - Date.now()) / 1000);
    return remainingSeconds > 0 ? remainingSeconds : 0;
  } catch {
    return 0;
  }
}

function writeStart(storageKey: string, seconds: number): void {
  if (typeof window === "undefined") return;
  try {
    if (seconds <= 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    const until = Date.now() + seconds * 1000;
    window.localStorage.setItem(storageKey, String(until));
  } catch {
    /* quota / privacy-mode 등 — silent (UI cooldown 은 memory state 로 동작) */
  }
}

function clearStorage(storageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    /* silent */
  }
}

export type EmailCooldown = {
  /** 남은 초. 0 이면 cooldown 없음. */
  remaining: number;
  /** cooldown 시작. seconds 미지정 시 default 60초. */
  start: (seconds?: number) => void;
  /** 화면에 표시할 카운트다운 라벨 ("5분 30초 후 다시 보낼 수 있어요"). cooldown 없으면 null. */
  countdownLabel: string | null;
};

export function useEmailCooldown(
  storageKey: string,
  defaultSeconds: number = DEFAULT_COOLDOWN_SECONDS,
): EmailCooldown {
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const initial = readRemaining(storageKey);
    if (initial > 0) setRemaining(initial);
  }, [storageKey]);

  useEffect(() => {
    if (remaining <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      clearStorage(storageKey);
      return;
    }
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        const fresh = readRemaining(storageKey);
        setRemaining(fresh);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [remaining, storageKey]);

  function start(seconds?: number): void {
    const value = seconds ?? defaultSeconds;
    writeStart(storageKey, value);
    setRemaining(value);
  }

  const countdownLabel = useMemo(() => {
    if (remaining <= 0) return null;
    return `${formatCountdown(remaining)} 후 다시 보낼 수 있어요`;
  }, [remaining]);

  return { remaining, start, countdownLabel };
}
