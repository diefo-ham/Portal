import { describe, expect, it } from "vitest";
import { backfillAssessments } from "../src/core/assessments";
import { deleteSession } from "../src/core/commands";
import { defaultFilters, emptyData, type StudyData } from "../src/core/model";
import { filterQuestions } from "../src/core/practice";
import { reviewQueues } from "../src/core/review";
import {
  allocateCounts,
  beginTimedTest,
  buildTimedTestIds,
  completeTimedTest,
  currentSegment,
  endTimedSegment,
  goToTimedQuestion,
  pauseTimedTest,
  planSegments,
  resumeTimedTest,
  saveTimedAnswer,
  segmentElapsed,
  startNextTimedSegment,
  timedExpired,
  timedRemaining,
  timedSummary,
  timedTestPool,
  toggleTimedMark,
} from "../src/core/timedTest";
import { parseBackup } from "../src/importing/backup";
import { parseQuestions } from "../src/importing/json";

const question = (
  id: string,
  section: string,
  extra: Record<string, unknown> = {},
) => ({
  id: `paa-${id}`,
  assessment: "PAA",
  section,
  domain: "Dominio",
  skill: "Destreza",
  difficulty: "medium",
  stem: `Pregunta ${id}`,
  choices: [
    { id: "A", text: "A" },
    { id: "B", text: "B" },
  ],
  answer: { type: "choice", value: "B" },
  testStatus: "unknown",
  ...extra,
});
const grid = (id: string, accepted = ["2"]) =>
  question(id, "matematicas", {
    choices: undefined,
    answer: { type: "numeric", accepted },
  });

/** A small PAA bank, in bank order, with the parts mixed on purpose. */
const bank = (): StudyData => {
  const data = emptyData();
  data.questions = parseQuestions({
    schemaVersion: 1,
    questions: [
      question("m1", "matematicas"),
      grid("g1"),
      question("l1", "lectura", { passageGroup: "r1" }),
      question("l2", "lectura", { passageGroup: "r1" }),
      question("l3", "lectura", { passageGroup: "r1" }),
      question("l4", "lectura", { passageGroup: "r2" }),
      question("l5", "lectura", { passageGroup: "r2" }),
      question("r1", "redaccion"),
      question("m2", "matematicas"),
      grid("g2", ["3"]),
      question("i1", "ingles"),
      question("i2", "ingles"),
    ],
  });
  return backfillAssessments(data);
};
const NOW = 1_000_000;
const MIN = 60_000;
const ALL = ["lectura", "redaccion", "matematicas", "ingles"] as const;

describe("building a test", () => {
  it("puts the parts in PAA order, keeps bank order, and puts grid-ins last in Matemáticas", () => {
    const data = bank();
    const pool = timedTestPool(
      data,
      ["lectura", "redaccion", "matematicas"],
      false,
    );
    expect(buildTimedTestIds(data, pool, 100)).toEqual([
      "paa-l1",
      "paa-l2",
      "paa-l3",
      "paa-l4",
      "paa-l5",
      "paa-r1",
      "paa-m1",
      "paa-m2",
      "paa-g1",
      "paa-g2",
    ]);
  });

  it("keeps whole readings together when fewer questions are wanted", () => {
    const data = bank();
    const pool = timedTestPool(data, ["lectura"], false);
    for (let seed = 1; seed <= 25; seed++) {
      let state = seed;
      const random = () => (state = (state * 48271) % 2147483647) / 2147483647;
      expect(buildTimedTestIds(data, pool, 3, random)).toEqual([
        "paa-l1",
        "paa-l2",
        "paa-l3",
      ]);
      expect(buildTimedTestIds(data, pool, 2, random)).toEqual([
        "paa-l4",
        "paa-l5",
      ]);
      // 4 cannot be made of whole readings: the nearest size below is used.
      expect(buildTimedTestIds(data, pool, 4, random)).toHaveLength(3);
    }
  });

  it("can leave out what was already answered", () => {
    const data = bank();
    data.attempts.push({
      id: "a",
      questionId: "paa-m1",
      assessment: "PAA",
      answer: "B",
      correct: true,
      durationMs: 1,
      submittedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(timedTestPool(data, ["matematicas"], true).map((q) => q.id)).toEqual(
      ["paa-g1", "paa-m2", "paa-g2"],
    );
    expect(timedTestPool(data, ["matematicas"], false)).toHaveLength(4);
  });

  it("shares the questions between parts by their real sizes", () => {
    // Lectura y Redacción 70 : Matemáticas 55 : Inglés 50.
    expect(allocateCounts(["lectura", "matematicas"], [49, 45], 50)).toEqual([
      28, 22,
    ]);
    expect(allocateCounts(["matematicas", "ingles"], [45, 42], 21)).toEqual([
      11, 10,
    ]);
    expect(allocateCounts(["lectura", "redaccion"], [49, 18], 67)).toEqual([
      49, 18,
    ]);
    const [lectura, redaccion] = allocateCounts(
      ["lectura", "redaccion"],
      [49, 21],
      35,
    );
    expect(lectura + redaccion).toBe(35);
    expect(lectura).toBeGreaterThan(redaccion);
    // Never more than a part has: the rest goes to the other parts.
    expect(allocateCounts(["lectura", "matematicas"], [3, 45], 20)).toEqual([
      3, 17,
    ]);
    expect(allocateCounts(["ingles"], [42], 99)).toEqual([42]);
  });

  it("plans the separately timed parts at the real pace", () => {
    const data = bank();
    const plan = planSegments(timedTestPool(data, [...ALL], false), 99);
    // Lectura and Redacción are timed together; each part at its real pace.
    expect(plan.map((p) => [p.key, p.questions])).toEqual([
      ["lectura-redaccion", 6],
      ["matematicas", 4],
      ["ingles", 2],
    ]);
    expect(plan.map((p) => p.minutes)).toEqual([
      Math.ceil((6 * 80) / 70),
      Math.ceil((4 * 60) / 55),
      Math.ceil(2 * (40 / 50)),
    ]);
    // Only the chosen parts get a clock.
    expect(
      planSegments(timedTestPool(data, ["ingles"], false), 99).map(
        (p) => p.key,
      ),
    ).toEqual(["ingles"]);
    expect(planSegments([], 5)).toEqual([]);
  });
});

describe("a test in parts", () => {
  const start = (
    limits: Record<string, number> | null = {
      "lectura-redaccion": 10,
      matematicas: 5,
      ingles: 2,
    },
  ) => {
    const data = bank();
    const session = beginTimedTest(
      data,
      {
        parts: [...ALL],
        count: 99,
        ...(limits === null ? {} : { limitMinutes: limits }),
        unusedOnly: false,
      },
      NOW,
    );
    return { data, session, test: session.timedTest! };
  };

  it("makes one clocked part for each separately timed part, in order", () => {
    const { session, test } = start();
    expect(session.assessment).toBe("PAA");
    expect(session.name).toBe(
      "Modo de prueba · Lectura, Redacción, Matemáticas, Inglés",
    );
    expect(test.segments.map((s) => s.key)).toEqual([
      "lectura-redaccion",
      "matematicas",
      "ingles",
    ]);
    expect(test.segments.map((s) => s.limitMs)).toEqual([
      10 * MIN,
      5 * MIN,
      2 * MIN,
    ]);
    expect(test.segments.map((s) => s.questionIds.length)).toEqual([6, 4, 2]);
    expect(session.questionIds).toEqual(
      test.segments.flatMap((s) => s.questionIds),
    );
    // Only the first part's clock is running.
    expect(test.segments[0].startedAt).toBe(NOW);
    expect(test.segments[1].startedAt).toBeUndefined();
    expect(test).toMatchObject({ current: 0, phase: "segment", version: 2 });
  });

  it("has no clock for a part left out", () => {
    const data = bank();
    const session = beginTimedTest(
      data,
      { parts: ["ingles", "matematicas"], count: 99, unusedOnly: false },
      NOW,
    );
    expect(session.timedTest!.segments.map((s) => s.key)).toEqual([
      "matematicas",
      "ingles",
    ]);
  });

  it("allows one unfinished test at a time", () => {
    const { data } = start();
    expect(() =>
      beginTimedTest(data, { parts: ["ingles"], count: 2, unusedOnly: false }),
    ).toThrow("Termina o elimina");
  });

  it("counts down on its own clock, stops while paused, and expires", () => {
    const { data, session, test } = start();
    expect(timedRemaining(test, NOW + MIN)).toBe(9 * MIN);
    pauseTimedTest(data, session.id, NOW + 2 * MIN);
    expect(timedRemaining(test, NOW + 50 * MIN)).toBe(8 * MIN);
    expect(timedExpired(session, NOW + 99 * MIN)).toBe(false);
    resumeTimedTest(data, session.id, NOW + 50 * MIN);
    expect(timedRemaining(test, NOW + 50 * MIN)).toBe(8 * MIN);
    expect(timedExpired(session, NOW + 50 * MIN + 8 * MIN - 1000)).toBe(false);
    expect(timedExpired(session, NOW + 50 * MIN + 8 * MIN)).toBe(true);
    expect(segmentElapsed(currentSegment(test), NOW + 999 * MIN)).toBe(
      10 * MIN,
    );
  });

  it("just counts up when untimed", () => {
    const { session, test } = start(null);
    expect(currentSegment(test).limitMs).toBeUndefined();
    expect(timedRemaining(test, NOW + 90_000)).toBeUndefined();
    expect(segmentElapsed(currentSegment(test), NOW + 90_000)).toBe(90_000);
    expect(timedExpired(session, NOW + 99_999_999)).toBe(false);
  });

  it("lets answers be changed, skipped and marked only inside the part being taken", () => {
    const { data, session, test } = start();
    saveTimedAnswer(data, session.id, "paa-l1", "A", NOW + 1000);
    saveTimedAnswer(data, session.id, "paa-l1", "B", NOW + 2000);
    expect(session.drafts["paa-l1"]).toBe("B");
    saveTimedAnswer(data, session.id, "paa-l1", "", NOW + 3000);
    expect(session.drafts["paa-l1"]).toBeUndefined();
    goToTimedQuestion(data, session.id, 3, NOW + 3000);
    expect(session.index).toBe(3);
    // Later parts are not open yet.
    const math = test.segments[1].questionIds[0];
    saveTimedAnswer(data, session.id, math, "A", NOW + 3000);
    goToTimedQuestion(
      data,
      session.id,
      session.questionIds.indexOf(math),
      NOW + 3000,
    );
    expect(session.drafts[math]).toBeUndefined();
    expect(session.index).toBe(3);
    toggleTimedMark(data, session.id, "paa-l2", NOW + 3000);
    toggleTimedMark(data, session.id, "paa-l4", NOW + 3000);
    toggleTimedMark(data, session.id, "paa-l2", NOW + 3000);
    toggleTimedMark(data, session.id, math, NOW + 3000);
    expect(test.marked).toEqual(["paa-l4"]);
    pauseTimedTest(data, session.id, NOW + 4000);
    saveTimedAnswer(data, session.id, "paa-l5", "A", NOW + 4500);
    expect(session.drafts["paa-l5"]).toBeUndefined();
    resumeTimedTest(data, session.id, NOW + 5000);
    saveTimedAnswer(data, session.id, "paa-l5", "A", NOW + 20 * MIN);
    expect(session.drafts["paa-l5"]).toBeUndefined();
  });

  it("locks a part when it ends, gives a break, and starts the next part's clock only on request", () => {
    const { data, session, test } = start();
    saveTimedAnswer(data, session.id, "paa-l1", "B", NOW + 1000);
    toggleTimedMark(data, session.id, "paa-l2", NOW + 1000);
    endTimedSegment(data, session.id, NOW + 3 * MIN);
    expect(test).toMatchObject({ phase: "break", current: 0, marked: [] });
    expect(test.segments[0]).toMatchObject({
      completedAt: NOW + 3 * MIN,
      durationMs: 3 * MIN,
    });
    expect(session.finishedAt).toBeUndefined();
    // Nothing runs or changes during the break.
    expect(timedRemaining(test, NOW + 99 * MIN)).toBeUndefined();
    expect(timedExpired(session, NOW + 99 * MIN)).toBe(false);
    saveTimedAnswer(data, session.id, "paa-l1", "A", NOW + 4 * MIN);
    saveTimedAnswer(
      data,
      session.id,
      test.segments[1].questionIds[0],
      "A",
      NOW + 4 * MIN,
    );
    expect(session.drafts["paa-l1"]).toBe("B");
    expect(session.drafts[test.segments[1].questionIds[0]]).toBeUndefined();
    // The next part starts when asked, however long the break was.
    startNextTimedSegment(data, session.id, NOW + 40 * MIN);
    expect(test).toMatchObject({ phase: "segment", current: 1 });
    expect(test.segments[1].startedAt).toBe(NOW + 40 * MIN);
    expect(session.questionIds[session.index]).toBe(
      test.segments[1].questionIds[0],
    );
    expect(timedRemaining(test, NOW + 41 * MIN)).toBe(4 * MIN);
    // The finished part stays locked.
    saveTimedAnswer(data, session.id, "paa-l1", "A", NOW + 41 * MIN);
    goToTimedQuestion(data, session.id, 0, NOW + 41 * MIN);
    expect(session.drafts["paa-l1"]).toBe("B");
    expect(session.index).not.toBe(0);
  });

  it("scores only what was answered when the last part ends, and keeps each part's time", () => {
    const { data, session, test } = start();
    saveTimedAnswer(data, session.id, "paa-l1", "B", NOW + 1000); // right
    saveTimedAnswer(data, session.id, "paa-l2", "A", NOW + 1000); // wrong
    endTimedSegment(data, session.id, NOW + 4 * MIN);
    startNextTimedSegment(data, session.id, NOW + 10 * MIN);
    saveTimedAnswer(data, session.id, "paa-g1", "2", NOW + 10 * MIN + 1000); // right
    saveTimedAnswer(data, session.id, "paa-g2", "9", NOW + 10 * MIN + 1000); // wrong
    session.drafts["paa-m1"] = "Z"; // not a valid choice: not an answer
    endTimedSegment(data, session.id, NOW + 12 * MIN);
    startNextTimedSegment(data, session.id, NOW + 12 * MIN);
    // Time runs out on the last part.
    endTimedSegment(data, session.id, NOW + 999 * MIN);
    expect(session.finishedAt).toBeDefined();
    expect(test.segments.map((s) => s.durationMs)).toEqual([
      4 * MIN,
      2 * MIN,
      2 * MIN,
    ]);
    expect(test.durationMs).toBe(8 * MIN);
    expect(data.attempts.map((a) => [a.questionId, a.correct])).toEqual([
      ["paa-l1", true],
      ["paa-l2", false],
      ["paa-g1", true],
      ["paa-g2", false],
    ]);
    expect(
      data.attempts.every(
        (a) => a.assessment === "PAA" && a.sessionId === session.id,
      ),
    ).toBe(true);
    const summary = timedSummary(data, session);
    expect(summary).toMatchObject({
      total: 12,
      correct: 2,
      incorrect: 2,
      unanswered: 8,
      percent: 17,
    });
    expect(summary.parts.map((p) => p.part)).toEqual([
      "lectura",
      "redaccion",
      "matematicas",
      "ingles",
    ]);
    expect(
      summary.segments.map((s) => [s.label, s.durationMs, s.limitMs]),
    ).toEqual([
      ["Lectura y Redacción", 4 * MIN, 10 * MIN],
      ["Matemáticas", 2 * MIN, 5 * MIN],
      ["Inglés", 2 * MIN, 2 * MIN],
    ]);
    // Finishing again changes nothing.
    completeTimedTest(data, session.id, NOW + 99 * MIN);
    endTimedSegment(data, session.id, NOW + 99 * MIN);
    expect(data.attempts).toHaveLength(4);
  });

  it("caps a part that is ended late at the time it was given", () => {
    const { data, session, test } = start();
    endTimedSegment(data, session.id, NOW + 999 * MIN);
    expect(test.segments[0].durationMs).toBe(10 * MIN);
  });

  it("can end the whole test early from any part", () => {
    const { data, session, test } = start();
    saveTimedAnswer(data, session.id, "paa-l1", "B", NOW + 1000);
    completeTimedTest(data, session.id, NOW + 2 * MIN);
    expect(session.finishedAt).toBeDefined();
    expect(test.segments[0].durationMs).toBe(2 * MIN);
    expect(data.attempts).toHaveLength(1);
  });

  it("keeps an unfinished test out of 'left unanswered' until it ends", () => {
    const { data, session } = start();
    expect(reviewQueues(data, false).unanswered).toEqual([]);
    completeTimedTest(data, session.id, NOW + 1000);
    expect(reviewQueues(data, false).unanswered.length).toBe(12);
  });

  it("keeps answers in the history when its result is deleted", () => {
    const { data, session } = start();
    saveTimedAnswer(data, session.id, "paa-l1", "B", NOW + 1000);
    completeTimedTest(data, session.id, NOW + 2000);
    deleteSession(data, session.id);
    expect(data.sessions).toHaveLength(0);
    expect(data.attempts).toHaveLength(1);
    expect(data.attempts[0].sessionId).toBeUndefined();
  });
});

describe("a test saved with a single clock", () => {
  it("becomes one part when the data is read", () => {
    const data = bank();
    const session = beginTimedTest(
      data,
      { parts: ["lectura"], count: 5, unusedOnly: true },
      NOW,
    );
    // The shape this feature had before parts were timed separately.
    (session as unknown as { timedTest: unknown }).timedTest = {
      version: 1,
      parts: ["lectura"],
      limitMs: 30 * MIN,
      startedAt: NOW,
      pausedAt: NOW + 5 * MIN,
      marked: [],
      unusedOnly: true,
    };
    backfillAssessments(data);
    const test = session.timedTest!;
    expect(test.version).toBe(2);
    expect(test.segments).toHaveLength(1);
    expect(test.segments[0]).toMatchObject({
      key: "lectura-redaccion",
      limitMs: 30 * MIN,
      startedAt: NOW,
      pausedAt: NOW + 5 * MIN,
    });
    expect(test.segments[0].questionIds).toEqual(session.questionIds);
    expect(test).toMatchObject({ current: 0, phase: "segment" });
  });
});

describe("test mode in backups", () => {
  const withTest = () => {
    const data = bank();
    const session = beginTimedTest(
      data,
      {
        parts: [...ALL],
        count: 99,
        limitMinutes: { "lectura-redaccion": 30, matematicas: 20, ingles: 10 },
        unusedOnly: true,
      },
      NOW,
    );
    return { data, session };
  };
  const backup = (data: StudyData) =>
    JSON.parse(JSON.stringify({ format: "sat-study-backup-v1", data }));

  it("restores an unfinished part paused, with its clock stopped", () => {
    const { data } = withTest();
    const session = parseBackup(backup(data)).sessions[0];
    expect(session.paused).toBe(true);
    expect(session.timedTest?.segments[0].pausedAt).toBeTypeOf("number");
  });

  it("restores a break as a break: nothing to pause", () => {
    const { data, session } = withTest();
    endTimedSegment(data, session.id, NOW + MIN);
    const restored = parseBackup(backup(data)).sessions[0];
    expect(restored.paused).toBe(false);
    expect(restored.timedTest).toMatchObject({ phase: "break", current: 0 });
  });

  it("restores a finished test as it was", () => {
    const { data, session } = withTest();
    completeTimedTest(data, session.id, NOW + 1000);
    const restored = parseBackup(backup(data)).sessions[0];
    expect(restored.timedTest?.durationMs).toBe(1000);
    expect(restored.timedTest?.segments[0].pausedAt).toBeUndefined();
  });

  it("rejects a malformed test", () => {
    const { data } = withTest();
    const wrong = (change: (test: any) => void) => {
      const bad = backup(data);
      change(bad.data.sessions[0].timedTest);
      expect(() => parseBackup(bad)).toThrow("Invalid timed test");
    };
    wrong((t) => (t.marked = ["paa-not-in-session"]));
    wrong((t) => (t.startedAt = "yesterday"));
    wrong((t) => (t.current = 9));
    wrong((t) => (t.phase = "lunch"));
    wrong((t) => (t.segments[0].questionIds = ["paa-l1"]));
    wrong((t) => (t.segments[1].key = "física"));
    wrong((t) => (t.segments = []));
  });
});

describe("choosing several parts at once", () => {
  const data = bank();
  const ids = (sections: string[], section = "") =>
    filterQuestions(data, {
      ...defaultFilters,
      active: "include",
      statuses: [],
      section,
      sections,
    }).map((q) => q.section);

  it("includes every selected part and nothing else", () => {
    expect([...new Set(ids(["lectura", "ingles"]))].sort()).toEqual([
      "ingles",
      "lectura",
    ]);
  });
  it("means every part when none is selected", () => {
    expect(new Set(ids([])).size).toBe(4);
  });
  it("still understands the old single-part filter saved in earlier sessions", () => {
    expect(new Set(ids([], "redaccion"))).toEqual(new Set(["redaccion"]));
  });
});
