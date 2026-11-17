import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MARK_PATH } from "../src/ui/App/mark";

describe("the portal's mark", () => {
  it("is the same drawing in the header and in the browser-tab icon", () => {
    expect(readFileSync("public/icon.svg", "utf8")).toContain(MARK_PATH);
  });

  it("is cut out of the tile, so it must not be painted over it", () => {
    const icon = readFileSync("public/icon.svg", "utf8");
    expect(icon).toContain('fill-rule="evenodd"');
    expect(icon.match(/<path/g)).toHaveLength(1);
  });
});
