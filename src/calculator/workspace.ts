import {
  scalar,
  scalarTex,
  normalize,
  isBuiltin,
  type Scalar,
  type Numeric,
} from "./math";
import { tableColumns, type CalculatorState, type Point } from "./model";
import { regression, regressionSpec, type Fit } from "./regression";
import { latexToText } from "./latex";

export type Relation = "<" | "<=" | ">" | ">=";
export type GraphObject =
  | {
      kind: "function";
      id: string;
      color: number;
      fn: (x: number) => number;
      relation?: Relation;
    }
  | {
      kind: "vertical";
      id: string;
      color: number;
      fn: (x: number) => number;
      relation?: Relation;
      boundary?: number;
    }
  | {
      kind: "implicit";
      id: string;
      color: number;
      fn: (x: number, y: number) => number;
    }
  | {
      kind: "points";
      id: string;
      color: number;
      points: Point[];
      drag?: { id: string; name: string; y: (x: number) => number };
    };
export interface EntryResult {
  error?: string;
  value?: number;
  values?: number[];
  parameters?: Record<string, number>;
  tex?: string;
  fit?: Fit;
  points?: Point[];
  parameter?: { name: string; value: number };
  message?: string;
}
export interface Workspace {
  graphs: GraphObject[];
  results: Record<string, EntryResult>;
  missing: string[];
}
type Parsed =
  | { type: "value"; a: Scalar }
  | { type: "variable"; name: string; a: Scalar }
  | { type: "function"; name: string; argument: string; a: Scalar }
  | {
      type: "relation";
      left: string;
      right: string;
      a: Scalar;
      b: Scalar;
      relation: string;
    }
  | { type: "point"; a: Scalar; b: Scalar };

function parseEntry(text: string): Parsed {
  text = normalize(text);
  const func = text.match(/^([a-z][a-z0-9_]{0,15})\(([a-z])\)\s*=\s*(.+)$/i);
  if (func) {
    if (isBuiltin(func[1]) || ["e", "y"].includes(func[2]))
      throw new Error("Choose a different function name or argument.");
    return {
      type: "function",
      name: func[1],
      argument: func[2],
      a: scalar(func[3]),
    };
  }
  const relation = text.match(/^(.+?)(<=|>=|=|<|>)(.+)$/);
  if (relation) {
    const [, left, op, right] = relation;
    const name = left.trim();
    if (
      op === "=" &&
      /^[a-z][a-z0-9_]{0,15}$/i.test(name) &&
      !["x", "y"].includes(name)
    ) {
      if (isBuiltin(name))
        throw new Error("This name is reserved for a constant or function.");
      return { type: "variable", name, a: scalar(right) };
    }
    return {
      type: "relation",
      left: name,
      right: right.trim(),
      a: scalar(left),
      b: scalar(right),
      relation: op,
    };
  }
  if (text.startsWith("(") && text.endsWith(")")) {
    const body = text.slice(1, -1);
    let depth = 0;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === "(" || body[i] === "[") depth++;
      if (body[i] === ")" || body[i] === "]") depth--;
      if (body[i] === "," && depth === 0)
        return {
          type: "point",
          a: scalar(body.slice(0, i)),
          b: scalar(body.slice(i + 1)),
        };
    }
  }
  return { type: "value", a: scalar(text) };
}
export function calculateWorkspace(state: CalculatorState): Workspace {
  const graphs: GraphObject[] = [],
    results: Workspace["results"] = Object.create(null);
  const parsed = new Map<string, Parsed>(),
    definitions = new Map<string, { id: string; parsed: Parsed }>();
  const missing = new Set<string>();
  const regressions = new Map<string, ReturnType<typeof regressionSpec>>();
  const fail = (id: string, error: unknown) => {
    results[id] = {
      error:
        error instanceof Error
          ? error.message
          : "This expression could not be evaluated.",
    };
  };
  for (const entry of state.entries) {
    results[entry.id] = {};
    if (entry.type !== "expression") continue;
    try {
      const source =
        entry.latex === undefined ? entry.text : latexToText(entry.latex);
      if (!source.trim()) continue;
      if (source.includes("~")) {
        regressions.set(entry.id, regressionSpec(normalize(source)));
        continue;
      }
      const p = parseEntry(source);
      parsed.set(entry.id, p);
      if (p.type === "function" || p.type === "variable") {
        if (definitions.has(p.name)) {
          fail(
            definitions.get(p.name)!.id,
            new Error(`Duplicate definition of ${p.name}.`),
          );
          throw new Error(`Duplicate definition of ${p.name}.`);
        }
        definitions.set(p.name, { id: entry.id, parsed: p });
      }
    } catch (e) {
      fail(entry.id, e);
    }
  }
  const values: Record<string, Numeric> = Object.create(null),
    functions: Record<string, (x: number) => number> = Object.create(null);
  const columns = new Map<string, { id: string; cells: string[] }>();
  for (const entry of state.entries) {
    if (entry.type !== "table") continue;
    const names = tableColumns(state, entry.id);
    for (let col = 0; col < 2; col++) {
      if (definitions.has(names[col]) || columns.has(names[col])) {
        fail(entry.id, new Error(`Duplicate definition of ${names[col]}.`));
        continue;
      }
      columns.set(names[col], {
        id: entry.id,
        cells: entry.rows
          .filter((row) => row.some((value) => value.trim()))
          .map((row) => row[col]),
      });
    }
  }
  for (const p of parsed.values()) {
    const scalars = "b" in p ? [p.a, p.b] : [p.a];
    for (const s of scalars)
      for (const name of s.symbols)
        if (
          /^[a-df-wz]$/.test(name) &&
          !definitions.has(name) &&
          !(p.type === "function" && p.argument === name)
        )
          missing.add(name);
  }
  let depth = 0;
  const evaluateAny = (
    s: Scalar,
    locals: Record<string, Numeric> = {},
  ): Numeric => {
    if (++depth > 24) {
      depth--;
      throw new Error("Circular or excessively deep definitions.");
    }
    try {
      const scope: Record<string, Numeric> = { ...locals };
      for (const name of s.symbols)
        if (!Object.hasOwn(scope, name)) {
          if (Object.hasOwn(values, name)) scope[name] = values[name];
          else if (columns.has(name)) {
            const column = columns.get(name)!;
            if (results[column.id]?.error)
              throw new Error(`Fix table ${name} first.`);
            scope[name] = values[name] = column.cells.map((cell) => {
              if (!cell.trim())
                throw new Error(`Complete the ${name} data column.`);
              const value = evaluateAny(scalar(cell));
              if (Array.isArray(value))
                throw new Error("Table cells must be scalar numbers.");
              return value;
            });
          } else {
            const def = definitions.get(name);
            if (!def || def.parsed.type !== "variable") {
              if (/^[a-df-wz]$/.test(name)) missing.add(name);
              throw new Error(`Define ${name} first.`);
            }
            if (results[def.id]?.error)
              throw new Error(`Fix the definition of ${name}.`);
            scope[name] = values[name] = evaluateAny(def.parsed.a);
          }
        }
      return s.evaluate(scope, functions, state.angle);
    } finally {
      depth--;
    }
  };
  const evaluate = (s: Scalar, locals: Record<string, number> = {}): number => {
    const value = evaluateAny(s, locals);
    if (Array.isArray(value))
      throw new Error(
        "Use scalar values here, or plot paired lists as (x_1,y_1).",
      );
    return value;
  };
  for (const [name, d] of definitions)
    if (d.parsed.type === "function") {
      const p = d.parsed;
      functions[name] = (x) => {
        if (results[d.id]?.error)
          throw new Error(`Fix the definition of ${name}.`);
        return evaluate(p.a, { [p.argument]: x });
      };
    }
  for (const [id, spec] of regressions) {
    try {
      const x = evaluateAny(scalar(spec.x)),
        y = evaluateAny(scalar(spec.y));
      if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length)
        throw new Error("Regression needs equally sized x and y data lists.");
      if (
        new Set(spec.names).size !== spec.names.length ||
        spec.names.some(
          (name) =>
            isBuiltin(name) ||
            definitions.has(name) ||
            Object.hasOwn(values, name),
        )
      )
        throw new Error(
          "Regression parameters must be distinct, unreserved, and not already defined.",
        );
      const fit = regression(
        x.map((value, index) => ({ x: value, y: y[index] })),
        spec.model,
        spec.powers,
      );
      const parameters = Object.fromEntries(
        spec.names.map((name, index) => [
          name,
          fit.coefficients[spec.powers?.[index] ?? index],
        ]),
      );
      Object.assign(values, parameters);
      results[id] = { fit, parameters };
    } catch (error) {
      fail(id, error);
    }
  }
  state.entries.forEach((entry, color) => {
    if (entry.type === "table") {
      try {
        if (results[entry.id]?.error) return;
        const points = entry.rows
          .filter((r) => r[0].trim() || r[1].trim())
          .map((r, i) => {
            if (!r.every((v) => v.trim()))
              throw new Error(`Complete both cells in data row ${i + 1}.`);
            const x = evaluate(scalar(r[0])),
              y = evaluate(scalar(r[1]));
            if (![x, y].every(Number.isFinite))
              throw new Error(`Data row ${i + 1} is undefined.`);
            return { x, y };
          });
        results[entry.id] = { points };
        if (!entry.hidden)
          graphs.push({ kind: "points", id: entry.id, color, points });
        if (entry.fit !== "none") {
          const fit = regression(points, entry.fit);
          results[entry.id].fit = fit;
          if (!entry.hidden)
            graphs.push({
              kind: "function",
              id: entry.id + "-fit",
              color,
              fn: fit.predict,
            });
        }
      } catch (e) {
        const prior = results[entry.id];
        fail(entry.id, e);
        Object.assign(results[entry.id], prior, {
          error: results[entry.id].error,
        });
      }
      return;
    }
    if (regressions.has(entry.id)) {
      const fit = results[entry.id]?.fit;
      if (fit && !entry.hidden)
        graphs.push({ kind: "function", id: entry.id, color, fn: fit.predict });
      return;
    }
    const p = parsed.get(entry.id);
    if (!p || results[entry.id].error) return;
    try {
      const tex = scalarTex;
      const add = (g: GraphObject) => {
        if (!entry.hidden) graphs.push(g);
      };
      if (p.type === "variable") {
        const value = evaluateAny(p.a);
        if (Array.isArray(value)) {
          if (value.some((n) => !Number.isFinite(n)))
            throw new Error("A list contains an undefined value.");
          values[p.name] = value;
          results[entry.id] = { values: value, tex: `${p.name} = ${tex(p.a)}` };
          return;
        }
        if (!Number.isFinite(value))
          throw new Error("Undefined or outside the supported numeric range.");
        values[p.name] = value;
        results[entry.id] = {
          value,
          tex: `${p.name} = ${tex(p.a)}`,
          parameter:
            p.a.symbols.size === 0 && p.a.calls.size === 0
              ? { name: p.name, value }
              : undefined,
        };
      } else if (p.type === "function") {
        evaluate(p.a, { [p.argument]: 0.731 }); // domain NaN is allowed; undefined names are not
        results[entry.id].tex = `${p.name}(${p.argument}) = ${tex(p.a)}`;
        add({ kind: "function", id: entry.id, color, fn: functions[p.name] });
      } else if (p.type === "point") {
        const x = evaluateAny(p.a),
          y = evaluateAny(p.b);
        const xs = Array.isArray(x)
          ? x
          : Array.isArray(y)
            ? y.map(() => x)
            : [x];
        const ys = Array.isArray(y) ? y : xs.map(() => y);
        if (xs.length !== ys.length)
          throw new Error("Point lists must have the same length.");
        if (![...xs, ...ys].every(Number.isFinite))
          throw new Error("Point coordinates must be finite real numbers.");
        results[entry.id] = { tex: `\\left(${tex(p.a)}, ${tex(p.b)}\\right)` };
        const parameterName =
          p.a.node.type === "SymbolNode" ? [...p.a.symbols][0] : undefined;
        const definition = parameterName
          ? definitions.get(parameterName)
          : undefined;
        const draggable =
          xs.length === 1 &&
          definition?.parsed.type === "variable" &&
          definition.parsed.a.symbols.size === 0 &&
          definition.parsed.a.calls.size === 0;
        add({
          kind: "points",
          id: entry.id,
          color,
          points: xs.map((value, index) => ({ x: value, y: ys[index] })),
          ...(draggable && parameterName && definition
            ? {
                drag: {
                  id: definition.id,
                  name: parameterName,
                  y: (value: number) =>
                    evaluate(p.b, { [parameterName]: value }),
                },
              }
            : {}),
        });
      } else if (p.type === "value") {
        const symbols = p.a.symbols;
        results[entry.id].tex = tex(p.a);
        if (symbols.has("y"))
          throw new Error("Use an equation such as x^2+y^2=25.");
        if (symbols.has("x")) {
          evaluate(p.a, { x: 0.731 });
          add({
            kind: "function",
            id: entry.id,
            color,
            fn: (x) => evaluate(p.a, { x }),
          });
        } else {
          const value = evaluateAny(p.a);
          if (Array.isArray(value)) {
            results[entry.id].values = value;
            return;
          }
          if (!Number.isFinite(value))
            throw new Error(
              "Undefined or outside the supported numeric range.",
            );
          results[entry.id].value = value;
        }
      } else {
        evaluate(p.a, { x: 0.731, y: 0.619 });
        evaluate(p.b, { x: 0.731, y: 0.619 });
        results[entry.id].tex =
          `${tex(p.a)} ${p.relation.replace("<=", "\\le ").replace(">=", "\\ge ")} ${tex(p.b)}`;
        const hasX = p.a.symbols.has("x") || p.b.symbols.has("x"),
          hasY = p.a.symbols.has("y") || p.b.symbols.has("y");
        if (
          ["x", "y"].includes(p.left) &&
          !p.b.symbols.has("x") &&
          !p.b.symbols.has("y") &&
          !Number.isFinite(evaluate(p.b))
        )
          throw new Error("Undefined or outside the supported numeric range.");
        if (p.left === "y" && !p.b.symbols.has("y"))
          add({
            kind: "function",
            id: entry.id,
            color,
            fn: (x) => evaluate(p.b, { x }),
            relation: p.relation === "=" ? undefined : (p.relation as Relation),
          });
        else if (!hasY && hasX) {
          if (p.relation !== "=" && (p.left !== "x" || p.b.symbols.has("x")))
            throw new Error("Write inequalities as y < f(x) or x < a.");
          const fn =
            p.relation === "="
              ? (x: number) => evaluate(p.a, { x }) - evaluate(p.b, { x })
              : (x: number) => x - evaluate(p.b);
          add({
            kind: "vertical",
            id: entry.id,
            color,
            fn,
            relation: p.relation === "=" ? undefined : (p.relation as Relation),
            boundary: p.relation === "=" ? undefined : evaluate(p.b),
          });
          results[entry.id].message =
            "Solutions are located numerically within the graph window.";
        } else if (hasX || hasY) {
          if (p.relation !== "=")
            throw new Error(
              "Implicit inequalities are not supported; use y < f(x) or x < a.",
            );
          add({
            kind: "implicit",
            id: entry.id,
            color,
            fn: (x, y) => evaluate(p.a, { x, y }) - evaluate(p.b, { x, y }),
          });
          results[entry.id].message =
            "Implicit curve · approximate contour; no automatic special points.";
        } else {
          const a = evaluate(p.a),
            b = evaluate(p.b);
          if (![a, b].every(Number.isFinite))
            throw new Error(
              "Undefined or outside the supported numeric range.",
            );
          results[entry.id].message =
            `${a} ${p.relation} ${b}: ${p.relation === "=" ? a === b : p.relation === "<" ? a < b : p.relation === ">" ? a > b : p.relation === "<=" ? a <= b : a >= b}`;
        }
      }
    } catch (e) {
      fail(entry.id, e);
    }
  });
  return {
    graphs,
    results,
    missing: [...missing].filter((name) => !Object.hasOwn(values, name)).sort(),
  };
}
