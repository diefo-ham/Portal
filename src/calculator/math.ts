import { create, parseDependencies } from "mathjs/number";
import type { MathNode } from "mathjs";
import { parseListRanges, rangeValues } from "./listRanges";
const { parse } = create({ parseDependencies });

export type Angle = "radians" | "degrees";
export type Numeric = number | number[];
export interface Scalar {
  node: MathNode;
  symbols: Set<string>;
  calls: Set<string>;
  value: (
    scope: Record<string, number>,
    functions: Record<string, (x: number) => number>,
    angle: Angle,
  ) => number;
  evaluate: (
    scope: Record<string, Numeric>,
    functions: Record<string, (x: number) => number>,
    angle: Angle,
  ) => Numeric;
}
const constants: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: 2 * Math.PI,
};
const builtin = new Set([
  "sqrt",
  "cbrt",
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
  "min",
  "max",
]);
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
    .replace(/\|([^|]+)\|/g, "abs($1)")
    .replace(/\b([a-zA-Z])([a-zA-Z]_\d+)\b/g, "$1*$2")
    .replace(/\b(?:arc)(sin|cos|tan|sec|csc|cot)\b/g, "a$1");
  // Bounded Desmos-like shorthand: a single variable, pi, or numeric atom.
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
  return text.replace(/\b([a-z])([xy])\b/g, "$1*$2");
};

/** Math.js supplies grammar/precedence and TeX. Only this deliberately small AST
 * interpreter executes numeric operations: no eval, assignments, properties,
 * arbitrary calls, units, matrices, or unbounded recursion enter evaluation.
 */
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
  const node = parse(parseListRanges(normalize(text))) as MathNode;
  const symbols = new Set<string>(),
    calls = new Set<string>();
  let count = 0;
  const check = (n: MathNode, depth = 0) => {
    if (++count > 512 || depth > 24)
      throw new Error("This expression is too complex.");
    const a = n as any;
    switch (n.type) {
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
        if (!["+", "-", "*", "/", "^"].includes(a.op))
          throw new Error("That operator is not supported.");
        a.args.forEach((child: MathNode) => check(child, depth + 1));
        break;
      case "FunctionNode":
        if (
          a.fn.type !== "SymbolNode" ||
          !/^[a-z][a-z0-9_]{0,15}$/i.test(a.fn.name) ||
          a.args.length < 1 ||
          a.args.length > 2
        )
          throw new Error("Use a supported numeric function.");
        if (!builtin.has(a.fn.name)) calls.add(a.fn.name);
        if (!["log", "min", "max"].includes(a.fn.name) && a.args.length !== 1)
          throw new Error("This function takes one argument.");
        a.args.forEach((child: MathNode) => check(child, depth + 1));
        break;
      default:
        throw new Error(
          "Use arithmetic, functions, or an equation; this syntax is not supported.",
        );
    }
  };
  check(node);
  const evaluate: Scalar["evaluate"] = (scope, functions, angle) => {
    const inputAngle = angle === "degrees" ? Math.PI / 180 : 1;
    const inverseAngle = angle === "degrees" ? 180 / Math.PI : 1;
    const visit = (n: any): Numeric => {
      if (n.type === "ConstantNode") return n.value;
      if (n.type === "SymbolNode") {
        const v = Object.hasOwn(constants, n.name)
          ? constants[n.name]
          : scope[n.name];
        if (typeof v !== "number" && !Array.isArray(v))
          throw new Error(`Define ${n.name} first.`);
        return v;
      }
      if (n.type === "ParenthesisNode") return visit(n.content);
      if (n.type === "RangeNode") {
        const first = visit(n.start),
          last = visit(n.end);
        const values = [
          first,
          n.step ? visit(n.step) : Number(last) >= Number(first) ? 1 : -1,
          last,
        ];
        if (values.some(Array.isArray))
          throw new Error("Range endpoints must be scalar numbers.");
        return rangeValues(...(values as [number, number, number]));
      }
      if (n.type === "ArrayNode")
        return n.items.map((item: MathNode) => {
          const value = visit(item);
          if (Array.isArray(value))
            throw new Error("Nested lists are not supported.");
          return value;
        });
      const args = n.args.map(visit) as Numeric[];
      const operation = (args: number[]): number => {
        if (args.some((n) => !Number.isFinite(n))) return NaN;
        if (n.type === "OperatorNode") {
          const [a, b] = args;
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
                    : Math.pow(a, b);
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
      const arrays = args.filter((arg): arg is number[] => Array.isArray(arg));
      if (!arrays.length) return operation(args as number[]);
      if (arrays.some((array) => array.length !== arrays[0].length))
        throw new Error("Lists must have the same length.");
      return arrays[0].map((_, index) =>
        operation(args.map((arg) => (Array.isArray(arg) ? arg[index] : arg))),
      );
    };
    const result = visit(node);
    return Array.isArray(result)
      ? result
      : Number.isFinite(result)
        ? result
        : NaN;
  };
  const value: Scalar["value"] = (scope, functions, angle) => {
    const result = evaluate(scope, functions, angle);
    if (Array.isArray(result))
      throw new Error("This expression produces a list.");
    return result;
  };
  return { node, symbols, calls, value, evaluate };
}
export const isBuiltin = (name: string) =>
  builtin.has(name) ||
  Object.hasOwn(constants, name) ||
  ["x", "y"].includes(name);
export function scalarTex(s: Scalar): string {
  return s.node.toTex({
    parenthesis: "auto",
    handler: (node: MathNode, options: any) => {
      const n = node as any;
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
      if (n.type === "ArrayNode")
        return `\\left[${n.items.map((item: MathNode) => item.toTex(options)).join(",")}\\right]`;
      if (
        n.type === "FunctionNode" &&
        ["floor", "ceil", "round", "min", "max"].includes(n.fn.name)
      )
        return `\\operatorname{${n.fn.name}}\\left(${n.args.map((arg: MathNode) => arg.toTex(options)).join(",")}\\right)`;
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
      return undefined;
    },
  });
}
