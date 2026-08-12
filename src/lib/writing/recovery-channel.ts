export const RECOVERY_CHANNEL_NAME = "talkpik-writing-recovery";
export const RECOVERY_STORAGE_EVENT_KEY =
  "talkpik-writing-recovery:conflict-event";

export type RecoveryConflictMetadata = {
  eventId: string;
  key: string;
  savedAt: string;
  schemaVersion: number;
};

type MessageListener = (event: { data: unknown }) => void;
type StorageListener = (event: {
  key: string | null;
  newValue: string | null;
}) => void;

export type RecoveryBroadcastChannelLike = {
  addEventListener(type: "message", listener: MessageListener): void;
  close(): void;
  postMessage(message: unknown): void;
  removeEventListener(type: "message", listener: MessageListener): void;
};

export type RecoveryStorageFallback = {
  addEventListener(type: "storage", listener: StorageListener): void;
  localStorage: Pick<Storage, "removeItem" | "setItem">;
  removeEventListener(type: "storage", listener: StorageListener): void;
};

type RecoveryChannelOptions = {
  createBroadcastChannel?: (
    name: string,
  ) => RecoveryBroadcastChannelLike | undefined;
  createEventId?: () => string;
  key: string;
  onConflict: (metadata: RecoveryConflictMetadata) => void;
  storageFallback?: RecoveryStorageFallback;
};

function defaultBroadcastChannel(name: string) {
  try {
    if (
      typeof window === "undefined" ||
      typeof window.BroadcastChannel === "undefined"
    ) {
      return undefined;
    }
    return new window.BroadcastChannel(name) as RecoveryBroadcastChannelLike;
  } catch {
    return undefined;
  }
}

function defaultStorageFallback(): RecoveryStorageFallback | undefined {
  try {
    if (typeof window === "undefined" || !window.localStorage) return undefined;
    return window as unknown as RecoveryStorageFallback;
  } catch {
    return undefined;
  }
}

function defaultEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function parseMetadata(value: unknown): RecoveryConflictMetadata | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 4 ||
    keys[0] !== "eventId" ||
    keys[1] !== "key" ||
    keys[2] !== "savedAt" ||
    keys[3] !== "schemaVersion" ||
    typeof record.eventId !== "string" ||
    record.eventId.length === 0 ||
    typeof record.key !== "string" ||
    record.key.length === 0 ||
    typeof record.savedAt !== "string" ||
    !Number.isInteger(record.schemaVersion) ||
    (record.schemaVersion as number) < 1
  ) {
    return undefined;
  }
  const parsed = Date.parse(record.savedAt);
  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== record.savedAt
  ) {
    return undefined;
  }
  return {
    eventId: record.eventId,
    key: record.key,
    savedAt: record.savedAt,
    schemaVersion: record.schemaVersion as number,
  };
}

export function createRecoveryChannelCoordinator({
  createBroadcastChannel = defaultBroadcastChannel,
  createEventId = defaultEventId,
  key,
  onConflict,
  storageFallback = defaultStorageFallback(),
}: RecoveryChannelOptions) {
  let disposed = false;
  const selfEvents = new Set<string>();
  const selfEventOrder: string[] = [];
  let channel: RecoveryBroadcastChannelLike | undefined;
  let activeStorageFallback = storageFallback;

  try {
    channel = createBroadcastChannel(RECOVERY_CHANNEL_NAME);
  } catch {
    channel = undefined;
  }

  function receive(value: unknown) {
    if (disposed) return;
    const metadata = parseMetadata(value);
    if (!metadata || metadata.key !== key || selfEvents.has(metadata.eventId)) {
      return;
    }
    onConflict(metadata);
  }

  const messageListener: MessageListener = (event) => receive(event.data);
  const storageListener: StorageListener = (event) => {
    if (event.key !== RECOVERY_STORAGE_EVENT_KEY || event.newValue === null) {
      return;
    }
    try {
      receive(JSON.parse(event.newValue));
    } catch {
      // Malformed cross-tab metadata is ignored without exposing its contents.
    }
  };

  if (channel) {
    try {
      channel.addEventListener("message", messageListener);
    } catch {
      try {
        channel.close();
      } catch {
        // Restricted transports are optional; recovery remains local-only.
      }
      channel = undefined;
    }
  }
  if (!channel && activeStorageFallback) {
    try {
      activeStorageFallback.addEventListener("storage", storageListener);
    } catch {
      activeStorageFallback = undefined;
    }
  }

  function publish(savedAt: string) {
    if (disposed || (!channel && !activeStorageFallback)) return undefined;
    const metadata = parseMetadata({
      eventId: createEventId(),
      key,
      savedAt,
      schemaVersion: 1,
    });
    if (!metadata) return undefined;
    selfEvents.add(metadata.eventId);
    selfEventOrder.push(metadata.eventId);
    if (selfEventOrder.length > 100) {
      selfEvents.delete(selfEventOrder.shift()!);
    }
    if (channel) {
      try {
        channel.postMessage(metadata);
      } catch {
        // Cross-tab signaling is best-effort; IndexedDB recovery still works.
      }
    } else if (activeStorageFallback) {
      try {
        activeStorageFallback.localStorage.setItem(
          RECOVERY_STORAGE_EVENT_KEY,
          JSON.stringify(metadata),
        );
        activeStorageFallback.localStorage.removeItem(
          RECOVERY_STORAGE_EVENT_KEY,
        );
      } catch {
        // Storage access may be blocked by privacy mode or browser policy.
      }
    }
    return metadata;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (channel) {
      try {
        channel.removeEventListener("message", messageListener);
        channel.close();
      } catch {
        // Optional transport cleanup must not block component disposal.
      }
    } else if (activeStorageFallback) {
      try {
        activeStorageFallback.removeEventListener("storage", storageListener);
      } catch {
        // Optional transport cleanup must not block component disposal.
      }
    }
    selfEvents.clear();
    selfEventOrder.length = 0;
  }

  return { dispose, publish };
}
