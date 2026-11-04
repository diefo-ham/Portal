import { Matrix, solve } from "ml-matrix";
import type { ParameterBounds } from "@/src/types/calculator";

/**
 * Least squares for models that are not linear in their parameters, such as
 * a*x^b or a*sin(b*x). Levenberg-Marquardt from a fixed, deterministic set of
 * starting points; the best minimum found is returned. Same inputs always give
 * the same answer. Up to five parameters.
 */
export type Residuals = (parameters: number[]) => number[] | undefined;

const sumOfSquares = (values: number[]) =>
  values.reduce((sum, value) => sum + value * value, 0);

/** Small deterministic generator so results never depend on Math.random. */
function sequence(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function descend(
  residuals: Residuals,
  start: number[],
  lower: number[],
  upper: number[],
): { parameters: number[]; sse: number } | undefined {
  const clamp = (p: number[]) =>
    p.map((value, i) => Math.min(upper[i], Math.max(lower[i], value)));
  let p = clamp(start);
  let r = residuals(p);
  if (!r || !r.every(Number.isFinite)) return undefined;
  let sse = sumOfSquares(r);
  let damping = 1e-3;
  for (let iteration = 0; iteration < 300; iteration++) {
    const jacobian: number[][] = r.map(() => []);
    for (let j = 0; j < p.length; j++) {
      const step = 1e-6 * Math.max(1, Math.abs(p[j]));
      const up = p.slice(),
        down = p.slice();
      up[j] = Math.min(upper[j], p[j] + step);
      down[j] = Math.max(lower[j], p[j] - step);
      const high = residuals(up),
        low = residuals(down);
      if (!high || !low || up[j] === down[j]) return { parameters: p, sse };
      for (let i = 0; i < r.length; i++)
        jacobian[i][j] = (high[i] - low[i]) / (up[j] - down[j]);
    }
    if (!jacobian.flat().every(Number.isFinite)) return { parameters: p, sse };
    const J = new Matrix(jacobian);
    const normal = J.transpose().mmul(J);
    const gradient = J.transpose().mmul(Matrix.columnVector(r));
    let moved = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const damped = normal.clone();
      for (let i = 0; i < p.length; i++)
        damped.set(i, i, normal.get(i, i) * (1 + damping) + 1e-300);
      let delta: number[];
      try {
        delta = solve(damped, gradient.mul(-1)).to1DArray();
      } catch {
        damping *= 10;
        continue;
      }
      const next = clamp(p.map((value, i) => value + delta[i]));
      const trial = residuals(next);
      const trialSse =
        trial && trial.every(Number.isFinite) ? sumOfSquares(trial) : Infinity;
      if (trialSse < sse) {
        const small =
          sse - trialSse <= 1e-15 * sse ||
          next.every(
            (value, i) =>
              Math.abs(value - p[i]) <= 1e-13 * (Math.abs(value) + 1e-9),
          );
        p = next;
        r = trial!;
        sse = trialSse;
        damping = Math.max(damping / 3, 1e-12);
        moved = !small;
        break;
      }
      damping *= 4;
    }
    if (!moved) break;
  }
  return { parameters: p, sse };
}

/**
 * The parameter values with the smallest sum of squared residuals, or undefined
 * when no starting point leads anywhere.
 */
export function nonlinearLeastSquares(
  count: number,
  residuals: Residuals,
  bounds: (ParameterBounds[string] | undefined)[] = [],
): { parameters: number[]; sse: number } | undefined {
  const lower = Array.from(
    { length: count },
    (_, i) => bounds[i]?.min ?? -Infinity,
  );
  const upper = Array.from(
    { length: count },
    (_, i) => bounds[i]?.max ?? Infinity,
  );
  const next = sequence(20261103);
  const starts: number[][] = [Array(count).fill(1)];
  for (let n = 0; n < 160; n++)
    starts.push(
      Array.from({ length: count }, () => {
        const magnitude = 10 ** (next() * 3 - 1.5);
        return next() < 0.35 ? -magnitude : magnitude;
      }),
    );
  let best: { parameters: number[]; sse: number } | undefined;
  let agreeing = 0;
  for (const start of starts) {
    const found = descend(residuals, start, lower, upper);
    if (!found) continue;
    const negatives = (p: number[]) => p.filter((value) => value < 0).length;
    const size = (p: number[]) =>
      p.reduce((sum, value) => sum + Math.abs(value), 0);
    const tied =
      best !== undefined &&
      Math.abs(found.sse - best.sse) <= 1e-9 * Math.max(best.sse, 1e-300);
    // Equally good fits (mirror signs, or frequencies that differ by 2*pi on
    // whole-number data) are broken the same way every time: fewer negative
    // parameters, then the smaller values.
    const preferred =
      tied &&
      (negatives(found.parameters) < negatives(best!.parameters) ||
        (negatives(found.parameters) === negatives(best!.parameters) &&
          size(found.parameters) < size(best!.parameters) * (1 - 1e-9)));
    if (!best || found.sse < best.sse * (1 - 1e-9) || preferred) {
      best = found;
      agreeing = 1;
    } else if (tied) agreeing++;
    // A perfect fit, or the same minimum reached from several starts, is enough.
    if (best.sse < 1e-24 || agreeing >= 8) break;
  }
  return best;
}
