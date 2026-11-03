import { Calculator } from "./Calculator";
import { emptyCalculator, type CalculatorState } from "./model";
import "./calculator.css";

export function CalculatorSurface({
  state,
  onChange,
  autoFocus = true,
}: {
  state: CalculatorState;
  onChange: (state: CalculatorState) => void;
  autoFocus?: boolean;
}) {
  const clear = () => {
    onChange(emptyCalculator());
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(".offline-workspace textarea")
        ?.focus(),
    );
  };
  return (
    <section
      className="calculator-workspace calculator-surface"
      aria-label="Calculator workspace"
    >
      <div className="calc-provider-bar">
        <button className="text-button" onClick={clear}>
          Clear calculator
        </button>
      </div>
      <Calculator state={state} onChange={onChange} autoFocus={autoFocus} />
    </section>
  );
}
export default CalculatorSurface;
