import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { parseQuestions, mergeQuestions } from "../src/importing/json";
import { parseBackup } from "../src/importing/backup";
import {
  isCorrect,
  filterQuestions,
  createSession,
  numericValue,
  selectSessionQuestions,
  summarize,
} from "../src/core/practice";
import { emptyData, defaultFilters } from "../src/core/model";
import {
  updateData,
  readData,
  readResetArchive,
} from "../src/storage/database";
import sample from "../src/data/synthetic.json";
import {
  beginSession,
  deleteSession,
  renameSession,
  submitAnswer,
  finishSession,
  resetStudyProgress,
  toggleSessionStar,
} from "../src/core/commands";
import { domainKey, skillKey, taxonomyOptions } from "../src/core/taxonomy";
import {
  performanceOverview,
  reviewQueues,
  sessionOutcomes,
  sessionTiming,
} from "../src/core/review";
import {
  createResetArchive,
  validateResetArchive,
} from "../src/storage/resetArchive";
import {
  normalizeSessionName,
  sessionDefaultName,
  sessionDisplayName,
} from "../src/core/sessions";
describe("question integrity and practice rules", () => {
  const questions = parseQuestions(sample);
  it("retains multiple unfinished sets without changing their order or drafts", () => {
    const d = { ...emptyData(), questions };
    const first = beginSession(
      d,
      [questions[0].id, questions[1].id],
      defaultFilters,
    );
    first.index = 1;
    first.drafts[questions[1].id] = "28";
    first.eliminated = { [questions[0].id]: ["A", "D"] };
    const saved = structuredClone(first);
    beginSession(d, [questions[2].id], defaultFilters);
    expect(d.sessions.filter((s) => !s.finishedAt)).toHaveLength(2);
    expect(first).toEqual(saved);
  });
  it("defaults fresh and reset Practice filters to unanswered without masking explicit legacy status", () => {
    const d = { ...emptyData(), questions };
    expect(defaultFilters.statuses).toEqual(["unanswered"]);
    expect(filterQuestions(d, defaultFilters)).toHaveLength(10);
    const session = beginSession(d, [questions[0].id], defaultFilters);
    submitAnswer(d, session.id, questions[0].id, "B");
    expect(filterQuestions(d, defaultFilters)).toHaveLength(9);
    expect(
      filterQuestions(d, { ...defaultFilters, status: "completed" }).map(
        (question) => question.id,
      ),
    ).toEqual([questions[0].id]);
  });
  it("snapshots timer visibility and calculates performance from answers only", () => {
    const d = { ...emptyData(), questions };
    const visible = beginSession(
      d,
      [questions[0].id, questions[1].id],
      defaultFilters,
    );
    const hidden = beginSession(
      d,
      [questions[0].id],
      defaultFilters,
      undefined,
      false,
    );
    submitAnswer(d, visible.id, questions[0].id, "B");
    submitAnswer(d, hidden.id, questions[0].id, "A");
    expect(visible.timerVisible).toBe(true);
    expect(hidden.timerVisible).toBe(false);
    const performance = performanceOverview(d);
    expect(performance.all).toMatchObject({
      attempts: 2,
      correct: 1,
      incorrect: 1,
      accuracy: 50,
    });
    expect(performance.sections.math).toMatchObject({
      attempts: 2,
      correct: 1,
      incorrect: 1,
      accuracy: 50,
    });
    expect(performance.sections["reading-writing"].accuracy).toBeUndefined();
    expect(performance.domains).toHaveLength(8);
    expect(
      performance.domains.find((domain) => domain.domain === "Algebra"),
    ).toMatchObject({
      section: "math",
      attempts: 2,
      correct: 1,
      incorrect: 1,
      accuracy: 50,
    });
    expect(
      performance.domains.find((domain) => domain.domain === "Advanced Math"),
    ).toMatchObject({ attempts: 0, accuracy: undefined });
  });
  it("derives recorded session and answered-question timing without inventing missing history", () => {
    const d = { ...emptyData(), questions };
    const session = beginSession(
      d,
      [questions[0].id, questions[1].id],
      defaultFilters,
    );
    expect(sessionTiming(d, session)).toEqual({
      totalMs: undefined,
      averageAnsweredMs: undefined,
    });
    session.elapsed[questions[0].id] = 40_000;
    session.elapsed[questions[1].id] = 20_000;
    submitAnswer(d, session.id, questions[0].id, "B");
    expect(sessionTiming(d, session)).toEqual({
      totalMs: 60_000,
      averageAnsweredMs: 40_000,
    });
  });
  it("derives useful session labels and persists optional names and stars", () => {
    const d = { ...emptyData(), questions };
    const session = beginSession(
      d,
      [questions[0].id, questions[1].id],
      defaultFilters,
    );
    expect(sessionDefaultName(d, session)).toBe(
      "Unanswered · Math · Algebra · 2 questions",
    );
    renameSession(d, session.id, "  Functions   Review ✓  ");
    toggleSessionStar(d, session.id);
    expect(session.name).toBe("Functions Review ✓");
    expect(session.starred).toBe(true);
    expect(sessionDisplayName(d, session)).toBe("Functions Review ✓");
    renameSession(d, session.id, "   ");
    expect(session.name).toBeUndefined();
    expect(sessionDisplayName(d, session)).toBe(
      "Unanswered · Math · Algebra · 2 questions",
    );
    session.filters.status = "incorrect";
    expect(sessionDefaultName(d, session)).toBe(
      "Mistakes · Math · Algebra · 2 questions",
    );
    session.filters.status = "";
    expect(normalizeSessionName("🌿".repeat(100))).toHaveLength(160);
    expect(Array.from(normalizeSessionName("🌿".repeat(100))!)).toHaveLength(
      80,
    );
  });
  it("deletes one session while retaining its answers and unrelated study state", () => {
    const d = { ...emptyData(), questions };
    const deleted = beginSession(d, [questions[0].id], defaultFilters);
    const kept = beginSession(d, [questions[1].id], defaultFilters);
    submitAnswer(d, deleted.id, questions[0].id, "B");
    d.annotations[questions[0].id] = { bookmarked: true, note: "" };

    deleteSession(d, deleted.id);

    expect(d.sessions).toEqual([kept]);
    expect(d.attempts).toHaveLength(1);
    expect(d.attempts[0]).toMatchObject({
      questionId: questions[0].id,
      correct: true,
    });
    expect(d.attempts[0].sessionId).toBeUndefined();
    expect(d.annotations[questions[0].id].bookmarked).toBe(true);
    expect(performanceOverview(d).all).toMatchObject({
      attempts: 1,
      correct: 1,
    });
    expect(() =>
      parseBackup({ format: "sat-study-backup-v1", data: d }),
    ).not.toThrow();
  });
  it("atomically replaces one reset archive and restores complete study state without replacing the corpus", async () => {
    const original = { ...emptyData(), questions };
    const s = beginSession(
      original,
      [questions[0].id, questions[1].id],
      defaultFilters,
    );
    s.name = "Archived focus";
    s.starred = true;
    s.elapsed[questions[0].id] = 1234;
    s.drafts[questions[1].id] = "28";
    s.eliminated = { [questions[0].id]: ["A"] };
    s.index = 1;
    submitAnswer(original, s.id, questions[0].id, "B");
    original.annotations[questions[0].id] = {
      bookmarked: true,
      note: "legacy",
    };
    finishSession(original, s.id);
    const unfinished = beginSession(
      original,
      [questions[1].id],
      defaultFilters,
    );
    unfinished.drafts[questions[1].id] = "99";
    await updateData((d) => Object.assign(d, original));
    await expect(
      updateData(
        () => {
          throw new Error("failed reset");
        },
        { resetArchive: "save" },
      ),
    ).rejects.toThrow();
    expect(await readData()).toEqual(original);
    await updateData((d) => resetStudyProgress(d, true), {
      resetArchive: "save",
    });
    const savedArchive = await readResetArchive();
    await expect(
      updateData(
        () => {
          throw new Error("failed write");
        },
        { resetArchive: "save" },
      ),
    ).rejects.toThrow();
    expect(await readResetArchive()).toEqual(savedArchive);
    expect((await readResetArchive())?.study.attempts).toEqual(
      original.attempts,
    );
    expect((await readResetArchive())?.study.sessions[0]).toMatchObject({
      name: "Archived focus",
      starred: true,
    });
    expect((await readData()).annotations).toEqual({});
    await updateData((d) => {
      d.questions.push({
        ...questions[0],
        id: "added-after-reset",
        sourceId: "unique-source",
      });
    });
    await updateData(() => {}, { resetArchive: "restore" });
    const recovered = await readData();
    expect(recovered.questions).toHaveLength(13);
    expect(recovered.attempts).toEqual(original.attempts);
    expect(recovered.annotations).toEqual(original.annotations);
    expect(recovered.sessions).toEqual(
      original.sessions.map((s) => ({ ...s, paused: true })),
    );
    await updateData((d) => {
      d.annotations[questions[0].id].bookmarked = false;
    });
    const second = await readData();
    await updateData(resetStudyProgress, { resetArchive: "save" });
    expect((await readResetArchive())?.study.annotations).toEqual(
      second.annotations,
    );
    await updateData(() => {}, { resetArchive: "restore" });
    expect((await readData()).annotations).toEqual(second.annotations);
  });
  it("rejects incompatible or corrupt archives instead of partially restoring records", () => {
    const d = { ...emptyData(), questions };
    beginSession(d, [questions[0].id], defaultFilters);
    const archive = createResetArchive(d);
    expect(() => validateResetArchive(archive, emptyData())).toThrow();
    expect(() =>
      validateResetArchive({ ...archive, format: "future-format" }, d),
    ).toThrow();
    expect(() =>
      validateResetArchive(
        { ...archive, study: { ...archive.study, attempts: [{}] } },
        d,
      ),
    ).toThrow();
  });
  it("combines domains and skills without merging similarly named source skills", () => {
    const a = questions[0],
      b = questions[2];
    const d = { ...emptyData(), questions };
    const f = {
      ...defaultFilters,
      domains: [domainKey(a), domainKey(b)],
      skills: [skillKey(a), skillKey(b)],
    };
    expect(filterQuestions(d, f).map((q) => q.id)).toEqual([a.id, b.id]);
    const variants = [
      questions[6],
      { ...questions[6], id: "case", skill: " Words  in Context " },
      { ...questions[6], id: "other-domain", domain: "Another domain" },
      {
        ...questions[6],
        id: "different",
        skill: "Words in Context and Meaning",
      },
    ];
    expect(taxonomyOptions(variants, "skill")).toHaveLength(3);
    const names = taxonomyOptions(variants, "skill").map((o) => o.label);
    expect(names.some((name) => name.includes("Craft and Structure"))).toBe(
      true,
    );
    expect(names.some((name) => name.includes("Another domain"))).toBe(true);
    expect(variants[1].skill).toBe(" Words  in Context ");
    const s = createSession([a.id, b.id], f);
    f.domains.pop();
    f.skills.pop();
    expect(s.filters.domains).toHaveLength(2);
    expect(
      parseBackup({
        format: "sat-study-backup-v1",
        data: { ...d, sessions: [s] },
      }).sessions[0].filters.skills,
    ).toHaveLength(2);
  });
  it("retains session outcomes while later attempts resolve global review queues", () => {
    const d = { ...emptyData(), questions };
    const first = beginSession(
      d,
      [questions[0].id, questions[1].id, questions[5].id],
      defaultFilters,
    );
    submitAnswer(d, first.id, questions[0].id, "A");
    finishSession(d, first.id);
    expect(sessionOutcomes(d, first).incorrect).toEqual([questions[0].id]);
    expect(sessionOutcomes(d, first).unanswered).toEqual([
      questions[1].id,
      questions[5].id,
    ]);
    expect(reviewQueues(d).unanswered).toEqual([questions[1].id]); // active protected
    expect(reviewQueues(d, false).unanswered).toEqual([
      questions[1].id,
      questions[5].id,
    ]);
    const next = beginSession(
      d,
      [questions[0].id, questions[1].id],
      defaultFilters,
    );
    submitAnswer(d, next.id, questions[0].id, "B");
    submitAnswer(d, next.id, questions[1].id, "28");
    expect(reviewQueues(d).mistakes).toEqual([]);
    expect(reviewQueues(d).unanswered).toEqual([]);
    expect(sessionOutcomes(d, first).unanswered).toHaveLength(2);
    expect(sessionOutcomes(d, first).incorrect).toHaveLength(1);
    expect(reviewQueues({ ...emptyData(), questions }).unanswered).toEqual([]);
  });
  it("shuffles before limiting without mutating the pool or saved session order", () => {
    const pool = ["a", "b", "c", "d"];
    const selected = selectSessionQuestions(pool, 2, [], () => 0);
    expect(selected).toEqual(["b", "c"]);
    expect(pool).toEqual(["a", "b", "c", "d"]);
    expect(selectSessionQuestions(pool, 0, [], () => 0.999)).toEqual(pool);
    expect(selectSessionQuestions(pool, 0, pool, () => 0.999)).toEqual([
      "b",
      "a",
      "c",
      "d",
    ]);
    expect(selectSessionQuestions(["a", "a", "b"], 20, [], () => 0)).toEqual([
      "b",
      "a",
    ]);
    expect(selectSessionQuestions(["a"], 0, ["a"])).toEqual(["a"]);
    const s = createSession(selected);
    selected.reverse();
    expect(s.questionIds).toEqual(["b", "c"]);
  });
  it("only samples matching questions and keeps a mistake-only pool intact", () => {
    const d = { ...emptyData(), questions };
    const eligible = filterQuestions(d, { ...defaultFilters, section: "math" });
    const ids = selectSessionQuestions(
      eligible.map((q) => q.id),
      3,
      [],
      () => 0,
    );
    expect(ids).toHaveLength(3);
    expect(ids.every((id) => eligible.some((q) => q.id === id))).toBe(true);
    expect(
      ids.every(
        (id) => questions.find((q) => q.id === id)!.testStatus !== "active",
      ),
    ).toBe(true);
    const mistakes = questions.slice(0, 3).map((q) => q.id);
    expect(selectSessionQuestions(mistakes).sort()).toEqual(
      [...mistakes].sort(),
    );
  });
  it("resets study progress atomically while preserving questions, imports and image assets", async () => {
    const { writeAssets, readAsset } = await import("../src/storage/database");
    const key = "reset-preservation.webp";
    await writeAssets([{ key, blob: new Blob(["test image"]) }]);
    const d = { ...emptyData(), questions };
    const session = beginSession(d, [questions[0].id], defaultFilters);
    session.elapsed[questions[0].id] = 1234;
    submitAnswer(d, session.id, questions[0].id, "B");
    finishSession(d, session.id);
    beginSession(d, [questions[1].id], defaultFilters).drafts[questions[1].id] =
      "28";
    d.annotations[questions[0].id] = { bookmarked: true, note: "erase" };
    d.imports.push({
      id: "receipt",
      filename: "sample.json",
      importedAt: new Date().toISOString(),
      added: 12,
      skipped: 0,
    });
    await updateData((current) => Object.assign(current, d));
    await updateData((d) => resetStudyProgress(d, true));
    const fresh = await readData();
    expect(fresh.questions).toEqual(questions);
    expect(fresh.imports).toEqual(d.imports);
    expect(fresh.sessions).toEqual([]);
    expect(fresh.attempts).toEqual([]);
    expect(fresh.annotations).toEqual({});
    expect(summarize(fresh).total).toBe(0);
    expect(summarize(fresh).weaknesses).toEqual([]);
    expect(
      filterQuestions(fresh, { ...defaultFilters, status: "incorrect" }),
    ).toEqual([]);
    expect(await readAsset(key)).toBeDefined();
    await updateData((current) => Object.assign(current, d));
    await updateData(resetStudyProgress);
    expect((await readData()).annotations).toEqual({
      [questions[0].id]: { bookmarked: true, note: "" },
    });
  });
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
    d.attempts = [
      { correct: true, submittedAt: "2026-01-02T00:00:00.000Z" },
      { correct: false, submittedAt: "2026-01-01T00:00:00.000Z" },
    ].map(({ correct, submittedAt }, i) => ({
      id: String(i),
      sessionId: "s",
      questionId: questions[0].id,
      answer: "B",
      correct,
      durationMs: 100,
      submittedAt,
    }));
    expect(d.attempts).toHaveLength(2);
    expect(
      filterQuestions(d, { ...defaultFilters, status: "incorrect" }),
    ).toHaveLength(0);
    expect(
      filterQuestions(d, { ...defaultFilters, status: "ever-missed" }),
    ).toHaveLength(1);
    expect(
      filterQuestions(d, { ...defaultFilters, status: "completed" }),
    ).toHaveLength(1);
    expect(
      filterQuestions(d, {
        ...defaultFilters,
        statuses: ["incorrect", "unanswered"],
      }).map((question) => question.id),
    ).not.toContain(questions[0].id);
    expect(
      filterQuestions(d, {
        ...defaultFilters,
        statuses: ["completed", "unanswered"],
      }),
    ).toHaveLength(10);
    expect(performanceOverview(d).all).toMatchObject({
      attempts: 2,
      correct: 1,
      incorrect: 1,
      accuracy: 50,
      outcomes: [false, true],
    });
  });
  it("filters multiple imported difficulty levels while keeping legacy filters readable", () => {
    const d = { ...emptyData(), questions };
    expect(
      filterQuestions(d, {
        ...defaultFilters,
        difficulties: ["easy", "hard"],
      }).every(
        (question) =>
          question.difficulty === "easy" || question.difficulty === "hard",
      ),
    ).toBe(true);
    expect(
      filterQuestions(d, { ...defaultFilters, difficulty: "medium" }).every(
        (question) => question.difficulty === "medium",
      ),
    ).toBe(true);
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
    d.sessions[0].eliminated = { [questions[0].id]: ["A", "C"] };
    d.annotations[questions[0].id] = {
      bookmarked: true,
      note: "Remember inverse operations.",
    };
    expect(
      parseBackup({ format: "sat-study-backup-v1", data: d }).sessions[0]
        .paused,
    ).toBe(true);
    expect(
      parseBackup({ format: "sat-study-backup-v1", data: d }).sessions[0]
        .eliminated,
    ).toEqual({ [questions[0].id]: ["A", "C"] });
    d.sessions[0].name = "  Saved   session  ";
    d.sessions[0].starred = true;
    expect(
      parseBackup({ format: "sat-study-backup-v1", data: d }).sessions[0],
    ).toMatchObject({ name: "Saved session", starred: true });
    d.sessions[0].name = "x".repeat(81);
    expect(() =>
      parseBackup({ format: "sat-study-backup-v1", data: d }),
    ).toThrow("session label");
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
