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
  fitViewport,
} from "../src/calculator/numerics";
import { regression } from "../src/calculator/regression";
import { parsePastedData } from "../src/calculator/TableEditor";
import { emptyData } from "../src/core/model";
import { parseBackup } from "../src/importing/backup";
import { createSession } from "../src/core/practice";
import sample from "../src/data/synthetic.json";
import { parseQuestions } from "../src/importing/json";
import { latexToText, textToLatex } from "../src/calculator/latex";
import {
  clampGeometry,
  defaultGeometry,
} from "../src/calculator/windowGeometry";

const evaluate = (s: string, angle: "radians" | "degrees" = "radians") =>
  scalar(s).value({}, {}, angle);
const workspace = (...texts: string[]) =>
  calculateWorkspace({
    ...emptyCalculator(),
    entries: texts.map((t) => newExpression(t)),
  });
describe("floating window bounds and parameter points", () => {
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
    const invalid = workspace("x_1=[1,2,3]", "y_1=[2,4,8]", "y_1~a*sin(b*x_1)");
    expect(
      Object.values(invalid.results).some((result) =>
        result.error?.includes("General nonlinear"),
      ),
    ).toBe(true);
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
    "3!",
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
    expect(Object.values(workspace("x^2+y^2<25").results)[0].error).toContain(
      "Implicit inequalities",
    );
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
  it("contours circles conservatively and fits point bounds", () => {
    const segments = implicitSegments(
      (x, y) => x * x + y * y - 25,
      defaultView(),
    );
    expect(segments.length).toBeGreaterThan(80);
    for (const point of segments.flat())
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(5, 1);
    const v = fitViewport(
      [
        {
          kind: "points",
          id: "p",
          color: 0,
          points: [
            { x: 100, y: 500 },
            { x: 200, y: 700 },
          ],
        },
      ],
      defaultView(),
    )!;
    expect(v.xMin).toBeLessThan(100);
    expect(v.yMax).toBeGreaterThan(700);
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
