import { scalar, scalarTex } from "./math";

/** Convert the small supported math language, never execute LaTeX/HTML. */
export function latexToText(latex: string): string {
  let index = 0;
  const read = (closing?: string): string => {
    let out = "";
    while (index < latex.length) {
      const char = latex[index++];
      if (char === closing) return out;
      if (char === "{") {
        out += `(${read("}")})`;
        continue;
      }
      if (char === "_") {
        if (latex[index] === "{") {
          index++;
          out += `_${read("}").replace(/[()\s]/g, "")}`;
        } else out += `_${latex[index++] || ""}`;
        continue;
      }
      if (char !== "\\") {
        out += char;
        continue;
      }
      const command =
        latex.slice(index).match(/^[a-zA-Z]+/)?.[0] || latex[index++] || "";
      if (/^[a-zA-Z]+$/.test(command)) index += command.length;
      const group = () => {
        while (latex[index] === " ") index++;
        if (latex[index] !== "{")
          throw new Error("Complete the mathematical structure.");
        index++;
        return read("}");
      };
      if (command === "frac") {
        const a = group(),
          b = group();
        out += `((${a})/(${b}))`;
      } else if (command === "sqrt") {
        let root: string | undefined;
        if (latex[index] === "[") {
          index++;
          root = read("]");
        }
        const body = group();
        out +=
          root === "3"
            ? `cbrt(${body})`
            : root
              ? `nthroot(${body},${root})`
              : `sqrt(${body})`;
      } else if (command === "%") {
        const percentOf = "\\operatorname{of}";
        if (latex.slice(index).startsWith(percentOf)) {
          index += percentOf.length;
          out += "*0.01*";
        } else out += "*0.01";
      } else if (command === "operatorname" || command === "mathrm")
        out += group();
      else if (["left", "right", " ", ",", "!"].includes(command)) continue;
      else if (command === "cdot" || command === "times") out += "*";
      else if (command === "div") out += "/";
      else if (command === "le" || command === "leq") out += "<=";
      else if (command === "ge" || command === "geq") out += ">=";
      else if (command === "sim") out += "~";
      else if (command === "{" || command === "}") out += command;
      else if (["ldots", "dots", "cdots"].includes(command)) out += "...";
      else if (command === "lvert" || command === "rvert" || command === "vert")
        out += "|";
      else if (
        [
          "sin",
          "cos",
          "tan",
          "sec",
          "csc",
          "cot",
          "arcsin",
          "arccos",
          "arctan",
          "arcsec",
          "arccsc",
          "arccot",
          "log",
          "ln",
          "exp",
          "abs",
          "min",
          "max",
          "floor",
          "ceil",
          "round",
          "mean",
          "median",
          "quartile",
          "quantile",
          "stdev",
          "stdevp",
          "var",
          "varp",
          "variance",
          "mad",
          "count",
          "total",
          "stats",
          "pi",
          "theta",
        ].includes(command)
      )
        out +=
          command +
          (["pi", "theta"].includes(command) ||
          ["_", "^"].includes(latex[index])
            ? ""
            : " ");
      else throw new Error(`Unsupported math command: ${command}.`);
    }
    if (closing) throw new Error("Complete the mathematical structure.");
    return out;
  };
  return read().replace(/\s+/g, " ").trim();
}

/** Legacy plain-text work opens structurally without changing its engine text. */
export function textToLatex(text: string): string {
  if (!text.trim()) return "";
  // Visible restriction braces are delimiters, unlike TeX's structural groups.
  // Keep the suffix out of scalar TeX generation and preserve comparison signs.
  const restrictionStart = text.indexOf("{");
  if (restrictionStart >= 0) {
    return (
      textToLatex(text.slice(0, restrictionStart)) +
      text
        .slice(restrictionStart)
        .replace(/\{/g, "\\left\\{")
        .replace(/\}/g, "\\right\\}")
        .replace(/>=/g, "\\ge ")
        .replace(/<=/g, "\\le ")
        .replace(/\*/g, "\\cdot ")
        .replace(/_([0-9]+)/g, "_{$1}")
    );
  }
  try {
    return text
      .split(/([=~<>])/)
      .map((part) => {
        if (/^[=~<>]$/.test(part)) return part === "~" ? "\\sim " : part;
        if (!part.trim()) return "";
        const trimmed = part.trim();
        if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
          const body = trimmed.slice(1, -1);
          let depth = 0;
          for (let i = 0; i < body.length; i++) {
            if ("([".includes(body[i])) depth++;
            if (")]".includes(body[i])) depth--;
            if (body[i] === "," && depth === 0)
              return `\\left(${scalarTex(scalar(body.slice(0, i)))},${scalarTex(scalar(body.slice(i + 1)))}\\right)`.replace(
                /~/g,
                " ",
              );
          }
        }
        // Math.js uses literal ~ as TeX spacing for implicit multiplication.
        // DesQuill treats ~ as the regression operator, so use ordinary spacing.
        return scalarTex(scalar(part)).replace(/~/g, " ");
      })
      .join("")
      .replace(/\\ldots\s*/g, "...")
      .replace(/\\mathrm\{([a-z])_([0-9]+)\}/g, "$1_{$2}");
  } catch {
    return text
      .replace(/\*/g, "\\cdot ")
      .replace(/\b(sqrt|sin|cos|tan|sec|csc|cot|log|ln|abs|exp)\b/g, "\\$1 ")
      .replace(/\^(-?\d+)/g, "^{$1}")
      .replace(/_([0-9]+)/g, "_{$1}");
  }
}
