import { describe, it, expect } from "vitest";
import { calculateWorkspace } from "../src/calculator/workspace";
import { emptyCalculator, newExpression } from "../src/calculator/model";
import { clipAffineInequality } from "../src/calculator/affine";
import { implicitRegion, interests } from "../src/calculator/numerics";

const workspace = (...sources: string[]) =>
  calculateWorkspace({
    ...emptyCalculator(),
    entries: sources.map((text) => newExpression(text)),
  });
const view = { xMin: -20, xMax: 20, yMin: -20, yMax: 20 };

describe("SAT affine inequalities", () => {
  it.each([
    ["4x+y<18", { a: 4, b: 1, c: -18, op: "<" }, "<", 18],
    ["2x-3y>=7", { a: 2, b: -3, c: -7, op: ">=" }, "<=", -7 / 3],
    ["18>4x+y", { a: -4, b: -1, c: 18, op: ">" }, "<", 18],
    ["y>14", { a: 0, b: 1, c: -14, op: ">" }, ">", 14],
    ["x+y<=10", { a: 1, b: 1, c: -10, op: "<=" }, "<=", 10],
    ["3y>2x-5", { a: -2, b: 3, c: 5, op: ">" }, ">", -5 / 3],
    ["-2x+4y<=8", { a: -2, b: 4, c: -8, op: "<=" }, "<=", 2],
    ["2(x+y)/4+3<=y-2", { a: 0.5, b: -0.5, c: 5, op: "<=" }, ">=", 10],
  ])(
    "normalizes %s structurally and preserves its half-plane",
    (source, expected, direction, intercept) => {
      const w = workspace(source as string),
        g = w.graphs[0];
      expect(Object.values(w.results)[0].error).toBeUndefined();
      expect(g.kind).toBe("function");
      if (g.kind !== "function") throw new Error("Expected a line boundary");
      expect(g.affine).toEqual(expected);
      expect(g.relation).toBe(direction);
      expect(g.fn(0)).toBeCloseTo(intercept as number, 12);
      const { shade, boundary } = clipAffineInequality(g.affine!, view);
      expect(boundary).toHaveLength(2);
      expect(shade.length).toBeGreaterThanOrEqual(3);
      for (const p of shade) {
        const residual = g.affine!.a * p.x + g.affine!.b * p.y + g.affine!.c;
        expect(
          g.affine!.op.startsWith("<") ? residual : -residual,
        ).toBeLessThanOrEqual(1e-10);
      }
      for (const p of boundary)
        expect(g.affine!.a * p.x + g.affine!.b * p.y + g.affine!.c).toBeCloseTo(
          0,
          10,
        );
    },
  );

  it("rebuilds scalar dependencies, including vertical and degenerate regions, without fitting x/y", () => {
    for (const a of [4, -2, 0]) {
      const w = workspace(`a=${a}`, "ax+y<18");
      expect(w.missing).toEqual([]);
      expect(w.graphs[0].kind).toBe("function");
      expect(w.graphs[0].kind === "function" && w.graphs[0].fn(2)).toBe(
        18 - a * 2,
      );
      expect(Object.values(w.results).some((r) => r.parameters)).toBe(false);
    }
    for (const [source, direction] of [
      ["-2x>=4", "<="],
      ["4>2x", "<"],
    ]) {
      const g = workspace(source).graphs[0];
      expect(g.kind).toBe("vertical");
      if (g.kind === "vertical") expect(g.relation).toBe(direction);
    }
    for (const [source, count] of [
      ["0*x+0*y<1", 4],
      ["0*x+0*y>1", 0],
      ["x-x+y-y<=0", 4],
      ["x-x+y-y<0", 0],
    ] as const) {
      const g = workspace(source).graphs[0];
      if (g.kind === "points" || !g.affine) throw new Error("Expected region");
      expect(clipAffineInequality(g.affine, view).shade).toHaveLength(count);
      expect(interests([g], view)).toEqual([]);
    }
    expect(
      Object.values(workspace("a=b", "b=a", "ax+y<18").results).at(-1)?.error,
    ).toMatch(/Circular/);
    expect(Object.values(workspace("ax+y<18").results)[0].error).toMatch(
      /Define a/,
    );
  });

  it("clips finite, correctly oriented half-planes across pan and zoom, including offscreen boundaries", () => {
    for (const source of ["4x+y<18", "18>4x+y", "2x-3y>=7", "y>14", "-2x>=4"]) {
      const g = workspace(source).graphs[0];
      if (g.kind === "points" || !g.affine) throw new Error("Expected affine");
      for (const range of [1e-6, 1, 1000, 1e9]) {
        for (const center of [-100, 0, 100]) {
          const v = {
            xMin: center - range,
            xMax: center + range,
            yMin: center - range,
            yMax: center + range,
          };
          const { shade, boundary } = clipAffineInequality(g.affine, v);
          for (const p of [...shade, ...boundary]) {
            expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
            expect(p.x).toBeGreaterThanOrEqual(v.xMin - range * 1e-10);
            expect(p.x).toBeLessThanOrEqual(v.xMax + range * 1e-10);
            expect(p.y).toBeGreaterThanOrEqual(v.yMin - range * 1e-10);
            expect(p.y).toBeLessThanOrEqual(v.yMax + range * 1e-10);
          }
          if (shade.length) {
            const p = shade.reduce(
              (p, q) => ({
                x: p.x + q.x / shade.length,
                y: p.y + q.y / shade.length,
              }),
              { x: 0, y: 0 },
            );
            const residual = g.affine.a * p.x + g.affine.b * p.y + g.affine.c;
            expect(
              g.affine.op.startsWith("<") ? residual : -residual,
            ).toBeLessThanOrEqual(range * 1e-8);
          }
        }
      }
    }
    const g = workspace("4x+y+1e20<0").graphs[0];
    expect(g.kind !== "points" && g.affine).toMatchObject({
      a: 4,
      b: 1,
      c: 1e20,
    });
  });

  it("coexists and inspects only boundary points, including boundary intersections", () => {
    const w = workspace("y>14", "4x+y<18", "x>=1");
    expect(w.graphs).toHaveLength(3);
    const pois = interests(w.graphs, view);
    expect(
      pois.some(
        (p) =>
          p.label.includes("intersection") &&
          Math.abs(p.x - 1) < 1e-8 &&
          Math.abs(p.y - 14) < 1e-8,
      ),
    ).toBe(true);
    for (const p of pois)
      for (const id of p.graphIds) {
        const g = w.graphs.find((g) => g.id === id)!;
        if (g.kind === "points" || !g.affine)
          throw new Error("Expected boundary");
        expect(g.affine.a * p.x + g.affine.b * p.y + g.affine.c).toBeCloseTo(
          0,
          7,
        );
      }
  });

  it("shades curved implicit inequalities and retains existing explicit curves", () => {
    const view = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    const covers = (
      rectangles: { x0: number; x1: number; y0: number; y1: number }[],
      x: number,
      y: number,
    ) =>
      rectangles.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
    for (const [source, inside, outside, op] of [
      ["x^2+y^2<9", [0, 0], [4, 4], "<"],
      ["x*y<=2", [1, 1], [3, 3], "<="],
      ["x^2+y^2>=16", [4.5, 0], [0, 0], ">="],
    ] as const) {
      const w = workspace(source);
      const graph = w.graphs[0];
      expect(Object.values(w.results)[0].error).toBeUndefined();
      expect(graph.kind).toBe("implicit");
      if (graph.kind !== "implicit") continue;
      expect(graph.region).toBe(op);
      const region = implicitRegion(graph.fn, graph.region!, view);
      expect(covers(region, inside[0], inside[1])).toBe(true);
      expect(covers(region, outside[0], outside[1])).toBe(false);
    }
    const sum = workspace("f(t)=t^2", "y+f(x)<9");
    expect(Object.values(sum.results).at(-1)?.error).toBeUndefined();
    expect(sum.graphs.at(-1)?.kind).toBe("implicit");
    expect(workspace("y>x^2").graphs[0].kind).toBe("function");
    expect(workspace("y=x^2{-1<x<2}").graphs[0].kind).toBe("function");
    const restricted = workspace("y>x{-1<x<2}").graphs[0];
    expect(restricted.kind).toBe("function");
    if (restricted.kind === "function") {
      expect(restricted.affine).toBeUndefined();
      expect(restricted.fn(-2)).toBeNaN();
      expect(restricted.fn(1)).toBe(1);
      expect(restricted.fn(3)).toBeNaN();
    }
  });

  it("publishes a representative fit for the nonlinear SAT list system", () => {
    const source = "[a,a,c] ~ [230% of b,60% of c,p% of b]";
    const result = Object.values(workspace(source).results)[0];
    expect(result.error).toBeUndefined();
    expect(result.systemKind).toBeUndefined();
    expect(result.parameters).toEqual({
      a: 2.3,
      b: 1,
      c: 23 / 6,
      p: 1150 / 3,
    });
    expect(result.fit?.rmse).toBe(0);
    expect(result.message).toContain("Representative fit");
    // Supplying a nonzero scale keeps the existing exactly determined path.
    const defined = Object.values(workspace("b=6", source).results).at(-1)!;
    expect(defined.error).toBeUndefined();
    expect(defined.parameters?.a).toBeCloseTo(13.8, 10);
    expect(defined.parameters?.c).toBeCloseTo(23, 10);
    expect(defined.parameters?.p).toBeCloseTo(1150 / 3, 10);
    const zero = Object.values(workspace("b=0", source).results).at(-1)!;
    expect(zero.systemKind).toBeUndefined();
    expect(zero.parameters).toEqual({ a: 0, c: 0, p: 1 });
    expect(zero.message).toContain("Representative fit");
  });
});
