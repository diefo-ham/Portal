import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  assessmentOfId,
  assessmentOfSection,
  backfillAssessments,
  scopeStudyData,
} from "../src/core/assessments";
import {
  beginSession,
  deleteSession,
  resetStudyProgress,
  submitAnswer,
} from "../src/core/commands";
import {
  defaultFilters,
  emptyData,
  type Question,
  type StudyData,
} from "../src/core/model";
import {
  isCorrect,
  selectSessionQuestionIds,
  selectSessionQuestions,
} from "../src/core/practice";
import { performanceOverview } from "../src/core/review";
import { mergeQuestions, parseQuestions } from "../src/importing/json";
import { parseBackup } from "../src/importing/backup";
import { readData, readResetArchive, updateData } from "../src/storage/database";
import { removeQuestionLibrary } from "../src/storage/localData";
import { taxonomyOptions } from "../src/core/taxonomy";
import sample from "./fixtures/synthetic.json";

const paaQuestion = (id: string, extra: Record<string, unknown> = {}) => ({
  id: `paa-${id}`,
  assessment: "PAA",
  section: "matematicas",
  domain: "Álgebra",
  skill: "Ecuaciones",
  difficulty: "medium",
  stem: "Un enunciado sintético.",
  choices: [
    { id: "A", text: "Opción A" },
    { id: "B", text: "Opción B" },
  ],
  answer: { type: "choice", value: "B" },
  testStatus: "unknown",
  source: "PAA: banco de preguntas",
  sourceId: id,
  ...extra,
});
const grid = (id: string, accepted: string[]) =>
  paaQuestion(id, {
    choices: undefined,
    answer: { type: "numeric", accepted },
  });
const parse = (...questions: unknown[]) =>
  parseQuestions({ schemaVersion: 1, questions });

/** SAT study data (the synthetic examples) plus a few PAA questions. */
const both = (): StudyData => {
  const data = emptyData();
  data.questions = [
    ...parseQuestions(sample),
    ...parse(paaQuestion("p1"), paaQuestion("p2"), grid("g1", ["15/2", "7.5"])),
  ];
  return backfillAssessments(data);
};
const satId = (data: StudyData) =>
  data.questions.find((q) => q.assessment === "SAT")!.id;

describe("assessment on stored data", () => {
  it("treats everything stored before PAA support as SAT", () => {
    const old = emptyData();
    old.questions = parseQuestions(sample).map(
      ({ assessment: _drop, ...q }) => q as Question,
    );
    old.attempts.push({
      id: "a1",
      questionId: old.questions[0].id,
      answer: "A",
      correct: true,
      durationMs: 1,
      submittedAt: "2026-01-01T00:00:00.000Z",
    });
    old.sessions.push({
      id: "s1",
      questionIds: [old.questions[0].id],
      index: 0,
      startedAt: "2026-01-01T00:00:00.000Z",
      filters: defaultFilters,
      drafts: {},
      elapsed: {},
      paused: false,
    });
    backfillAssessments(old);
    expect(old.questions.every((q) => q.assessment === "SAT")).toBe(true);
    expect(old.attempts[0].assessment).toBe("SAT");
    expect(old.sessions[0].assessment).toBe("SAT");
  });

  it("backfills when data is read from storage, without changing it", async () => {
    const legacy = emptyData();
    legacy.questions = parseQuestions(sample).map(
      ({ assessment: _drop, ...q }) => q as Question,
    );
    await updateData((d) => Object.assign(d, legacy));
    const read = await readData();
    expect(read.questions.every((q) => q.assessment === "SAT")).toBe(true);
    expect(read.questions).toHaveLength(legacy.questions.length);
  });

  it("knows which test an orphaned ID or part belongs to", () => {
    expect(assessmentOfId("paa-abc")).toBe("PAA");
    expect(assessmentOfId("cb-abc")).toBe("SAT");
    expect(assessmentOfSection("ingles")).toBe("PAA");
    expect(assessmentOfSection("math")).toBe("SAT");
    expect(assessmentOfSection("physics")).toBeUndefined();
  });
});

describe("one question ID can never mean two tests", () => {
  it("requires PAA IDs to carry the paa- prefix and keeps it out of SAT IDs", () => {
    expect(() =>
      parse({ ...paaQuestion("x1"), id: "x1" }),
    ).toThrow('PAA question IDs must start with "paa-"');
    expect(() =>
      parse({
        id: "paa-looks-like-paa",
        section: "math",
        stem: "s",
        answer: { type: "numeric", accepted: ["1"] },
      }),
    ).toThrow('only PAA question IDs may start with "paa-"');
  });

  it("rejects a part from the wrong test, and an unknown assessment", () => {
    expect(() => parse({ ...paaQuestion("x2"), section: "math" })).toThrow(
      "does not belong to PAA",
    );
    expect(() => parse({ ...paaQuestion("x3"), assessment: "ACT" })).toThrow(
      "assessment must be SAT or PAA",
    );
  });

  it("keeps the same source ID from two tests apart when merging", () => {
    const sat = parseQuestions({
      schemaVersion: 1,
      questions: [
        {
          id: "cb-e6b4a14d",
          source: "S",
          sourceId: "e6b4a14d",
          section: "math",
          stem: "SAT stem",
          answer: { type: "numeric", accepted: ["1"] },
        },
      ],
    });
    const paa = parse({
      ...paaQuestion("e6b4a14d"),
      source: "S",
      sourceId: "e6b4a14d",
    });
    const merged = mergeQuestions(sat, paa, "banco.pdf");
    expect(merged.added).toBe(1);
    expect(merged.skipped).toBe(0);
    expect(merged.questions.map((q) => q.id)).toEqual([
      "cb-e6b4a14d",
      "paa-e6b4a14d",
    ]);
    // Importing the same PAA question again is skipped, never duplicated.
    expect(mergeQuestions(merged.questions, paa, "again.pdf").skipped).toBe(1);
  });

  it("refuses an import whose ID clashes with different content, instead of overwriting", () => {
    const first = parse(paaQuestion("clash"));
    // Same internal ID, different source question: never silently replaced.
    const clashing = parse({
      ...paaQuestion("clash"),
      sourceId: "another",
      stem: "Otro enunciado.",
    });
    expect(() => mergeQuestions(first, clashing, "x.pdf")).toThrow(
      "ID collision",
    );
    // The same source question with new text keeps the stored one (existing policy).
    const revised = parse({ ...paaQuestion("clash"), stem: "Otro enunciado." });
    expect(mergeQuestions(first, revised, "x.pdf").skipped).toBe(1);
  });
});

describe("progress stays separate per assessment", () => {
  it("scopes questions, answers, sessions and bookmarks", () => {
    const data = both();
    const sat = satId(data);
    beginSession(data, [sat], defaultFilters);
    beginSession(data, ["paa-p1"], defaultFilters);
    submitAnswer(data, data.sessions[0].id, sat, "A");
    submitAnswer(data, data.sessions[1].id, "paa-p1", "B");
    data.annotations[sat] = { bookmarked: true, note: "" };
    data.annotations["paa-p2"] = { bookmarked: true, note: "" };
    const paa = scopeStudyData(data, "PAA");
    expect(paa.questions.every((q) => q.assessment === "PAA")).toBe(true);
    expect(paa.attempts.map((a) => a.questionId)).toEqual(["paa-p1"]);
    expect(paa.sessions).toHaveLength(1);
    expect(Object.keys(paa.annotations)).toEqual(["paa-p2"]);
    const satView = scopeStudyData(data, "SAT");
    expect(satView.attempts.map((a) => a.questionId)).toEqual([sat]);
    expect(Object.keys(satView.annotations)).toEqual([sat]);
  });

  it("stamps the test on a session and its answers, and refuses a mixed session", () => {
    const data = both();
    const session = beginSession(data, ["paa-p1", "paa-p2"], defaultFilters);
    expect(session.assessment).toBe("PAA");
    submitAnswer(data, session.id, "paa-p1", "A");
    expect(data.attempts[0].assessment).toBe("PAA");
    expect(() =>
      beginSession(data, [satId(data), "paa-p1"], defaultFilters),
    ).toThrow("one test only");
  });

  it("keeps history of a removed question with its test", () => {
    const data = both();
    data.attempts.push({
      id: "orphan",
      questionId: "paa-gone",
      answer: "A",
      correct: false,
      durationMs: 1,
      submittedAt: "2026-01-01T00:00:00.000Z",
    });
    backfillAssessments(data);
    expect(data.attempts[0].assessment).toBe("PAA");
    expect(scopeStudyData(data, "SAT").attempts).toHaveLength(0);
  });

  it("resets one test and leaves the other and its bookmarks alone", () => {
    const data = both();
    const sat = satId(data);
    beginSession(data, [sat], defaultFilters);
    beginSession(data, ["paa-p1"], defaultFilters);
    submitAnswer(data, data.sessions[0].id, sat, "A");
    submitAnswer(data, data.sessions[1].id, "paa-p1", "B");
    data.annotations["paa-p1"] = { bookmarked: true, note: "" };
    data.annotations["paa-p2"] = { bookmarked: false, note: "" };
    resetStudyProgress(data, false, "PAA");
    expect(scopeStudyData(data, "PAA").attempts).toHaveLength(0);
    expect(scopeStudyData(data, "PAA").sessions).toHaveLength(0);
    expect(data.annotations["paa-p1"]).toEqual({ bookmarked: true, note: "" });
    expect(data.annotations["paa-p2"]).toBeUndefined();
    expect(scopeStudyData(data, "SAT").attempts).toHaveLength(1);
    expect(scopeStudyData(data, "SAT").sessions).toHaveLength(1);
    resetStudyProgress(data, true, "PAA");
    expect(data.annotations["paa-p1"]).toBeUndefined();
  });

  describe("in storage", () => {
    beforeEach(async () => {
      await updateData((d) => Object.assign(d, emptyData()));
    });

    it("saves and restores each test's reset archive separately", async () => {
      await updateData((d) => {
        d.questions = both().questions;
        const sat = satId(d);
        beginSession(d, [sat], defaultFilters);
        beginSession(d, ["paa-p1"], defaultFilters);
        submitAnswer(d, d.sessions[0].id, sat, "A");
        submitAnswer(d, d.sessions[1].id, "paa-p1", "B");
      });
      await updateData((d) => resetStudyProgress(d, false, "PAA"), {
        resetArchive: "save",
        assessment: "PAA",
      });
      expect((await readResetArchive("PAA"))?.assessment).toBe("PAA");
      expect(await readResetArchive("SAT")).toBeUndefined();
      // Study some SAT after the PAA reset: restoring PAA must not undo it.
      await updateData((d) => {
        beginSession(d, [satId(d)], defaultFilters);
      });
      const restored = await updateData(() => {}, {
        resetArchive: "restore",
        assessment: "PAA",
      });
      expect(scopeStudyData(restored, "PAA").attempts).toHaveLength(1);
      expect(scopeStudyData(restored, "SAT").sessions).toHaveLength(2);
    });

    it("removes one test's questions and keeps the other's and all answers", async () => {
      await updateData((d) => {
        d.questions = both().questions;
        d.imports.push({
          id: "i",
          filename: "f",
          importedAt: "2026-01-01T00:00:00.000Z",
          added: 1,
          skipped: 0,
        });
        beginSession(d, ["paa-p1"], defaultFilters);
        submitAnswer(d, d.sessions[0].id, "paa-p1", "B");
      });
      const after = await removeQuestionLibrary("PAA");
      expect(after.questions.every((q) => q.assessment === "SAT")).toBe(true);
      expect(after.questions.length).toBeGreaterThan(0);
      expect(after.sessions).toHaveLength(0);
      // The answer survives, still belonging to the PAA, without its session.
      expect(after.attempts).toHaveLength(1);
      expect(after.attempts[0].assessment).toBe("PAA");
      expect(after.attempts[0].sessionId).toBeUndefined();
    });
  });
});

describe("deleting a session", () => {
  const studied = () => {
    const data = both();
    const session = beginSession(data, ["paa-p1"], defaultFilters);
    submitAnswer(data, session.id, "paa-p1", "B");
    data.annotations["paa-p1"] = { bookmarked: true, note: "" };
    return { data, session };
  };
  it("keeps the answers in the history by default, without the session", () => {
    const { data, session } = studied();
    deleteSession(data, session.id);
    expect(data.sessions).toHaveLength(0);
    expect(data.attempts).toHaveLength(1);
    expect(data.attempts[0].sessionId).toBeUndefined();
  });
  it("can remove its answers too, and still keeps bookmarks and other sessions' answers", () => {
    const { data, session } = studied();
    const other = beginSession(data, ["paa-p2"], defaultFilters);
    submitAnswer(data, other.id, "paa-p2", "B");
    deleteSession(data, session.id, true);
    expect(data.attempts.map((a) => a.questionId)).toEqual(["paa-p2"]);
    expect(data.annotations["paa-p1"].bookmarked).toBe(true);
  });
});

describe("backups", () => {
  it("round-trips PAA questions and reads old SAT-only backups as SAT", () => {
    const data = both();
    const restored = parseBackup(
      JSON.parse(
        JSON.stringify({ format: "sat-study-backup-v1", data }),
      ),
    );
    expect(restored.questions.map((q) => q.assessment)).toEqual(
      data.questions.map((q) => q.assessment),
    );
    const legacy = emptyData();
    legacy.questions = parseQuestions(sample).map(
      ({ assessment: _drop, ...q }) => q as Question,
    );
    const read = parseBackup(
      JSON.parse(JSON.stringify({ format: "sat-study-backup-v1", data: legacy })),
    );
    expect(read.questions.every((q) => q.assessment === "SAT")).toBe(true);
  });
});

describe("PAA grid-in answers", () => {
  const paaGrid = (accepted: string[]) =>
    parse(grid("score", accepted))[0] as Question;
  const sat = parseQuestions({
    schemaVersion: 1,
    questions: [
      {
        id: "sat-grid",
        section: "math",
        stem: "s",
        answer: { type: "numeric", accepted: ["2/3"] },
      },
    ],
  })[0];

  it("accepts the printed forms of a two-form answer", () => {
    const q = paaGrid(["15/2", "7.5"]);
    for (const answer of ["15/2", "7.5", "7.50", " 7.5 ", "30/4"])
      expect(isCorrect(q, answer)).toBe(true);
    for (const answer of ["7", "7.4", "15/3"])
      expect(isCorrect(q, answer)).toBe(false);
  });

  it("accepts a decimal with at least three digits that is cut off or rounded correctly", () => {
    const q = paaGrid(["2/3"]);
    for (const answer of ["2/3", ".666", ".667", "0.666", "0.667", ".6666"])
      expect(isCorrect(q, answer)).toBe(true);
    for (const answer of [".66", ".67", ".665", ".668", "0.6"])
      expect(isCorrect(q, answer)).toBe(false);
    expect(isCorrect(paaGrid(["1/3"]), ".333")).toBe(true);
    expect(isCorrect(paaGrid(["1/3"]), ".334")).toBe(false);
    expect(isCorrect(paaGrid(["1/4"]), ".25")).toBe(true);
  });

  it("never accepts a negative answer", () => {
    expect(isCorrect(paaGrid(["5"]), "-5")).toBe(false);
    expect(isCorrect(paaGrid(["5"]), "−5")).toBe(false);
  });

  it("leaves the SAT rule unchanged: no rounding allowance", () => {
    expect(isCorrect(sat, "2/3")).toBe(true);
    expect(isCorrect(sat, ".666")).toBe(false);
    expect(isCorrect(sat, ".6666666667")).toBe(true);
  });
});

describe("shared readings in a session", () => {
  const items = (ids: [string, string?][]) =>
    parse(
      ...ids.map(([id, group]) =>
        paaQuestion(id, group ? { passageGroup: group } : {}),
      ),
    );
  const questions = items([
    ["a1", "g-a"],
    ["a2", "g-a"],
    ["a3", "g-a"],
    ["b1", "g-b"],
    ["b2", "g-b"],
    ["s1"],
    ["s2"],
  ]);
  const ids = questions.map((q) => q.id);

  it("keeps a reading's questions together and in their original order", () => {
    for (let seed = 0; seed < 30; seed++) {
      let state = seed + 1;
      const random = () => ((state = (state * 48271) % 2147483647) / 2147483647);
      const picked = selectSessionQuestionIds(questions, ids, 0, [], random);
      expect(picked).toHaveLength(ids.length);
      for (const group of [
        ["paa-a1", "paa-a2", "paa-a3"],
        ["paa-b1", "paa-b2"],
      ]) {
        const at = group.map((id) => picked.indexOf(id));
        expect(at).toEqual([at[0], at[0] + 1, at[0] + 2].slice(0, group.length));
      }
    }
  });

  it("chooses whole readings when the size allows and never exceeds the size", () => {
    for (let seed = 0; seed < 30; seed++) {
      let state = seed + 1;
      const random = () => ((state = (state * 48271) % 2147483647) / 2147483647);
      const picked = selectSessionQuestionIds(questions, ids, 4, [], random);
      expect(picked.length).toBeLessThanOrEqual(4);
      for (const group of [
        ["paa-a1", "paa-a2", "paa-a3"],
        ["paa-b1", "paa-b2"],
      ]) {
        const inside = group.filter((id) => picked.includes(id));
        expect([0, group.length]).toContain(inside.length);
      }
    }
  });

  it("keeps the first questions, in order, of a reading longer than the size", () => {
    const picked = selectSessionQuestionIds(
      questions.filter((q) => q.passageGroup === "g-a"),
      ["paa-a1", "paa-a2", "paa-a3"],
      2,
    );
    expect(picked).toEqual(["paa-a1", "paa-a2"]);
  });

  it("behaves exactly like the plain selection when nothing is grouped", () => {
    const plain = parse(paaQuestion("x1"), paaQuestion("x2"), paaQuestion("x3"));
    const order = plain.map((q) => q.id);
    const seeded = () => {
      let state = 7;
      return () => ((state = (state * 48271) % 2147483647) / 2147483647);
    };
    expect(selectSessionQuestionIds(plain, order, 2, [], seeded())).toEqual(
      selectSessionQuestions(order, 2, [], seeded()),
    );
  });
});

describe("PAA performance and labels", () => {
  it("shows the study guide's parts and domains, never the SAT's", () => {
    const data = both();
    const paa = performanceOverview(data, "PAA");
    expect(Object.keys(paa.sections)).toEqual([
      "lectura",
      "redaccion",
      "matematicas",
      "ingles",
    ]);
    expect(paa.domains.map((d) => d.domain)).toContain("Aritmética");
    expect(paa.domains.map((d) => d.domain)).not.toContain("Algebra");
    const sat = performanceOverview(data, "SAT");
    expect(Object.keys(sat.sections)).toEqual(["math", "reading-writing"]);
    expect(sat.domains.map((d) => d.domain)).not.toContain("Aritmética");
  });

  it("counts only this test's answers", () => {
    const data = both();
    beginSession(data, ["paa-p1"], defaultFilters);
    submitAnswer(data, data.sessions[0].id, "paa-p1", "B");
    expect(performanceOverview(data, "PAA").all.attempts).toBe(1);
    expect(performanceOverview(data, "SAT").all.attempts).toBe(0);
  });

  it("writes PAA skill names as printed, without English sentence-casing", () => {
    const options = taxonomyOptions(
      parse(paaQuestion("t1", { skill: "Diagramas de Venn" })),
      "skill",
    );
    expect(options[0].label).toBe("Diagramas de Venn");
    expect(options[0].context).toBe("Matemáticas · Álgebra");
  });
});
