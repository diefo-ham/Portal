import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EXAMPLES_SOURCE } from "../src/core/bundled";
import { hasImportedQuestions, scopeStudyData } from "../src/core/assessments";
import { emptyData } from "../src/core/model";
import { parseQuestions } from "../src/importing/json";
import {
  EXAMPLES_RECEIPT,
  ingestLibrary,
  type LibrarySource,
} from "../src/importing/preparedLibrary";
import { assetKeys, readData, updateData } from "../src/storage/database";
import { removeQuestionLibrary } from "../src/storage/localData";
import { testCorpus } from "./practiceTestFixtures";

const dir = join(__dirname, "..", "public", "examples");
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const questionsText = readFileSync(join(dir, "questions.json"), "utf8");
const questions = parseQuestions(JSON.parse(questionsText));

const source: LibrarySource = {
  manifest: async () => manifest,
  questions: async () => questionsText,
  asset: async (key) => new Blob([readFileSync(join(dir, "assets", key))]),
};

describe("the bundled example library (public/examples)", () => {
  it("is a valid prepared library whose revision is the hash of its questions", () => {
    expect(manifest.format).toBe("sat-study-local-library-v1");
    expect(manifest.revision).toBe(
      createHash("sha256").update(questionsText).digest("hex"),
    );
    expect(manifest.questionCount).toBe(questions.length);
  });

  it("has 120 questions for each test, all marked as bundled examples", () => {
    for (const test of ["SAT", "PAA", "TSI"] as const)
      expect(questions.filter((q) => q.assessment === test)).toHaveLength(120);
    expect(questions.every((q) => q.bundled === true)).toBe(true);
    expect(questions.every((q) => q.source === EXAMPLES_SOURCE)).toBe(true);
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
  });

  it("keeps IDs apart from every importer's and carries no file provenance", () => {
    for (const q of questions) {
      const prefix = {
        SAT: "example-",
        PAA: "paa-example-",
        TSI: "tsi-example-",
      }[q.assessment!];
      expect(q.id.startsWith(prefix)).toBe(true);
      expect(q.document?.provenance).toEqual([]);
    }
  });

  it("has no active/inactive information and no College Board item", () => {
    expect(questions.every((q) => q.testStatus === "unknown")).toBe(true);
    expect(questions.filter((q) => q.origin === "official")).toEqual([]);
    expect(
      questions
        .filter((q) => q.assessment === "TSI")
        .every((q) => q.origin === "original"),
    ).toBe(true);
  });

  it("lists exactly the images its questions use, and each one matches its hash", () => {
    const used = new Set(
      questions.flatMap((q) =>
        [...(q.document?.question ?? []), ...(q.document?.rationale ?? [])].map(
          (p) => p.src.slice("asset:".length),
        ),
      ),
    );
    expect([...used].sort()).toEqual(manifest.assets);
    for (const key of manifest.assets) {
      const file = join(dir, "assets", key);
      expect(existsSync(file)).toBe(true);
      expect(
        createHash("sha256").update(readFileSync(file)).digest("hex") +
          key.slice(64),
      ).toBe(key);
    }
  });
});

describe("the bundled marker", () => {
  it("is accepted as true and refused as anything else", () => {
    const one = { ...JSON.parse(questionsText).questions[0] };
    expect(
      parseQuestions({ schemaVersion: 1, questions: [one] })[0].bundled,
    ).toBe(true);
    for (const bad of [false, "yes", 1])
      expect(() =>
        parseQuestions({
          schemaVersion: 1,
          questions: [{ ...one, bundled: bad }],
        }),
      ).toThrow(/bundled/);
    delete one.bundled;
    expect(
      parseQuestions({ schemaVersion: 1, questions: [one] })[0].bundled,
    ).toBeUndefined();
  });
});

describe("seeding and removing the examples", () => {
  const reset = () =>
    updateData((d) => {
      Object.assign(d, emptyData());
    });

  it("adds them once, keeps them beside the person's own questions, and survives removal", async () => {
    await reset();
    const first = await ingestLibrary(
      source,
      () => undefined,
      EXAMPLES_RECEIPT,
    );
    expect(first.unchanged).toBe(false);
    expect(first.data.questions).toHaveLength(360);
    expect(first.data.imports.map((x) => x.id)).toEqual([
      EXAMPLES_RECEIPT + manifest.revision,
    ]);
    // Opening the app again copies nothing.
    const again = await ingestLibrary(
      source,
      () => undefined,
      EXAMPLES_RECEIPT,
    );
    expect(again.unchanged).toBe(true);
    expect((await readData()).questions).toHaveLength(360);
    expect(hasImportedQuestions(first.data)).toBe(false);

    // The person adds questions of their own.
    const own = testCorpus(3).questions.map((q) => ({
      ...q,
      assessment: "SAT" as const,
    }));
    await updateData((d) => {
      d.questions.push(...own);
      d.imports.push({
        id: "prepared:own",
        filename: "mine",
        importedAt: "2026-01-01T00:00:00.000Z",
        added: own.length,
        skipped: 0,
      });
    });
    const before = await readData();
    expect(hasImportedQuestions(before, "SAT")).toBe(true);
    expect(hasImportedQuestions(before, "PAA")).toBe(false);

    const images = (await assetKeys()).size;
    const after = await removeQuestionLibrary("SAT");
    expect(after.questions).toHaveLength(360);
    expect(after.questions.every((q) => q.bundled === true)).toBe(true);
    // The examples' receipt stays (so they are not copied again); the person's goes.
    expect(after.imports.map((x) => x.id)).toEqual([
      EXAMPLES_RECEIPT + manifest.revision,
    ]);
    expect((await assetKeys()).size).toBe(images);
    expect(hasImportedQuestions(after, "SAT")).toBe(false);
    await reset();
  });

  it("are left out of a test's view, with their answers", async () => {
    await reset();
    const { data } = await ingestLibrary(
      source,
      () => undefined,
      EXAMPLES_RECEIPT,
    );
    const id = data.questions.find((q) => q.assessment === "PAA")!.id;
    data.attempts.push({
      id: "a",
      questionId: id,
      answer: "A",
      correct: true,
      submittedAt: "2026-01-01T00:00:00.000Z",
      durationMs: 1,
    });
    expect(scopeStudyData(data, "PAA").questions).toHaveLength(120);
    const test = scopeStudyData(data, "PAA", { hideBundled: true });
    expect(test.questions).toEqual([]);
    expect(test.attempts).toEqual([]);
    await reset();
  });
});
