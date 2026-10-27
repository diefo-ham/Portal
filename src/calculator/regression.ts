import { Matrix, QrDecomposition } from "ml-matrix";
import type { FitModel, Point } from "./model";

export interface Fit {
  coefficients: number[]; // increasing powers of x; exponential: a, b in a*b^x
  predict: (x: number) => number;
  r2?: number;
  rmse: number;
  residuals: number[];
  logSpace: boolean;
  exponential?: boolean;
}
export function regression(
  points: Point[],
  model: Exclude<FitModel, "none">,
  powers?: number[],
): Fit {
  const degree = model === "quadratic" ? 2 : model === "cubic" ? 3 : 1;
  const terms = powers ?? Array.from({ length: degree + 1 }, (_, i) => i);
  if (
    !terms.length ||
    new Set(terms).size !== terms.length ||
    terms.some(
      (power) => !Number.isInteger(power) || power < 0 || power > degree,
    )
  )
    throw new Error("Invalid polynomial fit terms.");
  if (points.length < terms.length)
    throw new Error(
      `Use at least ${terms.length} complete points for this fit.`,
    );
  if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    throw new Error("Use finite data values.");
  if (model === "exponential" && points.some((p) => p.y <= 0))
    throw new Error("Exponential fitting requires every y to be positive.");
  if (new Set(points.map((p) => p.x)).size < terms.length)
    throw new Error("Not enough distinct x values for a unique fit.");
  // Sparse models retain their specified origin (centering would introduce omitted terms).
  const center = powers
    ? 0
    : points.reduce((a, p) => a + p.x / points.length, 0);
  const scale = Math.max(...points.map((p) => Math.abs(p.x - center)));
  if (!Number.isFinite(scale) || scale === 0)
    throw new Error("The data cannot determine this fit.");
  // Center/scale the Vandermonde matrix and solve via QR, avoiding normal equations.
  const qr = new QrDecomposition(
    new Matrix(
      points.map((p) =>
        terms.map((power) => ((p.x - center) / scale) ** power),
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
  for (let i = 0; i < terms.length; i++) {
    const k = terms[i];
    for (let j = 0; j <= k; j++)
      coefficients[j] +=
        (local[i] * binomial[k][j] * (-center) ** (k - j)) / scale ** k;
  }
  const polynomial = (x: number) =>
    local.reduce(
      (acc, c, i) => acc + c * ((x - center) / scale) ** terms[i],
      0,
    );
  let predict =
    model === "exponential"
      ? (x: number) => Math.exp(polynomial(x))
      : polynomial;
  if (model === "exponential") {
    // Variable projection: for each exponential rate, solve amplitude exactly
    // in the original y space, then minimize SSE with bounded golden search.
    // Center/scale x and y to keep the optimization numerically well behaved.
    const yScale = Math.max(...points.map((point) => point.y));
    const objective = (rate: number) => {
      const basis = points.map((point) =>
        Math.exp((rate * (point.x - center)) / scale),
      );
      const denominator = basis.reduce((sum, value) => sum + value * value, 0);
      const amplitude =
        basis.reduce(
          (sum, value, index) => sum + (value * points[index].y) / yScale,
          0,
        ) / denominator;
      const error = basis.reduce(
        (sum, value, index) =>
          sum + (points[index].y / yScale - amplitude * value) ** 2,
        0,
      );
      return { error, amplitude: amplitude * yScale };
    };
    const bound = Math.min(150, Math.max(40, Math.abs(local[1]) * 3));
    const candidates = Array.from(
      { length: 241 },
      (_, index) => -bound + (2 * bound * index) / 240,
    );
    let best = 0;
    for (let index = 1; index < candidates.length; index++)
      if (
        objective(candidates[index]).error < objective(candidates[best]).error
      )
        best = index;
    if (best === 0 || best === candidates.length - 1)
      throw new Error(
        "Exponential fit rate is outside the reliable search range.",
      );
    let lo = candidates[best - 1],
      hi = candidates[best + 1];
    const ratio = (Math.sqrt(5) - 1) / 2;
    let left = hi - ratio * (hi - lo),
      right = lo + ratio * (hi - lo);
    for (let iteration = 0; iteration < 120; iteration++) {
      if (objective(left).error < objective(right).error) {
        hi = right;
        right = left;
        left = hi - ratio * (hi - lo);
      } else {
        lo = left;
        left = right;
        right = lo + ratio * (hi - lo);
      }
    }
    const rate = (lo + hi) / 2,
      amplitude = objective(rate).amplitude;
    predict = (x) => amplitude * Math.exp((rate * (x - center)) / scale);
    coefficients = [
      amplitude * Math.exp((-rate * center) / scale),
      Math.exp(rate / scale),
    ];
  }
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
    logSpace: false,
    exponential: model === "exponential",
  };
}

/** Supported SAT templates, with user-chosen single-letter parameter names. */
export function regressionSpec(text: string) {
  const match = text.replace(/\s/g, "").match(/^([a-zA-Z](?:_\d+)?)~(.+)$/);
  if (!match) throw new Error("Write a regression such as y_1 ~ m x_1 + b.");
  const y = match[1],
    formula = match[2];
  const dataName = formula.match(/[a-zA-Z]_\d+/)?.[0];
  if (!dataName)
    throw new Error("Use a table column or a subscripted x data list.");
  const rhs = formula
    .replaceAll(dataName, "X")
    .replace(/\*/g, "")
    .replace(/\(([-+]?\d+)\)/g, "$1");
  let found: RegExpMatchArray | null;
  if ((found = rhs.match(/^([a-zA-Z])X\+([a-zA-Z])$/)))
    return {
      y,
      x: dataName,
      model: "linear" as const,
      names: [found[2], found[1]],
    };
  if ((found = rhs.match(/^([a-zA-Z])X\^2\+([a-zA-Z])X\+([a-zA-Z])$/)))
    return {
      y,
      x: dataName,
      model: "quadratic" as const,
      names: [found[3], found[2], found[1]],
    };
  if (
    (found = rhs.match(
      /^([a-zA-Z])X\^3\+([a-zA-Z])X\^2\+([a-zA-Z])X\+([a-zA-Z])$/,
    ))
  )
    return {
      y,
      x: dataName,
      model: "cubic" as const,
      names: [found[4], found[3], found[2], found[1]],
    };
  if ((found = rhs.match(/^([a-zA-Z])([a-zA-Z])\^X$/)))
    return {
      y,
      x: dataName,
      model: "exponential" as const,
      names: [found[1], found[2]],
    };
  // A deliberately bounded family of custom models: user-selected polynomial
  // terms, including through-origin lines and omitted linear/constant terms.
  const polynomialTerms = rhs
    .split("+")
    .map((term) => term.match(/^([a-zA-Z])(?:X(?:\^([123]))?)?$/));
  if (polynomialTerms.every((term) => term)) {
    const pairs = polynomialTerms
      .map((term) => ({
        name: term![1],
        power: term![0].includes("X") ? Number(term![2] || 1) : 0,
      }))
      .sort((a, b) => a.power - b.power);
    if (new Set(pairs.map((pair) => pair.power)).size === pairs.length) {
      const degree = Math.max(...pairs.map((pair) => pair.power));
      return {
        y,
        x: dataName,
        model:
          degree === 3
            ? ("cubic" as const)
            : degree === 2
              ? ("quadratic" as const)
              : ("linear" as const),
        names: pairs.map((pair) => pair.name),
        powers: pairs.map((pair) => pair.power),
      };
    }
  }
  throw new Error(
    "Supported fits: polynomial terms through degree 3 (such as m x_1 or a x_1^2 + c), or a b^x_1. General nonlinear custom fits need Desmos.",
  );
}
