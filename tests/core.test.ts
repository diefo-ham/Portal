import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { parseQuestions, mergeQuestions } from "../src/importing/json";
import { parseBackup } from "../src/importing/backup";
import {
  isCorrect,
  filterQuestions,
  createSession,
  numericValue,
} from "../src/core/practice";
import { emptyData, defaultFilters } from "../src/core/model";
import { updateData, readData } from "../src/storage/database";
import sample from "../src/data/synthetic.json";
import {
  beginSession,
  submitAnswer,
  finishSession,
} from "../src/core/commands";
describe("question integrity and practice rules", () => {
  const questions = parseQuestions(sample);
  it("guards session membership and records only one submission per question", () => {
    const d = { ...emptyData(), questions };
    const s = beginSession(d, [questions[0].id], defaultFilters);
    expect(() => submitAnswer(d, s.id, questions[1].id, "28")).toThrow();
    expect(() => submitAnswer(d, s.id, questions[0].id, "Z")).toThrow();
    submitAnswer(d, s.id, questions[0].id, "B");
    submitAnswer(d, s.id, questions[0].id, "A");
    expect(d.attempts).toHaveLength(1);
    expect(d.attempts[0].correct).toBe(true);
    finishSession(d, s.id);
    expect(() => submitAnswer(d, s.id, questions[0].id, "B")).toThrow();
  });
  it("loads original sample and hides active questions while retaining unknown", () => {
    const d = { ...emptyData(), questions };
    expect(filterQuestions(d, defaultFilters)).toHaveLength(10);
    expect(
      filterQuestions(d, { ...defaultFilters, active: "only" }),
    ).toHaveLength(2);
    expect(
      filterQuestions(d, { ...defaultFilters, active: "unknown" }),
    ).toHaveLength(2);
  });
  it("scores fractions equivalently without accepting invalid numeric input", () => {
    const q = questions[3];
    expect(isCorrect(q, "0.375")).toBe(true);
    expect(isCorrect(q, "6/16")).toBe(true);
    for (const answer of ["", "3/0", "Infinity", "0.38", "0x3", "3/8/2"])
      expect(isCorrect(q, answer)).toBe(false);
    expect(numericValue("−2")).toBe(-2);
  });
  it("separates latest mistakes from historical mistakes", () => {
    const d = { ...emptyData(), questions };
    d.attempts = [false, true].map((correct, i) => ({
      id: String(i),
      sessionId: "s",
      questionId: questions[0].id,
      answer: "B",
      correct,
      durationMs: 100,
      submittedAt: new Date().toISOString(),
    }));
    expect(
      filterQuestions(d, { ...defaultFilters, status: "incorrect" }),
    ).toHaveLength(0);
    expect(
      filterQuestions(d, { ...defaultFilters, status: "ever-missed" }),
    ).toHaveLength(1);
    expect(
      filterQuestions(d, { ...defaultFilters, status: "completed" }),
    ).toHaveLength(1);
  });
  it("uses source namespace plus source ID and rejects conflicting internal IDs", () => {
    expect(mergeQuestions(questions, questions, "x").skipped).toBe(12);
    expect(
      mergeQuestions(questions, [{ ...questions[0], id: "new-id" }], "x")
        .skipped,
    ).toBe(1);
    expect(() =>
      mergeQuestions(
        questions,
        [{ ...questions[3], stem: "Unrelated question" }],
        "x",
      ),
    ).toThrow("collision");
  });
  it("rejects unsafe or malformed imports atomically", () => {
    for (const patch of [
      { id: "__proto__" },
      { testStatus: "maybe" },
      { answer: { type: "choice", value: "Z" } },
      { media: [{ alt: "x", dataUrl: "https://example.com/image.png" }] },
    ])
      expect(() =>
        parseQuestions({
          schemaVersion: 1,
          questions: [{ ...sample.questions[0], ...patch }],
        }),
      ).toThrow();
  });
  it("validates and pauses restored sessions", () => {
    const d = { ...emptyData(), questions };
    d.sessions = [createSession([questions[0].id])];
    d.annotations[questions[0].id] = {
      bookmarked: true,
      note: "Remember inverse operations.",
    };
    expect(
      parseBackup({ format: "sat-study-backup-v1", data: d }).sessions[0]
        .paused,
    ).toBe(true);
    expect(() =>
      parseBackup({
        format: "sat-study-backup-v1",
        data: { ...d, attempts: [{ id: "bad" }] },
      }),
    ).toThrow();
  });
  it("persists concurrent mutations without losing annotations or answers", async () => {
    await updateData((d) => Object.assign(d, { ...emptyData(), questions }));
    await Promise.all([
      updateData((d) => {
        d.annotations[questions[0].id] = { bookmarked: true, note: "saved" };
      }),
      updateData((d) => {
        d.sessions.push(createSession([questions[0].id]));
      }),
    ]);
    const stored = await readData();
    expect(stored.annotations[questions[0].id].note).toBe("saved");
    expect(stored.sessions).toHaveLength(1);
    await expect(
      updateData((d) => {
        d.questions = [];
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect((await readData()).questions).toHaveLength(12);
  });
});
