import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import type { AccessHashes } from "../src/core/accessCodes";
import { emptyData, type Question } from "../src/core/model";
import { isUnverified, revokeUnverifiedPdfs } from "../src/core/pdfLibrary";
import {
  assetKeys,
  readData,
  updateData,
  writeAssets,
} from "../src/storage/database";
import { revokeUnverifiedQuestions } from "../src/storage/localData";
import { choiceQuestion } from "./questionFixtures";

const OLD = "a".repeat(64);
const NEW = "b".repeat(64);
const accepted = (sat: string[], paa: string[] = []): AccessHashes => ({
  SAT: sat,
  PAA: paa,
  TSI: [],
});
const key = (c: string) => c.repeat(64) + ".webp";

/** A question that came from a PDF, recording the access code hash it carried. */
const fromPdf = (
  id: string,
  pdfs: (string | undefined)[],
  extra: Partial<Question> = {},
): Question =>
  choiceQuestion({
    id,
    assessment: "SAT",
    document: {
      question: [{ src: "asset:" + key("1"), alt: "q", width: 10, height: 10 }],
      rationale: [
        { src: "asset:" + key("2"), alt: "r", width: 10, height: 10 },
      ],
      textIsApproximate: true,
      provenance: pdfs.map((access, i) => ({
        filename: `f${i}.pdf`,
        sha256: String(i).repeat(64),
        pages: [1],
        ...(access ? { access } : {}),
      })),
    },
    ...extra,
  });

describe("which questions a PDF's access code still covers", () => {
  it("keeps a question whose PDF's code is accepted, and removes the others", () => {
    const list = accepted([NEW]);
    expect(isUnverified(fromPdf("ok", [NEW]), list)).toBe(false);
    // The code was replaced.
    expect(isUnverified(fromPdf("old", [OLD]), list)).toBe(true);
    // Added before codes existed: no code recorded.
    expect(isUnverified(fromPdf("legacy", [undefined]), list)).toBe(true);
    // One of its PDFs still counts.
    expect(isUnverified(fromPdf("both", [OLD, NEW]), list)).toBe(false);
  });

  it("never touches the examples or a question with no PDF behind it", () => {
    const list = accepted([]);
    expect(isUnverified(fromPdf("ex", [], { bundled: true }), list)).toBe(
      false,
    );
    expect(
      isUnverified(fromPdf("ex2", [undefined], { bundled: true }), list),
    ).toBe(false);
    expect(isUnverified(choiceQuestion({ id: "plain" }), list)).toBe(false);
  });

  it("checks a question against the code of its own test", () => {
    const paa = fromPdf("paa-1", [OLD], {
      assessment: "PAA",
      section: "lectura",
    });
    expect(isUnverified(paa, accepted([OLD], []))).toBe(true);
    expect(isUnverified(paa, accepted([], [OLD]))).toBe(false);
  });

  it("lets a new code sit beside the old one, and revokes the old one when it is dropped", () => {
    const data = {
      ...emptyData(),
      questions: [fromPdf("a", [OLD]), fromPdf("b", [NEW])],
    };
    expect(revokeUnverifiedPdfs(data, accepted([OLD, NEW]))).toBe(0);
    expect(revokeUnverifiedPdfs(data, accepted([NEW]))).toBe(1);
    expect(data.questions.map((q) => q.id)).toEqual(["b"]);
  });

  it("ends the sessions that used a removed question and keeps answers and bookmarks", () => {
    const data = {
      ...emptyData(),
      questions: [fromPdf("gone", [OLD]), fromPdf("kept", [NEW])],
      sessions: [
        { id: "s1", questionIds: ["gone", "kept"] },
        { id: "s2", questionIds: ["kept"] },
      ] as never,
      attempts: [
        {
          id: "a1",
          questionId: "gone",
          sessionId: "s1",
          answer: "B",
          correct: true,
          submittedAt: "2026-01-01T00:00:00.000Z",
          durationMs: 1,
        },
      ],
      annotations: { gone: { bookmarked: true, note: "" } },
    };
    revokeUnverifiedPdfs(data, accepted([NEW]));
    expect(data.sessions.map((s) => s.id)).toEqual(["s2"]);
    expect(data.attempts).toHaveLength(1);
    expect(data.attempts[0].sessionId).toBeUndefined();
    expect(data.annotations.gone.bookmarked).toBe(true);
  });
});

describe("revoking when the app loads", () => {
  const seed = async (questions: Question[]) => {
    await writeAssets([
      { key: key("1"), blob: new Blob(["1"]) },
      { key: key("2"), blob: new Blob(["2"]) },
      { key: key("3"), blob: new Blob(["3"]) },
    ]);
    await updateData((d) => {
      Object.assign(d, emptyData());
      d.questions = questions;
      d.imports = [
        {
          id: "prepared:own",
          filename: "mine",
          importedAt: "2026-01-01T00:00:00.000Z",
          added: 1,
          skipped: 0,
        },
        {
          id: "examples:rev",
          filename: "Example questions",
          importedAt: "2026-01-01T00:00:00.000Z",
          added: 1,
          skipped: 0,
        },
      ];
    });
  };

  it("removes the questions of a PDF whose code is not accepted, and their images and receipts", async () => {
    await seed([
      fromPdf("old", [OLD]),
      {
        ...fromPdf("example", [], { bundled: true }),
        document: {
          question: [
            { src: "asset:" + key("3"), alt: "e", width: 1, height: 1 },
          ],
          rationale: [
            { src: "asset:" + key("3"), alt: "e", width: 1, height: 1 },
          ],
          textIsApproximate: true,
          provenance: [],
        },
      },
    ]);
    const result = await revokeUnverifiedQuestions(accepted([NEW]));
    expect(result.removed).toBe(1);
    expect(result.data.questions.map((q) => q.id)).toEqual(["example"]);
    // The removed question's images go; the example's stay.
    expect([...(await assetKeys())]).toEqual([key("3")]);
    expect(result.data.imports.map((x) => x.id)).toEqual(["examples:rev"]);
    expect((await readData()).questions).toHaveLength(1);
  });

  it("does nothing, and writes nothing, when every PDF is still covered", async () => {
    await seed([fromPdf("ok", [NEW])]);
    const before = JSON.stringify(await readData());
    const result = await revokeUnverifiedQuestions(accepted([NEW]));
    expect(result.removed).toBe(0);
    expect(JSON.stringify(await readData())).toBe(before);
  });
});
