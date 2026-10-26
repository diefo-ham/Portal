import { describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { emptyData } from "../src/core/model";
import sample from "../src/data/synthetic.json";
import { parseQuestions } from "../src/importing/json";
import { parseBackup } from "../src/importing/backup";
import { storeInlineDocuments } from "../src/importing/documents";
import { loadPreparedLibrary } from "../src/importing/preparedLibrary";
import { readAsset, readData, updateData } from "../src/storage/database";

const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0kAAAAASUVORK5CYII=";
const panel = {
  src: pixel,
  alt: "Original synthetic PDF layout",
  width: 1,
  height: 1,
};
const original = {
  ...sample.questions[0],
  document: {
    question: [panel],
    rationale: [panel],
    textIsApproximate: true,
    provenance: [
      {
        filename: "original-example.pdf",
        sha256: "a".repeat(64),
        pages: [1, 2],
      },
    ],
  },
};

describe("PDF-backed question data", () => {
  it("rejects missing image references before committing a restore", async () => {
    const q = parseQuestions({
      schemaVersion: 1,
      questions: [
        {
          ...original,
          document: {
            ...original.document,
            question: [{ ...panel, src: "asset:" + "b".repeat(64) + ".webp" }],
          },
        },
      ],
    });
    await expect(
      storeInlineDocuments({ ...emptyData(), questions: q }),
    ).rejects.toThrow("unavailable PDF images");
  });
  it("retains document and provenance data and rejects network or traversal image sources", () => {
    const q = parseQuestions({ schemaVersion: 1, questions: [original] })[0];
    expect(q.document?.provenance[0].pages).toEqual([1, 2]);
    for (const src of [
      "https://example.com/image.png",
      "asset:../../file",
      "javascript:alert(1)",
      "data:image/svg+xml;base64,AAAA",
    ])
      expect(() =>
        parseQuestions({
          schemaVersion: 1,
          questions: [
            {
              ...original,
              document: { ...original.document, question: [{ ...panel, src }] },
            },
          ],
        }),
      ).toThrow();
  });
  it("separates inline images from the progress snapshot and exports a portable round trip", async () => {
    const d = await storeInlineDocuments({
      ...emptyData(),
      questions: parseQuestions({ schemaVersion: 1, questions: [original] }),
    });
    const source = d.questions[0].document!.question[0].src;
    expect(source).toMatch(/^asset:[a-f0-9]{64}\.webp$/);
    expect((await readAsset(source.slice(6)))?.size).toBeGreaterThan(0);
    // FileReader is a browser API; exercise that final encoding in the browser test.
    const blob = await readAsset(source.slice(6));
    const binary = Buffer.from(await blob!.arrayBuffer()).toString("base64");
    const portable = structuredClone(d);
    portable.questions[0].document!.question[0].src = `data:${blob!.type};base64,${binary}`;
    portable.questions[0].document!.rationale[0].src = pixel;
    expect(
      parseBackup({ format: "sat-study-backup-v1", data: portable })
        .questions[0].document?.question[0].src,
    ).toBe(pixel);
  });
  it("loads and verifies a prepared library once, preserving existing notes and attempts", async () => {
    const incoming = parseQuestions({
      schemaVersion: 1,
      questions: [
        { ...original, id: "prepared-example", sourceId: "example-id" },
      ],
    });
    const data = await storeInlineDocuments({
      ...emptyData(),
      questions: incoming,
    });
    const key = data.questions[0].document!.question[0].src.slice(6);
    const payload = JSON.stringify({
      schemaVersion: 1,
      questions: data.questions,
    });
    const digest = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(payload),
        ),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    await updateData((d) => {
      Object.assign(d, emptyData());
      d.questions = parseQuestions(sample);
      d.annotations["demo-m01"] = { bookmarked: true, note: "Existing work" };
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        if (String(input).endsWith("manifest.json"))
          return new Response(
            JSON.stringify({
              format: "sat-study-local-library-v1",
              revision: digest,
              assets: [key],
              questionCount: 1,
              label: "Synthetic PDF import",
            }),
          );
        if (String(input).endsWith("questions.json"))
          return new Response(payload);
        throw new Error("Unexpected asset request for an already stored image");
      });
    try {
      await loadPreparedLibrary(() => {});
      await loadPreparedLibrary(() => {});
      const d = await readData();
      expect(d.questions).toHaveLength(13);
      expect(d.questions[0].id).toBe("prepared-example");
      expect(d.imports).toHaveLength(1);
      expect(d.annotations["demo-m01"].note).toBe("Existing work");
    } finally {
      fetchMock.mockRestore();
    }
  });
});
