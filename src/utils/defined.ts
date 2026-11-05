/**
 * Returns a value that the code knows must exist, such as a question looked up
 * by an id taken from the same data. If it is missing anyway, this throws a
 * clear error naming what was missing, instead of failing later on `undefined`.
 */
export function defined<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined)
    throw new Error(`${what} no longer exists.`);
  return value;
}
