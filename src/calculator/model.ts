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
  /** Optional structural source; legacy text-only expressions remain readable. */
  latex?: string;
  hidden: boolean;
}
export interface TableEntry {
  id: string;
  type: "table";
  rows: [string, string][];
  hidden: boolean;
  fit: FitModel;
  /** Stable session-local list identifiers, e.g. x_1 and y_1. */
  columns?: [string, string];
}
export type Entry = ExpressionEntry | TableEntry;
export interface CalculatorState {
  version: 1;
  entries: Entry[];
  angle: "radians" | "degrees";
  view: Viewport;
  mode?: "desmos" | "offline";
  /** Official getState() JSON, kept opaque and separate from offline entries. */
  desmos?: Record<string, unknown>;
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
  const text = (v: unknown) => typeof v === "string" && v.length <= 1200;
  if (
    !s ||
    s.version !== 1 ||
    !["radians", "degrees"].includes(s.angle) ||
    !validView(s.view) ||
    !Array.isArray(s.entries) ||
    s.entries.length > 25 ||
    (s.mode !== undefined && !["desmos", "offline"].includes(s.mode))
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
        ? !text(e.text) ||
          (e.latex !== undefined &&
            (typeof e.latex !== "string" || e.latex.length > 1500))
        : e.type !== "table" ||
          !["none", "linear", "quadratic", "cubic", "exponential"].includes(
            e.fit,
          ) ||
          !Array.isArray(e.rows) ||
          e.rows.length > 200 ||
          e.rows.some(
            (r) => !Array.isArray(r) || r.length !== 2 || !r.every(text),
          ) ||
          (e.columns !== undefined &&
            (!Array.isArray(e.columns) ||
              e.columns.length !== 2 ||
              e.columns.some(
                (name) => !/^[a-zA-Z]_[1-9][0-9]{0,2}$/.test(name),
              )))
    )
      throw new Error("Invalid calculator expression or table.");
  }
  if (s.desmos !== undefined) validateDesmosState(s.desmos);
  return structuredClone(s);
}
/** Validate transport safety/size only. Never interpret proprietary state fields. */
export function validateDesmosState(raw: unknown): Record<string, unknown> {
  let count = 0;
  const visit = (value: unknown, depth = 0): void => {
    if (++count > 100000 || depth > 40)
      throw new Error("Desmos workspace is too large.");
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "number" && Number.isFinite(value)) return;
    if (typeof value === "string" && value.length <= 500000) return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (
      value &&
      typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      for (const [key, item] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw new Error("Invalid Desmos workspace key.");
        visit(item, depth + 1);
      }
      return;
    }
    throw new Error("Invalid Desmos workspace.");
  };
  if (!raw || Array.isArray(raw) || typeof raw !== "object")
    throw new Error("Invalid Desmos workspace.");
  visit(raw);
  if (JSON.stringify(raw).length > 2000000)
    throw new Error("Desmos workspace exceeds 2 MB.");
  return structuredClone(raw) as Record<string, unknown>;
}

export function withBlankExpression(state: CalculatorState): CalculatorState {
  if (
    state.entries.some(
      (entry) =>
        entry.type === "expression" &&
        !entry.text.trim() &&
        !entry.latex?.trim(),
    )
  )
    return state;
  return { ...state, entries: [...state.entries, newExpression()] };
}

export function tableColumns(
  state: CalculatorState,
  id: string,
): [string, string] {
  const tables = state.entries.filter(
    (entry): entry is TableEntry => entry.type === "table",
  );
  const table = tables.find((entry) => entry.id === id);
  return (
    table?.columns ?? [
      `x_${tables.findIndex((entry) => entry.id === id) + 1}`,
      `y_${tables.findIndex((entry) => entry.id === id) + 1}`,
    ]
  );
}
export interface Point {
  x: number;
  y: number;
}
export const formatNumber = (n: number) =>
  Number.isFinite(n) ? Number(n.toPrecision(10)).toString() : "Undefined";
