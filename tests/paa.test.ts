import { describe, expect, it } from "vitest";
import { layoutPage, type TextFragment } from "../src/importing/pdf/layout.ts";
import {
  choiceLabels,
  convertPaaRecord,
  groupPassages,
  indexPaaExport,
  type PaaRecord,
} from "../src/importing/pdf/paa.ts";
import { planCrops } from "../src/importing/pdf/crops.ts";
import {
  type ExportReader,
  type ReadableFile,
} from "../src/importing/pdf/prepare.ts";
import { preparePaaLibrary } from "../src/importing/pdf/preparePaa.ts";
import { parseQuestions } from "../src/importing/json.ts";
import type { RasterImage } from "../src/importing/pdf/raster.ts";

const run = (
  text: string,
  x: number,
  baseline: number,
  size = 8.6,
  endsLine = true,
): TextFragment => ({
  text,
  x,
  baseline,
  width: text.length * size * 0.5,
  size,
  endsLine,
});

interface Spec {
  id: string;
  test?: string;
  assessment?: string;
  domain?: string;
  /** A long skill name wraps onto several lines inside its column, as printed. */
  skill?: string | string[];
  difficulty?: string;
  /** Lines of the question, between the heading and the choices. */
  stem?: string[];
  /** Choice lines; false means a grid-in with no Answer section. */
  options?: string[] | false;
  key?: string;
  rationale?: string[];
  /** Long readings are scaled to fit one page: the header table sits higher. */
  scaled?: boolean;
}

/** A synthetic page in the PAA export's layout (original text, no real questions). */
function page(spec: Spec) {
  const header = spec.scaled ? 52 : 65.3;
  const data = spec.scaled ? 71 : 90.8;
  const heading = spec.scaled ? 100 : 135.75;
  let y = heading + 22;
  const stem = (spec.stem ?? ["Un enunciado sintético."]).map((line) => {
    const fragment = run(line, 18, y);
    y += 12;
    return fragment;
  });
  y += 12;
  const answerLabel = run("Answer", 18, y, 7.89);
  y += 22;
  const options =
    spec.options === false
      ? []
      : (spec.options ?? ["A. uno", "B. dos", "C. tres", "D. cuatro"]).map(
          (line) => {
            const fragment = run(line, 18, y);
            y += 22;
            return fragment;
          },
        );
  const key = run(spec.key ?? "Correct Answer: B", 18, y + 6, 7.89);
  const rationaleLabel = run("Rationale", 18, y + 36, 7.89);
  const rationale = (spec.rationale ?? ["Una explicación sintética."]).map(
    (line, i) => run(line, 18, y + 60 + i * 12),
  );
  return layoutPage(
    [
      run(`Question ID: ${spec.id}`, 18, spec.scaled ? 24 : 33, 12),
      run("Assessment", 24.8, header, 8.76),
      run("Test", 139.6, header, 8.76),
      run("Domain", 254.5, header, 8.76),
      run("Skill", 369.4, header, 8.76),
      run("Difficulty", 484.4, header, 8.76),
      run(spec.assessment ?? "PAA", 24.8, data, 8.76),
      run(spec.test ?? "Matemáticas", 140, data, 8.76),
      run(spec.domain ?? "Álgebra", 254.9, data, 8.76),
      ...[spec.skill ?? "Ecuaciones"]
        .flat()
        .map((line, i) => run(line, 369.8, data + i * 11, 8.76)),
      run(spec.difficulty ?? "Medium", 484.7, data, 8.76),
      run("Question", 18, heading, 7.89),
      ...stem,
      ...(spec.options === false ? [] : [answerLabel]),
      ...options,
      key,
      rationaleLabel,
      ...rationale,
    ],
    792,
    612,
  );
}

const records = (...specs: Spec[]) =>
  indexPaaExport("banco.pdf", specs.map(page));

describe("indexPaaExport", () => {
  it("reads metadata, stem, choices and rationale by position", () => {
    const [record] = records({
      id: "abc12345",
      stem: ["La solución de la ecuación es"],
    });
    expect(record).toMatchObject({
      id: "abc12345",
      assessment: "PAA",
      section: "Matemáticas",
      domain: "Álgebra",
      skill: "Ecuaciones",
      difficulty: "Medium",
      stemLines: ["La solución de la ecuación es"],
      optionLines: ["A. uno", "B. dos", "C. tres", "D. cuatro"],
      rationaleLines: ["Una explicación sintética."],
    });
  });

  it("finds the metadata table on pages scaled to fit, where fixed coordinates miss it", () => {
    const [record] = records({
      id: "scaled01",
      test: "Lectura",
      domain: "Vocabulario en contexto",
      skill: ["Significado de una palabra", "en contexto"],
      scaled: true,
    });
    expect(record.section).toBe("Lectura");
    expect(record.domain).toBe("Vocabulario en contexto");
    expect(record.skill).toBe("Significado de una palabra en contexto");
    expect(record.difficulty).toBe("Medium");
  });

  it("assigns continuation pages to the question they follow", () => {
    const pages = [page({ id: "first001" }), page({ id: "second02" })];
    const continuation = layoutPage([run("Sigue la explicación.", 18, 60)], 792, 612);
    const found = indexPaaExport("x.pdf", [pages[0], continuation, pages[1]]);
    expect(found.map((r) => [r.id, r.pages])).toEqual([
      ["first001", [1, 2]],
      ["second02", [3]],
    ]);
  });
});

describe("convertPaaRecord", () => {
  it("converts a multiple-choice question to a PAA question", () => {
    const [record] = records({ id: "ABC12345", key: "Correct Answer: C" });
    const question = convertPaaRecord(record);
    expect(question).toMatchObject({
      id: "paa-abc12345",
      assessment: "PAA",
      sourceId: "abc12345",
      section: "matematicas",
      difficulty: "medium",
      answer: { type: "choice", value: "C" },
    });
    expect(question.choices?.map((c) => c.id)).toEqual(["A", "B", "C", "D"]);
  });

  it("reads grid-in questions that have no Answer section", () => {
    const [record] = records({
      id: "grid0001",
      options: false,
      key: "Correct Answer: 15/2, 7.5",
    });
    expect(record.optionLines).toEqual([]);
    expect(convertPaaRecord(record)).toMatchObject({
      answer: { type: "numeric", accepted: ["15/2", "7.5"] },
    });
  });

  it("recognizes every test name, with or without accents", () => {
    for (const [test, section] of [
      ["Lectura", "lectura"],
      ["Redacción", "redaccion"],
      ["Redaccion", "redaccion"],
      ["Matemáticas", "matematicas"],
      ["Inglés", "ingles"],
    ])
      expect(
        convertPaaRecord(records({ id: "aaaa0001", test })[0]).section,
      ).toBe(section);
  });

  it("rejects another assessment and unknown tests instead of guessing", () => {
    expect(() =>
      convertPaaRecord(records({ id: "aaaa0002", assessment: "SAT" })[0]),
    ).toThrow("expected PAA");
    expect(() =>
      convertPaaRecord(records({ id: "aaaa0003", test: "Física" })[0]),
    ).toThrow("Missing or unrecognized metadata");
  });

  it("keeps the first line of a stem even when a margin line number sits beside it", () => {
    const [record] = records({
      id: "aaaa0004",
      stem: ["5", "Una pregunta con número de línea."],
    });
    expect(convertPaaRecord(record).stem).toBe(
      "Una pregunta con número de línea.",
    );
  });

  it("finds all four labels when image choices sit two to a row", () => {
    expect(choiceLabels(["A. B.", "C. D."])).toEqual(["A", "B", "C", "D"]);
    // A sentence that ends "lectura A." is not a label.
    expect(
      choiceLabels([
        "A. Se dice lo mismo en la lectura A.",
        "B. Se refuta la lectura A.",
        "C. Se amplía.",
        "D. Se resume.",
      ]),
    ).toEqual(["A", "B", "C", "D"]);
    expect(() =>
      convertPaaRecord(
        records({ id: "aaaa0005", options: ["A. uno", "B. dos"] })[0],
      ),
    ).toThrow("Expected options A-D");
  });

  it("plans question and explanation crops from the same labels", () => {
    const [record] = records({ id: "crop0001" });
    const plans = planCrops(record, [page({ id: "crop0001" })], "es");
    expect(plans.map((p) => p.kind)).toEqual(["question", "rationale"]);
    expect(plans[0].alt).toContain("Pregunta crop0001");
  });
});

const sentence = (n: number) =>
  `Esta es la línea ${n} de una lectura sintética que usa palabras corrientes para ocupar espacio.`;
const reading = [1, 2, 3].map(sentence);

describe("groupPassages", () => {
  it("groups neighbouring questions that share a reading", () => {
    const found: PaaRecord[] = records(
      { id: "q1", test: "Lectura", stem: ["5", ...reading, "¿Pregunta uno?"] },
      { id: "q2", test: "Lectura", stem: ["10", ...reading, "¿Pregunta dos?"] },
      { id: "q3", test: "Lectura", stem: [...reading, "¿Pregunta tres?"] },
      {
        id: "q4",
        test: "Lectura",
        stem: [4, 5, 6].map(sentence).concat(["¿Otra lectura?"]),
      },
      { id: "q5", test: "Matemáticas", stem: ["Un problema suelto."] },
    );
    const groups = groupPassages(found);
    expect(groups.get("q1")?.id).toBeDefined();
    expect(groups.get("q1")?.id).toBe(groups.get("q2")?.id);
    expect(groups.get("q1")?.id).toBe(groups.get("q3")?.id);
    expect(groups.has("q4")).toBe(false);
    expect(groups.has("q5")).toBe(false);
    // Margin line numbers are not part of the reading.
    expect(groups.get("q1")?.passage).toBe(reading.join("\n"));
    const second = convertPaaRecord(found[1], groups.get("q2"));
    expect(second.stem).toBe("¿Pregunta dos?");
    expect(second.passage).toBe(reading.join("\n"));
    expect(second.passageGroup).toBe(groups.get("q1")?.id);
  });

  it("does not treat a quoted previous question as part of the reading", () => {
    const found = records(
      { id: "p1", test: "Lectura", stem: [...reading, "Primera pregunta"] },
      { id: "p2", test: "Lectura", stem: [...reading, "Segunda pregunta"] },
      {
        id: "p3",
        test: "Lectura",
        stem: [
          ...reading,
          "Pregunta anterior: Segunda pregunta",
          "¿Qué evidencia lo apoya?",
        ],
      },
    );
    const group = groupPassages(found).get("p3")!;
    expect(group.passage).toBe(reading.join("\n"));
    expect(convertPaaRecord(found[2], group).stem).toContain(
      "Pregunta anterior: Segunda pregunta",
    );
  });

  it("names a reading by its text, so a rerun gives the same group", () => {
    const make = () =>
      groupPassages(
        records(
          { id: "a1", test: "Lectura", stem: [...reading, "Uno"] },
          { id: "a2", test: "Lectura", stem: [...reading, "Dos"] },
        ),
      ).get("a1")!.id;
    expect(make()).toBe(make());
  });

  it("needs real shared text: two short stems that look alike are not a reading", () => {
    const found = records(
      { id: "s1", stem: ["Resuelve la ecuación."] },
      { id: "s2", stem: ["Resuelve la ecuación."] },
    );
    expect(groupPassages(found).size).toBe(0);
  });
});

/** Fake PDF readers, keyed by the file's own bytes (as in the SAT tests). */
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
    },
  };
}

describe("preparePaaLibrary", () => {
  it("prepares a library that passes the importer, with no file names or pairs required", async () => {
    const { files, deps, stored } = fixtures({
      "cualquier nombre.pdf": [
        { id: "r0000001", test: "Lectura", stem: [...reading, "Primera"] },
        { id: "r0000002", test: "Lectura", stem: [...reading, "Segunda"] },
        { id: "g0000001", options: false, key: "Correct Answer: 3" },
        { id: "m0000001" },
      ],
    });
    const prepared = await preparePaaLibrary(files, {}, deps);
    expect(prepared.report.quarantined).toEqual([]);
    expect(prepared.report.importedQuestions).toBe(4);
    expect(prepared.manifest.questionCount).toBe(4);
    const questions = parseQuestions(JSON.parse(prepared.questionsJson));
    expect(questions.map((q) => q.id)).toEqual([
      "paa-r0000001",
      "paa-r0000002",
      "paa-g0000001",
      "paa-m0000001",
    ]);
    expect(questions.every((q) => q.assessment === "PAA")).toBe(true);
    // No active/inactive concept in the PAA.
    expect(questions.every((q) => q.testStatus === "unknown")).toBe(true);
    expect(questions[0].passageGroup).toBe(questions[1].passageGroup);
    expect(questions[2].answer).toEqual({ type: "numeric", accepted: ["3"] });
    expect(questions[3].document?.question.length).toBeGreaterThan(0);
    expect(stored.size).toBeGreaterThan(0);
    for (const asset of prepared.manifest.assets)
      expect(stored.has(asset)).toBe(true);
  });

  it("gives the same revision for the same PDFs, whatever order they were chosen in", async () => {
    const pdfs = {
      "b.pdf": [{ id: "b0000001" }],
      "a.pdf": [{ id: "a0000001" }],
    };
    const first = fixtures(pdfs);
    const second = fixtures(pdfs);
    const one = await preparePaaLibrary(first.files, {}, first.deps);
    const two = await preparePaaLibrary(
      [...second.files].reverse(),
      {},
      second.deps,
    );
    expect(one.manifest.revision).toBe(two.manifest.revision);
  });

  it("uses the first copy of an ID seen in two files and leaves out conflicting ones", async () => {
    const { files, deps } = fixtures({
      "a.pdf": [{ id: "dup00001", key: "Correct Answer: A" }, { id: "dup00002" }],
      "b.pdf": [
        { id: "dup00001", key: "Correct Answer: A" },
        { id: "dup00002", key: "Correct Answer: D" },
      ],
    });
    const prepared = await preparePaaLibrary(files, {}, deps);
    expect(prepared.report.importedQuestions).toBe(1);
    expect(prepared.report.quarantined).toMatchObject([
      { sourceId: "dup00002", reason: expect.stringContaining("conflicting") },
    ]);
  });

  it("quarantines a question from another assessment and still imports the rest", async () => {
    const { files, deps } = fixtures({
      "mixed.pdf": [{ id: "sat00001", assessment: "SAT" }, { id: "paa00001" }],
    });
    const prepared = await preparePaaLibrary(files, {}, deps);
    expect(prepared.report.importedQuestions).toBe(1);
    expect(prepared.report.quarantined[0]).toMatchObject({
      sourceId: "sat00001",
      reason: expect.stringContaining("expected PAA"),
    });
  });

  it("refuses a PDF with no usable question", async () => {
    const { files, deps } = fixtures({
      "bad.pdf": [{ id: "bad00001", test: "Física" }],
    });
    await expect(preparePaaLibrary(files, {}, deps)).rejects.toThrow(
      "No se pudo preparar ninguna pregunta",
    );
  });
});
