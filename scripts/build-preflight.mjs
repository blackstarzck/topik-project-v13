// M5 — build hygiene preflight.
//
// Running `pnpm build` (`next build`) while a `next dev` server is alive mixes
// dev + prod artifacts in `.next` → stale/500 chunks → fake runtime errors
// (e.g. "next-intl context not found"). See memory:
// project-pnpm-build-clobbers-dev-server and PLAN.md §강제성 게이트 표 (M5).
//
// This preflight runs *before* `build` in the integration gate sequence. It
// detects a server on the dev port and BLOCKS the build (non-zero exit) unless
// `--force` is given. The decision is a pure function (`evaluateBuildPreflight`)
// so it is unit-testable / validate-the-validator provable; the port probe
// (`detectDevServer`) is the only impure part.

import net from "node:net";
import { pathToFileURL } from "node:url";

/**
 * Pure decision: given whether a dev server was detected and whether the user
 * forced the build, decide whether to block and with what exit code/message.
 *
 * @param {{ devServerDetected: boolean, force?: boolean }} input
 * @returns {{ block: boolean, code: number, message: string, warn?: boolean }}
 */
export function evaluateBuildPreflight({ devServerDetected, force = false }) {
  if (devServerDetected && !force) {
    return {
      block: true,
      code: 2,
      message:
        "dev server detected on the dev port — building now corrupts .next " +
        "(stale/500 chunks → fake runtime errors). Stop dev first, then: " +
        "delete .next && pnpm build. Recovery if already corrupted: stop dev " +
        "→ delete .next → pnpm dev. (Override with --force to accept the risk.)",
    };
  }
  if (devServerDetected && force) {
    return {
      block: false,
      code: 0,
      warn: true,
      message:
        "dev server detected but --force given; proceeding — you accept the " +
        ".next corruption risk.",
    };
  }
  return {
    block: false,
    code: 0,
    message: "no dev server detected; safe to build.",
  };
}

/**
 * Impure: probe a TCP port to see whether something is listening (a running
 * dev/start server). Resolves true on connect, false on error/timeout.
 *
 * @param {number} port
 * @param {string} host
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
// Pure: a valid TCP port (1..65535) or null. Guards detectDevServer against
// crashing on bad input (cross-audit P1: bad --port threw ERR_SOCKET_BAD_PORT).
export function normalizePort(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n >= 65536) return null;
  return n;
}

// Ports dev actually uses: 3000 (Next default), its auto-retry range (3001+ when
// 3000 is busy), and 3100 (this project's verify scripts + the 2026-06-02
// incident). Probing only 3000 missed the founding incident (cross-audit P0).
const DEFAULT_PROBE_PORTS = [3000, 3001, 3002, 3003, 3100];

// Pure: which ports to probe. An explicit valid --port narrows to it; otherwise
// the default set + PORT env. Invalid --port falls back to defaults (no crash).
export function resolveProbePorts(argv, env) {
  const flagIndex = argv.indexOf("--port");
  if (flagIndex !== -1) {
    const p = normalizePort(argv[flagIndex + 1]);
    if (p) return [p];
  }
  const ports = [...DEFAULT_PROBE_PORTS];
  const envPort = normalizePort(env.PORT);
  if (envPort && !ports.includes(envPort)) ports.push(envPort);
  return ports;
}

/**
 * Impure: does anything listen on this port/host? Crash-safe — a bad port
 * resolves false instead of throwing ERR_SOCKET_BAD_PORT.
 * @returns {Promise<boolean>}
 */
export function detectDevServer(port, host = "127.0.0.1", timeoutMs = 400) {
  return new Promise((resolve) => {
    const valid = normalizePort(port);
    if (!valid) return resolve(false);
    let socket;
    try {
      socket = new net.Socket();
    } catch {
      return resolve(false);
    }
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    try {
      socket.connect(valid, host);
    } catch {
      finish(false);
    }
  });
}

// Impure: detect a dev server on ANY of the given ports across IPv4 + IPv6
// loopback (cross-audit P2: IPv6-only `next dev -H ::1` was missed).
export async function detectAnyDevServer(ports, hosts = ["127.0.0.1", "::1"]) {
  for (const port of ports) {
    for (const host of hosts) {
      if (await detectDevServer(port, host)) return { detected: true, port };
    }
  }
  return { detected: false, port: null };
}

async function main() {
  const argv = process.argv.slice(2);
  const force =
    argv.includes("--force") || process.env.AI_BUILD_PREFLIGHT_FORCE === "1";
  const ports = resolveProbePorts(argv, process.env);
  const { detected, port } = await detectAnyDevServer(ports);
  const result = evaluateBuildPreflight({ devServerDetected: detected, force });
  const tag = "[M5 build-preflight]";
  const where = `probed ${ports.join(",")}${detected ? ` — alive on ${port}` : ""}`;
  if (result.block) {
    console.error(
      `${tag} BLOCK (${where}): ${result.message} (if that port is NOT a dev server, use --force.)`,
    );
  } else if (result.warn) {
    console.warn(`${tag} WARN (${where}): ${result.message}`);
  } else {
    console.log(`${tag} OK (${where}): ${result.message}`);
  }
  process.exit(result.code);
}

// Only run the CLI when invoked directly (`node scripts/build-preflight.mjs`),
// never on import (so unit tests exercise the pure function without exiting).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(
      `[M5 build-preflight] BLOCK (preflight error): ${e?.message ?? e}`,
    );
    process.exit(2);
  });
}
