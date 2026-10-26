import { create, parseDependencies } from "mathjs/number";
import type { MathNode } from "mathjs";
const { parse } = create({ parseDependencies });

export type Angle = "radians" | "degrees";
export interface Scalar {
  node: MathNode;
  symbols: Set<string>;
  calls: Set<string>;
  value: (
    scope: Record<string, number>,
    functions: Record<string, (x: number) => number>,
    angle: Angle,
  ) => number;
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
export const normalize = (text: string) =>
  text
    .trim()
    .replaceAll("−", "-")
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("π", "pi")
    .replaceAll("²", "^2")
    .replaceAll("³", "^3")
    .replaceAll("√", "sqrt")
    .replace(/\|([^|]+)\|/g, "abs($1)")
    .replace(/\b([a-z])([xy])\b/g, "$1*$2");

/** Math.js supplies grammar/precedence and TeX. Only this deliberately small AST
 * interpreter executes numeric operations: no eval, assignments, properties,
 * arbitrary calls, units, matrices, or unbounded recursion enter evaluation.
 */
export function scalar(text: string): Scalar {
  if (text.length > 240)
    throw new Error("Keep expressions under 240 characters.");
  for (const literal of text.match(/(?:\d+\.?\d*|\.\d+)[eE][+-]?\d+/g) ?? []) {
    if (
      !Number.isFinite(Number(literal)) ||
      (Number(literal) === 0 && /[1-9]/.test(literal.split(/[eE]/)[0]))
    )
      throw new Error("This number is outside the supported numeric range.");
  }
  const node = parse(normalize(text)) as MathNode;
  const symbols = new Set<string>(),
    calls = new Set<string>();
  let count = 0;
  const check = (n: MathNode, depth = 0) => {
    if (++count > 128 || depth > 24)
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
  const value: Scalar["value"] = (scope, functions, angle) => {
    const inputAngle = angle === "degrees" ? Math.PI / 180 : 1;
    const inverseAngle = angle === "degrees" ? 180 / Math.PI : 1;
    const visit = (n: any): number => {
      if (n.type === "ConstantNode") return n.value;
      if (n.type === "SymbolNode") {
        const v = Object.hasOwn(constants, n.name)
          ? constants[n.name]
          : scope[n.name];
        if (typeof v !== "number") throw new Error(`Define ${n.name} first.`);
        return v;
      }
      if (n.type === "ParenthesisNode") return visit(n.content);
      const args = n.args.map(visit) as number[];
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
      if (name === "sin" || name === "cos" || name === "tan") {
        if (name === "tan" && Math.abs(Math.cos(a * inputAngle)) < 1e-14)
          return NaN;
        return Math[name](a * inputAngle);
      }
      if (name === "asin" || name === "acos" || name === "atan")
        return Math[name](a) * inverseAngle;
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
    const result = visit(node);
    return Number.isFinite(result) ? result : NaN;
  };
  return { node, symbols, calls, value };
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
