import type { MathNode } from "mathjs";

export type Angle = "radians" | "degrees";
export type Numeric = number | number[];
export interface Scalar {
  node: MathNode;
  symbols: Set<string>;
  calls: Set<string>;
  value: (
    scope: Record<string, number>,
    functions: Record<string, (x: number) => number>,
    angle: Angle,
  ) => number;
  evaluate: (
    scope: Record<string, Numeric>,
    functions: Record<string, (x: number) => number>,
    angle: Angle,
  ) => Numeric;
}
export interface Point {
  x: number;
  y: number;
}
export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}
export interface Size {
  width: number;
  height: number;
}
export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Range and step of the slider shown for a defined number such as a=2. */
export interface SliderSettings {
  min: number;
  max: number;
  step: number;
}
export type FitModel =
  "none" | "linear" | "quadratic" | "cubic" | "exponential";
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
  angle: Angle;
  view: Viewport;
  /** Ordinary graph interaction preserves one physical pixel scale per unit. */
  equalAxes?: boolean;
  /** Last expression/table that legitimately owned focus in Offline mode. */
  activeEntryId?: string;
}
export interface Fit {
  coefficients: number[]; // increasing powers of x; exponential: a, b in a*b^x
  predict: (x: number) => number;
  r2?: number;
  rmse: number;
  residuals: number[];
  logSpace: boolean;
  exponential?: boolean;
  /** Estimated numerical resolution per coefficient, for presentation only. */
  coefficientTolerance?: number[];
  custom?: { formula: string; names: string[] };
}
export type ParameterBound = {
  min?: number;
  max?: number;
  minOpen?: boolean;
  maxOpen?: boolean;
};
export type ParameterBounds = Record<string, ParameterBound>;
export type Restriction = { left: Scalar; right: Scalar; op: string };
