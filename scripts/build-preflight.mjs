// M5 — build hygiene preflight.
//
// Legacy Next versions could mix `next dev` + `next build` artifacts in `.next`
// and produce stale/500 chunks. Next 16's isolatedDevBuild separates development
// output into `.next/dev`; the project must opt into that contract explicitly
// before this preflight permits a build while any dev port is alive.
//
// This preflight runs *before* `build` in the integration gate sequence. It
// detects a server on the dev port and BLOCKS the build (non-zero exit) unless
// `--force` is given. The decision is a pure function (`evaluateBuildPreflight`)
// so it is unit-testable / validate-the-validator provable; the port probe
// (`detectDevServer`) is the only impure part.

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Pure decision: given whether a dev server was detected and whether the user
 * forced the build, decide whether to block and with what exit code/message.
 *
 * @param {{ devServerDetected: boolean, isolatedDevBuild?: boolean, force?: boolean }} input
 * @returns {{ block: boolean, code: number, message: string, warn?: boolean }}
 */
export function evaluateBuildPreflight({
  devServerDetected,
  isolatedDevBuild = false,
  force = false,
}) {
  if (devServerDetected && isolatedDevBuild) {
    return {
      block: false,
      code: 0,
      warn: true,
      message:
        "dev server detected; proceeding because isolatedDevBuild keeps " +
        "development output in .next/dev and production output in .next.",
    };
  }
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

export function evaluateSupabaseRemoteApplyBoundary({
  env = {},
  supabaseTempExists = false,
} = {}) {
  const violations = [];
  if (env.SUPABASE_ACCESS_TOKEN) {
    violations.push("SUPABASE_ACCESS_TOKEN");
  }
  if (supabaseTempExists) {
    violations.push("supabase/.temp");
  }

  if (violations.length > 0) {
    return {
      block: true,
      code: 3,
      message:
        "remote Supabase apply surface detected in the v13 user app workspace: " +
        `${violations.join(", ")}. ` +
        "Remove the management token/link and handle remote DB changes in the schema owner workflow.",
    };
  }

  return {
    block: false,
    code: 0,
    message: "no remote Supabase apply surface detected.",
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

export function supportsIsolatedDevBuild(nextVersion) {
  if (typeof nextVersion !== "string") return false;
  const major = Number.parseInt(nextVersion.split(".")[0], 10);
  return major === 16;
}

export function hasIsolatedDevBuildOptOut(nextConfigSource) {
  if (typeof nextConfigSource !== "string") return true;
  const mentions = nextConfigSource.match(/\bisolatedDevBuild\b/g) ?? [];
  if (mentions.length === 0) return false;

  const literalSettings = [
    ...nextConfigSource.matchAll(
      /["']?isolatedDevBuild["']?\s*:\s*(true|false)\b/g,
    ),
  ];
  if (literalSettings.length !== mentions.length) return true;
  return literalSettings.some((match) => match[1] !== "true");
}

function readInstalledNextVersion(rootDir = process.cwd()) {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, "node_modules", "next", "package.json"), "utf8"),
    );
    return typeof packageJson.version === "string" ? packageJson.version : null;
  } catch {
    return null;
  }
}

function readNextConfigSource(rootDir = process.cwd()) {
  for (const filename of [
    "next.config.ts",
    "next.config.mts",
    "next.config.js",
    "next.config.mjs",
    "next.config.cjs",
  ]) {
    const configPath = path.join(rootDir, filename);
    if (!fs.existsSync(configPath)) continue;
    try {
      return fs.readFileSync(configPath, "utf8");
    } catch {
      return null;
    }
  }
  return "";
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
  const isolatedDevBuildRequested = argv.includes("--isolated-dev-build");
  const nextVersion = readInstalledNextVersion();
  const nextConfigSource = readNextConfigSource();
  const isolatedDevBuild =
    isolatedDevBuildRequested &&
    supportsIsolatedDevBuild(nextVersion) &&
    !hasIsolatedDevBuildOptOut(nextConfigSource);
  const supabaseBoundary = evaluateSupabaseRemoteApplyBoundary({
    env: process.env,
    supabaseTempExists: fs.existsSync(path.join(process.cwd(), "supabase", ".temp")),
  });
  if (supabaseBoundary.block) {
    console.error(`[M5 build-preflight] BLOCK: ${supabaseBoundary.message}`);
    process.exit(supabaseBoundary.code);
  }
  const ports = resolveProbePorts(argv, process.env);
  const { detected, port } = await detectAnyDevServer(ports);
  const result = evaluateBuildPreflight({
    devServerDetected: detected,
    isolatedDevBuild,
    force,
  });
  const tag = "[M5 build-preflight]";
  const where =
    `probed ${ports.join(",")}${detected ? ` — alive on ${port}` : ""}; ` +
    `Next ${nextVersion ?? "unknown"}; isolated dev output ${isolatedDevBuild ? "enabled" : "disabled"}`;
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
