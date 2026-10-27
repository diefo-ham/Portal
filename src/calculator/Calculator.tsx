import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./calculator.css";
import { Graph } from "./Graph";
import { TableEditor } from "./TableEditor";
import { MathEditor, focusMath } from "./MathEditor";
import { calculateWorkspace } from "./workspace";
import {
  formatNumber as fmt,
  newExpression,
  tableColumns,
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
function FitResult({
  fit,
  exponential,
  parameters,
}: {
  fit: Fit;
  exponential: boolean;
  parameters?: Record<string, number>;
}) {
  const c = fit.coefficients;
  const number = (n: number) =>
    fmt(n).replace(/e([+-]?\d+)/, (_, power) => `\\times 10^{${power}}`);
  const polynomial = c
    .map((v, power) => ({ v, power }))
    .reverse()
    .map(
      ({ v, power }, i) =>
        `${i && v >= 0 ? "+" : ""}${number(v)}${power ? `x${power > 1 ? `^{${power}}` : ""}` : ""}`,
    )
    .join(" ");
  return (
    <div className="calc-fit-result">
      <MathDisplay
        tex={
          exponential
            ? `y \\approx ${number(c[0])} \\cdot \\left(${number(c[1])}\\right)^{x}`
            : `y \\approx ${polynomial}`
        }
      />
      <output
        aria-label={
          parameters ? "Fitted parameters" : "Regression coefficients"
        }
      >
        {parameters
          ? Object.entries(parameters)
              .map(([name, value]) => `${name} = ${fmt(value)}`)
              .join(" · ")
          : (exponential
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
          Least squares in ln(y), not y. Statistics use the original y scale.
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
}: {
  state: CalculatorState;
  onChange: (state: CalculatorState) => void;
}) {
  const deferred = useDeferredValue(state);
  const workspace = useMemo(
    () => calculateWorkspace(deferred),
    [deferred.entries, deferred.angle],
  );
  const root = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    (
      root.current?.querySelector<HTMLElement>("textarea") ??
      root.current?.querySelector<HTMLElement>("input,button")
    )?.focus();
  }, []);
  const change = (entry: Entry) =>
    onChange({
      ...state,
      entries: state.entries.map((old) => (old.id === entry.id ? entry : old)),
    });
  const focus = (id: string) => requestAnimationFrame(() => focusMath(id));
  const add = (entry: Entry, after?: string) => {
    if (state.entries.length >= 24) {
      setError("This workspace supports up to 24 working entries.");
      return;
    }
    const blankIndex = state.entries.findIndex(
      (item) => item.type === "expression" && !item.text && !item.latex,
    );
    const index = after
      ? state.entries.findIndex((item) => item.id === after) + 1
      : blankIndex < 0
        ? state.entries.length
        : blankIndex;
    const entries = [...state.entries];
    entries.splice(index, 0, entry);
    onChange({ ...state, entries });
    setError("");
    focus(entry.id);
  };
  const remove = (entry: Entry, index: number) => {
    const entries = state.entries.filter(
      (candidate) => candidate.id !== entry.id,
    );
    if (
      !entries.some(
        (candidate) =>
          candidate.type === "expression" &&
          !candidate.text &&
          !candidate.latex,
      )
    )
      entries.push(newExpression());
    onChange({ ...state, entries });
    focus(entries[Math.max(0, Math.min(index - 1, entries.length - 1))].id);
  };
  const table = (replace?: string) => {
    const used = new Set(
      state.entries
        .filter((entry) => entry.type === "table")
        .flatMap((entry) => tableColumns(state, entry.id)),
    );
    for (const item of state.entries)
      if (item.type === "expression")
        for (const name of item.text.match(/[a-zA-Z]_\d+/g) || [])
          used.add(name);
    let n = 1;
    while (used.has(`x_${n}`) || used.has(`y_${n}`)) n++;
    const entry: Entry = {
      id: replace ?? crypto.randomUUID(),
      type: "table",
      hidden: false,
      rows: [["", ""]],
      fit: "none",
      columns: [`x_${n}`, `y_${n}`],
    };
    if (replace) {
      change(entry);
      focus(entry.id);
    } else add(entry);
  };
  const nextRow = (entry: Entry, index: number) => {
    const next = state.entries[index + 1];
    if (next) focus(next.id);
    else add(newExpression(), entry.id);
  };
  return (
    <section
      className="offline-workspace"
      ref={root}
      aria-label="Offline graphing calculator"
    >
      <div className="calc-options">
        <span className="small muted">Saved on this device</span>
        <label>
          Angles{" "}
          <select
            aria-label="Angle mode"
            value={state.angle}
            onChange={(event) =>
              onChange({
                ...state,
                angle: event.target.value as CalculatorState["angle"],
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
              onClick={() => {
                const blank = state.entries.find(
                  (entry) =>
                    entry.type === "expression" && !entry.text && !entry.latex,
                );
                if (blank) focusMath(blank.id);
                else add(newExpression());
              }}
            >
              + Expression
            </button>
            <button
              onClick={() => table()}
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
                      onClick={() => remove(entry, index)}
                    >
                      ×
                    </button>
                  </div>
                  {entry.type === "expression" ? (
                    <>
                      <MathEditor
                        id={entry.id}
                        label={`Expression ${index + 1}`}
                        text={entry.text}
                        latex={entry.latex}
                        invalid={!!result?.error}
                        onChange={(text, latex) =>
                          change({ ...entry, text, latex })
                        }
                        onEnter={() => nextRow(entry, index)}
                        onRemove={() => remove(entry, index)}
                        onMove={(direction) => {
                          const next = state.entries[index + direction];
                          if (next) focusMath(next.id);
                        }}
                        onTable={() => table(entry.id)}
                      />
                      {result?.value !== undefined && (
                        <output className="calc-numeric-result">
                          = {fmt(result.value)}
                        </output>
                      )}
                      {result?.values && (
                        <output className="calc-list-result">
                          [{result.values.map(fmt).join(", ")}]
                        </output>
                      )}
                      {result?.fit && (
                        <FitResult
                          fit={result.fit}
                          exponential={!!result.fit.exponential}
                          parameters={result.parameters}
                        />
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
                            onChange={(event) =>
                              change({
                                ...entry,
                                text: `${result.parameter!.name} = ${event.target.value}`,
                                latex: undefined,
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
                        columns={tableColumns(state, entry.id)}
                        onRemove={() => remove(entry, index)}
                        onNext={() => nextRow(entry, index)}
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
              Type math directly: sqrt, /, ^, and _ create roots, fractions,
              powers, and subscripts. Arrows move inside structures; Enter moves
              to the next expression. Delete an empty expression with Backspace
              or Delete.
            </p>
            <p>
              Try f(x)=x^2, y&lt;2x+1, (2,3), or x^2+y^2=25. Define a=1 for a
              slider. Lists use L=[1,2,3]. Table columns have stable x₁/y₁
              names; use y₁~mx₁+b for a linear fit, or choose Fit model.
            </p>
            <p>
              Type table in a blank expression to create a table. Enter moves
              down, Tab moves across, and arrows navigate cells. A populated
              last row adds a blank row. Delete on an empty row removes it;
              repeated deletion in an empty table removes the table.
            </p>
            <p>
              Supported trig: sin, cos, tan, sec, csc, cot, and inverse forms,
              in radians or degrees. Functions use parentheses. Inspect points
              for numerical zeros, intersections, and turning points. Numerical
              searches and approximate contours may not find every solution.
            </p>
            <p>
              Both workspaces save separately with this session. Offline never
              needs a network. Study keyboard shortcuts are inactive while
              calculator focus is inside this panel.
            </p>
          </details>
        </section>
        <Graph
          graphs={workspace.graphs}
          view={state.view}
          onView={(view) => onChange({ ...state, view })}
          onParameter={(id, name, value) => {
            const entry = state.entries.find((entry) => entry.id === id);
            if (entry?.type === "expression" && Number.isFinite(value))
              change({
                ...entry,
                text: `${name}=${Number(value.toPrecision(12))}`,
                latex: undefined,
              });
          }}
        />
      </div>
    </section>
  );
}
export default Calculator;
