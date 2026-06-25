// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSingleFlightAction } from "../../../src/lib/request-control/useSingleFlightAction";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useSingleFlightAction", () => {
  it("runs a pending async action only once until it settles", async () => {
    const inFlight = deferred<void>();
    const action = vi.fn(() => inFlight.promise);

    function TestButton() {
      const { run, pending } = useSingleFlightAction(action);
      return (
        <button type="button" disabled={pending} onClick={() => void run()}>
          {pending ? "처리 중" : "실행"}
        </button>
      );
    }

    render(<TestButton />);

    fireEvent.click(screen.getByRole("button", { name: "실행" }));
    fireEvent.click(screen.getByRole("button", { name: "처리 중" }));

    expect(action).toHaveBeenCalledTimes(1);
    inFlight.resolve();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "실행" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "실행" }));
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("keeps sync actions locked for the configured cooldown", async () => {
    vi.useFakeTimers();
    const action = vi.fn();

    function TestButton() {
      const { run, pending } = useSingleFlightAction(action, {
        cooldownMs: 1200,
      });
      return (
        <button type="button" disabled={pending} onClick={() => void run()}>
          {pending ? "새로고침 중" : "다시 시도"}
        </button>
      );
    }

    render(<TestButton />);

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    fireEvent.click(screen.getByRole("button", { name: "새로고침 중" }));

    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1199);
    });
    expect(screen.getByRole("button", { name: "새로고침 중" })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });
});
