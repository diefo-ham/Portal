import { describe, expect, it } from "vitest";
import { formatElapsed, time } from "./formatTime";

describe("time", () => {
  it("shows minutes and two-digit seconds", () => {
    expect(time(0)).toBe("0:00");
    expect(time(7_000)).toBe("0:07");
    expect(time(187_000)).toBe("3:07");
  });

  it("drops partial seconds", () => {
    expect(time(59_999)).toBe("0:59");
  });

  it("keeps counting minutes past an hour", () => {
    expect(time(75 * 60_000)).toBe("75:00");
  });
});

describe("formatElapsed", () => {
  it("uses seconds, minutes and hours as needed", () => {
    expect(formatElapsed(42_000)).toBe("42s");
    expect(formatElapsed(65_000)).toBe("1m 05s");
    expect(formatElapsed(3_600_000)).toBe("1h");
    expect(formatElapsed(3_725_000)).toBe("1h 2m 5s");
  });

  it("never goes below zero", () => {
    expect(formatElapsed(-5_000)).toBe("0s");
  });
});
