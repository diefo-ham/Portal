import { describe, it, expect } from "vitest";
import { clamp, roundSig } from "./calculator";

describe("clamp", () => {
  it("returns values inside the range unchanged", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("limits values outside the range", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
    expect(clamp(-Infinity, -10000, 10000)).toBe(-10000);
    expect(clamp(Infinity, -10000, 10000)).toBe(10000);
  });

  it("works with fractional and negative ranges", () => {
    expect(clamp(0.9, 0.15, 0.85)).toBe(0.85);
    expect(clamp(-7, -5, -1)).toBe(-5);
  });

  it("lets min win when the range is inverted", () => {
    expect(clamp(5, 10, 0)).toBe(10);
    expect(clamp(-5, 10, 0)).toBe(10);
  });

  it("passes NaN through", () => {
    expect(clamp(NaN, 0, 10)).toBeNaN();
  });
});

describe("roundSig", () => {
  it("removes floating-point dust", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(roundSig(0.1 + 0.2, 12)).toBe(0.3);
    expect(roundSig(1.0000000000001, 10)).toBe(1);
  });

  it("rounds to significant digits, not decimal places", () => {
    expect(roundSig(123456.789, 3)).toBe(123000);
    expect(roundSig(0.00123456, 3)).toBe(0.00123);
    expect(roundSig(Math.PI, 6)).toBe(3.14159);
  });

  it("keeps the sign and zero", () => {
    expect(roundSig(-Math.PI, 3)).toBe(-3.14);
    expect(roundSig(0, 6)).toBe(0);
  });

  it("passes non-finite values through", () => {
    expect(roundSig(NaN, 6)).toBeNaN();
    expect(roundSig(Infinity, 6)).toBe(Infinity);
    expect(roundSig(-Infinity, 6)).toBe(-Infinity);
  });

  it("returns a number whose string has no trailing noise", () => {
    expect(roundSig(2 / 3, 10).toString()).toBe("0.6666666667");
    expect(roundSig(1e21 + 1, 6).toString()).toBe("1e+21");
  });
});
