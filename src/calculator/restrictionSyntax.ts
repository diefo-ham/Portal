export type ComparisonSource = { left: string; right: string; op: string };

/** Shared brace/comparison grammar only. Callers give these comparisons either
 * expression-domain semantics or fitted-parameter semantics. */
export function restrictionSource(
  source: string,
  kind: "domain" | "parameter",
) {
  const malformed = () =>
    new Error(
      `Malformed ${kind} restriction. Use comparisons such as {0<x<=5}.`,
    );
  const start = source.indexOf("{");
  // y={x<0:-x,x}: braces right after "=" are a piecewise value, not a restriction.
  if (start > 0 && /=\s*$/.test(source.slice(0, start)))
    return { body: source, comparisons: [] as ComparisonSource[] };
  if (start < 0) {
    if (source.includes("}")) throw malformed();
    return { body: source, comparisons: [] as ComparisonSource[] };
  }
  const body = source.slice(0, start).trim(),
    tail = source.slice(start);
  const groups = [...tail.matchAll(/\{([^{}]+)\}/g)];
  if (!body || !groups.length || tail.replace(/\{([^{}]+)\}/g, "").trim())
    throw malformed();
  const comparisons: ComparisonSource[] = [];
  for (const group of groups) {
    // Split only at the condition's top level: commas in mod(x,2), for
    // example, belong to numeric operands rather than conjunctions.
    const parts: string[] = [];
    let depth = 0,
      start = 0;
    for (let i = 0; i <= group[1].length; i++) {
      const char = group[1][i];
      if (char === "(" || char === "[") depth++;
      if (char === ")" || char === "]") depth--;
      if (depth < 0) throw malformed();
      if (depth === 0 && (char === "," || i === group[1].length)) {
        parts.push(group[1].slice(start, i).trim());
        start = i + 1;
      }
    }
    if (depth) throw malformed();
    for (const clause of parts) {
      const operands = clause.split(/(<=|>=|<|>)/).map((s) => s.trim());
      if (
        operands.length < 3 ||
        operands.length % 2 !== 1 ||
        operands.some((s) => !s)
      )
        throw malformed();
      for (let i = 1; i < operands.length; i += 2)
        comparisons.push({
          left: operands[i - 1],
          op: operands[i],
          right: operands[i + 1],
        });
    }
  }
  if (!comparisons.length || comparisons.length > 10) throw malformed();
  return { body, comparisons };
}
