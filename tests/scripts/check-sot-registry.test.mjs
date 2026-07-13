import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateRegistry,
  renderIndex,
  resolveRegistryOwner,
  validateRegistry,
} from "../../scripts/check-sot-registry.mjs";

let tempDirs = [];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "v13-sot-registry-"));
  tempDirs.push(root);
  mkdirSync(join(root, "docs"), { recursive: true });
  return root;
}

function write(root, relativePath, content) {
  const file = join(root, relativePath);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content, "utf8");
}

function document(overrides = {}) {
  return {
    id: "workflow-core",
    title: "Workflow Core",
    path: "docs/core.md",
    role: "workflow",
    scope: "workflow/core",
    owner: "project",
    status: "active",
    precedence: 20,
    effectiveDate: "2026-07-10",
    replaces: [],
    replacedBy: [],
    decisionLink: null,
    pathPrefix: null,
    ...overrides,
  };
}

function registry(documents = [document()]) {
  return {
    schemaVersion: 2,
    generatedIndex: "docs/INDEX.md",
    classificationDefault: { role: "unclassified" },
    documents,
  };
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("validateRegistry", () => {
  it("inherits active ownership through a registered pathPrefix and prefers an exact owner", () => {
    const input = registry([
      document({ pathPrefix: "docs/Wireframe/" }),
      document({
        id: "screen-specialization",
        path: "docs/Wireframe/screen/functional-spec.md",
        pathPrefix: null,
        scope: "screen/specialization",
        precedence: 10,
      }),
    ]);

    expect(resolveRegistryOwner(input, "docs/Wireframe/other/functional-spec.md")?.id).toBe(
      "workflow-core",
    );
    expect(resolveRegistryOwner(input, "docs/Wireframe/screen/functional-spec.md")?.id).toBe(
      "screen-specialization",
    );
    expect(resolveRegistryOwner(input, "docs/unregistered.md")).toBeNull();
  });

  it("accepts a valid active document and separate proposal lifecycle role", () => {
    const root = createTempRoot();
    write(root, "docs/core.md", "# Core\n");
    write(root, "docs/proposal.md", "# Proposal\n");

    const input = registry([
      document({ replaces: ["workflow-proposal"] }),
      document({
        id: "workflow-proposal",
        title: "Workflow Proposal",
        path: "docs/proposal.md",
        role: "proposal",
        scope: "workflow/overhaul-decision",
        status: "superseded",
        precedence: 90,
        replacedBy: ["workflow-core"],
      }),
    ]);

    expect(validateRegistry(input, { rootDir: root })).toEqual([]);
  });

  it("rejects a proposal that is marked active", () => {
    const root = createTempRoot();
    write(root, "docs/proposal.md", "# Proposal\n");

    const errors = validateRegistry(
      registry([
        document({
          id: "workflow-proposal",
          path: "docs/proposal.md",
          role: "proposal",
        }),
      ]),
      { rootDir: root },
    );

    expect(errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/proposal.*cannot be active/i)]),
    );
  });

  it("requires superseded and active documents to use compatible replacement state", () => {
    const root = createTempRoot();
    write(root, "docs/core.md", "# Core\n");
    write(root, "docs/old.md", "# Old\n");

    const errors = validateRegistry(
      registry([
        document({ replacedBy: ["workflow-old"] }),
        document({
          id: "workflow-old",
          path: "docs/old.md",
          scope: "workflow/old",
          status: "superseded",
        }),
      ]),
      { rootDir: root },
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/active.*replacedBy must be empty/i),
        expect.stringMatching(/superseded.*replacedBy must not be empty/i),
      ]),
    );
  });

  it("requires replacement relationships to be reciprocal", () => {
    const root = createTempRoot();
    write(root, "docs/core.md", "# Core\n");
    write(root, "docs/old.md", "# Old\n");

    const errors = validateRegistry(
      registry([
        document(),
        document({
          id: "workflow-old",
          path: "docs/old.md",
          scope: "workflow/old",
          status: "superseded",
          replacedBy: ["workflow-core"],
        }),
      ]),
      { rootDir: root },
    );

    expect(errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/replacement mismatch.*workflow-core/i)]),
    );
  });

  it("requires a superseded document to point to an active replacement", () => {
    const root = createTempRoot();
    write(root, "docs/core.md", "# Core\n");
    write(root, "docs/old.md", "# Old\n");

    const errors = validateRegistry(
      registry([
        document({
          status: "accepted_pending_promotion",
          replaces: ["workflow-old"],
        }),
        document({
          id: "workflow-old",
          path: "docs/old.md",
          scope: "workflow/old",
          status: "superseded",
          replacedBy: ["workflow-core"],
        }),
      ]),
      { rootDir: root },
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/superseded replacement workflow-core must be active/i),
      ]),
    );
  });

  it("rejects empty metadata and an unsafe or missing decision link", () => {
    const root = createTempRoot();
    write(root, "docs/core.md", "# Core\n");

    const errors = validateRegistry(
      registry([
        document({
          title: "  ",
          scope: 42,
          owner: "",
          decisionLink: "../decision.md",
        }),
      ]),
      { rootDir: root },
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/title must be a non-empty string/i),
        expect.stringMatching(/scope must be a non-empty string/i),
        expect.stringMatching(/owner must be a non-empty string/i),
        expect.stringMatching(/decisionLink must reference an existing file/i),
      ]),
    );
  });

  it("reports a registered path that does not exist", () => {
    const root = createTempRoot();

    expect(validateRegistry(registry(), { rootDir: root })).toEqual(
      expect.arrayContaining([expect.stringMatching(/missing path.*docs\/core\.md/i)]),
    );
  });

  it("rejects two active owners for the same scope", () => {
    const root = createTempRoot();
    write(root, "docs/core.md", "# Core\n");
    write(root, "docs/other.md", "# Other\n");

    const input = registry([
      document(),
      document({
        id: "workflow-other",
        title: "Other Workflow",
        path: "docs/other.md",
      }),
    ]);

    expect(validateRegistry(input, { rootDir: root })).toEqual(
      expect.arrayContaining([expect.stringMatching(/duplicate active scope.*workflow\/core/i)]),
    );
  });

  it("rejects invalid role and lifecycle status independently", () => {
    const root = createTempRoot();
    write(root, "docs/core.md", "# Core\n");

    const errors = validateRegistry(
      registry([document({ role: "source-of-everything", status: "promoted" })]),
      { rootDir: root },
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/invalid role.*source-of-everything/i),
        expect.stringMatching(/invalid status.*promoted/i),
      ]),
    );
  });

  it("rejects replacement IDs that are not present in the registry", () => {
    const root = createTempRoot();
    write(root, "docs/core.md", "# Core\n");

    expect(
      validateRegistry(registry([document({ replaces: ["missing-policy"] })]), {
        rootDir: root,
      }),
    ).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown replacement id.*missing-policy/i)]),
    );
  });
});

describe("generated index", () => {
  it("renders a deterministic generated warning and active contract table", () => {
    const output = renderIndex(registry());

    expect(output).toContain("GENERATED FILE");
    expect(output).toContain("| 20 | `workflow/core` | workflow | Workflow Core |");
    expect(output.endsWith("\n")).toBe(true);
  });

  it("reports index drift instead of silently accepting hand edits", () => {
    const root = createTempRoot();
    const input = registry();
    write(root, "docs/core.md", "# Core\n");
    write(root, "docs/sot-registry.json", `${JSON.stringify(input, null, 2)}\n`);
    write(root, "docs/INDEX.md", "# hand edited\n");

    const result = evaluateRegistry({ rootDir: root });

    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/generated index drift/i)]),
    );
    expect(result.expectedIndex).toBe(renderIndex(input));
  });

  it("returns validation errors without rendering malformed documents", () => {
    const root = createTempRoot();
    const input = registry([
      {
        ...document(),
        path: undefined,
        replacedBy: "workflow-next",
      },
    ]);
    write(root, "docs/sot-registry.json", `${JSON.stringify(input, null, 2)}\n`);

    expect(() => evaluateRegistry({ rootDir: root })).not.toThrow();
    expect(evaluateRegistry({ rootDir: root }).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/missing path/i),
        expect.stringMatching(/replacedBy must be an array/i),
      ]),
    );
  });
});
