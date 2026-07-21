import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryPath = path.resolve("fixture-repository");
const expectedOwner = "blackstarzck";
const originUrl = "https://github.com/blackstarzck/talkpik-ai.git";
const expectedCommandTimeoutMs = 30_000;

function commandResult({
  status = 0,
  stdout = "",
  stderr = "",
  ...metadata
} = {}) {
  return { status, stdout, stderr, ...metadata };
}

function scriptedRunner(expectedCommands) {
  const calls = [];
  const remaining = [...expectedCommands];
  const runner = (command, args, options = {}) => {
    const request = {
      command,
      args,
      cwd: options.cwd,
    };
    calls.push(request);
    const next = remaining.shift();
    if (!next) throw new Error("UNEXPECTED_COMMAND");
    expect(request).toEqual(next.request);
    return next.result;
  };
  return {
    assertComplete() {
      expect(remaining).toEqual([]);
    },
    calls,
    runner,
  };
}

async function loadLibrary() {
  return import("../../scripts/lib/github-owner-auth.mjs");
}

async function loadCli() {
  return import("../../scripts/check-github-owner-auth.mjs");
}

function gitOriginStep(remoteUrl = originUrl) {
  return {
    request: {
      command: "git",
      args: ["remote", "get-url", "origin"],
      cwd: repositoryPath,
    },
    result: commandResult({ stdout: `${remoteUrl}\n` }),
  };
}

function switchStep(result = commandResult()) {
  return {
    request: {
      command: "gh",
      args: [
        "auth",
        "switch",
        "--hostname",
        "github.com",
        "--user",
        expectedOwner,
      ],
      cwd: repositoryPath,
    },
    result,
  };
}

function loginStep(login = expectedOwner, resultOverrides = {}) {
  return {
    request: {
      command: "gh",
      args: ["api", "user", "--hostname", "github.com", "--jq", ".login"],
      cwd: repositoryPath,
    },
    result: commandResult({ stdout: `${login}\n`, ...resultOverrides }),
  };
}

describe("GitHub origin parsing", () => {
  it("derives the GitHub host and owner from an HTTPS origin", async () => {
    const { parseGitHubOrigin } = await loadLibrary();

    expect(
      parseGitHubOrigin(
        "https://github.com/blackstarzck/talkpik-ai.git",
      ),
    ).toEqual({ host: "github.com", owner: expectedOwner });
  });

  it("derives the GitHub host and owner from an SSH origin", async () => {
    const { parseGitHubOrigin } = await loadLibrary();

    expect(
      parseGitHubOrigin("git@github.com:blackstarzck/talkpik-ai.git"),
    ).toEqual({ host: "github.com", owner: expectedOwner });
  });
});

describe("repository-owner authentication preflight", () => {
  it("passes a finite timeout to every git and gh command", async () => {
    const { runGitHubOwnerAuth } = await loadLibrary();
    const requests = [];
    const commandRunner = (command, args, options) => {
      requests.push({ command, args, options });
      if (command === "git") return commandResult({ stdout: originUrl });
      if (args[0] === "auth") return commandResult();
      return commandResult({ stdout: expectedOwner });
    };

    await expect(
      runGitHubOwnerAuth({
        commandRunner,
        owner: expectedOwner,
        repoPath: repositoryPath,
      }),
    ).resolves.toEqual({
      status: "OWNER_AUTHENTICATED",
      host: "github.com",
      owner: expectedOwner,
      manualApprovalRequired: false,
    });
    expect(requests).toEqual([
      {
        command: "git",
        args: ["remote", "get-url", "origin"],
        options: { cwd: repositoryPath, timeout: expectedCommandTimeoutMs },
      },
      {
        command: "gh",
        args: [
          "auth",
          "switch",
          "--hostname",
          "github.com",
          "--user",
          expectedOwner,
        ],
        options: { cwd: repositoryPath, timeout: expectedCommandTimeoutMs },
      },
      {
        command: "gh",
        args: ["api", "user", "--hostname", "github.com", "--jq", ".login"],
        options: { cwd: repositoryPath, timeout: expectedCommandTimeoutMs },
      },
    ]);
  });

  it("rejects an origin-owner mismatch before any gh command", async () => {
    const { runGitHubOwnerAuth } = await loadLibrary();
    const commands = scriptedRunner([
      gitOriginStep("https://github.com/collaborator/talkpik-ai.git"),
    ]);

    await expect(
      runGitHubOwnerAuth({
        commandRunner: commands.runner,
        owner: expectedOwner,
        repoPath: repositoryPath,
      }),
    ).rejects.toMatchObject({ code: "ORIGIN_OWNER_MISMATCH" });
    commands.assertComplete();
    expect(commands.calls.map(({ command }) => command)).toEqual(["git"]);
  });

  it.each([
    [
      "a non-GitHub host",
      "https://git.example.com/blackstarzck/talkpik-ai.git",
      "ORIGIN_HOST_UNSUPPORTED",
    ],
    [
      "credential-bearing HTTPS",
      "https://raw-credential@github.com/blackstarzck/talkpik-ai.git",
      "ORIGIN_URL_UNSUPPORTED",
    ],
  ])("rejects %s before any gh command", async (_label, remoteUrl, code) => {
    const { runGitHubOwnerAuth } = await loadLibrary();
    const commands = scriptedRunner([gitOriginStep(remoteUrl)]);

    await expect(
      runGitHubOwnerAuth({
        commandRunner: commands.runner,
        owner: expectedOwner,
        repoPath: repositoryPath,
      }),
    ).rejects.toMatchObject({ code });
    commands.assertComplete();
    expect(commands.calls.map(({ command }) => command)).toEqual(["git"]);
  });

  it("reports an origin lookup failure without making a gh call", async () => {
    const { runGitHubOwnerAuth } = await loadLibrary();
    const commands = scriptedRunner([
      {
        ...gitOriginStep(),
        result: commandResult({
          status: 1,
          stdout: "ghp_ORIGIN_TOKEN_MUST_NOT_LEAK",
          stderr: "authorization: Bearer ORIGIN_CREDENTIAL",
        }),
      },
    ]);

    await expect(
      runGitHubOwnerAuth({
        commandRunner: commands.runner,
        owner: expectedOwner,
        repoPath: repositoryPath,
      }),
    ).rejects.toMatchObject({ code: "ORIGIN_LOOKUP_FAILED" });
    commands.assertComplete();
    expect(commands.calls.map(({ command }) => command)).toEqual(["git"]);
  });

  it("fails closed when gh cannot switch to the repository owner", async () => {
    const { runGitHubOwnerAuthCli } = await loadCli();
    const secretSentinel = "ghp_TOKEN_SENTINEL_MUST_NOT_LEAK";
    const authHeaderSentinel = "authorization: Bearer RAW_CREDENTIAL";
    const commands = scriptedRunner([
      gitOriginStep(),
      switchStep(
        commandResult({
          status: 1,
          stdout: secretSentinel,
          stderr: authHeaderSentinel,
        }),
      ),
    ]);
    let stdout = "";
    let stderr = "";

    const exitCode = await runGitHubOwnerAuthCli({
      argv: ["--repo", repositoryPath, "--owner", expectedOwner],
      commandRunner: commands.runner,
      writeStderr: (value) => {
        stderr += value;
      },
      writeStdout: (value) => {
        stdout += value;
      },
    });

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(JSON.parse(stderr)).toEqual({ code: "OWNER_AUTH_SWITCH_FAILED" });
    expect(`${stdout}${stderr}`).not.toContain(secretSentinel);
    expect(`${stdout}${stderr}`).not.toContain(authHeaderSentinel);
    commands.assertComplete();
  });

  it("rejects a verified GitHub login that is not the expected owner", async () => {
    const { runGitHubOwnerAuth } = await loadLibrary();
    const commands = scriptedRunner([
      gitOriginStep(),
      switchStep(),
      loginStep("collaborator"),
    ]);

    await expect(
      runGitHubOwnerAuth({
        commandRunner: commands.runner,
        owner: expectedOwner,
        repoPath: repositoryPath,
      }),
    ).rejects.toMatchObject({ code: "AUTHENTICATED_LOGIN_MISMATCH" });
    commands.assertComplete();
  });

  it("redacts verify timeout output and reports a stable failure code", async () => {
    const { runGitHubOwnerAuthCli } = await loadCli();
    const secretSentinel = "ghp_VERIFY_TOKEN_SENTINEL_MUST_NOT_LEAK";
    const authHeaderSentinel = "authorization: Bearer VERIFY_CREDENTIAL";
    const commands = scriptedRunner([
      gitOriginStep(),
      switchStep(),
      loginStep(expectedOwner, {
        status: null,
        error: Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }),
        signal: "SIGTERM",
        stdout: secretSentinel,
        stderr: authHeaderSentinel,
      }),
    ]);
    let stdout = "";
    let stderr = "";

    const exitCode = await runGitHubOwnerAuthCli({
      argv: ["--repo", repositoryPath, "--owner", expectedOwner],
      commandRunner: commands.runner,
      writeStderr: (value) => {
        stderr += value;
      },
      writeStdout: (value) => {
        stdout += value;
      },
    });

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(JSON.parse(stderr)).toEqual({ code: "OWNER_AUTH_VERIFY_FAILED" });
    expect(`${stdout}${stderr}`).not.toContain(secretSentinel);
    expect(`${stdout}${stderr}`).not.toContain(authHeaderSentinel);
    commands.assertComplete();
  });

  it("accepts a case-insensitive verified login and emits only safe success fields", async () => {
    const { runGitHubOwnerAuthCli } = await loadCli();
    const commands = scriptedRunner([
      gitOriginStep(),
      switchStep(),
      loginStep("BlackStarzck"),
    ]);
    let stdout = "";
    let stderr = "";

    const exitCode = await runGitHubOwnerAuthCli({
      argv: ["--repo", repositoryPath, "--owner", expectedOwner],
      commandRunner: commands.runner,
      writeStderr: (value) => {
        stderr += value;
      },
      writeStdout: (value) => {
        stdout += value;
      },
    });

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toEqual({
      status: "OWNER_AUTHENTICATED",
      host: "github.com",
      owner: expectedOwner,
      manualApprovalRequired: false,
    });
    commands.assertComplete();
  });
});

describe("public package CLI", () => {
  it("exposes the owner-auth preflight through package.json", () => {
    const packageJson = JSON.parse(
      readFileSync(path.resolve("package.json"), "utf8"),
    );

    expect(packageJson.scripts["task:owner-auth"]).toBe(
      "node scripts/check-github-owner-auth.mjs",
    );
  });
});
