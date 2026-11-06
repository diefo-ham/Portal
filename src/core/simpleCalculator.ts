/**
 * The two small on-screen calculators of the TSIA2: Basic (add, subtract,
 * multiply, divide) and Square root (the same, plus a square-root key). They
 * work like a pocket calculator: each operator is carried out as soon as the next
 * one is pressed, so 2 + 3 × 4 gives 20. College Board does not publish how its
 * own calculators order operations, so this is the ordinary pocket-calculator
 * behaviour, not a copy. No UI and no network: the keypad component only
 * sends keys here.
 */

export type Operator = "+" | "-" | "*" | "/";

export interface CalcState {
  /** What the display shows. "Error" until cleared. */
  display: string;
  /** The left-hand value waiting for an operator to finish. */
  stored: number | null;
  operator: Operator | null;
  /** The next digit starts a new number instead of extending the display. */
  fresh: boolean;
}

export type CalcKey =
  | { type: "digit"; digit: string }
  | { type: "point" }
  | { type: "operator"; operator: Operator }
  | { type: "equals" }
  | { type: "negate" }
  | { type: "backspace" }
  | { type: "clear" }
  | { type: "sqrt" };

export const ERROR = "Error";
const MAX_DIGITS = 12;

export const emptyCalc = (): CalcState => ({
  display: "0",
  stored: null,
  operator: null,
  fresh: true,
});

/** A result as shown: at most 12 significant digits, no trailing zeros, no exponent for ordinary sizes. */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return ERROR;
  if (Object.is(value, -0)) return "0";
  const rounded = Number(value.toPrecision(MAX_DIGITS));
  if (Math.abs(rounded) >= 1e15 || (rounded !== 0 && Math.abs(rounded) < 1e-9))
    return ERROR;
  return String(rounded);
}

const apply = (left: number, operator: Operator, right: number): number =>
  operator === "+"
    ? left + right
    : operator === "-"
      ? left - right
      : operator === "*"
        ? left * right
        : right === 0
          ? NaN
          : left / right;

const value = (state: CalcState) => Number(state.display);

export function pressKey(state: CalcState, key: CalcKey): CalcState {
  if (key.type === "clear") return emptyCalc();
  if (state.display === ERROR) return state;
  switch (key.type) {
    case "digit": {
      const entered = state.fresh ? "" : state.display;
      const digits = entered.replace(/[-.]/g, "");
      if (digits.length >= MAX_DIGITS) return state;
      const next =
        entered === "0" || entered === "" ? key.digit : entered + key.digit;
      return { ...state, display: next, fresh: false };
    }
    case "point": {
      if (state.fresh) return { ...state, display: "0.", fresh: false };
      if (state.display.includes(".")) return state;
      return { ...state, display: state.display + "." };
    }
    case "negate": {
      if (state.display === "0" || state.display === "0.") return state;
      return {
        ...state,
        display: state.display.startsWith("-")
          ? state.display.slice(1)
          : "-" + state.display,
      };
    }
    case "backspace": {
      if (state.fresh) return state;
      const shorter = state.display.slice(0, -1);
      return {
        ...state,
        display: shorter === "" || shorter === "-" ? "0" : shorter,
      };
    }
    case "operator": {
      // A pending operation is finished first, unless nothing was typed since the operator.
      if (state.operator && state.stored !== null && !state.fresh) {
        const result = apply(state.stored, state.operator, value(state));
        const shown = formatResult(result);
        if (shown === ERROR) return { ...emptyCalc(), display: ERROR };
        return {
          display: shown,
          stored: Number(shown),
          operator: key.operator,
          fresh: true,
        };
      }
      return {
        display: state.display,
        stored: value(state),
        operator: key.operator,
        fresh: true,
      };
    }
    case "equals": {
      if (!state.operator || state.stored === null) return state;
      const shown = formatResult(
        apply(state.stored, state.operator, value(state)),
      );
      if (shown === ERROR) return { ...emptyCalc(), display: ERROR };
      return { display: shown, stored: null, operator: null, fresh: true };
    }
    case "sqrt": {
      const number = value(state);
      if (number < 0) return { ...emptyCalc(), display: ERROR };
      return {
        ...state,
        display: formatResult(Math.sqrt(number)),
        fresh: true,
      };
    }
  }
}
