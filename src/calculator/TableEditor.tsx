import type { TableEntry } from "@/src/types/calculator";

export function parsePastedData(text: string): [string, string][] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((r) => r.trim());
  if (!lines.length || lines.length > 201)
    throw new Error("Paste up to 200 paired rows.");
  const rows = lines.map((r) =>
    r.split(r.includes("\t") ? "\t" : ",").map((v) => v.trim()),
  );
  if (/^x[1₁]?$/i.test(rows[0][0]) && /^y[1₁]?$/i.test(rows[0][1]))
    rows.shift();
  if (
    rows.length > 200 ||
    rows.some((r) => r.length !== 2 || r.some((v) => !v || v.length > 240))
  )
    throw new Error(
      "Paste two columns separated by tabs or commas, with one pair per line.",
    );
  return rows as [string, string][];
}
export function TableEditor({
  entry,
  onChange,
  onError,
  columns = ["x_1", "y_1"],
  onRemove,
  onNext,
}: {
  entry: TableEntry;
  onChange: (e: TableEntry) => void;
  onError: (message: string) => void;
  columns?: [string, string];
  onRemove?: () => void;
  onNext?: () => void;
}) {
  const rowsWithBlank = (rows: [string, string][]) => {
    if (!rows.length) return [["", ""]] as [string, string][];
    if (rows.length < 200 && rows.at(-1)!.some((value) => value.trim()))
      return [...rows, ["", ""]] as [string, string][];
    return rows;
  };
  const focusCell = (row: number, col: number, atEnd = false) => {
    const focus = () => {
      const input = document.getElementById(
        `cell-${entry.id}-${row}-${col}`,
      ) as HTMLInputElement | null;
      input?.focus();
      if (input && atEnd)
        input.setSelectionRange(input.value.length, input.value.length);
      return !!input;
    };
    // Existing cells move synchronously so repeated Backspace cannot outrun focus.
    if (!focus()) requestAnimationFrame(focus);
  };
  return (
    <>
      <div className="calc-data-table">
        <table>
          <caption className="sr-only">Paired data</caption>
          <thead>
            <tr>
              {columns.map((name) => (
                <th scope="col" key={name}>
                  {name.split("_")[0]}
                  <sub>{name.split("_")[1]}</sub>
                </th>
              ))}
              <th>
                <span className="sr-only">Row action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entry.rows.map((row, i) => (
              <tr key={i}>
                {row.map((value, col) => (
                  <td key={col}>
                    <input
                      id={`cell-${entry.id}-${i}-${col}`}
                      aria-label={`Table ${entry.id.slice(0, 8)} row ${i + 1} ${col ? "y" : "x"}`}
                      value={value}
                      maxLength={240}
                      inputMode="decimal"
                      onChange={(e) =>
                        onChange({
                          ...entry,
                          rows: rowsWithBlank(
                            entry.rows.map((r, j) =>
                              j === i
                                ? (r.map((v, k) =>
                                    k === col ? e.target.value : v,
                                  ) as [string, string])
                                : r,
                            ),
                          ),
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.altKey || e.ctrlKey || e.metaKey) return;
                        if (
                          (e.key === "Backspace" || e.key === "Delete") &&
                          !value
                        ) {
                          if (
                            entry.rows.every((row) =>
                              row.every((cell) => !cell),
                            )
                          ) {
                            e.preventDefault();
                            onRemove?.();
                            return;
                          }
                          if (
                            row.every((cell) => !cell) &&
                            entry.rows.length > 1
                          ) {
                            e.preventDefault();
                            onChange({
                              ...entry,
                              rows: entry.rows.filter(
                                (_, index) => index !== i,
                              ),
                            });
                            focusCell(
                              Math.max(0, i - 1),
                              col,
                              e.key === "Backspace",
                            );
                            return;
                          }
                          if (e.key === "Backspace") {
                            e.preventDefault();
                            let previous = i * 2 + col - 1;
                            if (previous < 0)
                              previous = entry.rows
                                .flat()
                                .findLastIndex((cell) => !!cell);
                            if (previous >= 0)
                              focusCell(
                                Math.floor(previous / 2),
                                previous % 2,
                                true,
                              );
                            return;
                          }
                        }
                        if (e.key === "Tab") {
                          e.preventDefault();
                          const next = i * 2 + col + (e.shiftKey ? -1 : 1);
                          if (next < 0) return;
                          const nextRow = Math.floor(next / 2);
                          if (nextRow >= 200) {
                            onNext?.();
                            return;
                          }
                          if (nextRow >= entry.rows.length) {
                            if (row.every((cell) => !cell)) {
                              onNext?.();
                              return;
                            }
                            onChange({
                              ...entry,
                              rows: [...entry.rows, ["", ""]],
                            });
                          }
                          focusCell(nextRow, next % 2);
                          return;
                        }
                        if (e.shiftKey) return;
                        if (
                          e.key === "ArrowLeft" &&
                          col === 1 &&
                          e.currentTarget.selectionStart === 0
                        ) {
                          e.preventDefault();
                          focusCell(i, 0);
                          return;
                        }
                        if (
                          e.key === "ArrowRight" &&
                          col === 0 &&
                          e.currentTarget.selectionEnd === value.length
                        ) {
                          e.preventDefault();
                          focusCell(i, 1);
                          return;
                        }
                        if (
                          e.key === "Enter" ||
                          e.key === "ArrowDown" ||
                          e.key === "ArrowUp"
                        ) {
                          const next = i + (e.key === "ArrowUp" ? -1 : 1);
                          if (next < 0 || next >= 200) return;
                          e.preventDefault();
                          if (
                            next === entry.rows.length &&
                            row.every((value) => !value)
                          ) {
                            onNext?.();
                            return;
                          }
                          if (next === entry.rows.length)
                            onChange({
                              ...entry,
                              rows: [...entry.rows, ["", ""]],
                            });
                          focusCell(next, col);
                        }
                      }}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData("text");
                        if (!/[\t\n,]/.test(text)) return;
                        e.preventDefault();
                        try {
                          const pasted = parsePastedData(text);
                          if (i + pasted.length > 200)
                            throw new Error(
                              "A table can contain up to 200 rows.",
                            );
                          const rows = [...entry.rows];
                          rows.splice(i, pasted.length, ...pasted);
                          onChange({ ...entry, rows: rowsWithBlank(rows) });
                          onError("");
                        } catch (error) {
                          onError((error as Error).message);
                        }
                      }}
                    />
                  </td>
                ))}
                <td>
                  <button
                    className="calc-icon"
                    aria-label={`Remove data row ${i + 1}`}
                    onClick={() => {
                      onChange({
                        ...entry,
                        rows: rowsWithBlank(
                          entry.rows.filter((_, j) => j !== i),
                        ),
                      });
                      focusCell(Math.max(0, i - 1), 0);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="calc-fit-label">
        Fit model
        <select
          aria-label="Fit model"
          value={entry.fit}
          onChange={(e) =>
            onChange({ ...entry, fit: e.target.value as TableEntry["fit"] })
          }
        >
          <option value="none">Points only</option>
          <option value="linear">Linear · mx + b</option>
          <option value="quadratic">Quadratic · ax² + bx + c</option>
          <option value="cubic">Cubic · ax³ + bx² + cx + d</option>
          <option value="exponential">Exponential · a · bˣ</option>
        </select>
      </label>
    </>
  );
}
