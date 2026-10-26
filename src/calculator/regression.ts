import { Matrix, QrDecomposition } from "ml-matrix";
import type { FitModel, Point } from "./model";

export interface Fit {
  coefficients: number[]; // increasing powers of x; exponential: a, b in a*b^x
  predict: (x: number) => number;
  r2?: number;
  rmse: number;
  residuals: number[];
  logSpace: boolean;
}
export function regression(
  points: Point[],
  model: Exclude<FitModel, "none">,
): Fit {
  const degree = model === "quadratic" ? 2 : model === "cubic" ? 3 : 1;
  if (points.length < degree + 1)
    throw new Error(`Use at least ${degree + 1} complete points for this fit.`);
  if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    throw new Error("Use finite data values.");
  if (model === "exponential" && points.some((p) => p.y <= 0))
    throw new Error("Exponential fitting requires every y to be positive.");
  if (new Set(points.map((p) => p.x)).size < degree + 1)
    throw new Error("Not enough distinct x values for a unique fit.");
  const center = points.reduce((a, p) => a + p.x / points.length, 0);
  const scale = Math.max(...points.map((p) => Math.abs(p.x - center)));
  if (!Number.isFinite(scale) || scale === 0)
    throw new Error("The data cannot determine this fit.");
  // Center/scale the Vandermonde matrix and solve via QR, avoiding normal equations.
  const qr = new QrDecomposition(
    new Matrix(
      points.map((p) =>
        Array.from(
          { length: degree + 1 },
          (_, i) => ((p.x - center) / scale) ** i,
        ),
      ),
    ),
  );
  const diagonal = qr.upperTriangularMatrix.diag().map(Math.abs);
  if (!qr.isFullRank() || Math.min(...diagonal) < Math.max(...diagonal) * 1e-10)
    throw new Error(
      "This fit is numerically ill-conditioned. Spread out the x values.",
    );
  const local = qr
    .solve(
      Matrix.columnVector(
        points.map((p) => (model === "exponential" ? Math.log(p.y) : p.y)),
      ),
    )
    .to1DArray();
  const binomial = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1]];
  let coefficients = Array(degree + 1).fill(0) as number[];
  for (let k = 0; k <= degree; k++)
    for (let j = 0; j <= k; j++)
      coefficients[j] +=
        (local[k] * binomial[k][j] * (-center) ** (k - j)) / scale ** k;
  const polynomial = (x: number) =>
    local.reduceRight((acc, c) => acc * ((x - center) / scale) + c, 0);
  const predict =
    model === "exponential"
      ? (x: number) => Math.exp(polynomial(x))
      : polynomial;
  if (model === "exponential")
    coefficients = [Math.exp(coefficients[0]), Math.exp(coefficients[1])];
  const residuals = points.map((p) => p.y - predict(p.x));
  const mean = points.reduce((a, p) => a + p.y / points.length, 0);
  const sse = residuals.reduce((a, r) => a + r * r, 0),
    sst = points.reduce((a, p) => a + (p.y - mean) ** 2, 0);
  if ([...coefficients, sse, sst].some((n) => !Number.isFinite(n)))
    throw new Error("The fit exceeds the supported numeric range.");
  return {
    coefficients,
    predict,
    residuals,
    rmse: Math.sqrt(sse / points.length),
    r2:
      sst > 0 && !points.every((p) => p.y === points[0].y)
        ? 1 - sse / sst
        : undefined,
    logSpace: model === "exponential",
  };
}
