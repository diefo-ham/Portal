export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}
export type FitModel =
  "none" | "linear" | "quadratic" | "cubic" | "exponential";
export interface ExpressionEntry {
  id: string;
  type: "expression";
  text: string;
  hidden: boolean;
}
export interface TableEntry {
  id: string;
  type: "table";
  rows: [string, string][];
  hidden: boolean;
  fit: FitModel;
}
export type Entry = ExpressionEntry | TableEntry;
export interface CalculatorState {
  version: 1;
  entries: Entry[];
  angle: "radians" | "degrees";
  view: Viewport;
}
export const defaultView = (): Viewport => ({
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
});
export const newExpression = (text = ""): ExpressionEntry => ({
  id: crypto.randomUUID(),
  type: "expression",
  text,
  hidden: false,
});
export const emptyCalculator = (): CalculatorState => ({
  version: 1,
  entries: [newExpression()],
  angle: "radians",
  view: defaultView(),
});
export function validView(v: Viewport) {
  return (
    v &&
    [v.xMin, v.xMax, v.yMin, v.yMax].every(
      (n) => Number.isFinite(n) && Math.abs(n) <= 1e10,
    ) &&
    v.xMax - v.xMin >= 1e-7 &&
    v.yMax - v.yMin >= 1e-7
  );
}
/** Small, versioned workspace; safe to include in session backups and reset archives. */
export function validateCalculator(raw: unknown): CalculatorState {
  const s = raw as CalculatorState;
  const text = (v: unknown) => typeof v === "string" && v.length <= 240;
  if (
    !s ||
    s.version !== 1 ||
    !["radians", "degrees"].includes(s.angle) ||
    !validView(s.view) ||
    !Array.isArray(s.entries) ||
    s.entries.length > 24
  )
    throw new Error("Invalid calculator workspace.");
  const ids = new Set<string>();
  for (const e of s.entries) {
    if (
      !e ||
      typeof e.id !== "string" ||
      !/^[\w-]{1,80}$/.test(e.id) ||
      ids.has(e.id) ||
      typeof e.hidden !== "boolean"
    )
      throw new Error("Invalid calculator entry.");
    ids.add(e.id);
    if (
      e.type === "expression"
        ? !text(e.text)
        : e.type !== "table" ||
          !["none", "linear", "quadratic", "cubic", "exponential"].includes(
            e.fit,
          ) ||
          !Array.isArray(e.rows) ||
          e.rows.length > 200 ||
          e.rows.some(
            (r) => !Array.isArray(r) || r.length !== 2 || !r.every(text),
          )
    )
      throw new Error("Invalid calculator expression or table.");
  }
  return structuredClone(s);
}
export interface Point {
  x: number;
  y: number;
}
export const formatNumber = (n: number) =>
  Number.isFinite(n) ? Number(n.toPrecision(10)).toString() : "Undefined";
