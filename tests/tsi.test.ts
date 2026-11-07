import { afterEach, describe, expect, it, vi } from "vitest";
import {
  layoutPage,
  type PageLayout,
  type TextFragment,
} from "../src/importing/pdf/layout.ts";
import { indexPaaExport, type PaaRecord } from "../src/importing/pdf/paa.ts";
import { planCrops } from "../src/importing/pdf/crops.ts";
import { paintOver, type RasterImage } from "../src/importing/pdf/raster.ts";
import {
  type ExportReader,
  type ReadableFile,
} from "../src/importing/pdf/prepare.ts";
import { prepareTsiLibrary } from "../src/importing/pdf/preparePaa.ts";
import {
  CALCULATOR_TAG_PHRASES,
  convertTsiRecord,
  groupTsiPassages,
  originOf,
  tsiSignature,
  withoutInstruction,
} from "../src/importing/pdf/tsi.ts";
import { parseQuestions } from "../src/importing/json.ts";

// Everything here is invented: no College Board text, only the page layout.

const run = (
  text: string,
  x: number,
  baseline: number,
  size = 8.6,
): TextFragment => ({
  text,
  x,
  baseline,
  width: text.length * size * 0.5,
  size,
  endsLine: true,
});

interface Line {
  text: string;
  /** Reading text is printed smaller than the question. */
  size?: number;
}
interface Spec {
  id: string;
  assessment?: string;
  test?: string;
  /** A long name wraps onto several lines inside its column, as printed. */
  domain?: string | string[];
  skill?: string | string[];
  difficulty?: string;
  stem?: (string | Line)[];
  options?: string[];
  key?: string;
  rationale?: string[];
  source?: string | false;
  unrelated?: boolean;
}

const OFFICIAL = "Source: official College Board TSIA2 sample question.";
const ORIGINAL = "Source: original practice item written for this portal.";

function page(spec: Spec): PageLayout {
  if (spec.unrelated)
    return layoutPage([run("Some letter.", 18, 40, 12)], 792, 612);
  const heading = 135.75;
  let y = heading + 22;
  const stem = (spec.stem ?? ["A synthetic stem."]).map((entry) => {
    const line = typeof entry === "string" ? { text: entry } : entry;
    const fragment = run(line.text, 18, y, line.size);
    y += 12;
    return fragment;
  });
  y += 12;
  const answerLabel = run("Answer", 18, y, 7.89);
  y += 22;
  const options = (
    spec.options ?? ["A. one", "B. two", "C. three", "D. four"]
  ).map((line) => {
    const fragment = run(line, 18, y);
    y += 22;
    return fragment;
  });
  const key = run(spec.key ?? "Correct Answer: B", 18, y + 6, 7.89);
  const rationale = [
    ...(spec.rationale ?? ["A synthetic explanation."]),
    ...(spec.source === false ? [] : [spec.source ?? ORIGINAL]),
  ].map((line, i) => run(line, 18, y + 60 + i * 12));
  return layoutPage(
    [
      run(`Question ID: ${spec.id}`, 18, 33, 12),
      run("Assessment", 24.8, 65.3, 8.76),
      run("Test", 139.6, 65.3, 8.76),
      run("Domain", 254.5, 65.3, 8.76),
      run("Skill", 369.4, 65.3, 8.76),
      run("Difficulty", 484.4, 65.3, 8.76),
      run(spec.assessment ?? "TSIA2", 24.8, 90.8, 8.76),
      run(spec.test ?? "Mathematics", 140, 90.8, 8.76),
      ...[spec.domain ?? "Algebraic Reasoning"]
        .flat()
        .map((line, i) => run(line, 254.9, 90.8 + i * 11, 8.76)),
      ...[spec.skill ?? "Linear equations"]
        .flat()
        .map((line, i) => run(line, 369.8, 90.8 + i * 11, 8.76)),
      run(spec.difficulty ?? "Medium", 484.7, 90.8, 8.76),
      run("Question", 18, heading, 7.89),
      ...stem,
      answerLabel,
      ...options,
      key,
      run("Rationale", 18, y + 36, 7.89),
      ...rationale,
    ],
    792,
    612,
  );
}

const records = (...specs: Spec[]) =>
  indexPaaExport("tsi.pdf", specs.map(page));
const one = (spec: Spec) => records(spec)[0];

describe("convertTsiRecord", () => {
  it("converts a question to a TSI question with English choices", () => {
    const { text, notes } = convertTsiRecord(
      one({
        id: "ABC12345",
        test: "ELAR",
        domain: ["Sentence Revision,", "Editing, and Completion"],
        skill: ["Conventions of", "grammar"],
        difficulty: "Easy",
        key: "Correct Answer: C",
      }),
    );
    expect(text).toMatchObject({
      id: "tsi-abc12345",
      assessment: "TSI",
      sourceId: "abc12345",
      section: "tsi-elar",
      domain: "Sentence Revision, Editing, and Completion",
      skill: "Conventions of grammar",
      difficulty: "easy",
      origin: "original",
      answer: { type: "choice", value: "C" },
    });
    expect(text.choices).toEqual(
      ["A", "B", "C", "D"].map((id) => ({ id, text: `Choice ${id}` })),
    );
    expect(notes).toEqual([]);
  });

  it("accepts TSIA2 and TSI as the assessment, and refuses anything else", () => {
    expect(convertTsiRecord(one({ id: "aaaa0001" })).text.assessment).toBe(
      "TSI",
    );
    expect(
      convertTsiRecord(one({ id: "aaaa0002", assessment: "TSI" })).text.id,
    ).toBe("tsi-aaaa0002");
    for (const assessment of ["PAA", "SAT"])
      expect(() =>
        convertTsiRecord(one({ id: "aaaa0003", assessment })),
      ).toThrow("expected TSIA2");
  });

  it("maps the two tests and rejects an unknown one", () => {
    expect(
      convertTsiRecord(one({ id: "aaaa0004", test: "ELAR" })).text.section,
    ).toBe("tsi-elar");
    expect(
      convertTsiRecord(one({ id: "aaaa0005", test: "Mathematics" })).text
        .section,
    ).toBe("tsi-math");
    expect(() =>
      convertTsiRecord(one({ id: "aaaa0006", test: "Writing" })),
    ).toThrow("Missing or unrecognized metadata");
  });

  it("keeps the answer choices in their printed order", () => {
    const options = ["A. zeta", "B. alfa", "C. mu", "D. beta"];
    expect(() =>
      convertTsiRecord(one({ id: "aaaa0007", options })),
    ).not.toThrow();
    expect(() =>
      convertTsiRecord(
        one({
          id: "aaaa0008",
          options: ["A. one", "C. three", "B. two", "D. four"],
        }),
      ),
    ).toThrow("Expected options A-D");
  });
});

describe("Official and Original", () => {
  it("reads the label from the Source line and drops that line from the text", () => {
    const official = convertTsiRecord(
      one({
        id: "bbbb0001",
        test: "ELAR",
        source: OFFICIAL,
        rationale: ["Choice B is right."],
      }),
    );
    expect(official.text.origin).toBe("official");
    expect(official.text.rationale).toBe("Choice B is right.");
    expect(
      convertTsiRecord(one({ id: "bbbb0002", source: ORIGINAL })).text.origin,
    ).toBe("original");
  });

  it("treats a missing or unreadable label as Official, and says so", () => {
    for (const source of [false, "Source: somewhere else."] as const) {
      const { text, notes } = convertTsiRecord(
        one({ id: "bbbb0003", test: "ELAR", source }),
      );
      expect(text.origin).toBe("official");
      expect(notes).toEqual([expect.stringContaining("treated as Official")]);
    }
    expect(originOf(["No label here"])).toEqual({
      origin: "official",
      recognized: false,
    });
  });

  it("makes two copies of one ID disagree when their labels differ", () => {
    expect(tsiSignature(one({ id: "bbbb0004", source: OFFICIAL }))).not.toBe(
      tsiSignature(one({ id: "bbbb0004", source: ORIGINAL })),
    );
  });

  describe("in a build that carries original items only", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("leaves College Board sample items out with a clear reason", async () => {
      vi.stubEnv("VITE_INCLUDE_OFFICIAL", "false");
      vi.resetModules();
      const flags = await import("../src/core/buildFlags.ts");
      expect(flags.OFFICIAL_ITEMS_ALLOWED).toBe(false);
      const tsi = await import("../src/importing/pdf/tsi.ts");
      expect(() =>
        tsi.convertTsiRecord(one({ id: "cccc0001", source: OFFICIAL })),
      ).toThrow("original items only");
      expect(
        tsi.convertTsiRecord(one({ id: "cccc0002", source: ORIGINAL })).text
          .origin,
      ).toBe("original");
    });
  });
});

describe("calculator tags", () => {
  it.each([
    ["[basic]", "basic"],
    ["[square root]", "sqrt"],
    ["[graphing]", "graphing"],
  ] as const)("reads %s and removes it from the stem", (tag, tier) => {
    const { text } = convertTsiRecord(
      one({ id: "dddd0001", stem: [`What is 2 + 2? ${tag}`] }),
    );
    expect(text.calculator).toBe(tier);
    expect(text.stem).toBe("What is 2 + 2?");
  });

  it("notes a Math question with no tag, and gives it no calculator", () => {
    const { text, notes } = convertTsiRecord(one({ id: "dddd0002" }));
    expect(text.calculator).toBeUndefined();
    expect(notes).toEqual([
      expect.stringContaining("without a calculator tag"),
    ]);
  });

  it("does not look for a tag in ELAR", () => {
    const { text, notes } = convertTsiRecord(
      one({ id: "dddd0003", test: "ELAR" }),
    );
    expect(text.calculator).toBeUndefined();
    expect(notes).toEqual([]);
  });

  it("plans a paint-over of the tag in the question picture only", () => {
    const layout = page({ id: "dddd0004", stem: ["How many? [basic]"] });
    const [record] = indexPaaExport("t.pdf", [layout]);
    const plans = planCrops(record, [layout], "en", {
      maskPhrases: CALCULATOR_TAG_PHRASES,
    });
    expect(plans.find((p) => p.kind === "question")?.mask).toHaveLength(1);
    expect(plans.find((p) => p.kind === "rationale")?.mask).toBeUndefined();
    expect(plans[0].alt).toContain("Question dddd0004");
    // Without the option nothing is painted.
    expect(planCrops(record, [layout], "en")[0].mask).toBeUndefined();
  });

  it("paints the tag's pixels white and leaves the rest alone", () => {
    const image: RasterImage = {
      width: 10,
      height: 10,
      data: new Uint8ClampedArray(10 * 10 * 4).fill(0),
    };
    const painted = paintOver(image, { x0: 0, y0: 0, x1: 10, y1: 10 }, [
      { x0: 4, y0: 4, x1: 6, y1: 6 },
    ]);
    const pixel = (x: number, y: number) => painted.data[(y * 10 + x) * 4];
    expect(pixel(4, 4)).toBe(255);
    expect(pixel(5, 5)).toBe(255);
    // The character just left of the tag keeps its pixels.
    expect(pixel(3, 5)).toBe(0);
    expect(pixel(0, 0)).toBe(0);
    // The input is not changed.
    expect(image.data[(5 * 10 + 5) * 4]).toBe(0);
  });
});

const sentence = (n: number) =>
  `This is line ${n} of a synthetic reading that uses ordinary words to take up some space.`;
const small = (text: string): Line => ({ text, size: 6.5 });
const INSTRUCTION =
  "Read the passage(s) below and then choose the best answer to each question. Answer the question on the basis of what is stated or implied in the";

describe("withoutInstruction", () => {
  it("removes a wrapped instruction up to the end of its sentence", () => {
    const record = one({
      id: "eeee0001",
      stem: [INSTRUCTION, "passage(s).", "The real question?"],
    });
    expect(withoutInstruction(record).stemLines).toEqual([
      "The real question?",
    ]);
    expect(withoutInstruction(record).stemHeights).toHaveLength(1);
  });

  it("leaves a stem without an instruction alone", () => {
    const record = one({ id: "eeee0002", stem: ["Just a question?"] });
    expect(withoutInstruction(record)).toBe(record);
  });
});

describe("reading sets", () => {
  const set = (id: string, lines: number[], question: string): Spec => ({
    id,
    test: "ELAR",
    stem: [
      INSTRUCTION,
      "passage(s).",
      ...lines.map(sentence).map(small),
      question,
    ],
  });

  it("groups the questions of one reading and keeps neighbouring readings apart", () => {
    // Every question repeats the instruction, which must not join two readings.
    const found: PaaRecord[] = records(
      set("s1", [1, 2, 3], "First question?"),
      set("s2", [1, 2, 3], "Second question?"),
      set("s3", [4, 5, 6], "Third question?"),
      set("s4", [4, 5, 6], "Fourth question?"),
    );
    const groups = groupTsiPassages(found);
    expect(groups.get("s1")?.id).toBe(groups.get("s2")?.id);
    expect(groups.get("s3")?.id).toBe(groups.get("s4")?.id);
    expect(groups.get("s1")?.id).not.toBe(groups.get("s3")?.id);
    expect(groups.get("s1")?.id.startsWith("tsi-g-")).toBe(true);
    expect(groups.get("s1")?.passage).toBe([1, 2, 3].map(sentence).join("\n"));
    const second = convertTsiRecord(found[1], groups.get("s2"));
    expect(second.text.stem).toBe("Second question?");
    expect(second.text.passageGroup).toBe(groups.get("s1")?.id);
  });

  it.each([6.5, 7.6])(
    "separates a reading that belongs to one question by its smaller type (%s pt)",
    (size) => {
      const [record] = records({
        id: "t2",
        test: "ELAR",
        stem: [
          INSTRUCTION,
          "passage(s).",
          ...[1, 2].map(sentence).map((text) => ({ text, size })),
          "Which is right?",
        ],
      });
      const { text } = convertTsiRecord(record, undefined);
      expect(text.passage).toBe([1, 2].map(sentence).join("\n"));
      expect(text.stem).toBe("Which is right?");
    },
  );

  it("separates a reading that belongs to one question by its smaller type", () => {
    const [record] = records(set("t1", [1, 2], "Which is right?"));
    const { text } = convertTsiRecord(record, undefined);
    expect(text.passage).toBe([1, 2].map(sentence).join("\n"));
    expect(text.stem).toBe("Which is right?");
    expect(text.passageGroup).toBeUndefined();
  });

  it("never takes small type in a Math question for a reading", () => {
    const { text } = convertTsiRecord(
      one({
        id: "u2",
        stem: [
          "If is the least of two odd integers, what is their sum? [basic]",
          small("n"),
        ],
      }),
    );
    expect(text.passage).toBeUndefined();
    // The stray math fragment stays in the approximate text; it is not a reading.
    expect(text.stem).toBe(
      "If is the least of two odd integers, what is their sum? n",
    );
  });

  it("gives a question with no reading no passage", () => {
    const { text } = convertTsiRecord(
      one({ id: "u1", stem: ["Plain question?"] }),
    );
    expect(text.passage).toBeUndefined();
    expect(text.stem).toBe("Plain question?");
  });
});

/** Fake PDF readers, keyed by the file's own bytes (as in the PAA tests). */
function fixtures(pdfs: Record<string, Spec[]>) {
  const readers = new Map<string, ExportReader>();
  const stored = new Map<string, Blob>();
  const files: ReadableFile[] = [];
  for (const [name, specs] of Object.entries(pdfs)) {
    const pages = specs.map(page);
    readers.set(name, {
      pageCount: pages.length,
      layout: async (n) => pages[n - 1],
      renderer: {
        async render(pageNumber, rect): Promise<RasterImage> {
          const width = 20;
          const height = 40;
          const data = new Uint8ClampedArray(width * height * 4).fill(255);
          const row = Math.floor(rect.y0 + pageNumber) % 30;
          for (let x = 0; x < width; x++) data[(row * width + x) * 4] = 0;
          return { width, height, data };
        },
      },
      close: async () => {},
    });
    const bytes = new TextEncoder().encode(name);
    files.push({
      name,
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer.slice(0) as ArrayBuffer,
    });
  }
  return {
    files,
    stored,
    deps: {
      open: async (data: Uint8Array) =>
        readers.get(new TextDecoder().decode(data))!,
      store: {
        encode: async (image: RasterImage) =>
          new Blob([new Uint8Array(image.data.buffer, 0, image.data.length)], {
            type: "image/webp",
          }),
        put: async (key: string, blob: Blob) => void stored.set(key, blob),
      },
      // Pages here carry no access code (see paa.test.ts for the check itself).
      access: async () => true,
    },
  };
}

describe("prepareTsiLibrary", () => {
  it("prepares a library that passes the importer", async () => {
    const { files, deps, stored } = fixtures({
      "ELAR.pdf": [
        { ...set("r0000001", "First?"), source: OFFICIAL },
        set("r0000002", "Second?"),
      ],
      "Math.pdf": [
        { id: "m0000001", stem: ["Add. [basic]"] },
        { id: "m0000002", stem: ["Graph it. [graphing]"], source: OFFICIAL },
      ],
    });
    const prepared = await prepareTsiLibrary(files, {}, deps);
    expect(prepared.report.quarantined).toEqual([]);
    expect(prepared.report.importedQuestions).toBe(4);
    expect(prepared.report.counts.origin).toEqual({ official: 2, original: 2 });
    expect(prepared.report.counts.calculator).toMatchObject({
      basic: 1,
      graphing: 1,
    });
    const questions = parseQuestions(JSON.parse(prepared.questionsJson));
    expect(questions.map((q) => q.id)).toEqual([
      "tsi-r0000001",
      "tsi-r0000002",
      "tsi-m0000001",
      "tsi-m0000002",
    ]);
    expect(questions.every((q) => q.assessment === "TSI")).toBe(true);
    expect(questions.every((q) => q.testStatus === "unknown")).toBe(true);
    expect(questions.map((q) => q.origin)).toEqual([
      "official",
      "original",
      "original",
      "official",
    ]);
    expect(questions[2].calculator).toBe("basic");
    expect(questions[0].passageGroup).toBe(questions[1].passageGroup);
    expect(questions[0].passageGroup).toBeDefined();
    expect(questions[2].document?.question.length).toBeGreaterThan(0);
    expect(stored.size).toBeGreaterThan(0);
    expect(prepared.manifest.label).toMatch(/^TSI/);
  });

  it("reports an item with no Source line as a warning", async () => {
    const { files, deps } = fixtures({
      "ELAR.pdf": [{ id: "w0000001", test: "ELAR", source: false }],
    });
    const prepared = await prepareTsiLibrary(files, {}, deps);
    expect(prepared.report.warnings).toEqual([
      expect.stringContaining("w0000001: no recognizable Source line"),
    ]);
    expect(parseQuestions(JSON.parse(prepared.questionsJson))[0].origin).toBe(
      "official",
    );
  });

  it("sets aside PDFs for other tests and says so when none is a TSI export", async () => {
    const { files, deps } = fixtures({
      "paa.pdf": [{ id: "paa00001", assessment: "PAA" }],
      "carta.pdf": [{ id: "x", unrelated: true }],
      "tsi.pdf": [{ id: "tsi00001" }],
    });
    const prepared = await prepareTsiLibrary(files, {}, deps);
    expect(prepared.report.importedQuestions).toBe(1);
    expect(prepared.report.ignored).toEqual(["carta.pdf", "paa.pdf"]);
    const none = fixtures({ "carta.pdf": [{ id: "x", unrelated: true }] });
    await expect(prepareTsiLibrary(none.files, {}, none.deps)).rejects.toThrow(
      "None of the PDFs is a TSIA2 question export",
    );
  });

  it("uses the first copy of an ID seen twice and leaves out one whose label disagrees", async () => {
    const { files, deps } = fixtures({
      "a.pdf": [
        { id: "dup00001", source: OFFICIAL },
        { id: "dup00002", source: OFFICIAL },
      ],
      "b.pdf": [
        { id: "dup00001", source: OFFICIAL },
        { id: "dup00002", source: ORIGINAL },
      ],
    });
    const prepared = await prepareTsiLibrary(files, {}, deps);
    expect(prepared.report.importedQuestions).toBe(1);
    expect(prepared.report.quarantined).toMatchObject([
      { sourceId: "dup00002", reason: expect.stringContaining("conflicting") },
    ]);
  });

  function set(id: string, question: string): Spec {
    return {
      id,
      test: "ELAR",
      stem: [
        INSTRUCTION,
        "passage(s).",
        ...[1, 2, 3].map(sentence).map(small),
        question,
      ],
    };
  }
});
