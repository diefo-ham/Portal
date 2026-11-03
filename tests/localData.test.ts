import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { emptyData } from "../src/core/model";
import sample from "./fixtures/synthetic.json";
import { parseQuestions } from "../src/importing/json";
import {
  assetKeys,
  readData,
  updateData,
  writeAssets,
} from "../src/storage/database";
import {
  eraseAllLocalData,
  removeQuestionLibrary,
} from "../src/storage/localData";

const seed = async () => {
  await writeAssets([{ key: "a".repeat(64) + ".webp", blob: new Blob(["x"]) }]);
  await updateData((d) => {
    Object.assign(d, emptyData());
    d.questions = parseQuestions(sample);
    d.imports.push({
      id: "i",
      filename: "f",
      importedAt: "2026-01-01T00:00:00.000Z",
      added: 12,
      skipped: 0,
    });
    d.attempts.push({
      id: "a1",
      questionId: "demo-m01",
      sessionId: "s1",
      answer: "B",
      correct: true,
      submittedAt: "2026-01-01T00:00:00.000Z",
      durationMs: 1000,
    });
    d.annotations["demo-m01"] = { bookmarked: true, note: "" };
  });
};

describe("clearing local data", () => {
  it("removes questions and images but keeps answers and bookmarks", async () => {
    await seed();
    const data = await removeQuestionLibrary();
    expect(data.questions).toEqual([]);
    expect(data.imports).toEqual([]);
    expect(data.attempts).toHaveLength(1);
    expect(data.attempts[0].sessionId).toBeUndefined();
    expect(data.annotations["demo-m01"].bookmarked).toBe(true);
    expect((await assetKeys()).size).toBe(0);
    expect((await readData()).attempts).toHaveLength(1);
  });
  it("erases the database so the next read starts empty", async () => {
    await seed();
    await eraseAllLocalData();
    const data = await readData();
    expect(data.questions).toEqual([]);
    expect(data.attempts).toEqual([]);
    expect((await assetKeys()).size).toBe(0);
  });
});
