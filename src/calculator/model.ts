import { roundSig } from "@/src/utils/calculator";
export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}
export type FitModel =
  "none" | "linear" | "quadratic" | "cubic" | "exponential";
/** Range and step of the slider shown for a defined number such as a=2. */
export interface SliderSettings {
  min: number;
  max: number;
  step: number;
}
export const defaultSlider = (value = 0): SliderSettings => ({
  min: Math.min(-10, Math.floor(value)),
  max: Math.max(10, Math.ceil(value)),
  step: 0.1,
});
export const validSlider = (s: SliderSettings) =>
  [s.min, s.max, s.step].every(Number.isFinite) &&
  Math.abs(s.min) <= 1e9 &&
  Math.abs(s.max) <= 1e9 &&
  s.min < s.max &&
  s.step >= 1e-6 &&
  (s.max - s.min) / s.step <= 1e6;
export interface ExpressionEntry {
  id: string;
  type: "expression";
  text: string;
  /** Saved slider range and step; absent until the person changes them. */
  slider?: SliderSettings;
  /** Optional structural source; legacy text-only expressions remain readable. */
  latex?: string;
  hidden: boolean;
  color?: number;
}
export interface TableEntry {
  id: string;
  type: "table";
  rows: [string, string][];
  hidden: boolean;
  color?: number;
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
  /** Ordinary graph interaction preserves one physical pixel scale per unit. */
  equalAxes?: boolean;
  /** Last expression/table that legitimately owned focus in Offline mode. */
  activeEntryId?: string;
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
  equalAxes: true,
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
    (s.equalAxes !== undefined && typeof s.equalAxes !== "boolean") ||
    !Array.isArray(s.entries) ||
    s.entries.length > 25
  )
    throw new Error("Invalid calculator workspace.");
  const ids = new Set<string>();
  for (const e of s.entries) {
    if (
      !e ||
      typeof e.id !== "string" ||
      !/^[\w-]{1,80}$/.test(e.id) ||
      ids.has(e.id) ||
      typeof e.hidden !== "boolean" ||
      (e.color !== undefined &&
        (!Number.isInteger(e.color) || e.color < 0 || e.color > 7))
    )
      throw new Error("Invalid calculator entry.");
    ids.add(e.id);
    if (
      e.type === "expression"
        ? !text(e.text) ||
          (e.latex !== undefined &&
            (typeof e.latex !== "string" || e.latex.length > 1500)) ||
          (e.slider !== undefined &&
            (typeof e.slider !== "object" ||
              e.slider === null ||
              !validSlider(e.slider)))
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
  if (
    s.activeEntryId !== undefined &&
    (typeof s.activeEntryId !== "string" || !ids.has(s.activeEntryId))
  )
    throw new Error("Invalid active calculator entry.");
  // Sessions saved while Desmos was offered may carry its fields; they are dropped.
  const {
    mode: _mode,
    desmos: _desmos,
    ...kept
  } = s as CalculatorState & Record<string, unknown>;
  return structuredClone(kept as CalculatorState);
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
  Number.isFinite(n) ? roundSig(n, 10).toString() : "Undefined";
