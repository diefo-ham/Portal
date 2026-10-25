import { useState } from "react";
// Provider boundary: this panel can be replaced without changing practice or storage.
export function Calculator() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [op, setOp] = useState("+");
  const x = Number(a),
    y = Number(b);
  const result =
    op === "+"
      ? x + y
      : op === "−"
        ? x - y
        : op === "×"
          ? x * y
          : op === "÷"
            ? x / y
            : Math.pow(x, y);
  return (
    <section className="utility">
      <h3>Calculator</h3>
      <p className="muted small">Offline arithmetic · graphing planned</p>
      <div className="arithmetic">
        <input
          aria-label="First number"
          type="number"
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
        <select
          aria-label="Operation"
          value={op}
          onChange={(e) => setOp(e.target.value)}
        >
          {["+", "−", "×", "÷", "power"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <input
          aria-label="Second number"
          type="number"
          value={b}
          onChange={(e) => setB(e.target.value)}
        />
      </div>
      <output className="calculator-result">
        {a && b
          ? Number.isFinite(result)
            ? Number(result.toPrecision(12))
            : "Undefined"
          : "—"}
      </output>
      <p className="small muted">
        This is a basic arithmetic aid, not a SAT graphing calculator.
      </p>
    </section>
  );
}
