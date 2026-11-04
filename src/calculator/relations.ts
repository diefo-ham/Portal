import type { MathNode } from "mathjs";
import { scalar, type Scalar, type Angle } from "./math";
import { roots } from "./numerics";
import { restrictionSource } from "./restrictionSyntax";
import { roundSig } from "@/src/utils/calculator";

export type ParameterBound = {
  min?: number;
  max?: number;
  minOpen?: boolean;
  maxOpen?: boolean;
};
export type ParameterBounds = Record<string, ParameterBound>;
export type Restriction = { left: Scalar; right: Scalar; op: string };

/** Solver/regression braces are parameter bounds, never expression domains. */
export function relationSource(source: string): {
  body: string;
  restrictions: Restriction[];
} {
  const { body, comparisons } = restrictionSource(source, "parameter");
  try {
    return {
      body,
      restrictions: comparisons.map(({ left, op, right }) => ({
        left: scalar(left),
        op,
        right: scalar(right),
      })),
    };
  } catch {
    throw new Error(
      "Malformed parameter restriction. Use comparisons such as {0<n<5}.",
    );
  }
}

/** Practical restrictions: one fitted scalar on one side, a defined scalar on
 * the other. This deliberately excludes coupled/general logical constraints. */
export function parameterBounds(
  restrictions: Restriction[],
  names: string[],
  expand: (s: Scalar) => Scalar,
  evaluate: (s: Scalar) => number,
): ParameterBounds {
  const bounds: ParameterBounds = Object.create(null);
  for (const restriction of restrictions) {
    let left = expand(restriction.left),
      right = expand(restriction.right),
      op = restriction.op;
    const parameter = (s: Scalar) =>
      s.node.type === "SymbolNode" && names.includes(s.node.toString())
        ? s.node.toString()
        : undefined;
    if (!parameter(left) && parameter(right)) {
      [left, right] = [right, left];
      op = (
        { "<": ">", "<=": ">=", ">": "<", ">=": "<=" } as Record<string, string>
      )[op];
    }
    const name = parameter(left);
    if (!name || [...right.symbols].some((symbol) => names.includes(symbol)))
      throw new Error(
        "Restrictions need a fitted parameter compared with a defined scalar.",
      );
    const value = evaluate(right);
    if (!Number.isFinite(value))
      throw new Error("Restriction bounds must be finite real numbers.");
    const bound = (bounds[name] ??= {});
    if (op.startsWith(">")) {
      if (bound.min === undefined || value > bound.min) {
        bound.min = value;
        bound.minOpen = op === ">";
      } else if (value === bound.min) bound.minOpen ||= op === ">";
    } else {
      if (bound.max === undefined || value < bound.max) {
        bound.max = value;
        bound.maxOpen = op === "<";
      } else if (value === bound.max) bound.maxOpen ||= op === "<";
    }
    if (
      bound.min !== undefined &&
      bound.max !== undefined &&
      (bound.min > bound.max ||
        (bound.min === bound.max && (bound.minOpen || bound.maxOpen)))
    )
      throw new Error("No real solution satisfies the parameter restrictions.");
  }
  return bounds;
}

const allowed = (value: number, bound: ParameterBound = {}) =>
  (bound.min === undefined ||
    (bound.minOpen ? value > bound.min : value >= bound.min)) &&
  (bound.max === undefined ||
    (bound.maxOpen ? value < bound.max : value <= bound.max));

type Polynomial = number[];
type RationalPolynomial = { numerator: Polynomial; denominator: Polynomial };
const trim = (p: Polynomial) => {
  while (p.length > 1 && p.at(-1) === 0) p.pop();
  return p;
};
const sum = (a: Polynomial, b: Polynomial, sign = 1) =>
  trim(
    Array.from(
      { length: Math.max(a.length, b.length) },
      (_, i) => (a[i] ?? 0) + sign * (b[i] ?? 0),
    ),
  );
const product = (a: Polynomial, b: Polynomial) => {
  if (a.length + b.length > 12) throw new Error("polynomial degree");
  const p = Array(a.length + b.length - 1).fill(0) as number[];
  a.forEach((v, i) =>
    b.forEach((w, j) => {
      p[i + j] += v * w;
    }),
  );
  if (p.some((v) => !Number.isFinite(v))) throw new Error("polynomial range");
  return trim(p);
};

/** Bounded algebra for rational polynomials, preserving the original residual
 * for domain checks (c/c must never introduce c=0 as a solution). */
function rationalPolynomial(
  s: Scalar,
  name: string,
  constant: (node: MathNode) => number,
): RationalPolynomial | undefined {
  const visit = (node: MathNode): RationalPolynomial => {
    const n = node as any;
    if (n.type === "ParenthesisNode") return visit(n.content);
    let depends = false;
    node.traverse((child: MathNode) => {
      if (child.type === "SymbolNode" && child.toString() === name)
        depends = true;
    });
    if (!depends) {
      const value = constant(node);
      if (!Number.isFinite(value)) throw new Error();
      return { numerator: [value], denominator: [1] };
    }
    if (n.type === "SymbolNode" && n.name === name)
      return { numerator: [0, 1], denominator: [1] };
    if (n.type !== "OperatorNode") throw new Error();
    const a = visit(n.args[0]);
    if (n.args.length === 1)
      return {
        ...a,
        numerator: a.numerator.map((v) => (n.op === "-" ? -v : v)),
      };
    if (n.op === "^") {
      const power = constant(n.args[1]);
      if (!Number.isInteger(power) || Math.abs(power) > 4) throw new Error();
      let numerator = [1],
        denominator = [1];
      for (let i = 0; i < Math.abs(power); i++) {
        numerator = product(numerator, power < 0 ? a.denominator : a.numerator);
        denominator = product(
          denominator,
          power < 0 ? a.numerator : a.denominator,
        );
      }
      return { numerator, denominator };
    }
    const b = visit(n.args[1]);
    if (n.op === "+" || n.op === "-")
      return {
        numerator: sum(
          product(a.numerator, b.denominator),
          product(b.numerator, a.denominator),
          n.op === "+" ? 1 : -1,
        ),
        denominator: product(a.denominator, b.denominator),
      };
    if (n.op === "*")
      return {
        numerator: product(a.numerator, b.numerator),
        denominator: product(a.denominator, b.denominator),
      };
    if (n.op === "/")
      return {
        numerator: product(a.numerator, b.denominator),
        denominator: product(a.denominator, b.numerator),
      };
    throw new Error();
  };
  try {
    return visit(s.node);
  } catch {
    return undefined;
  }
}

/** A polynomial is monotone between consecutive derivative roots. Isolating
 * those intervals avoids a fixed grid skipping an even number of roots inside
 * one cell. Critical points also expose roots of even multiplicity. Degree is
 * bounded by rationalPolynomial; this does not enumerate general/periodic roots.
 */
function polynomialRoots(
  coefficients: Polynomial,
  min: number,
  max: number,
): number[] {
  if (coefficients.length < 2) return [];
  const scale = Math.max(...coefficients.map(Math.abs));
  const p = coefficients.map((v) => v / scale);
  const value = (x: number) => p.reduceRight((sum, v) => sum * x + v, 0);
  if (p.length === 2) return [-p[0] / p[1]].filter((x) => x >= min && x <= max);
  const critical = polynomialRoots(
    p.slice(1).map((v, i) => v * (i + 1)),
    min,
    max,
  );
  const points = [min, ...critical, max];
  const result: number[] = [];
  const zeros = points.map((x) => {
    const magnitude = p.reduceRight(
      (sum, v) => sum * Math.abs(x) + Math.abs(v),
      0,
    );
    return Math.abs(value(x)) <= 32 * Number.EPSILON * magnitude;
  });
  points.forEach((x, i) => {
    if (zeros[i]) result.push(x);
  });
  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1],
      b = points[i],
      fa = value(a),
      fb = value(b);
    // Roundoff at a repeated critical root must not create two extra brackets
    // immediately beside the same root.
    if (zeros[i - 1] || zeros[i] || fa < 0 === fb < 0) continue;
    for (let step = 0; step < 100; step++) {
      const m = a + (b - a) / 2,
        fm = value(m);
      if (m === a || m === b) break;
      if (fm === 0) {
        a = b = m;
        break;
      }
      if (fa < 0 === fm < 0) {
        a = m;
        fa = fm;
      } else {
        b = m;
        fb = fm;
      }
    }
    result.push(Math.abs(value(a)) < Math.abs(value(b)) ? a : b);
  }
  return result.sort((a, b) => a - b);
}

/** Reuse polynomial isolation for x-only equations and their graph POIs. Other
 * equations retain the existing numerical graph-window search. */
export function polynomialRootFinder(
  relation: Scalar,
  name: string,
  evaluate: (s: Scalar, locals?: Record<string, number>) => number,
): ((min: number, max: number) => number[]) | undefined {
  const polynomial = rationalPolynomial(relation, name, (node) =>
    evaluate(scalar(node.toString())),
  );
  if (!polynomial) return undefined;
  const fn = (value: number) => evaluate(relation, { [name]: value });
  return (min, max) =>
    verifiedSolutions(
      polynomialRoots(polynomial.numerator, min, max),
      fn,
      { min, max },
      true,
    );
}

export function solveScalarRelation(
  relation: Scalar,
  name: string,
  evaluate: (s: Scalar, locals?: Record<string, number>) => number,
  angle: Angle,
  bound: ParameterBound = {},
): { solutions: number[]; message?: string } {
  const fn = (value: number) => evaluate(relation, { [name]: value });
  const polynomial = rationalPolynomial(relation, name, (node) =>
    evaluate(scalar(node.toString())),
  );
  let candidates: number[] = [],
    message: string | undefined;
  if (
    bound.min !== undefined &&
    bound.min === bound.max &&
    !bound.minOpen &&
    !bound.maxOpen
  ) {
    candidates = [bound.min];
  } else if (polynomial) {
    const p = polynomial.numerator;
    if (p.length === 1) {
      if (p[0] === 0)
        throw new Error(
          "Underdetermined relation: the parameter is not uniquely determined.",
        );
      throw new Error("No real solution.");
    }
    if (p.length === 2) candidates = [-p[0] / p[1]];
    else if (p.length === 3) {
      const [c, b, a] = p,
        discriminant = b * b - 4 * a * c;
      if (discriminant >= 0) {
        // Stable quadratic formula avoids cancellation for separated roots.
        const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant));
        candidates = q === 0 ? [-b / (2 * a)] : [q / a, c / q];
      }
    } else {
      const radius = Math.min(
        1e6,
        1 + Math.max(...p.slice(0, -1).map((v) => Math.abs(v / p.at(-1)!))),
      );
      candidates = polynomialRoots(p, -radius, radius);
      message = `Real solutions searched within ±${radius}.`;
    }
  } else {
    let trig = false;
    relation.node.traverse((node: MathNode) => {
      const n = node as any;
      if (
        n.type === "FunctionNode" &&
        ["sin", "cos", "tan", "sec", "csc", "cot"].includes(n.fn.name)
      )
        trig = true;
    });
    let min = bound.min ?? (trig ? 0 : -1000),
      max =
        bound.max ?? (trig ? (angle === "degrees" ? 360 : 2 * Math.PI) : 1000);
    // One-sided restrictions outside the default search window still receive a
    // bounded search next to their supplied endpoint.
    if (min > max) {
      if (bound.min !== undefined && bound.max === undefined) max = min + 2000;
      else min = max - 2000;
    }
    candidates = min === max ? [min] : roots(fn, min, max, 4096);
    message = `Numerical real solutions searched in [${roundSig(min, 6)}, ${roundSig(max, 6)}]${trig ? ` ${angle}` : ""}.`;
    const probes = [0.13, 0.37, 0.61, 0.89].map((t) =>
      fn(min + (max - min) * t),
    );
    if (probes.every((v) => v === 0))
      throw new Error(
        "Underdetermined relation: the parameter is not uniquely determined.",
      );
  }
  const solutions = verifiedSolutions(candidates, fn, bound, !!polynomial);
  if (!solutions.length)
    throw new Error(
      polynomial
        ? "No real solution satisfies the relation and restrictions."
        : "No real solution found in the search interval.",
    );
  return { solutions, message };
}

function verifiedSolutions(
  candidates: number[],
  fn: (value: number) => number,
  bound: ParameterBound,
  refinePolynomial = false,
): number[] {
  const solutions: number[] = [];
  for (let value of candidates.sort((a, b) => a - b)) {
    if (!Number.isFinite(value)) continue;
    // Expanded coefficients locate roots, but cancellation there can lose
    // accuracy for nearby roots far from zero. Polish locally using the original
    // expression (often still factored), accepting only residual improvements.
    // Never use this as an unbounded search or jump to another root.
    if (refinePolynomial) {
      for (let step = 0; step < 8; step++) {
        const residual = fn(value);
        if (!Number.isFinite(residual) || residual === 0) break;
        const h = Math.sqrt(Number.EPSILON) * Math.max(1, Math.abs(value));
        const left = fn(value - h),
          right = fn(value + h);
        const scale = Math.max(Math.abs(left), Math.abs(right));
        const correction =
          ((residual / scale) * (2 * h)) / (right / scale - left / scale);
        if (!Number.isFinite(correction) || Math.abs(correction) > 4 * h) break;
        const next = value - correction;
        if (next === value || !(Math.abs(fn(next)) < Math.abs(residual))) break;
        value = next;
      }
    }
    // Snap only machine-level integer noise, and verify against the original
    // expression, including its domain and the user's open/closed bounds.
    const integer = Math.round(value);
    if (
      Math.abs(value - integer) <=
        64 * Number.EPSILON * Math.max(1, Math.abs(value)) &&
      (integer !== 0 || fn(0) === 0)
    )
      value = integer;
    if (Object.is(value, -0)) value = 0;
    const residual = fn(value);
    const scale = Math.max(
      1,
      ...[fn(value + 1e-5), fn(value - 1e-5)]
        .filter(Number.isFinite)
        .map(Math.abs),
    );
    if (
      !Number.isFinite(residual) ||
      Math.abs(residual) > 1e-9 * scale ||
      !allowed(value, bound)
    )
      continue;
    if (
      !solutions.some(
        (v) =>
          Math.abs(v - value) <=
          128 *
            Number.EPSILON *
            Math.max(Number.MIN_VALUE, Math.abs(v), Math.abs(value)),
      )
    )
      solutions.push(value);
  }
  return solutions;
}
