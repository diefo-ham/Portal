import { useEffect, useRef, type KeyboardEvent } from "react";
import {
  pressKey,
  type CalcKey,
  type CalcState,
  type Operator,
} from "../core/simpleCalculator";

/** The TSIA2's Basic and Square-root calculators: a keypad and a display, nothing else. */
export function SimpleCalculator({
  tier,
  state,
  onChange,
  autoFocus = true,
}: {
  tier: "basic" | "sqrt";
  state: CalcState;
  onChange: (state: CalcState) => void;
  autoFocus?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoFocus) root.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  const send = (key: CalcKey) => onChange(pressKey(state, key));
  const operator = (value: Operator): CalcKey => ({
    type: "operator",
    operator: value,
  });
  const digit = (value: string): CalcKey => ({ type: "digit", digit: value });
  // Keys typed with the keypad itself focused; a focused button keeps its own Enter and Space.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const { key } = event;
    const mapped: CalcKey | undefined = /^[0-9]$/.test(key)
      ? digit(key)
      : key === "." || key === ","
        ? { type: "point" }
        : key === "+" || key === "-" || key === "/"
          ? operator(key)
          : key === "*" || key === "x" || key === "X"
            ? operator("*")
            : key === "Enter" || key === "="
              ? { type: "equals" }
              : key === "Backspace"
                ? { type: "backspace" }
                : key === "Delete" || key === "c" || key === "C"
                  ? { type: "clear" }
                  : tier === "sqrt" && (key === "r" || key === "R")
                    ? { type: "sqrt" }
                    : undefined;
    if (!mapped) return;
    event.preventDefault();
    send(mapped);
  };
  const keys: { label: string; name: string; key: CalcKey; wide?: boolean }[] =
    [
      { label: "C", name: "Clear", key: { type: "clear" } },
      { label: "⌫", name: "Backspace", key: { type: "backspace" } },
      { label: "±", name: "Change sign", key: { type: "negate" } },
      { label: "÷", name: "Divide", key: operator("/") },
      { label: "7", name: "7", key: digit("7") },
      { label: "8", name: "8", key: digit("8") },
      { label: "9", name: "9", key: digit("9") },
      { label: "×", name: "Multiply", key: operator("*") },
      { label: "4", name: "4", key: digit("4") },
      { label: "5", name: "5", key: digit("5") },
      { label: "6", name: "6", key: digit("6") },
      { label: "−", name: "Subtract", key: operator("-") },
      { label: "1", name: "1", key: digit("1") },
      { label: "2", name: "2", key: digit("2") },
      { label: "3", name: "3", key: digit("3") },
      { label: "+", name: "Add", key: operator("+") },
      { label: "0", name: "0", key: digit("0") },
      { label: ".", name: "Decimal point", key: { type: "point" } },
      { label: "=", name: "Equals", key: { type: "equals" }, wide: true },
    ];
  return (
    <div
      className="simple-calculator"
      ref={root}
      tabIndex={0}
      role="group"
      aria-label={
        tier === "sqrt" ? "Square root calculator" : "Basic calculator"
      }
      onKeyDown={onKeyDown}
    >
      <output className="simple-calculator-display" aria-live="polite">
        {state.display}
      </output>
      <div className="simple-calculator-keys">
        {tier === "sqrt" && (
          <button
            type="button"
            className="wide"
            aria-label="Square root"
            onClick={() => send({ type: "sqrt" })}
          >
            √
          </button>
        )}
        {keys.map(({ label, name, key, wide }) => (
          <button
            type="button"
            key={name}
            className={wide ? "wide" : undefined}
            aria-label={name}
            onClick={() => send(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
