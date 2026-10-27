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
import { displayedCoefficients, fittedExpression } from "./fitDisplay";
import { exactForm } from "./exact";
import { textToLatex } from "./latex";

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
  parameters,
  scalarRelation,
  onExport,
}: {
  fit: Fit;
  parameters?: Record<string, number>;
  scalarRelation?: boolean;
  onExport: () => void;
}) {
  const c = displayedCoefficients(fit);
  const names = parameters
    ? Object.keys(parameters)
    : fit.exponential
      ? ["a", "b"]
      : c.length === 2
        ? ["b", "m"]
        : c.length === 3
          ? ["c", "b", "a"]
          : ["d", "c", "b", "a"];
  return (
    <div className="calc-fit-result">
      {!scalarRelation && (
        <MathDisplay
          tex={"y \\approx " + textToLatex(fittedExpression(fit, 10))}
        />
      )}
      <output
        aria-label={
          parameters ? "Fitted parameters" : "Regression coefficients"
        }
      >
        {names
          .map((name, i) => {
            const original = parameters
              ? parameters[name]
              : fit.coefficients[i];
            const index = parameters ? fit.coefficients.indexOf(original) : i;
            return name + " = " + fmt(c[index] ?? original);
          })
          .join(" · ")}
      </output>
      <p>
        {!scalarRelation && (
          <>
            R² = {fit.r2 === undefined ? "undefined (constant y)" : fmt(fit.r2)}{" "}
            ·{" "}
          </>
        )}
        RMSE = {fmt(fit.rmse)}
      </p>
      {!scalarRelation && (
        <button className="text-button" onClick={onExport}>
          Export to expression list
        </button>
      )}
      <details>
        <summary>Residuals (observed − fitted)</summary>
        <p className="calc-residuals">{fit.residuals.map(fmt).join(", ")}</p>
      </details>
    </div>
  );
}
function NumericResult({ value, source }: { value: number; source: string }) {
  const [exact, setExact] = useState(false);
  const form = exactForm(value, source);
  useEffect(() => setExact(false), [value, source]);
  return (
    <div className="calc-value">
      <output className="calc-numeric-result">
        {exact && form ? "≈ " + form : "= " + fmt(value)}
      </output>
      {form && form !== fmt(value) && (
        <button
          className="text-button"
          aria-label="Toggle fraction or exact form"
          aria-pressed={exact}
          onClick={() => setExact(!exact)}
        >
          {exact ? "Decimal" : "Fraction / exact"}
        </button>
      )}
    </div>
  );
}
function CalculatorHelp() {
  const [section, setSection] = useState<string>();
  const topics = [
    [
      "Expressions",
      "Type sqrt, /, ^ and _ for roots, fractions, powers and subscripts. sinx works for a single-variable argument; use parentheses for compound arguments. Enter adds or advances a row; Backspace removes an empty one. Define a=2 for a slider.",
    ],
    [
      "Tables & regressions",
      "Add a table with + or type table. Paste two columns, use arrows/Tab to navigate and Enter to move down. Backspace on an empty cell moves backward; an empty table can be removed. Enter y₁~mx₁+b in an expression, or choose a Fit model. Export keeps the fit and adds editable math.",
    ],
    [
      "Graph & angles",
      "Drag blank space to pan; drag a curve to trace it. Inspect points reveals numerical zeros, intersections and extrema. Click points to keep multiple labels; click again to remove one. Radians/Degrees changes trig units. Fraction/exact shows only recognizable forms, not a symbolic proof.",
    ],
  ];
  return (
    <details className="calc-help">
      <summary>Calculator help</summary>
      {topics.map(([title, body]) => (
        <details key={title} open={section === title}>
          <summary
            onClick={(e) => {
              e.preventDefault();
              setSection(section === title ? undefined : title);
            }}
          >
            {title}
          </summary>
          <p>{body}</p>
        </details>
      ))}
    </details>
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
  const [addOpen, setAddOpen] = useState(false);
  const addMenu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!addOpen) return;
    const outside = (e: PointerEvent) => {
      if (!addMenu.current?.contains(e.target as Node)) setAddOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [addOpen]);
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
    if (entry.type === "expression" && entry.text.length > 1200) {
      setError(
        "This fitted expression is too long to export. Try a simpler model.",
      );
      return;
    }
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
        <div className="calc-angle" role="group" aria-label="Angle mode">
          {(["radians", "degrees"] as const).map((angle) => (
            <button
              key={angle}
              aria-pressed={state.angle === angle}
              onClick={() => onChange({ ...state, angle })}
            >
              {angle === "radians" ? "Radians" : "Degrees"}
            </button>
          ))}
        </div>
      </div>
      <div className="calc-body">
        <section
          className="calc-expression-area"
          aria-label="Expressions and data"
        >
          <div
            className="calc-add"
            ref={addMenu}
            onKeyDown={(e) => {
              if (e.key === "Escape" && addOpen) {
                e.preventDefault();
                e.stopPropagation();
                setAddOpen(false);
                addMenu.current
                  ?.querySelector<HTMLButtonElement>("button")
                  ?.focus();
              }
            }}
          >
            <button
              aria-label="Add item"
              aria-expanded={addOpen}
              onClick={() => setAddOpen(!addOpen)}
            >
              ＋
            </button>
            {addOpen && (
              <div
                className="calc-add-menu"
                role="group"
                aria-label="Add calculator item"
              >
                <button
                  onClick={() => {
                    setAddOpen(false);
                    const blank = state.entries.find(
                      (e) => e.type === "expression" && !e.text && !e.latex,
                    );
                    if (blank) focusMath(blank.id);
                    else add(newExpression());
                  }}
                >
                  Expression
                </button>
                <button
                  onClick={() => {
                    setAddOpen(false);
                    table();
                  }}
                  disabled={state.entries.length >= 24}
                >
                  Table
                </button>
              </div>
            )}
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
                    {(entry.type === "table" || result?.graphable) && (
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
                    )}
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
                      {result?.value !== undefined && !result.parameter && (
                        <NumericResult
                          value={result.value}
                          source={entry.text}
                        />
                      )}
                      {result?.values && (
                        <output className="calc-list-result">
                          [{result.values.map(fmt).join(", ")}]
                        </output>
                      )}
                      {result?.fit && (
                        <FitResult
                          fit={result.fit}
                          onExport={() =>
                            add(
                              newExpression(
                                "y=" + fittedExpression(result.fit!),
                              ),
                              entry.id,
                            )
                          }
                          parameters={result.parameters}
                          scalarRelation={result.scalarRelation}
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
                          onExport={() =>
                            add(
                              newExpression(
                                "y=" + fittedExpression(result.fit!),
                              ),
                              entry.id,
                            )
                          }
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
          <CalculatorHelp />
        </section>
        <Graph
          graphs={workspace.graphs}
          view={state.view}
          equalAxes={state.equalAxes !== false}
          onView={(view, equalAxes) =>
            onChange({
              ...state,
              view,
              equalAxes: equalAxes ?? state.equalAxes ?? true,
            })
          }
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
