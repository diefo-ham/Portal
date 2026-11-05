import { roundSig } from "@/src/utils/calculator";
import type { Fit } from "@/src/types/calculator";
import { rational } from "./exact";
export function displayedCoefficients(fit: Fit): number[] {
  return fit.coefficients.map((value, i) => {
    const tolerance = fit.coefficientTolerance?.[i] ?? 0;
    if (Math.abs(value) <= tolerance) return 0;
    const integer = Math.round(value);
    return Math.abs(value - integer) <= tolerance ? integer : value;
  });
}
/**
 * Coefficients as editable text. With `exact`, a coefficient that is a small
 * fraction to within the fit's own numerical resolution (10/3, not
 * 3.3333333333333335) is written as that fraction. Short terminating decimals
 * (0.5, 2.95) stay decimal, as do irrational or noisy values, so an export
 * never claims precision it lacks.
 */
function exactCoefficients(fit: Fit, c: number[]): string[] {
  return c.map((value, i) => {
    if (Number.isInteger(value) || !Number.isFinite(value)) return `${value}`;
    const resolution = (fit.coefficientTolerance?.[i] ?? 0) / Math.abs(value);
    const relative = Math.max(32 * Number.EPSILON, resolution);
    const short = Math.round(value * 1e4) / 1e4;
    if (Math.abs(value - short) <= relative * Math.abs(value))
      return `${short}`;
    const pair = rational(value, 1000, relative);
    return pair && pair[1] !== 1 ? `${pair[0]}/${pair[1]}` : `${value}`;
  });
}
export function fittedExpression(
  fit: Fit,
  displayPrecision?: number,
  exact = false,
): string {
  const c = displayedCoefficients(fit).map((value) =>
    displayPrecision ? roundSig(value, displayPrecision) : value,
  );
  const text = exact ? exactCoefficients(fit, c) : c.map(String);
  // A fraction needs parentheses wherever it multiplies something.
  const wrap = (s: string) => (s.includes("/") ? `(${s})` : s);
  if (fit.custom)
    return fit.custom.formula.replace(/\b[a-z]\b/g, (name) => {
      const index = fit.custom!.names.indexOf(name);
      return index < 0 ? name : `(${text[index]})`;
    });
  if (fit.exponential) return `${wrap(text[0])}*(${text[1]})^x`;
  const terms = c
    .map((value, power) => ({ value, power }))
    .reverse()
    .filter(({ value }) => value !== 0);
  return (
    terms
      .map(({ value, power }, i) => {
        const magnitude = Math.abs(value);
        const shown = text[power].replace(/^-/, "");
        const coefficient =
          power && magnitude === 1 ? "" : power ? wrap(shown) : shown;
        return `${value < 0 ? "-" : i ? "+" : ""}${coefficient}${power ? `x${power > 1 ? `^${power}` : ""}` : ""}`;
      })
      .join("") || "0"
  );
}
/** The expression offered by "Export to expression list". */
export const exportedExpression = (fit: Fit) =>
  fittedExpression(fit, undefined, true);
