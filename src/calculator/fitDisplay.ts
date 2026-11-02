import type { Fit } from "./regression";
export function displayedCoefficients(fit: Fit): number[] {
  return fit.coefficients.map((value, i) => {
    const tolerance = fit.coefficientTolerance?.[i] ?? 0;
    if (Math.abs(value) <= tolerance) return 0;
    const integer = Math.round(value);
    return Math.abs(value - integer) <= tolerance ? integer : value;
  });
}
export function fittedExpression(fit: Fit, displayPrecision?: number): string {
  const c = displayedCoefficients(fit).map((value) =>
    displayPrecision ? Number(value.toPrecision(displayPrecision)) : value,
  );
  if (fit.custom)
    return fit.custom.formula.replace(/\b[a-z]\b/g, (name) => {
      const index = fit.custom!.names.indexOf(name);
      return index < 0 ? name : `(${c[index]})`;
    });
  if (fit.exponential) return `${c[0]}*(${c[1]})^x`;
  const terms = c
    .map((value, power) => ({ value, power }))
    .reverse()
    .filter(({ value }) => value !== 0);
  return (
    terms
      .map(({ value, power }, i) => {
        const magnitude = Math.abs(value);
        const coefficient = power && magnitude === 1 ? "" : `${magnitude}`;
        return `${value < 0 ? "-" : i ? "+" : ""}${coefficient}${power ? `x${power > 1 ? `^${power}` : ""}` : ""}`;
      })
      .join("") || "0"
  );
}
