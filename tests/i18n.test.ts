import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { es } from "../src/ui/es";
import { translator } from "../src/ui/i18n";

/** The first argument of every `t(...)` call in the screens, as string literals. */
function phrases() {
  const found = new Map<string, string>();
  const folders = [
    ["src/ui", /\.tsx?$/],
    ["src/core", /sessions\.ts$/],
  ] as const;
  for (const [folder, pattern] of folders)
    for (const file of readdirSync(folder).filter((name) => pattern.test(name))) {
      const source = readFileSync(join(folder, file), "utf8");
      for (const call of source.matchAll(/(?<![\w.])t\(/g)) {
        let depth = 0;
        let quote = "";
        let end = call.index + call[0].length;
        for (; end < source.length; end++) {
          const c = source[end];
          if (quote) {
            if (c === "\\") end++;
            else if (c === quote) quote = "";
          } else if ("\"'`".includes(c)) quote = c;
          else if ("([{".includes(c)) depth++;
          else if (")]}".includes(c)) {
            if (depth === 0) break;
            depth--;
          } else if (c === "," && depth === 0) break;
        }
        const argument = source.slice(call.index + call[0].length, end);
        for (const literal of argument.matchAll(/"((?:[^"\\]|\\.)*)"/g))
          found.set(literal[1], `${folder}/${file}`);
      }
    }
  return found;
}

// Phrases passed to t() through a variable, not a literal.
const dynamic = [
  "Practice",
  "Review",
  "Browse",
  "Tests",
  "Test mode",
  "Easy",
  "Medium",
  "Hard",
  "easy",
  "medium",
  "hard",
];

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Spanish text for the PAA portal", () => {
  it("covers every phrase the screens pass to t()", () => {
    const missing = [...phrases()]
      .filter(([phrase]) => !(phrase in es))
      .map(([phrase, file]) => `${file}: ${phrase}`);
    expect(missing).toEqual([]);
    for (const phrase of dynamic) expect(es).toHaveProperty([phrase]);
  });

  it("fills in the same values in both languages", () => {
    for (const [english, spanish] of Object.entries(es))
      expect(placeholders(spanish), english).toEqual(placeholders(english));
  });

  it("has no entry for a phrase the screens no longer use", () => {
    const used = new Set([...phrases().keys(), ...dynamic]);
    const unused = Object.keys(es).filter((phrase) => !used.has(phrase));
    expect(unused).toEqual([]);
  });

  it("leaves English exactly as written and fills in values", () => {
    const en = translator("SAT");
    expect(en("Max {n}", { n: 5 })).toBe("Max 5");
    expect(en("Question {n}", { n: 3 })).toBe("Question 3");
    expect(en("Not a real phrase")).toBe("Not a real phrase");
  });

  it("translates for the PAA, falling back to English for an unknown phrase", () => {
    const paa = translator("PAA");
    expect(paa("Max {n}", { n: 5 })).toBe("Máx. 5");
    expect(paa("Start practice →")).toBe("Empezar a practicar →");
    expect(paa("Not a real phrase")).toBe("Not a real phrase");
  });
});
