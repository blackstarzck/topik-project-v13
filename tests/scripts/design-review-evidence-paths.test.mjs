import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import * as evidencePaths from "../../scripts/design-review/evidence-paths.mjs";

const { evidenceRoot, requireEvidenceSlug, resolveEvidenceOutput } =
  evidencePaths;
const tempDirs = [];

function tempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "talkpik-evidence-"));
  tempDirs.push(root);
  return root;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("design review evidence paths", () => {
  it.each([undefined, "", "Feature Name", "feature_name", "../escape", "feature--name"])(
    "rejects a missing or unsafe slug: %s",
    (slug) => {
      expect(() => requireEvidenceSlug(slug)).toThrow(/slug/i);
    },
  );

  it("accepts a lowercase kebab-case slug and roots evidence under ignored work state", () => {
    expect(requireEvidenceSlug("recommendation-cards")).toBe(
      "recommendation-cards",
    );
    expect(evidenceRoot("C:/repo", "recommendation-cards")).toBe(
      path.resolve(
        "C:/repo",
        ".codex",
        "work",
        "recommendation-cards",
        "ui-evidence",
      ),
    );
  });

  it("keeps named outputs inside the slug evidence root", () => {
    expect(
      resolveEvidenceOutput({
        cwd: "C:/repo",
        slug: "recommendation-cards",
        child: "render-shot",
      }),
    ).toBe(
      path.resolve(
        "C:/repo",
        ".codex/work/recommendation-cards/ui-evidence/render-shot",
      ),
    );
    expect(() =>
      resolveEvidenceOutput({
        cwd: "C:/repo",
        slug: "recommendation-cards",
        child: "../escape",
      }),
    ).toThrow(/evidence/i);
  });

  it("creates a regular nonexistent evidence directory and verifies its real path", () => {
    expect(evidencePaths.prepareEvidenceOutputDirectory).toBeTypeOf(
      "function",
    );
    const root = tempRoot();
    const output = evidencePaths.prepareEvidenceOutputDirectory({
      cwd: root,
      slug: "recommendation-cards",
      child: "render-shot",
    });

    expect(existsSync(output)).toBe(true);
    expect(realpathSync.native(output)).toBe(output);
  });

  it.runIf(process.platform === "win32")(
    "rejects an existing Windows junction ancestor without deleting it or its target",
    () => {
      const root = tempRoot();
      const outside = tempRoot();
      const linkedWork = path.join(root, ".codex", "work");
      mkdirSync(path.dirname(linkedWork), { recursive: true });
      symlinkSync(outside, linkedWork, "junction");

      expect(() =>
        resolveEvidenceOutput({
          cwd: root,
          slug: "recommendation-cards",
          child: "render-shot",
        }),
      ).toThrow(/symbolic|reparse|junction|linked/i);
      expect(existsSync(linkedWork)).toBe(true);
      expect(existsSync(outside)).toBe(true);
    },
  );

  it.runIf(process.platform === "win32")(
    "rechecks a junction inserted after resolution before creating output",
    () => {
      expect(evidencePaths.prepareEvidenceOutputDirectory).toBeTypeOf(
        "function",
      );
      const root = tempRoot();
      const outside = tempRoot();
      const slugRoot = path.join(
        root,
        ".codex",
        "work",
        "recommendation-cards",
      );
      mkdirSync(slugRoot, { recursive: true });
      resolveEvidenceOutput({
        cwd: root,
        slug: "recommendation-cards",
        child: "render-shot",
      });
      symlinkSync(outside, path.join(slugRoot, "ui-evidence"), "junction");

      expect(() =>
        evidencePaths.prepareEvidenceOutputDirectory({
          cwd: root,
          slug: "recommendation-cards",
          child: "render-shot",
        }),
      ).toThrow(/symbolic|reparse|junction|linked/i);
      expect(existsSync(outside)).toBe(true);
    },
  );

  it.each([
    "full-ui-state-capture-qa.mjs",
    "render-full-ui-state-report.mjs",
    "render-shot.mjs",
  ])("routes %s through the common slug-scoped evidence helper", (script) => {
    const source = readFileSync(
      path.join(process.cwd(), "scripts", "design-review", script),
      "utf8",
    );
    expect(source).toContain("UI_EVIDENCE_SLUG");
    expect(source).toContain("evidence-paths.mjs");
    expect(source).toContain("prepareEvidenceOutputDirectory");
  });
});
