import type { ComparisonSource } from "./restrictionSyntax";

export interface PiecewiseSource {
  clauses: { conditions: ComparisonSource[]; value: string }[];
  /** The value used when no condition holds; undefined means "not defined". */
  fallback?: string;
}

/** Splits at separators that are not inside brackets. */
function topLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if ("([".includes(char)) depth++;
    if (")]".includes(char)) depth--;
    if (depth < 0)
      throw new Error("Check the brackets in this piecewise function.");
    if (depth === 0 && char === separator) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  if (depth) throw new Error("Check the brackets in this piecewise function.");
  parts.push(text.slice(start));
  return parts;
}

/**
 * Reads `{x<0: -x, x}`: comparisons, a colon and a value, with an optional last
 * value for everything else. Returns undefined when the text is not wrapped in
 * one pair of braces (a trailing `{x>0}` domain restriction is something else).
 */
export function piecewiseSource(source: string): PiecewiseSource | undefined {
  const text = source.trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return undefined;
  const inside = text.slice(1, -1);
  if (inside.includes("{") || inside.includes("}")) return undefined;
  const items = topLevel(inside, ",").map((item) => item.trim());
  if (!items.length || items.length > 10 || items.some((item) => !item))
    throw new Error("Write a piecewise function like {x<0: -x, x}.");
  const clauses: PiecewiseSource["clauses"] = [];
  let fallback: string | undefined;
  items.forEach((item, index) => {
    const parts = topLevel(item, ":");
    if (parts.length === 1) {
      if (index !== items.length - 1)
        throw new Error("Only the last piece may omit its condition.");
      fallback = parts[0].trim();
      return;
    }
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim())
      throw new Error("Write each piece as condition: value.");
    const operands = parts[0].split(/(<=|>=|<|>)/).map((s) => s.trim());
    if (
      operands.length < 3 ||
      operands.length % 2 !== 1 ||
      operands.some((s) => !s)
    )
      throw new Error("Use comparisons such as x<0 or 0<=x<5 as conditions.");
    const conditions: ComparisonSource[] = [];
    for (let i = 1; i < operands.length; i += 2)
      conditions.push({
        left: operands[i - 1],
        op: operands[i],
        right: operands[i + 1],
      });
    clauses.push({ conditions, value: parts[1].trim() });
  });
  return { clauses, fallback };
}
