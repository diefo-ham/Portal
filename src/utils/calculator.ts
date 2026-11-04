/**
 * Limits `value` to the range [min, max]. If the range is inverted
 * (min > max), `min` wins, matching `Math.max(min, Math.min(max, value))`.
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Rounds to `digits` significant digits and returns a number, so floating-point
 * noise such as 0.30000000000000004 becomes 0.3. NaN and ±Infinity pass through.
 * `digits` must be between 1 and 100.
 */
export const roundSig = (value: number, digits: number): number =>
  Number(value.toPrecision(digits));
