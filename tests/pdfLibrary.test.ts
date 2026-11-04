import { describe, expect, it } from "vitest";
import {
  emptyData,
  type Question,
  type Session,
  type StudyData,
  type TestStatus,
} from "../src/core/model";
import { removePdfFromData, summarizePdfs } from "../src/core/pdfLibrary";

const file = (name: string) => ({
  filename: `${name}.pdf`,
  sha256: name.padEnd(64, "0"),
  pages: [1],
});

const question = (
  id: string,
  files: string[],
  testStatus: TestStatus = "inactive",
  extra: Partial<Question> = {},
): Question => ({
  id,
  assessment: id.startsWith("paa-") ? "PAA" : "SAT",
  section: id.startsWith("paa-") ? "lectura" : "math",
  stem: "Original synthetic question.",
  answer: { type: "choice", value: "A" },
  testStatus,
  document: {
    question: [],
    rationale: [],
    textIsApproximate: false,
    provenance: files.map(file),
  },
  importMetadata: { importedAt: "2026-01-01T00:00:00.000Z" },
  ...extra,
});

const session = (id: string, questionIds: string[]): Session => ({
  id,
  questionIds,
  index: 0,
  startedAt: "2026-01-01T00:00:00.000Z",
  filters: {} as Session["filters"],
  drafts: {},
  elapsed: {},
  paused: false,
});

const library = (): StudyData => {
  const data = emptyData();
  data.questions = [
    question("m1", ["math_inactive"]),
    question("m2", ["math_inactive"]),
    question("m3", ["math_active"], "active"),
    // Present in two files, as in an inclusive active export.
    question("m4", ["math_inactive", "math_active"]),
    question("paa-1", ["banco"], "unknown"),
  ];
  data.attempts.push({
    id: "a1",
    questionId: "m1",
    sessionId: "s1",
    answer: "A",
    correct: true,
    durationMs: 1,
    submittedAt: "2026-01-01T00:00:00.000Z",
  });
  data.annotations.m1 = { bookmarked: true, note: "" };
  data.sessions = [session("s1", ["m1", "m3"]), session("s2", ["m3"])];
  data.imports.push({
    id: "i",
    filename: "f",
    importedAt: "2026-01-01T00:00:00.000Z",
    added: 5,
    skipped: 0,
  });
  return data;
};

describe("summarizePdfs", () => {
  it("lists each PDF with its counts, scoped to one test", () => {
    const sat = summarizePdfs(library(), "SAT");
    expect(sat.map((s) => s.filename).sort()).toEqual([
      "math_active.pdf",
      "math_inactive.pdf",
    ]);
    const inactive = sat.find((s) => s.filename === "math_inactive.pdf")!;
    expect(inactive.questions).toBe(3);
    expect(inactive.onlyHere).toBe(2);
    expect(inactive.status).toEqual({ active: 0, inactive: 3, unknown: 0 });
    expect(inactive.sections).toEqual(["math"]);
    const active = sat.find((s) => s.filename === "math_active.pdf")!;
    expect(active.status.active).toBe(1);
    expect(active.status.inactive).toBe(1);
    const paa = summarizePdfs(library(), "PAA");
    expect(paa).toHaveLength(1);
    expect(paa[0].status.unknown).toBe(1);
  });
  it("counts a file listed twice on one question once", () => {
    const data = emptyData();
    data.questions = [question("m1", ["a", "a"])];
    expect(summarizePdfs(data, "SAT")[0].questions).toBe(1);
  });
  it("is empty when nothing is stored", () => {
    expect(summarizePdfs(emptyData(), "SAT")).toEqual([]);
  });
});

describe("removePdfFromData", () => {
  it("removes only that file's questions and keeps answers and bookmarks", () => {
    const data = library();
    const key = file("math_active").sha256;
    expect(removePdfFromData(data, "SAT", key)).toBe(1);
    expect(data.questions.map((q) => q.id)).toEqual([
      "m1",
      "m2",
      "m4",
      "paa-1",
    ]);
    expect(data.attempts).toHaveLength(1);
    expect(data.annotations.m1.bookmarked).toBe(true);
  });
  it("keeps a question that another stored file still provides", () => {
    const data = library();
    removePdfFromData(data, "SAT", file("math_active").sha256);
    const kept = data.questions.find((q) => q.id === "m4")!;
    expect(kept.document!.provenance.map((p) => p.filename)).toEqual([
      "math_inactive.pdf",
    ]);
    removePdfFromData(data, "SAT", file("math_inactive").sha256);
    expect(data.questions.map((q) => q.id)).toEqual(["paa-1"]);
  });
  it("ends sessions that used a removed question, keeping their answers", () => {
    const data = library();
    removePdfFromData(data, "SAT", file("math_active").sha256);
    expect(data.sessions).toEqual([]);
    expect(data.attempts[0].sessionId).toBeUndefined();
  });
  it("leaves the other test alone and keeps receipts while questions remain", () => {
    const data = library();
    removePdfFromData(data, "SAT", file("banco").sha256);
    expect(data.questions.some((q) => q.id === "paa-1")).toBe(true);
    expect(data.imports).toHaveLength(1);
    removePdfFromData(data, "PAA", file("banco").sha256);
    expect(data.questions.some((q) => q.id === "paa-1")).toBe(false);
  });
  it("clears receipts once no question is left", () => {
    const data = library();
    data.questions = [question("m1", ["only"])];
    removePdfFromData(data, "SAT", file("only").sha256);
    expect(data.imports).toEqual([]);
  });
  it("does nothing for a file that is not stored", () => {
    const data = library();
    expect(removePdfFromData(data, "SAT", "missing")).toBe(0);
    expect(data.questions).toHaveLength(5);
    expect(data.sessions).toHaveLength(2);
  });
});
