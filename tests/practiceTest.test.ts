import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import {
  beginPracticeTest,
  constructModule,
  unusedPool,
  moduleElapsed,
  moduleLimit,
  deadlinePassed,
  saveTestDraft,
  completeTestModule,
  continueAfterBreak,
  routeModule,
  scoredSummary,
  estimatedRange,
  availability,
  pausePracticeTest,
  resumePracticeTest,
  toggleReviewMark,
  timerWarning,
  orderModuleQuestions,
  cancelPracticeTest,
  deleteCompletedPracticeTest,
} from "../src/core/practiceTest";
import {
  beginSession,
  deleteSession,
  finishSession,
  resetStudyProgress,
  submitAnswer,
  renameSession,
} from "../src/core/commands";
import { defaultFilters, type Session } from "../src/core/model";
import {
  parseBackup,
  parseBackupPayload,
} from "../src/importing/backup";
import {
  createResetArchive,
  validateResetArchive,
} from "../src/storage/resetArchive";
import { sessionOutcomes } from "../src/core/review";
import { formatPercentage } from "../src/ui/PracticeTestResults";
import { updateData, readResetArchive } from "../src/storage/database";
import {
  testCorpus,
  seededRandom,
  difficultyCounts,
} from "./practiceTestFixtures";
const start = 1_800_000_000_000;
const restore = (d: ReturnType<typeof testCorpus>) =>
  parseBackup({ format: "sat-study-backup-v1", data: structuredClone(d) });

describe("Practice Test result formatting", () => {
  it("rounds percentages sensibly without false precision", () => {
    expect(formatPercentage(42.857142)).toBe("42.9%");
    expect(formatPercentage(43.333333)).toBe("43.3%");
    expect(formatPercentage(65)).toBe("65%");
  });
});
describe("Practice Test management", () => {
  it("renames active and completed tests without changing test state or results", () => {
    const d = testCorpus(54);
    const active = beginPracticeTest(
      d,
      "reading-writing:first",
      "untimed",
      start,
      seededRandom(),
    );
    const before = structuredClone(active);
    renameSession(d, active.id, "  October baseline  ");
    expect(active.name).toBe("October baseline");
    expect({ ...active, name: before.name }).toEqual(before);

    answerModule(d, active, 3);
    completeTestModule(d, active.id, start + 1000, seededRandom());
    const finished = structuredClone(active);
    const attempts = structuredClone(d.attempts);
    renameSession(d, active.id, "Completed baseline");
    expect(active.name).toBe("Completed baseline");
    expect({ ...active, name: finished.name }).toEqual(finished);
    expect(d.attempts).toEqual(attempts);
  });

  it("cancels only an unfinished attempt while retaining exposed IDs", () => {
    const d = testCorpus(54);
    const unrelated = beginSession(
      d,
      [d.questions[0].id],
      defaultFilters,
      "Keep me",
    );
    const otherTest = beginPracticeTest(
      d,
      "reading-writing:first",
      "untimed",
      start - 1000,
      seededRandom(1),
    );
    const test = beginPracticeTest(
      d,
      "reading-writing:first",
      "untimed",
      start,
      seededRandom(),
    );
    const exposed = [...test.questionIds];
    d.attempts.push({
      id: "partial-test-attempt",
      sessionId: test.id,
      questionId: exposed[0],
      answer: "A",
      correct: true,
      durationMs: 100,
      submittedAt: new Date(start).toISOString(),
    });
    cancelPracticeTest(d, test.id);
    expect(d.sessions).toEqual([unrelated, otherTest]);
    expect(d.attempts).toEqual([]);
    expect(d.practiceTestUsedIds).toEqual([
      ...otherTest.questionIds,
      ...exposed,
    ]);
    expect(availability(d, "reading-writing:first")).toMatch(/available/);
  });

  it("does not cancel completed Practice Tests", () => {
    const d = testCorpus();
    const test = beginPracticeTest(
      d,
      "math:first",
      "untimed",
      start,
      seededRandom(),
    );
    completeTestModule(d, test.id, start + 1000, seededRandom());
    expect(() => cancelPracticeTest(d, test.id)).toThrow(/Completed/);
    expect(d.sessions).toContain(test);
  });

  it("deletes only a completed test result while preserving exposure", () => {
    const d = testCorpus();
    const ordinary = beginSession(d, [d.questions[0].id], defaultFilters);
    submitAnswer(d, ordinary.id, d.questions[0].id, "A");
    const test = beginPracticeTest(
      d,
      "math:first",
      "untimed",
      start,
      seededRandom(),
    );
    answerModule(d, test, 2);
    completeTestModule(d, test.id, start + 1000, seededRandom());
    const exposed = [...d.practiceTestUsedIds];
    const ordinaryAttempts = d.attempts.filter(
      (attempt) => attempt.sessionId === ordinary.id,
    );

    deleteCompletedPracticeTest(d, test.id);

    expect(d.sessions).toEqual([ordinary]);
    expect(d.attempts).toEqual(ordinaryAttempts);
    expect(d.practiceTestUsedIds).toEqual(exposed);
    expect(unusedPool(d, "math").some((q) => exposed.includes(q.id))).toBe(
      false,
    );
  });
});
function answerModule(
  d: ReturnType<typeof testCorpus>,
  s: Session,
  correct = Infinity,
) {
  const m = s.practiceTest!.modules[s.practiceTest!.currentModule];
  m.questionIds.forEach((id, i) =>
    saveTestDraft(d, s.id, id, i < correct ? "A" : "B", m.startedAt),
  );
}
describe("Practice Test module generation", () => {
  it.each(["reading-writing", "math"] as const)(
    "constructs counts, active-only, section and unique IDs for %s",
    (section) => {
      const d = testCorpus();
      d.questions.push(
        { ...d.questions[0], id: "inactive", testStatus: "inactive" },
        { ...d.questions[0], id: "unknown", testStatus: "unknown" },
      );
      const s = beginPracticeTest(
        d,
        `${section}:first`,
        "timed",
        start,
        seededRandom(),
      );
      const m = s.practiceTest!.modules[0];
      expect(m.questionIds).toHaveLength(section === "math" ? 22 : 27);
      expect(new Set(m.questionIds).size).toBe(m.questionIds.length);
      expect(
        m.questionIds.every((id) =>
          d.questions.some(
            (q) =>
              q.id === id && q.section === section && q.testStatus === "active",
          ),
        ),
      ).toBe(true);
      expect(
        new Set(
          m.questionIds.map(
            (id) => d.questions.find((q) => q.id === id)!.domain,
          ),
        ).size,
      ).toBe(4);
      expect(
        new Set(
          m.questionIds.map(
            (id) => d.questions.find((q) => q.id === id)!.skill,
          ),
        ).size,
      ).toBeGreaterThanOrEqual(10);
    },
  );
  it("uses distinct broad, lower and higher mixes with reproducible injected randomness", () => {
    const d = testCorpus();
    const mix = (route: "first" | "lower" | "higher") =>
      constructModule(d.questions, "math", route, seededRandom());
    const first = difficultyCounts(mix("first")),
      lower = difficultyCounts(mix("lower")),
      higher = difficultyCounts(mix("higher"));
    expect(first.every((n) => n >= 5)).toBe(true);
    expect(lower[0]).toBeGreaterThan(first[0]);
    expect(lower[2]).toBeLessThan(first[2]);
    expect(higher[2]).toBeGreaterThan(first[2]);
    expect(higher[0]).toBeLessThan(first[0]);
    expect(lower.every((n) => n > 0) && higher.every((n) => n > 0)).toBe(true);
    expect(mix("first")).toEqual(mix("first"));
  });
  it("handles sparse metadata without duplication or invented difficulty", () => {
    const d = testCorpus(27);
    d.questions.forEach((q) => {
      delete q.difficulty;
      delete q.domain;
      delete q.skill;
    });
    expect(
      constructModule(d.questions, "reading-writing", "higher", seededRandom()),
    ).toHaveLength(27);
  });
  it("fails cleanly for exhausted pools and reserves capacity for unfinished full tests", () => {
    const d = testCorpus(54);
    const s = beginPracticeTest(d, "full", "timed", start);
    expect(availability(d, "reading-writing:first")).toMatch(/needs 27/);
    expect(() => beginPracticeTest(d, "full", "untimed", start)).toThrow(
      /unused active/,
    );
    expect(s.questionIds).toHaveLength(27);
    completeTestModule(d, s.id, start + moduleLimit("reading-writing"));
    expect(s.practiceTest!.modules).toHaveLength(2);
  });
});
describe("Practice Test timing and grading", () => {
  it.each(["timed", "untimed"] as const)(
    "freezes and safely resumes the %s module clock across reloads",
    (timing) => {
      let d = testCorpus();
      let s = beginPracticeTest(d, "math:first", timing, start);
      const id = s.questionIds[0];
      pausePracticeTest(d, s.id, start + 1000);
      expect(s.paused).toBe(true);
      expect(
        moduleElapsed(
          s.practiceTest!.modules[0],
          start + 61_000,
          timing === "timed",
        ),
      ).toBe(1000);
      saveTestDraft(d, s.id, id, "A", start + 61_000);
      expect(s.drafts[id]).toBeUndefined();
      expect(deadlinePassed(s, start + moduleLimit("math") + 61_000)).toBe(
        false,
      );
      d = restore(d);
      s = d.sessions[0];
      expect(s.paused).toBe(true);
      expect(
        moduleElapsed(
          s.practiceTest!.modules[0],
          start + 121_000,
          timing === "timed",
        ),
      ).toBe(1000);
      resumePracticeTest(d, s.id, start + 121_000);
      expect(s.paused).toBe(false);
      expect(
        moduleElapsed(
          s.practiceTest!.modules[0],
          start + 123_000,
          timing === "timed",
        ),
      ).toBe(3000);
    },
  );
  it("uses a restrained final-five-minute timer warning only", () => {
    expect(timerWarning(10 * 60_000)).toBe(false);
    expect(timerWarning(5 * 60_000)).toBe(true);
    expect(timerWarning(1)).toBe(true);
    expect(timerWarning(0)).toBe(false);
  });
  it("counts down to deadline, rejects late edits and preserves saved answers", () => {
    const d = testCorpus();
    const s = beginPracticeTest(d, "math:first", "timed", start);
    const m = s.practiceTest!.modules[0],
      limit = moduleLimit("math");
    saveTestDraft(d, s.id, m.questionIds[0], "A", start + limit - 1);
    saveTestDraft(d, s.id, m.questionIds[0], "B", start + limit);
    expect(deadlinePassed(s, start + limit - 1)).toBe(false);
    expect(deadlinePassed(s, start + limit)).toBe(true);
    expect(moduleElapsed(m, start + 1234, true)).toBe(1234);
    expect(limit - moduleElapsed(m, start + limit + 100, true)).toBe(0);
    completeTestModule(d, s.id, start + limit + 100);
    expect(m.durationMs).toBe(limit);
    expect(d.attempts).toHaveLength(1);
    expect(d.attempts[0].answer).toBe("A");
    expect(sessionOutcomes(d, s).unanswered).toHaveLength(21);
    completeTestModule(d, s.id, start + limit + 200);
    expect(d.attempts).toHaveLength(1);
  });
  it("untimed remains an unlimited stopwatch and resumes from the saved wall clock", () => {
    const d = testCorpus();
    const s = beginPracticeTest(d, "math:higher", "untimed", start);
    const next = restore(d),
      resumed = next.sessions[0],
      m = resumed.practiceTest!.modules[0];
    expect(deadlinePassed(resumed, start + 7_200_000)).toBe(false);
    expect(moduleElapsed(m, start + 7_200_000)).toBe(7_200_000);
    expect(resumed.finishedAt).toBeUndefined();
    expect(resumed.paused).toBe(false);
    completeTestModule(next, s.id, start + 7_200_000);
    expect(m.durationMs).toBe(7_200_000);
  });
  it("grades numeric drafts, leaving invalid or blank entries unanswered", () => {
    const d = testCorpus();
    d.questions.forEach((q) => {
      q.answer = { type: "numeric", accepted: ["0.5"] };
      delete q.choices;
    });
    const s = beginPracticeTest(d, "math:first", "untimed", start),
      ids = s.questionIds;
    saveTestDraft(d, s.id, ids[0], "1/2", start);
    saveTestDraft(d, s.id, ids[1], "1/0", start);
    completeTestModule(d, s.id, start + 1000);
    expect(d.attempts).toHaveLength(1);
    expect(d.attempts[0].correct).toBe(true);
  });
  it("excludes exactly two stable simulated items from scored results, retaining mistakes in Review", () => {
    const d = testCorpus();
    const s = beginPracticeTest(
      d,
      "math:lower",
      "untimed",
      start,
      seededRandom(),
    );
    const m = s.practiceTest!.modules[0];
    expect(m.unscoredIds).toHaveLength(2);
    expect(new Set(m.unscoredIds).size).toBe(2);
    expect(restore(d).sessions[0].practiceTest!.modules[0].unscoredIds).toEqual(
      m.unscoredIds,
    );
    const scored = m.questionIds.filter((id) => !m.unscoredIds.includes(id));
    scored.slice(0, 10).forEach((id) => saveTestDraft(d, s.id, id, "A", start));
    scored
      .slice(10, 15)
      .forEach((id) => saveTestDraft(d, s.id, id, "B", start));
    m.unscoredIds.forEach((id) => saveTestDraft(d, s.id, id, "B", start));
    completeTestModule(d, s.id, start + 5000);
    expect(scoredSummary(d, s)).toEqual({
      correct: 10,
      incorrect: 5,
      unanswered: 5,
      scored: 20,
      percentage: 50,
    });
    expect(sessionOutcomes(d, s).incorrect).toHaveLength(7);
    expect(estimatedRange(d, s, "math")).toBeDefined();
    expect(estimatedRange(d, s, "reading-writing")).toBeUndefined();
    const estimate = estimatedRange(d, s, "math");
    d.attempts
      .filter((a) => m.unscoredIds.includes(a.questionId))
      .forEach((a) => (a.correct = true));
    expect(estimatedRange(d, s, "math")).toEqual(estimate);
  });
});
describe("Practice Test review marks and ordering", () => {
  it("keeps answered and unanswered review marks test-local and persistent", () => {
    const d = testCorpus();
    const s = beginPracticeTest(d, "math:first", "untimed", start);
    const [unanswered, answered] = s.questionIds;
    toggleReviewMark(d, s.id, unanswered, start);
    saveTestDraft(d, s.id, answered, "A", start);
    toggleReviewMark(d, s.id, answered, start);
    expect(s.practiceTest!.markedForReview).toEqual([unanswered, answered]);
    expect(d.annotations).toEqual({});
    expect(restore(d).sessions[0].practiceTest!.markedForReview).toEqual([
      unanswered,
      answered,
    ]);
    toggleReviewMark(d, s.id, unanswered, start);
    expect(s.practiceTest!.markedForReview).toEqual([answered]);
    completeTestModule(d, s.id, start + 1000);
    expect(s.practiceTest!.markedForReview).toEqual([]);
  });
  it("orders R&W by Bluebook skill clusters and difficulty", () => {
    const base = testCorpus(1).questions.find(
      (q) => q.section === "reading-writing",
    )!;
    const item = (
      id: string,
      skill: string,
      difficulty: "easy" | "medium" | "hard" = "medium",
      domain = "Information and Ideas",
    ) => ({ ...base, id, skill, difficulty, domain });
    const selected = [
      item("rhetoric", "Rhetorical Synthesis", "easy", "Expression of Ideas"),
      item("transition", "Transitions", "hard", "Expression of Ideas"),
      item("form-medium", "Form, Structure, and Sense", "medium", "Standard English Conventions"),
      item("boundary-hard", "Boundaries", "hard", "Standard English Conventions"),
      item("boundary-easy", "Boundaries", "easy", "Standard English Conventions"),
      item("inference", "Inferences"),
      item("evidence-quant", "Command of Evidence: Quantitative", "hard"),
      item("evidence-text", "Command of Evidence: Textual", "easy"),
      item("central", "Central Ideas and Details"),
      item("cross", "Cross-Text Connections", "medium", "Craft and Structure"),
      item("structure", "Text Structure and Purpose", "medium", "Craft and Structure"),
      item("words", "Words in Context", "hard", "Craft and Structure"),
    ];
    const ordered = orderModuleQuestions(selected, "reading-writing");
    expect(ordered.map((q) => q.id)).toEqual([
      "words",
      "structure",
      "cross",
      "central",
      "evidence-text",
      "evidence-quant",
      "inference",
      "boundary-easy",
      "form-medium",
      "boundary-hard",
      "transition",
      "rhetoric",
    ]);
  });
  it("keeps Math domains mixed while difficulty generally rises", () => {
    const selected = testCorpus(12)
      .questions.filter((q) => q.section === "math")
      .slice(0, 12);
    const ordered = orderModuleQuestions(selected, "math");
    const rank = (difficulty: string | undefined) =>
      difficulty === "easy" ? 0 : difficulty === "hard" ? 2 : 1;
    expect(ordered.map((q) => rank(q.difficulty))).toEqual(
      ordered
        .map((q) => rank(q.difficulty))
        .slice()
        .sort(),
    );
    expect(
      ordered.slice(1).filter((q, index) => q.domain !== ordered[index].domain)
        .length,
    ).toBeGreaterThanOrEqual(ordered.length - 3);
  });
});
describe("adaptive routing and Full Test progression", () => {
  it.each([
    [12, "lower"],
    [13, "higher"],
  ] as const)(
    "routes %i/20 medium scored items to %s at a deterministic boundary",
    (correct, expected) => {
      const d = testCorpus();
      d.questions.forEach((q) => {
        q.difficulty = "medium";
        q.domain = "One";
      });
      const s = beginPracticeTest(d, "math:first", "untimed", start);
      const m = s.practiceTest!.modules[0],
        ids = m.questionIds.filter((id) => !m.unscoredIds.includes(id));
      ids.forEach((id, i) =>
        saveTestDraft(d, s.id, id, i < correct ? "A" : "B", start),
      );
      completeTestModule(d, s.id, start + 1000);
      expect(routeModule(d, s, m)).toBe(expected);
      expect(routeModule(d, s, m)).toBe(expected);
    },
  );
  it("weights difficulty and domain balance and ignores unscored performance for routing", () => {
    const d = testCorpus(),
      s = beginPracticeTest(d, "math:first", "untimed", start);
    const m = s.practiceTest!.modules[0];
    answerModule(d, s);
    m.unscoredIds.forEach((id) => saveTestDraft(d, s.id, id, "B", start));
    completeTestModule(d, s.id, start + 1000);
    expect(routeModule(d, s, m)).toBe("higher");
    d.attempts.forEach((a) => (a.correct = false));
    expect(routeModule(d, s, m)).toBe("lower");
  });
  it("persists sequence, both routes, answer locks, break and a 98-question final result", () => {
    let d = testCorpus();
    let s = beginPracticeTest(d, "full", "timed", start, seededRandom());
    answerModule(d, s);
    completeTestModule(d, s.id, start + 1000, seededRandom(9));
    expect(s.practiceTest!.routes["reading-writing"]).toBe("higher");
    const locked = s.practiceTest!.modules[0].questionIds[0];
    const old = s.drafts[locked];
    saveTestDraft(d, s.id, locked, "B", start + 1000);
    expect(s.drafts[locked]).toBe(old);
    const saved = structuredClone(s.practiceTest);
    d = restore(d);
    s = d.sessions[0];
    expect(s.practiceTest).toEqual(saved);
    completeTestModule(d, s.id, start + 2000);
    expect(s.practiceTest!.phase).toBe("break");
    s.practiceTest!.breakStartedAt = start + 2000;
    d = restore(d);
    s = d.sessions[0];
    expect(s.practiceTest!.breakStartedAt).toBe(start + 2000);
    continueAfterBreak(d, s.id, start + 3000);
    expect(s.practiceTest!.currentModule).toBe(2);
    completeTestModule(d, s.id, start + 4000);
    expect(s.practiceTest!.routes.math).toBe("lower");
    completeTestModule(d, s.id, start + 5000);
    expect(s.practiceTest!.phase).toBe("results");
    renameSession(d, s.id, "Completed adaptive benchmark");
    expect(s.questionIds).toHaveLength(98);
    expect(new Set(s.questionIds).size).toBe(98);
    expect(s.practiceTest!.modules.map((m) => m.section)).toEqual([
      "reading-writing",
      "reading-writing",
      "math",
      "math",
    ]);
    expect(scoredSummary(d, s).scored).toBe(90);
    expect(
      scoredSummary(
        d,
        s,
        s.practiceTest!.modules.filter((m) => m.section === "math"),
      ).scored,
    ).toBe(40);
    expect(
      scoredSummary(
        d,
        s,
        s.practiceTest!.modules.filter((m) => m.section === "reading-writing"),
      ).scored,
    ).toBe(50);
    expect(restore(d).sessions[0]).toMatchObject({
      name: "Completed adaptive benchmark",
      practiceTest: s.practiceTest,
    });
    expect(
      estimatedRange(d, s, "math")!.every((n) => n >= 200 && n <= 800),
    ).toBe(true);
    expect(
      estimatedRange(d, s, "reading-writing")!.every(
        (n) => n >= 200 && n <= 800,
      ),
    ).toBe(true);
  });
});
describe("exposure, reset and backup compatibility", () => {
  it("round-trips ordinary study, resumable test state, exposure, and preferences", async () => {
    const d = testCorpus();
    d.imports.push({
      id: "synthetic-import",
      filename: "synthetic.json",
      importedAt: new Date(start).toISOString(),
      added: d.questions.length,
      skipped: 0,
    });
    const ordinary = beginSession(
      d,
      d.questions.slice(0, 2).map((question) => question.id),
      defaultFilters,
      "Saved ordinary set",
    );
    ordinary.starred = true;
    ordinary.elapsed[ordinary.questionIds[0]] = 4321;
    ordinary.drafts[ordinary.questionIds[1]] = "B";
    submitAnswer(d, ordinary.id, ordinary.questionIds[0], "A");
    d.annotations[ordinary.questionIds[0]] = {
      bookmarked: true,
      note: "",
    };

    const test = beginPracticeTest(
      d,
      "full",
      "timed",
      start,
      seededRandom(),
    );
    renameSession(d, test.id, "Portable baseline");
    test.starred = true;
    const marked = test.questionIds[0];
    saveTestDraft(d, test.id, marked, "A", start + 1000);
    toggleReviewMark(d, test.id, marked, start + 1000);
    pausePracticeTest(d, test.id, start + 5000);
    const exposed = [...d.practiceTestUsedIds!];
    const modules = structuredClone(test.practiceTest!.modules);

    // The snapshot shape the validators accept (also what Reset's undo relies on).
    const payload = {
      format: "sat-study-backup-v1",
      preferences: {
        theme: "dark",
        originalPdf: true,
        timerDefault: false,
        showCorrectExplanations: true,
        protectTests: false,
      },
      data: d,
    };
    const restored = parseBackupPayload(payload);
    expect(restored.preferences).toEqual({
      theme: "dark",
      originalPdf: true,
      timerDefault: false,
      showCorrectExplanations: true,
      protectTests: false,
    });
    expect(restored.data.imports).toEqual(d.imports);
    expect(restored.data.attempts).toEqual(d.attempts);
    expect(restored.data.annotations).toEqual(d.annotations);
    expect(restored.data.sessions.find((session) => session.id === ordinary.id))
      .toMatchObject({
        name: "Saved ordinary set",
        starred: true,
        paused: true,
        drafts: ordinary.drafts,
        elapsed: ordinary.elapsed,
      });
    const restoredTest = restored.data.sessions.find(
      (session) => session.id === test.id,
    )!;
    expect(restoredTest).toMatchObject({
      name: "Portable baseline",
      starred: true,
      paused: true,
    });
    expect(restoredTest.practiceTest!.modules).toEqual(modules);
    expect(restoredTest.practiceTest!.markedForReview).toEqual([marked]);
    expect(restored.data.practiceTestUsedIds).toEqual(exposed);
    expect(
      unusedPool(restored.data, "reading-writing").some((question) =>
        exposed.includes(question.id),
      ),
    ).toBe(false);
  });

  it("does not restore completed-module review marks as historical state", () => {
    const d = testCorpus();
    const session = beginPracticeTest(
      d,
      "math:first",
      "untimed",
      start,
      seededRandom(),
    );
    const completedId = session.questionIds[0];
    completeTestModule(d, session.id, start + 1000);
    session.practiceTest!.markedForReview = [completedId];
    session.practiceTest!.reviewingModule = true;
    const restored = restore(d).sessions[0].practiceTest!;
    expect(restored.phase).toBe("results");
    expect(restored.markedForReview).toEqual([]);
    expect(restored.reviewingModule).toBe(false);
  });

  it("does not recycle abandoned/deleted test questions or consume eligibility with ordinary Practice", () => {
    const d = testCorpus(),
      ordinary = beginSession(
        d,
        d.questions.slice(0, 10).map((q) => q.id),
        defaultFilters,
      );
    submitAnswer(d, ordinary.id, ordinary.questionIds[0], "A");
    finishSession(d, ordinary.id);
    expect(unusedPool(d, "reading-writing")).toHaveLength(180);
    const test = beginPracticeTest(
      d,
      "reading-writing:first",
      "untimed",
      start,
    );
    const ids = [...test.questionIds];
    deleteSession(d, test.id);
    expect(unusedPool(d, "reading-writing")).toHaveLength(153);
    const next = beginPracticeTest(d, "full", "untimed", start);
    expect(next.questionIds.some((id) => ids.includes(id))).toBe(false);
    expect(() => submitAnswer(d, next.id, next.questionIds[0], "A")).toThrow();
    expect(() => finishSession(d, next.id)).toThrow();
    const archive = createResetArchive(d);
    resetStudyProgress(d);
    expect(unusedPool(d, "reading-writing")).toHaveLength(180);
    Object.assign(d, validateResetArchive(archive, d).study);
    expect(unusedPool(d, "reading-writing")).toHaveLength(126);
  });
  it("atomically archives and restores test eligibility in IndexedDB", async () => {
    await updateData((d) => Object.assign(d, testCorpus()));
    await updateData((d) => {
      beginPracticeTest(d, "math:first", "untimed", start);
    });
    await updateData((d) => resetStudyProgress(d), { resetArchive: "save" });
    expect((await readResetArchive())!.study.practiceTestUsedIds).toHaveLength(
      22,
    );
    const restored = await updateData(() => {}, { resetArchive: "restore" });
    expect(unusedPool(restored, "math")).toHaveLength(158);
  });
  it("keeps old backups readable and pauses only ordinary timers", () => {
    const d = testCorpus();
    beginSession(d, [d.questions[0].id], defaultFilters);
    const oldEnvelope = {
      format: "sat-study-backup-v1",
      data: structuredClone(d),
    };
    delete oldEnvelope.data.practiceTestUsedIds;
    const parsed = parseBackupPayload(oldEnvelope);
    const next = parsed.data;
    expect(next.sessions[0].practiceTest).toBeUndefined();
    expect(next.sessions[0].paused).toBe(true);
    expect(next.practiceTestUsedIds).toEqual([]);
    expect(parsed.preferences).toBeUndefined();
  });
  it.each([
    "unscored",
    "count",
    "section",
    "clock",
    "phase",
    "route",
    "ledger",
  ] as const)("rejects malformed %s metadata", (kind) => {
    const d = testCorpus();
    const s = beginPracticeTest(d, "full", "timed", start);
    const m = s.practiceTest!.modules[0];
    if (kind === "unscored")
      m.unscoredIds = [m.questionIds[0], m.questionIds[0]];
    if (kind === "count") m.questionIds.pop();
    if (kind === "section") m.section = "math";
    if (kind === "clock") m.startedAt = NaN;
    if (kind === "phase") s.practiceTest!.phase = "results";
    if (kind === "route")
      (s.practiceTest!.routes as Record<string, string>).math = "official";
    if (kind === "ledger") d.practiceTestUsedIds = ["nonexistent"];
    expect(() => restore(d)).toThrow(/Practice Test/);
  });
});

describe("scarce difficulty metadata and routing calibration", () => {
  it("never constructs a Module 2 containing only Easy or only Hard", () => {
    for (const difficulty of ["easy", "hard"] as const) {
      const d = testCorpus();
      d.questions.forEach((q) => (q.difficulty = difficulty));
      expect(availability(d, "full")).toMatch(/different difficulty mix/);
      expect(availability(d, "math:higher")).toMatch(
        /different difficulty mix/,
      );
      expect(() => constructModule(d.questions, "math", "lower")).toThrow(
        /varied difficulty/,
      );
    }
  });
  it("protects scarce difficulty variety for both adaptive second modules", () => {
    const d = testCorpus(54);
    d.questions.forEach((q) => (q.difficulty = "hard"));
    for (const section of ["reading-writing", "math"] as const)
      d.questions
        .filter((q) => q.section === section)
        .slice(0, 2)
        .forEach((q) => (q.difficulty = "medium"));
    const s = beginPracticeTest(d, "full", "untimed", start, seededRandom());
    completeTestModule(d, s.id, start + 1000, seededRandom());
    completeTestModule(d, s.id, start + 2000, seededRandom());
    continueAfterBreak(d, s.id, start + 3000, seededRandom());
    completeTestModule(d, s.id, start + 4000, seededRandom());
    for (const m of s.practiceTest!.modules.filter((m) => m.mix !== "first"))
      expect(
        m.questionIds.some(
          (id) => d.questions.find((q) => q.id === id)!.difficulty === "medium",
        ),
      ).toBe(true);
  });
  it("uses difficulty weights and domain balance beyond raw accuracy", () => {
    const d = testCorpus();
    d.questions.forEach((q) => {
      q.difficulty = "medium";
      q.domain = "One";
    });
    const s = beginPracticeTest(d, "math:first", "untimed", start),
      m = s.practiceTest!.modules[0];
    const ids = m.questionIds.filter((id) => !m.unscoredIds.includes(id));
    ids.forEach((id, i) =>
      saveTestDraft(d, s.id, id, i < 13 ? "A" : "B", start),
    );
    completeTestModule(d, s.id, start + 1000);
    expect(routeModule(d, s, m)).toBe("higher");
    ids.forEach(
      (id, i) =>
        (d.questions.find((q) => q.id === id)!.difficulty =
          i < 13 ? "easy" : "hard"),
    );
    expect(routeModule(d, s, m)).toBe("lower");
    ids.forEach(
      (id, i) =>
        (d.questions.find((q) => q.id === id)!.difficulty =
          i < 13 ? "hard" : "easy"),
    );
    expect(routeModule(d, s, m)).toBe("higher");
    ids.forEach((id, i) => {
      const q = d.questions.find((q) => q.id === id)!;
      q.difficulty = "medium";
      q.domain = i < 13 ? "One" : "Two";
    });
    expect(routeModule(d, s, m)).toBe("lower");
  });
});

it("reserves difficulty variety as well as capacity across competing attempts", () => {
  const d = testCorpus();
  d.questions.forEach((q) => (q.difficulty = "hard"));
  for (const section of ["reading-writing", "math"] as const)
    d.questions
      .filter((q) => q.section === section)
      .slice(0, 2)
      .forEach((q) => (q.difficulty = "medium"));
  const full = beginPracticeTest(d, "full", "untimed", start, seededRandom());
  expect(availability(d, "math:lower")).toMatch(/different difficulty mix/);
  expect(availability(d, "full")).toMatch(/different difficulty mix/);
  // Ordinary first-module selection may still use surplus Hard questions.
  beginPracticeTest(d, "math:first", "untimed", start, seededRandom());
  completeTestModule(d, full.id, start + 1000, seededRandom());
  completeTestModule(d, full.id, start + 2000, seededRandom());
  continueAfterBreak(d, full.id, start + 3000, seededRandom());
  completeTestModule(d, full.id, start + 4000, seededRandom());
  expect(
    full.practiceTest!.modules[3].questionIds.some(
      (id) => d.questions.find((q) => q.id === id)!.difficulty === "medium",
    ),
  ).toBe(true);
});
