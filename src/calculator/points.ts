import type { PointValue, Value } from "@/src/types/calculator";

// Point values for the calculator core: no parsing, React or DOM. A point is
// {x, y}; a list of points stores equal-length coordinate lists, which is also
// how ([1,2],[3,4]) reads in Desmos.

export const MAX_POINTS = 200;

export const isPoint = (value: unknown): value is PointValue =>
  typeof value === "object" &&
  value !== null &&
  (value as PointValue).kind === "point";

export const isPointList = (
  p: PointValue,
): p is PointValue & {
  x: number[];
  y: number[];
} => Array.isArray(p.x);

const sameLength = () => new Error("Lists must have the same length.");

/** Pair coordinates, broadcasting a number against a list. */
export function makePoint(
  x: number | number[],
  y: number | number[],
): PointValue {
  if (Array.isArray(x) && Array.isArray(y)) {
    if (x.length !== y.length)
      throw new Error("Point lists must have the same length.");
    return { kind: "point", x, y };
  }
  if (Array.isArray(x))
    return { kind: "point", x, y: x.map(() => y as number) };
  if (Array.isArray(y)) return { kind: "point", x: y.map(() => x), y };
  return { kind: "point", x, y };
}

export const undefinedPoint = (): PointValue => ({
  kind: "point",
  x: NaN,
  y: NaN,
});

/** One point per entry, whether the value is a point or a list of points. */
export function pointsOf(p: PointValue): { x: number; y: number }[] {
  return isPointList(p)
    ? p.x.map((x, i) => ({ x, y: p.y[i] }))
    : [{ x: p.x as number, y: p.y as number }];
}

export function fromPoints(points: { x: number; y: number }[]): PointValue {
  if (points.length > MAX_POINTS)
    throw new Error("Calculator lists support at most 200 values.");
  return {
    kind: "point",
    x: points.map((p) => p.x),
    y: points.map((p) => p.y),
  };
}

const finite = (n: number) => (Number.isFinite(n) ? n : NaN);
const length = (p: PointValue) => (isPointList(p) ? p.x.length : undefined);

/** Apply f to coordinate pairs, broadcasting single points against lists. */
function zip(
  a: PointValue,
  b: PointValue,
  f: (ax: number, ay: number, bx: number, by: number) => [number, number],
): PointValue {
  const la = length(a),
    lb = length(b);
  if (la !== undefined && lb !== undefined && la !== lb) throw sameLength();
  const n = la ?? lb;
  const at = (v: number | number[], i: number) => (Array.isArray(v) ? v[i] : v);
  if (n === undefined) {
    const [x, y] = f(
      a.x as number,
      a.y as number,
      b.x as number,
      b.y as number,
    );
    return { kind: "point", x: finite(x), y: finite(y) };
  }
  const xs: number[] = [],
    ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = f(at(a.x, i), at(a.y, i), at(b.x, i), at(b.y, i));
    xs.push(finite(x));
    ys.push(finite(y));
  }
  return { kind: "point", x: xs, y: ys };
}

/** Scale points by numbers or number lists. */
function scale(
  p: PointValue,
  k: number | number[],
  f: (v: number, k: number) => number,
): PointValue {
  const lp = length(p);
  if (Array.isArray(k) && lp !== undefined && k.length !== lp)
    throw sameLength();
  const n = Array.isArray(k) ? k.length : lp;
  const at = (v: number | number[], i: number) => (Array.isArray(v) ? v[i] : v);
  if (n === undefined)
    return {
      kind: "point",
      x: finite(f(p.x as number, k as number)),
      y: finite(f(p.y as number, k as number)),
    };
  const xs: number[] = [],
    ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const factor = at(k, i);
    xs.push(finite(f(at(p.x, i), factor)));
    ys.push(finite(f(at(p.y, i), factor)));
  }
  return { kind: "point", x: xs, y: ys };
}

const notDefined = () => new Error("That operation is not defined for points.");

/** + - * / when at least one operand is a point. Unary + and - take one. */
export function pointOperator(op: string, args: Value[]): PointValue {
  if (args.length === 1) {
    const [a] = args;
    if (!isPoint(a) || (op !== "-" && op !== "+")) throw notDefined();
    return op === "-" ? scale(a, -1, (v, k) => v * k) : a;
  }
  const [a, b] = args;
  if (op === "+" || op === "-") {
    if (!isPoint(a) || !isPoint(b))
      throw new Error("Add or subtract points with points, not numbers.");
    const sign = op === "+" ? 1 : -1;
    return zip(a, b, (ax, ay, bx, by) => [ax + sign * bx, ay + sign * by]);
  }
  if (op === "*") {
    if (isPoint(a) && isPoint(b)) throw notDefined();
    return isPoint(a)
      ? scale(a, b as number | number[], (v, k) => v * k)
      : scale(b as PointValue, a as number | number[], (v, k) => v * k);
  }
  if (op === "/") {
    if (!isPoint(a) || isPoint(b)) throw notDefined();
    return scale(a, b as number | number[], (v, k) => v / k);
  }
  throw notDefined();
}

/** `.x` and `.y`. */
export function pointComponent(p: PointValue, axis: "x" | "y") {
  return p[axis];
}

/** `P[i]` and `P[[i,j]]`; out of range is an undefined point. */
export function pickPoints(
  p: PointValue,
  index: number | number[],
): PointValue {
  if (!isPointList(p)) throw new Error("Only a list can be indexed.");
  const pick = (i: number) =>
    Number.isInteger(i) && i >= 1 && i <= p.x.length
      ? { x: p.x[i - 1], y: p.y[i - 1] }
      : { x: NaN, y: NaN };
  return Array.isArray(index)
    ? fromPoints(index.map(pick))
    : { kind: "point", ...pick(index) };
}

/** Build `[(1,2),(3,4)]` from evaluated items. */
export function pointListOf(items: Value[]): PointValue {
  const points: { x: number; y: number }[] = [];
  for (const item of items) {
    if (!isPoint(item))
      throw new Error("A list cannot mix points and numbers.");
    if (isPointList(item)) throw new Error("Nested lists are not supported.");
    points.push({ x: item.x as number, y: item.y as number });
  }
  return fromPoints(points);
}

const aggregateNames = new Set(["mean", "total", "count", "length"]);

/** Functions of points: distance, midpoint, mean, total, count/length, join. */
export function pointFunction(name: string, args: Value[]): Value {
  if (name === "distance" || name === "midpoint") {
    const [a, b] = args;
    if (!isPoint(a) || !isPoint(b))
      throw new Error(`${name} takes two points.`);
    if (name === "midpoint")
      return zip(a, b, (ax, ay, bx, by) => [(ax + bx) / 2, (ay + by) / 2]);
    const d = zip(a, b, (ax, ay, bx, by) => [Math.hypot(ax - bx, ay - by), 0]);
    return d.x;
  }
  if (name === "join") {
    if (!args.every(isPoint))
      throw new Error("A list cannot mix points and numbers.");
    return fromPoints((args as PointValue[]).flatMap(pointsOf));
  }
  if (aggregateNames.has(name)) {
    const [p] = args;
    if (!isPoint(p) || !isPointList(p))
      throw new Error(`${name} needs a list of points.`);
    if (name === "count" || name === "length") return p.x.length;
    const sum = (v: number[]) => v.reduce((total, n) => total + n, 0);
    const divisor = name === "mean" ? p.x.length : 1;
    if (!p.x.length || [...p.x, ...p.y].some((n) => !Number.isFinite(n)))
      return undefinedPoint();
    return {
      kind: "point",
      x: finite(sum(p.x) / divisor),
      y: finite(sum(p.y) / divisor),
    };
  }
  throw new Error(`${name} is not defined for points.`);
}

/** Lowers `(a,b)` groups to `point(a,b)` before the text is parsed. A `(` after
 * a name or `)`/`]` is a call or product and keeps its parentheses; its contents
 * are still scanned. Grammar only: values come from the evaluator. */
export function lowerPoints(source: string): string {
  const close = (open: number): number => {
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if ("([".includes(source[i])) depth++;
      if (")]".includes(source[i]) && --depth === 0) return i;
    }
    throw new Error("Complete the parentheses.");
  };
  const topLevelComma = (from: number, to: number) => {
    let depth = 0;
    for (let i = from; i < to; i++) {
      if ("([".includes(source[i])) depth++;
      if (")]".includes(source[i])) depth--;
      if (source[i] === "," && depth === 0) return true;
    }
    return false;
  };
  const read = (from: number, to: number): string => {
    let out = "";
    for (let i = from; i < to; i++) {
      if (source[i] !== "(") {
        out += source[i];
        continue;
      }
      const end = close(i);
      const inner = read(i + 1, end);
      const before = /[\w.]*$/.exec(source.slice(from, i))![0];
      const named =
        /^[a-z_]/i.test(before) || /[)\]]$/.test(source.slice(from, i));
      if (!topLevelComma(i + 1, end)) out += `(${inner})`;
      else if (named) out += `(${inner})`;
      else out += `${before ? "*" : ""}point(${inner})`;
      i = end;
    }
    return out;
  };
  return read(0, source.length);
}
