import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./calculator.css";
import { Graph } from "./Graph";
import { TableEditor } from "./TableEditor";
import { calculateWorkspace } from "./workspace";
import {
  formatNumber as fmt,
  newExpression,
  type CalculatorState,
  type Entry,
} from "./model";
import type { Fit } from "./regression";

function MathDisplay({ tex }: { tex: string }) {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        throwOnError: false,
        trust: false,
        strict: "ignore",
        output: "htmlAndMathml",
        maxExpand: 100,
      }),
    [tex],
  );
  return (
    <div className="calc-math" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
function FitResult({ fit, exponential }: { fit: Fit; exponential: boolean }) {
  const c = fit.coefficients;
  const texNumber = (n: number) =>
    fmt(n).replace(/e([+-]?\d+)/, (_, power) => `\\times 10^{${power}}`);
  const polynomial = c
    .map((v, i) => ({ v, power: i }))
    .reverse()
    .map(
      ({ v, power }, i) =>
        `${i && v >= 0 ? "+" : ""}${texNumber(v)}${power ? `x${power > 1 ? `^{${power}}` : ""}` : ""}`,
    )
    .join(" ");
  const tex = exponential
    ? `y \\approx ${texNumber(c[0])} \\cdot \\left(${texNumber(c[1])}\\right)^{x}`
    : `y \\approx ${polynomial}`;
  return (
    <div className="calc-fit-result">
      <MathDisplay tex={tex} />
      <output aria-label="Regression coefficients">
        {(exponential
          ? ["a", "b"]
          : c.length === 2
            ? ["b", "m"]
            : c.length === 3
              ? ["c", "b", "a"]
              : ["d", "c", "b", "a"]
        )
          .map((name, i) => `${name} = ${fmt(c[i])}`)
          .join(" · ")}
      </output>
      <p>
        R² = {fit.r2 === undefined ? "undefined (constant y)" : fmt(fit.r2)} ·
        RMSE = {fmt(fit.rmse)}
      </p>
      {fit.logSpace && (
        <p className="small muted">
          Least squares in ln(y), not y. R² and RMSE above use the original y
          scale.
        </p>
      )}
      <details>
        <summary>Residuals (observed − fitted)</summary>
        <p className="calc-residuals">{fit.residuals.map(fmt).join(", ")}</p>
      </details>
    </div>
  );
}
export function Calculator({
  state,
  onChange,
  onClose,
  expanded,
  onExpand,
}: {
  state: CalculatorState;
  onChange: (s: CalculatorState) => void;
  onClose: () => void;
  expanded: boolean;
  onExpand: () => void;
}) {
  const deferred = useDeferredValue(state);
  const workspace = useMemo(
    () => calculateWorkspace(deferred),
    [deferred.entries, deferred.angle],
  );
  const first = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    (
      first.current ?? root.current?.querySelector<HTMLElement>("input,button")
    )?.focus();
  }, []);
  const change = (e: Entry) =>
    onChange({
      ...state,
      entries: state.entries.map((old) => (old.id === e.id ? e : old)),
    });
  const add = (e: Entry, after?: string) => {
    if (state.entries.length >= 24) {
      setError("This workspace supports up to 24 entries.");
      return;
    }
    const index = after
      ? state.entries.findIndex((v) => v.id === after) + 1
      : state.entries.length;
    const entries = [...state.entries];
    entries.splice(index, 0, e);
    onChange({ ...state, entries });
    setError("");
    requestAnimationFrame(() =>
      document.getElementById(`expression-${e.id}`)?.focus(),
    );
  };
  return (
    <section
      className={`calculator-workspace ${expanded ? "expanded" : ""}`}
      ref={root}
      aria-label="Offline graphing calculator"
    >
      <div className="calc-heading">
        <h2>Calculator</h2>
        <div>
          <button
            aria-label={expanded ? "Reduce calculator" : "Expand calculator"}
            onClick={onExpand}
          >
            {expanded ? "Reduce ↙" : "Expand ↗"}
          </button>
          <button aria-label="Close calculator" onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      <div className="calc-options">
        <span className="small muted">Local graphing workspace</span>
        <label>
          Angles
          <select
            aria-label="Angle mode"
            value={state.angle}
            onChange={(e) =>
              onChange({
                ...state,
                angle: e.target.value as CalculatorState["angle"],
              })
            }
          >
            <option value="radians">Radians</option>
            <option value="degrees">Degrees</option>
          </select>
        </label>
      </div>
      <div className="calc-body">
        <section
          className="calc-expression-area"
          aria-label="Expressions and data"
        >
          <div className="calc-add">
            <button
              onClick={() => add(newExpression())}
              disabled={state.entries.length >= 24}
            >
              + Expression
            </button>
            <button
              onClick={() =>
                add({
                  id: crypto.randomUUID(),
                  type: "table",
                  hidden: false,
                  rows: [
                    ["", ""],
                    ["", ""],
                    ["", ""],
                  ],
                  fit: "none",
                })
              }
              disabled={state.entries.length >= 24}
            >
              + Table
            </button>
          </div>
          <div className="calc-entry-list">
            {state.entries.map((entry, index) => {
              const result = workspace.results[entry.id];
              return (
                <section
                  className={`calc-entry graph-color-${index % 8}`}
                  key={entry.id}
                  aria-label={`${entry.type === "table" ? "Data table" : "Expression"} ${index + 1}`}
                >
                  <div className="calc-entry-heading">
                    <button
                      className="calc-visibility"
                      aria-label={`${entry.hidden ? "Show" : "Hide"} ${entry.type} ${index + 1}`}
                      aria-pressed={!entry.hidden}
                      onClick={() =>
                        change({ ...entry, hidden: !entry.hidden })
                      }
                    >
                      {entry.hidden ? "○" : "●"}
                    </button>
                    <span className="small muted">
                      {entry.type === "table" ? "Data" : index + 1}
                    </span>
                    <button
                      className="calc-icon"
                      aria-label={`Remove ${entry.type} ${index + 1}`}
                      onClick={() =>
                        onChange({
                          ...state,
                          entries: state.entries.filter(
                            (e) => e.id !== entry.id,
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                  {entry.type === "expression" ? (
                    <>
                      <input
                        ref={index === 0 ? first : undefined}
                        id={`expression-${entry.id}`}
                        className="calc-expression-input"
                        aria-label={`Expression ${index + 1}`}
                        aria-invalid={!!result?.error}
                        value={entry.text}
                        maxLength={240}
                        spellCheck={false}
                        autoComplete="off"
                        placeholder={
                          index === 0 ? "y = x^2 − 4" : "Expression or equation"
                        }
                        onChange={(e) =>
                          change({ ...entry, text: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.ctrlKey &&
                            !e.metaKey
                          ) {
                            e.preventDefault();
                            add(newExpression(), entry.id);
                          }
                          if (
                            e.key === "Backspace" &&
                            !entry.text &&
                            state.entries.length > 1
                          ) {
                            e.preventDefault();
                            const prev =
                              state.entries[index - 1] ||
                              state.entries[index + 1];
                            onChange({
                              ...state,
                              entries: state.entries.filter(
                                (v) => v.id !== entry.id,
                              ),
                            });
                            requestAnimationFrame(() =>
                              document
                                .getElementById(`expression-${prev.id}`)
                                ?.focus(),
                            );
                          }
                        }}
                      />
                      {result?.tex && entry.text && (
                        <MathDisplay tex={result.tex} />
                      )}
                      {result?.value !== undefined && (
                        <output className="calc-numeric-result">
                          = {fmt(result.value)}
                        </output>
                      )}
                      {result?.parameter && (
                        <label className="calc-slider">
                          <span className="sr-only">
                            {result.parameter.name} slider
                          </span>
                          <input
                            aria-label={`${result.parameter.name} slider`}
                            type="range"
                            min={Math.min(-10, result.parameter.value)}
                            max={Math.max(10, result.parameter.value)}
                            step="0.1"
                            value={result.parameter.value}
                            onChange={(e) =>
                              change({
                                ...entry,
                                text: `${result.parameter!.name} = ${e.target.value}`,
                              })
                            }
                          />
                        </label>
                      )}
                    </>
                  ) : (
                    <>
                      <TableEditor
                        entry={entry}
                        onChange={change}
                        onError={setError}
                      />
                      {result?.fit && (
                        <FitResult
                          fit={result.fit}
                          exponential={entry.fit === "exponential"}
                        />
                      )}
                    </>
                  )}
                  {result?.error && (
                    <p className="calc-error" role="status">
                      {result.error}
                    </p>
                  )}
                  {result?.message && (
                    <p className="small muted">{result.message}</p>
                  )}
                </section>
              );
            })}
          </div>
          {workspace.missing.length > 0 && (
            <div className="calc-parameters">
              <span className="small muted">Define parameters:</span>
              {workspace.missing.map((name) => (
                <button
                  key={name}
                  onClick={() => add(newExpression(`${name}=1`))}
                >
                  Add {name} slider
                </button>
              ))}
            </div>
          )}
          {error && (
            <p className="calc-error" role="alert">
              {error}
              <button
                aria-label="Dismiss calculator message"
                onClick={() => setError("")}
              >
                ×
              </button>
            </p>
          )}
          <details className="calc-help">
            <summary>Calculator help</summary>
            <p>
              Type ordinary math: 2x, x^2, sqrt(x), |x|, pi, e, sin(x), asin(x),
              log(x) (base 10), ln(x), exp(x). Use log(x, base) for another
              base. Functions use parentheses.
            </p>
            <p>
              Enter adds an expression. Define a=1 for a slider; f(x)=x^2
              defines a function. Try (2,3), x=5, y&lt;2x+1, or x^2+y^2=25.
              Tables accept paired rows or pasted tab/comma-separated data.
              Enter moves down a table column.
            </p>
            <p>
              Inspect points for numerical zeros, intersections, and turning
              points in the graph window. Implicit equations use approximate
              contours. A graph or numerical search is not a proof that all
              solutions have been found.
            </p>
            <p>
              Calculator work belongs to this session and saves locally. Close
              or Escape returns to the question. Keyboard shortcuts for study
              are inactive inside this panel.
            </p>
          </details>
        </section>
        <Graph
          graphs={workspace.graphs}
          view={state.view}
          onView={(view) => onChange({ ...state, view })}
        />
      </div>
    </section>
  );
}
export default Calculator;
