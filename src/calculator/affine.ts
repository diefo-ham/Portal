import type { MathNode } from "mathjs";
import type { Point, Viewport } from "./model";

export type Comparator = "<" | "<=" | ">" | ">=";
/** The original comparison is a*x + b*y + c comparator 0. */
export type AffineInequality = {
  a: number;
  b: number;
  c: number;
  op: Comparator;
};
export const reverseComparator = (op: Comparator): Comparator =>
  ({ "<": ">", "<=": ">=", ">": "<", ">=": "<=" })[op] as Comparator;

/** Structural extraction avoids mistaking nonlinear curves for lines, or losing
 * a small coefficient by subtracting evaluations with a large constant offset.
 * Call after workspace definition expansion; constants use its normal evaluator.
 */
export function affineCoefficients(
  node: MathNode,
  constant: (node: MathNode) => number,
): { a: number; b: number; c: number } | undefined {
  type Coefficients = [number, number, number];
  const visit = (node: MathNode): Coefficients => {
    const n = node as any;
    if (n.type === "SymbolNode" && n.name === "x") return [1, 0, 0];
    if (n.type === "SymbolNode" && n.name === "y") return [0, 1, 0];
    if (n.type === "ParenthesisNode") return visit(n.content);
    let coordinates = false;
    node.traverse((child: MathNode) => {
      if (child.type === "SymbolNode" && ["x", "y"].includes(child.toString()))
        coordinates = true;
    });
    if (!coordinates) return [0, 0, constant(node)];
    if (n.type !== "OperatorNode") throw new Error();
    const left = visit(n.args[0]);
    if (n.args.length === 1 && ["+", "-"].includes(n.op))
      return left.map((v) => (n.op === "-" ? -v : v)) as Coefficients;
    const right = visit(n.args[1]);
    const scalarLeft = left[0] === 0 && left[1] === 0;
    const scalarRight = right[0] === 0 && right[1] === 0;
    if (["+", "-"].includes(n.op))
      return left.map(
        (v, i) => v + (n.op === "+" ? 1 : -1) * right[i],
      ) as Coefficients;
    if (n.op === "*" && (scalarLeft || scalarRight))
      return (
        scalarLeft
          ? right.map((v) => v * left[2])
          : left.map((v) => v * right[2])
      ) as Coefficients;
    if (n.op === "/" && scalarRight && right[2] !== 0)
      return left.map((v) => v / right[2]) as Coefficients;
    if (n.op === "^" && scalarRight && right[2] === 1) return left;
    throw new Error();
  };
  try {
    const [a, b, c] = visit(node);
    if ([a, b, c].every(Number.isFinite)) return { a, b, c };
  } catch {
    // Non-affine/domain-restricted expressions retain the explicit graph path
    // where supported; implicit ones receive a scope-specific error.
  }
}

/** Clip one half-plane to the viewport rectangle, independently per expression.
 * No sampled curve, offscreen closing edge, or system/feasible-region solver.
 */
export function clipAffineInequality(affine: AffineInequality, view: Viewport) {
  const { a, b, c, op } = affine;
  const corners: Point[] = [
    { x: view.xMin, y: view.yMin },
    { x: view.xMax, y: view.yMin },
    { x: view.xMax, y: view.yMax },
    { x: view.xMin, y: view.yMax },
  ];
  if (a === 0 && b === 0) {
    const allowed =
      op === "<" ? c < 0 : op === "<=" ? c <= 0 : op === ">" ? c > 0 : c >= 0;
    return { shade: allowed ? corners : [], boundary: [] as Point[] };
  }
  // Positive rescaling preserves the comparison and avoids overflow at large
  // coordinates. Include the boundary in the fill; its stroke conveys strictness.
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
  const sign = op.startsWith("<") ? 1 : -1;
  const value = (p: Point) =>
    sign * ((a / scale) * p.x + (b / scale) * p.y + c / scale);
  const shade: Point[] = [],
    boundary: Point[] = [];
  const addBoundary = (p: Point) => {
    if (!boundary.some((q) => p.x === q.x && p.y === q.y)) boundary.push(p);
  };
  for (let i = 0; i < corners.length; i++) {
    const p = corners[i],
      q = corners[(i + 1) % corners.length];
    const dp = value(p),
      dq = value(q);
    if (dp === 0) addBoundary(p);
    if (dp <= 0) shade.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
      const t = dp / (dp - dq);
      const crossing = { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) };
      shade.push(crossing);
      addBoundary(crossing);
    }
  }
  return { shade, boundary };
}
