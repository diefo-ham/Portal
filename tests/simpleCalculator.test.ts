import { describe, expect, it } from "vitest";
import {
  emptyCalc,
  ERROR,
  formatResult,
  pressKey,
  type CalcKey,
  type CalcState,
} from "../src/core/simpleCalculator";

const keys = (sequence: string, from: CalcState = emptyCalc()) =>
  [...sequence].reduce<CalcState>((state, char) => {
    const key: CalcKey = /\d/.test(char)
      ? { type: "digit", digit: char }
      : char === "."
        ? { type: "point" }
        : char === "="
          ? { type: "equals" }
          : char === "n"
            ? { type: "negate" }
            : char === "r"
              ? { type: "sqrt" }
              : char === "b"
                ? { type: "backspace" }
                : char === "c"
                  ? { type: "clear" }
                  : {
                      type: "operator",
                      operator: char as "+" | "-" | "*" | "/",
                    };
    return pressKey(state, key);
  }, from);
const show = (sequence: string) => keys(sequence).display;

describe("Basic calculator", () => {
  it("adds, subtracts, multiplies and divides", () => {
    expect(show("2+3=")).toBe("5");
    expect(show("9-12=")).toBe("-3");
    expect(show("6*7=")).toBe("42");
    expect(show("7/2=")).toBe("3.5");
  });

  it("carries out each operator as the next is pressed, like a pocket calculator", () => {
    expect(show("2+3*4=")).toBe("20");
    expect(show("2+3*")).toBe("5");
  });

  it("types numbers with a decimal point, a sign and backspace", () => {
    expect(show("0.5+0.25=")).toBe("0.75");
    expect(show(".5")).toBe("0.5");
    expect(show("1.2.3")).toBe("1.23");
    expect(show("5n")).toBe("-5");
    expect(show("5nn")).toBe("5");
    expect(show("123b")).toBe("12");
    expect(show("1b")).toBe("0");
    expect(show("007")).toBe("7");
  });

  it("limits a number to twelve digits", () => {
    expect(show("1234567890123456")).toBe("123456789012");
  });

  it("rounds floating-point noise away", () => {
    expect(show("0.1+0.2=")).toBe("0.3");
    expect(formatResult(1 / 3)).toBe("0.333333333333");
  });

  it("shows Error for division by zero and stays there until cleared", () => {
    const state = keys("1/0=");
    expect(state.display).toBe(ERROR);
    expect(pressKey(state, { type: "digit", digit: "5" }).display).toBe(ERROR);
    expect(keys("c7", state).display).toBe("7");
  });

  it("changes the operator when two are pressed in a row, and chains after equals", () => {
    expect(show("5+*3=")).toBe("15");
    expect(keys("2+3=*4=").display).toBe("20");
  });

  it("clears everything with C", () => {
    expect(keys("12+34c")).toEqual(emptyCalc());
  });
});

describe("Square root calculator", () => {
  it("takes the square root of the display", () => {
    expect(show("9r")).toBe("3");
    expect(show("2r")).toBe("1.41421356237");
    expect(show("0r")).toBe("0");
  });

  it("uses a square root inside a calculation", () => {
    expect(show("16r+4=")).toBe("8");
  });

  it("shows Error for the square root of a negative number", () => {
    expect(show("4nr")).toBe(ERROR);
  });
});
