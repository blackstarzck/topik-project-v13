import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  interpretCheckIgnoreResult,
  parseArguments,
  parseEnvironment,
  parseWorktreePorcelain,
  prepareWorktreeEnvironment,
  selectMainCheckout,
} from "../../scripts/prepare-worktree-env.mjs";

const secretSentinel = "TOP_SECRET_SENTINEL_MUST_NOT_LEAK";
const tempDirs = [];

function tempRoot(prefix = "talkpik-env-") {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(root);
  return root;
}

function appEnv(overrides = {}) {
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secretSentinel,
    ...overrides,
  };

  return `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
}

function fixture({ sourceContent = appEnv(), destinationContent } = {}) {
  const root = tempRoot();
  const mainRoot = path.join(root, "main");
  const currentRoot = path.join(root, "feature");
  const commonDir = path.join(root, "repo.git");
  mkdirSync(mainRoot, { recursive: true });
  mkdirSync(currentRoot, { recursive: true });
  mkdirSync(commonDir, { recursive: true });
  if (sourceContent !== null) {
    writeFileSync(path.join(mainRoot, ".env.local"), sourceContent, "utf8");
  }
  if (destinationContent !== undefined) {
    writeFileSync(
      path.join(currentRoot, ".env.local"),
      destinationContent,
      "utf8",
    );
  }

  const dependencies = {
    getGitCommonDir: (checkoutRoot) => {
      if (checkoutRoot === mainRoot || checkoutRoot === currentRoot)
        return commonDir;
      return path.join(root, "other.git");
    },
    isIgnored: (file) => file === path.join(currentRoot, ".env.local"),
    listWorktrees: () => [
      { path: mainRoot, branch: "refs/heads/main" },
      { path: currentRoot, branch: "refs/heads/feature" },
    ],
  };

  return { commonDir, currentRoot, dependencies, mainRoot, root };
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("worktree discovery", () => {
  it("parses NUL-delimited git worktree porcelain output", () => {
    const parsed = parseWorktreePorcelain(
      [
        "worktree C:/repo/main",
        "HEAD aaaa",
        "branch refs/heads/main",
        "",
        "worktree C:/repo/feature",
        "HEAD bbbb",
        "branch refs/heads/feature",
        "",
      ].join("\0"),
    );

    expect(parsed).toEqual([
      { path: "C:/repo/main", branch: "refs/heads/main" },
      { path: "C:/repo/feature", branch: "refs/heads/feature" },
    ]);
  });

  it.each([
    [[], /exactly one main checkout.*found 0/i],
    [
      [
        { path: "C:/repo/main-a", branch: "refs/heads/main" },
        { path: "C:/repo/main-b", branch: "refs/heads/main" },
      ],
      /exactly one main checkout.*found 2/i,
    ],
  ])(
    "fails closed when the current repository has zero or multiple main checkouts",
    (entries, error) => {
      expect(() =>
        selectMainCheckout(entries, {
          currentCommonDir: "C:/repo/.git",
          getGitCommonDir: () => "C:/repo/.git",
        }),
      ).toThrow(error);
    },
  );

  it("selects the only main checkout belonging to the current git common directory", () => {
    const entries = [
      { path: "C:/other/main", branch: "refs/heads/main" },
      { path: "C:/repo/main", branch: "refs/heads/main" },
      { path: "C:/repo/feature", branch: "refs/heads/feature" },
    ];

    expect(
      selectMainCheckout(entries, {
        currentCommonDir: "C:/repo/.git",
        getGitCommonDir: (checkout) =>
          checkout.startsWith("C:/repo/") ? "C:/repo/.git" : "C:/other/.git",
      }),
    ).toEqual(entries[1]);
  });
});

describe("argument contract", () => {
  it.each([
    [[], /profile/i],
    [["--profile"], /profile/i],
    [["--profile", "unknown"], /profile/i],
    [["--profile", "app", "--extra"], /unknown argument/i],
  ])("rejects missing, invalid, or unknown arguments", (args, error) => {
    expect(() => parseArguments(args)).toThrow(error);
  });

  it.each(["app", "e2e"])("accepts the %s profile", (profile) => {
    expect(parseArguments(["--profile", profile])).toEqual({ profile });
  });
});

describe("dotenv parsing and git ignore result handling", () => {
  it("removes unquoted inline comments while preserving quoted hash characters", () => {
    const values = parseEnvironment(
      [
        "MISSING= # no value",
        "UNQUOTED=value # trailing comment",
        'QUOTED="value # preserved" # trailing comment',
      ].join("\n"),
    );

    expect(values.get("MISSING")).toBe("");
    expect(values.get("UNQUOTED")).toBe("value");
    expect(values.get("QUOTED")).toBe("value # preserved");
  });

  it("treats a required key followed only by an inline comment as missing", async () => {
    const { currentRoot, dependencies } = fixture({
      sourceContent: [
        "NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co # remote",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= # missing",
      ].join("\n"),
    });

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/i);
  });

  it.each([
    [{ status: 0 }, true],
    [{ status: 1 }, false],
  ])("maps a completed git check-ignore status", (result, expected) => {
    expect(interpretCheckIgnoreResult(result)).toBe(expected);
  });

  it.each([
    { status: 2 },
    { status: null, signal: "SIGTERM" },
    { status: null, error: new Error("spawn failed") },
  ])(
    "fails closed when git check-ignore itself does not complete normally",
    (result) => {
      expect(() => interpretCheckIgnoreResult(result)).toThrow(
        /verify.*ignored/i,
      );
    },
  );
});

describe("prepareWorktreeEnvironment", () => {
  it("copies an ignored destination exclusively and preserves every byte", async () => {
    const input = appEnv({ EXTRA_BYTES: "한글-and-spaces" });
    const { currentRoot, dependencies } = fixture({ sourceContent: input });

    const result = await prepareWorktreeEnvironment({
      currentRoot,
      profile: "app",
      dependencies,
    });

    const destination = path.join(currentRoot, ".env.local");
    expect(result).toMatchObject({ action: "copied", profile: "app" });
    expect(readFileSync(destination)).toEqual(Buffer.from(input));
    expect(lstatSync(destination).isFile()).toBe(true);
  });

  it("validates an existing destination without overwriting or merging it", async () => {
    const destinationContent = appEnv({ EXISTING_ONLY: "kept" });
    const { currentRoot, dependencies } = fixture({ destinationContent });

    const result = await prepareWorktreeEnvironment({
      currentRoot,
      profile: "app",
      dependencies,
    });

    expect(result.action).toBe("validated");
    expect(readFileSync(path.join(currentRoot, ".env.local"), "utf8")).toBe(
      destinationContent,
    );
  });

  it("fails when the main checkout source is missing", async () => {
    const { currentRoot, dependencies } = fixture({ sourceContent: null });

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).rejects.toThrow(/source.*\.env\.local.*missing/i);
  });

  it.each([
    [
      "app",
      appEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }),
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ],
    [
      "e2e",
      appEnv({
        SUPABASE_SERVICE_ROLE_KEY: "",
        E2E_STUDENT_EMAIL: "student@example.com",
        E2E_STUDENT_PASSWORD: "password",
      }),
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    [
      "e2e",
      appEnv({
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        E2E_STUDENT_EMAIL: "",
        E2E_STUDENT_PASSWORD: "password",
      }),
      "E2E_STUDENT_EMAIL",
    ],
  ])(
    "reports only the missing required key name for %s",
    async (profile, sourceContent, key) => {
      const { currentRoot, dependencies } = fixture({ sourceContent });

      await expect(
        prepareWorktreeEnvironment({ currentRoot, profile, dependencies }),
      ).rejects.toThrow(new RegExp(key));
    },
  );

  it.each(["E2E_STUDENT_PASSWORD", "SUPABASE_TEST_PASSWORD"])(
    "accepts %s as the e2e password alternative",
    async (passwordKey) => {
      const { currentRoot, dependencies } = fixture({
        sourceContent: appEnv({
          SUPABASE_SERVICE_ROLE_KEY: "service-role",
          E2E_STUDENT_EMAIL: "student@example.com",
          [passwordKey]: "password",
        }),
      });

      await expect(
        prepareWorktreeEnvironment({
          currentRoot,
          profile: "e2e",
          dependencies,
        }),
      ).resolves.toMatchObject({ action: "copied", profile: "e2e" });
    },
  );

  it("requires at least one supported e2e password key", async () => {
    const { currentRoot, dependencies } = fixture({
      sourceContent: appEnv({
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        E2E_STUDENT_EMAIL: "student@example.com",
      }),
    });

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "e2e", dependencies }),
    ).rejects.toThrow(/E2E_STUDENT_PASSWORD.*SUPABASE_TEST_PASSWORD/i);
  });

  it("rejects a remote URL when SUPABASE_LOCAL_STACK is enabled", async () => {
    const { currentRoot, dependencies } = fixture({
      sourceContent: appEnv({ SUPABASE_LOCAL_STACK: "1" }),
    });

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).rejects.toThrow(/SUPABASE_LOCAL_STACK.*loopback/i);
  });

  it.each([
    ["not-a-url", /NEXT_PUBLIC_SUPABASE_URL.*valid/i],
    ["http://example.supabase.co", /NEXT_PUBLIC_SUPABASE_URL.*HTTPS/i],
    ["ftp://example.supabase.co", /NEXT_PUBLIC_SUPABASE_URL.*HTTPS/i],
  ])(
    "rejects an unsafe nonlocal Supabase URL without exposing it: %s",
    async (url, errorPattern) => {
      const { currentRoot, dependencies } = fixture({
        sourceContent: appEnv({ NEXT_PUBLIC_SUPABASE_URL: url }),
      });

      let error;
      try {
        await prepareWorktreeEnvironment({
          currentRoot,
          profile: "app",
          dependencies,
        });
      } catch (caught) {
        error = caught;
      }

      expect(String(error)).toMatch(errorPattern);
      expect(String(error)).not.toContain(url);
    },
  );

  it.each([
    "https://example.supabase.co",
    "http://localhost:54321",
    "http://127.0.0.1:54321",
  ])(
    "accepts classified HTTPS remote or HTTP loopback URL: %s",
    async (url) => {
      const { currentRoot, dependencies } = fixture({
        sourceContent: appEnv({ NEXT_PUBLIC_SUPABASE_URL: url }),
      });

      await expect(
        prepareWorktreeEnvironment({
          currentRoot,
          profile: "app",
          dependencies,
        }),
      ).resolves.toMatchObject({ action: "copied" });
    },
  );

  it.each([
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
  ])("accepts loopback URL %s for the local stack", async (url) => {
    const { currentRoot, dependencies } = fixture({
      sourceContent: appEnv({
        NEXT_PUBLIC_SUPABASE_URL: url,
        SUPABASE_LOCAL_STACK: "1",
      }),
    });

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).resolves.toMatchObject({ action: "copied" });
  });

  it("never includes environment values in thrown errors", async () => {
    const { currentRoot, dependencies } = fixture({
      sourceContent: appEnv({
        NEXT_PUBLIC_SUPABASE_URL: secretSentinel,
        SUPABASE_LOCAL_STACK: "1",
      }),
    });

    let error;
    try {
      await prepareWorktreeEnvironment({
        currentRoot,
        profile: "app",
        dependencies,
      });
    } catch (caught) {
      error = caught;
    }

    expect(String(error)).not.toContain(secretSentinel);
    expect(String(error)).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("refuses source and destination symbolic links", async () => {
    const sourceFixture = fixture({ sourceContent: null });
    const outsideSource = path.join(sourceFixture.root, "outside-source");
    writeFileSync(outsideSource, appEnv(), "utf8");
    symlinkSync(
      outsideSource,
      path.join(sourceFixture.mainRoot, ".env.local"),
      "file",
    );

    await expect(
      prepareWorktreeEnvironment({
        currentRoot: sourceFixture.currentRoot,
        profile: "app",
        dependencies: sourceFixture.dependencies,
      }),
    ).rejects.toThrow(/source.*symbolic|source.*reparse|source.*regular file/i);

    const destinationFixture = fixture();
    const outsideDestination = path.join(
      destinationFixture.root,
      "outside-destination",
    );
    writeFileSync(outsideDestination, appEnv(), "utf8");
    symlinkSync(
      outsideDestination,
      path.join(destinationFixture.currentRoot, ".env.local"),
      "file",
    );

    await expect(
      prepareWorktreeEnvironment({
        currentRoot: destinationFixture.currentRoot,
        profile: "app",
        dependencies: destinationFixture.dependencies,
      }),
    ).rejects.toThrow(
      /destination.*symbolic|destination.*reparse|destination.*regular file/i,
    );
  });

  it("does not overwrite a destination created during an exclusive-copy race", async () => {
    const { currentRoot, dependencies } = fixture();
    const raceContent = appEnv({ RACE_WINNER: "preserved" });
    dependencies.beforeCopy = async (destination) => {
      writeFileSync(destination, raceContent, "utf8");
    };

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).rejects.toThrow(/already exists|race/i);
    expect(readFileSync(path.join(currentRoot, ".env.local"), "utf8")).toBe(
      raceContent,
    );
  });

  it("preserves the unchanged file it created when the post-copy ignore check fails", async () => {
    const { currentRoot, dependencies } = fixture();
    let checks = 0;
    dependencies.isIgnored = () => {
      checks += 1;
      return checks === 1;
    };

    let error;
    try {
      await prepareWorktreeEnvironment({
        currentRoot,
        profile: "app",
        dependencies,
      });
    } catch (caught) {
      error = caught;
    }
    expect(String(error)).toMatch(/NEEDS_ATTENTION/i);
    expect(String(error)).not.toContain(secretSentinel);
    expect(readFileSync(path.join(currentRoot, ".env.local"), "utf8")).toBe(
      appEnv(),
    );
  });

  it("preserves and flags a copied file that changed before cleanup", async () => {
    const { currentRoot, dependencies } = fixture();
    const changedContent = appEnv({ CHANGED_AFTER_COPY: "preserve-me" });
    let checks = 0;
    dependencies.isIgnored = (destination) => {
      checks += 1;
      if (checks === 2) writeFileSync(destination, changedContent, "utf8");
      return checks === 1;
    };

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).rejects.toThrow(/NEEDS_ATTENTION/i);
    expect(readFileSync(path.join(currentRoot, ".env.local"), "utf8")).toBe(
      changedContent,
    );
  });

  it("preserves and flags a copied file that was replaced before cleanup", async () => {
    const { currentRoot, dependencies } = fixture();
    const replacedContent = appEnv({ REPLACED_AFTER_COPY: "preserve-me" });
    let checks = 0;
    dependencies.isIgnored = (destination) => {
      checks += 1;
      if (checks === 2) {
        rmSync(destination, { force: true });
        writeFileSync(destination, replacedContent, "utf8");
      }
      return checks === 1;
    };

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).rejects.toThrow(/NEEDS_ATTENTION/i);
    expect(readFileSync(path.join(currentRoot, ".env.local"), "utf8")).toBe(
      replacedContent,
    );
  });

  it("preserves a destination replaced by the explicit after-copy hook", async () => {
    const { currentRoot, dependencies } = fixture();
    const replacement = appEnv({ AFTER_COPY_REPLACEMENT: "preserved" });
    dependencies.afterCopy = async (destination) => {
      rmSync(destination, { force: true });
      writeFileSync(destination, replacement, "utf8");
    };

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).rejects.toThrow(/NEEDS_ATTENTION/i);
    expect(readFileSync(path.join(currentRoot, ".env.local"), "utf8")).toBe(
      replacement,
    );
  });

  it("reports NEEDS_ATTENTION when the generated destination is deleted after copy", async () => {
    const { currentRoot, dependencies } = fixture();
    dependencies.afterCopy = async (destination) =>
      rmSync(destination, { force: true });

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).rejects.toThrow(/NEEDS_ATTENTION/i);
    expect(existsSync(path.join(currentRoot, ".env.local"))).toBe(false);
  });

  it("preserves a destination changed to a symlink after copy", async () => {
    const { currentRoot, dependencies, root } = fixture();
    const outside = path.join(root, "after-copy-outside");
    writeFileSync(outside, appEnv({ OUTSIDE: "preserved" }), "utf8");
    dependencies.afterCopy = async (destination) => {
      rmSync(destination, { force: true });
      symlinkSync(outside, destination, "file");
    };

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).rejects.toThrow(/NEEDS_ATTENTION/i);
    expect(
      lstatSync(path.join(currentRoot, ".env.local")).isSymbolicLink(),
    ).toBe(true);
  });

  it("preserves the generated file when its initial handle inspection fails", async () => {
    const { currentRoot, dependencies } = fixture();
    dependencies.inspectDestination = () => {
      throw new Error("injected metadata failure");
    };

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).rejects.toThrow(/NEEDS_ATTENTION/i);
    expect(existsSync(path.join(currentRoot, ".env.local"))).toBe(true);
  });

  it("writes the already-verified source bytes even if the source path changes before create", async () => {
    const original = appEnv({ SOURCE_VERSION: "verified-original" });
    const { currentRoot, dependencies, mainRoot } = fixture({
      sourceContent: original,
    });
    dependencies.beforeCopy = async () => {
      writeFileSync(
        path.join(mainRoot, ".env.local"),
        appEnv({ SOURCE_VERSION: "replacement" }),
      );
    };

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).resolves.toMatchObject({ action: "copied" });
    expect(readFileSync(path.join(currentRoot, ".env.local"), "utf8")).toBe(
      original,
    );
  });

  it("handles short writes while writing verified bytes to the exclusive destination handle", async () => {
    const original = appEnv({ LONG_VALUE: "x".repeat(80) });
    const { currentRoot, dependencies } = fixture({ sourceContent: original });
    let writes = 0;
    dependencies.writeDestination = (
      fileDescriptor,
      bytes,
      offset,
      length,
      position,
    ) => {
      writes += 1;
      return writeSync(
        fileDescriptor,
        bytes,
        offset,
        Math.min(length, 7),
        position,
      );
    };

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).resolves.toMatchObject({ action: "copied" });
    expect(writes).toBeGreaterThan(1);
    expect(readFileSync(path.join(currentRoot, ".env.local"), "utf8")).toBe(
      original,
    );
  });

  it("fails when the destination is not ignored", async () => {
    const { currentRoot, dependencies } = fixture();
    dependencies.isIgnored = () => false;

    await expect(
      prepareWorktreeEnvironment({ currentRoot, profile: "app", dependencies }),
    ).rejects.toThrow(/destination.*ignored/i);
  });
});
