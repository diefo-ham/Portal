// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { containsTarget } from "./dom";

describe("containsTarget", () => {
  const tree = () => {
    document.body.innerHTML =
      '<div id="box"><button id="inside">x</button></div><p id="outside"></p>';
    const get = (id: string) => document.getElementById(id)!;
    return { box: get("box"), inside: get("inside"), outside: get("outside") };
  };

  it("finds a target inside the container, or the container itself", () => {
    const { box, inside } = tree();
    expect(containsTarget(box, inside)).toBe(true);
    expect(containsTarget(box, box)).toBe(true);
  });

  it("rejects a target outside", () => {
    const { box, outside } = tree();
    expect(containsTarget(box, outside)).toBe(false);
  });

  it("treats no target, or a target that is not a node, as outside", () => {
    const { box } = tree();
    expect(containsTarget(box, null)).toBe(false);
    expect(containsTarget(box, window)).toBe(false);
    expect(containsTarget(box, new EventTarget())).toBe(false);
  });

  it("lets a missing container contain nothing", () => {
    const { inside } = tree();
    expect(containsTarget(null, inside)).toBe(false);
    expect(containsTarget(undefined, inside)).toBe(false);
  });
});
