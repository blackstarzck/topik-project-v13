import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const root = process.cwd();

describe("repo-local pnpm launcher", () => {
  test("provides Windows and POSIX wrappers that delegate to Corepack", () => {
    const windowsWrapper = join(root, "bin", "pnpm.cmd");
    const posixWrapper = join(root, "bin", "pnpm");

    expect(existsSync(windowsWrapper)).toBe(true);
    expect(existsSync(posixWrapper)).toBe(true);

    expect(readFileSync(windowsWrapper, "utf8")).toMatch(/corepack pnpm %\*/);
    expect(readFileSync(posixWrapper, "utf8")).toMatch(/corepack pnpm "\$@"/);
  });

  test("adds the local wrapper directory to integrated terminal PATH", () => {
    const settingsPath = join(root, ".vscode", "settings.json");

    expect(existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<
      string,
      Record<string, string>
    >;

    expect(settings["terminal.integrated.env.windows"]?.Path).toContain(
      "${workspaceFolder}\\bin",
    );
    expect(settings["terminal.integrated.env.linux"]?.PATH).toContain(
      "${workspaceFolder}/bin",
    );
    expect(settings["terminal.integrated.env.osx"]?.PATH).toContain(
      "${workspaceFolder}/bin",
    );
  });
});
