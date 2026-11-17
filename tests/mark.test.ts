import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MARK_PATH, TILE_PATH } from "../src/ui/App/mark";

describe("the portal's mark", () => {
  const icon = readFileSync("public/icon.svg", "utf8");

  it("is the same drawing in the header and in the browser-tab icon", () => {
    expect(icon).toContain(TILE_PATH + MARK_PATH);
  });

  it("is cut out of the tile, so it must not be painted over it", () => {
    expect(icon).toContain('fill-rule="evenodd"');
    expect(icon.match(/<path/g)).toHaveLength(1);
  });

  it("fills the tile with a gradient that has a dark-tab-bar version", () => {
    expect(icon).toContain('fill="url(#tile)"');
    expect(icon).toContain("prefers-color-scheme: dark");
  });
});
