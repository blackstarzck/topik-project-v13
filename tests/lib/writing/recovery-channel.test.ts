import { describe, expect, it, vi } from "vitest";

import {
  RECOVERY_CHANNEL_NAME,
  RECOVERY_STORAGE_EVENT_KEY,
  createRecoveryChannelCoordinator,
} from "../../../src/lib/writing/recovery-channel";

type MessageListener = (event: { data: unknown }) => void;
type StorageListener = (event: {
  key: string | null;
  newValue: string | null;
}) => void;

function broadcastDouble() {
  const listeners = new Set<MessageListener>();
  return {
    addEventListener: (_type: "message", listener: MessageListener) =>
      listeners.add(listener),
    close: vi.fn(),
    emit: (data: unknown) => {
      for (const listener of listeners) listener({ data });
    },
    postMessage: vi.fn(),
    removeEventListener: (_type: "message", listener: MessageListener) =>
      listeners.delete(listener),
  };
}

function storageDouble() {
  const listeners = new Set<StorageListener>();
  return {
    addEventListener: (_type: "storage", listener: StorageListener) =>
      listeners.add(listener),
    emit: (key: string | null, newValue: string | null) => {
      for (const listener of listeners) listener({ key, newValue });
    },
    localStorage: {
      removeItem: vi.fn(),
      setItem: vi.fn(),
    },
    removeEventListener: (_type: "storage", listener: StorageListener) =>
      listeners.delete(listener),
  };
}

describe("recovery cross-tab coordinator", () => {
  it("prefers BroadcastChannel and publishes metadata without answer content", () => {
    const channel = broadcastDouble();
    const storage = storageDouble();
    const conflicts: unknown[] = [];
    const coordinator = createRecoveryChannelCoordinator({
      createBroadcastChannel: (name) => {
        expect(name).toBe(RECOVERY_CHANNEL_NAME);
        return channel;
      },
      createEventId: () => "event-self",
      key: "user-1:problem-1:54",
      onConflict: (metadata) => conflicts.push(metadata),
      storageFallback: storage,
    });

    const published = coordinator.publish("2026-07-18T01:00:00.000Z");
    expect(published).toEqual({
      eventId: "event-self",
      key: "user-1:problem-1:54",
      savedAt: "2026-07-18T01:00:00.000Z",
      schemaVersion: 1,
    });
    expect(channel.postMessage).toHaveBeenCalledWith(published);
    expect(Object.keys(published!).sort()).toEqual([
      "eventId",
      "key",
      "savedAt",
      "schemaVersion",
    ]);
    expect(storage.localStorage.setItem).not.toHaveBeenCalled();

    channel.emit(published);
    channel.emit({ ...published, eventId: "event-other" });
    channel.emit({
      ...published,
      eventId: "event-different-key",
      key: "user-1:problem-2:54",
    });

    expect(conflicts).toEqual([{ ...published, eventId: "event-other" }]);
  });

  it("falls back to a sanitized localStorage storage event", () => {
    const storage = storageDouble();
    const onConflict = vi.fn();
    const coordinator = createRecoveryChannelCoordinator({
      createBroadcastChannel: () => undefined,
      createEventId: () => "event-self",
      key: "user-1:problem-1:54",
      onConflict,
      storageFallback: storage,
    });

    coordinator.publish("2026-07-18T01:00:00.000Z");
    expect(storage.localStorage.setItem).toHaveBeenCalledOnce();
    expect(storage.localStorage.removeItem).toHaveBeenCalledWith(
      RECOVERY_STORAGE_EVENT_KEY,
    );

    const remote = {
      eventId: "event-remote",
      key: "user-1:problem-1:54",
      savedAt: "2026-07-18T02:00:00.000Z",
      schemaVersion: 1,
    };
    storage.emit(RECOVERY_STORAGE_EVENT_KEY, JSON.stringify(remote));
    storage.emit(RECOVERY_STORAGE_EVENT_KEY, "not-json");
    storage.emit(
      RECOVERY_STORAGE_EVENT_KEY,
      JSON.stringify({ ...remote, answerText: "must not pass" }),
    );

    expect(onConflict).toHaveBeenCalledOnce();
    expect(onConflict).toHaveBeenCalledWith(remote);
  });

  it("is SSR-safe when neither transport exists", () => {
    const coordinator = createRecoveryChannelCoordinator({
      createBroadcastChannel: () => undefined,
      createEventId: () => "event-ssr",
      key: "user-1:problem-1:54",
      onConflict: vi.fn(),
      storageFallback: undefined,
    });

    expect(coordinator.publish("2026-07-18T01:00:00.000Z")).toBeUndefined();
    expect(() => coordinator.dispose()).not.toThrow();
  });

  it("continues without cross-tab transport when BroadcastChannel construction fails", () => {
    expect(() =>
      createRecoveryChannelCoordinator({
        createBroadcastChannel: () => {
          throw new Error("blocked");
        },
        key: "user-1:problem-1:54",
        onConflict: vi.fn(),
        storageFallback: undefined,
      }),
    ).not.toThrow();
  });

  it("does not fail when a restricted storage getter throws", () => {
    const storage = storageDouble();
    Object.defineProperty(storage, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
    const coordinator = createRecoveryChannelCoordinator({
      createBroadcastChannel: () => undefined,
      key: "user-1:problem-1:54",
      onConflict: vi.fn(),
      storageFallback: storage,
    });

    expect(() => coordinator.publish("2026-07-18T01:00:00.000Z")).not.toThrow();
  });

  it("does not fail when BroadcastChannel publication throws", () => {
    const channel = broadcastDouble();
    channel.postMessage.mockImplementation(() => {
      throw new Error("blocked");
    });
    const coordinator = createRecoveryChannelCoordinator({
      createBroadcastChannel: () => channel,
      key: "user-1:problem-1:54",
      onConflict: vi.fn(),
    });

    expect(() => coordinator.publish("2026-07-18T01:00:00.000Z")).not.toThrow();
  });

  it("does not fail when localStorage publication throws", () => {
    const storage = storageDouble();
    storage.localStorage.setItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    const coordinator = createRecoveryChannelCoordinator({
      createBroadcastChannel: () => undefined,
      key: "user-1:problem-1:54",
      onConflict: vi.fn(),
      storageFallback: storage,
    });

    expect(() => coordinator.publish("2026-07-18T01:00:00.000Z")).not.toThrow();
  });

  it("does not open Node's global BroadcastChannel when window is unavailable", () => {
    const channel = broadcastDouble();
    const nodeBroadcastChannel = vi.fn(function () {
      return channel;
    });
    vi.stubGlobal("BroadcastChannel", nodeBroadcastChannel);

    try {
      expect(typeof window).toBe("undefined");
      const coordinator = createRecoveryChannelCoordinator({
        key: "user-1:problem-1:54",
        onConflict: vi.fn(),
      });

      expect(nodeBroadcastChannel).not.toHaveBeenCalled();
      expect(coordinator.publish("2026-07-18T01:00:00.000Z")).toBeUndefined();
      coordinator.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ignores all events and releases listeners after disposal", () => {
    const channel = broadcastDouble();
    const onConflict = vi.fn();
    const coordinator = createRecoveryChannelCoordinator({
      createBroadcastChannel: () => channel,
      key: "user-1:problem-1:54",
      onConflict,
    });
    coordinator.dispose();
    channel.emit({
      eventId: "event-remote",
      key: "user-1:problem-1:54",
      savedAt: "2026-07-18T02:00:00.000Z",
      schemaVersion: 1,
    });

    expect(channel.close).toHaveBeenCalledOnce();
    expect(onConflict).not.toHaveBeenCalled();
    expect(coordinator.publish("2026-07-18T03:00:00.000Z")).toBeUndefined();
  });
});
