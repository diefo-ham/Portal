import { describe, expect, it } from "vitest";
import { scalar } from "../src/calculator/math";
import { latexToText, textToLatex } from "../src/calculator/latex";
import type { Value } from "../src/types/calculator";

const run = (text: string, scope: Record<string, Value> = {}) =>
  scalar(text).evaluateValue(scope, {}, "radians");
const pt = (x: number | number[], y: number | number[]) => ({
  kind: "point",
  x,
  y,
});
const a = pt([3, 4], [4, 3]);

describe("point values", () => {
  it("parses points and lists of points", () => {
    expect(run("(3,4)")).toEqual(pt(3, 4));
    expect(run("[(3,4),(4,3)]")).toEqual(a);
    expect(run("(1+1,2^2)")).toEqual(pt(2, 4));
  });
  it("broadcasts a number against a list inside a point", () => {
    expect(run("(1,[1,2])")).toEqual(pt([1, 1], [1, 2]));
  });
  it("does not mistake calls and products for points", () => {
    expect(run("join([1],[2,3])")).toEqual([1, 2, 3]);
    expect(run("2(3)")).toBe(6);
    expect(run("2(3,4)")).toEqual(pt(6, 8));
  });
  it("takes mean, total and length of a list of points", () => {
    expect(run("mean(a)", { a })).toEqual(pt(3.5, 3.5));
    expect(run("total(a)", { a })).toEqual(pt(7, 7));
    expect(run("length(a)", { a })).toBe(2);
    expect(run("count(a)", { a })).toBe(2);
  });
  it("reads .x, .y and indexes lists of points", () => {
    expect(run("a.x", { a })).toEqual([3, 4]);
    expect(run("a.y", { a })).toEqual([4, 3]);
    expect(run("a[2]", { a })).toEqual(pt(4, 3));
    expect(run("a[[2,1]]", { a })).toEqual(pt([4, 3], [3, 4]));
    expect(run("a[1...2]", { a })).toEqual(a);
    expect(run("a[3]", { a })).toEqual(pt(NaN, NaN));
    expect(run("(5,6).x")).toBe(5);
  });
  it("does arithmetic on points", () => {
    expect(run("a+(1,1)", { a })).toEqual(pt([4, 5], [5, 4]));
    expect(run("(1,1)+a", { a })).toEqual(pt([4, 5], [5, 4]));
    expect(run("2a", { a })).toEqual(pt([6, 8], [8, 6]));
    expect(run("a/2", { a })).toEqual(pt([1.5, 2], [2, 1.5]));
    expect(run("a-a", { a })).toEqual(pt([0, 0], [0, 0]));
    expect(run("-a", { a })).toEqual(pt([-3, -4], [-4, -3]));
    expect(run("(1,2)*[1,2]")).toEqual(pt([1, 2], [2, 4]));
  });
  it("computes distance and midpoint", () => {
    expect(run("distance((0,0),(3,4))")).toBe(5);
    expect(run("midpoint((0,0),(3,4))")).toEqual(pt(1.5, 2));
    expect(run("distance(a,(0,0))", { a })).toEqual([5, 5]);
    expect(run("midpoint(a,(0,0))", { a })).toEqual(pt([1.5, 2], [2, 1.5]));
    expect(run("distance(P,Q)", { P: pt(1, 1), Q: pt(4, 5) })).toBe(5);
  });
  it("joins point lists", () => {
    expect(run("join(a,(5,5))", { a })).toEqual(pt([3, 4, 5], [4, 3, 5]));
  });
  it("rejects what is not defined for points", () => {
    expect(() => run("min(a)", { a })).toThrow(/not defined for points/);
    expect(() => run("a*a", { a })).toThrow(/not defined for points/);
    expect(() => run("a+1", { a })).toThrow(/points/);
    expect(() => run("sin(a)", { a })).toThrow(/not defined for points/);
    expect(() => run("distance(1,2)")).toThrow(/two points/);
    expect(() => run("[(1,2),3]")).toThrow(/mix/);
    expect(() => scalar("(1,2)").value({}, {}, "radians")).toThrow(/point/);
    expect(() => run("a.z", { a })).toThrow();
  });
  it("round-trips through the editor text", () => {
    for (const source of [
      "a=[(3,4),(4,3)]",
      "distance((0,0),(3,4))",
      "midpoint(P,Q)",
      "a.x",
      "mean(a)",
    ])
      expect(latexToText(textToLatex(source)).replace(/\s/g, "")).toBe(source);
  });
});

import { calculateWorkspace } from "../src/calculator/workspace";
import { emptyCalculator, newExpression } from "../src/calculator/model";

const sheet = (...rows: string[]) => {
  const w = calculateWorkspace({
    ...emptyCalculator(),
    entries: rows.map(newExpression),
  });
  return { results: Object.values(w.results), graphs: w.graphs };
};

describe("point variables in the workspace", () => {
  it("defines and plots a point variable", () => {
    const { results, graphs } = sheet("a=(3,4)");
    expect(results[0].error).toBeUndefined();
    expect(results[0].pointValue).toEqual(pt(3, 4));
    expect(graphs).toMatchObject([
      { kind: "points", points: [{ x: 3, y: 4 }] },
    ]);
  });
  it("mirrors the reference calculator list-of-points example", () => {
    const { results, graphs } = sheet("a=[(3,4),(4,3)]", "mean(a)");
    expect(results.map((r) => r.error)).toEqual([undefined, undefined]);
    expect(results[0].pointValue).toEqual(a);
    expect(results[1].pointValue).toEqual(pt(3.5, 3.5));
    expect(graphs).toHaveLength(2);
    expect(graphs[1]).toMatchObject({ points: [{ x: 3.5, y: 3.5 }] });
  });
  it("uses point variables in later rows, in any order", () => {
    const { results } = sheet(
      "distance(P,Q)",
      "P=(1,1)",
      "Q=(4,5)",
      "midpoint(P,Q)",
      "P+(1,1)",
      "a=[(3,4),(4,3)]",
      "a.x",
      "a[2]",
    );
    expect(results.map((r) => r.error)).toEqual(Array(8).fill(undefined));
    expect(results[0].value).toBe(5);
    expect(results[3].pointValue).toEqual(pt(2.5, 3));
    expect(results[4].pointValue).toEqual(pt(2, 2));
    expect(results[6].values).toEqual([3, 4]);
    expect(results[7].pointValue).toEqual(pt(4, 3));
  });
  it("keeps bare tuples working and fixes (a,b)+(1,1)", () => {
    const { results, graphs } = sheet("a=3", "b=4", "(a,b)", "(a,b)+(1,1)");
    expect(results.map((r) => r.error)).toEqual(Array(4).fill(undefined));
    expect(graphs.map((g) => g.kind)).toEqual(["points", "points"]);
  });
  it("explains misuse of points", () => {
    const { results } = sheet("P=(1,2)", "y=P", "P*P", "min([(1,2),(3,4)])");
    expect(results[1].error).toMatch(/point/i);
    expect(results[2].error).toMatch(/not defined for points/);
    expect(results[3].error).toMatch(/not defined for points/);
  });
});
