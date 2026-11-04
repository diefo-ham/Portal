import { describe, expect, it } from "vitest";
import { scalar, scalarTex } from "../src/calculator/math";
import { emptyCalculator } from "../src/calculator/model";
import { calculateWorkspace } from "../src/calculator/workspace";
import { customRegression } from "../src/calculator/regression";
import type { ExpressionEntry } from "@/src/types/calculator";

const evaluate = (text: string, angle: "radians" | "degrees" = "radians") =>
  scalar(text).value({}, {}, angle);
const entry = (id: string, text: string): ExpressionEntry => ({
  id,
  type: "expression",
  text,
  hidden: false,
});
const workspace = (...texts: string[]) =>
  calculateWorkspace({
    ...emptyCalculator(),
    entries: texts.map((text, i) => entry("e" + i, text)),
  });

describe("features checked against Desmos", () => {
  it("evaluates factorials of whole numbers only", () => {
    expect(evaluate("5!")).toBe(120);
    expect(evaluate("0!")).toBe(1);
    expect(evaluate("(2+3)!")).toBe(120);
    expect(evaluate("3!+1")).toBe(7);
    expect(evaluate("2.5!")).toBeNaN();
    expect(evaluate("(-1)!")).toBeNaN();
    expect(evaluate("171!")).toBeNaN();
    expect(scalarTex(scalar("5!"))).toContain("!");
  });

  it("gives a negative base a real value when the exponent has an odd denominator", () => {
    expect(evaluate("(-8)^(1/3)")).toBeCloseTo(-2, 12);
    expect(evaluate("(-8)^(2/3)")).toBeCloseTo(4, 12);
    expect(evaluate("(-32)^(1/5)")).toBeCloseTo(-2, 12);
    expect(evaluate("(-8)^(1/2)")).toBeNaN();
    expect(evaluate("(-8)^0.5")).toBeNaN();
    expect(evaluate("(-2)^3")).toBe(-8);
    expect(evaluate("(-8)^(1/4)")).toBeNaN();
    const w = workspace("f(x)=x^(2/3)");
    const graph = w.graphs[0];
    expect(graph.kind === "function" && graph.fn(-8)).toBeCloseTo(4, 12);
  });

  it("counts selections larger than the pool as zero", () => {
    expect(evaluate("nCr(5,7)")).toBe(0);
    expect(evaluate("nPr(5,7)")).toBe(0);
    expect(evaluate("nCr(5,-1)")).toBeNaN();
    expect(evaluate("nCr(5,2)")).toBe(10);
  });

  it("reads piecewise functions", () => {
    const w = workspace(
      "f(x)={x<0:-x,x}",
      "g(x)={x<0:1,0<=x<5:2,3}",
      "y={x<0:x,x^2}",
    );
    const [f, g, y] = w.graphs;
    if (f.kind !== "function" || g.kind !== "function" || y.kind !== "function")
      throw new Error("expected function graphs");
    expect([f.fn(-3), f.fn(0), f.fn(4)]).toEqual([3, 0, 4]);
    expect([g.fn(-1), g.fn(0), g.fn(4.9), g.fn(5), g.fn(9)]).toEqual([
      1, 2, 2, 3, 3,
    ]);
    expect([y.fn(-2), y.fn(3)]).toEqual([-2, 9]);
    // Without a final value the function is undefined elsewhere.
    const open = workspace("h(x)={x<0:1,x>2:2}").graphs[0];
    expect(open.kind === "function" && Number.isNaN(open.fn(1))).toBe(true);
    for (const bad of [
      "f(x)={x<0:}",
      "f(x)={:1}",
      "f(x)={x<0:1,x}{x>2}",
      "f(x)={1,2}",
    ])
      expect(workspace(bad).results["e0"].error).toBeTruthy();
  });

  it("sums and multiplies over a range", () => {
    expect(evaluate("sum(n^2,n,1,4)")).toBe(30);
    expect(evaluate("prod(n,n,1,5)")).toBe(120);
    expect(evaluate("sum(1/n,n,1,4)")).toBeCloseTo(25 / 12, 12);
    expect(evaluate("sum(n,n,5,1)")).toBe(0);
    expect(evaluate("sum(n,n,1,2.5)")).toBeNaN();
    expect(() => evaluate("sum(n,n,1,20000)")).toThrow("10,000");
    expect(() => evaluate("sum(n,1,4,n)")).toThrow("sum(expression");
    // The index belongs to the sum, so it is not reported as a missing value.
    expect(scalar("sum(n^2,n,1,4)").symbols.has("n")).toBe(false);
    expect(scalar("sum(x^n,n,0,3)").symbols.has("x")).toBe(true);
    const w = workspace("f(x)=sum(x^n,n,0,3)");
    const graph = w.graphs[0];
    expect(graph.kind === "function" && graph.fn(2)).toBe(15);
  });

  it("draws a list of points", () => {
    const w = workspace("[(1,2),(3,4),(5,-6)]");
    const graph = w.graphs[0];
    expect(graph.kind).toBe("points");
    if (graph.kind === "points")
      expect(graph.points).toEqual([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: -6 },
      ]);
    expect(workspace("[(1,2)]").graphs[0].kind).toBe("points");
    expect(workspace("[(1,2),3]").results["e0"].error).toBeTruthy();
  });

  it("offers a slider for a point's undefined variable", () => {
    expect(workspace("(t,t^2)").missing).toEqual(["t"]);
  });

  it("fits models that are not linear in their parameters", () => {
    const power = customRegression(
      [1, 2, 3, 4, 5].map((x, i) => ({
        x,
        y: [2.1, 7.9, 18.2, 32.1, 49.7][i],
      })),
      "a*x^b",
      ["a", "b"],
      "radians",
    );
    expect(power.coefficients[0]).toBeCloseTo(2.0608714, 5);
    expect(power.coefficients[1]).toBeCloseTo(1.9783943, 5);
    expect(power.r2).toBeGreaterThan(0.999);
    const exact = customRegression(
      [0, 1, 2, 3, 4].map((x) => ({ x, y: 3 * Math.sin(1.2 * x) })),
      "a*sin(b*x)",
      ["a", "b"],
      "radians",
    );
    expect(exact.coefficients[0]).toBeCloseTo(3, 6);
    expect(exact.coefficients[1]).toBeCloseTo(1.2, 6);
    // The same data always gives the same answer.
    expect(
      customRegression(
        [0, 1, 2, 3, 4].map((x) => ({ x, y: 3 * Math.sin(1.2 * x) })),
        "a*sin(b*x)",
        ["a", "b"],
        "radians",
      ).coefficients,
    ).toEqual(exact.coefficients);
    const w = workspace(
      "x_1=[1,2,3,4,5]",
      "y_1=[2.1,7.9,18.2,32.1,49.7]",
      "y_1~a*x_1^b",
    );
    const result = w.results["e2"];
    expect(result.error).toBeUndefined();
    expect(result.parameters?.a).toBeCloseTo(2.0608714, 5);
  });
});
describe("list handling checked against Desmos", () => {
  const list = (text: string) => scalar(text).evaluate({}, {}, "radians");

  it("picks items by position, one-based", () => {
    expect(list("[4,5,6][2]")).toBe(5);
    expect(list("[4,5,6,7][2...3]")).toEqual([5, 6]);
    expect(list("[10,20,30][[3,1]]")).toEqual([30, 10]);
    expect(list("[1,2][5]")).toBeNaN();
    expect(list("[1,2][0]")).toBeNaN();
    expect(list("[1,2][1.5]")).toBeNaN();
    const w = workspace("L=[4,5,6]", "L[3]+L[1]");
    expect(w.results["e1"].value).toBe(10);
  });

  it("sorts, joins, counts and correlates", () => {
    expect(list("sort([3,1,2])")).toEqual([1, 2, 3]);
    expect(list("join([1,2],[3],4)")).toEqual([1, 2, 3, 4]);
    expect(list("length([1,2,3])")).toBe(3);
    expect(list("corr([1,2,3],[2,4,7])")).toBeCloseTo(0.9933992677987828, 12);
    expect(list("corr([1,2,3],[5,5,5])")).toBeNaN();
    expect(list("sinh(1)")).toBeCloseTo(Math.sinh(1), 12);
    expect(list("atanh(0.5)")).toBeCloseTo(Math.atanh(0.5), 12);
  });
});
