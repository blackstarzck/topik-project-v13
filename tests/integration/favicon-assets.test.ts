import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

function readPngSize(relativePath: string) {
  const file = readFileSync(resolve(root, relativePath));
  expect(file.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
}

function readIcoSizes(relativePath: string) {
  const file = readFileSync(resolve(root, relativePath));
  expect(file.readUInt16LE(0)).toBe(0);
  expect(file.readUInt16LE(2)).toBe(1);
  const count = file.readUInt16LE(4);

  return Array.from({ length: count }, (_, index) => {
    const entryOffset = 6 + index * 16;
    const width = file[entryOffset] === 0 ? 256 : file[entryOffset];
    const height = file[entryOffset + 1] === 0 ? 256 : file[entryOffset + 1];
    return `${width}x${height}`;
  }).sort();
}

describe("favicon assets", () => {
  it("keeps the source asset available", () => {
    expect(existsSync(resolve(root, "public/assets/favicon.png"))).toBe(true);
  });

  it("generates browser favicon files from the provided source image", () => {
    expect(readIcoSizes("src/app/favicon.ico")).toEqual([
      "16x16",
      "32x32",
      "48x48",
    ]);
    expect(readPngSize("src/app/icon.png")).toEqual({
      width: 32,
      height: 32,
    });
    expect(readPngSize("src/app/apple-icon.png")).toEqual({
      width: 180,
      height: 180,
    });
  });
});
