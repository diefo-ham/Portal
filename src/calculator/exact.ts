/** Conservative, bounded recognition, never a symbolic algebra engine. */
export function rational(
  value: number,
  maxDenominator = 1000,
  tolerance = 32 * Number.EPSILON,
): [number, number] | undefined {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) return;
  if (Number.isInteger(value)) return [value, 1];
  // Never convert a genuinely tiny nonzero value into zero.
  if (Math.abs(value) < 1 / maxDenominator) return;
  let x = Math.abs(value),
    p0 = 0,
    p1 = 1,
    q0 = 1,
    q1 = 0;
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(x),
      p = a * p1 + p0,
      q = a * q1 + q0;
    if (q > maxDenominator || !Number.isSafeInteger(p)) break;
    if (Math.abs(p / q - Math.abs(value)) <= tolerance * Math.abs(value))
      return [Math.sign(value) * p, q];
    p0 = p1;
    p1 = p;
    q0 = q1;
    q1 = q;
    if (x === a) break;
    x = 1 / (x - a);
  }
}
const fraction = ([n, d]: [number, number]) => (d === 1 ? `${n}` : `${n}/${d}`);
/** Small square-free radicals with small rational multipliers only. */
export function radicalForm(
  value: number,
  tolerance = 64 * Number.EPSILON,
): string | undefined {
  if (!Number.isFinite(value) || value === 0) return;
  for (const radicand of [2, 3, 5, 6, 7, 10, 11, 13]) {
    const pair = rational(value / Math.sqrt(radicand), 12, tolerance);
    if (!pair || !pair[0] || Math.abs(pair[0]) > 12) continue;
    const [n, d] = pair;
    return `${n < 0 ? "−" : ""}${Math.abs(n) === 1 ? "" : Math.abs(n)}√${radicand}${d === 1 ? "" : `/${d}`}`;
  }
}
export function exactForm(value: number, source = ""): string | undefined {
  const pair = rational(value);
  if (pair) return fraction(pair);
  if (/\bpi\b|π/.test(source)) {
    const multiple = rational(value / Math.PI, 24);
    if (multiple) return piForm(multiple);
  }
  const root = source.trim().match(/^sqrt\(\s*(\d{1,6})\s*\)$/);
  if (
    root &&
    Math.abs(value ** 2 - Number(root[1])) <=
      16 * Number.EPSILON * Number(root[1])
  ) {
    let inside = Number(root[1]),
      outside = 1;
    for (let k = 2; k * k <= inside; k++)
      while (inside % (k * k) === 0) {
        outside *= k;
        inside /= k * k;
      }
    return inside === 1
      ? `${outside}`
      : `${outside === 1 ? "" : outside}√${inside}`;
  }
  if (/sqrt|sin|cos|tan|√/.test(source)) return radicalForm(value);
}
function piForm([n, d]: [number, number]) {
  if (n === 0) return "0";
  return `${n < 0 ? "−" : ""}${Math.abs(n) === 1 ? "" : Math.abs(n)}π${d === 1 ? "" : `/${d}`}`;
}
export function coordinateForm(value: number): string {
  if (value === 0) return "0";
  const pair = rational(value, 48, 2e-10);
  if (pair) return fraction(pair);
  const pi = rational(value / Math.PI, 24, 2e-9);
  if (pi) return piForm(pi);
  const radical = radicalForm(value, 5e-11);
  if (radical) return radical;
  return Number.isFinite(value)
    ? Number(value.toPrecision(6)).toString()
    : "Undefined";
}
