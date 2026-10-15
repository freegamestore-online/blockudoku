import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// Visible-text regression test for the "Blockudoku" → "Block Sudoku" rename
// (platform issue #173). Only display strings are checked: the slug, the
// analytics `?app=blockudoku` param and the `blockudoku-best` storage key
// stay lowercase and are intentionally not asserted here.
const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const indexHtml = read("../../index.html");
const appSource = read("../App.tsx");
const viteConfig = read("../../vite.config.ts");

describe("visible title text", () => {
  it("document title uses Block Sudoku", () => {
    expect(indexHtml).toMatch(/<title>Block Sudoku — FreeGameStore<\/title>/);
    expect(indexHtml).not.toMatch(/<title>[^<]*Blockudoku/);
  });

  it("in-game topbar title uses Block Sudoku", () => {
    expect(appSource).toContain('<GameTopbar title="Block Sudoku"');
    expect(appSource).not.toMatch(/title="Blockudoku"/);
  });

  it("PWA manifest name, short_name and description use Block Sudoku", () => {
    expect(viteConfig).toContain('name: "Block Sudoku",');
    expect(viteConfig).toContain('short_name: "Block Sudoku",');
    expect(viteConfig).toContain('description: "Block Sudoku — free forever",');
    expect(viteConfig).not.toMatch(/(name|short_name|description):\s*"[^"]*Blockudoku/);
    expect(viteConfig).not.toContain("APPNAME");
  });

  it("no display string in the app mentions Blockudoku", () => {
    for (const source of [indexHtml, appSource, viteConfig]) {
      // Lowercase slug/storage keys are allowed; capitalised display text is not.
      expect(source).not.toMatch(/Blockudoku/);
    }
  });
});
