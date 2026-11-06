import type { MathNode } from "mathjs";
import { scalar, scalarFromNode } from "./math";
import { rational } from "./exact";
import { assertAffineParameters } from "./regression";
import { solveScalarRelation } from "./relations";
import type { Angle, ParameterBounds, Scalar } from "@/src/types/calculator";

// Small, bounded algebra for SAT relations. Rational coefficients make branch
// decisions exact: cancellation must not turn a free scale into an isolated root.
type Q = { n: bigint; d: bigint };
type Poly = Map<string, Q>; // sorted single-letter factors, e.g. "aab"
const gcd = (a: bigint, b: bigint): bigint => (b ? gcd(b, a % b) : a);
function q(n: bigint, d = 1n): Q {
  if (!d) throw new Error("Undefined algebraic denominator.");
  if (n.toString().length + d.toString().length > 600) throw complex();
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n < 0n ? -n : n, d);
  return { n: n / g, d: d / g };
}
function numberQ(value: number): Q {
  if (!Number.isFinite(value))
    throw new Error("Use finite real constants in a system.");
  const [mantissa, exponent = "0"] = value.toString().split("e");
  const decimals = mantissa.split(".")[1]?.length ?? 0;
  const power = Number(exponent) - decimals;
  return power >= 0
    ? q(BigInt(mantissa.replace(".", "")) * 10n ** BigInt(power))
    : q(BigInt(mantissa.replace(".", "")), 10n ** BigInt(-power));
}
const val = (a: Q) => {
  const negative = a.n < 0n,
    n = (negative ? -a.n : a.n).toString(),
    d = a.d.toString();
  return (
    (negative ? -1 : 1) *
    (Number(n.slice(0, 16)) / Number(d.slice(0, 16))) *
    10 ** (Math.max(0, n.length - 16) - Math.max(0, d.length - 16))
  );
};
const plus = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const times = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const inverse = (a: Q) => q(a.d, a.n);
const constant = (a: Q): Poly => (a.n ? new Map([["", a]]) : new Map());
const variable = (name: string): Poly => new Map([[name, q(1n)]]);
const complex = () =>
  new Error(
    "This nonlinear system exceeds supported bounded elimination (two coupled variables, degree four per equation, resultant degree eight). Use simpler polynomial relations.",
  );
function add(a: Poly, b: Poly): Poly {
  const out = new Map(a);
  for (const [key, value] of b) {
    const next = plus(out.get(key) ?? q(0n), value);
    if (next.n) out.set(key, next);
    else out.delete(key);
  }
  if (out.size > 128) throw complex();
  return out;
}
const scale = (a: Poly, c: Q): Poly =>
  new Map([...a].filter(() => c.n !== 0n).map(([k, v]) => [k, times(v, c)]));
function multiply(a: Poly, b: Poly): Poly {
  let out: Poly = new Map();
  for (const [ka, va] of a)
    for (const [kb, vb] of b) {
      const key = [...ka, ...kb].sort().join("");
      if (key.length > 8) throw complex();
      out = add(out, new Map([[key, times(va, vb)]]));
    }
  return out;
}
const symbols = (p: Poly) => [...new Set([...p.keys()].join(""))].sort();
const isConstant = (p: Poly) => !symbols(p).length;
function substitute(p: Poly, name: string, replacement: Poly): Poly {
  let out: Poly = new Map();
  for (const [key, coefficient] of p) {
    let term = constant(coefficient);
    for (const letter of key)
      term = multiply(term, letter === name ? replacement : variable(letter));
    out = add(out, term);
  }
  return out;
}
function expression(p: Poly): Scalar {
  return scalar(
    [...p]
      .map(
        ([key, c]) => `(${c.n}/${c.d})${key ? "*" + [...key].join("*") : ""}`,
      )
      .join("+") || "0",
  );
}
function univariateGcd(a: Poly, b: Poly, name: string): Poly {
  const degree = (p: Poly) => Math.max(...[...p.keys()].map((k) => k.length));
  let steps = 0;
  while (b.size) {
    let remainder = new Map(a);
    const db = degree(b),
      cb = b.get(name.repeat(db))!;
    while (remainder.size && degree(remainder) >= db) {
      if (++steps > 80) throw complex();
      const dr = degree(remainder),
        cr = remainder.get(name.repeat(dr))!;
      remainder = add(
        remainder,
        scale(
          multiply(b, variablePower(name, dr - db)),
          times(q(-1n), times(cr, inverse(cb))),
        ),
      );
    }
    a = b;
    b = remainder;
  }
  return scale(a, inverse(a.get(name.repeat(degree(a)))!));
}
const variablePower = (name: string, power: number): Poly =>
  new Map([[name.repeat(power), q(1n)]]);

const degree = (p: Poly) => Math.max(0, ...[...p.keys()].map((k) => k.length));
const proportional = (a: Poly, b: Poly) => {
  const [key, c] = [...b][0];
  return !add(
    a,
    scale(b, times(q(-1n), times(a.get(key) ?? q(0n), inverse(c)))),
  ).size;
};

/** Sylvester determinant over exact rational polynomials. Subset dynamic
 * programming bounds work by 2^8 states, rather than enumerating permutations.
 * No pivot division: vanishing leading coefficients must retain their fibers. */
function resultant(a: Poly, b: Poly, eliminate: string): Poly {
  const coefficients = (p: Poly) => {
    const out: Poly[] = [];
    for (const [key, c] of p) {
      const power = [...key].filter((n) => n === eliminate).length;
      out[power] = add(
        out[power] ?? new Map(),
        new Map([[key.replaceAll(eliminate, ""), c]]),
      );
    }
    return Array.from({ length: out.length }, (_, i) => out[i] ?? new Map());
  };
  const ac = coefficients(a),
    bc = coefficients(b),
    m = ac.length - 1,
    n = bc.length - 1,
    size = m + n;
  if (m < 1 || n < 1 || size > 8) throw complex();
  const matrix = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const c = row < n ? ac : bc,
        shift = row < n ? row : row - n;
      return c[c.length - 1 - (col - shift)] ?? new Map<string, Q>();
    }),
  );
  const memo = new Map<number, Poly>();
  const determinant = (mask: number, row: number): Poly => {
    if (row === size) return constant(q(1n));
    if (memo.has(mask)) return memo.get(mask)!;
    let out: Poly = new Map(),
      position = 0;
    for (let col = 0; col < size; col++) {
      if (mask & (1 << col)) continue;
      if (matrix[row][col].size)
        out = add(
          out,
          scale(
            multiply(matrix[row][col], determinant(mask | (1 << col), row + 1)),
            q(position % 2 ? -1n : 1n),
          ),
        );
      position++;
    }
    memo.set(mask, out);
    return out;
  };
  return determinant(0, 0);
}

/** A single conic may be a real curve, empty, or one isolated point. Classify
 * via the exact discriminant in one coordinate; never sample a putative family. */
function conic(p: Poly, names: string[]): "family" | "empty" | Poly {
  let [x, y] = names;
  if (!p.has(x + x)) [x, y] = [y, x];
  const A = p.get(x + x);
  if (!A) return "family"; // linear in one coordinate with nonzero polynomial coefficient
  const B = p.get([x, y].sort().join("")) ?? q(0n),
    C = p.get(y + y) ?? q(0n),
    D = p.get(x) ?? q(0n),
    E = p.get(y) ?? q(0n),
    F = p.get("") ?? q(0n);
  const u = plus(times(B, B), times(q(-4n), times(A, C))),
    v = plus(times(q(2n), times(B, D)), times(q(-4n), times(A, E))),
    w = plus(times(D, D), times(q(-4n), times(A, F)));
  if (u.n > 0n || (!u.n && v.n)) return "family";
  if (!u.n) return w.n < 0n ? "empty" : "family";
  const maximum = plus(
    w,
    times(q(-1n), times(times(v, v), inverse(times(q(4n), u)))),
  );
  if (maximum.n > 0n) return "family";
  if (maximum.n < 0n) return "empty";
  // The discriminant touches zero at exactly one y. Feed that coordinate back
  // through the ordinary univariate/back-substitution path.
  return add(variable(y), constant(times(v, inverse(times(q(2n), u)))));
}
type Algebra = { numerator: Poly; denominator: Poly; guards: Poly[] };
function algebra(s: Scalar, names: string[], angle: Angle): Algebra {
  const visit = (node: MathNode): Algebra => {
    const n = node as any;
    if (n.type === "ParenthesisNode") return visit(n.content);
    if (n.type === "SymbolNode" && names.includes(n.name))
      return {
        numerator: variable(n.name),
        denominator: constant(q(1n)),
        guards: [],
      };
    let depends = false;
    node.traverse((child) => {
      if (child.type === "SymbolNode" && names.includes(child.toString()))
        depends = true;
    });
    if (
      !depends &&
      !(n.type === "OperatorNode" && ["+", "-", "*", "/"].includes(n.op))
    )
      return {
        numerator: constant(numberQ(scalarFromNode(node).value({}, {}, angle))),
        denominator: constant(q(1n)),
        guards: [],
      };
    if (n.type !== "OperatorNode") throw complex();
    const a = visit(n.args[0]);
    if (n.args.length === 1)
      return {
        ...a,
        numerator: scale(a.numerator, q(n.op === "-" ? -1n : 1n)),
      };
    if (n.op === "^") {
      const power = scalarFromNode(n.args[1]).value({}, {}, angle);
      if (!Number.isInteger(power) || Math.abs(power) > 4) throw complex();
      let numerator = constant(q(1n)),
        denominator = constant(q(1n));
      for (let i = 0; i < Math.abs(power); i++) {
        numerator = multiply(
          numerator,
          power < 0 ? a.denominator : a.numerator,
        );
        denominator = multiply(
          denominator,
          power < 0 ? a.numerator : a.denominator,
        );
      }
      return {
        numerator,
        denominator,
        guards: [...a.guards, ...(power < 0 ? [a.numerator] : [])],
      };
    }
    const b = visit(n.args[1]),
      guards = [...a.guards, ...b.guards];
    if (["+", "-"].includes(n.op))
      return {
        numerator: add(
          multiply(a.numerator, b.denominator),
          scale(
            multiply(b.numerator, a.denominator),
            q(n.op === "-" ? -1n : 1n),
          ),
        ),
        denominator: multiply(a.denominator, b.denominator),
        guards,
      };
    if (n.op === "*")
      return {
        numerator: multiply(a.numerator, b.numerator),
        denominator: multiply(a.denominator, b.denominator),
        guards,
      };
    if (n.op === "/")
      return {
        numerator: multiply(a.numerator, b.denominator),
        denominator: multiply(a.denominator, b.numerator),
        guards: [...guards, b.numerator],
      };
    throw complex();
  };
  return visit(s.node);
}

type Branch = {
  assignments: Record<string, Poly>;
  free: string[];
  guards: Poly[];
  intervals?: ParameterBounds;
  implicit?: boolean;
};
export interface FiniteSystemResult {
  kind: "determined" | "multiple" | "partial" | "underdetermined";
  parameters: Record<string, number>;
  solutions?: Record<string, number>[];
  free: string[];
  message?: string;
  /** A deterministic feasible member of a free family. Exact equation callers
   * deliberately ignore this; symbolic finite-list fitting may publish it. */
  representative?: Record<string, number>;
  quantity: (s: Scalar) => {
    value?: number;
    values?: number[];
    message?: string;
  };
}

/** Exact elimination first, followed only by the existing bounded real scalar
 * root isolator. No multivariable local minimum is accepted as a solution.
 * Unsupported coupled polynomials fail explicitly rather than guessing a family.
 */
function solveFiniteSystemCore(
  relations: { left: Scalar; right: Scalar }[],
  names: string[],
  bounds: ParameterBounds,
  angle: Angle,
): FiniteSystemResult {
  if (!names.length || names.length > 5 || relations.length > 12)
    throw complex();
  const equations: Poly[] = [],
    guards: Poly[] = [];
  for (const { left, right } of relations) {
    const a = algebra(left, names, angle),
      b = algebra(right, names, angle);
    equations.push(
      add(
        multiply(a.numerator, b.denominator),
        scale(multiply(b.numerator, a.denominator), q(-1n)),
      ),
    );
    guards.push(...a.guards, ...b.guards, a.denominator, b.denominator);
  }
  for (const name of names) {
    const b = bounds[name];
    if (b?.min !== undefined && b.min === b.max && !b.minOpen && !b.maxOpen)
      equations.push(add(variable(name), constant(numberQ(-b.min))));
  }
  const branches: Branch[] = [];
  // Rounding in one component must not disable exact contradiction/GCD checks
  // in another. Track coefficient provenance through each substitution.
  const rounded = new WeakSet<Poly>();
  const verified = (solution: Record<string, number>, approximate: boolean) => {
    // Domain holes can acquire machine-level residuals after an irrational root
    // is substituted. Compare each ORIGINAL guard with its evaluation magnitude.
    if (
      approximate &&
      guards.some((p) => {
        let sum = 0,
          magnitude = 0;
        for (const [key, c] of p) {
          const term = [...key].reduce((v, name) => v * solution[name], val(c));
          sum += term;
          magnitude += Math.abs(term);
        }
        return (
          !Number.isFinite(sum) ||
          Math.abs(sum) <= 128 * Number.EPSILON * magnitude
        );
      })
    )
      return false;
    try {
      return relations.every(({ left, right }) => {
        const a = left.value(solution, {}, angle),
          b = right.value(solution, {}, angle);
        return (
          [a, b].every(Number.isFinite) &&
          Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
        );
      });
    } catch {
      return false;
    }
  };
  let budget = 160;
  const search = (
    eqs: Poly[],
    gs: Poly[],
    assignments: Record<string, Poly>,
    approximate = false,
  ) => {
    if (--budget < 0 || branches.length > 32) throw complex();
    // Approximate constants occur only after scalar root isolation. Full original
    // residual verification below remains mandatory for every isolated solution.
    if (eqs.some((p) => isConstant(p) && p.size && !rounded.has(p))) return;
    eqs = eqs.filter((p) => !isConstant(p));
    if (gs.some((p) => !p.size)) return;
    const assign = (
      name: string,
      replacement: Poly,
      rest: Poly[],
      approx = approximate,
    ) => {
      const apply = (p: Poly) => {
        const out = substitute(p, name, replacement);
        if (
          rounded.has(p) ||
          (rounded.has(replacement) && symbols(p).includes(name))
        )
          rounded.add(out);
        return out;
      };
      search(
        rest.map(apply),
        gs.map(apply),
        {
          ...Object.fromEntries(
            Object.entries(assignments).map(([key, p]) => [key, apply(p)]),
          ),
          [name]: replacement,
        },
        approx,
      );
    };
    // A constant, nonzero pivot is safe even when every variable can be zero.
    for (let i = 0; i < eqs.length; i++)
      for (const name of symbols(eqs[i])) {
        const p = eqs[i],
          coefficient = p.get(name);
        if (
          coefficient &&
          [...p.keys()].every((key) => !key.includes(name) || key === name)
        ) {
          const rest = new Map(p);
          rest.delete(name);
          const replacement = scale(rest, times(q(-1n), inverse(coefficient)));
          if (rounded.has(p)) rounded.add(replacement);
          assign(
            name,
            replacement,
            eqs.filter((_, j) => j !== i),
          );
          return;
        }
      }
    // Split common variable factors into zero and remaining-polynomial branches;
    // division by the scale is never implicit. Domain guards prune forbidden zeros.
    for (let i = 0; i < eqs.length; i++) {
      const p = eqs[i],
        common = symbols(p).filter((name) =>
          [...p.keys()].every((key) => key.includes(name)),
        );
      if (
        (common.length && p.size > 1) ||
        (common.length && [...p.keys()][0].length > 1)
      ) {
        const name = common[0];
        assign(
          name,
          new Map(),
          eqs.filter((_, j) => j !== i),
        );
        const divided = new Map(
          [...p].map(([key, c]) => [key.replace(name, ""), c]),
        );
        if (rounded.has(p)) rounded.add(divided);
        search(
          eqs.map((e, j) => (j === i ? divided : e)),
          gs,
          assignments,
          approximate,
        );
        return;
      }
    }
    for (let i = 0; i < eqs.length; i++) {
      let p = eqs[i];
      const free = symbols(p);
      if (free.length !== 1) continue;
      const name = free[0];
      // Intersect univariate equations algebraically before approximating roots.
      // Merely accepting two small residuals can invent a solution to two close
      // but inconsistent equations such as a²=2 and a²=2.0000000001.
      const sameVariable = eqs
        .map((e, j) => ({ e, j }))
        .filter(
          ({ e, j }) =>
            symbols(e).length === 1 &&
            symbols(e)[0] === name &&
            (rounded.has(p) ? j === i : !rounded.has(e)),
        );
      const roundedFiber = rounded.has(p);
      for (const { e, j } of sameVariable)
        if (j !== i) p = univariateGcd(p, e, name);
      if (isConstant(p)) return;
      // The scalar isolator has a bounded search radius for degree >= 3. Do
      // not advertise an exhaustive finite system if its Cauchy bound exceeds
      // that radius (quadratic/linear formulae have no such window).
      if (degree(p) >= 3) {
        const leading = p.get(name.repeat(degree(p)))!;
        if (
          [...p].some(
            ([key, c]) =>
              key.length < degree(p) &&
              val(times(c, inverse(leading))) ** 2 > (1e6 - 1) ** 2,
          )
        )
          throw complex();
      }
      const s = expression(p);
      let roots: number[];
      try {
        roots = solveScalarRelation(
          s,
          name,
          (s, locals = {}) => s.value(locals, {}, angle),
          angle,
          bounds[name],
        ).solutions;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("No real solution")
        )
          return;
        throw error;
      }
      for (const root of roots) {
        const pair = rational(root, 1000000, 1e-12);
        const candidate = pair
          ? q(BigInt(pair[0]), BigInt(pair[1]))
          : numberQ(root);
        const exact = !substitute(p, name, constant(candidate)).size;
        const replacement = constant(exact ? candidate : numberQ(root));
        if (!exact || roundedFiber) rounded.add(replacement);
        assign(
          name,
          replacement,
          eqs.filter((_, j) => !sameVariable.some((e) => e.j === j)),
          approximate || !exact,
        );
      }
      return;
    }
    if (eqs.length) {
      // Work on one connected component, even when a literal finite list
      // contains several independent components.
      const component = [eqs[0]],
        coupled = new Set(symbols(eqs[0]));
      for (let changed = true; changed;) {
        changed = false;
        for (const p of eqs)
          if (
            !component.includes(p) &&
            symbols(p).some((n) => coupled.has(n))
          ) {
            component.push(p);
            symbols(p).forEach((n) => coupled.add(n));
            changed = true;
          }
      }
      if (coupled.size !== 2 || component.some((p) => degree(p) > 4))
        throw complex();
      const ns = [...coupled].sort();
      const independent = component.filter(
        (p, i) => !component.slice(0, i).some((e) => proportional(p, e)),
      );
      if (independent.length === 1 && degree(independent[0]) <= 2) {
        const classification = conic(independent[0], ns);
        if (classification === "empty") return;
        if (classification !== "family") {
          search([...eqs, classification], gs, assignments, approximate);
          return;
        }
        // Implicit conic families need no arbitrary representative. Interval
        // feasibility for nonlinear families is deliberately not guessed.
        if (
          approximate ||
          component.length !== eqs.length ||
          gs.some((p) => !isConstant(p)) ||
          names.some((n) => bounds[n])
        )
          throw new Error(
            "Restrictions or domains on an implicit nonlinear free family are unsupported.",
          );
        branches.push({
          assignments,
          free: names.filter((n) => !assignments[n]),
          guards: gs,
          implicit: true,
        });
        return;
      }
      for (let i = 0; i < independent.length; i++)
        for (let j = i + 1; j < independent.length; j++)
          for (const name of ns) {
            const eliminated = resultant(independent[i], independent[j], name);
            if (rounded.has(independent[i]) || rounded.has(independent[j]))
              rounded.add(eliminated);
            if (!eliminated.size) continue; // shared curve: never assume isolated points
            search([...eqs, eliminated], gs, assignments, approximate);
            return;
          }
      throw complex();
    }
    const free = names.filter((name) => !assignments[name]);
    if (free.length && approximate)
      throw new Error(
        "A free solution family with approximate algebraic coefficients is unsupported.",
      );
    const branch: Branch = { assignments, free, guards: gs };
    if (!feasible(branch, names, bounds)) return;
    const fixed = free.find((name) => {
      const b = branch.intervals?.[name];
      return b?.min !== undefined && b.min === b.max;
    });
    if (fixed) {
      assign(fixed, constant(numberQ(branch.intervals![fixed].min!)), []);
      return;
    }
    if (
      !free.length &&
      !verified(
        Object.fromEntries(
          names.map((name) => [name, val(assignments[name].get("") ?? q(0n))]),
        ),
        approximate,
      )
    )
      return;
    branches.push(branch);
  };
  search(equations, guards, {});
  if (!branches.length)
    throw new Error("No real solution satisfies the system and restrictions.");
  const quantity = (
    s: Scalar,
  ): { value?: number; values?: number[]; message?: string } => {
    const values: number[] = [];
    for (const branch of branches) {
      let a: Algebra;
      try {
        a = algebra(s, names, angle);
      } catch {
        return {
          message: "This quantity needs an unsupported algebraic reduction.",
        };
      }
      for (const [name, p] of Object.entries(branch.assignments)) {
        a.numerator = substitute(a.numerator, name, p);
        a.denominator = substitute(a.denominator, name, p);
        a.guards = a.guards.map((g) => substitute(g, name, p));
      }
      if (
        a.guards.some((g) => !knownNonzero(g, branch)) ||
        !knownNonzero(a.denominator, branch)
      )
        return {
          message:
            "This quantity's domain is not established for every solution.",
        };
      // A rational quantity is invariant if numerator = k * denominator,
      // including ratios of free scales. Original denominator zeros stay holes.
      const key = [...a.denominator.keys()][0];
      const k = times(
        a.numerator.get(key) ?? q(0n),
        inverse(a.denominator.get(key)!),
      );
      if (add(a.numerator, scale(a.denominator, times(q(-1n), k))).size)
        return branch.implicit
          ? {
              message:
                "This quantity needs an unsupported algebraic reduction on the implicit family.",
            }
          : {};
      const value = val(k);
      if (!Number.isFinite(value))
        return {
          message: "This quantity is outside the supported numeric range.",
        };
      if (
        !values.some(
          (v) =>
            Math.abs(v - value) <=
            128 *
              Number.EPSILON *
              Math.max(Number.MIN_VALUE, Math.abs(v), Math.abs(value)),
        )
      )
        values.push(value);
    }
    return values.length === 1
      ? { value: values[0] }
      : { values: values.sort((a, b) => a - b) };
  };
  const parameters: Record<string, number> = {};
  for (const name of names) {
    const value = quantity(scalar(name)).value;
    if (value !== undefined) parameters[name] = value;
  }
  const hasFamily = branches.some((b) => b.free.length);
  const solutions = hasFamily
    ? undefined
    : branches.map((b) =>
        Object.fromEntries(
          names.map((name) => [
            name,
            val(b.assignments[name].get("") ?? q(0n)),
          ]),
        ),
      );
  if (solutions) {
    solutions.sort((a, b) => {
      for (const name of [...names].sort())
        if (a[name] !== b[name]) return a[name] - b[name];
      return 0;
    });
    for (let i = solutions.length - 1; i > 0; i--)
      if (
        names.every(
          (n) =>
            Math.abs(solutions[i][n] - solutions[i - 1][n]) <=
            128 *
              Number.EPSILON *
              Math.max(
                Number.MIN_VALUE,
                Math.abs(solutions[i][n]),
                Math.abs(solutions[i - 1][n]),
              ),
        )
      )
        solutions.splice(i, 1);
  }
  const free = names.filter((name) => !Object.hasOwn(parameters, name)).sort();
  const kind = hasFamily
    ? Object.keys(parameters).length
      ? "partial"
      : "underdetermined"
    : solutions!.length > 1
      ? "multiple"
      : "determined";
  // Fitting can use a concrete member of a free exact family without changing
  // the family's algebraic classification. Prefer 1 for free scales, then a
  // short deterministic set of simple values. Candidate verification remains
  // mandatory, and the least-degenerate valid branch wins.
  const allowed = (value: number, bound: ParameterBounds[string] | undefined) =>
    Number.isFinite(value) &&
    (bound?.min === undefined ||
      (bound.minOpen ? value > bound.min : value >= bound.min)) &&
    (bound?.max === undefined ||
      (bound.maxOpen ? value < bound.max : value <= bound.max));
  const choices = (
    bound: ParameterBounds[string] | undefined,
    preferred: number[] = [],
  ) => {
    const values = [...preferred, 1, -1, 2, -2, 0.5, -0.5, 0];
    if (bound?.min !== undefined && bound.max !== undefined)
      values.push((bound.min + bound.max) / 2);
    if (bound?.min !== undefined)
      values.push(bound.minOpen ? bound.min + 1 : bound.min, bound.min + 1);
    if (bound?.max !== undefined)
      values.push(bound.maxOpen ? bound.max - 1 : bound.max, bound.max - 1);
    return values
      .filter(
        (value, index) =>
          allowed(value, bound) && values.indexOf(value) === index,
      )
      .slice(0, 10);
  };
  const polyValue = (p: Poly, coordinates: Record<string, number>) =>
    [...p].reduce(
      (sum, [key, coefficient]) =>
        sum +
        [...key].reduce(
          (term, name) => term * coordinates[name],
          val(coefficient),
        ),
      0,
    );
  let representative: Record<string, number> | undefined,
    representativeScore = -1;
  for (const branch of branches) {
    if (!branch.free.length || branch.implicit) continue;
    const normalizationValues = (freeName: string) => {
      const values: number[] = [];
      // A scale that participates in a product with an identified parameter is
      // a more natural normalization target than the solver's incidental free
      // coordinate (b rather than c in the SAT percentage example).
      for (const name of names) {
        const p = branch.assignments[name] ?? variable(name);
        if (
          symbols(p).join() !== freeName ||
          !equations.some((equation) =>
            [...equation.keys()].some(
              (key) => key.length > 1 && key.includes(name),
            ),
          )
        )
          continue;
        const coefficient = p.get(freeName),
          offset = val(p.get("") ?? q(0n));
        if (!coefficient) continue;
        const slope = val(coefficient);
        values.push((1 - offset) / slope, (-1 - offset) / slope);
      }
      return values;
    };
    const coordinates: Record<string, number> = {};
    let attempts = 0;
    const visit = (index: number) => {
      if (++attempts > 10000) return;
      if (index < branch.free.length) {
        const name = branch.free[index];
        for (const value of choices(
          branch.intervals?.[name],
          normalizationValues(name),
        )) {
          coordinates[name] = value;
          visit(index + 1);
        }
        return;
      }
      const candidate = Object.fromEntries(
        names.map((name) => [
          name,
          branch.assignments[name]
            ? polyValue(branch.assignments[name], coordinates)
            : coordinates[name],
        ]),
      );
      if (
        Object.values(candidate).some((value) => !Number.isFinite(value)) ||
        names.some((name) => !allowed(candidate[name], bounds[name])) ||
        branch.guards.some((guard) => polyValue(guard, coordinates) === 0) ||
        !verified(candidate, false)
      )
        return;
      const score = Object.values(candidate).filter(
        (value) => Math.abs(value) > 128 * Number.EPSILON,
      ).length;
      if (score > representativeScore) {
        representative = candidate;
        representativeScore = score;
      }
    };
    visit(0);
  }
  return {
    kind,
    parameters,
    solutions,
    free,
    quantity,
    representative,
    message: hasFamily
      ? `${free.join(", ")} not uniquely determined; free solution family${branches.length > 1 ? " (including degenerate branches)" : ""}.`
      : undefined,
  };
}

const isLetter = (name: string) => /^[A-Za-z]$/.test(name);

/** `Poly` keys are strings of single-letter factors, so a multi-character
 * unknown such as `x_1` is aliased to one unused letter on the way in and
 * restored on the way out. Single-letter systems take the core path unchanged.
 */
export function solveFiniteSystem(
  relations: { left: Scalar; right: Scalar }[],
  names: string[],
  bounds: ParameterBounds,
  angle: Angle,
): FiniteSystemResult {
  if (names.every(isLetter))
    return solveFiniteSystemCore(relations, names, bounds, angle);
  const used = new Set<string>(names);
  for (const { left, right } of relations)
    for (const n of [...left.symbols, ...right.symbols]) used.add(n);
  used.add("e");
  const pool = [
    ..."abcdfghjklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ].filter((c) => !used.has(c));
  const toInner = new Map<string, string>(),
    toOuter = new Map<string, string>();
  for (const name of [...names].sort()) {
    const alias = isLetter(name) ? name : pool.shift();
    if (!alias) throw complex();
    toInner.set(name, alias);
    toOuter.set(alias, name);
  }
  const rename = (s: Scalar): Scalar =>
    scalarFromNode(
      s.node.transform((node: MathNode) => {
        const name = node.type === "SymbolNode" ? node.toString() : "";
        return toInner.has(name) ? scalar(toInner.get(name)!).node : node;
      }),
    );
  const back = <T>(record: Record<string, T>) =>
    Object.fromEntries(
      Object.entries(record).map(([k, v]) => [toOuter.get(k) ?? k, v]),
    );
  const inner = solveFiniteSystemCore(
    relations.map((r) => ({ left: rename(r.left), right: rename(r.right) })),
    names.map((n) => toInner.get(n)!),
    Object.fromEntries(
      Object.entries(bounds).map(([k, v]) => [toInner.get(k) ?? k, v]),
    ),
    angle,
  );
  const free = inner.free.map((n) => toOuter.get(n) ?? n).sort();
  return {
    ...inner,
    parameters: back(inner.parameters),
    solutions: inner.solutions?.map((solution) => back(solution)),
    free,
    representative: inner.representative && back(inner.representative),
    message: inner.message?.replace(/^.*?(?= not uniquely)/, free.join(", ")),
    quantity: (s) => inner.quantity(rename(s)),
  };
}

/** Feasibility is proved using intervals, never inferred from sampled family
 * members. Coupled/nonlinear bounds are deliberately outside this small solver.
 */
function feasible(
  branch: Branch,
  names: string[],
  bounds: ParameterBounds,
): boolean {
  const intervals: ParameterBounds = {};
  for (const name of branch.free) intervals[name] = { ...bounds[name] };
  for (const name of names) {
    const p = branch.assignments[name] ?? variable(name),
      bound = bounds[name];
    if (!bound) continue;
    const free = symbols(p),
      c = val(p.get("") ?? q(0n));
    if (!free.length) {
      if (
        (bound.min !== undefined &&
          (bound.minOpen ? c <= bound.min : c < bound.min)) ||
        (bound.max !== undefined &&
          (bound.maxOpen ? c >= bound.max : c > bound.max))
      )
        return false;
      continue;
    }
    if (free.length !== 1 || [...p.keys()].some((key) => key.length > 1))
      throw new Error(
        "Nonlinear or coupled bounds on a free solution family are unsupported.",
      );
    const v = free[0],
      a = val(p.get(v)!),
      interval = (intervals[v] ??= {});
    for (const side of ["min", "max"] as const) {
      if (bound[side] === undefined) continue;
      const target = a > 0 ? side : side === "min" ? "max" : "min",
        value = (bound[side]! - c) / a;
      const open = bound[side === "min" ? "minOpen" : "maxOpen"];
      if (
        interval[target] === undefined ||
        (target === "min" ? value > interval.min! : value < interval.max!)
      ) {
        interval[target] = value;
        interval[target === "min" ? "minOpen" : "maxOpen"] = open;
      } else if (value === interval[target])
        interval[target === "min" ? "minOpen" : "maxOpen"] ||= open;
    }
  }
  for (const interval of Object.values(intervals))
    if (
      interval.min !== undefined &&
      interval.max !== undefined &&
      (interval.min > interval.max ||
        (interval.min === interval.max &&
          (interval.minOpen || interval.maxOpen)))
    )
      return false;
  // Fixed free coordinates must be substituted before checking denominator holes.
  // All remaining coordinates have open interval interiors; a nonzero polynomial
  // cannot vanish on that entire box, so finitely many domain holes do not empty it.
  for (let guard of branch.guards) {
    for (const [name, b] of Object.entries(intervals))
      if (b.min !== undefined && b.min === b.max)
        guard = substitute(guard, name, constant(numberQ(b.min)));
    if (!guard.size) return false;
  }
  branch.intervals = intervals;
  return true;
}

function nonzeroOnFamily(p: Poly, intervals: ParameterBounds): boolean {
  if (!p.size) return false;
  if (isConstant(p)) return true;
  if ([...p.keys()].some((key) => key.length > 1)) return false;
  let min = val(p.get("") ?? q(0n)),
    max = min,
    minOpen = false,
    maxOpen = false;
  for (const name of symbols(p)) {
    const c = val(p.get(name)!),
      b = intervals[name] ?? {};
    min += c * (c > 0 ? (b.min ?? -Infinity) : (b.max ?? Infinity));
    max += c * (c > 0 ? (b.max ?? Infinity) : (b.min ?? -Infinity));
    minOpen ||= !!(c > 0 ? b.minOpen : b.maxOpen);
    maxOpen ||= !!(c > 0 ? b.maxOpen : b.minOpen);
  }
  return min > 0 || (min === 0 && minOpen) || max < 0 || (max === 0 && maxOpen);
}

function knownNonzero(p: Poly, branch: Branch): boolean {
  if (nonzeroOnFamily(p, branch.intervals ?? {})) return true;
  if (!p.size) return false;
  // Original rational domains are part of the valid family, so a denominator
  // already excluded there need not be excluded again by a strict interval.
  return branch.guards.some((g) => {
    if (!g.size || g.size !== p.size) return false;
    const [key, c] = [...g][0],
      coefficient = p.get(key);
    return (
      !!coefficient &&
      !add(p, scale(g, times(q(-1n), times(coefficient, inverse(c))))).size
    );
  });
}

/** Literal finite lists only; named lists, ranges, tables and purely numeric
 * observed lists retain existing least-squares semantics. */
export function exactListRelations(
  left: Scalar,
  right: Scalar,
  names: string[],
): { left: Scalar; right: Scalar }[] | undefined {
  const unwrap = (node: MathNode): any =>
    node.type === "ParenthesisNode" ? unwrap((node as any).content) : node;
  const a = unwrap(left.node),
    b = unwrap(right.node);
  if (a.type !== "ArrayNode" || b.type !== "ArrayNode") return;
  const items = [...a.items, ...b.items] as MathNode[];
  // Keep numeric observations ~ affine models on the fitting path. A literal
  // nonlinear vector with multiple parameters is a finite algebraic system;
  // named data lists/ranges inside its elements are excluded below.
  const symbolic = (nodes: MathNode[]) =>
    nodes.some((node) =>
      [...scalarFromNode(node).symbols].some((name) => names.includes(name)),
    );
  if (!symbolic(a.items) || !symbolic(b.items)) {
    if (names.length < 2) return;
    try {
      items.forEach((node) => assertAffineParameters(node, names));
      return;
    } catch {
      /* nonlinear literal system */
    }
  }
  if (
    items.some((node) =>
      [...scalarFromNode(node).symbols].some(
        (name) => !names.includes(name) && !["pi", "e", "tau"].includes(name),
      ),
    )
  )
    return;
  if (
    !a.items.length ||
    a.items.length !== b.items.length ||
    items.some((node) => node.type === "ArrayNode" || node.type === "RangeNode")
  )
    throw new Error("Exact systems need equally sized flat finite lists.");
  return a.items.map((node: MathNode, i: number) => ({
    left: scalarFromNode(node),
    right: scalarFromNode(b.items[i]),
  }));
}
