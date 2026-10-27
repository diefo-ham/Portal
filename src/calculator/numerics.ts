import type { Point, Viewport } from "./model";
import type { GraphObject } from "./workspace";
export const safeValue = (fn: (x: number) => number, x: number) => {
  try {
    const y = fn(x);
    return Number.isFinite(y) ? y : NaN;
  } catch {
    return NaN;
  }
};
const close = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));
/** Bracket and residual-check roots; poles/sign jumps must never become zeros. */
export function roots(
  fn: (x: number) => number,
  min: number,
  max: number,
  samples = 480,
): number[] {
  const result: number[] = [];
  const add = (x: number) => {
    if (Number.isFinite(x) && !result.some((r) => close(r, x))) result.push(x);
  };
  let x0 = min,
    y0 = safeValue(fn, min),
    zeroCount = 0;
  const sampled: Point[] = [{ x: x0, y: y0 }];
  for (let i = 1; i <= samples; i++) {
    const x1 = min + ((max - min) * i) / samples,
      y1 = safeValue(fn, x1);
    sampled.push({ x: x1, y: y1 });
    if (y0 === 0) {
      add(x0);
      zeroCount++;
    }
    if (
      Number.isFinite(y0) &&
      Number.isFinite(y1) &&
      y0 !== 0 &&
      y1 !== 0 &&
      y0 < 0 !== y1 < 0
    ) {
      let a = x0,
        b = x1,
        fa = y0;
      const tolerance = Math.max(Math.abs(y0), Math.abs(y1), 1e-300) * 1e-7;
      for (let j = 0; j < 70; j++) {
        const m = (a + b) / 2,
          fm = safeValue(fn, m);
        if (!Number.isFinite(fm)) break;
        if (fm === 0) {
          a = b = m;
          break;
        }
        if (fa < 0 === fm < 0) {
          a = m;
          fa = fm;
        } else b = m;
      }
      const x = (a + b) / 2;
      if (Math.abs(safeValue(fn, x)) <= tolerance) add(x);
    }
    x0 = x1;
    y0 = y1;
  }
  if (y0 === 0) add(max);
  // Even-multiplicity roots need not change sign. Refine local minima of |f|
  // with a bounded golden-section search and a stricter residual check.
  for (let i = 1; i < sampled.length - 1; i++) {
    const before = sampled[i - 1],
      middle = sampled[i],
      after = sampled[i + 1];
    if (
      ![before.y, middle.y, after.y].every(Number.isFinite) ||
      !(Math.abs(middle.y) < Math.min(Math.abs(before.y), Math.abs(after.y))) ||
      middle.y === 0
    )
      continue;
    let a = before.x,
      b = after.x;
    const ratio = (Math.sqrt(5) - 1) / 2;
    let c = b - ratio * (b - a),
      d = a + ratio * (b - a);
    let fc = Math.abs(safeValue(fn, c)),
      fd = Math.abs(safeValue(fn, d));
    for (let j = 0; j < 80; j++) {
      if (fc < fd) {
        b = d;
        d = c;
        fd = fc;
        c = b - ratio * (b - a);
        fc = Math.abs(safeValue(fn, c));
      } else {
        a = c;
        c = d;
        fc = fd;
        d = a + ratio * (b - a);
        fd = Math.abs(safeValue(fn, d));
      }
    }
    const candidate = fc < fd ? c : d;
    if (
      Math.abs(safeValue(fn, candidate)) <=
      Math.max(Math.abs(before.y), Math.abs(after.y), 1e-300) * 1e-20
    )
      add(candidate);
  }
  // A continuum of zero samples is not a set of isolated roots.
  return zeroCount > samples * 0.8
    ? []
    : result.sort((a, b) => a - b).slice(0, 80);
}
export function derivative(fn: (x: number) => number, x: number) {
  const h = 1e-5 * Math.max(1, Math.abs(x));
  return (safeValue(fn, x + h) - safeValue(fn, x - h)) / (2 * h);
}
export interface Interest extends Point {
  label: string;
  graphIds: string[];
}
export function interests(graphs: GraphObject[], view: Viewport): Interest[] {
  const found: Interest[] = [];
  const add = (p: Interest) => {
    if (
      ![p.x, p.y].every(Number.isFinite) ||
      p.x < view.xMin ||
      p.x > view.xMax ||
      p.y < view.yMin ||
      p.y > view.yMax
    )
      return;
    const same = found.find((q) => close(q.x, p.x) && close(q.y, p.y));
    if (same) {
      if (!same.label.includes(p.label)) same.label += ` / ${p.label}`;
      same.graphIds = [...new Set([...same.graphIds, ...p.graphIds])];
    } else if (found.length < 120) found.push(p);
  };
  const curves = graphs.filter(
    (g) => g.kind === "function" && !g.relation,
  ) as Extract<GraphObject, { kind: "function" }>[];
  const verticals = graphs.filter(
    (g) => g.kind === "vertical" && !g.relation,
  ) as Extract<GraphObject, { kind: "vertical" }>[];
  for (const g of curves) {
    const at0 = safeValue(g.fn, 0);
    add({ x: 0, y: at0, label: "y-intercept", graphIds: [g.id] });
    for (const x of roots(g.fn, view.xMin, view.xMax))
      add({ x, y: 0, label: "zero", graphIds: [g.id] });
    for (const x of roots(
      (v) => derivative(g.fn, v),
      view.xMin,
      view.xMax,
      240,
    )) {
      const y = safeValue(g.fn, x),
        h = (view.xMax - view.xMin) * 1e-4;
      const before = safeValue(g.fn, x - h),
        after = safeValue(g.fn, x + h);
      if (
        !Number.isFinite(y) ||
        !Number.isFinite(before) ||
        !Number.isFinite(after)
      )
        continue;
      // Verify a finite, locally continuous turning point. A derivative sign
      // change at abs(x) is useful; one at a pole is not.
      if (
        Math.max(Math.abs(before - y), Math.abs(after - y)) >
        (view.yMax - view.yMin) * 0.02
      )
        continue;
      if ((before > y && after > y) || (before < y && after < y)) {
        add({
          x,
          y,
          label: before > y ? "minimum" : "maximum",
          graphIds: [g.id],
        });
        if (
          Math.abs(y) <
          1e-10 * Math.max(Math.abs(before), Math.abs(after), 1e-300)
        )
          add({ x, y: 0, label: "zero", graphIds: [g.id] });
      }
    }
  }
  for (let i = 0; i < curves.length; i++)
    for (let j = i + 1; j < curves.length; j++) {
      const a = curves[i],
        b = curves[j],
        difference = (x: number) => a.fn(x) - b.fn(x);
      const xs = roots(difference, view.xMin, view.xMax);
      // Tangential intersections may not change sign; inspect stationary differences.
      for (const x of roots(
        (v) => derivative(difference, v),
        view.xMin,
        view.xMax,
        160,
      )) {
        const av = safeValue(a.fn, x),
          bv = safeValue(b.fn, x);
        if (Math.abs(av - bv) < 1e-10 * Math.max(1, Math.abs(av), Math.abs(bv)))
          xs.push(x);
      }
      for (const x of xs)
        add({
          x,
          y: safeValue(a.fn, x),
          label: "intersection",
          graphIds: [a.id, b.id],
        });
    }
  for (const g of verticals)
    for (const x of roots(g.fn, view.xMin, view.xMax)) {
      add({ x, y: 0, label: "x solution", graphIds: [g.id] });
      for (const c of curves)
        add({
          x,
          y: safeValue(c.fn, x),
          label: "intersection",
          graphIds: [g.id, c.id],
        });
    }
  for (const g of graphs)
    if (g.kind === "points")
      for (const p of g.points)
        add({ ...p, label: "data point", graphIds: [g.id] });
  return found;
}

/** Adaptive, bounded sampling; separate paths at domain holes, sharp unresolved
 * jumps, and asymptotes. A quarter/midpoint check avoids connecting across poles.
 */
export function sampleFunction(
  fn: (x: number) => number,
  view: Viewport,
  width = 640,
  height = 400,
  includeOutside = false,
): Point[][] {
  const segments: [Point, Point][] = [],
    span = view.yMax - view.yMin;
  let budget = Math.max(2400, width * 7);
  const cache = new Map<number, number>();
  const sample = (x: number) => {
    if (cache.has(x)) return cache.get(x)!;
    if (--budget < 0) return NaN;
    const y = safeValue(fn, x);
    cache.set(x, y);
    return y;
  };
  const visit = (
    a: number,
    fa: number,
    b: number,
    fb: number,
    depth: number,
  ) => {
    if (budget < 0) return;
    const m = (a + b) / 2,
      fm = sample(m),
      valid = [fa, fm, fb].every(Number.isFinite);
    const pixelWidth = ((b - a) / (view.xMax - view.xMin)) * width;
    const outsideAbove =
      valid && Math.min(fa, fm, fb) > view.yMax + span * 0.05;
    const outsideBelow =
      valid && Math.max(fa, fm, fb) < view.yMin - span * 0.05;
    if (outsideAbove || outsideBelow) {
      // Estimate a possible off-center turning point before pruning. This
      // recovers narrow parabolas whose vertex lies between the coarse samples.
      const A = 2 * (fa + fb - 2 * fm),
        B = 4 * fm - 3 * fa - fb;
      const t = A ? -B / (2 * A) : -1;
      const vertex =
        t > 0 && t < 1
          ? fa + B * t + A * t * t
          : outsideAbove
            ? Infinity
            : -Infinity;
      const mayEnter = outsideAbove ? vertex <= view.yMax : vertex >= view.yMin;
      if (!mayEnter) {
        if (includeOutside) {
          const y = outsideAbove ? view.yMax + span : view.yMin - span;
          segments.push([
            { x: a, y },
            { x: b, y },
          ]);
        }
        return;
      }
    }
    const error = valid
      ? (Math.abs(fm - (fa + fb) / 2) / span) * height
      : Infinity;
    if ((!valid || error > 0.45) && depth < 20 && pixelWidth > 0.02) {
      visit(a, fa, m, fm, depth + 1);
      visit(m, fm, b, fb, depth + 1);
      return;
    }
    // Unresolved curvature/domain holes are gaps, not bridges across poles.
    if (!valid || error > 2) return;
    segments.push(
      [
        { x: a, y: fa },
        { x: m, y: fm },
      ],
      [
        { x: m, y: fm },
        { x: b, y: fb },
      ],
    );
  };
  const n = Math.min(320, Math.max(80, Math.round(width / 4)));
  for (let i = 0; i < n && budget > 0; i++) {
    const a = view.xMin + ((view.xMax - view.xMin) * i) / n,
      b = view.xMin + ((view.xMax - view.xMin) * (i + 1)) / n;
    visit(a, sample(a), b, sample(b), 0);
  }
  const paths: Point[][] = [];
  for (const [a, b] of segments) {
    const last = paths.at(-1);
    if (last && last.at(-1)!.x === a.x && last.at(-1)!.y === a.y) last.push(b);
    else paths.push([a, b]);
  }
  return paths;
}

export function implicitSegments(
  fn: (x: number, y: number) => number,
  view: Viewport,
  columns = 100,
  rows = 80,
): [Point, Point][] {
  const points: Point[][] = [],
    values: number[][] = [];
  for (let i = 0; i <= columns; i++) {
    points[i] = [];
    values[i] = [];
    for (let j = 0; j <= rows; j++) {
      const p = {
        x: view.xMin + ((view.xMax - view.xMin) * i) / columns,
        y: view.yMin + ((view.yMax - view.yMin) * j) / rows,
      };
      points[i][j] = p;
      try {
        values[i][j] = fn(p.x, p.y);
      } catch {
        values[i][j] = NaN;
      }
    }
  }
  const segments: [Point, Point][] = [];
  for (let i = 0; i < columns; i++)
    for (let j = 0; j < rows; j++) {
      const corners = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1],
      ];
      const crossings: Point[] = [];
      for (let k = 0; k < 4; k++) {
        const [a, b] = corners[k],
          [c, d] = corners[(k + 1) % 4],
          va = values[a][b],
          vb = values[c][d];
        if (
          !Number.isFinite(va) ||
          !Number.isFinite(vb) ||
          va < 0 === vb < 0 ||
          va === vb
        )
          continue;
        const t = va / (va - vb),
          pa = points[a][b],
          pb = points[c][d];
        const p = { x: pa.x + t * (pb.x - pa.x), y: pa.y + t * (pb.y - pa.y) };
        // A linear interpolation at a pole produces a large residual, not a contour.
        let residual: number;
        try {
          residual = Math.abs(fn(p.x, p.y));
        } catch {
          continue;
        }
        if (
          Number.isFinite(residual) &&
          residual <= Math.max(Math.abs(va), Math.abs(vb)) * 0.6
        )
          crossings.push(p);
      }
      if (crossings.length === 2) segments.push([crossings[0], crossings[1]]);
      // Ambiguous saddle cells are omitted rather than choosing a false connection.
    }
  return segments;
}

export function fitViewport(
  graphs: GraphObject[],
  view: Viewport,
): Viewport | undefined {
  const points = graphs.flatMap((g) => (g.kind === "points" ? g.points : []));
  let xMin = points.length ? Math.min(...points.map((p) => p.x)) : view.xMin;
  let xMax = points.length ? Math.max(...points.map((p) => p.x)) : view.xMax;
  if (xMin === xMax) {
    xMin -= 5;
    xMax += 5;
  }
  const ys = points.map((p) => p.y);
  for (const g of graphs)
    if (g.kind === "function")
      for (let i = 0; i <= 200; i++) {
        const y = safeValue(g.fn, xMin + ((xMax - xMin) * i) / 200);
        if (Number.isFinite(y) && Math.abs(y) < 1e10) ys.push(y);
      }
  if (!ys.length) return undefined;
  // Robust range for functions: isolated near-asymptote samples must not crush the graph.
  ys.sort((a, b) => a - b);
  const tail = points.length ? 0 : Math.floor(ys.length * 0.03);
  let yMin = ys[tail],
    yMax = ys[ys.length - 1 - tail];
  const px = (xMax - xMin) * 0.12,
    py = Math.max((yMax - yMin) * 0.12, yMin === yMax ? 2 : 0.05);
  return { xMin: xMin - px, xMax: xMax + px, yMin: yMin - py, yMax: yMax + py };
}
