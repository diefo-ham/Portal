import {
  scalar,
  scalarFromNode,
  scalarTex,
  normalize,
  isBuiltin,
} from "./math";
import { tableColumns } from "./model";
import {
  regression,
  customRegression,
  relationRegression,
  regressionSpec,
  assertAffineParameters,
} from "./regression";
import { latexToText } from "./latex";
import type { MathNode } from "mathjs";
import {
  exactListRelations,
  solveFiniteSystem,
  type FiniteSystemResult,
} from "./finiteSystems";
import {
  affineCoefficients,
  reverseComparator,
  type AffineInequality,
} from "./affine";
import {
  relationSource,
  parameterBounds,
  solveScalarRelation,
  polynomialRootFinder,
} from "./relations";
import type {
  CalculatorState,
  Fit,
  Numeric,
  Point,
  PointValue,
  Restriction,
  Scalar,
  Value,
} from "@/src/types/calculator";
import { isPoint, pointsOf } from "./points";

export type Relation = "<" | "<=" | ">" | ">=";
export type GraphObject = {
  systemIntersections?: { points: Point[]; graphIds: string[] };
} & (
  | {
      kind: "function";
      id: string;
      color: number;
      fn: (x: number) => number;
      relation?: Relation;
      affine?: AffineInequality;
    }
  | {
      kind: "vertical";
      id: string;
      color: number;
      fn: (x: number) => number;
      relation?: Relation;
      affine?: AffineInequality;
      boundary?: number;
      rootsInWindow?: (min: number, max: number) => number[];
    }
  | {
      kind: "implicit";
      id: string;
      color: number;
      fn: (x: number, y: number) => number;
      affine?: AffineInequality;
      /** Shade where fn(x, y) satisfies this comparison with 0 (curved regions). */
      region?: Relation;
    }
  | {
      kind: "points";
      id: string;
      color: number;
      points: Point[];
      drag?: { id: string; name: string; y: (x: number) => number };
    }
);
export interface EntryResult {
  graphable?: boolean;
  error?: string;
  value?: number;
  values?: number[];
  /** A point, or a list of points, as shown in the result chips. */
  pointValue?: PointValue;
  parameters?: Record<string, number>;
  tex?: string;
  fit?: Fit;
  scalarRelation?: boolean;
  relationKind?: "scalar" | "values" | "data";
  solutions?: Record<string, number>[];
  points?: Point[];
  parameter?: { name: string; value: number };
  message?: string;
  systemKind?: FiniteSystemResult["kind"];
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

/** True when the first bracket of `text` closes at its last character. */
function wrapsWhole(text: string): boolean {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if ("([".includes(text[i])) depth++;
    if (")]".includes(text[i]) && --depth === 0) return i === text.length - 1;
  }
  return false;
}

function parseEntry(text: string): Parsed {
  text = normalize(text);
  const func = text.match(
    /^([a-z][a-z0-9_]{0,15})\(\s*([a-z])\s*\)\s*=\s*(.+)$/i,
  );
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
  // Comparisons inside a postfix domain belong to the expression AST, not to
  // the row's equation/inequality grammar.
  const brace = text.indexOf("{");
  // In y={x<0:-x,x} the braces are the right-hand side, not a domain restriction.
  const body =
    brace > 0 && /=\s*$/.test(text.slice(0, brace)) ? text : text.split("{")[0];
  const relation = body.match(/^(.+?)(<=|>=|=|<|>)(.+)$/);
  if (relation) {
    const [, left, op] = relation;
    const right = text.slice(left.length + op.length);
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
  // [(1,2),(3,4)] is a list of points: lists of x and of y coordinates.
  if (text.startsWith("[(") && text.endsWith(")]") && wrapsWhole(text)) {
    const pairs: [string, string][] = [];
    let depth = 0,
      start = 1;
    const inner = text.slice(0, -1);
    const split = (piece: string): [string, string] | undefined => {
      if (!piece.startsWith("(") || !piece.endsWith(")")) return undefined;
      const body = piece.slice(1, -1);
      let level = 0;
      for (let i = 0; i < body.length; i++) {
        if (body[i] === "(" || body[i] === "[") level++;
        if (body[i] === ")" || body[i] === "]") level--;
        if (body[i] === "," && level === 0)
          return [body.slice(0, i), body.slice(i + 1)];
      }
      return undefined;
    };
    let ok = true;
    for (let i = 1; i <= inner.length && ok; i++) {
      const char = inner[i];
      if (char === "(" || char === "[") depth++;
      if (char === ")" || char === "]") depth--;
      if (depth === 0 && (char === "," || i === inner.length)) {
        const pair = split(inner.slice(start, i).trim());
        if (pair) pairs.push(pair);
        else ok = false;
        start = i + 1;
      }
    }
    if (ok && pairs.length >= 1 && pairs.length <= 200)
      return {
        type: "point",
        a: scalar(`[${pairs.map((pair) => pair[0]).join(",")}]`),
        b: scalar(`[${pairs.map((pair) => pair[1]).join(",")}]`),
      };
  }
  if (text.startsWith("(") && text.endsWith(")") && wrapsWhole(text)) {
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
  // Adjacent defined one-letter names are products (pv means p*v). Longer
  // explicit identifiers and built-in function names remain intact.
  const sources = new Map<string, string>();
  const names = new Set(["x", "y"]);
  const identifiers = new Set<string>();
  for (const entry of state.entries) {
    if (entry.type !== "expression") continue;
    try {
      const source =
        entry.latex === undefined ? entry.text : latexToText(entry.latex);
      sources.set(entry.id, source);
      const definition = normalize(source).match(
        /^([a-z][a-z0-9_]{0,15})(\(\s*[a-z]\s*\))?\s*=/i,
      );
      if (definition) {
        const name = definition[1];
        identifiers.add(name);
        if (name.length === 1 && !definition[2]) names.add(name);
      }
    } catch (error) {
      failSource(entry.id, error);
    }
  }
  // Unknown letters written separately in scalar equations establish product
  // notation too: a+b=5 followed by ab=6. Explicit scalar definitions such as
  // b=4,c=6,bc=7 continue to reserve the full identifier bc.
  const equationLetters = new Set<string>();
  for (const source of sources.values()) {
    const body = normalize(source).split("{")[0];
    if (!body.includes("=") && !body.includes("~")) continue;
    for (const match of body.matchAll(/\b([a-z])\b(?!\s*\()/g)) {
      if (!isBuiltin(match[1])) {
        names.add(match[1]);
        equationLetters.add(match[1]);
      }
    }
  }
  for (const name of [...identifiers]) {
    if (
      name.length > 1 &&
      /^[a-z]+$/.test(name) &&
      [...name].every(
        (letter) => equationLetters.has(letter) && !identifiers.has(letter),
      )
    )
      identifiers.delete(name);
  }
  function failSource(id: string, error: unknown) {
    results[id] = {
      error:
        error instanceof Error ? error.message : "Invalid mathematical input.",
    };
  }
  const products = (source: string) =>
    normalize(source).replace(/[a-z][a-z0-9_]*/gi, (token) =>
      token.length > 1 &&
      !isBuiltin(token) &&
      !identifiers.has(token) &&
      [...token].every((name) => names.has(name))
        ? [...token].join("*")
        : token,
    );
  const regressions = new Map<
    string,
    { spec: ReturnType<typeof regressionSpec>; restrictions: Restriction[] }
  >();
  const fail = (id: string, error: unknown) => {
    results[id] = {
      error:
        error instanceof Error
          ? error.message
          : "This expression could not be evaluated.",
    };
  };
  const systemAssignments = new Set<string>();
  const candidates: {
    id: string;
    p: Extract<Parsed, { type: "variable" | "relation" }>;
    symbols: string[];
  }[] = [];
  for (const [id, source] of sources) {
    try {
      if (source.includes("~")) continue;
      const p = parseEntry(relationSource(products(source)).body);
      if (
        p.type !== "variable" &&
        !(p.type === "relation" && p.relation === "=")
      )
        continue;
      const deps = [
        ...new Set([
          ...(p.type === "variable" ? [p.name] : p.a.symbols),
          ...("b" in p ? p.b.symbols : p.a.symbols),
        ]),
      ];
      if (
        !deps.length ||
        deps.some((n) => !/^[a-df-wz]$/i.test(n)) ||
        p.a.calls.size ||
        p.a.node.type === "ArrayNode"
      )
        continue;
      // Numeric assignments remain definitions (and sliders).
      if (p.type === "variable" && !p.a.symbols.size) continue;
      candidates.push({ id, p, symbols: deps });
    } catch {
      /* The normal parser reports malformed rows. */
    }
  }
  while (candidates.length) {
    const group = [candidates.shift()!],
      symbols = new Set(group[0].symbols);
    for (let changed = true; changed;) {
      changed = false;
      for (let i = candidates.length - 1; i >= 0; i--)
        if (candidates[i].symbols.some((s) => symbols.has(s))) {
          const [row] = candidates.splice(i, 1);
          group.push(row);
          row.symbols.forEach((s) => symbols.add(s));
          changed = true;
        }
    }
    const vars = group.filter((r) => r.p.type === "variable");
    const cyclic = (name: string, active = new Set<string>()): boolean => {
      if (active.has(name)) return true;
      const row = vars.find(
        (r) => r.p.type === "variable" && r.p.name === name,
      );
      return (
        !!row &&
        [...row.p.a.symbols].some((n) => cyclic(n, new Set([...active, name])))
      );
    };
    const assigned = vars.map(
      (r) => (r.p as Extract<Parsed, { type: "variable" }>).name,
    );
    let nonlinear = false;
    for (const row of vars)
      try {
        assertAffineParameters(row.p.a.node, [...symbols]);
      } catch {
        nonlinear = true;
      }
    if (
      new Set(assigned).size < assigned.length ||
      (nonlinear && assigned.some((n) => cyclic(n)))
    )
      vars.forEach((r) => systemAssignments.add(r.id));
  }
  for (const entry of state.entries) {
    if (results[entry.id]?.error) continue;
    results[entry.id] = {};
    if (entry.type !== "expression") continue;
    try {
      const source = products(sources.get(entry.id) ?? "");
      if (!source.trim()) continue;
      if (source.includes("~")) {
        const { body, restrictions } = relationSource(source);
        regressions.set(entry.id, { spec: regressionSpec(body), restrictions });
        continue;
      }
      let p = parseEntry(source);
      if (systemAssignments.has(entry.id) && p.type === "variable") {
        const { body } = relationSource(source),
          [left, right] = body.split("=");
        p = {
          type: "relation",
          left,
          right,
          a: scalar(left),
          b: scalar(right),
          relation: "=",
        };
      }
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
  const values: Record<string, Value> = Object.create(null),
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
  // Resolve dependencies transitively without evaluating at a sample x or
  // caching a point-specific result as a global scalar.
  const dependencyCache = new Map<string, Set<string>>();
  const dependencies = (
    s: Scalar,
    active = new Set<string>(),
    bound = new Set<string>(),
  ): Set<string> => {
    const out = new Set<string>();
    const visit = (name: string, call: boolean) => {
      if (!call && bound.has(name)) return;
      const def = definitions.get(name);
      if (
        !def ||
        (call ? def.parsed.type !== "function" : def.parsed.type !== "variable")
      ) {
        if (call) throw new Error(`Define ${name}(x) first.`);
        out.add(name);
        return;
      }
      const key = `${call ? "fn" : "var"}:${name}`;
      if (active.has(key))
        throw new Error(`Circular definition involving ${name}.`);
      const cacheKey = `${key}:${[...bound].sort().join(",")}`;
      let nested = dependencyCache.get(cacheKey);
      if (!nested) {
        nested = dependencies(
          def.parsed.a,
          new Set([...active, key]),
          def.parsed.type === "function"
            ? new Set([def.parsed.argument])
            : bound,
        );
        dependencyCache.set(cacheKey, nested);
      }
      nested.forEach((name) => out.add(name));
    };
    s.symbols.forEach((name) => visit(name, false));
    s.calls.forEach((name) => visit(name, true));
    return out;
  };
  // Substitute definitions structurally, with lexical function arguments. The
  // resulting AST exposes transitive free parameters to relation/degree analysis
  // instead of pretending a named function is a constant coefficient.
  const expand = (s: Scalar): Scalar => {
    let count = 0;
    const visit = (
      node: MathNode,
      bindings = new Map<string, MathNode>(),
      active = new Set<string>(),
    ): MathNode => {
      if (++count > 2048)
        throw new Error(
          "This relation is too complex after expanding definitions.",
        );
      const n = node as any;
      if (n.type === "SymbolNode" && bindings.has(n.name))
        return bindings.get(n.name)!;
      const call = n.type === "FunctionNode";
      const name = call
        ? n.fn.name
        : n.type === "SymbolNode"
          ? n.name
          : undefined;
      const def = name && definitions.get(name);
      if (
        def &&
        ((call && def.parsed.type === "function") ||
          (!call && def.parsed.type === "variable"))
      ) {
        const key = `${call ? "fn" : "var"}:${name}`;
        if (active.has(key))
          throw new Error(`Circular definition involving ${name}.`);
        // Named functions have their own argument scope; a caller's argument
        // must not capture a free coefficient in a different named function.
        const locals =
          def.parsed.type === "function"
            ? new Map<string, MathNode>()
            : new Map(bindings);
        if (def.parsed.type === "function")
          locals.set(def.parsed.argument, visit(n.args[0], bindings, active));
        return visit(def.parsed.a.node, locals, new Set([...active, key]));
      }
      return node.map((child: MathNode, path: string) =>
        path === "fn" ? child : visit(child, bindings, active),
      );
    };
    return scalarFromNode(visit(s.node));
  };
  for (const [id, p] of parsed) {
    try {
      dependencies(
        p.a,
        undefined,
        p.type === "function" ? new Set([p.argument]) : undefined,
      );
      if ("b" in p) dependencies(p.b);
    } catch (error) {
      fail(id, error);
    }
  }
  let depth = 0;
  const evaluateValue = (
    s: Scalar,
    locals: Record<string, Value> = {},
  ): Value => {
    if (++depth > 24) {
      depth--;
      throw new Error("Circular or excessively deep definitions.");
    }
    try {
      const scope: Record<string, Value> = { ...locals };
      for (const name of s.symbols)
        if (!Object.hasOwn(scope, name)) {
          if (
            Object.hasOwn(values, name) &&
            (!definitions.has(name) || !Object.keys(locals).length)
          )
            scope[name] = values[name];
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
            const value = evaluateValue(def.parsed.a, locals);
            scope[name] = value;
            const deps = dependencies(def.parsed.a);
            if (!deps.has("x") && !deps.has("y") && !Object.keys(locals).length)
              values[name] = value;
          }
        }
      return s.evaluateValue(scope, functions, state.angle);
    } finally {
      depth--;
    }
  };
  /** Numbers and number lists; a point result is an error here. */
  const evaluateAny = (
    s: Scalar,
    locals: Record<string, Value> = {},
  ): Numeric => {
    const value = evaluateValue(s, locals);
    if (isPoint(value))
      throw new Error("A point can't be used where a number is needed.");
    return value;
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
  /**
   * The reference calculator's `~` always yields one parameter set, found by a local fit that
   * starts every parameter at 1. When exact solving finds several, every
   * solution is still listed, but dependent rows use the one closest to that
   * starting point (so `x_1^2~5` gives +√5), ties going to the larger value.
   */
  const fitBranch = (solutions: Record<string, number>[]) => {
    const distance = (s: Record<string, number>) =>
      Object.values(s).reduce((sum, v) => sum + Math.abs(v - 1), 0);
    const total = (s: Record<string, number>) =>
      Object.values(s).reduce((sum, v) => sum + v, 0);
    return solutions.reduce((best, s) =>
      distance(s) < distance(best) - 1e-12 ||
      (Math.abs(distance(s) - distance(best)) <= 1e-12 &&
        total(s) > total(best))
        ? s
        : best,
    );
  };
  const systemQuantities: { names: string[]; solved: FiniteSystemResult }[] =
    [];
  const solvedEquationIds = new Set<string>();
  const systemRestrictions = (systemNames: string[]) => {
    const rows: { id: string; restriction: Restriction }[] = [];
    for (const [id, p] of parsed) {
      if (p.type !== "relation" || p.relation === "=") continue;
      try {
        const left = expand(p.a),
          right = expand(p.b);
        const deps = [...new Set([...left.symbols, ...right.symbols])];
        if (deps.length && deps.every((name) => systemNames.includes(name)))
          rows.push({ id, restriction: { left, right, op: p.relation } });
      } catch {
        /* Normal dependency checks report invalid definitions. */
      }
    }
    return rows;
  };
  const storeSystem = (
    ids: string[],
    systemNames: string[],
    solved: FiniteSystemResult,
    fit?: EntryResult["fit"],
  ) => {
    Object.assign(values, solved.parameters);
    systemNames.forEach((name) => missing.delete(name));
    systemQuantities.push({ names: systemNames, solved });
    for (const row of systemRestrictions(systemNames)) {
      solvedEquationIds.add(row.id);
      results[row.id] = { message: "Restriction applied to the system." };
    }
    for (const id of ids) {
      solvedEquationIds.add(id);
      results[id] = {
        parameters: solved.parameters,
        solutions: solved.solutions,
        scalarRelation: true,
        relationKind: "values",
        // A fit already prints the parameter values, so no system kind then.
        ...(fit ? { fit } : { systemKind: solved.kind }),
        message: solved.message,
      };
    }
  };
  // Connected equations in scalar parameters are exact systems. Coordinate
  // equations and ordinary acyclic named definitions retain their existing roles.
  const equationRows: {
    id: string;
    left: Scalar;
    right: Scalar;
    names: string[];
    restrictions: Restriction[];
  }[] = [];
  for (const [id, p] of parsed) {
    if (p.type !== "relation" || p.relation !== "=") continue;
    try {
      const { body, restrictions } = relationSource(products(sources.get(id)!));
      const [left, right] = body.split("=").map((s) => expand(scalar(s)));
      const deps = [...new Set([...left.symbols, ...right.symbols])];
      if (
        !deps.length ||
        deps.some((name) => !/^[a-df-wz]$/i.test(name) || columns.has(name))
      )
        continue;
      equationRows.push({ id, left, right, names: deps, restrictions });
    } catch (error) {
      fail(id, error);
    }
  }
  while (equationRows.length) {
    const group = [equationRows.shift()!],
      groupNames = new Set(group[0].names);
    for (let changed = true; changed;) {
      changed = false;
      for (let i = equationRows.length - 1; i >= 0; i--)
        if (equationRows[i].names.some((n) => groupNames.has(n))) {
          const [row] = equationRows.splice(i, 1);
          group.push(row);
          row.names.forEach((n) => groupNames.add(n));
          changed = true;
        }
    }
    const ids = group.map((r) => r.id),
      ns = [...groupNames];
    try {
      const restrictions = [
        ...group.flatMap((r) => r.restrictions),
        ...systemRestrictions(ns).map((r) => r.restriction),
      ];
      storeSystem(
        ids,
        ns,
        solveFiniteSystem(
          group,
          ns,
          parameterBounds(restrictions, ns, expand, evaluate),
          state.angle,
        ),
      );
    } catch (error) {
      for (const id of ids) {
        solvedEquationIds.add(id);
        fail(id, error);
      }
    }
  }
  for (const [id, { spec, restrictions }] of regressions) {
    try {
      // Statistical templates are used only for paired data. All other forms
      // retain both sides as value expressions, including generated lists.
      let pairedData = false;
      if (
        !("kind" in spec) &&
        (spec.model !== "custom" || !scalar(spec.formula).calls.size)
      ) {
        try {
          pairedData =
            Array.isArray(evaluateAny(scalar(spec.x))) &&
            Array.isArray(evaluateAny(scalar(spec.y)));
        } catch {
          /* Resolve/report missing data through the general dependency path. */
        }
      }
      const statistical =
        pairedData &&
        !restrictions.length &&
        !("kind" in spec) &&
        spec.names.every(
          (name) => !definitions.has(name) && !Object.hasOwn(values, name),
        );
      if (!statistical) {
        const source = relationSource(products(sources.get(id) ?? "")).body;
        const [left, right] = source.split("~");
        const relation = expand(scalar(`(${left})-(${right})`));
        const names = [...dependencies(relation)].filter(
          (name) =>
            !definitions.has(name) &&
            !columns.has(name) &&
            !Object.hasOwn(values, name),
        );
        // A subscripted x_1 or y_1 that no table or list defines is as free as
        // a letter; once a table or list defines it, it means that data.
        const unusable = (name: string) =>
          isBuiltin(name) || !/^([a-z]|[xy]_\d+)$/i.test(name);
        if (
          !names.length ||
          names.length > 5 ||
          new Set(names).size !== names.length ||
          names.some(unusable)
        )
          throw new Error(
            names.some(unusable)
              ? `Define ${names.find(unusable)} first.`
              : "Use one to five free scalar parameters in a relation.",
          );
        const bounds = parameterBounds(restrictions, names, expand, evaluate);
        const scope: Record<string, Numeric> = Object.create(null);
        for (const name of relation.symbols) {
          if (names.includes(name)) continue;
          scope[name] = evaluateAny(scalar(name));
        }
        const exactSide = (text: string) =>
          scalarFromNode(
            expand(scalar(text)).node.transform((node) => {
              const value =
                node.type === "SymbolNode" ? scope[node.toString()] : undefined;
              return typeof value === "number"
                ? scalar(String(value)).node
                : node;
            }),
          );
        const exact = exactListRelations(
          exactSide(left),
          exactSide(right),
          names,
        );
        if (exact) {
          const systemBounds = parameterBounds(
            [
              ...restrictions,
              ...systemRestrictions(names).map((r) => r.restriction),
            ],
            names,
            expand,
            evaluate,
          );
          const solved = solveFiniteSystem(
            exact,
            names,
            systemBounds,
            state.angle,
          );
          if (solved.representative && solved.free.length) {
            const parameters = Object.fromEntries(
              Object.entries(solved.representative).sort(([a], [b]) =>
                a.localeCompare(b),
              ),
            );
            Object.assign(values, parameters);
            names.forEach((name) => missing.delete(name));
            for (const row of systemRestrictions(names)) {
              solvedEquationIds.add(row.id);
              results[row.id] = { message: "Restriction applied to the fit." };
            }
            const raw = evaluateAny(relation, parameters);
            const residuals = (Array.isArray(raw) ? raw : [raw]).map((value) =>
              Math.abs(value) <= 1e-12 ? 0 : value,
            );
            const sse = residuals.reduce(
              (sum, residual) => sum + residual * residual,
              0,
            );
            results[id] = {
              parameters,
              scalarRelation: true,
              relationKind: "values",
              fit: {
                coefficients: Object.values(parameters),
                predict: () => NaN,
                residuals,
                rmse: Math.sqrt(sse / residuals.length),
                logSpace: false,
              },
              message: "Representative fit; parameters are not unique.",
            };
          } else {
            // A unique exact solution of a `~` vector is a zero-residual fit,
            // reported with RMSE like the reference calculator's regression parameters.
            let fit: EntryResult["fit"];
            if (
              solved.kind === "determined" &&
              solved.solutions?.length === 1
            ) {
              const raw = evaluateAny(relation, solved.parameters);
              const residuals = (Array.isArray(raw) ? raw : [raw]).map(
                (value) => (Math.abs(value) <= 1e-12 ? 0 : value),
              );
              fit = {
                coefficients: names.map((name) => solved.parameters[name]),
                predict: () => NaN,
                residuals,
                rmse: Math.sqrt(
                  residuals.reduce((sum, r) => sum + r * r, 0) /
                    residuals.length,
                ),
                logSpace: false,
              };
            }
            storeSystem([id], names, solved, fit);
            if (solved.kind === "multiple" && solved.solutions?.length)
              Object.assign(values, fitBranch(solved.solutions));
          }
          continue;
        }
        const sampleParameters = Object.fromEntries(
          names.map((name) => [name, 0.731]),
        );
        const sample = evaluateAny(relation, sampleParameters);
        if (!Array.isArray(sample)) {
          if (names.length > 1)
            throw new Error(
              "Underdetermined parameter system: too few residuals to determine all parameters.",
            );
          const solved = solveScalarRelation(
            relation,
            names[0],
            evaluate,
            state.angle,
            bounds[names[0]],
          );
          const solutions = solved.solutions.map((value) => ({
            [names[0]]: value,
          }));
          if (solutions.length > 1) {
            Object.assign(values, fitBranch(solutions));
            results[id] = {
              solutions,
              scalarRelation: true,
              relationKind: "scalar",
              message: solved.message,
            };
          } else {
            const parameters = solutions[0];
            Object.assign(values, parameters);
            results[id] = {
              parameters,
              solutions,
              scalarRelation: true,
              relationKind: "scalar",
              message: solved.message,
              fit: {
                coefficients: Object.values(parameters),
                predict: () => NaN,
                residuals: [evaluate(relation)],
                rmse: Math.abs(evaluate(relation)),
                logSpace: false,
              },
            };
          }
          continue;
        }
        const fit = relationRegression(
          relation,
          names,
          scope,
          functions,
          state.angle,
          bounds,
        );
        const parameters = Object.fromEntries(
          names.map((name, index) => [name, fit.coefficients[index]]),
        );
        Object.assign(values, parameters);
        if (pairedData && !("kind" in spec)) {
          const model = scalar(right);
          fit.predict = (x) => evaluate(model, { ...parameters, [spec.x]: x });
          fit.custom = {
            formula: model.node
              .toString({ implicit: "show" })
              .replaceAll(spec.x, "x"),
            names,
          };
          const observed = evaluateAny(scalar(left)) as number[];
          const mean = observed.reduce(
            (sum, v) => sum + v / observed.length,
            0,
          );
          const sst = observed.reduce((sum, v) => sum + (v - mean) ** 2, 0);
          fit.r2 =
            sst > 0
              ? 1 - fit.residuals.reduce((sum, r) => sum + r * r, 0) / sst
              : undefined;
        }
        results[id] = {
          fit,
          parameters,
          scalarRelation: !pairedData,
          relationKind: pairedData ? "data" : "values",
        };
        continue;
      }
      if ("kind" in spec) throw new Error("Unsupported relation form.");
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
      const fit =
        spec.model === "custom"
          ? customRegression(
              x.map((value, index) => ({ x: value, y: y[index] })),
              spec.formula,
              spec.names,
              state.angle,
            )
          : regression(
              x.map((value, index) => ({ x: value, y: y[index] })),
              spec.model,
              spec.powers,
            );
      if (spec.exponentialRate) {
        fit.coefficients = [fit.coefficients[0], Math.log(fit.coefficients[1])];
        fit.custom = {
          formula: `${spec.names[0]}*exp(${spec.names[1]}*x)`,
          names: spec.names,
        };
      }
      const parameters = Object.fromEntries(
        spec.names.map((name, index) => [
          name,
          fit.coefficients[spec.powers?.[index] ?? index],
        ]),
      );
      Object.assign(values, parameters);
      results[id] = { fit, parameters, relationKind: "data" };
    } catch (error) {
      fail(id, error);
    }
  }
  state.entries.forEach((entry, index) => {
    const color = entry.color ?? index;
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
        results[entry.id] = { points, graphable: true };
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
      const scalarRelation = results[entry.id]?.scalarRelation;
      if (fit && !scalarRelation) results[entry.id].graphable = true;
      if (fit && !scalarRelation && !entry.hidden)
        graphs.push({ kind: "function", id: entry.id, color, fn: fit.predict });
      return;
    }
    const p = parsed.get(entry.id);
    if (solvedEquationIds.has(entry.id)) return;
    if (!p || results[entry.id].error) return;
    try {
      const tex = scalarTex;
      const add = (g: GraphObject) => {
        results[entry.id].graphable = true;
        if (!entry.hidden) graphs.push(g);
      };
      // Defined points plot like the bare `(a,b)` row; undefined ones don't.
      const addPoints = (value: PointValue) => {
        const found = pointsOf(value).filter(
          (q) => Number.isFinite(q.x) && Number.isFinite(q.y),
        );
        if (found.length)
          add({ kind: "points", id: entry.id, color, points: found });
      };
      if (p.type === "variable") {
        const expanded = expand(p.a);
        const system = systemQuantities.find(
          (s) =>
            [...expanded.symbols].some((name) => s.names.includes(name)) &&
            [...expanded.symbols].every((name) => s.names.includes(name)),
        );
        if (system) {
          const quantity = system.solved.quantity(expanded);
          results[entry.id] = {
            tex: `${p.name} = ${tex(p.a)}`,
            ...quantity,
            ...(!Object.keys(quantity).length
              ? { message: "This quantity is not uniquely determined." }
              : {}),
          };
          if (quantity.value !== undefined) values[p.name] = quantity.value;
          return;
        }
        const deps = dependencies(p.a);
        const free = [...deps].filter(
          (name) => /^[a-df-wz]$/i.test(name) && !Object.hasOwn(values, name),
        );
        const unknown = [...deps].find(
          (name) =>
            !["x", "y"].includes(name) &&
            !free.includes(name) &&
            !columns.has(name) &&
            !Object.hasOwn(values, name),
        );
        if (unknown) throw new Error(`Define ${unknown} first.`);
        if (free.length) {
          free.forEach((name) => missing.add(name));
          results[entry.id] = {
            tex: `${p.name} = ${tex(p.a)}`,
            message: `Free parameters: ${free.join(", ")}.`,
          };
          return;
        }
        if (deps.has("y"))
          throw new Error("Named expressions in y need an explicit equation.");
        if (deps.has("x")) {
          evaluate(p.a, { x: 0.731 });
          results[entry.id].tex = `${p.name} = ${tex(p.a)}`;
          add({
            kind: "function",
            id: entry.id,
            color,
            fn: (x) => evaluate(p.a, { x }),
          });
          return;
        }
        const value = evaluateValue(p.a);
        if (isPoint(value)) {
          values[p.name] = value;
          results[entry.id] = {
            pointValue: value,
            tex: `${p.name} = ${tex(p.a)}`,
          };
          addPoints(value);
          return;
        }
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
        const deps = dependencies(p.a, undefined, new Set([p.argument]));
        const free = [...deps].filter(
          (name) => /^[a-df-wz]$/i.test(name) && !Object.hasOwn(values, name),
        );
        const unknown = [...deps].find(
          (name) =>
            !["x", "y"].includes(name) &&
            !free.includes(name) &&
            !columns.has(name) &&
            !Object.hasOwn(values, name),
        );
        if (unknown) throw new Error(`Define ${unknown} first.`);
        if (free.length) {
          free.forEach((name) => missing.add(name));
          results[entry.id] = {
            tex: `${p.name}(${p.argument}) = ${tex(p.a)}`,
            message: `Free parameters: ${free.join(", ")}.`,
          };
          return;
        }
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
        const symbols = dependencies(p.a);
        results[entry.id].tex = tex(p.a);
        const expanded = expand(p.a);
        const system = systemQuantities.find(
          (s) =>
            [...expanded.symbols].some((name) => s.names.includes(name)) &&
            [...expanded.symbols].every((name) => s.names.includes(name)),
        );
        if (system) {
          const quantity = system.solved.quantity(expanded);
          results[entry.id] = {
            ...results[entry.id],
            ...quantity,
            ...(!Object.keys(quantity).length
              ? { message: "This quantity is not uniquely determined." }
              : {}),
          };
          return;
        }
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
          const value = evaluateValue(p.a);
          if (isPoint(value)) {
            results[entry.id].pointValue = value;
            addPoints(value);
            return;
          }
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
        const aDeps = dependencies(p.a),
          bDeps = dependencies(p.b);
        const hasX = aDeps.has("x") || bDeps.has("x"),
          hasY = aDeps.has("y") || bDeps.has("y");
        if (
          ["x", "y"].includes(p.left) &&
          !bDeps.has("x") &&
          !bDeps.has("y") &&
          !Number.isFinite(evaluate(p.b))
        )
          throw new Error("Undefined or outside the supported numeric range.");
        if (p.relation !== "=" && (hasX || hasY)) {
          const residual = expand(
            scalarFromNode(
              scalar("x-y").node.map((_child, path) =>
                path === "args[0]" ? p.a.node : p.b.node,
              ),
            ),
          );
          const coefficients = affineCoefficients(residual.node, (node) =>
            evaluate(scalarFromNode(node)),
          );
          if (coefficients) {
            const { a, b, c } = coefficients;
            const affine = { ...coefficients, op: p.relation as Relation };
            if (b !== 0) {
              add({
                kind: "function",
                id: entry.id,
                color,
                affine,
                fn: (x) => -(a / b) * x - c / b,
                relation: b > 0 ? affine.op : reverseComparator(affine.op),
              });
            } else if (a !== 0) {
              add({
                kind: "vertical",
                id: entry.id,
                color,
                affine,
                fn: (x) => x + c / a,
                boundary: -c / a,
                relation: a > 0 ? affine.op : reverseComparator(affine.op),
              });
            } else {
              // Cancellation/zero coefficients can produce the whole plane or
              // the empty set. Neither has a boundary or isolated POIs.
              add({
                kind: "implicit",
                id: entry.id,
                color,
                affine,
                fn: () => c,
              });
            }
            return;
          }
          if (
            !(p.left === "y" && !bDeps.has("y")) &&
            !(p.left === "x" && !bDeps.has("x") && !bDeps.has("y"))
          ) {
            // Curved regions such as x^2+y^2<=9: shade where left - right
            // satisfies the comparison, with the boundary drawn on top.
            add({
              kind: "implicit",
              id: entry.id,
              color,
              fn: (x, y) => evaluate(p.a, { x, y }) - evaluate(p.b, { x, y }),
              region: p.relation as Relation,
            });
            results[entry.id].message =
              "Shading is drawn from the graph window and is approximate near the edge.";
            return;
          }
        }
        if (p.left === "y" && !bDeps.has("y"))
          add({
            kind: "function",
            id: entry.id,
            color,
            fn: (x) => evaluate(p.b, { x }),
            relation: p.relation === "=" ? undefined : (p.relation as Relation),
          });
        else if (!hasY && hasX) {
          if (p.relation !== "=" && (p.left !== "x" || bDeps.has("x")))
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
            rootsInWindow:
              p.relation === "="
                ? polynomialRootFinder(
                    expand(
                      scalarFromNode(
                        scalar("x-y").node.map((_child, path) =>
                          path === "args[0]" ? p.a.node : p.b.node,
                        ),
                      ),
                    ),
                    "x",
                    evaluate,
                  )
                : undefined,
          });
          results[entry.id].message =
            "Solutions are located numerically within the graph window.";
        } else if (hasX || hasY) {
          if (p.relation !== "=")
            throw new Error(
              "Implicit inequalities are not supported; use y < f(x) or x < a.",
            );
          // Only structurally affine equations qualify. Sampling alone could
          // mistake a nonlinear curve for a line and manufacture intercepts.
          const residual = expand(
            scalarFromNode(
              scalar("x-y").node.map((_child, path) =>
                path === "args[0]" ? p.a.node : p.b.node,
              ),
            ),
          );
          let affine = true;
          try {
            assertAffineParameters(residual.node, ["x", "y"]);
          } catch {
            affine = false;
          }
          if (affine) {
            const c = evaluate(residual, { x: 0, y: 0 }),
              a = evaluate(residual, { x: 1, y: 0 }) - c,
              b = evaluate(residual, { x: 0, y: 1 }) - c;
            if ([a, b, c].every(Number.isFinite) && b !== 0) {
              add({
                kind: "function",
                id: entry.id,
                color,
                fn: (x) => -(a * x + c) / b,
              });
              return;
            }
            if ([a, b, c].every(Number.isFinite) && a !== 0) {
              add({
                kind: "vertical",
                id: entry.id,
                color,
                fn: (x) => a * x + c,
              });
              return;
            }
          }
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
  // Coordinate equations remain graphs. Attach the same bounded finite-system
  // answer without publishing x/y as global parameters or depending on view.
  const coordinateRows: {
    id: string;
    left: Scalar;
    right: Scalar;
    restrictions: Restriction[];
  }[] = [];
  for (const [id, p] of parsed) {
    if (p.type !== "relation" || p.relation !== "=" || results[id].error)
      continue;
    try {
      const { body, restrictions } = relationSource(products(sources.get(id)!));
      const [left, right] = body.split("=").map((s) => expand(scalar(s)));
      const deps = [...new Set([...left.symbols, ...right.symbols])];
      if (deps.length && deps.every((n) => n === "x" || n === "y"))
        coordinateRows.push({ id, left, right, restrictions });
    } catch {
      /* Existing graph diagnostics handle malformed expressions. */
    }
  }
  if (
    coordinateRows.length >= 2 &&
    ["x", "y"].every((n) =>
      coordinateRows.some(
        (r) => r.left.symbols.has(n) || r.right.symbols.has(n),
      ),
    )
  ) {
    const ids = coordinateRows.map((r) => r.id);
    try {
      const restrictions = [
        ...coordinateRows.flatMap((r) => r.restrictions),
        ...systemRestrictions(["x", "y"]).map((r) => r.restriction),
      ];
      const solved = solveFiniteSystem(
        coordinateRows,
        ["x", "y"],
        parameterBounds(restrictions, ["x", "y"], expand, evaluate),
        state.angle,
      );
      for (const id of ids)
        results[id] = {
          ...results[id],
          parameters: solved.parameters,
          solutions: solved.solutions,
          systemKind: solved.kind,
          message: solved.message,
        };
      const points = solved.solutions?.map(({ x, y }) => ({ x, y }));
      if (points) {
        const graph = graphs.find((g) => ids.includes(g.id));
        if (graph) graph.systemIntersections = { points, graphIds: ids };
      }
    } catch (error) {
      for (const id of ids)
        results[id].message =
          error instanceof Error
            ? error.message
            : "Unsupported coordinate system.";
    }
  }
  return {
    graphs,
    results,
    missing: [...missing].filter((name) => !Object.hasOwn(values, name)).sort(),
  };
}
