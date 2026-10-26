import { scalar, scalarTex, normalize, isBuiltin, type Scalar } from "./math";
import type { CalculatorState, Point } from "./model";
import { regression, type Fit } from "./regression";

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
  | { kind: "points"; id: string; color: number; points: Point[] };
export interface EntryResult {
  error?: string;
  value?: number;
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
      if (body[i] === "(") depth++;
      if (body[i] === ")") depth--;
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
    if (entry.type !== "expression" || !entry.text.trim()) continue;
    try {
      const p = parseEntry(entry.text);
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
  const values: Record<string, number> = Object.create(null),
    functions: Record<string, (x: number) => number> = Object.create(null);
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
  const evaluate = (s: Scalar, locals: Record<string, number> = {}): number => {
    if (++depth > 24) {
      depth--;
      throw new Error("Circular or excessively deep definitions.");
    }
    try {
      const scope: Record<string, number> = { ...locals };
      for (const name of s.symbols)
        if (!Object.hasOwn(scope, name)) {
          if (Object.hasOwn(values, name)) scope[name] = values[name];
          else {
            const def = definitions.get(name);
            if (!def || def.parsed.type !== "variable") {
              if (/^[a-df-wz]$/.test(name)) missing.add(name);
              throw new Error(`Define ${name} first.`);
            }
            if (results[def.id]?.error)
              throw new Error(`Fix the definition of ${name}.`);
            scope[name] = values[name] = evaluate(def.parsed.a);
          }
        }
      return s.value(scope, functions, state.angle);
    } finally {
      depth--;
    }
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
  state.entries.forEach((entry, color) => {
    if (entry.type === "table") {
      try {
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
    const p = parsed.get(entry.id);
    if (!p || results[entry.id].error) return;
    try {
      const tex = scalarTex;
      const add = (g: GraphObject) => {
        if (!entry.hidden) graphs.push(g);
      };
      if (p.type === "variable") {
        const value = evaluate(p.a);
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
        const x = evaluate(p.a),
          y = evaluate(p.b);
        if (![x, y].every(Number.isFinite))
          throw new Error("Point coordinates must be finite real numbers.");
        results[entry.id] = { tex: `\\left(${tex(p.a)}, ${tex(p.b)}\\right)` };
        add({ kind: "points", id: entry.id, color, points: [{ x, y }] });
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
          const value = evaluate(p.a);
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
  return { graphs, results, missing: [...missing].sort() };
}
