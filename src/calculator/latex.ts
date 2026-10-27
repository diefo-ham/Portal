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
              ? `((${body})^(1/(${root})))`
              : `sqrt(${body})`;
      } else if (command === "operatorname" || command === "mathrm")
        out += group();
      else if (["left", "right", " ", ",", "!"].includes(command)) continue;
      else if (command === "cdot" || command === "times") out += "*";
      else if (command === "div") out += "/";
      else if (command === "le" || command === "leq") out += "<=";
      else if (command === "ge" || command === "geq") out += ">=";
      else if (command === "sim") out += "~";
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
  try {
    return text
      .split(/([=~<>])/)
      .map((part) => {
        if (/^[=~<>]$/.test(part)) return part === "~" ? "\\sim " : part;
        if (!part.trim()) return "";
        // Math.js uses literal ~ as TeX spacing for implicit multiplication.
        // DesQuill treats ~ as the regression operator, so use ordinary spacing.
        return scalarTex(scalar(part)).replace(/~/g, " ");
      })
      .join("")
      .replace(/\\mathrm\{([a-z])_([0-9]+)\}/g, "$1_{$2}");
  } catch {
    return text
      .replace(/\*/g, "\\cdot ")
      .replace(/\b(sqrt|sin|cos|tan|sec|csc|cot|log|ln|abs|exp)\b/g, "\\$1 ")
      .replace(/\^(-?\d+)/g, "^{$1}")
      .replace(/_([0-9]+)/g, "_{$1}");
  }
}
