import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateProjectStructure,
  requiredOwnerPaths,
} from "../../scripts/check-project-structure.mjs";

const tempDirs = [];
const retiredDocsPath = ["docs", "Wireframe", "screen.md"].join("/");
const retiredDocsFile = ["docs", "user-communication-style.md"].join("/");
const retiredRegistryCommand = ["check", "sot", "registry"].join("-");
const retiredFixturePath = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "project-structure-retired-references.json",
);
const retiredFixtures = JSON.parse(readFileSync(retiredFixturePath, "utf8"));

function tempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "talkpik-structure-"));
  tempDirs.push(root);
  return root;
}

function write(root, relativePath, content = "# fixture\n") {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

function createValidTree() {
  const root = tempRoot();
  for (const owner of requiredOwnerPaths) {
    if (owner.endsWith("/")) {
      mkdirSync(path.join(root, owner), { recursive: true });
    } else {
      write(root, owner);
    }
  }
  mkdirSync(path.join(root, "docs", "swagger-api"), { recursive: true });
  mkdirSync(path.join(root, "docs", "qa", "plan"), { recursive: true });
  mkdirSync(path.join(root, "docs", "qa", "reports"), { recursive: true });
  mkdirSync(path.join(root, "src"), { recursive: true });
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  mkdirSync(path.join(root, "tests"), { recursive: true });
  git(root, "init", "--quiet");
  return root;
}

function git(root, ...args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed`);
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("project structure allowlist", () => {
  it("accepts the minimal canonical owner tree", () => {
    const root = createValidTree();
    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual([]);
  });

  it.each([
    ["legacy.md", "file"],
    ["Wireframe", "directory"],
  ])("rejects an unknown docs top-level %s", (name, kind) => {
    const root = createValidTree();
    const target = path.join(root, "docs", name);
    if (kind === "directory") mkdirSync(target, { recursive: true });
    else writeFileSync(target, "legacy\n", "utf8");

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(new RegExp(`docs.*${name}`, "i")),
      ]),
    );
  });

  it("rejects an allowed docs directory implemented as a junction", () => {
    const root = createValidTree();
    const outside = tempRoot();
    const target = path.join(root, "docs", "swagger-api");
    rmSync(target, { recursive: true, force: true });
    symlinkSync(
      outside,
      target,
      process.platform === "win32" ? "junction" : "dir",
    );

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/swagger-api.*symbolic|swagger-api.*reparse/i),
      ]),
    );
  });

  it.each(requiredOwnerPaths)(
    "rejects a missing required owner: %s",
    (owner) => {
      const root = createValidTree();
      rmSync(path.join(root, owner), { recursive: true, force: true });

      expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            new RegExp(owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
          ),
        ]),
      );
    },
  );
});

describe("docs/qa root allowlist", () => {
  it.each([
    ["legacy.md", "file"],
    ["archive", "directory"],
  ])("rejects an unknown docs/qa root %s", (name, kind) => {
    const root = createValidTree();
    const target = path.join(root, "docs", "qa", name);
    if (kind === "directory") mkdirSync(target, { recursive: true });
    else writeFileSync(target, "legacy\n", "utf8");

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(new RegExp(`docs/qa.*${name}`, "i")),
      ]),
    );
  });

  it.each(["README.md", "plan", "reports"])("requires docs/qa/%s", (name) => {
    const root = createValidTree();
    rmSync(path.join(root, "docs", "qa", name), {
      recursive: true,
      force: true,
    });

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(new RegExp(`docs/qa.*${name}`, "i")),
      ]),
    );
  });

  it("rejects an allowed docs/qa directory implemented as a junction", () => {
    const root = createValidTree();
    const outside = tempRoot();
    const target = path.join(root, "docs", "qa", "plan");
    rmSync(target, { recursive: true, force: true });
    symlinkSync(
      outside,
      target,
      process.platform === "win32" ? "junction" : "dir",
    );

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /docs\/qa.*plan.*symbolic|docs\/qa.*plan.*reparse/i,
        ),
      ]),
    );
  });
});

describe("active reference scan", () => {
  it.each([
    [".github/workflows/ci.yml", retiredFixtures.ciCommand],
    [".github/CODEOWNERS", retiredFixtures.codeowners],
    ["config/example.json", retiredFixtures.configJson],
  ])(
    "rejects retired references in policy/config surface %s",
    (relativePath, content) => {
      const root = createValidTree();
      write(root, relativePath, `${content}\n`);

      expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
        expect.arrayContaining([expect.stringContaining(relativePath)]),
      );
    },
  );

  it.each([
    [".github/workflows/ci.yml", "run: pnpm check:project-structure"],
    [".github/CODEOWNERS", "/docs/prd.md @owner"],
    ["config/example.json", '{"owner":"docs/supabase/README.md"}'],
  ])(
    "allows current references in policy/config surface %s",
    (relativePath, content) => {
      const root = createValidTree();
      write(root, relativePath, `${content}\n`);

      expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual([]);
    },
  );

  it.each([
    [
      "src/deleted-legacy.ts",
      `export const legacy = ${JSON.stringify(retiredDocsPath)};\n`,
    ],
    ["src/deleted-ordinary.ts", "export const ordinary = true;\n"],
  ])(
    "does not report an unstaged deleted tracked path as missing: %s",
    (relativePath, content) => {
      const root = createValidTree();
      write(root, relativePath, content);
      git(root, "add", relativePath);
      rmSync(path.join(root, relativePath));

      const errors = evaluateProjectStructure({ rootDir: root }).errors;
      expect(errors).not.toEqual(
        expect.arrayContaining([
          expect.stringMatching(/missing|dangling|forbidden docs reference/i),
        ]),
      );
    },
  );

  it("still reports a required owner when its tracked file is deleted", () => {
    const root = createValidTree();
    git(root, "add", "AGENTS.md");
    rmSync(path.join(root, "AGENTS.md"));

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/missing required owner: agents\.md/i),
      ]),
    );
  });

  it("scans active CSS files for retired docs references", () => {
    const root = createValidTree();
    write(root, "src/styles/legacy.css", retiredFixtures.css);

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/forbidden docs reference.*legacy\.css/i),
      ]),
    );
  });

  it.each([
    ["scripts/split-path.mjs", retiredFixtures.splitWireframe],
    ["scripts/recreate-deleted-folder.mjs", retiredFixtures.splitRecreate],
  ])("rejects split retired path construction in %s", (file, content) => {
    const root = createValidTree();
    write(root, file, content);

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /forbidden docs reference.*split|forbidden docs reference.*recreate/i,
        ),
      ]),
    );
  });

  it("rejects split retired paths built from static backtick literals", () => {
    const root = createValidTree();
    const constructor = ["path", "join"].join(".");
    write(
      root,
      "scripts/backtick-path.mjs",
      `const retired = ${constructor}(root, \`docs\`, \`Wireframe\`);\n`,
    );

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/backtick-path.*split path construction/i),
      ]),
    );
  });

  it("rejects a dynamic template under a known docs path without evaluating it", () => {
    const root = createValidTree();
    const constructor = ["path", "join"].join(".");
    write(
      root,
      "scripts/dynamic-docs-path.mjs",
      `const target = ${constructor}(root, \`docs\`, \`\${section}\`);\n`,
    );

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/dynamic-docs-path.*dynamic docs path/i),
      ]),
    );
  });

  it.each([
    ["join", "docs/${section}"],
    ["resolve", "./docs/${section}"],
  ])(
    "fails closed for path.%s with a dynamic docs prefix",
    (method, templateBody) => {
      const root = createValidTree();
      const constructor = ["path", method].join(".");
      write(
        root,
        `scripts/dynamic-${method}-docs-path.mjs`,
        `const target = ${constructor}(root, \`${templateBody}\`);\n`,
      );

      expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /dynamic-(?:join|resolve)-docs-path.*dynamic docs path/i,
          ),
        ]),
      );
    },
  );

  it.each([
    ["join", "src/${section}"],
    ["resolve", "https://example.com/docs/${section}"],
  ])(
    "does not reject unrelated path.%s dynamic template %s",
    (method, templateBody) => {
      const root = createValidTree();
      const constructor = ["path", method].join(".");
      write(
        root,
        `scripts/unrelated-dynamic-${method}.mjs`,
        `const target = ${constructor}(root, \`${templateBody}\`);\n`,
      );

      expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual([]);
    },
  );

  it.each([retiredFixtures.adminPlan, retiredFixtures.pdfBrief])(
    "rejects an already-absent retired document: %s",
    (reference) => {
      const root = createValidTree();
      write(
        root,
        "src/legacy-owner.ts",
        `export const owner = ${JSON.stringify(reference)};\n`,
      );

      expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/forbidden docs reference.*legacy-owner/i),
        ]),
      );
    },
  );

  it("narrowly exempts only the checker policy source and retired-reference fixture data", () => {
    const root = createValidTree();
    write(
      root,
      "scripts/check-project-structure.mjs",
      readFileSync(
        path.join(process.cwd(), "scripts", "check-project-structure.mjs"),
        "utf8",
      ),
    );
    write(
      root,
      "tests/fixtures/project-structure-retired-references.json",
      readFileSync(retiredFixturePath, "utf8"),
    );
    write(root, "scripts/ordinary.mjs", retiredFixtures.splitWireframe);

    const errors = evaluateProjectStructure({ rootDir: root }).errors;
    expect(errors).toEqual([
      expect.stringMatching(/forbidden docs reference.*ordinary\.mjs/i),
    ]);
  });

  it.each([
    ["README.md", `See ${retiredDocsPath}\n`],
    ["src/route.ts", `const source = ${JSON.stringify(retiredDocsPath)};\n`],
    ["scripts/recreate.mjs", `mkdir(${JSON.stringify(retiredDocsPath)});\n`],
    [
      "tests/contract.test.mjs",
      `expect(${JSON.stringify(retiredDocsPath)}).toBeTruthy();\n`,
    ],
    ["supabase/migrations/INDEX.md", `Previous owner: ${retiredDocsPath}\n`],
  ])("rejects a retired docs reference in active file %s", (file, content) => {
    const root = createValidTree();
    write(root, file, content);

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/forbidden docs reference/i),
      ]),
    );
  });

  it.each([
    ["docs/prd.md", `Retired owner: ${retiredDocsPath}\n`],
    [
      "docs/supabase/database-api-contract.md",
      `Retired owner: ${retiredDocsFile}\n`,
    ],
    [".claude/CLAUDE.md", `Retired owner: ${retiredDocsPath}\n`],
    [
      ".claude/settings.json",
      JSON.stringify({ retiredOwner: retiredDocsPath }),
    ],
  ])(
    "scans active product, Supabase, and Claude config file %s",
    (file, content) => {
      const root = createValidTree();
      write(root, file, content);

      expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/forbidden docs reference/i),
        ]),
      );
    },
  );

  it.each([
    "docs/qa/README.md",
    "docs/qa/plan/current.md",
    "docs/qa/plan/nested/current.md",
  ])("scans active QA contract text in %s", (file) => {
    const root = createValidTree();
    write(root, file, `Retired owner: ${retiredDocsPath}\n`);

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/forbidden docs reference/i),
      ]),
    );
  });

  it.each([
    "scripts/legacy.mts",
    "scripts/legacy.cts",
    "src/legacy.html",
    "scripts/legacy.sh",
    "scripts/legacy.ps1",
    "scripts/legacy.cmd",
    "scripts/legacy.bat",
    ".env.example",
    ".ENV.EXAMPLE",
  ])("scans additional active text surface %s", (file) => {
    const root = createValidTree();
    write(root, file, `Retired owner: ${retiredDocsPath}\n`);

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/forbidden docs reference/i),
      ]),
    );
  });

  it("does not read a binary candidate even when its bytes contain a retired path", () => {
    const root = createValidTree();
    const target = path.join(root, "src", "image.png");
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(
      target,
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]),
        Buffer.from(retiredDocsPath, "utf8"),
      ]),
    );

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual([]);
  });

  it("does not scan ignored .codex work products", () => {
    const root = createValidTree();
    write(
      root,
      ".codex/work/example/plans/plan.md",
      `Historic plan: ${retiredDocsPath}\n`,
    );

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual([]);
  });

  it("uses Git candidates and never reads ignored sensitive or skill helper files", () => {
    const root = createValidTree();
    const sentinel = "IGNORED_SECRET_SENTINEL_MUST_NOT_LEAK";
    write(
      root,
      ".gitignore",
      [
        "tests/e2e/auth-state/",
        ".claude/settings.local.json",
        ".codex/skills/private/",
      ].join("\n"),
    );
    write(
      root,
      "tests/e2e/auth-state/session.json",
      `${retiredDocsPath} ${sentinel}\n`,
    );
    write(
      root,
      ".claude/settings.local.json",
      `${retiredDocsPath} ${sentinel}\n`,
    );
    write(
      root,
      ".codex/skills/private/SECRET.md",
      `${retiredDocsPath} ${sentinel}\n`,
    );
    const errors = evaluateProjectStructure({ rootDir: root }).errors;
    expect(errors).toEqual([]);
    expect(errors.join("\n")).not.toContain(sentinel);
  });

  it("reports a tracked sensitive runtime path without reading or echoing its content", () => {
    const root = createValidTree();
    const sentinel = "TRACKED_SECRET_SENTINEL_MUST_NOT_LEAK";
    write(root, ".gitignore", ".claude/settings.local.json\n");
    write(
      root,
      ".claude/settings.local.json",
      `${retiredDocsPath} ${sentinel}\n`,
    );
    git(root, "add", "--force", ".claude/settings.local.json");

    const errors = evaluateProjectStructure({ rootDir: root }).errors;
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/sensitive runtime path/i),
      ]),
    );
    expect(errors.join("\n")).not.toContain(sentinel);
  });

  it.each(["tracked", "untracked-nonignored"])(
    "reports a %s root .env.local without reading its content",
    (mode) => {
      const root = createValidTree();
      const sentinel = `ROOT_ENV_${mode}_SECRET_MUST_NOT_LEAK`;
      if (mode === "tracked") write(root, ".gitignore", ".env.local\n");
      write(root, ".env.local", `${retiredDocsPath}=${sentinel}\n`);
      if (mode === "tracked") git(root, "add", "--force", ".env.local");

      const errors = evaluateProjectStructure({ rootDir: root }).errors;
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/sensitive runtime path.*\.env\.local/i),
        ]),
      );
      expect(errors.join("\n")).not.toContain(sentinel);
      expect(errors).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/forbidden docs/i)]),
      );
    },
  );

  it("fails an active dangling symlink returned by Git inventory", () => {
    const root = createValidTree();
    const dangling = path.join(root, "src", "dangling.ts");
    symlinkSync(path.join(root, "missing-target.ts"), dangling, "file");

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /dangling\.ts.*symbolic|dangling\.ts.*missing|active path.*dangling\.ts/i,
        ),
      ]),
    );
  });

  it("fails a tracked dangling symlink instead of treating it as a deleted path", () => {
    const root = createValidTree();
    const dangling = path.join(root, "src", "tracked-dangling.ts");
    symlinkSync(path.join(root, "missing-target.ts"), dangling, "file");
    git(root, "add", "src/tracked-dangling.ts");

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /tracked-dangling\.ts.*symbolic|active path.*tracked-dangling\.ts/i,
        ),
      ]),
    );
  });

  it("fails closed without scanning content when Git inventory cannot be produced", () => {
    const root = createValidTree();
    const sentinel = "INVENTORY_FAILURE_SECRET_SENTINEL_MUST_NOT_LEAK";
    rmSync(path.join(root, ".git"), { recursive: true, force: true });
    write(root, ".gitignore", ".claude/settings.local.json\n");
    write(
      root,
      ".claude/settings.local.json",
      `${retiredDocsPath} ${sentinel}\n`,
    );
    write(
      root,
      "tests/e2e/auth-state/session.json",
      `${retiredDocsPath} ${sentinel}\n`,
    );

    const errors = evaluateProjectStructure({ rootDir: root }).errors;
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/git.*inventory|inventory.*git/i),
      ]),
    );
    expect(errors).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/forbidden docs/i)]),
    );
    expect(errors.join("\n")).not.toContain(sentinel);
  });

  it("allows historical references in QA reports and immutable migration SQL", () => {
    const root = createValidTree();
    write(
      root,
      "docs/qa/reports/2026-01-01-history.md",
      `Historic: ${retiredDocsPath}\n`,
    );
    write(
      root,
      "supabase/migrations/20260101000000_history.sql",
      `-- Historic: ${retiredDocsPath}\n`,
    );

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual([]);
  });

  it("rejects retired registry commands even when they do not name a docs path", () => {
    const root = createValidTree();
    write(
      root,
      "package.json",
      `${JSON.stringify({ scripts: { verify: `node scripts/${retiredRegistryCommand}.mjs` } })}\n`,
    );

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/retired structure reference/i),
      ]),
    );
  });

  it.each([
    "https://nextjs.org/docs/app/building-your-application",
    "https://supabase.com/docs/guides/api",
    ["docs", "new-product-owner", "README.md"].join("/"),
  ])("does not reject unrelated or official docs paths: %s", (reference) => {
    const root = createValidTree();
    write(
      root,
      "src/reference.ts",
      `export const reference = ${JSON.stringify(reference)};\n`,
    );

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual([]);
  });

  it("does not treat a retired-looking docs path inside an HTTPS URL as an internal reference", () => {
    const root = createValidTree();
    const url = ["https://example.com", "docs", "flow", "guide"].join("/");
    write(
      root,
      "src/reference.ts",
      `export const reference = ${JSON.stringify(url)};\n`,
    );

    expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual([]);
  });

  it.each([
    [
      ["", "", "example.com", "docs", "flow", "guide"].join("/"),
      "protocol-relative",
    ],
    [["file:", "", "", "tmp", "docs", "flow", "guide"].join("/"), "file URL"],
  ])(
    "does not treat a retired path inside a %s token as internal",
    (reference) => {
      const root = createValidTree();
      write(
        root,
        "src/reference.ts",
        `export const reference = ${JSON.stringify(reference)};\n`,
      );

      expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual([]);
    },
  );

  it.each([
    "mailto:help@example.com/docs/flow/guide",
    "tel:+821012345678/docs/Wireframe/screen",
    "data:text/plain,docs/user-communication-style.md",
  ])(
    "does not treat a retired-looking docs path inside external URI %s as internal",
    (reference) => {
      const root = createValidTree();
      write(
        root,
        "src/reference.ts",
        `export const reference = ${JSON.stringify(reference)};\n`,
      );

      expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual([]);
    },
  );

  it.each([
    [["docs", ".", "flow", "guide.md"].join("/"), /flow/i],
    [["docs", ".", "Wireframe", "screen.md"].join("\\"), /wireframe/i],
  ])(
    "normalizes internal dot segments before checking retired docs: %s",
    (reference, pattern) => {
      const root = createValidTree();
      write(
        root,
        "src/reference.ts",
        `export const reference = ${JSON.stringify(reference)};\n`,
      );

      expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
        expect.arrayContaining([expect.stringMatching(pattern)]),
      );
    },
  );

  it.each([
    [["DOCS", "wireframe", "screen.md"].join("/"), /wireframe/i],
    [
      ["docs", "USER-COMMUNICATION-STYLE.md"].join("\\"),
      /user-communication-style/i,
    ],
  ])(
    "matches retired docs paths case-insensitively: %s",
    (reference, errorPattern) => {
      const root = createValidTree();
      write(
        root,
        "src/reference.ts",
        `export const reference = ${JSON.stringify(reference)};\n`,
      );

      expect(evaluateProjectStructure({ rootDir: root }).errors).toEqual(
        expect.arrayContaining([expect.stringMatching(errorPattern)]),
      );
    },
  );
});

describe("package interface", () => {
  it("exposes worktree env preparation and project structure checks", async () => {
    const packageJson = JSON.parse(
      await import("node:fs/promises").then(({ readFile }) =>
        readFile(path.join(process.cwd(), "package.json"), "utf8"),
      ),
    );

    expect(packageJson.scripts["prepare:worktree-env"]).toBe(
      "node scripts/prepare-worktree-env.mjs",
    );
    expect(packageJson.scripts["check:project-structure"]).toBe(
      "node scripts/check-project-structure.mjs",
    );
    expect(packageJson.scripts["test:supabase:local"]).toContain(
      "tests/integration/pdf-export-quota-rpc.test.ts",
    );

    const pdfQuotaIntegration = await import("node:fs/promises").then(
      ({ readFile }) =>
        readFile(
          path.join(
            process.cwd(),
            "tests/integration/pdf-export-quota-rpc.test.ts",
          ),
          "utf8",
        ),
    );
    expect(pdfQuotaIntegration).toMatch(
      /process\.env\.E2E_STUDENT_PASSWORD\s*\?\?\s*process\.env\.SUPABASE_TEST_PASSWORD/u,
    );
  });
});
