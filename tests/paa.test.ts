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
import {
  prepareSatLibrary,
  preparePaaLibrary,
} from "../src/importing/pdf/preparePaa.ts";
import { accessChecker } from "../src/importing/pdf/access.ts";
import { sha256Hex } from "../src/importing/pdf/panels.ts";
import { parseQuestions } from "../src/importing/json.ts";
import type { RasterImage } from "../src/importing/pdf/raster.ts";
import type { Assessment } from "../src/core/model.ts";

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
  /** A page of some other document: no question ID, no metadata table. */
  unrelated?: boolean;
  /** The access code printed bottom left after "Ref.". */
  ref?: string;
  /** The SAT's ACTIVE / INACTIVE badge, top right. */
  badge?: "ACTIVE" | "INACTIVE";
}

/** A synthetic page in the PAA export's layout (original text, no real questions). */
function page(spec: Spec) {
  if (spec.unrelated)
    return layoutPage([run("Una carta cualquiera.", 18, 40, 12)], 792, 612);
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
      ...(spec.ref ? [run("Ref. " + spec.ref, 28, 777, 5)] : []),
      ...(spec.badge ? [run(spec.badge, 511, 33, 9)] : []),
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
    const continuation = layoutPage(
      [run("Sigue la explicación.", 18, 60)],
      792,
      612,
    );
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
function fixtures(
  pdfs: Record<string, Spec[]>,
  access: (
    assessment: Assessment,
    token?: string,
  ) => Promise<boolean> = async () => true,
) {
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
      access,
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
      "a.pdf": [
        { id: "dup00001", key: "Correct Answer: A" },
        { id: "dup00002" },
      ],
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

  it("sets aside PDFs that are not PAA question exports and still imports the rest", async () => {
    const { files, deps } = fixtures({
      "carta.pdf": [
        { id: "x", unrelated: true },
        { id: "y", unrelated: true },
      ],
      "banco sat.pdf": [{ id: "sat00001", assessment: "SAT" }],
      "banco.pdf": [{ id: "paa00001" }, { id: "paa00002" }],
    });
    const prepared = await preparePaaLibrary(files, {}, deps);
    expect(prepared.report.importedQuestions).toBe(2);
    expect(prepared.report.ignored).toEqual(["banco sat.pdf", "carta.pdf"]);
    expect(prepared.report.quarantined).toEqual([]);
    // Only the file that gave questions is listed as read.
    expect(prepared.report.files.map((f) => f.filename)).toEqual(["banco.pdf"]);
  });

  it("says so when none of the chosen PDFs is a PAA export", async () => {
    const { files, deps } = fixtures({
      "carta.pdf": [{ id: "x", unrelated: true }],
    });
    await expect(preparePaaLibrary(files, {}, deps)).rejects.toThrow(
      "Ninguno de los PDF es una exportación de preguntas de la PAA",
    );
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

describe("access codes and the SAT badge", () => {
  // Test-only codes: the real ones are never in this repository.
  const CODES = {
    PAA: "PAA-TEST-0000-0000-0001",
    SAT: "SAT-TEST-0000-0000-0002",
  };
  const check = async () =>
    accessChecker({
      PAA: await sha256Hex(new TextEncoder().encode(CODES.PAA)),
      SAT: await sha256Hex(new TextEncoder().encode(CODES.SAT)),
    });

  it("reads the access line and the badge by position, and keeps them out of the rationale", () => {
    const [record] = records({
      id: "abc12345",
      assessment: "SAT",
      test: "Math",
      ref: CODES.SAT,
      badge: "INACTIVE",
      rationale: ["Una explicación."],
    });
    expect(record.ref).toBe(CODES.SAT);
    expect(record.badge).toBe("inactive");
    expect(record.rationaleLines).toEqual(["Una explicación."]);
    const [plain] = records({ id: "abc12346" });
    expect(plain.ref).toBeUndefined();
    expect(plain.badge).toBeUndefined();
  });

  it("accepts a code only for its own test, in its exact shape", async () => {
    const ok = await check();
    expect(await ok("PAA", CODES.PAA)).toBe(true);
    expect(await ok("SAT", CODES.PAA)).toBe(false);
    expect(await ok("PAA", CODES.SAT)).toBe(false);
    expect(await ok("PAA", "PAA-TEST-0000-0000-0002")).toBe(false);
    expect(await ok("PAA", "paa-test-0000-0000-0001")).toBe(false);
    expect(await ok("PAA", "")).toBe(false);
    expect(await ok("PAA", undefined)).toBe(false);
    // TSI has no hash in this checker, so nothing passes.
    expect(await ok("TSI", "TSI-TEST-0000-0000-0003")).toBe(false);
  });

  it("imports pages with the code, and lists the others as left out", async () => {
    const { files, deps } = fixtures(
      {
        "banco.pdf": [
          { id: "ok000001", ref: CODES.PAA },
          { id: "no000002" },
          { id: "bad00003", ref: "PAA-TEST-0000-0000-0009" },
          { id: "sat00004", ref: CODES.SAT },
          { id: "ok000005", ref: CODES.PAA },
        ],
      },
      await check(),
    );
    const prepared = await preparePaaLibrary(files, {}, deps);
    expect(prepared.report.importedQuestions).toBe(2);
    expect(prepared.report.quarantined.map((q) => q.sourceId).sort()).toEqual([
      "bad00003",
      "no000002",
      "sat00004",
    ]);
    expect(prepared.report.quarantined[0].reason).toMatch(/código de acceso/);
    const ids = parseQuestions(JSON.parse(prepared.questionsJson)).map(
      (q) => q.id,
    );
    expect(ids).toEqual(["paa-ok000001", "paa-ok000005"]);
  });

  it("refuses a PDF where no page carries the code, and says why", async () => {
    const { files, deps } = fixtures(
      { "banco.pdf": [{ id: "a0000001" }, { id: "a0000002" }] },
      await check(),
    );
    await expect(preparePaaLibrary(files, {}, deps)).rejects.toThrow(
      /código de acceso de la PAA.*banco\.pdf/,
    );
  });

  it("takes the SAT from one file, with its status from the badge", async () => {
    const { files, deps } = fixtures(
      {
        "cualquier nombre.pdf": [
          {
            id: "act00001",
            assessment: "SAT",
            test: "Math",
            domain: "Algebra",
            skill: "Linear functions",
            ref: CODES.SAT,
            badge: "ACTIVE",
          },
          {
            id: "ina00002",
            assessment: "SAT",
            test: "Reading and Writing",
            domain: "Craft and Structure",
            skill: "Words in Context",
            ref: CODES.SAT,
            badge: "INACTIVE",
          },
          {
            id: "unk00003",
            assessment: "SAT",
            test: "Math",
            ref: CODES.SAT,
          },
          { id: "paa00004", ref: CODES.PAA },
        ],
      },
      await check(),
    );
    const prepared = await prepareSatLibrary(files, {}, deps);
    const questions = parseQuestions(JSON.parse(prepared.questionsJson));
    // The earlier SAT reader's IDs and source, so old imports are recognised.
    expect(questions.map((q) => [q.id, q.testStatus, q.section])).toEqual([
      ["cb-act00001", "active", "math"],
      ["cb-ina00002", "inactive", "reading-writing"],
      ["cb-unk00003", "unknown", "math"],
    ]);
    expect(
      questions.every((q) => q.source === "College Board SAT question bank"),
    ).toBe(true);
    // The PAA question in the same file is not an SAT question.
    expect(prepared.report.quarantined.map((q) => q.sourceId)).toEqual([
      "paa00004",
    ]);
  });

  it("leaves out an ID printed ACTIVE in one place and INACTIVE in another", async () => {
    const sat = { assessment: "SAT", test: "Math", ref: CODES.SAT } as const;
    const { files, deps } = fixtures(
      {
        "a.pdf": [{ id: "dup00001", ...sat, badge: "ACTIVE" }],
        "b.pdf": [
          { id: "dup00001", ...sat, badge: "INACTIVE" },
          { id: "fine0002", ...sat, badge: "ACTIVE" },
        ],
      },
      await check(),
    );
    const prepared = await prepareSatLibrary(files, {}, deps);
    expect(prepared.report.quarantined.map((q) => q.sourceId)).toEqual([
      "dup00001",
    ]);
    expect(prepared.report.importedQuestions).toBe(1);
  });

  it("ends the explanation image above the access line", () => {
    const [record] = records({ id: "crop0001", ref: CODES.PAA });
    const layout = page({ id: "crop0001", ref: CODES.PAA });
    const plans = planCrops(record, [layout], "es");
    const explanation = plans.find((plan) => plan.kind === "rationale")!;
    const line = layout.lines.find((l) => l.text.startsWith("Ref."))!;
    expect(explanation.rect.y1).toBeLessThan(line.words[0].y0);
    const without = planCrops(
      records({ id: "crop0002" })[0],
      [page({ id: "crop0002" })],
      "es",
    ).find((plan) => plan.kind === "rationale")!;
    expect(without.rect.y1).toBe(792);
  });
});
