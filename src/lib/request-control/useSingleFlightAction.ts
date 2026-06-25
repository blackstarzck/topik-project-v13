"use client";

import { useCallback, useRef, useState } from "react";

type SingleFlightOptions = {
  cooldownMs?: number;
};

export function useSingleFlightAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => TResult | Promise<TResult>,
  options: SingleFlightOptions = {},
): {
  pending: boolean;
  run: (...args: TArgs) => Promise<TResult | undefined>;
} {
  const runningRef = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (...args: TArgs) => {
      if (runningRef.current) return undefined;

      runningRef.current = true;
      setPending(true);

      try {
        return await action(...args);
      } finally {
        const cooldownMs = options.cooldownMs ?? 0;
        if (cooldownMs > 0) {
          await new Promise((resolve) => {
            globalThis.setTimeout(resolve, cooldownMs);
          });
        }
        runningRef.current = false;
        setPending(false);
      }
    },
    [action, options.cooldownMs],
  );

  return { pending, run };
}
