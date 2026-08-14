import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryPath = path.resolve("fixture-repository");
const expectedOwner = "blackstarzck";
const originUrl = "https://github.com/blackstarzck/talkpik-ai.git";
const expectedCommandTimeoutMs = 30_000;
const checkedAt = "2026-07-22T00:00:00.000Z";

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
        now: checkedAt,
      }),
    ).resolves.toMatchObject({
      schemaVersion: 1,
      recordType: "OwnerAuthResultV1",
      status: "OWNER_AUTHENTICATED",
      host: "github.com",
      owner: expectedOwner,
      currentLogin: expectedOwner,
      switchAttempted: false,
      publishApprovalUsed: false,
      manualApprovalRequired: false,
      checkedAt,
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(requests).toEqual([
      {
        command: "git",
        args: ["remote", "get-url", "origin"],
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
      loginStep("collaborator"),
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
      argv: ["--repo", repositoryPath, "--owner", expectedOwner, "--publish-approved", "--now", checkedAt],
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
      loginStep("collaborator"),
      switchStep(),
      loginStep("collaborator"),
    ]);

    await expect(
      runGitHubOwnerAuth({
        commandRunner: commands.runner,
        owner: expectedOwner,
        repoPath: repositoryPath,
        publishApproved: true,
        now: checkedAt,
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
      argv: ["--repo", repositoryPath, "--owner", expectedOwner, "--now", checkedAt],
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

  it("switches with explicit publish approval when the first login verification fails", async () => {
    const { runGitHubOwnerAuthCli } = await loadCli();
    const verifySecret = "ghp_INITIAL_VERIFY_SECRET_MUST_NOT_LEAK";
    const commands = scriptedRunner([
      gitOriginStep(),
      loginStep(expectedOwner, {
        status: 1,
        stdout: verifySecret,
        stderr: "authorization: Bearer INITIAL_VERIFY_CREDENTIAL",
      }),
      switchStep(),
      loginStep(expectedOwner),
    ]);
    let stdout = "";
    let stderr = "";

    const exitCode = await runGitHubOwnerAuthCli({
      argv: ["--repo", repositoryPath, "--owner", expectedOwner, "--publish-approved", "--now", checkedAt],
      commandRunner: commands.runner,
      writeStderr: (value) => { stderr += value; },
      writeStdout: (value) => { stdout += value; },
    });

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({
      status: "OWNER_AUTHENTICATED",
      currentLogin: expectedOwner,
      switchAttempted: true,
      publishApprovalUsed: true,
    });
    expect(`${stdout}${stderr}`).not.toContain(verifySecret);
    commands.assertComplete();
  });

  it("fails closed without switching when the first login verification fails without approval", async () => {
    const { runGitHubOwnerAuthCli } = await loadCli();
    const commands = scriptedRunner([
      gitOriginStep(),
      loginStep(expectedOwner, { status: 1, stderr: "ghp_UNAPPROVED_SECRET" }),
    ]);
    let stdout = "";
    let stderr = "";

    const exitCode = await runGitHubOwnerAuthCli({
      argv: ["--repo", repositoryPath, "--owner", expectedOwner, "--now", checkedAt],
      commandRunner: commands.runner,
      writeStderr: (value) => { stderr += value; },
      writeStdout: (value) => { stdout += value; },
    });

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(JSON.parse(stderr)).toEqual({ code: "OWNER_AUTH_VERIFY_FAILED" });
    expect(commands.calls.some(({ args }) => args[0] === "auth")).toBe(false);
    commands.assertComplete();
  });

  it("reports a safe switch failure after an approved recovery from failed login verification", async () => {
    const { runGitHubOwnerAuthCli } = await loadCli();
    const switchSecret = "github_pat_SWITCH_SECRET_MUST_NOT_LEAK";
    const commands = scriptedRunner([
      gitOriginStep(),
      loginStep(expectedOwner, { status: 1 }),
      switchStep(commandResult({ status: 1, stdout: switchSecret, stderr: "Bearer SWITCH_CREDENTIAL" })),
    ]);
    let stdout = "";
    let stderr = "";

    const exitCode = await runGitHubOwnerAuthCli({
      argv: ["--repo", repositoryPath, "--owner", expectedOwner, "--publish-approved", "--now", checkedAt],
      commandRunner: commands.runner,
      writeStderr: (value) => { stderr += value; },
      writeStdout: (value) => { stdout += value; },
    });

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(JSON.parse(stderr)).toEqual({ code: "OWNER_AUTH_SWITCH_FAILED" });
    expect(`${stdout}${stderr}`).not.toContain(switchSecret);
    commands.assertComplete();
  });

  it("accepts a case-insensitive verified login and emits only safe success fields", async () => {
    const { runGitHubOwnerAuthCli } = await loadCli();
    const commands = scriptedRunner([
      gitOriginStep(),
      loginStep("BlackStarzck"),
    ]);
    let stdout = "";
    let stderr = "";

    const exitCode = await runGitHubOwnerAuthCli({
      argv: ["--repo", repositoryPath, "--owner", expectedOwner, "--now", checkedAt],
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
    expect(JSON.parse(stdout)).toMatchObject({
      schemaVersion: 1,
      recordType: "OwnerAuthResultV1",
      status: "OWNER_AUTHENTICATED",
      host: "github.com",
      owner: expectedOwner,
      currentLogin: "BlackStarzck",
      switchAttempted: false,
      publishApprovalUsed: false,
      manualApprovalRequired: false,
      checkedAt,
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    commands.assertComplete();
  });

  it("reports SWITCH_REQUIRED without changing global auth when publish approval is absent", async () => {
    const { runGitHubOwnerAuthCli } = await loadCli();
    const commands = scriptedRunner([gitOriginStep(), loginStep("collaborator")]);
    let stdout = "";
    let stderr = "";

    const exitCode = await runGitHubOwnerAuthCli({
      argv: ["--repo", repositoryPath, "--owner", expectedOwner, "--now", checkedAt],
      commandRunner: commands.runner,
      writeStderr: (value) => { stderr += value; },
      writeStdout: (value) => { stdout += value; },
    });

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({
      recordType: "OwnerAuthResultV1",
      status: "SWITCH_REQUIRED",
      currentLogin: "collaborator",
      switchAttempted: false,
      publishApprovalUsed: false,
      manualApprovalRequired: true,
    });
    expect(commands.calls.some(({ args }) => args[0] === "auth")).toBe(false);
    commands.assertComplete();
  });

  it("rejects a non-login response without echoing it", async () => {
    const { runGitHubOwnerAuthCli } = await loadCli();
    const sentinel = "ghp_SECRET_MUST_NOT_BECOME_A_LOGIN";
    const commands = scriptedRunner([gitOriginStep(), loginStep(sentinel)]);
    let stdout = "";
    let stderr = "";

    const exitCode = await runGitHubOwnerAuthCli({
      argv: ["--repo", repositoryPath, "--owner", expectedOwner, "--now", checkedAt],
      commandRunner: commands.runner,
      writeStderr: (value) => { stderr += value; },
      writeStdout: (value) => { stdout += value; },
    });

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(JSON.parse(stderr)).toEqual({ code: "OWNER_AUTH_RESULT_INVALID" });
    expect(`${stdout}${stderr}`).not.toContain(sentinel);
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
