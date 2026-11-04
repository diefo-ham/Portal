import { Matrix, QrDecomposition } from "ml-matrix";
import { scalar } from "./math";
import type { MathNode } from "mathjs";
import { nonlinearLeastSquares } from "./nonlinearFit";
import type {
  Angle,
  Fit,
  FitModel,
  ParameterBounds,
  Point,
  Scalar,
} from "@/src/types/calculator";

const NONLINEAR = "Calculator nonlinear list fitting is unsupported";
/** True when the model has parameters inside functions or powers, not just a straight sum. */
export function isNonlinearInParameters(node: MathNode, names: string[]) {
  try {
    assertAffineParameters(node, names);
    return false;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(NONLINEAR))
      return true;
    throw error;
  }
}

export function assertAffineParameters(node: MathNode, names: string[]): void {
  const degree = (node: MathNode): number => {
    const n = node as MathNode & {
      name: string;
      args: MathNode[];
      items: MathNode[];
      content: MathNode;
      op: string;
    };
    if (n.type === "ConstantNode") return 0;
    if (n.type === "SymbolNode") return names.includes(n.name) ? 1 : 0;
    if (n.type === "ParenthesisNode") return degree(n.content);
    if (n.type === "RangeNode") {
      const range = node as MathNode & {
        start: MathNode;
        end: MathNode;
        step?: MathNode;
      };
      if (
        [range.start, range.end, range.step].some(
          (part) => part && degree(part),
        )
      )
        throw new Error(
          "Regression parameters cannot determine list range lengths.",
        );
      return 0;
    }
    if (n.type === "ArrayNode") return Math.max(0, ...n.items.map(degree));
    if (n.type === "FunctionNode") {
      if (n.args.some((a) => degree(a)))
        throw new Error(
          "Calculator nonlinear list fitting is unsupported; parameters must enter linearly.",
        );
      return 0;
    }
    if (n.type === "OperatorNode") {
      const ds = n.args.map(degree);
      if (["+", "-"].includes(n.op)) return Math.max(...ds);
      if (n.op === "*" && ds.reduce((a, b) => a + b, 0) <= 1)
        return Math.max(...ds);
      if (n.op === "/" && !ds[1]) return ds[0];
      if (n.op === "^" && !ds[1] && n.args[1].toString() === "1") return ds[0];
      if (n.op === "^" && !ds.some(Boolean)) return 0;
    }
    throw new Error(
      "Calculator nonlinear list fitting is unsupported; parameters must enter linearly.",
    );
  };
  degree(node);
}

/** Least-squares relation solver. Each scalar/list element contributes one
 * residual from left - right; undefined symbols supplied in names are fitted. */
export function relationRegression(
  relation: Scalar,
  names: string[],
  scope: Record<string, number | number[]>,
  functions: Record<string, (x: number) => number>,
  angle: Angle,
  bounds: ParameterBounds = {},
): Fit {
  if (names.length < 1 || names.length > 5)
    throw new Error("Use between one and five free regression parameters.");
  const nonlinear = isNonlinearInParameters(relation.node, names);
  const zero = Object.fromEntries(names.map((name) => [name, 0]));
  const vector = (parameters: Record<string, number>) => {
    const value = relation.evaluate(
      { ...scope, ...parameters },
      functions,
      angle,
    );
    return Array.isArray(value) ? value : [value];
  };
  if (nonlinear) {
    const found = nonlinearLeastSquares(
      names.length,
      (values) => {
        const result = vector(
          Object.fromEntries(names.map((name, i) => [name, values[i]])),
        );
        return result.every(Number.isFinite) ? result : undefined;
      },
      names.map((name) => bounds[name]),
    );
    if (!found)
      throw new Error(
        "No fit was found. Try different data or a different model.",
      );
    const residuals = vector(
      Object.fromEntries(names.map((name, i) => [name, found.parameters[i]])),
    );
    return {
      coefficients: found.parameters,
      predict: () => NaN,
      residuals,
      rmse: Math.sqrt(found.sse / residuals.length),
      logSpace: false,
    };
  }
  const offset = vector(zero);
  if (!offset.length || offset.some((value) => !Number.isFinite(value)))
    throw new Error("The regression relation is undefined in its data domain.");
  const basis = names.map((name) => {
    const sample = vector({ ...zero, [name]: 1 });
    if (sample.length !== offset.length)
      throw new Error("Regression lists must have compatible lengths.");
    return sample;
  });
  const rows = offset.map((base, row) =>
    basis.map((sample) => sample[row] - base),
  );
  if (offset.length < names.length)
    throw new Error(
      "This regression has too few residuals to determine its parameters.",
    );
  const scales = names.map((_, column) =>
    Math.max(...rows.map((row) => Math.abs(row[column]))),
  );
  if (
    [...rows.flat(), ...scales].some((v) => !Number.isFinite(v)) ||
    scales.some((v) => v === 0)
  )
    throw new Error("The regression cannot determine every free parameter.");
  const qr = new QrDecomposition(
    new Matrix(rows.map((row) => row.map((value, i) => value / scales[i]))),
  );
  const diagonal = qr.upperTriangularMatrix.diag().map(Math.abs);
  if (!qr.isFullRank() || Math.min(...diagonal) < Math.max(...diagonal) * 1e-10)
    throw new Error("The regression is underdetermined or ill-conditioned.");
  let coefficients = qr
    .solve(Matrix.columnVector(offset.map((value) => -value)))
    .to1DArray()
    .map((value, i) => value / scales[i]);
  // Box-constrained least squares: at most five parameters, so enumerating
  // active bounds is small and deterministic. Solve each remaining free system
  // with QR rather than clipping a coupled unconstrained fit.
  const permitted = (cs: number[], closed = false) =>
    names.every((name, i) => {
      const b = bounds[name];
      return (
        !b ||
        ((b.min === undefined ||
          (b.minOpen && !closed ? cs[i] > b.min : cs[i] >= b.min)) &&
          (b.max === undefined ||
            (b.maxOpen && !closed ? cs[i] < b.max : cs[i] <= b.max)))
      );
    });
  if (!permitted(coefficients)) {
    let best: number[] | undefined,
      bestError = Infinity;
    const search = (fixed: Map<number, number>, column: number) => {
      if (column < names.length) {
        search(fixed, column + 1);
        const bound = bounds[names[column]];
        for (const value of [bound?.min, bound?.max])
          if (value !== undefined) {
            const next = new Map(fixed);
            next.set(column, value);
            search(next, column + 1);
          }
        return;
      }
      if (!fixed.size) return;
      const free = names.map((_, i) => i).filter((i) => !fixed.has(i));
      const rhs = offset.map(
        (base, row) =>
          -base - [...fixed].reduce((sum, [i, v]) => sum + rows[row][i] * v, 0),
      );
      const cs = names.map((_, i) => fixed.get(i) ?? 0);
      if (free.length) {
        const reduced = new QrDecomposition(
          new Matrix(rows.map((row) => free.map((i) => row[i] / scales[i]))),
        );
        if (!reduced.isFullRank()) return;
        const solution = reduced.solve(Matrix.columnVector(rhs)).to1DArray();
        free.forEach((i, j) => {
          cs[i] = solution[j] / scales[i];
        });
      }
      if (!permitted(cs, true)) return;
      const error = rows.reduce(
        (sum, row, j) =>
          sum + (offset[j] + row.reduce((v, r, i) => v + r * cs[i], 0)) ** 2,
        0,
      );
      if (error < bestError) {
        bestError = error;
        best = cs;
      }
    };
    search(new Map(), 0);
    if (!best || !permitted(best))
      throw new Error(
        "No fitted minimum satisfies the parameter restrictions.",
      );
    coefficients = best;
  }
  const coefficientTolerance = scales.map(
    (scale) =>
      (4 *
        Number.EPSILON *
        names.length *
        (Math.max(...offset.map(Math.abs)) || 1) *
        Math.max(...diagonal)) /
      Math.min(...diagonal) /
      scale,
  );
  const clean = coefficients.map((value, i) => {
    if (Math.abs(value) <= coefficientTolerance[i]) return 0;
    const integer = Math.round(value);
    return Math.abs(value - integer) <= coefficientTolerance[i]
      ? integer
      : value;
  });
  if (permitted(clean)) coefficients = clean;
  const parameters = Object.fromEntries(
    names.map((name, i) => [name, coefficients[i]]),
  );
  const residuals = vector(parameters);
  const sse = residuals.reduce((sum, residual) => sum + residual * residual, 0);
  if (
    [...coefficients, ...residuals, sse].some(
      (value) => !Number.isFinite(value),
    )
  )
    throw new Error("The regression exceeds the supported numeric range.");
  return {
    coefficients,
    predict: () => NaN,
    residuals,
    rmse: Math.sqrt(sse / residuals.length),
    logSpace: false,
    coefficientTolerance,
  };
}

/** Custom functions linear in their parameters, solved directly rather than
 * guessed by a nonlinear optimizer. Nonlinear parameter use is rejected. */
export function customRegression(
  points: Point[],
  formula: string,
  names: string[],
  angle: Angle,
): Fit {
  const expression = scalar(formula);
  if (names.length < 1 || names.length > 5 || expression.calls.size)
    throw new Error(
      "Use up to five single-letter parameters and built-in functions.",
    );
  const nonlinear = isNonlinearInParameters(expression.node, names);
  if (
    points.length < names.length ||
    points.some((p) => ![p.x, p.y].every(Number.isFinite))
  )
    throw new Error(`Use at least ${names.length} complete finite points.`);
  if (nonlinear) {
    const model = (x: number, values: number[]) =>
      expression.value(
        { ...Object.fromEntries(names.map((name, i) => [name, values[i]])), x },
        {},
        angle,
      );
    const found = nonlinearLeastSquares(names.length, (values) => {
      const result = points.map((p) => p.y - model(p.x, values));
      return result.every(Number.isFinite) ? result : undefined;
    });
    if (!found)
      throw new Error(
        "No fit was found. Try different data or a different model.",
      );
    const residuals = points.map((p) => p.y - model(p.x, found.parameters));
    const mean = points.reduce((sum, p) => sum + p.y / points.length, 0);
    const sst = points.reduce((sum, p) => sum + (p.y - mean) ** 2, 0);
    return {
      coefficients: found.parameters,
      predict: (x) => model(x, found.parameters),
      residuals,
      rmse: Math.sqrt(found.sse / points.length),
      r2: sst > 0 ? 1 - found.sse / sst : undefined,
      logSpace: false,
      custom: { formula, names },
    };
  }
  const zero = Object.fromEntries(names.map((name) => [name, 0]));
  const evaluate = (x: number, parameters: Record<string, number>) =>
    expression.value({ ...parameters, x }, {}, angle);
  const offset = points.map((p) => evaluate(p.x, zero));
  const rows = points.map((p, i) =>
    names.map((name) => evaluate(p.x, { ...zero, [name]: 1 }) - offset[i]),
  );
  const scales = names.map((_, i) =>
    Math.max(...rows.map((row) => Math.abs(row[i]))),
  );
  if (
    [...offset, ...rows.flat(), ...scales].some((v) => !Number.isFinite(v)) ||
    scales.some((v) => v === 0)
  )
    throw new Error("The data cannot determine this model in its domain.");
  const qr = new QrDecomposition(
    new Matrix(rows.map((row) => row.map((v, i) => v / scales[i]))),
  );
  const diagonal = qr.upperTriangularMatrix.diag().map(Math.abs);
  if (!qr.isFullRank() || Math.min(...diagonal) < Math.max(...diagonal) * 1e-10)
    throw new Error("The custom fit is underdetermined or ill-conditioned.");
  const coefficients = qr
    .solve(Matrix.columnVector(points.map((p, i) => p.y - offset[i])))
    .to1DArray()
    .map((v, i) => v / scales[i]);
  const parameters = Object.fromEntries(
    names.map((name, i) => [name, coefficients[i]]),
  );
  const predict = (x: number) => evaluate(x, parameters);
  const residuals = points.map((p) => p.y - predict(p.x));
  const mean = points.reduce((sum, p) => sum + p.y / points.length, 0);
  const sse = residuals.reduce((sum, r) => sum + r * r, 0),
    sst = points.reduce((sum, p) => sum + (p.y - mean) ** 2, 0);
  if ([...coefficients, sse, sst].some((v) => !Number.isFinite(v)))
    throw new Error("The fit exceeds the supported numeric range.");
  return {
    coefficients,
    predict,
    residuals,
    rmse: Math.sqrt(sse / points.length),
    r2: sst > 0 ? 1 - sse / sst : undefined,
    logSpace: false,
    custom: { formula, names },
    coefficientTolerance: scales.map(
      (scale) =>
        (4 *
          Number.EPSILON *
          names.length *
          Math.max(...points.map((p) => Math.abs(p.y))) *
          Math.max(...diagonal)) /
        Math.min(...diagonal) /
        scale,
    ),
  };
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
  const localResolution =
    (4 *
      Number.EPSILON *
      terms.length *
      Math.max(...points.map((p) => Math.abs(p.y))) *
      Math.max(...diagonal)) /
    Math.min(...diagonal);
  const coefficientTolerance = Array(degree + 1).fill(0) as number[];
  if (model !== "exponential")
    for (const k of terms)
      for (let j = 0; j <= k; j++)
        coefficientTolerance[j] +=
          localResolution *
          Math.abs((binomial[k][j] * (-center) ** (k - j)) / scale ** k);
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
    coefficientTolerance:
      model === "exponential" ? undefined : coefficientTolerance,
  };
}

/** Supported SAT templates, with user-chosen single-letter parameter names. */
export function regressionSpec(text: string) {
  const compact = text.replace(/\s/g, "");
  const parts = compact.split("~");
  if (parts.length !== 2 || !parts[0] || !parts[1])
    throw new Error(
      "Write a relation with one ~, such as 8c ~ 3 or y_1 ~ m x_1 + b.",
    );
  const match = compact.match(/^([a-zA-Z](?:_\d+)?)~(.+)$/);
  if (!match)
    return { kind: "relation" as const, left: parts[0], right: parts[1] };
  const y = match[1],
    formula = match[2];
  const dataName = formula.match(/[a-zA-Z]_\d+/)?.[0];
  if (!dataName)
    return { kind: "relation" as const, left: parts[0], right: parts[1] };
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
  found =
    rhs.match(/^([a-z])exp\(([a-z])X\)$/) ??
    rhs.match(/^([a-z])e\^\(([a-z])X\)$/);
  if (found)
    return {
      y,
      x: dataName,
      model: "exponential" as const,
      names: [found[1], found[2]],
      exponentialRate: true,
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
  const customFormula = formula.replaceAll(dataName, "x");
  const expression = scalar(customFormula);
  const names = [...expression.symbols].filter((name) => name !== "x");
  if (names.length && names.every((name) => /^[a-df-wz]$/.test(name)))
    return {
      y,
      x: dataName,
      model: "custom" as const,
      names,
      formula: customFormula,
    };
  return { kind: "relation" as const, left: parts[0], right: parts[1] };
}
