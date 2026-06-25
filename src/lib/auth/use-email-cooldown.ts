"use client";

// Codex P4 D7 — VerifyEmailCard 의 localStorage 기반 cooldown 패턴을 공통화한 hook.
// X-06 PasswordResetRequestForm 신규 도입 시 이 hook 사용. X-12 VerifyEmailCard 의
// 기존 in-place 구현은 regression risk 회피 위해 그대로 유지하며, 차후 같은 hook
// 으로 refactor 권장 (별도 PR).
//
// 보안 의도:
// - localStorage timestamp 기반: 새로고침 / 탭 재방문에도 cooldown 유지 → 우회 차단.
// - SSR-safe: 서버/클라이언트 첫 렌더는 0으로 맞추고 마운트 후 useEffect 에서 복원.
// - 백그라운드 탭 drift 보정: setInterval tick 마다 localStorage 의 until 으로 다시 계산.

import { useCallback, useSyncExternalStore } from "react";
import { EMAIL_COOLDOWN_SECONDS } from "@/lib/request-control/policies";

export const DEFAULT_COOLDOWN_SECONDS = EMAIL_COOLDOWN_SECONDS;

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

const cooldownSubscribers = new Map<string, Set<() => void>>();

function notifyCooldownSubscribers(storageKey: string): void {
  const subscribers = cooldownSubscribers.get(storageKey);
  if (!subscribers) return;
  subscribers.forEach((callback) => callback());
}

function subscribeCooldown(
  storageKey: string,
  onStoreChange: () => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const subscribers = cooldownSubscribers.get(storageKey) ?? new Set();
  subscribers.add(onStoreChange);
  cooldownSubscribers.set(storageKey, subscribers);

  const timer = window.setInterval(() => {
    const fresh = readRemaining(storageKey);
    if (fresh <= 0) {
      clearStorage(storageKey);
    }
    onStoreChange();
  }, 1000);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    window.clearInterval(timer);
    window.removeEventListener("storage", handleStorage);
    subscribers.delete(onStoreChange);
    if (subscribers.size === 0) {
      cooldownSubscribers.delete(storageKey);
    }
  };
}

// i18n: the hook intentionally exposes only the raw `remaining` seconds. The
// display label ("5분 30초 후 다시 보낼 수 있어요") is locale-specific copy, so
// the consuming component formats it via t() (auth.countdown.* + auth.cooldown.label).
export type EmailCooldown = {
  /** 남은 초. 0 이면 cooldown 없음. */
  remaining: number;
  /** cooldown 시작. seconds 미지정 시 default 60초. */
  start: (seconds?: number) => void;
};

export function useEmailCooldown(
  storageKey: string,
  defaultSeconds: number = DEFAULT_COOLDOWN_SECONDS,
): EmailCooldown {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeCooldown(storageKey, onStoreChange),
    [storageKey],
  );
  const getSnapshot = useCallback(
    () => readRemaining(storageKey),
    [storageKey],
  );
  const remaining = useSyncExternalStore(subscribe, getSnapshot, () => 0);

  const start = useCallback(
    (seconds?: number): void => {
      const value = seconds ?? defaultSeconds;
      writeStart(storageKey, value);
      notifyCooldownSubscribers(storageKey);
    },
    [defaultSeconds, storageKey],
  );

  return { remaining, start };
}
