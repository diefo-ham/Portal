import { describe, expect, it } from "vitest";
import { calculateWorkspace } from "../src/calculator/workspace";
import { emptyCalculator, newExpression } from "../src/calculator/model";
import { solveFiniteSystem } from "../src/calculator/finiteSystems";
import { scalar } from "../src/calculator/math";
import { textToLatex } from "../src/calculator/latex";
import { interests } from "../src/calculator/numerics";

function workspace(...sources: string[]) {
  return Object.values(
    calculateWorkspace({
      ...emptyCalculator(),
      entries: sources.map(newExpression),
    }).results,
  );
}
const percentage = "[a,a,c] ~ [230% of b,60% of c,p% of b]";

describe("exact finite nonlinear SAT systems", () => {
  it("publishes a deterministic nondegenerate representative percentage fit", () => {
    const [result, p] = workspace(percentage, "p");
    expect(result.error).toBeUndefined();
    expect(result.systemKind).toBeUndefined();
    expect(result.parameters).toEqual({
      a: 2.3,
      b: 1,
      c: 23 / 6,
      p: 1150 / 3,
    });
    expect(result.fit?.rmse).toBe(0);
    expect(result.message).toBe(
      "Representative fit; parameters are not unique.",
    );
    expect(p.value).toBeCloseTo(1150 / 3, 12);
    expect(workspace(percentage)[0].parameters).toEqual(result.parameters);
  });

  it.each(["b>0", "b<0", "c>0", "a>1"])(
    "identifies p under the nonzero scale bound %s",
    (bound) => {
      const [result, p, sum] = workspace(`${percentage}{${bound}}`, "p", "a+b");
      expect(result.error).toBeUndefined();
      expect(result.systemKind).toBeUndefined();
      expect(result.parameters?.p).toBeCloseTo(1150 / 3, 10);
      expect(result.parameters?.b).not.toBe(0);
      expect(result.message).toContain("Representative fit");
      expect(result.fit?.rmse).toBe(0);
      expect(p.value).toBeCloseTo(1150 / 3, 10);
      expect(sum.value).toBeCloseTo(
        result.parameters!.a + result.parameters!.b,
        12,
      );
    },
  );

  it("keeps the equivalent exact equation system as a rigorous free family", () => {
    const [first, second, third] = workspace("a=2.3b", "a=0.6c", "c=(p/100)b");
    for (const result of [first, second, third]) {
      expect(result.fit).toBeUndefined();
      expect(result.systemKind).toBe("underdetermined");
      expect(result.parameters).toEqual({});
      expect(result.message).toContain("free solution family");
    }
  });

  it("supports the actual syntax after structural editor round trips", () => {
    const entry = {
      ...newExpression(),
      latex: textToLatex(percentage + "{b>0}"),
    };
    const result = calculateWorkspace({
      ...emptyCalculator(),
      entries: [entry],
    }).results[entry.id];
    expect(result.error).toBeUndefined();
    expect(result.parameters?.p).toBeCloseTo(1150 / 3, 10);
  });

  it("reuses standalone parameter inequalities as system constraints", () => {
    const [result, bound, p] = workspace(percentage, "b>0", "p");
    expect(result.parameters?.p).toBeCloseTo(1150 / 3, 10);
    expect(bound.message).toContain("Restriction applied");
    expect(p.value).toBeCloseTo(1150 / 3, 10);
    const [product] = workspace("a+b=5", "ab=6", "a<2.5");
    expect(product.solutions).toEqual([{ a: 2, b: 3 }]);
  });

  it("fits inclusive bounds and can select the constrained degenerate branch", () => {
    const [inclusive] = workspace(percentage + "{b>=0}");
    expect(inclusive.parameters?.b).toBe(1);
    expect(inclusive.fit?.rmse).toBe(0);
    const [onlyZero] = workspace(percentage + "{p<380}");
    expect(onlyZero.parameters).toEqual({ a: 0, c: 0, b: 0, p: 1 });
    expect(onlyZero.message).toContain("Representative fit");
  });

  it("recognizes when propagated bounds collapse a family to one vector", () => {
    const [result] = workspace("a+b=0{a>=1}{b>=-1}");
    expect(result.systemKind).toBe("determined");
    expect(result.solutions).toEqual([{ a: 1, b: -1 }]);
  });

  it("solves literal nonlinear vectors without treating numeric targets as noisy data", () => {
    const [result] = workspace("[a+b,a*b]~[5,6]");
    expect(result.solutions).toEqual([
      { a: 2, b: 3 },
      { a: 3, b: 2 },
    ]);
    expect(result.fit).toBeUndefined();
  });

  it("finds both ordered product/sum solutions and invariant derived quantities", () => {
    const [first, second, sum, a] = workspace("a+b=5", "ab=6", "a+b", "a");
    for (const result of [first, second]) {
      expect(result.error).toBeUndefined();
      expect(result.systemKind).toBe("multiple");
      expect(result.solutions).toEqual([
        { a: 2, b: 3 },
        { a: 3, b: 2 },
      ]);
      expect(result.parameters).toEqual({});
    }
    expect(sum.value).toBe(5);
    expect(a.values).toEqual([2, 3]);
  });

  it("supports a square combined with a linear relation", () => {
    const [result] = workspace("a+b=7", "a^2+b^2=25");
    expect(result.solutions).toEqual([
      { a: 3, b: 4 },
      { a: 4, b: 3 },
    ]);
    const [unique] = workspace("a+b=7", "a^2+b^2=25{a<3.5}");
    expect(unique.systemKind).toBe("determined");
    expect(unique.solutions).toEqual([{ a: 3, b: 4 }]);
  });

  it("supports named constants and acyclic definitions during elimination", () => {
    const [, , result] = workspace("k=6", "s=a+b", "s=5", "a*b=k");
    // A duplicate definition stays a duplicate; use the named expression as a
    // relation operand rather than redefining it.
    expect(result.error).toContain("Duplicate");
    const results = workspace("k=6", "s=a+b", "s+0=5", "a*b=k");
    expect(results[2].solutions).toEqual([
      { a: 2, b: 3 },
      { a: 3, b: 2 },
    ]);
  });

  it("solves explicit parameter equations, including duplicate left sides", () => {
    const results = workspace("a=2.3b", "a=0.6c", "c=(p/100)b{b>0}", "p");
    expect(results.slice(0, 3).every((r) => r.systemKind === "partial")).toBe(
      true,
    );
    expect(results[3].value).toBeCloseTo(1150 / 3, 10);
  });

  it("reports a truly variable parameter without choosing arbitrary family values", () => {
    const [result, a, sum] = workspace("a+b=5", "a", "a+b");
    expect(result.systemKind).toBe("underdetermined");
    expect(result.parameters).toEqual({});
    expect(a.message).toContain("not uniquely determined");
    expect(sum.value).toBe(5);
  });

  it("retains degenerate product branches instead of dividing them away", () => {
    const [result, , b] = workspace("a*b=0", "a+b=0", "b");
    expect(result.solutions).toEqual([{ a: 0, b: 0 }]);
    expect(b.value).toBe(0);
    const [family] = workspace("a*b=0");
    expect(family.systemKind).toBe("underdetermined");
    expect(family.parameters).toEqual({});
  });

  it("checks rational denominators against every branch", () => {
    const [result] = workspace("a/b=2", "a+b=6");
    expect(result.solutions).toEqual([{ a: 4, b: 2 }]);
    const [impossible] = workspace("a/b=2", "a+b=0");
    expect(impossible.error).toContain("No real solution");
    const [zero] = workspace(percentage + "{b>=0}{b<=0}");
    expect(zero.parameters).toEqual({ a: 0, b: 0, c: 0, p: 1 });
    expect(zero.systemKind).toBeUndefined();
    const [, ratio] = workspace(percentage + "{b>0}", "a/b");
    expect(ratio.value).toBe(2.3);
    const [negativePower] = workspace("a^(-1)=b", "a+b=2.5");
    expect(negativePower.solutions).toEqual([
      { a: 0.5, b: 2 },
      { a: 2, b: 0.5 },
    ]);
    const [ratioFamily, ratioQuery] = workspace("a/b=2", "a/b");
    expect(ratioFamily.systemKind).toBe("underdetermined");
    expect(ratioQuery.value).toBe(2);
  });

  it("does not invent zero pivots from tiny nonzero coefficients", () => {
    const [result] = workspace("0.000000000001a+b=1", "b=0*a");
    expect(result.solutions).toEqual([{ a: 1e12 }]);
  });

  it("eliminates a coupled circle/product system and preserves all four ordered pairs", () => {
    const [result] = workspace("a^2+b^2=25", "a*b=12");
    expect(result.error).toBeUndefined();
    expect(result.systemKind).toBe("multiple");
    expect(result.solutions).toEqual([
      { a: -4, b: -3 },
      { a: -3, b: -4 },
      { a: 3, b: 4 },
      { a: 4, b: 3 },
    ]);
    const [positive] = workspace("a^2+b^2=25", "ab=12", "a>0");
    expect(positive.solutions).toEqual([
      { a: 3, b: 4 },
      { a: 4, b: 3 },
    ]);
  });

  it("does not claim an inconsistent system is a least-squares solution", () => {
    const [result] = workspace("a+b=5", "a*b=6", "a+b=8");
    expect(result.error).toContain("No real solution");
    const [close] = workspace("a^2=2", "a^2=2.0000000001");
    expect(close.error).toContain("No real solution");
    expect(() =>
      solveFiniteSystem(
        [
          { left: scalar("a^2"), right: scalar("2") },
          { left: scalar("b^2"), right: scalar("2") },
          { left: scalar("b^2"), right: scalar("2.0000000001") },
        ],
        ["a", "b"],
        {},
        "radians",
      ),
    ).toThrow("No real solution");
    const [common] = workspace("a^2=2", "a^4=4");
    expect(common.solutions).toHaveLength(2);
    expect(common.solutions?.[1].a).toBeCloseTo(Math.sqrt(2), 12);
  });

  it("can find invariants of a free polynomial family algebraically", () => {
    const solved = solveFiniteSystem(
      [{ left: scalar("a+b"), right: scalar("5") }],
      ["a", "b"],
      {},
      "radians",
    );
    expect(solved.quantity(scalar("(a+b)^2"))).toEqual({ value: 25 });
    expect(solved.quantity(scalar("a^2"))).toEqual({});
  });

  it("resolves scalar parameters published by an earlier relation", () => {
    const [, result] = workspace("k~5", "[a+b,a*b]~[k,6]");
    expect(result.solutions).toEqual([
      { a: 2, b: 3 },
      { a: 3, b: 2 },
    ]);
  });

  it("distinguishes unsupported quantity reduction from proven nonidentifiability", () => {
    const [, result] = workspace("a+b=5", "sin(a+b)");
    expect(result.message).toContain("unsupported algebraic reduction");
  });
});

describe("bounded coupled two-variable elimination", () => {
  function solve(...equations: string[]) {
    return solveFiniteSystem(
      equations.map((source) => {
        const [left, right] = source.split("=");
        return { left: scalar(left), right: scalar(right) };
      }),
      ["x", "y"],
      {},
      "radians",
    );
  }

  it("finds both irrational line/quadratic intersections and verifies the original equations", () => {
    const solved = solve("y=x+1", "y=x^2-3");
    expect(solved.kind).toBe("multiple");
    expect(solved.solutions).toHaveLength(2);
    for (const [i, sign] of [-1, 1].entries()) {
      const p = solved.solutions![i];
      expect(p.x).toBeCloseTo((1 + sign * Math.sqrt(17)) / 2, 12);
      expect(p.y).toBeCloseTo(p.x + 1, 12);
      expect(p.y).toBeCloseTo(p.x * p.x - 3, 12);
    }
    const circle = solve("x^2+y^2=25", "y=2x+1");
    expect(circle.solutions).toHaveLength(2);
    for (const p of circle.solutions!) {
      expect(p.x * p.x + p.y * p.y).toBeCloseTo(25, 10);
      expect(p.y).toBeCloseTo(2 * p.x + 1, 12);
    }
  });

  it("back-substitutes into both quadratics without exact-GCDing approximate fibers", () => {
    const solved = solve("x^2+y^2=5", "2x^2+3y^2=13");
    expect(solved.solutions).toHaveLength(4);
    for (const p of solved.solutions!) {
      expect(p.x * p.x).toBeCloseTo(2, 12);
      expect(p.y * p.y).toBeCloseTo(3, 12);
    }
    expect(solve("x^2+y^2=2", "x*y=1").solutions).toEqual([
      { x: -1, y: -1 },
      { x: 1, y: 1 },
    ]);
  });

  it("rejects nonreal fibers and reports supported empty real intersections", () => {
    expect(() => solve("x^2+y^2=1", "x*y=1")).toThrow("No real solution");
    expect(() => solve("y=x^2+1", "y=-1")).toThrow("No real solution");
    expect(() => solve("x^2+y^2=-1", "2x^2+2y^2=-2")).toThrow(
      "No real solution",
    );
  });

  it("distinguishes conic families, empty conics and isolated real points", () => {
    const family = solve("x^2+y^2=25", "2x^2+2y^2=50");
    expect(family.kind).toBe("underdetermined");
    expect(family.solutions).toBeUndefined();
    expect(family.parameters).toEqual({});
    expect(family.message).toContain("free solution family");
    expect(solve("y=x^2", "2y=2x^2").kind).toBe("underdetermined");
    expect(solve("x^2+y^2=0", "2x^2+2y^2=0").solutions).toEqual([
      { x: 0, y: 0 },
    ]);
    expect(solve("(x-1)^2+(y-2)^2=0").solutions).toEqual([{ x: 1, y: 2 }]);
  });

  it("discards denominator-zero artifacts while retaining valid branches", () => {
    const solved = solve("(x^2+y^2-25)/(x-3)=0", "x*y=12");
    expect(solved.solutions).toEqual([
      { x: -4, y: -3 },
      { x: -3, y: -4 },
      { x: 4, y: 3 },
    ]);
    // An irrational pole has only an approximate zero after root isolation.
    expect(() => solve("(x^2+y^2-5)/(x^2-2)=0", "2x^2+3y^2=13")).toThrow(
      "No real solution",
    );
    expect(solve("(x^2+y^2-25)/(x-100)=0", "x*y=12").solutions).toHaveLength(4);
  });

  it("keeps leading-coefficient degeneracies and repeated eliminant roots", () => {
    const solved = solve("x*y+y^2=0", "x*y+x^2=0");
    // Common-variable splitting exposes the shared line, including the origin.
    expect(solved.kind).toBe("underdetermined");
    // A resultant also vanishes at x=1 because both leading coefficients
    // disappear there, but the second original equation then reads 1=0.
    expect(solve("(x-1)*y^2+y+1=0", "(x-1)*y+x=0").solutions).toEqual([
      { x: -1, y: -0.5 },
    ]);
  });

  it("fails explicitly outside bounded degree, variable and numeric-range limits", () => {
    expect(() => solve("x^4*y+y^2=1", "x*y^4+x^2=1")).toThrow(
      "bounded elimination",
    );
    expect(() => solve("sin(x)+y=1", "x*y=2")).toThrow("bounded elimination");
    expect(() => solve("x^3+y^3=1e30", "x*y=1")).toThrow("bounded elimination");
  });

  it("returns viewport-independent coordinate solutions and consistent graph inspection points", () => {
    const state = {
      ...emptyCalculator(),
      entries: [newExpression("x^2+y^2=25"), newExpression("xy=12")],
    };
    const calculated = calculateWorkspace(state);
    const result = calculated.results[state.entries[0].id];
    expect(result.solutions).toEqual([
      { x: -4, y: -3 },
      { x: -3, y: -4 },
      { x: 3, y: 4 },
      { x: 4, y: 3 },
    ]);
    expect(calculated.graphs).toHaveLength(2);
    expect(
      interests(calculated.graphs, {
        xMin: -10,
        xMax: 10,
        yMin: -10,
        yMax: 10,
      }).filter((p) => p.label.includes("intersection")),
    ).toHaveLength(4);
    const distant = calculateWorkspace({
      ...state,
      view: { xMin: 100, xMax: 110, yMin: 100, yMax: 110 },
    });
    expect(distant.results[state.entries[0].id].solutions).toEqual(
      result.solutions,
    );
    const [line] = workspace("y=x+1", "y=x^2-3");
    expect(line.solutions).toHaveLength(2);
    const [bounded] = workspace("x^2+y^2=25", "xy=12", "x>0");
    expect(bounded.solutions).toHaveLength(2);
    const restrictedGraphs = calculateWorkspace({
      ...emptyCalculator(),
      entries: [
        newExpression("y=x+1"),
        newExpression("y=x^2-3"),
        newExpression("x>0"),
      ],
    }).graphs;
    const intersections = interests(restrictedGraphs, {
      xMin: -10,
      xMax: 10,
      yMin: -10,
      yMax: 10,
    }).filter(
      (p) =>
        p.label.includes("intersection") &&
        p.graphIds.length === 2 &&
        p.graphIds.every(
          (id) => restrictedGraphs.findIndex((g) => g.id === id) < 2,
        ),
    );
    expect(intersections).toHaveLength(1);
    expect(intersections[0].x).toBeGreaterThan(0);
  });
});

describe("finite-system regression compatibility", () => {
  it("keeps ordinary table regression and polynomial regression statistical", () => {
    const state = emptyCalculator();
    state.entries = [
      {
        id: "table",
        type: "table",
        rows: [
          ["1", "4"],
          ["2", "7"],
          ["3", "10"],
        ],
        fit: "none",
      },
      { ...newExpression("y_1~m*x_1+b"), id: "line" },
    ];
    const result = calculateWorkspace(state).results.line;
    expect(result.relationKind).toBe("data");
    expect(result.systemKind).toBeUndefined();
    expect(result.parameters?.m).toBeCloseTo(3, 12);
    expect(result.parameters?.b).toBeCloseTo(1, 12);
    const [, , polynomial] = workspace(
      "x_1=[0,1,2,3]",
      "y_1=[1,6,17,34]",
      "y_1~a*x_1^2+b*x_1+c",
    );
    expect(polynomial.relationKind).toBe("data");
    expect(polynomial.parameters?.a).toBeCloseTo(3, 12);
    expect(polynomial.parameters?.b).toBeCloseTo(2, 12);
    expect(polynomial.parameters?.c).toBeCloseTo(1, 12);
  });

  it("keeps constrained noisy regression and affine numeric list fitting", () => {
    const [, , constrained] = workspace(
      "x_1=[1,2,3]",
      "y_1=[3,2,1]",
      "y_1~m*x_1+b{m>=0}",
    );
    expect(constrained.parameters).toEqual({ m: 0, b: 2 });
    expect(constrained.relationKind).toBe("data");
    const [list] = workspace("[1,2,4]~[a,a+b,a+2b]");
    expect(list.systemKind).toBeUndefined();
    expect(list.parameters?.a).toBeCloseTo(5 / 6, 12);
    expect(list.parameters?.b).toBeCloseTo(1.5, 12);
    expect(list.fit?.rmse).toBeGreaterThan(0);
    const [, , nonlinearData] = workspace(
      "x_1=[1,2,3]",
      "y_1=[2,4,9]",
      "y_1~a*b^x_1+c",
    );
    // Not linear in b, so it is fitted numerically; these three points are matched exactly.
    expect(nonlinearData.error).toBeUndefined();
    expect(nonlinearData.fit?.rmse).toBeCloseTo(0, 6);
    expect(nonlinearData.parameters?.b).toBeCloseTo(2.5, 6);
    expect(nonlinearData.systemKind).toBeUndefined();
  });
});

describe("subscripted unknowns", () => {
  const run = workspace;
  it("solves the repeated-root the reference calculator regression with x_1 and y_1", () => {
    const [a, b, c] = run(
      "x^2+y+7=7",
      "20x+100-y=0",
      "[x_1^2+y_1+7,20x_1+100-y_1]~[7,0]",
    );
    expect(a.error).toBeUndefined();
    expect(b.parameters).toEqual({ x: -10, y: -100 });
    expect(c.error).toBeUndefined();
    expect(c.parameters).toEqual({ x_1: -10, y_1: -100 });
    expect(c.fit?.rmse).toBe(0);
    expect(c.fit?.residuals).toEqual([0, 0]);
  });
  it("solves it alone and keeps multiple solutions as a system", () => {
    const [alone] = run("[x_1^2+y_1+7,20x_1+100-y_1]~[7,0]");
    expect(alone.parameters).toEqual({ x_1: -10, y_1: -100 });
    const [two] = run("[x_1*y_1,x_1+y_1]~[6,5]");
    expect(two.solutions).toEqual([
      { x_1: 2, y_1: 3 },
      { x_1: 3, y_1: 2 },
    ]);
    expect(two.fit).toBeUndefined();
  });
});
