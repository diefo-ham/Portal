import { describe, expect, it } from "vitest";
import {
  ASCENT_RATIO,
  findPhrase,
  fragmentsFromItems,
  layoutPage,
  type TextFragment,
} from "../src/importing/pdf/layout.ts";
import {
  afterRationale,
  extractAnswer,
  normalizedText,
} from "../src/importing/pdf/answers.ts";
import { indexExport } from "../src/importing/pdf/segment.ts";
import {
  classifyExports,
  type ExportPair,
} from "../src/importing/pdf/classify.ts";
import {
  cleanSkill,
  convertRecordText,
  recordSignature,
} from "../src/importing/pdf/record.ts";
import type { SourceRecord } from "../src/importing/pdf/segment.ts";

/** One text run on its own line, with a width proportional to its length. */
const run = (
  text: string,
  x: number,
  baseline: number,
  size = 9.29,
  width = text.length * size * 0.5,
): TextFragment => ({ text, x, baseline, width, size, endsLine: true });
/** A run that continues on the same line. */
const inline = (
  text: string,
  x: number,
  baseline: number,
  size = 9.29,
  width = text.length * size * 0.5,
): TextFragment => ({ text, x, baseline, width, size, endsLine: false });

describe("layout", () => {
  it("keeps words together across kerned fragments and spaces real gaps", () => {
    const page = layoutPage(
      [inline("Wa", 18, 100, 10, 12), inline("ter", 30, 100, 10, 15)],
      792,
    );
    expect(page.text).toBe("Water\n");
    // A pair that starts under the previous run (kerning) reads as a space once the
    // overlap is at least 8% of the font size, but a tighter overlap does not.
    const kerned = layoutPage(
      [inline("T", 18, 100, 10, 6), inline(".", 5 + 18, 100, 10, 3)],
      792,
    );
    expect(kerned.text).toBe("T .\n");
    const tight = layoutPage(
      [inline("“", 18, 100, 10, 4), inline("x", 21.6, 100, 10, 5)],
      792,
    );
    expect(tight.text).toBe("“x\n");
  });

  it("breaks lines on reader markers, baseline changes, and backwards motion", () => {
    const page = layoutPage(
      [
        run("first", 18, 100),
        inline("second", 18, 120),
        inline("same line", 100, 120),
        inline("backwards", 20, 120),
      ],
      792,
    );
    expect(page.lines.map((line) => line.text)).toEqual([
      "first",
      "second same line",
      "backwards",
    ]);
    expect(page.text).toBe("first\nsecond same line\nbackwards\n");
  });

  it("builds fragments from reader items and skips non-text entries", () => {
    expect(
      fragmentsFromItems(
        [
          { type: "beginMarkedContent" },
          {
            str: "Hi",
            transform: [1, 0, 0, 1, 18, 700],
            width: 10,
            height: 9,
            hasEOL: true,
          },
        ],
        792,
      ),
    ).toEqual([
      { text: "Hi", x: 18, baseline: 92, width: 10, size: 9, endsLine: true },
    ]);
  });

  it("finds phrases with PyMuPDF-compatible boxes", () => {
    const page = layoutPage(
      [
        run("Question", 18, 135.75, 7.89, 36.23),
        inline("Correct", 18, 348 + 6.75, 7.89, 30),
        inline("Answer:", 52, 348 + 6.75, 7.89, 33),
        run("Rationale", 18, 380, 7.89, 38),
      ],
      792,
    );
    const heading = findPhrase(page, "question")[0];
    expect(heading.x0).toBe(18);
    // Measured from PyMuPDF on a real export: top 129.0, bottom 136.89.
    expect(heading.y0).toBeCloseTo(129.0, 2);
    expect(heading.y1).toBeCloseTo(136.89, 2);
    expect(ASCENT_RATIO).toBeCloseTo(0.8555, 4);
    const key = findPhrase(page, "Correct Answer:");
    expect(key).toHaveLength(1);
    expect(key[0].x0).toBe(18);
    expect(key[0].x1).toBeCloseTo(85, 5);
    expect(findPhrase(page, "Missing phrase")).toEqual([]);
  });
});

describe("answers", () => {
  it("reads choice and numeric keys", () => {
    expect(extractAnswer("Correct Answer: C\nRationale\nBecause.")).toEqual({
      answer: { type: "choice", value: "C" },
      origin: "answer-key",
    });
    expect(
      extractAnswer("Correct Answer: 3, 3.0\nRationale\nx").answer,
    ).toEqual({
      type: "numeric",
      accepted: ["3", "3.0"],
    });
    expect(
      extractAnswer("Correct Answer: \u22122/5\nRationale\nx").answer,
    ).toEqual({
      type: "numeric",
      accepted: ["-2/5"],
    });
  });

  it("falls back only to an explicit statement in the rationale", () => {
    expect(
      extractAnswer("Rationale\nThe correct answer is 3,540. Explanation."),
    ).toEqual({
      answer: { type: "numeric", accepted: ["3540"] },
      origin: "rationale",
    });
    expect(
      extractAnswer("Rationale\nChoice B is correct. Explanation.").answer,
    ).toEqual({ type: "choice", value: "B" });
    expect(() => extractAnswer("Rationale\nWe can solve this.")).toThrow(
      "No explicit machine-readable correct answer",
    );
  });

  it("adds documented accepted-entry variants without duplicates", () => {
    const { answer, origin } = extractAnswer(
      "Correct Answer: 3/17\nRationale\nNote that 3/17, .1764, .1765, and 0.176 are examples of ways to enter a correct answer.",
    );
    expect(answer).toEqual({
      type: "numeric",
      accepted: ["3/17", ".1764", ".1765", "0.176"],
    });
    expect(origin).toBe("answer-key");
  });

  it("rejects ambiguous or unsupported keys instead of guessing", () => {
    expect(() =>
      extractAnswer("Correct Answer: A\nCorrect Answer: B\nRationale\nx"),
    ).toThrow("Multiple answer keys");
    expect(() =>
      extractAnswer("Correct Answer: unknown\nRationale\nx"),
    ).toThrow("Unsupported numeric answer");
    expect(() => extractAnswer("Correct Answer: 1/0\nRationale\nx")).toThrow(
      "Unsupported numeric answer",
    );
  });

  it("normalizes whitespace and finds the rationale", () => {
    expect(normalizedText(" a\u00a0b \n\ufffd c ")).toBe("a b c");
    expect(afterRationale("x\nRationale\nBecause")).toBe("Because");
    expect(afterRationale("no rationale")).toBe("no rationale");
  });
});

/** A synthetic first page of a question using the export's header table. */
function questionPage(id: string, section: string, skill: string[]) {
  const fragments: TextFragment[] = [
    run(`Question ID: ${id}`, 18, 33, 1.35, 120),
    run("Assessment", 24.8, 65.3, 8.76, 50),
    run("Test", 139.6, 65.3, 8.76, 18),
    run("Domain", 254.5, 65.3, 8.76, 31),
    run("Skill", 369.4, 65.3, 8.76, 17),
    run("Difficulty", 484.4, 65.3, 8.76, 37),
    run("SAT", 24.8, 90.8, 8.76, 17),
    run(section, 140, 90.8, 8.76, 30),
    run("Algebra", 254.9, 90.8, 8.76, 30),
    run(skill[0], 369.8, 90.8, 8.76, 60),
    ...(skill[1] ? [run(skill[1], 369.8, 102, 8.76, 30)] : []),
    run("Hard", 484.7, 90.8, 8.76, 19),
    run("Question", 18, 135.75, 7.89, 36.23),
  ];
  return fragments;
}

describe("segment", () => {
  it("assigns pages by Question ID and reads the metadata table", () => {
    const first = layoutPage(
      [
        ...questionPage("aaaa1111", "Math", [
          "Linear equations in one",
          "variable",
        ]),
        run("A synthetic stem.", 18, 175),
      ],
      792,
    );
    const second = layoutPage([run("More of the same question.", 18, 60)], 792);
    const third = layoutPage(
      [...questionPage("bbbb2222", "Reading and Writing", ["Inferences"])],
      792,
    );
    const records = indexExport("synthetic.pdf", [first, second, third]);
    expect(records.map((record) => record.id)).toEqual([
      "aaaa1111",
      "bbbb2222",
    ]);
    expect(records[0]).toMatchObject({
      pages: [1, 2],
      section: "Math",
      domain: "Algebra",
      skill: "Linear equations in one variable",
      difficulty: "Hard",
    });
    expect(records[1].pages).toEqual([3]);
    expect(records[0].texts[1]).toBe("More of the same question.\n");
  });

  it("refuses unassigned pages and missing headings", () => {
    expect(() =>
      indexExport("s.pdf", [layoutPage([run("Orphan", 18, 60)], 792)]),
    ).toThrow("Unassigned page 1 in s.pdf");
    expect(() =>
      indexExport("s.pdf", [
        layoutPage([run("Question ID: cccc3333", 18, 33)], 792),
      ]),
    ).toThrow("Missing question boundary in s.pdf, page 1");
  });
});

const record = (overrides: Partial<SourceRecord> = {}): SourceRecord => ({
  id: "abc12345",
  startPage: 1,
  pages: [1],
  section: "Math",
  domain: "Algebra",
  skill: "Linear functions",
  difficulty: "Easy",
  texts: [
    "Question ID: abc12345\nQuestion\nWhat is 2 + 2?\nAnswer\nA. 2\nB. 3\nC. 4\nD. 5\nCorrect Answer: C\nRationale\nTwo plus two is four.\n",
  ],
  ...overrides,
});

describe("record", () => {
  it("builds the text fields for a choice question", () => {
    expect(convertRecordText(record())).toEqual({
      id: "cb-abc12345",
      sourceId: "abc12345",
      source: "College Board SAT question bank",
      section: "math",
      domain: "Algebra",
      skill: "Linear functions",
      difficulty: "easy",
      stem: "What is 2 + 2?",
      answer: { type: "choice", value: "C" },
      answerKeyOrigin: "answer-key",
      rationale: "Two plus two is four.",
      choices: ["A", "B", "C", "D"].map((id) => ({ id, text: "Option " + id })),
    });
  });

  it("builds a numeric question without choices", () => {
    const q = convertRecordText(
      record({
        texts: [
          "Question\nHow many?\nAnswer\nCorrect Answer: 12\nRationale\nTwelve.\n",
        ],
      }),
    );
    expect(q.answer).toEqual({ type: "numeric", accepted: ["12"] });
    expect(q.choices).toBeUndefined();
  });

  it("quarantines unrecognized metadata and out-of-order options", () => {
    expect(() => convertRecordText(record({ section: "Science" }))).toThrow(
      "Missing or unrecognized metadata",
    );
    expect(() => convertRecordText(record({ difficulty: "Extreme" }))).toThrow(
      "Missing or unrecognized metadata",
    );
    const reordered = record({
      texts: [
        "Question\nQ?\nAnswer\nA. x\nC. y\nB. z\nD. w\nCorrect Answer: A\nRationale\nr\n",
      ],
    });
    expect(() => convertRecordText(reordered)).toThrow("Expected options A-D");
    // A reviewed override accepts the verified layout and carries its warning.
    expect(
      convertRecordText(reordered, {
        choiceLabelsVerified: true,
        warning: "Final bullet is option D.",
      }).extractionWarnings,
    ).toEqual(["Final bullet is option D."]);
  });

  it("cleans known skill artifacts and compares duplicate exports", () => {
    expect(cleanSkill("Cross-text Connections")).toBe("Cross-Text Connections");
    expect(cleanSkill("Ratios, rates, and propor tional relationships")).toBe(
      "Ratios, rates, and proportional relationships",
    );
    expect(recordSignature(record())).toBe(recordSignature(record()));
    expect(recordSignature(record())).not.toBe(
      recordSignature(record({ difficulty: "Hard" })),
    );
  });
});

describe("classify", () => {
  const rec = (id: string): SourceRecord => record({ id });
  const pairs: ExportPair[] = [
    { group: "math", inactive: [rec("m1"), rec("m2")], active: [rec("m3")] },
    {
      group: "read_write",
      inactive: [rec("r1")],
      active: [rec("r1"), rec("r2")],
    },
  ];

  it("reads each subject's files from their contents by default", () => {
    const { statuses, interpretation, conflicts } = classifyExports(pairs);
    expect(interpretation).toEqual({
      math: "active-only",
      read_write: "inclusive",
    });
    expect(statuses.get("m3")).toBe("active");
    expect(statuses.get("r1")).toBe("inactive");
    expect(statuses.get("r2")).toBe("active");
    expect(conflicts).toEqual([]);
  });

  it("leaves what the files cannot prove unknown when they overlap unevenly", () => {
    const uneven: ExportPair[] = [
      {
        group: "math",
        inactive: [rec("a"), rec("b")],
        active: [rec("b"), rec("c")],
      },
    ];
    const { statuses, interpretation, conflicts } = classifyExports(uneven);
    expect(interpretation.math).toBe("inclusive");
    expect(statuses.get("a")).toBe("inactive");
    expect(statuses.get("b")).toBe("inactive");
    expect(statuses.get("c")).toBe("unknown");
    expect(conflicts).toHaveLength(1);
  });

  it("treats active-only exports as active unless an ID is in both", () => {
    const { statuses, comparison } = classifyExports(pairs, "active-only");
    expect(statuses.get("m1")).toBe("inactive");
    expect(statuses.get("m3")).toBe("active");
    expect(statuses.get("r1")).toBe("unknown");
    expect(statuses.get("r2")).toBe("active");
    expect(comparison.read_write).toEqual({
      both: 1,
      inactiveFileOnly: 0,
      activeFileOnly: 1,
    });
  });

  it("marks everything outside the inactive file unknown when not told", () => {
    const { statuses } = classifyExports(pairs, "unknown");
    expect(statuses.get("m1")).toBe("inactive");
    expect(statuses.get("m3")).toBe("unknown");
    expect(statuses.get("r1")).toBe("inactive");
  });

  it("flags an inclusive export that is not a superset", () => {
    const { statuses, conflicts } = classifyExports(pairs, "inclusive");
    expect(conflicts).toEqual([
      {
        section: "math",
        reason: expect.stringContaining("not a subset"),
      },
    ]);
    expect(statuses.get("m3")).toBe("unknown");
    expect(statuses.get("r2")).toBe("active");
    expect(statuses.get("r1")).toBe("inactive");
  });
});
