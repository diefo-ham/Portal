import {
  create,
  parseDependencies,
  ConditionalNodeDependencies,
} from "mathjs/number";
import type { MathNode } from "mathjs";
import { parseListRanges, rangeValues } from "./listRanges";
import { restrictionSource } from "./restrictionSyntax";
import { piecewiseSource } from "./piecewise";
import {
  isPoint,
  lowerPoints,
  makePoint,
  pickPoints,
  pointComponent,
  pointFunction,
  pointListOf,
  pointOperator,
} from "./points";
import type { Numeric, Scalar, Value } from "@/src/types/calculator";
const { parse, ConditionalNode } = create({
  parseDependencies,
  ConditionalNodeDependencies,
});

const constants: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: 2 * Math.PI,
};
const builtin = new Set([
  "point",
  "distance",
  "midpoint",
  "sqrt",
  "cbrt",
  "nthroot",
  "abs",
  "sin",
  "cos",
  "tan",
  "sec",
  "csc",
  "cot",
  "asec",
  "acsc",
  "acot",
  "asin",
  "acos",
  "atan",
  "log",
  "ln",
  "exp",
  "floor",
  "ceil",
  "round",
  "sign",
  "gcd",
  "lcm",
  "mod",
  "ncr",
  "npr",
  "min",
  "max",
  "sum",
  "prod",
  "sinh",
  "cosh",
  "tanh",
  "asinh",
  "acosh",
  "atanh",
  "sort",
  "join",
  "length",
  "corr",
  "mean",
  "median",
  "quartile",
  "quantile",
  "stdev",
  "stdevp",
  "var",
  "varp",
  "variance",
  "mad",
  "count",
  "total",
  "stats",
]);
const listAggregates = new Set([
  "sort",
  "length",
  "mean",
  "median",
  "quartile",
  "quantile",
  "stdev",
  "stdevp",
  "var",
  "varp",
  "variance",
  "mad",
  "count",
  "total",
  "stats",
]);
const factorial = (n: number) => {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
};
/** p/q for a decimal that is a simple fraction, e.g. 0.3333333333333333 is 1/3. */
function simpleFraction(value: number): { p: number; q: number } | undefined {
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let x = value;
  for (let i = 0; i < 20; i++) {
    const a = Math.floor(x);
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    if (k1 > 1000) return undefined;
    if (Math.abs(value - h1 / k1) <= 1e-12 * Math.max(1, Math.abs(value)))
      return { p: h1, q: k1 };
    if (x === a) return undefined;
    x = 1 / (x - a);
  }
  return undefined;
}
/** Like Math.pow, but a negative base with an odd-denominator exponent has a real value: (-8)^(1/3) = -2. */
function power(a: number, b: number) {
  if (a >= 0 || Number.isInteger(b)) return Math.pow(a, b);
  const fraction = simpleFraction(b);
  if (!fraction || fraction.q % 2 === 0) return NaN;
  return (Math.abs(fraction.p) % 2 === 0 ? 1 : -1) * Math.pow(-a, b);
}
export const normalize = (text: string) => {
  text = text
    .trim()
    .replaceAll("−", "-")
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("π", "pi")
    .replaceAll("²", "^2")
    .replaceAll("³", "^3")
    .replaceAll("√", "sqrt")
    .replace(/%\s*of\b/gi, "*0.01*")
    .replace(/\bnCr\b/g, "ncr")
    .replace(/\bnPr\b/g, "npr")
    .replace(/\|([^|]+)\|/g, "abs($1)")
    .replace(/\b([a-zA-Z])([a-zA-Z]_\d+)\b/g, "$1*$2")
    .replace(/\b(?:arc)(sin|cos|tan|sec|csc|cot)\b/g, "a$1");
  // Bounded reference-calculator-like shorthand: a single variable, pi, or numeric atom.
  // Longer identifiers (e.g. sinwave) remain identifiers rather than being split.
  text = text.replace(
    /\b(sin|cos|tan|sec|csc|cot|asin|acos|atan|log|ln|sqrt|abs)\s*((?:pi|[a-z](?:_\d+)?|\d+(?:\.\d+)?)(?:\^(?:\(-?\d+\)|-?\d+))?)(?![\w.(^])/g,
    (_, fn, argument) => `${fn}(${argument})`,
  );
  // Familiar sin^2(x) and sin^-1(x), with nested arguments kept intact.
  const pattern =
    /\b(sin|cos|tan|sec|csc|cot)\s*\^\s*(?:\((-?\d+)\)|(-?\d+))\s*\(/;
  for (let step = 0; step < 12; step++) {
    const match = pattern.exec(text);
    if (!match) break;
    const start = match.index + match[0].length;
    let end = start,
      depth = 1;
    for (; end < text.length && depth; end++) {
      if (text[end] === "(") depth++;
      if (text[end] === ")") depth--;
    }
    if (depth) break;
    const power = match[2] || match[3],
      argument = text.slice(start, end - 1);
    const replacement =
      power === "-1"
        ? `a${match[1]}(${argument})`
        : `(${match[1]}(${argument}))^(${power})`;
    text = text.slice(0, match.index) + replacement + text.slice(end);
  }
  for (let step = 0; step < 12; step++) {
    const match = /\blog_([a-zA-Z][a-zA-Z0-9]*|\d+(?:\.\d+)?)\s*\(/.exec(text);
    if (!match) break;
    const start = match.index + match[0].length;
    let end = start,
      depth = 1;
    for (; end < text.length && depth; end++) {
      if (text[end] === "(") depth++;
      if (text[end] === ")") depth--;
    }
    if (depth) break;
    text =
      text.slice(0, match.index) +
      `log(${text.slice(start, end - 1)},${match[1]})` +
      text.slice(end);
  }
  text = text.replace(/\b([a-z])([xy])\b/g, "$1*$2");
  // Coordinates are never callable names. Keep other names intact so f(x),
  // g(t), and built-ins still use the ordinary function grammar. Match complete
  // identifier tokens, including after a coefficient in 8x(...).
  return text.replace(/[a-z][a-z0-9_]*\s*(?=\()/gi, (token) =>
    ["x", "y"].includes(token.trim()) ? `${token.trim()}*` : token,
  );
};

/** Math.js supplies grammar/precedence and TeX. Only this deliberately small AST
 * interpreter executes numeric operations: no eval, assignments, properties,
 * arbitrary calls, units, matrices, or unbounded recursion enter evaluation.
 */
/** Text grammar lowering shared by every parse site: points, then list ranges. */
const lower = (source: string) => parseListRanges(lowerPoints(source));
export function scalar(text: string): Scalar {
  if (text.length > 1200)
    throw new Error("Keep expressions under 1,200 characters.");
  for (const literal of text.match(/(?:\d+\.?\d*|\.\d+)[eE][+-]?\d+/g) ?? []) {
    if (
      !Number.isFinite(Number(literal)) ||
      (Number(literal) === 0 && /[1-9]/.test(literal.split(/[eE]/)[0]))
    )
      throw new Error("This number is outside the supported numeric range.");
  }
  const normalized = normalize(text);
  const piecewise = piecewiseSource(normalized);
  if (piecewise) {
    const condition = (list: { left: string; op: string; right: string }[]) =>
      list
        .map(
          ({ left, op, right }) => `((${lower(left)})${op}(${lower(right)}))`,
        )
        .join("*");
    let node = parse(
      piecewise.fallback ? lower(piecewise.fallback) : "0/0",
    ) as MathNode;
    for (const clause of [...piecewise.clauses].reverse())
      node = new ConditionalNode(
        parse(condition(clause.conditions)),
        parse(lower(clause.value)),
        node,
      );
    return scalarFromNode(node);
  }
  const { body, comparisons } = restrictionSource(normalized, "domain");
  let node = parse(lower(body)) as MathNode;
  try {
    // Each comparison guards the entire expression. Conditional AST nodes
    // preserve the domain through structural substitution of named functions.
    for (const { left, op, right } of [...comparisons].reverse())
      node = new ConditionalNode(
        parse(`(${lower(left)})${op}(${lower(right)})`),
        node,
        parse("0/0"),
      );
    return scalarFromNode(node);
  } catch (error) {
    if (comparisons.length)
      throw new Error(
        `Invalid domain restriction. ${error instanceof Error ? error.message : "Use numeric comparisons."}`,
      );
    throw error;
  }
}

const isAxis = (n: any): boolean =>
  n?.type === "ConstantNode" && (n.value === "x" || n.value === "y");

/** Revalidate expanded ASTs without serializing domain nodes back to text. */
export function scalarFromNode(node: MathNode): Scalar {
  const symbols = new Set<string>(),
    calls = new Set<string>();
  let count = 0;
  const check = (n: MathNode, depth = 0, condition = false) => {
    if (++count > 512 || depth > 24)
      throw new Error("This expression is too complex.");
    const a = n as any;
    if (condition) {
      // A condition is a comparison, or comparisons multiplied (all must hold).
      if (n.type === "ParenthesisNode")
        return check(a.content, depth + 1, true);
      if (n.type === "OperatorNode" && a.op === "*" && a.args.length === 2) {
        a.args.forEach((child: MathNode) => check(child, depth + 1, true));
        return;
      }
      if (n.type !== "OperatorNode" || !["<", "<=", ">", ">="].includes(a.op))
        throw new Error("Use a numeric comparison in a domain restriction.");
    }
    switch (n.type) {
      case "ConditionalNode":
        check(a.condition, depth + 1, true);
        check(a.trueExpr, depth + 1);
        check(a.falseExpr, depth + 1);
        break;
      case "ConstantNode":
        if (typeof a.value !== "number")
          throw new Error("Use real numbers only.");
        break;
      case "SymbolNode":
        if (!/^[a-z][a-z0-9_]{0,15}$/i.test(a.name))
          throw new Error("Use ordinary variable names.");
        if (!Object.hasOwn(constants, a.name)) symbols.add(a.name);
        break;
      case "ParenthesisNode":
        check(a.content, depth + 1);
        break;
      case "AccessorNode":
        if (!a.index || a.index.dimensions.length !== 1)
          throw new Error("Use one index, like L[2].");
        check(a.object, depth + 1);
        // P.x and P.y parse as an index with a string constant.
        if (!isAxis(a.index.dimensions[0]))
          check(a.index.dimensions[0], depth + 1);
        break;
      case "RangeNode":
        check(a.start, depth + 1);
        check(a.end, depth + 1);
        if (a.step) check(a.step, depth + 1);
        break;
      case "ArrayNode":
        if (
          a.items.length > 200 ||
          a.items.some((item: MathNode) => item.type === "ArrayNode")
        )
          throw new Error("Use a flat list of up to 200 values.");
        a.items.forEach((child: MathNode) => check(child, depth + 1));
        break;
      case "OperatorNode":
        if (
          !(
            condition ? ["<", "<=", ">", ">="] : ["+", "-", "*", "/", "^", "!"]
          ).includes(a.op)
        )
          throw new Error("That operator is not supported.");
        a.args.forEach((child: MathNode) => check(child, depth + 1));
        break;
      case "FunctionNode":
        if (
          a.fn.type === "SymbolNode" &&
          (a.fn.name === "sum" || a.fn.name === "prod")
        ) {
          if (
            a.args.length !== 4 ||
            a.args[1].type !== "SymbolNode" ||
            !/^[a-z]$/i.test(a.args[1].name) ||
            Object.hasOwn(constants, a.args[1].name)
          )
            throw new Error(`Write ${a.fn.name}(expression, n, start, end).`);
          const index = a.args[1].name;
          const known = symbols.has(index);
          check(a.args[0], depth + 1);
          check(a.args[2], depth + 1);
          check(a.args[3], depth + 1);
          // The index belongs to the sum, not to the surrounding workspace.
          if (!known) symbols.delete(index);
          break;
        }
        if (
          a.fn.type !== "SymbolNode" ||
          !/^[a-z][a-z0-9_]{0,15}$/i.test(a.fn.name) ||
          a.args.length < 1 ||
          a.args.length > (a.fn.name === "join" ? 8 : 2)
        )
          throw new Error("Use a supported numeric function.");
        if (!builtin.has(a.fn.name)) calls.add(a.fn.name);
        const acceptsTwo = [
          "point",
          "distance",
          "midpoint",
          "corr",
          "join",
          "log",
          "min",
          "max",
          "round",
          "gcd",
          "lcm",
          "mod",
          "ncr",
          "npr",
          "nthroot",
          "quartile",
          "quantile",
        ].includes(a.fn.name);
        if (!acceptsTwo && a.args.length !== 1)
          throw new Error("This function takes one argument.");
        if (
          [
            "point",
            "distance",
            "midpoint",
            "corr",
            "gcd",
            "lcm",
            "mod",
            "ncr",
            "npr",
            "nthroot",
            "quartile",
            "quantile",
          ].includes(a.fn.name) &&
          a.args.length !== 2
        )
          throw new Error("This function takes two arguments.");
        a.args.forEach((child: MathNode) => check(child, depth + 1));
        break;
      default:
        throw new Error(
          "Use arithmetic, functions, or an equation; this syntax is not supported.",
        );
    }
  };
  check(node);
  const evaluate: Scalar["evaluateValue"] = (scope, functions, angle) => {
    const inputAngle = angle === "degrees" ? Math.PI / 180 : 1;
    const inverseAngle = angle === "degrees" ? 180 / Math.PI : 1;
    const visit = (n: any): Value => {
      if (n.type === "ConditionalNode") {
        const condition = visit(n.condition);
        if (typeof condition !== "number")
          throw new Error(
            "Domain restriction comparisons must use scalar numbers.",
          );
        return condition === 1 ? visit(n.trueExpr) : visit(n.falseExpr);
      }
      if (n.type === "ConstantNode") return n.value;
      if (n.type === "SymbolNode") {
        const v = Object.hasOwn(constants, n.name)
          ? constants[n.name]
          : scope[n.name];
        if (typeof v !== "number" && !Array.isArray(v) && !isPoint(v))
          throw new Error(`Define ${n.name} first.`);
        return v;
      }
      if (n.type === "ParenthesisNode") return visit(n.content);
      if (n.type === "AccessorNode") {
        const list = visit(n.object);
        if (isAxis(n.index.dimensions[0])) {
          if (!isPoint(list)) throw new Error("Only a point can use .x or .y.");
          return pointComponent(list, n.index.dimensions[0].value);
        }
        if (isPoint(list)) {
          const at = visit(n.index.dimensions[0]);
          if (isPoint(at)) throw new Error("Index a list with numbers.");
          return pickPoints(list, at);
        }
        if (!Array.isArray(list))
          throw new Error("Only a list can be indexed.");
        const index = visit(n.index.dimensions[0]);
        if (isPoint(index)) throw new Error("Index a list with numbers.");
        const pick = (i: number) =>
          Number.isInteger(i) && i >= 1 && i <= list.length ? list[i - 1] : NaN;
        return Array.isArray(index) ? index.map(pick) : pick(index);
      }
      if (n.type === "RangeNode") {
        const first = visit(n.start),
          last = visit(n.end);
        const values = [
          first,
          n.step ? visit(n.step) : Number(last) >= Number(first) ? 1 : -1,
          last,
        ];
        if (values.some((v) => typeof v !== "number"))
          throw new Error("Range endpoints must be scalar numbers.");
        return rangeValues(...(values as [number, number, number]));
      }
      if (n.type === "ArrayNode") {
        const items = n.items.map((item: MathNode) => visit(item));
        if (items.some(isPoint)) return pointListOf(items);
        return items.map((value: Value) => {
          if (Array.isArray(value))
            throw new Error("Nested lists are not supported.");
          return value as number;
        });
      }
      if (
        n.type === "FunctionNode" &&
        (n.fn.name === "sum" || n.fn.name === "prod")
      ) {
        const first = visit(n.args[2]),
          last = visit(n.args[3]);
        if (typeof first !== "number" || typeof last !== "number")
          throw new Error("Sum limits must be single numbers.");
        if (!Number.isInteger(first) || !Number.isInteger(last)) return NaN;
        if (last - first > 10000)
          throw new Error("Sums support at most 10,000 terms.");
        const index: string = n.args[1].name;
        const hadIndex = Object.hasOwn(scope, index);
        const saved = scope[index];
        let total = n.fn.name === "sum" ? 0 : 1;
        try {
          for (let i = first; i <= last; i++) {
            scope[index] = i;
            const term = visit(n.args[0]);
            if (typeof term !== "number")
              throw new Error("Sum terms must be single numbers.");
            total = n.fn.name === "sum" ? total + term : total * term;
            if (!Number.isFinite(total)) return NaN;
          }
        } finally {
          if (hadIndex) scope[index] = saved;
          else delete scope[index];
        }
        return total;
      }
      const rawArgs = n.args.map(visit);
      const callName: string | undefined =
        n.type === "FunctionNode" ? n.fn.name : undefined;
      if (callName === "point") {
        if (rawArgs.some(isPoint))
          throw new Error("A point's coordinates must be numbers.");
        return makePoint(rawArgs[0] as Numeric, rawArgs[1] as Numeric);
      }
      if (
        rawArgs.some(isPoint) ||
        callName === "distance" ||
        callName === "midpoint"
      )
        return n.type === "OperatorNode"
          ? pointOperator(n.op, rawArgs)
          : pointFunction(callName!, rawArgs);
      const args = rawArgs as Numeric[];
      const operation = (args: number[]): number => {
        if (args.some((n) => !Number.isFinite(n))) return NaN;
        if (n.type === "OperatorNode") {
          const [a, b] = args;
          if (["<", "<=", ">", ">="].includes(n.op))
            return Number(
              n.op === "<"
                ? a < b
                : n.op === "<="
                  ? a <= b
                  : n.op === ">"
                    ? a > b
                    : a >= b,
            );
          if (n.op === "!")
            return Number.isInteger(a) && a >= 0 && a <= 170
              ? factorial(a)
              : NaN;
          const result =
            n.op === "+"
              ? b === undefined
                ? a
                : a + b
              : n.op === "-"
                ? b === undefined
                  ? -a
                  : a - b
                : n.op === "*"
                  ? a * b
                  : n.op === "/"
                    ? a / b
                    : power(a, b);
          if (
            result === 0 &&
            a !== 0 &&
            ((n.op === "*" && b !== 0) || n.op === "/" || n.op === "^")
          )
            return NaN;
          return result;
        }
        const [a, b] = args;
        const name: string = n.fn.name;
        if (["sin", "cos", "tan", "sec", "csc", "cot"].includes(name)) {
          const radians = a * inputAngle;
          if (
            ["tan", "sec"].includes(name) &&
            Math.abs(Math.cos(radians)) < 1e-14
          )
            return NaN;
          if (
            ["csc", "cot"].includes(name) &&
            Math.abs(Math.sin(radians)) < 1e-14
          )
            return NaN;
          if (name === "sec") return 1 / Math.cos(radians);
          if (name === "csc") return 1 / Math.sin(radians);
          if (name === "cot") return Math.cos(radians) / Math.sin(radians);
          return Math[name as "sin" | "cos" | "tan"](radians);
        }
        if (name === "asin" || name === "acos" || name === "atan")
          return Math[name](a) * inverseAngle;
        if (name === "asec") return Math.acos(1 / a) * inverseAngle;
        if (name === "acsc") return Math.asin(1 / a) * inverseAngle;
        if (name === "acot") return Math.atan2(1, a) * inverseAngle;
        if (name === "log")
          return a > 0 && (b === undefined || (b > 0 && b !== 1))
            ? Math.log(a) / Math.log(b ?? 10)
            : NaN;
        if (name === "ln") return Math.log(a);
        if (name === "nthroot") {
          if (!Number.isInteger(b) || b <= 0) return NaN;
          if (a < 0) return b % 2 === 1 ? -Math.pow(-a, 1 / b) : NaN;
          return Math.pow(a, 1 / b);
        }
        if (name === "round" && b !== undefined) {
          if (!Number.isInteger(b) || Math.abs(b) > 15) return NaN;
          const scale = 10 ** b;
          return Math.round((a + Number.EPSILON) * scale) / scale;
        }
        if (name === "gcd" || name === "lcm") {
          if (![a, b].every(Number.isSafeInteger)) return NaN;
          let x = Math.abs(a),
            y = Math.abs(b);
          while (y) [x, y] = [y, x % y];
          return name === "gcd"
            ? x
            : a === 0 || b === 0
              ? 0
              : Math.abs(a / x) * Math.abs(b);
        }
        if (name === "mod") return b === 0 ? NaN : ((a % b) + b) % b;
        if (name === "ncr" || name === "npr") {
          if (
            !Number.isSafeInteger(a) ||
            !Number.isSafeInteger(b) ||
            a < 0 ||
            b < 0
          )
            return NaN;
          if (b > a) return 0;
          const count = name === "ncr" ? Math.min(b, a - b) : b;
          let result = 1;
          for (let i = 0; i < count; i++) {
            result *= (a - i) / (name === "ncr" ? i + 1 : 1);
            if (!Number.isFinite(result)) return NaN;
          }
          return result;
        }
        if (listAggregates.has(name)) return NaN;
        if (builtin.has(name)) {
          const result = (
            Math as unknown as Record<string, (...args: number[]) => number>
          )[name](...args);
          return name === "exp" && result === 0 ? NaN : result;
        }
        if (!Object.hasOwn(functions, name))
          throw new Error(`Define ${name}(x) first.`);
        return functions[name](a);
      };
      const name: string | undefined =
        n.type === "FunctionNode" ? n.fn.name : undefined;
      if (name === "join") {
        const joined = args.flatMap((arg) =>
          Array.isArray(arg) ? arg : [arg],
        );
        if (joined.length > 200)
          throw new Error("Calculator lists support at most 200 values.");
        return joined;
      }
      if (name === "corr") {
        const [x, y] = args;
        if (
          !Array.isArray(x) ||
          !Array.isArray(y) ||
          x.length !== y.length ||
          x.length < 2 ||
          [...x, ...y].some((value) => !Number.isFinite(value))
        )
          return NaN;
        const mx = x.reduce((sum, v) => sum + v, 0) / x.length;
        const my = y.reduce((sum, v) => sum + v, 0) / y.length;
        let sxy = 0,
          sxx = 0,
          syy = 0;
        x.forEach((v, i) => {
          sxy += (v - mx) * (y[i] - my);
          sxx += (v - mx) ** 2;
          syy += (y[i] - my) ** 2;
        });
        return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
      }
      if (
        name &&
        (listAggregates.has(name) || ["min", "max"].includes(name)) &&
        Array.isArray(args[0])
      ) {
        const values = args[0] as number[];
        if (args.slice(1).some(Array.isArray))
          throw new Error("Use one data list and a scalar parameter.");
        if (values.some((value) => !Number.isFinite(value))) return NaN;
        const sorted = [...values].sort((a, b) => a - b);
        const mean = () =>
          values.length
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : NaN;
        const median = (list = sorted) => {
          if (!list.length) return NaN;
          const middle = Math.floor(list.length / 2);
          return list.length % 2
            ? list[middle]
            : (list[middle - 1] + list[middle]) / 2;
        };
        const variance = (population: boolean) => {
          if (!values.length || (!population && values.length < 2)) return NaN;
          const center = mean();
          return (
            values.reduce((sum, value) => sum + (value - center) ** 2, 0) /
            (population ? values.length : values.length - 1)
          );
        };
        const quartile = (q: number) => {
          if (!Number.isInteger(q) || q < 0 || q > 4 || !sorted.length)
            return NaN;
          if (q === 0) return sorted[0];
          if (q === 4) return sorted.at(-1)!;
          if (q === 2) return median();
          const middle = Math.floor(sorted.length / 2);
          return median(
            q === 1
              ? sorted.slice(0, middle)
              : sorted.slice(Math.ceil(sorted.length / 2)),
          );
        };
        const quantile = (q: number) => {
          if (q < 0 || q > 1 || !Number.isFinite(q) || !sorted.length)
            return NaN;
          const position = (sorted.length - 1) * q;
          const lower = Math.floor(position),
            upper = Math.ceil(position);
          return (
            sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
          );
        };
        if (name === "min") return sorted[0] ?? NaN;
        if (name === "max") return sorted.at(-1) ?? NaN;
        if (name === "mean") return mean();
        if (name === "median") return median();
        if (name === "quartile") return quartile(args[1] as number);
        if (name === "quantile") return quantile(args[1] as number);
        if (name === "sort") return sorted;
        if (name === "count" || name === "length") return values.length;
        if (name === "total")
          return values.reduce((sum, value) => sum + value, 0);
        if (name === "mad") {
          const center = mean();
          return values.length
            ? values.reduce((sum, value) => sum + Math.abs(value - center), 0) /
                values.length
            : NaN;
        }
        if (name === "var" || name === "variance") return variance(false);
        if (name === "varp") return variance(true);
        if (name === "stdev") return Math.sqrt(variance(false));
        if (name === "stdevp") return Math.sqrt(variance(true));
        if (name === "stats")
          return [
            quartile(0),
            quartile(1),
            quartile(2),
            quartile(3),
            quartile(4),
          ];
      }
      const arrays = args.filter((arg): arg is number[] => Array.isArray(arg));
      if (!arrays.length) return operation(args as number[]);
      if (arrays.some((array) => array.length !== arrays[0].length))
        throw new Error("Lists must have the same length.");
      return arrays[0].map((_, index) =>
        operation(args.map((arg) => (Array.isArray(arg) ? arg[index] : arg))),
      );
    };
    const result = visit(node);
    return isPoint(result) || Array.isArray(result)
      ? result
      : Number.isFinite(result)
        ? result
        : NaN;
  };
  const numeric: Scalar["evaluate"] = (scope, functions, angle) => {
    const result = evaluate(scope, functions, angle);
    if (isPoint(result)) throw new Error("This expression produces a point.");
    return result;
  };
  const value: Scalar["value"] = (scope, functions, angle) => {
    const result = numeric(scope, functions, angle);
    if (Array.isArray(result))
      throw new Error("This expression produces a list.");
    return result;
  };
  return {
    node,
    symbols,
    calls,
    value,
    evaluate: numeric,
    evaluateValue: evaluate,
  };
}
export const isBuiltin = (name: string) =>
  builtin.has(name) ||
  Object.hasOwn(constants, name) ||
  ["x", "y"].includes(name);
/** Comparisons multiplied together mean "all of these"; show 0<=x<5 as one chain. */
function conditionTex(node: any, options: any): string {
  const unwrap = (n: any): any =>
    n.type === "ParenthesisNode" ? unwrap(n.content) : n;
  const parts: any[] = [];
  const collect = (n: any) => {
    n = unwrap(n);
    if (n.type === "OperatorNode" && n.op === "*") n.args.forEach(collect);
    else parts.push(n);
  };
  collect(node);
  const pieces: string[] = [];
  let previousRight = "";
  for (const part of parts) {
    const [left, right] = part.args;
    if (pieces.length && left.toString() === previousRight) {
      pieces[pieces.length - 1] +=
        ` ${part.toTex(options).slice(left.toTex(options).length)}`;
    } else pieces.push(part.toTex(options));
    previousRight = right.toString();
  }
  return pieces.join(",\\ ");
}
export function scalarTex(s: Scalar): string {
  return s.node.toTex({
    parenthesis: "auto",
    handler: (node: MathNode, options: any) => {
      const n = node as any;
      if (n.type === "ConditionalNode") {
        // A trailing {condition} for a plain domain restriction; cases otherwise.
        const plain =
          n.falseExpr.type === "OperatorNode" &&
          n.falseExpr.op === "/" &&
          n.falseExpr.args.every(
            (arg: any) => arg.type === "ConstantNode" && arg.value === 0,
          );
        if (plain)
          return `${n.trueExpr.toTex(options)}\\left\\{${conditionTex(n.condition, options)}\\right\\}`;
        const rows: string[] = [];
        let rest = n;
        while (rest.type === "ConditionalNode") {
          rows.push(
            `${rest.trueExpr.toTex(options)} & ${conditionTex(rest.condition, options)}`,
          );
          rest = rest.falseExpr;
        }
        const last =
          rest.type === "OperatorNode" &&
          rest.op === "/" &&
          rest.args.every(
            (arg: any) => arg.type === "ConstantNode" && arg.value === 0,
          )
            ? []
            : [`${rest.toTex(options)} & \\text{otherwise}`];
        return `\\begin{cases}${[...rows, ...last].join("\\\\ ")}\\end{cases}`;
      }
      if (n.type === "ParenthesisNode" && n.content.type === "RangeNode")
        return n.content.toTex(options);
      if (n.type === "RangeNode") {
        const unbox = (a: any): any =>
          a.type === "ParenthesisNode" ? unbox(a.content) : a;
        const step = n.step && unbox(n.step);
        const second = !step
          ? undefined
          : step?.type === "OperatorNode" && step.op === "-"
            ? unbox(step.args[0]).toTex(options)
            : step?.type === "ConstantNode" && step.value === 1
              ? undefined
              : `${n.start.toTex(options)}+${n.step?.toTex(options) ?? "1"}`;
        return `\\left[${unbox(n.start).toTex(options)}${second ? `,${second}` : ""}\\ldots ${unbox(n.end).toTex(options)}\\right]`;
      }
      if (n.type === "FunctionNode" && n.fn.name === "point")
        return `\\left(${n.args.map((arg: MathNode) => arg.toTex(options)).join(",")}\\right)`;
      if (n.type === "ArrayNode")
        return `\\left[${n.items.map((item: MathNode) => item.toTex(options)).join(",")}\\right]`;
      if (
        n.type === "FunctionNode" &&
        [
          "floor",
          "ceil",
          "round",
          "sign",
          "gcd",
          "lcm",
          "mod",
          "ncr",
          "npr",
          "min",
          "max",
          "sort",
          "join",
          "length",
          "corr",
          "mean",
          "median",
          "quartile",
          "quantile",
          "stdev",
          "stdevp",
          "var",
          "varp",
          "variance",
          "mad",
          "count",
          "total",
          "stats",
          "distance",
          "midpoint",
        ].includes(n.fn.name)
      )
        return `\\operatorname{${n.fn.name === "ncr" ? "nCr" : n.fn.name === "npr" ? "nPr" : n.fn.name}}\\left(${n.args.map((arg: MathNode) => arg.toTex(options)).join(",")}\\right)`;
      if (
        n.type === "FunctionNode" &&
        (n.fn.name === "log" || n.fn.name === "ln")
      ) {
        const base =
          n.fn.name === "log"
            ? `\\log_{${n.args[1] ? n.args[1].toTex(options) : "10"}}`
            : "\\ln";
        return `${base}\\left(${n.args[0].toTex(options)}\\right)`;
      }
      if (n.type === "FunctionNode" && n.fn.name === "nthroot")
        return `\\sqrt[${n.args[1].toTex(options)}]{${n.args[0].toTex(options)}}`;
      return undefined;
    },
  });
}
