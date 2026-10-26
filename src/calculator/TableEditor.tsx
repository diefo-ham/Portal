import type { TableEntry } from "./model";

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
}: {
  entry: TableEntry;
  onChange: (e: TableEntry) => void;
  onError: (message: string) => void;
}) {
  const focusCell = (row: number, col: number) =>
    requestAnimationFrame(() =>
      document.getElementById(`cell-${entry.id}-${row}-${col}`)?.focus(),
    );
  return (
    <>
      <div className="calc-data-table">
        <table>
          <caption className="sr-only">Paired data</caption>
          <thead>
            <tr>
              <th scope="col">x₁</th>
              <th scope="col">y₁</th>
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
                          rows: entry.rows.map((r, j) =>
                            j === i
                              ? (r.map((v, k) =>
                                  k === col ? e.target.value : v,
                                ) as [string, string])
                              : r,
                          ),
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)
                          return;
                        if (
                          e.key === "Enter" ||
                          e.key === "ArrowDown" ||
                          e.key === "ArrowUp"
                        ) {
                          const next = i + (e.key === "ArrowUp" ? -1 : 1);
                          if (next < 0 || next >= 200) return;
                          e.preventDefault();
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
                          onChange({ ...entry, rows });
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
                        rows: entry.rows.filter((_, j) => j !== i),
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
      <button
        className="text-button"
        disabled={entry.rows.length >= 200}
        onClick={() => {
          onChange({ ...entry, rows: [...entry.rows, ["", ""]] });
          focusCell(entry.rows.length, 0);
        }}
      >
        Add data row
      </button>
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
