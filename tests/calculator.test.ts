import { describe, it, expect } from "vitest";
import { scalar, scalarTex } from "../src/calculator/math";
import {
  emptyCalculator,
  newExpression,
  defaultView,
  validateCalculator,
  validateDesmosState,
  type CalculatorState,
} from "../src/calculator/model";
import { calculateWorkspace } from "../src/calculator/workspace";
import {
  roots,
  sampleFunction,
  interests,
  implicitSegments,
  equalScaleViewport,
  nearestInterestInPixels,
} from "../src/calculator/numerics";
import { regression, customRegression } from "../src/calculator/regression";
import {
  displayedCoefficients,
  fittedExpression,
} from "../src/calculator/fitDisplay";
import {
  rational,
  exactForm,
  coordinateForm,
  radicalForm,
} from "../src/calculator/exact";
import { parsePastedData } from "../src/calculator/TableEditor";
import { emptyData } from "../src/core/model";
import { parseBackup } from "../src/importing/backup";
import { createSession } from "../src/core/practice";
import sample from "./fixtures/synthetic.json";
import { parseQuestions } from "../src/importing/json";
import { latexToText, textToLatex } from "../src/calculator/latex";
import {
  clampGeometry,
  defaultGeometry,
} from "../src/calculator/windowGeometry";

const evaluate = (s: string, angle: "radians" | "degrees" = "radians") =>
  scalar(s).value({}, {}, angle);

describe("Focused Calculator correctness regressions", () => {
  it("multiplies coordinate parentheses and preserves named calls and scalar identifiers", () => {
    const expression = scalar("8x(x^9-x^8+11)");
    expect([...expression.calls]).toEqual([]);
    expect(expression.value({ x: 2 }, {}, "radians")).toBe(
      8 * 2 * (2 ** 9 - 2 ** 8 + 11),
    );
    expect(scalar("y(y+1)").value({ y: 3 }, {}, "radians")).toBe(12);
    expect(scalar("a x(x+1)").value({ a: 2, x: 3 }, {}, "radians")).toBe(24);
    expect([...scalar("foo2x(2)").calls]).toEqual(["foo2x"]);
    for (const source of ["b c", "bc"]) {
      for (const latex of [false, true]) {
        const entries = ["b=4", "c=-6", source].map((text) => ({
          ...newExpression(text),
          ...(latex ? { latex: textToLatex(text) } : {}),
        }));
        const w = calculateWorkspace({ ...emptyCalculator(), entries });
        expect(Object.values(w.results).at(-1)?.value).toBe(-24);
      }
    }
    const w = workspace(
      "b=4",
      "c=-6",
      "bc=7",
      "f(x)=x^2",
      "g(t)=f(t)+bc",
      "g(3)",
    );
    expect(Object.values(w.results).at(-1)?.value).toBe(16);
    expect(
      Object.values(workspace("b=4", "c=-6", "bc(t)=t+1", "bc(3)").results).at(
        -1,
      )?.value,
    ).toBe(4);
    expect(
      Object.values(workspace("f(x)=x", "g(t)=t", "fg").results).at(-1)?.error,
    ).toContain("Define fg");
    expect(scalar("sin(0)+mean([2,4])").value({}, {}, "radians")).toBe(3);
  });

  it.each([10, 100, 1000, 10000, 1000000])(
    "retains visible high-growth crossings at x range ±%s within the sample budget",
    (range) => {
      let evaluations = 0;
      const paths = sampleFunction(
        (x) => {
          evaluations++;
          return 52 * (x ** 3 + 64) * (x ** 4 - 81);
        },
        { xMin: -range, xMax: range, yMin: -range, yMax: range },
        640,
        400,
      );
      const points = paths.flat();
      for (const root of [-4, -3, 3]) {
        expect(
          paths.some((path) =>
            path.slice(1).some((b, i) => {
              const a = path[i];
              if (a.y === b.y) return a.y === 0 && a.x <= root && b.x >= root;
              const t = -a.y / (b.y - a.y);
              return (
                t >= 0 &&
                t <= 1 &&
                Math.abs(a.x + t * (b.x - a.x) - root) <
                  Math.max(0.01, range / 640)
              );
            }),
          ),
          `visible crossing near ${root}`,
        ).toBe(true);
      }
      expect(evaluations).toBeLessThanOrEqual(640 * 7);
      expect(
        points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
      ).toBe(true);
    },
  );

  it("does not let overflowing offscreen samples erase a finite visible transition", () => {
    let evaluations = 0;
    const paths = sampleFunction(
      (x) => {
        evaluations++;
        return x ** 100;
      },
      { xMin: -1e6, xMax: 1e6, yMin: -10, yMax: 10 },
    );
    expect(paths.flat().some((p) => p.x > 0 && p.y > 0 && p.y <= 10)).toBe(
      true,
    );
    expect(paths.flat().some((p) => p.x < 0 && p.y > 0 && p.y <= 10)).toBe(
      true,
    );
    expect(evaluations).toBeLessThanOrEqual(640 * 7);
  });

  it("exports polynomial coefficient products without dots and preserves fitted values", () => {
    const fit = regression(
      [
        { x: -1, y: -8 },
        { x: 0, y: -6 },
        { x: 1, y: 0 },
        { x: 2, y: 10 },
      ],
      "quadratic",
    );
    const source = fittedExpression(fit);
    expect(source).toBe("2x^2+4x-6");
    expect(textToLatex(source)).not.toContain("\\cdot");
    expect(
      scalar(latexToText(textToLatex(source))).value({ x: 3 }, {}, "radians"),
    ).toBeCloseTo(fit.predict(3), 12);
  });
});

describe("Offline expression domain restrictions", () => {
  const curve = (source: string, ...definitions: string[]) => {
    const w = workspace(...definitions, source);
    expect(
      Object.values(w.results).filter((r) => r.error),
      source,
    ).toEqual([]);
    const graph = w.graphs.at(-1)!;
    if (graph.kind !== "function") throw new Error("Expected explicit curve");
    return graph.fn;
  };

  it("parses required named, equation and direct-expression forms structurally", () => {
    for (const source of [
      "f(x)=x{x>2}",
      "y=x^2{x<=3}",
      "y=sqrt(x){x>=0}",
      "y=x{1<x<5}",
      "f(x)=2x+1{-3<=x<=4}",
      "x{x>2}",
    ]) {
      expect(Number.isFinite(curve(source)(3))).toBe(true);
      expect(curve(latexToText(textToLatex(source)))(3)).toBe(curve(source)(3));
    }
    const s = scalar("2x+1{-3<=x<=4}");
    expect(s.node.type).toBe("ConditionalNode");
    expect([...s.symbols]).toEqual(["x"]);
    expect(scalarTex(s)).toContain("\\left\\{");
  });

  it("rejects malformed/unsafe restrictions with a useful error", () => {
    for (const suffix of [
      "{}",
      "{x>}",
      "{x>2",
      "{x=2}",
      "{1<x<}",
      "{x>2}junk",
      "{x>2,}",
      "{x>2}{",
      "{x>unknown.a}",
      "{x>2;x=1}",
    ])
      expect(
        Object.values(workspace(`f(x)=x${suffix}`).results)[0].error,
      ).toMatch(/restriction/i);
  });

  it("evaluates open/closed bounds, chained intervals and nonfinite conditions", () => {
    const open = curve("f(x)=x{x>2}");
    expect(open(3)).toBe(3);
    expect(open(10)).toBe(10);
    expect(open(2)).toBeNaN();
    expect(open(1)).toBeNaN();
    expect(curve("y=x{x>=2}")(2)).toBe(2);
    expect(curve("y=x^2{x<=3}")(3)).toBe(9);
    expect(curve("y=x^2{x<=3}")(4)).toBeNaN();
    const interval = curve("f(x)=2x+1{-3<=x<=4}");
    expect(interval(-3)).toBe(-5);
    expect(interval(4)).toBe(9);
    expect(interval(-3.01)).toBeNaN();
    expect(interval(4.01)).toBeNaN();
    const strict = curve("y=x{1<x<5}");
    expect(strict(1)).toBeNaN();
    expect(strict(5)).toBeNaN();
    expect(strict(2)).toBe(2);
    expect(curve("y=x{x>sqrt(-1)}")(2)).toBeNaN();
    expect(curve("y=x{mod(x,2)>=1,x<5}")(3)).toBe(3);
    expect(curve("y=x{mod(x,2)>=1}{x<5}")(2)).toBeNaN();
  });

  it("tracks constants and restriction-only dependencies after edits", () => {
    const state = {
      ...emptyCalculator(),
      entries: [
        newExpression("a=3"),
        newExpression("f(x)=x{x>a}"),
        newExpression("f(3)"),
      ],
    };
    let w = calculateWorkspace(state);
    expect(Object.values(w.results)[2].error).toContain("Undefined");
    state.entries[0].text = "a=2";
    w = calculateWorkspace(state);
    expect(Object.values(w.results)[2].value).toBe(3);
    expect(curve("f(x)=x{x<k}", "k=4")(4)).toBeNaN();
    expect(curve("f(x)=x{x<k}", "k=5")(4)).toBe(4);
    expect(curve("f(t)=t{t>a}", "a=3")(4)).toBe(4);
    expect(curve("f(x)=x{h(x)>0}", "h(t)=t-2")(1)).toBeNaN();
    for (const definitions of [
      ["a=f(3)", "f(x)=x{x>a}"],
      ["f(x)=x{g(x)>0}", "g(t)=f(t)"],
    ])
      expect(
        Object.values(workspace(...definitions).results).every((r) =>
          r.error?.includes("Circular"),
        ),
      ).toBe(true);
  });

  it("propagates undefined values through downstream functions and expression expansion", () => {
    const fn = curve("g(x)=f(x)+1", "f(x)=x^2{x>0}");
    expect(fn(2)).toBe(5);
    expect(fn(0)).toBeNaN();
    expect(fn(-2)).toBeNaN();
    const w = workspace(
      "f(x)=x{x>2}",
      "g(x)=f(x)^0+1",
      "g(1)",
      "g(3)",
      "f(c)~3{c>0}",
    );
    expect(Object.values(w.results)[2].error).toContain("Undefined");
    expect(Object.values(w.results)[3].value).toBe(2);
    expect(Object.values(w.results)[4].solutions?.[0].c).toBeCloseTo(3, 8);
  });

  it("samples valid domains, keeps disconnected regions separate and retains curve health", () => {
    for (const [source, valid] of [
      ["y=x{x>2}", (x: number) => x > 2],
      ["y=x^2{-3<x<3}", (x: number) => x > -3 && x < 3],
      ["y=sqrt(x){x>=1}", (x: number) => x >= 1],
      ["y=x{x^2>1}", (x: number) => Math.abs(x) > 1],
    ] as const) {
      const fn = curve(source);
      const paths = sampleFunction(fn, defaultView());
      expect(paths.flat().length).toBeGreaterThan(20);
      expect(paths.flat().every((p) => valid(p.x) && p.y === fn(p.x))).toBe(
        true,
      );
      if (source.includes("x^2>1")) {
        expect(paths).toHaveLength(2);
        expect(
          paths.every(
            (path) => path.every((p) => p.x < -1) || path.every((p) => p.x > 1),
          ),
        ).toBe(true);
      }
    }
    const paths = sampleFunction(curve("y=1/x{x^2<9}"), defaultView());
    expect(
      paths.every((p) => p.every((v) => v.x < 0) || p.every((v) => v.x > 0)),
    ).toBe(true);
    for (const source of [
      "y=100000(x-2.5){x>2}",
      "y=10000(x-2.137)^2{x>0}",
      "y=sqrt(x){x>=1}",
    ])
      expect(
        sampleFunction(curve(source), {
          xMin: -10,
          xMax: 10,
          yMin: -10,
          yMax: 10,
        }).flat().length,
      ).toBeGreaterThan(0);
  });

  it("omits excluded intercepts, roots and intersections from inspection", () => {
    const w = workspace("y=x{x>2}", "y=1", "x=1", "y=4");
    const restricted = w.graphs[0];
    const points = interests(w.graphs, defaultView()).filter((p) =>
      p.graphIds.includes(restricted.id),
    );
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ x: 4, y: 4, label: "intersection" });
    expect(interests(workspace("y=x^2{x>0}").graphs, defaultView())).toEqual(
      [],
    );
    expect(
      interests(workspace("y=x^2{x>=0}").graphs, defaultView()),
    ).toContainEqual(expect.objectContaining({ x: 0, y: 0 }));
  });

  it("keeps solver and regression braces as parameter bounds alongside domain expressions", () => {
    const w = workspace(
      "f(x)=x{x>2}",
      "n^2~4{n>0}",
      "x_1=[1,2,3]",
      "y_1=[3,2,1]",
      "y_1~mx_1+b{m>=0}",
    );
    expect(Object.values(w.results).filter((r) => r.error)).toEqual([]);
    expect(Object.values(w.results)[1].solutions).toEqual([{ n: 2 }]);
    expect(Object.values(w.results)[4].parameters).toEqual({ m: 0, b: 2 });
    expect(curve("f(x)=x{x>2}")(1)).toBeNaN();
  });
});
const workspace = (...texts: string[]) =>
  calculateWorkspace({
    ...emptyCalculator(),
    entries: texts.map((t) => newExpression(t)),
  });
describe("Offline expression semantics", () => {
  it("evaluates range ASTs, inferred steps and descending lists like Desmos", () => {
    const list = (source: string) => scalar(source).evaluate({}, {}, "radians");
    expect(list("[1...10]")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(list("[1...100]")).toHaveLength(100);
    expect(list("[1,3...11]")).toEqual([1, 3, 5, 7, 9, 11]);
    expect(list("[1,3...10]")).toEqual([1, 3, 5, 7, 9, 11]);
    expect(list("[1,3...9.1]")).toEqual([1, 3, 5, 7, 9]);
    expect(list("[5...1]")).toEqual([5, 4, 3, 2, 1]);
    expect(list("[5,3...1]")).toEqual([5, 3, 1]);
    expect(list("[1.5...4.5]")).toEqual([1.5, 2.5, 3.5, 4.5]);
    expect(list("[1,3,...,11]")).toEqual([1, 3, 5, 7, 9, 11]);
    expect(() => list("[1...1000000000]")).toThrow("200");
    expect(() => list("[1,1...5]")).toThrow("nonzero");
    expect(() => list("[5,4...8]")).toThrow("toward");
    for (const source of ["[1...10]", "[5...1]", "[1,3...11]"])
      expect(list(latexToText(textToLatex(source)))).toEqual(list(source));
    const w = workspace("a=2", "L=[a,a+2...10]", "L^2", "(L,L^2)");
    expect(Object.values(w.results)[2].values).toEqual([4, 16, 36, 64, 100]);
    expect(w.graphs[0]).toMatchObject({
      kind: "points",
      points: [
        { x: 2, y: 4 },
        { x: 4, y: 16 },
        { x: 6, y: 36 },
        { x: 8, y: 64 },
        { x: 10, y: 100 },
      ],
    });
    const fit = Object.values(
      workspace("x_1=[1...10]", "y_1=3x_1+2", "y_1~mx_1+b").results,
    ).find((result) => result.fit);
    expect(fit?.parameters?.m).toBeCloseTo(3, 10);
    expect(fit?.parameters?.b).toBeCloseTo(2, 10);
  });
  it("models transitive x-dependent names without caching a sample as a scalar", () => {
    for (const p of ["p=3x+4", "p=4x+1"]) {
      const w = workspace(p, "v=x+5", "pv-2p+v", "f(x)=pv-2p+v", "f(2)");
      expect(Object.values(w.results).every((result) => !result.error)).toBe(
        true,
      );
      const functions = w.graphs.filter((graph) => graph.kind === "function");
      expect(functions).toHaveLength(4);
      const pf = (x: number) => (p === "p=3x+4" ? 3 * x + 4 : 4 * x + 1);
      for (const x of [-2, 0, 2, 3]) {
        expect(functions[0].fn(x)).toBe(pf(x));
        expect(functions[1].fn(x)).toBe(x + 5);
        expect(functions[2].fn(x)).toBe(pf(x) * (x + 5) - 2 * pf(x) + x + 5);
        expect(functions[3].fn(x)).toBe(functions[2].fn(x));
      }
      expect(Object.values(w.results)[4].value).toBe(functions[2].fn(2));
    }
    expect(
      Object.values(workspace("a=2", "b=a+2", "b^2").results)[2].value,
    ).toBe(16);
    expect(
      Object.values(workspace("p=2", "v=3", "pv=7", "pv+1").results)[3].value,
    ).toBe(8);
    const chained = workspace("q=p+1", "p=3x+4", "q^2");
    expect(chained.graphs.filter((g) => g.kind === "function")[0].fn(2)).toBe(
      11,
    );
    const product = workspace("p=3x+4", "v=x+5", "2pv");
    expect(product.graphs.filter((g) => g.kind === "function")[2].fn(2)).toBe(
      140,
    );
    for (const sources of [["p=v+x", "v=p+2"], ["p=p+x"], ["f(x)=f(x)+1"]])
      expect(
        Object.values(workspace(...sources).results).some((result) =>
          result.error?.includes("Circular"),
        ),
      ).toBe(true);
    expect(Object.values(workspace("p=3x+a").results)[0]).toMatchObject({
      message: "Free parameters: a.",
    });
  });
  it("recognizes conservative small radical coordinates without guessing arbitrary decimals", () => {
    for (const [value, form] of [
      [Math.SQRT2 / 2, "√2/2"],
      [-Math.SQRT2 / 2, "−√2/2"],
      [Math.sqrt(3) / 2, "√3/2"],
      [-Math.sqrt(3) / 2, "−√3/2"],
      [Math.SQRT2, "√2"],
      [Math.sqrt(3), "√3"],
      [(3 * Math.sqrt(2)) / 4, "3√2/4"],
      [0.25, "1/4"],
      [Math.PI / 2, "π/2"],
    ] as const)
      expect(coordinateForm(value)).toBe(form);
    expect(radicalForm(0.7071)).toBeUndefined();
    expect(coordinateForm(0.1234567)).toBe("0.123457");
    expect(coordinateForm(1e-12)).toBe("1e-12");
    const source = "(sqrt(2)/2,-sqrt(3)/2)";
    const point = workspace(latexToText(textToLatex(source))).graphs[0];
    expect(point).toMatchObject({
      kind: "points",
      points: [{ x: Math.SQRT2 / 2, y: -Math.sqrt(3) / 2 }],
    });
    const productPoint = workspace("a=2", latexToText(textToLatex("(a,2a)")))
      .graphs[0];
    expect(productPoint).toMatchObject({
      kind: "points",
      points: [{ x: 2, y: 4 }],
    });
  });
});
describe("floating window bounds and parameter points", () => {
  it("solves scalar residual regressions without requiring table columns", () => {
    for (const [source, expected] of [
      ["8c~3", 0.375],
      ["8c~2", 0.25],
    ] as const) {
      const result = Object.values(workspace(source).results)[0];
      expect(result.error).toBeUndefined();
      expect(result.parameters?.c).toBeCloseTo(expected, 14);
      expect(result.fit?.rmse).toBeCloseTo(0, 14);
      expect(result.scalarRelation).toBe(true);
      expect(result.graphable).not.toBe(true);
    }
    expect(Object.values(workspace("a+b~3").results)[0].error).toContain(
      "too few residuals",
    );
    expect(Object.values(workspace("a*b~3").results)[0].error).toContain(
      "Underdetermined",
    );
    const table = workspace("x_1=[1,2,3]", "y_1=[4,7,10]", "y_1~m*x_1+b");
    const fit = Object.values(table.results).find((result) => result.fit);
    expect(fit?.parameters?.m).toBeCloseTo(3, 12);
    expect(fit?.parameters?.b).toBeCloseTo(1, 12);
  });
  it("uses forgiving deterministic screen-space POI hit testing", () => {
    const points = [
      { x: 0, y: 0, label: "zero", graphIds: ["a"] },
      { x: 0.1, y: 0, label: "nearby", graphIds: ["b"] },
    ];
    expect(
      nearestInterestInPixels(points, { x: 0, y: 0 }, 100, 100, 22)?.label,
    ).toBe("zero");
    expect(
      nearestInterestInPixels(points, { x: 0.06, y: 0 }, 100, 100, 22)?.label,
    ).toBe("nearby");
    expect(
      nearestInterestInPixels(points, { x: 0.35, y: 0 }, 100, 100, 22),
    ).toBeUndefined();
  });
  it("derives an equal-unit viewport from rectangular graph dimensions", () => {
    const wide = equalScaleViewport(defaultView(), 800, 400);
    expect(800 / (wide.xMax - wide.xMin)).toBeCloseTo(
      400 / (wide.yMax - wide.yMin),
      12,
    );
    expect(wide.xMin).toBe(-10);
    expect(wide.xMax).toBe(10);
    expect(wide.yMin).toBe(-5);
    expect(wide.yMax).toBe(5);
    const resized = equalScaleViewport(wide, 600, 400);
    expect(600 / (resized.xMax - resized.xMin)).toBeCloseTo(
      400 / (resized.yMax - resized.yMin),
      12,
    );
  });
  it("cleans exact quadratic presentation without modifying coefficients or tiny meaningful terms", () => {
    const fit = regression(
      [1, 2, 3, 4].map((x) => ({ x, y: x * x })),
      "quadratic",
    );
    const before = [...fit.coefficients];
    expect(fittedExpression(fit)).toBe("x^2");
    expect(displayedCoefficients(fit)).toEqual([0, 0, 1]);
    expect(fit.coefficients).toEqual(before);
    const tiny = regression(
      [1, 2, 3, 4].map((x) => ({ x, y: 1e-16 * x * x })),
      "quadratic",
    );
    expect(displayedCoefficients(tiny)[2]).toBeCloseTo(1e-16, 28);
    expect(displayedCoefficients(tiny)[2]).not.toBe(0);
    const largeX = regression(
      [1e6, 2e6, 3e6, 4e6].map((x) => ({ x, y: 1e-12 * x * x + 2 })),
      "quadratic",
    );
    expect(displayedCoefficients(largeX)[2]).not.toBe(0);
    expect(largeX.predict(5e6)).toBeCloseTo(27, 9);
  });
  it("solves custom affine-parameter models, with truthful residuals and nonlinear rejection", () => {
    const fit = customRegression(
      [0, 0.3, 0.7, 1.4, 2].map((x) => ({ x, y: 2 * Math.sin(x) + 3 })),
      "a*sin(x)+b",
      ["a", "b"],
      "radians",
    );
    expect(fit.coefficients[0]).toBeCloseTo(2, 11);
    expect(fit.coefficients[1]).toBeCloseTo(3, 11);
    expect(fit.r2).toBeCloseTo(1, 12);
    expect(fit.residuals.every((value) => Math.abs(value) < 1e-12)).toBe(true);
    expect(fit.predict(0.9)).toBeCloseTo(2 * Math.sin(0.9) + 3, 12);
    for (const model of ["a*exp(b*x_1)", "a*e^(b*x_1)"]) {
      const w = workspace(
        "x_1=[0,1,2,3]",
        `y_1=[${[0, 1, 2, 3].map((x) => 3 * Math.exp(0.5 * x)).join(",")}]`,
        `y_1~${model}`,
      );
      const result = Object.values(w.results).find((result) => result.fit);
      expect(result?.parameters?.a).toBeCloseTo(3, 6);
      expect(result?.parameters?.b).toBeCloseTo(0.5, 6);
    }
    // Models that are not linear in their parameters are fitted numerically.
    expect(
      customRegression(
        [
          { x: 1, y: 2 },
          { x: 2, y: 3 },
        ],
        "a*sin(b*x)",
        ["a", "b"],
        "radians",
      ).rmse,
    ).toBeCloseTo(0, 8);
    expect(() =>
      customRegression([{ x: 1, y: 2 }], "a*x+b", ["a", "b"], "radians"),
    ).toThrow();
    const w = workspace(
      "x_1=[0,0.3,0.7,1.4,2]",
      "y_1=[3,3.591040413322679,4.288435374475382,4.97089945997692,4.818594853651364]",
      "y_1~a*sin(x_1)+b",
    );
    expect(
      Object.values(w.results).find((result) => result.fit)?.parameters?.a,
    ).toBeCloseTo(2, 10);
  });
  it("samples steep and narrow visible curves without spending the entire budget offscreen", () => {
    for (const coefficient of [2000, 100000])
      for (const center of [0, 0.013, -0.017]) {
        let evaluations = 0;
        const paths = sampleFunction(
          (x) => {
            evaluations++;
            return coefficient * (x - center) ** 2;
          },
          defaultView(),
          640,
          400,
        );
        expect(
          paths.flat().some((p) => Math.abs(p.x - center) < 0.005 && p.y < 1),
        ).toBe(true);
        expect(evaluations).toBeLessThan(640 * 7 + 2);
      }
    expect(
      sampleFunction((x) => 100000 * x, defaultView()).length,
    ).toBeGreaterThan(0);
    const pole = 0.123;
    const paths = sampleFunction((x) => 1 / (x - pole), defaultView());
    expect(paths.length).toBeGreaterThan(1);
    expect(
      paths.every(
        (path) =>
          path.every((p) => p.x < pole) || path.every((p) => p.x > pole),
      ),
    ).toBe(true);
  });
  it("recognizes only bounded fractions/simple exact forms and keeps tiny values", () => {
    expect(rational(1 / 3)).toEqual([1, 3]);
    expect(exactForm(0.125)).toBe("1/8");
    expect(exactForm(Math.sqrt(8), "sqrt(8)")).toBe("2√2");
    expect(exactForm(Math.PI / 2, "pi/2")).toBe("π/2");
    expect(exactForm(Math.PI)).toBeUndefined();
    expect(exactForm(0.3333)).toBeUndefined();
    expect(coordinateForm(Math.PI)).toBe("π");
    expect(coordinateForm((3 * Math.PI) / 2)).toBe("3π/2");
    expect(coordinateForm(1e-14)).not.toBe("0");
  });
  it("supports bounded function shorthand without splitting unrelated identifiers", () => {
    expect(scalar("sinx").value({ x: Math.PI / 2 }, {}, "radians")).toBeCloseTo(
      1,
      12,
    );
    expect(
      scalar(latexToText("\\sin x")).value({ x: Math.PI / 2 }, {}, "radians"),
    ).toBeCloseTo(1, 12);
    expect(scalar("cosx").value({ x: 0 }, {}, "radians")).toBe(1);
    expect(scalar("sinx^2").value({ x: 2 }, {}, "radians")).toBeCloseTo(
      Math.sin(4),
      12,
    );
    expect(scalar("sinwave").symbols.has("sinwave")).toBe(true);
    const w = workspace("a=2", "b=a+2", "y=x^2");
    const results = Object.values(w.results);
    expect(results[0].parameter?.name).toBe("a");
    expect(results[1].parameter).toBeUndefined();
    expect(results[1].value).toBe(4);
    expect(results[0].graphable).toBeUndefined();
    expect(results[2].graphable).toBe(true);
  });
  it("clamps stale/large/tiny geometry without stranding the title or close control", () => {
    const bounds = { width: 1024, height: 600 };
    expect(
      clampGeometry({ x: 3000, y: -500, width: 2000, height: 10 }, bounds),
    ).toEqual({ x: 8, y: 8, width: 1008, height: 360 });
    const narrow = clampGeometry(defaultGeometry(bounds), {
      width: 390,
      height: 300,
    });
    expect(narrow.width).toBe(374);
    expect(narrow.height).toBe(284);
    expect(narrow.x).toBe(8);
    expect(narrow.y).toBe(8);
  });
  it("only makes scalar horizontal parameters draggable, without making trace points expressions", () => {
    const w = workspace("a=2", "f(x)=x^2", "(a,f(a))", "(2,4)", "(a+1,4)");
    const points = w.graphs.filter((graph) => graph.kind === "points");
    expect(points[0].drag?.name).toBe("a");
    expect(points[0].drag?.y(3)).toBe(9);
    expect(points[1].drag).toBeUndefined();
    expect(points[2].drag).toBeUndefined();
  });
  it("fits supported custom sparse polynomial models in y space", () => {
    const throughOrigin = workspace("x_1=[1,2,3]", "y_1=[3,6,9]", "y_1~m*x_1");
    const fit = Object.values(throughOrigin.results).find(
      (result) => result.fit,
    );
    expect(fit?.parameters?.m).toBeCloseTo(3, 10);
    const quadratic = workspace(
      "x_1=[-2,-1,0,1,2]",
      "y_1=[9,3,1,3,9]",
      "y_1~a*x_1^2+c",
    );
    const result = Object.values(quadratic.results).find(
      (result) => result.fit,
    );
    expect(result?.parameters?.a).toBeCloseTo(2, 10);
    expect(result?.parameters?.c).toBeCloseTo(1, 10);
    expect(result?.fit?.r2).toBeCloseTo(1, 10);
    expect(result?.fit?.predict(3)).toBeCloseTo(19, 10);
    const sinusoid = workspace(
      "x_1=[1,2,3]",
      "y_1=[2,4,8]",
      "y_1~a*sin(b*x_1)",
    );
    expect(Object.values(sinusoid.results).some((result) => result.error)).toBe(
      false,
    );
  });
});

describe("Offline relation architecture and domain correctness", () => {
  const last = (...texts: string[]) =>
    Object.values(workspace(...texts).results).at(-1)!;

  it.each([
    ["52(c^3+64)(c^4-81)~0", [-4, -3, 3]],
    ["1e100(c+4)(c+3)(c-3)~0", [-4, -3, 3]],
    ["1e90(c+1000.1)(c+1000.2)(c-3000)~0", [-1000.2, -1000.1, 3000]],
    ["(c+4)^2(c+3)(c-3)^3~0", [-4, -3, 3]],
    ["(c+4.001)(c+4)(c+3.999)(c-3)~0", [-4.001, -4, -3.999, 3]],
    ["(c+16)(c+0.125)(c-0.25)(c-32)~0", [-16, -0.125, 0.25, 32]],
    ["(c+4)(c+3)(c-3)/(c+4)~0", [-3, 3]],
  ] as const)(
    "isolates real polynomial roots independently of grid scale: %s",
    (source, expected) => {
      const result = last(source);
      expect(result.error).toBeUndefined();
      expect(result.solutions).toHaveLength(expected.length);
      result.solutions!.forEach((solution, i) =>
        expect(solution.c).toBeCloseTo(expected[i], 7),
      );
    },
  );

  it("keeps polynomial equation intercepts consistent with scalar solutions", () => {
    const graph = workspace("52(x^3+64)(x^4-81)=0").graphs[0];
    expect(graph.kind).toBe("vertical");
    if (graph.kind !== "vertical") return;
    expect(roots(graph.fn, -10, 10)).toEqual([-4, -3, 3]);
    expect(graph.rootsInWindow?.(-4, 3)).toEqual([-4, -3, 3]);
    expect(last("52(c^3+64)(c^4-81)~0{-4<=c<=3}").solutions).toEqual([
      { c: -4 },
      { c: -3 },
      { c: 3 },
    ]);
    expect(last("52(c^3+64)(c^4-81)~0{-4<c<3}").solutions).toEqual([{ c: -3 }]);
    for (const range of [10, 1000, 1e6]) {
      expect(graph.rootsInWindow?.(-range, range)).toEqual([-4, -3, 3]);
      expect(
        interests([graph], {
          xMin: -range,
          xMax: range,
          yMin: -range,
          yMax: range,
        }).map((p) => p.x),
      ).toEqual([-4, -3, 3]);
    }
    expect(last("52(c^3+64)(c^4-81)~0").solutions).toEqual([
      { c: -4 },
      { c: -3 },
      { c: 3 },
    ]);
  });

  it("solves powers with both real branches, repeated roots, rational domains and no-real cases", () => {
    expect(last("(c+5)^2~4").solutions).toEqual([{ c: -7 }, { c: -3 }]);
    expect(last("(c+5)^2~0").solutions).toEqual([{ c: -5 }]);
    expect(last("c^2~2").solutions?.[0].c).toBeCloseTo(-Math.SQRT2, 14);
    expect(last("c^2~2").solutions?.[1].c).toBeCloseTo(Math.SQRT2, 14);
    expect(last("345~353/c").parameters?.c).toBeCloseTo(353 / 345, 13);
    expect(last("c^2+1~0").error).toContain("No real solution");
    expect(last("1/c~0").error).toContain("No real solution");
    expect(last("(c^2-1)/(c-1)~2").error).toContain("No real solution");
    expect(last("c/c~1").error).toContain("Underdetermined");
    expect(last("c~1e-16").parameters?.c).toBe(1e-16);
    const smallRoots = last("c^2~1e-24").solutions;
    expect(smallRoots).toHaveLength(2);
    expect(smallRoots?.[0].c).toBe(-1e-12);
    expect(smallRoots?.[1].c).toBe(1e-12);
    expect(last("a+b~3").error).toContain("Underdetermined");
  });

  it.each(["radians", "degrees"] as const)(
    "solves trigonometric relations in %s with an explicit bounded search",
    (angle) => {
      const result = Object.values(
        calculateWorkspace({
          ...emptyCalculator(),
          angle,
          entries: [newExpression("sin(c)~16/23")],
        }).results,
      )[0];
      expect(result.error).toBeUndefined();
      expect(result.solutions).toHaveLength(2);
      const scale = angle === "degrees" ? 180 / Math.PI : 1;
      expect(result.solutions?.[0].c).toBeCloseTo(
        Math.asin(16 / 23) * scale,
        10,
      );
      expect(result.solutions?.[1].c).toBeCloseTo(
        (Math.PI - Math.asin(16 / 23)) * scale,
        10,
      );
      expect(result.message).toContain(angle);
      expect(last("sin(c)~2").error).toContain("No real solution");
    },
  );

  it("retains free parameters through named functions, named expressions and transitive calls", () => {
    const pending = Object.values(workspace("f(x)=4x+b", "p=4x+b").results);
    expect(pending.every((r) => !r.error && r.message?.includes("b"))).toBe(
      true,
    );
    expect(last("f(x)=4x+b", "f(0)~6").parameters).toEqual({ b: 6 });
    expect(last("p=4x+b", "f(t)=p+t", "f(0)~6").error).toContain("Define x");
    const w = workspace(
      "f(x)=a x^2+b x+c",
      "g(x)=f(x)+4",
      "[g(21),g(23),g(25)]~[-8,8,-8]",
      "g([21,23,25])",
    );
    expect(
      Object.values(w.results)
        .map((r) => r.error)
        .filter(Boolean),
    ).toEqual([]);
    const fit = Object.values(w.results)[2];
    expect(fit.relationKind).toBe("values");
    expect(fit.parameters?.a).toBeCloseTo(-4, 9);
    expect(fit.parameters?.b).toBeCloseTo(184, 8);
    expect(fit.parameters?.c).toBeCloseTo(-2112, 7);
    Object.values(w.results)[3].values?.forEach((v, i) =>
      expect(v).toBeCloseTo([-8, 8, -8][i], 8),
    );
    expect(last("f(t)=4t+b", "g(x)=f(x)+1", "g(0)~7").parameters?.b).toBe(6);
    const shadowed = workspace(
      "t=x+1",
      "f(t)=4t+b",
      "g(x)=f(x)+1",
      "g(0)~7",
      "f(2)",
    );
    expect(Object.values(shadowed.results).filter((r) => r.error)).toEqual([]);
    expect(Object.values(shadowed.results).at(-1)?.value).toBe(14);
    const lexical = workspace(
      "f(x)=a*x+b",
      "g(a)=f(a)",
      "[g(0),g(1)]~[2,5]",
      "g(2)",
    );
    expect(Object.values(lexical.results).filter((r) => r.error)).toEqual([]);
    expect(Object.values(lexical.results)[2].parameters).toEqual({
      a: 3,
      b: 2,
    });
    expect(Object.values(lexical.results)[3].value).toBe(8);
    expect(last("p=4x+b", "x_1=[0,1]", "p~[6,10]").error).toContain("Define x");
    for (const definitions of [
      ["f(x)=g(x)", "g(t)=f(t)"],
      ["p=q+1", "q=p+1"],
    ])
      expect(
        Object.values(workspace(...definitions).results).every((r) =>
          r.error?.includes("Circular"),
        ),
      ).toBe(true);
    expect(last("f(x)=unknown(x)").error).toContain("Define unknown(x)");
    expect(last("p=unknown+1").error).toContain("Define unknown");
  });

  it("fits generated/evaluated lists with broadcasting, dimension errors, and stable coefficient matching", () => {
    expect(last("x_1=[1...100]", "2x_1+3~a x_1+b").parameters).toMatchObject({
      a: expect.any(Number),
      b: expect.any(Number),
    });
    const generated = last("x_1=[1...100]", "2x_1+3~a x_1+b");
    expect(generated.parameters?.a).toBeCloseTo(2, 11);
    expect(generated.parameters?.b).toBeCloseTo(3, 10);
    expect(last("[n,n+1,n+2]~[3,4,5]").parameters?.n).toBeCloseTo(3, 12);
    expect(last("[n,n]~4").parameters?.n).toBeCloseTo(4, 12);
    expect(last("[n,n]~[1e-16,1e-16]").parameters?.n).toBeCloseTo(1e-16, 30);
    expect(last("[n,n]~[1,2,3]").error).toContain("same length");
    expect(last("[n]~[[1,2]]").error).toContain("flat list");
    expect(last("[a+b,a+b]~[1,2]").error).toContain("underdetermined");
    // No n makes both true, so this is a least-squares compromise, not an error.
    expect(last("[sin(n),sin(n+1)]~[1,2]").error).toBeUndefined();
    const polynomial = last(
      "x_1=[1...100]",
      "(1/2 x_1+3/2)(3/2 x_1+1/2)~a x_1^2+b x_1+c",
    );
    expect(polynomial.error).toBeUndefined();
    expect(polynomial.parameters?.a).toBeCloseTo(0.75, 10);
    expect(polynomial.parameters?.b).toBeCloseTo(2.5, 9);
    expect(polynomial.parameters?.c).toBeCloseTo(0.75, 8);
    const data = last("x_1=[1...100]", "y_1=3x_1+2", "y_1~mx_1+b");
    expect(data.relationKind).toBe("data");
    expect(data.parameters?.m).toBeCloseTo(3, 11);
    expect(data.parameters?.b).toBeCloseTo(2, 10);
  });

  it("applies open/closed parameter bounds and parses only safe comparison conjunctions", () => {
    expect(last("n^2~4{n>0}").solutions).toEqual([{ n: 2 }]);
    expect(last("k=0", "n^2~4{n<k}").solutions).toEqual([{ n: -2 }]);
    expect(last("n^2~4{0<n<=2}").solutions).toEqual([{ n: 2 }]);
    expect(last("n^2~4{n>0,n<3}").solutions).toEqual([{ n: 2 }]);
    expect(last("n^2~4{n>3}").error).toContain("No real solution");
    expect(last("n^2~0{n>=0}").solutions).toEqual([{ n: 0 }]);
    expect(last("sin(n)~0{0<=n<=0}").solutions).toEqual([{ n: 0 }]);
    expect(last("n^2~0{n>0}").error).toContain("No real solution");
    expect(last("[n,n]~[-1,-2]{n>=0}").parameters?.n).toBe(0);
    expect(last("[n,n]~[-1,-2]{n>0}").error).toContain("No fitted minimum");
    const constrainedLine = last(
      "x_1=[1,2,3]",
      "y_1=[3,2,1]",
      "y_1~m*x_1+b{m>=0}",
    );
    expect(constrainedLine.parameters).toEqual({ m: 0, b: 2 });
    expect(constrainedLine.relationKind).toBe("data");
    expect(constrainedLine.fit?.predict(10)).toBe(2);
    for (const source of ["n^2~4{n>}", "n^2~4{}", "n^2~4{n>0", "n^2~4{n=2}"])
      expect(last(source).error).toContain("Malformed parameter restriction");
    expect(last("n^2~4{n+1>0}").error).toContain("Restrictions need");
    for (const source of ["n^2~4{n>0}", "n^2~4{0<n<=2}", "n^2~4{n>0,n<3}"])
      expect(last(latexToText(textToLatex(source))).solutions).toEqual([
        { n: 2 },
      ]);
    expect(scalar("2{n>0}").value({ n: -1 }, {}, "radians")).toBeNaN();
  });

  it("samples one-sided and bounded real domains without losing their curves or bridging gaps", () => {
    for (const [source, min, max] of [
      ["sqrt(x)", 0, 10],
      ["√x", 0, 10],
      ["sqrt(x-1)", 1, 10],
      ["sqrt(1-x^2)", -1, 1],
      ["x", -10, 10],
    ] as const) {
      const graph = workspace(source).graphs[0];
      expect(graph.kind).toBe("function");
      if (graph.kind !== "function") throw new Error("Expected explicit graph");
      const paths = sampleFunction(graph.fn, defaultView());
      expect(paths.flat().length).toBeGreaterThan(20);
      expect(Math.min(...paths.flat().map((p) => p.x))).toBeCloseTo(min, 3);
      expect(Math.max(...paths.flat().map((p) => p.x))).toBeCloseTo(max, 3);
      expect(
        paths.flat().every((p) => p.x >= min - 1e-8 && p.x <= max + 1e-8),
      ).toBe(true);
    }
    expect(sampleFunction(Math.sqrt, defaultView()).flat()).toContainEqual({
      x: 0,
      y: 0,
    });
    for (const path of sampleFunction(
      (x) => Math.sqrt(x * x - 1),
      defaultView(),
    ))
      expect(path.every((p) => p.x <= -1) || path.every((p) => p.x >= 1)).toBe(
        true,
      );
  });

  it("normalizes implicit lines for reliable intercepts and retains complex implicit fallback", () => {
    const w = workspace("4y+8x=6");
    expect(w.graphs[0].kind).toBe("function");
    const points = interests(w.graphs, defaultView());
    expect(
      points.some(
        (p) => p.label.includes("y-intercept") && p.x === 0 && p.y === 1.5,
      ),
    ).toBe(true);
    expect(
      points.some(
        (p) =>
          p.label.includes("zero") && Math.abs(p.x - 0.75) < 1e-9 && p.y === 0,
      ),
    ).toBe(true);
    const circle = workspace("x^2+y^2=25");
    expect(circle.graphs[0].kind).toBe("implicit");
    expect(interests(circle.graphs, defaultView())).toEqual([]);
    expect(Object.values(circle.results)[0].message).toContain(
      "no automatic special points",
    );
  });
});
describe("offline calculator arithmetic and syntax", () => {
  it.each([
    ["1/2+1/3", 5 / 6],
    ["2+3*4", 14],
    ["-2^2", -4],
    ["2^3^2", 512],
    ["2^12", 4096],
    ["sqrt(81)", 9],
    ["cbrt(-8)", -2],
    ["|−3|", 3],
    ["345*.17", 58.65],
    ["log(100)", 2],
    ["log(8,2)", 3],
    ["ln(e)", 1],
    ["exp(2)", Math.exp(2)],
    ["2pi", 2 * Math.PI],
    ["sin(pi/2)", 1],
    ["asin(1)", Math.PI / 2],
  ])("evaluates %s", (s, n) =>
    expect(evaluate(s as string)).toBeCloseTo(n as number, 11),
  );
  it("uses coherent degree mode and correct base-10 display", () => {
    expect(evaluate("sin(30)", "degrees")).toBeCloseTo(0.5, 12);
    expect(evaluate("acos(0)", "degrees")).toBeCloseTo(90, 12);
    expect(scalarTex(scalar("log(100)"))).toContain("log_{10}");
    expect(scalarTex(scalar("ln(e)"))).toContain("\\ln");
  });
  it("covers low-risk SAT arithmetic commands found in the built-in audit", () => {
    expect(evaluate("round(1.3254,2)")).toBe(1.33);
    expect(evaluate("sign(-12)")).toBe(-1);
    expect(evaluate("gcd(54,24)")).toBe(6);
    expect(evaluate("lcm(6,8)")).toBe(24);
    expect(evaluate("nCr(6,2)")).toBe(15);
    expect(evaluate("nPr(6,2)")).toBe(30);
    expect(evaluate("nCr(2,6)")).toBe(0); // as in Desmos
    expect(scalarTex(scalar("nCr(6,2)"))).toContain("\\operatorname{nCr}");
  });
  it("converts supported structural LaTeX without evaluating commands", () => {
    expect(evaluate(latexToText("\\frac{1}{2}+\\sqrt{81}"))).toBeCloseTo(
      9.5,
      12,
    );
    expect(
      evaluate(latexToText("\\sin^{2}\\left(\\frac{\\pi}{2}\\right)")),
    ).toBeCloseTo(1, 12);
    expect(latexToText("y_{1}\\sim mx_{1}+b").replace(/\s/g, "")).toBe(
      "y_1~mx_1+b",
    );
    expect(latexToText(textToLatex("L=[1,2,3]"))).toContain("[1,2,3]");
    const implicit = latexToText(textToLatex("y=2x+3"));
    expect(implicit).not.toContain("~");
    expect(
      scalar(implicit.slice(2)).value({ x: 2 }, {}, "radians"),
    ).toBeCloseTo(7, 12);
    expect(() => latexToText("\\href{bad}")).toThrow("Unsupported");
    expect(evaluate(latexToText(textToLatex("cbrt(-8)")))).toBe(-2);
    expect(evaluate(latexToText(textToLatex("log(8,2)")))).toBeCloseTo(3, 12);
    expect(evaluate(latexToText(textToLatex("floor(1.7)")))).toBe(1);
  });
  it("uses Desmos-style percent-of syntax rather than modulo", () => {
    expect(evaluate("20% of 50")).toBe(10);
    expect(evaluate("80+15% of 80")).toBe(92);
    expect(evaluate("200-12.5% of 200")).toBe(175);
    expect(latexToText("20\\%\\operatorname{of}50")).toBe("20*0.01*50");
    expect(evaluate(latexToText("20\\%\\operatorname{of}50"))).toBe(10);
    expect(() => evaluate("20%3")).toThrow("operator");
  });
  it("supports Desmos-style mod without changing percentage syntax", () => {
    expect(evaluate("mod(17,5)")).toBe(2);
    expect(evaluate("mod(20,4)")).toBe(0);
    expect(evaluate("mod(-17,5)")).toBe(3);
    expect(evaluate("mod(17,-5)")).toBe(-3);
    expect(evaluate("mod(17,0)")).toBeNaN();
    expect(evaluate("20% of 50")).toBe(10);
    expect(() => evaluate("20%3")).toThrow("operator");
    expect(scalarTex(scalar("mod(17,5)"))).toContain("\\operatorname{mod}");
  });
  it("parses, renders, edits, and evaluates arbitrary real nth roots", () => {
    expect(evaluate("nthroot(27,3)")).toBe(3);
    expect(evaluate("nthroot(16,4)")).toBe(2);
    expect(evaluate("nthroot(2^15+11,5)")).toBeCloseTo(
      Math.pow(2 ** 15 + 11, 1 / 5),
      12,
    );
    expect(evaluate("nthroot(-125,3)")).toBeCloseTo(-5, 12);
    expect(evaluate("nthroot(-16,4)")).toBeNaN();
    expect(evaluate("sqrt(81)")).toBe(9);
    const source = latexToText("\\sqrt[5]{x+3}");
    expect(source).toBe("nthroot(x+3,5)");
    expect(scalarTex(scalar(source))).toMatch(/\\sqrt\[5\]\{\s*x\s*\+\s*3\}/);
    expect(latexToText(textToLatex("nthroot(32,5)"))).toBe("nthroot(32,5)");
  });
  it("evaluates SAT-useful descriptive statistics over lists", () => {
    const any = (source: string) => scalar(source).evaluate({}, {}, "radians");
    expect(any("mean([-2,1.5,4.5])")).toBeCloseTo(4 / 3, 12);
    expect(any("median([-5,1,9])")).toBe(1);
    expect(any("median([1,2,3,4])")).toBe(2.5);
    expect(any("min([-5,-2,-9])")).toBe(-9);
    expect(any("max([.1,.25,.2])")).toBe(0.25);
    expect(any("quartile([1,2,3,4,5],1)")).toBe(1.5);
    expect(any("quartile([1,2,3,4,5],3)")).toBe(4.5);
    expect(any("quantile([1,2,3,4],.25)")).toBe(1.75);
    expect(any("stdev([1,2,3,4])")).toBeCloseTo(Math.sqrt(5 / 3), 12);
    expect(any("stdevp([1,2,3,4])")).toBeCloseTo(Math.sqrt(1.25), 12);
    expect(any("var([1,2,3,4])")).toBeCloseTo(5 / 3, 12);
    expect(any("variance([1,2,3,4])")).toBeCloseTo(5 / 3, 12);
    expect(any("varp([1,2,3,4])")).toBeCloseTo(1.25, 12);
    expect(any("mad([1,2,3])")).toBeCloseTo(2 / 3, 12);
    expect(any("count([-2,0,2])")).toBe(3);
    expect(any("total([-2,.5,4])")).toBe(2.5);
    expect(any("stats([1,2,3,4,5])")).toEqual([1, 1.5, 3, 4.5, 5]);
  });
  it("keeps descriptive-statistics edge cases explicit", () => {
    const any = (source: string) => scalar(source).evaluate({}, {}, "radians");
    expect(any("count([])")).toBe(0);
    expect(any("total([])")).toBe(0);
    expect(any("mean([])")).toBeNaN();
    expect(any("stdev([1])")).toBeNaN();
    expect(any("stdevp([1])")).toBe(0);
    expect(any("quartile([1,2,3],5)")).toBeNaN();
    expect(any("quantile([1,2,3],-0.1)")).toBeNaN();
    expect(any("mean(2)")).toBeNaN();
  });
  it("supports reciprocal, inverse, powered trig and pole domains in both angle modes", () => {
    expect(evaluate("sec(0)")).toBeCloseTo(1, 12);
    expect(evaluate("csc(pi/2)")).toBeCloseTo(1, 12);
    expect(evaluate("cot(pi/4)")).toBeCloseTo(1, 12);
    expect(evaluate("arcsin(1)")).toBeCloseTo(Math.PI / 2, 12);
    expect(evaluate("sin^-1(1)", "degrees")).toBeCloseTo(90, 12);
    expect(evaluate("sin^2(pi/2)")).toBeCloseTo(1, 12);
    expect(evaluate("sec(90)", "degrees")).toBeNaN();
    expect(evaluate("csc(0)")).toBeNaN();
    expect(evaluate("arcsec(2)", "degrees")).toBeCloseTo(60, 12);
    expect(evaluate("arccot(-1)", "degrees")).toBeCloseTo(135, 12);
  });
  it("evaluates paired lists, elementwise functions/arithmetic, and syntax-based regressions", () => {
    const result = workspace(
      "x_1=[1,2,3]",
      "y_1=[4,7,10]",
      "(x_1,y_1)",
      "y_1~m x_1+b",
      "m+b",
      "f(x)=x^2",
      "f(x_1)",
      "2*x_1+1",
    );
    expect(
      Object.values(result.results).filter((entry) => entry.error),
    ).toEqual([]);
    expect(
      result.graphs.find((graph) => graph.kind === "points"),
    ).toMatchObject({
      points: [
        { x: 1, y: 4 },
        { x: 2, y: 7 },
        { x: 3, y: 10 },
      ],
    });
    expect(
      Object.values(result.results).find((entry) => entry.parameters)
        ?.parameters,
    ).toMatchObject({ m: expect.closeTo(3, 10), b: expect.closeTo(1, 10) });
    expect(
      Object.values(result.results).some(
        (entry) => JSON.stringify(entry.values) === "[1,4,9]",
      ),
    ).toBe(true);
    expect(
      Object.values(result.results).some(
        (entry) => JSON.stringify(entry.values) === "[3,5,7]",
      ),
    ).toBe(true);
    expect(result.missing).toEqual([]);
    expect(
      Object.values(
        workspace("x_1=[1,2]", "y_1=[1,2,3]", "y_1~m x_1+b").results,
      ).some((entry) => entry.error?.includes("equally sized")),
    ).toBe(true);
  });
  it("rejects numeric overflow/underflow and propagates undefined intermediate values", () => {
    expect(() => evaluate("1e-400")).toThrow("numeric range");
    expect(() => evaluate("1e400")).toThrow("numeric range");
    expect(evaluate("1e-200*1e-200")).toBeNaN();
    expect(evaluate("atan(1/0)")).toBeNaN();
    expect(evaluate("sqrt(-1)^0")).toBeNaN();
  });
  it.each([
    "sqrt(-1)",
    "1/0",
    "ln(-1)",
    "log(2,1)",
    "acos(2)",
    "exp(9999)",
    "tan(pi/2)",
  ])("marks %s undefined", (s) => expect(evaluate(s)).toBeNaN());
  it.each([
    "a=3",
    "import(2)",
    "x.constructor",
    "[1,2]",
    'evaluate("2+2")',
    "1:999999",
    "2;3",
  ])("blocks unsupported or unsafe syntax %s", (s) => {
    expect(() => scalar(s).value({}, {}, "radians")).toThrow();
  });
  it("supports functions, forward definitions, parameters, points, and independent errors", () => {
    const w = workspace(
      "f(x)=ax^2+1",
      "a=2",
      "f(3)",
      "(2,3)",
      "y=sqrt(x)",
      "y=|x|",
      "y=ln(x)",
      "y=sin(x)",
      "2x+3=11",
    );
    expect(Object.values(w.results).some((r) => r.error)).toBe(false);
    expect(Object.values(w.results).some((r) => r.value === 19)).toBe(true);
    expect(w.graphs).toHaveLength(7);
    const line = w.graphs.find((g) => g.kind === "vertical")!;
    expect(line.kind === "vertical" && roots(line.fn, -10, 10)[0]).toBeCloseTo(
      4,
      9,
    );
    expect(workspace("y=ax^2+bx+c").missing).toEqual(["a", "b", "c"]);
    expect(
      Object.values(workspace("a=b", "b=a", "2+2").results).some(
        (r) => r.value === 4,
      ),
    ).toBe(true);
    expect(Object.values(workspace("f(x)=f(x)").results)[0].error).toContain(
      "Circular",
    );
  });
  it("keeps legacy named definitions readable and evaluates structural source consistently", () => {
    const legacy = workspace("rate=2", "rate+3", "foo(x)=x+1", "foo(2)");
    expect(
      Object.values(legacy.results).filter((result) => result.error),
    ).toEqual([]);
    expect(
      Object.values(legacy.results).some((result) => result.value === 5),
    ).toBe(true);
    const state = emptyCalculator();
    state.entries = [{ ...newExpression("2+2"), latex: "3+3" }];
    expect(Object.values(calculateWorkspace(state).results)[0].value).toBe(6);
  });
  it("keeps inequalities and variable definitions distinct", () => {
    const w = workspace("y<=2x+1", "x>5", "x^2+y^2=25");
    expect(w.graphs.map((g) => g.kind)).toEqual([
      "function",
      "vertical",
      "implicit",
    ]);
    // Curved regions are shaded from the graph window, not rejected.
    const disc = workspace("x^2+y^2<25");
    expect(Object.values(disc.results)[0].error).toBeUndefined();
    expect(disc.graphs[0].kind).toBe("implicit");
  });
});
describe("bounded graph calculations", () => {
  it("locates zeros, intersections, intercepts, and quadratic extrema", () => {
    const w = workspace("y=x^2-4", "y=0");
    const points = interests(w.graphs, defaultView());
    expect(
      points.some(
        (p) => Math.abs(p.x - 2) < 1e-6 && p.label.includes("intersection"),
      ),
    ).toBe(true);
    expect(
      points.some((p) => Math.abs(p.x + 2) < 1e-6 && p.label.includes("zero")),
    ).toBe(true);
    expect(
      points.some(
        (p) =>
          Math.abs(p.x) < 1e-6 && p.y === -4 && p.label.includes("minimum"),
      ),
    ).toBe(true);
    const tangent = interests(
      workspace("y=(x-.123)^2", "y=0").graphs,
      defaultView(),
    );
    expect(
      tangent.some(
        (p) => Math.abs(p.x - 0.123) < 1e-6 && p.label.includes("intersection"),
      ),
    ).toBe(true);
  });
  it("does not report reciprocal/tangent poles or step discontinuities as roots", () => {
    expect(roots((x) => 1 / (x - 0.123), -10, 10)).toEqual([]);
    expect(roots((x) => Math.tan(x), 1, 2)).toEqual([]);
    expect(roots((x) => (x < 0.123 ? -1 : 1), -10, 10)).toEqual([]);
    expect(roots(() => 0, -10, 10)).toEqual([]);
    expect(roots((x) => 1e-100 * (x - 2), -10, 10)[0]).toBeCloseTo(2, 8);
    expect(roots((x) => 1e-250 * (x - 2), -10, 10)[0]).toBeCloseTo(2, 8);
    expect(roots((x) => (x - 0.123) ** 2, -10, 10)[0]).toBeCloseTo(0.123, 8);
    expect(roots((x) => (x - 0.123) ** 2 + 1e-12, -10, 10)).toEqual([]);
  });
  it("breaks sampled paths at holes and asymptotes rather than connecting them", () => {
    for (const fn of [
      (x: number) => 1 / (x - 0.123),
      (x: number) => Math.tan(x),
    ]) {
      const paths = sampleFunction(fn, defaultView());
      expect(paths.length).toBeGreaterThan(1);
      for (const p of paths)
        for (let i = 1; i < p.length; i++) {
          expect(Math.abs(p[i].y - p[i - 1].y)).toBeLessThan(16);
          if (fn(0.123) === Infinity)
            expect(p[i].x < 0.123 || p[i - 1].x > 0.123).toBe(true);
        }
    }
    expect(
      sampleFunction(Math.sqrt, defaultView())
        .flat()
        .every((p) => p.x >= 0),
    ).toBe(true);
  });
  it("contours circles conservatively", () => {
    const segments = implicitSegments(
      (x, y) => x * x + y * y - 25,
      defaultView(),
    );
    expect(segments.length).toBeGreaterThan(80);
    for (const point of segments.flat())
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(5, 1);
  });
});
describe("regression uses numerical least squares", () => {
  it("fits exact and independently calculated noisy linear data", () => {
    const exact = regression(
      [1, 2, 3].map((x) => ({ x, y: 3 * x + 1 })),
      "linear",
    );
    expect(exact.coefficients[0]).toBeCloseTo(1, 12);
    expect(exact.coefficients[1]).toBeCloseTo(3, 12);
    expect(exact.r2).toBeCloseTo(1, 12);
    expect(exact.rmse).toBeLessThan(1e-12);
    // x=[0,1,2,3], y=[1,3,4,7]: Sxx=5, Sxy=9.5, mean y=3.75
    const noisy = regression(
      [
        { x: 0, y: 1 },
        { x: 1, y: 3 },
        { x: 2, y: 4 },
        { x: 3, y: 7 },
      ],
      "linear",
    );
    expect(noisy.coefficients[1]).toBeCloseTo(1.9, 12);
    expect(noisy.coefficients[0]).toBeCloseTo(0.9, 12);
    expect(noisy.residuals).toEqual(
      expect.arrayContaining([
        expect.closeTo(0.1, 10),
        expect.closeTo(-0.7, 10),
      ]),
    );
    expect(noisy.r2).toBeCloseTo(1 - 0.7 / 18.75, 12);
  });
  it("fits quadratic, cubic, and positive exponential models", () => {
    const quadratic = regression(
      [-2, -1, 0, 1, 2].map((x) => ({ x, y: 2 * x * x - 3 * x + 4 })),
      "quadratic",
    );
    quadratic.coefficients.forEach((v, i) =>
      expect(v).toBeCloseTo([4, -3, 2][i], 11),
    );
    const cubic = regression(
      [-2, -1, 0, 1, 2, 3].map((x) => ({ x, y: x * x * x - 2 * x + 1 })),
      "cubic",
    );
    expect(cubic.predict(4)).toBeCloseTo(57, 10);
    const exponential = regression(
      [0, 1, 2, 3].map((x) => ({ x, y: 3 * 2 ** x })),
      "exponential",
    );
    expect(exponential.coefficients[0]).toBeCloseTo(3, 11);
    expect(exponential.coefficients[1]).toBeCloseTo(2, 11);
    expect(exponential.logSpace).toBe(false);
    expect(exponential.r2).toBeCloseTo(1, 11);
  });
  it("matches the manually checked Desmos original-y exponential fit on noisy data", () => {
    const fit = regression(
      [1, 2, 4, 9].map((y, x) => ({ x, y })),
      "exponential",
    );
    // Current public calculator, Log Mode off, verified 2026-10-27.
    expect(fit.coefficients[0]).toBeCloseTo(0.88812, 4);
    expect(fit.coefficients[1]).toBeCloseTo(2.16083, 4);
    expect(fit.r2).toBeCloseTo(0.9989, 4);
    expect(fit.logSpace).toBe(false);
  });
  it("handles large offsets and rejects insufficient, singular, nonpositive or nonfinite data", () => {
    expect(
      regression(
        [0, 1, 2, 3].map((n) => ({ x: 1e8 + n, y: 3 * n + 1 })),
        "linear",
      ).predict(1e8 + 4),
    ).toBeCloseTo(13, 9);
    expect(() => regression([{ x: 1, y: 4 }], "linear")).toThrow();
    expect(() =>
      regression(
        [
          { x: 1, y: 4 },
          { x: 1, y: 5 },
        ],
        "linear",
      ),
    ).toThrow();
    expect(() =>
      regression(
        [
          { x: 1, y: 0 },
          { x: 2, y: 5 },
        ],
        "exponential",
      ),
    ).toThrow();
    expect(() =>
      regression(
        [
          { x: Infinity, y: 4 },
          { x: 2, y: 5 },
        ],
        "linear",
      ),
    ).toThrow();
    expect(
      regression(
        [
          { x: 1, y: 4 },
          { x: 2, y: 4 },
        ],
        "linear",
      ).r2,
    ).toBeUndefined();
  });
});
describe("tables and persisted calculator work", () => {
  it("parses pasted paired data and does not silently drop malformed rows", () => {
    expect(parsePastedData("x₁\ty₁\n1\t4\n2\t7\n3\t10")).toEqual([
      ["1", "4"],
      ["2", "7"],
      ["3", "10"],
    ]);
    expect(parsePastedData("1,4\n2,7")).toHaveLength(2);
    expect(() => parsePastedData("1\t4\t9")).toThrow();
    const s: CalculatorState = {
      ...emptyCalculator(),
      entries: [
        {
          id: "table1",
          type: "table",
          hidden: false,
          rows: [
            ["1", "4"],
            ["2", "7"],
            ["3", "10"],
          ],
          fit: "linear",
        },
      ],
    };
    const w = calculateWorkspace(s);
    expect(w.graphs).toHaveLength(2);
    expect(w.results.table1.fit?.coefficients[1]).toBeCloseTo(3, 11);
    s.entries[0] = { ...s.entries[0], hidden: true };
    expect(calculateWorkspace(s).graphs).toHaveLength(0);
  });
  it("validates portable session work without accepting malformed state", () => {
    const state = emptyCalculator();
    expect(validateCalculator(state)).toEqual(state);
    const legacy = { ...state };
    delete legacy.equalAxes;
    expect(validateCalculator(legacy)).toEqual(legacy);
    expect(() => validateCalculator({ ...state, equalAxes: "yes" })).toThrow();
    const colored = { ...state, entries: [{ ...state.entries[0], color: 3 }] };
    expect(validateCalculator(colored).entries[0].color).toBe(3);
    expect(() =>
      validateCalculator({
        ...state,
        entries: [{ ...state.entries[0], color: 10 }],
      }),
    ).toThrow();
    const dual = {
      ...state,
      mode: "desmos" as const,
      desmos: { version: 11, expressions: { list: [{ latex: "y=x^2" }] } },
    };
    expect(validateCalculator(dual)).toEqual(dual);
    expect(() => validateDesmosState({ bad: Infinity })).toThrow();
    expect(() => validateDesmosState({ bad: () => 1 })).toThrow();
    expect(() => validateDesmosState(JSON.parse('{"__proto__":{}}'))).toThrow();
    const data = { ...emptyData(), questions: parseQuestions(sample) };
    const session = createSession([data.questions[0].id]);
    session.calculator = state;
    data.sessions.push(session);
    expect(
      parseBackup({ format: "sat-study-backup-v1", data }).sessions[0]
        .calculator,
    ).toEqual(state);
    session.calculator = {
      ...state,
      angle: "bad",
    } as unknown as CalculatorState;
    expect(() => parseBackup({ format: "sat-study-backup-v1", data })).toThrow(
      "calculator",
    );
    expect(() =>
      validateCalculator({ ...state, view: { ...state.view, xMax: NaN } }),
    ).toThrow();
    expect(() =>
      validateCalculator({
        ...state,
        entries: Array(30).fill(newExpression()),
      }),
    ).toThrow();
  });
});
