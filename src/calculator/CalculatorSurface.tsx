import { Calculator } from "./Calculator";
import "./calculator.scss";
import type { CalculatorState } from "@/src/types/calculator";

export function CalculatorSurface({
  state,
  onChange,
  autoFocus = true,
}: {
  state: CalculatorState;
  onChange: (state: CalculatorState) => void;
  autoFocus?: boolean;
}) {
  return (
    <section
      className="calculator-workspace calculator-surface"
      aria-label="Calculator workspace"
    >
      <Calculator state={state} onChange={onChange} autoFocus={autoFocus} />
    </section>
  );
}
export default CalculatorSurface;
