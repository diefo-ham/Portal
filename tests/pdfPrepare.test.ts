import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { layoutPage, type TextFragment } from "../src/importing/pdf/layout.ts";
import {
  assignExports,
  EXPORT_NAMES,
  parseOverrides,
  prepareLibrary,
  type ExportName,
  type ExportReader,
  type ReadableFile,
} from "../src/importing/pdf/prepare.ts";
import { parseQuestions } from "../src/importing/json.ts";
import type { RasterImage } from "../src/importing/pdf/raster.ts";

const run = (
  text: string,
  x: number,
  baseline: number,
  size = 9.29,
  width = text.length * size * 0.5,
): TextFragment => ({ text, x, baseline, width, size, endsLine: true });

interface Spec {
  id: string;
  section?: string;
  /** Printed answer key line, or undefined for none. */
  key?: string;
  options?: boolean;
  skill?: string;
  difficulty?: string;
}

/** One synthetic page in the export's layout. */
function page(spec: Spec) {
  const fragments = [
    run(`Question ID: ${spec.id}`, 18, 33, 1.35, 120),
    run("Assessment", 24.8, 65.3, 8.76, 50),
    run("Test", 139.6, 65.3, 8.76, 18),
    run("Domain", 254.5, 65.3, 8.76, 31),
    run("Skill", 369.4, 65.3, 8.76, 17),
    run("Difficulty", 484.4, 65.3, 8.76, 37),
    run("SAT", 24.8, 90.8, 8.76, 17),
    run(spec.section ?? "Math", 140, 90.8, 8.76, 30),
    run("Algebra", 254.9, 90.8, 8.76, 30),
    run(spec.skill ?? "Linear functions", 369.8, 90.8, 8.76, 60),
    run(spec.difficulty ?? "Easy", 484.7, 90.8, 8.76, 19),
    run("Question", 18, 135.75, 7.89, 36.23),
    run("A synthetic stem.", 18, 180),
    run("Answer", 18, 210, 7.89, 30),
    ...(spec.options === false
      ? []
      : ["A. one", "B. two", "C. three", "D. four"].map((text, i) =>
          run(text, 18, 232 + i * 22),
        )),
    ...(spec.key === undefined ? [] : [run(spec.key, 18, 354.75, 7.89, 70)]),
    run("Rationale", 18, 384, 7.89, 38),
    run("A synthetic rationale.", 18, 410),
  ];
  return layoutPage(fragments, 792, 612);
}

/** Pages of every fake PDF, by file content (the file's own name). */
function fixtures(pdfs: Record<ExportName, Spec[]>) {
  const readers = new Map<string, ExportReader>();
  const renders: string[] = [];
  const stored = new Map<string, Blob>();
  const files = {} as Record<ExportName, ReadableFile>;
  for (const name of EXPORT_NAMES) {
    const pages = pdfs[name].map(page);
    readers.set(name, {
      pageCount: pages.length,
      layout: async (n) => pages[n - 1],
      renderer: {
        async render(pageNumber, rect): Promise<RasterImage> {
          renders.push(`${name}:${pageNumber}`);
          const width = 20;
          const height = 40;
          const data = new Uint8ClampedArray(width * height * 4).fill(255);
          // A black row whose position depends on the crop, so images differ by crop.
          const row = Math.floor(rect.y0) % 30;
          for (let x = 0; x < width; x++) data[(row * width + x) * 4] = 0;
          return { width, height, data };
        },
      },
      close: async () => {},
    });
    const bytes = new TextEncoder().encode(name);
    files[name] = {
      name: `${name}.pdf`,
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer.slice(0) as ArrayBuffer,
    };
  }
  return {
    files,
    renders,
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

const standard = (): Record<ExportName, Spec[]> => ({
  read_write_inactive: [
    {
      id: "rw000001",
      section: "Reading and Writing",
      key: "Correct Answer: B",
    },
  ],
  read_write_active: [
    {
      id: "rw000002",
      section: "Reading and Writing",
      key: "Correct Answer: D",
    },
  ],
  math_inactive: [
    { id: "m0000001", key: "Correct Answer: 12", options: false },
  ],
  math_active: [{ id: "m0000002", key: "Correct Answer: A" }],
});

describe("assignExports", () => {
  it("matches the four expected names and tolerates browser copies", () => {
    const names = [
      "Math_Active (1).pdf",
      "math inactive.pdf",
      "read-write-active.pdf",
      "read_write_inactive.PDF",
      "notes.pdf",
    ];
    const { found, missing, unrecognized } = assignExports(
      names.map((name) => ({ name })),
    );
    expect(Object.keys(found).sort()).toEqual([...EXPORT_NAMES].sort());
    expect(missing).toEqual([]);
    expect(unrecognized).toEqual(["notes.pdf"]);
    expect(assignExports([{ name: "math_active.pdf" }]).missing).toEqual([
      "read_write_inactive",
      "read_write_active",
      "math_inactive",
    ]);
  });
});

describe("parseOverrides", () => {
  it("accepts reviewed exceptions and rejects anything else", () => {
    expect(
      parseOverrides({
        e3bbf2bf: { choiceLabelsVerified: true, warning: "Bullet is D." },
      }),
    ).toEqual({
      e3bbf2bf: { choiceLabelsVerified: true, warning: "Bullet is D." },
    });
    expect(() => parseOverrides([])).toThrow("JSON object");
    expect(() => parseOverrides({ "bad id": {} })).toThrow("valid source ID");
    expect(() => parseOverrides({ abcd1234: "x" })).toThrow(
      "must be an object",
    );
    expect(() =>
      parseOverrides({ abcd1234: { choiceLabelsVerified: "yes" } }),
    ).toThrow("true or false");
    expect(() =>
      parseOverrides({ abcd1234: { warning: "x".repeat(501) } }),
    ).toThrow("at most 500");
  });
});

describe("prepareLibrary", () => {
  it("builds a library the importer accepts, with statuses and provenance", async () => {
    const { files, deps, stored } = fixtures(standard());
    const steps: string[] = [];
    const prepared = await prepareLibrary(
      files,
      { mode: "active-only", progress: (p) => steps.push(p.phase) },
      deps,
    );
    const { manifest, questionsJson, report } = prepared;
    expect(manifest.format).toBe("sat-study-local-library-v1");
    expect(manifest.questionCount).toBe(4);
    expect(manifest.revision).toBe(
      createHash("sha256").update(questionsJson).digest("hex"),
    );
    // Every stored image is listed, and nothing else is.
    expect(manifest.assets).toEqual([...stored.keys()].sort());
    expect(steps).toContain("index");
    expect(steps).toContain("convert");

    const questions = parseQuestions(JSON.parse(questionsJson));
    expect(questions.map((q) => [q.sourceId, q.testStatus])).toEqual([
      ["rw000001", "inactive"],
      ["rw000002", "active"],
      ["m0000001", "inactive"],
      ["m0000002", "active"],
    ]);
    const numeric = questions.find((q) => q.sourceId === "m0000001")!;
    expect(numeric.answer).toEqual({ type: "numeric", accepted: ["12"] });
    expect(numeric.choices).toBeUndefined();
    const choice = questions[0];
    expect(choice.section).toBe("reading-writing");
    expect(choice.answer).toEqual({ type: "choice", value: "B" });
    expect(choice.document?.provenance[0]).toMatchObject({
      filename: "read_write_inactive.pdf",
      sha256: createHash("sha256").update("read_write_inactive").digest("hex"),
      pages: [1],
    });
    expect(choice.document?.question).toHaveLength(1);
    expect(choice.document?.rationale).toHaveLength(1);
    expect(report).toMatchObject({
      activeMode: "active-only",
      uniqueSourceIds: 4,
      importedQuestions: 4,
      quarantined: [],
      counts: {
        section: { math: 2, "reading-writing": 2 },
        testStatus: { inactive: 2, active: 2 },
      },
    });
    expect(report.files.map((f) => f.questions)).toEqual([1, 1, 1, 1]);
  });

  it("tells the active files from the inactive ones without being asked", async () => {
    const { files, deps } = fixtures(standard());
    const { report, questionsJson } = await prepareLibrary(files, {}, deps);
    expect(report.activeMode).toBe("auto");
    expect(report.interpretation).toEqual({
      read_write: "active-only",
      math: "active-only",
    });
    expect(report.counts.testStatus).toEqual({ inactive: 2, active: 2 });
    const statuses = parseQuestions(JSON.parse(questionsJson)).map(
      (q) => q.testStatus,
    );
    expect(statuses).toEqual(["inactive", "active", "inactive", "active"]);
  });

  it("quarantines a question it cannot read and keeps the rest", async () => {
    const pdfs = standard();
    pdfs.math_active = [
      { id: "m0000002", key: "Correct Answer: unknown", options: false },
      { id: "m0000003", key: "Correct Answer: A" },
    ];
    const { files, deps } = fixtures(pdfs);
    const { report, manifest } = await prepareLibrary(
      files,
      { mode: "unknown" },
      deps,
    );
    expect(manifest.questionCount).toBe(4);
    expect(report.quarantined).toEqual([
      {
        sourceId: "m0000002",
        file: "math_active.pdf",
        pages: [1],
        reason: expect.stringContaining("Unsupported numeric answer"),
      },
    ]);
    expect(report.counts.testStatus).toEqual({ inactive: 2, unknown: 2 });
  });

  it("refuses to import when no question can be prepared", async () => {
    const pdfs = standard();
    for (const name of EXPORT_NAMES)
      pdfs[name] = pdfs[name].map((spec) => ({ ...spec, key: undefined }));
    const { files, deps } = fixtures(pdfs);
    await expect(
      prepareLibrary(files, { mode: "unknown" }, deps),
    ).rejects.toThrow("No question could be prepared");
  });

  it("merges one source ID found in two exports and quarantines conflicts", async () => {
    const pdfs = standard();
    // The same question in both math exports, with identical metadata and key.
    pdfs.math_active = [
      { id: "m0000001", key: "Correct Answer: 12", options: false },
    ];
    const first = fixtures(pdfs);
    const merged = await prepareLibrary(
      first.files,
      { mode: "active-only" },
      first.deps,
    );
    const q = parseQuestions(JSON.parse(merged.questionsJson)).find(
      (item) => item.sourceId === "m0000001",
    )!;
    expect(q.document?.provenance.map((p) => p.filename)).toEqual([
      "math_inactive.pdf",
      "math_active.pdf",
    ]);
    // Found in both an active-only and an inactive export, so it stays unknown.
    expect(q.testStatus).toBe("unknown");

    // The same ID with a different answer key is a conflict and is not guessed.
    pdfs.math_active = [
      { id: "m0000001", key: "Correct Answer: 13", options: false },
    ];
    const second = fixtures(pdfs);
    const conflicted = await prepareLibrary(
      second.files,
      { mode: "active-only" },
      second.deps,
    );
    expect(conflicted.report.quarantined[0]).toMatchObject({
      sourceId: "m0000001",
      reason: expect.stringContaining("conflicting"),
    });
  });

  it("applies the built-in exception for the one question printed with a bulleted option", async () => {
    const pdfs = standard();
    // Same ID as the known exception, but its last option is not labelled D.
    pdfs.math_active = [{ id: "e3bbf2bf", key: "Correct Answer: A" }];
    const withId = fixtures(pdfs);
    const open = withId.deps.open;
    withId.deps.open = async (data: Uint8Array) => {
      const reader = await open(data);
      return {
        ...reader,
        layout: async (n: number) => {
          const layout = await reader.layout(n);
          if (!layout.text.includes("e3bbf2bf")) return layout;
          const patch = (text: string) => text.replace("D. four", "four");
          return {
            ...layout,
            text: patch(layout.text),
            lines: layout.lines.map((l) => ({ ...l, text: patch(l.text) })),
          };
        },
      };
    };
    const { questionsJson, report } = await prepareLibrary(
      withId.files,
      {},
      withId.deps,
    );
    const q = parseQuestions(JSON.parse(questionsJson)).find(
      (item) => item.sourceId === "e3bbf2bf",
    )!;
    expect(report.quarantined.map((x) => x.reason)).toEqual([]);
    expect(q.document?.extractionWarnings?.[0]).toMatch(/option D as a bullet/);
  });

  it("applies a reviewed exception for out-of-order options", async () => {
    const pdfs = standard();
    // Option D printed as a bullet: the labels are not A, B, C, D.
    pdfs.math_active = [{ id: "m0000002", key: "Correct Answer: A" }];
    const { files, deps } = fixtures(pdfs);
    // Replace the pages' option lines by running with an override on a normal
    // question: the warning must be carried onto the stored question.
    const { questionsJson } = await prepareLibrary(
      files,
      {
        mode: "unknown",
        overrides: {
          m0000002: { choiceLabelsVerified: true, warning: "Check D." },
        },
      },
      deps,
    );
    const q = parseQuestions(JSON.parse(questionsJson)).find(
      (item) => item.sourceId === "m0000002",
    )!;
    expect(q.document?.extractionWarnings).toEqual(["Check D."]);
  });

  it("stops when cancelled", async () => {
    const { files, deps } = fixtures(standard());
    const controller = new AbortController();
    controller.abort();
    await expect(
      prepareLibrary(
        files,
        { mode: "unknown", signal: controller.signal },
        deps,
      ),
    ).rejects.toThrow();
  });
});
