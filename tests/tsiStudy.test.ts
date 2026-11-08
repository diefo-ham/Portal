import { describe, expect, it } from "vitest";
import {
  ASSESSMENTS,
  assessmentInfo,
  assessmentOfId,
  assessmentOfSection,
  backfillAssessments,
  otherAssessments,
  scopeStudyData,
} from "../src/core/assessments";
import {
  beginSession,
  resetStudyProgress,
  submitAnswer,
} from "../src/core/commands";
import { calculatorTierOf, strongestTier } from "../src/core/calculators";
import {
  defaultFilters,
  emptyData,
  type Question,
  type StudyData,
} from "../src/core/model";
import { parseQuestions } from "../src/importing/json";
import sample from "./fixtures/synthetic.json";

// Invented questions: nothing here is material from the test publisher.
const tsi = (id: string, extra: Record<string, unknown> = {}) => ({
  id: `tsi-${id}`,
  assessment: "TSI",
  section: "tsi-math",
  domain: "Algebraic Reasoning",
  skill: "Linear equations",
  difficulty: "easy",
  origin: "original",
  calculator: "basic",
  stem: "A synthetic stem.",
  choices: ["A", "B", "C", "D"].map((id) => ({ id, text: `Choice ${id}` })),
  answer: { type: "choice", value: "B" },
  testStatus: "unknown",
  source: "TSI practice bank (TSIA2)",
  sourceId: id,
  ...extra,
});
const parse = (...questions: unknown[]) =>
  parseQuestions({ schemaVersion: 1, questions });

/** SAT examples plus a small TSI bank: two official, two original. */
const everything = (): StudyData => {
  const data = emptyData();
  data.questions = [
    ...parseQuestions(sample),
    ...parse(
      tsi("o1", { origin: "official" }),
      tsi("o2", {
        origin: "official",
        section: "tsi-elar",
        calculator: undefined,
      }),
      tsi("n1"),
      tsi("n2", { calculator: "graphing" }),
    ),
  ];
  return backfillAssessments(data);
};

describe("the TSI registry", () => {
  it("lists three tests, each with its own parts and id prefix", () => {
    expect(ASSESSMENTS).toEqual(["SAT", "PAA", "TSI"]);
    expect(otherAssessments("TSI")).toEqual(["SAT", "PAA"]);
    const info = assessmentInfo("TSI");
    expect(info.parts.map((p) => p.id)).toEqual(["tsi-elar", "tsi-math"]);
    expect(info.language).toBe("en");
    // No timed modules, no clock, no spoiler protection, no score.
    expect([info.practiceTests, info.testMode, info.protectedTests]).toEqual([
      false,
      false,
      false,
    ]);
    expect(info.domains["tsi-elar"]).toHaveLength(4);
    expect(info.domains["tsi-math"]).toHaveLength(4);
    expect(assessmentOfSection("tsi-elar")).toBe("TSI");
    expect(assessmentOfId("tsi-abc")).toBe("TSI");
    expect(assessmentOfId("paa-abc")).toBe("PAA");
    expect(assessmentOfId("abc")).toBe("SAT");
  });
});

describe("question validation", () => {
  it("accepts TSI questions with a label and a calculator tier", () => {
    const [q] = parse(tsi("v1"));
    expect(q).toMatchObject({
      id: "tsi-v1",
      assessment: "TSI",
      origin: "original",
      calculator: "basic",
    });
  });

  it("keeps test and ID prefix together", () => {
    expect(() => parse(tsi("v2", { id: "v2" }))).toThrow(
      'must start with "tsi-"',
    );
    expect(() => parse(tsi("v3", { section: "math" }))).toThrow(
      "does not belong to TSI",
    );
    expect(() =>
      parse({
        ...tsi("v4"),
        assessment: undefined,
        id: "tsi-v4",
        section: "math",
      }),
    ).toThrow('only TSI question IDs may start with "tsi-"');
  });

  it("rejects an unknown label or tier, and a label on another test", () => {
    expect(() => parse(tsi("v5", { origin: "free" }))).toThrow(
      "origin must be",
    );
    expect(() => parse(tsi("v6", { calculator: "scientific" }))).toThrow(
      "calculator must be",
    );
    const satLike = parseQuestions(sample)[0] as unknown as Record<
      string,
      unknown
    >;
    expect(() => parse({ ...satLike, origin: "official" })).toThrow(
      "only TSI questions have one",
    );
  });
});

describe("TSI progress stays apart", () => {
  it("scopes questions, answers and bookmarks to one test", () => {
    const data = everything();
    const mine = scopeStudyData(data, "TSI");
    expect(mine.questions).toHaveLength(4);
    const sat = scopeStudyData(data, "SAT");
    expect(sat.questions.every((q) => q.assessment === "SAT")).toBe(true);
    expect(scopeStudyData(data, "PAA").questions).toHaveLength(0);
  });

  it("resetting TSI progress leaves SAT and PAA alone, and the reverse", () => {
    const data = everything();
    const sat = data.questions.find((q) => q.assessment === "SAT")!;
    const tsiQ = data.questions.find((q) => q.id === "tsi-n1")!;
    for (const q of [sat, tsiQ]) {
      const session = beginSession(
        data,
        [q.id],
        defaultFilters,
        undefined,
        true,
      );
      submitAnswer(
        data,
        session.id,
        q.id,
        q.answer.type === "choice" ? q.answer.value : "0",
      );
      data.annotations[q.id] = { bookmarked: true, note: "" };
    }
    resetStudyProgress(data, false, "TSI");
    expect(scopeStudyData(data, "TSI").attempts).toHaveLength(0);
    expect(scopeStudyData(data, "SAT").attempts).toHaveLength(1);
    // Bookmarks survive a reset unless the person clears them.
    expect(data.annotations["tsi-n1"]?.bookmarked).toBe(true);
    resetStudyProgress(data, false, "SAT");
    expect(scopeStudyData(data, "SAT").attempts).toHaveLength(0);
    expect(data.annotations[sat.id]?.bookmarked).toBe(true);
  });

  it("refuses a session that mixes tests", () => {
    const data = everything();
    const sat = data.questions.find((q) => q.assessment === "SAT")!;
    expect(() =>
      beginSession(data, [sat.id, "tsi-n1"], defaultFilters, undefined, true),
    ).toThrow();
  });
});

describe("hiding the original questions", () => {
  /** A session over two original and one official question, one answered. */
  const withSessions = () => {
    const data = everything();
    const mixed = beginSession(
      data,
      ["tsi-n1", "tsi-o1", "tsi-n2"],
      defaultFilters,
      undefined,
      true,
    );
    submitAnswer(data, mixed.id, "tsi-n1", "B");
    submitAnswer(data, mixed.id, "tsi-o1", "B");
    const onlyOriginal = beginSession(
      data,
      ["tsi-n1", "tsi-n2"],
      defaultFilters,
      undefined,
      true,
    );
    data.annotations["tsi-n1"] = { bookmarked: true, note: "" };
    data.annotations["tsi-o1"] = { bookmarked: true, note: "" };
    return { data, mixed, onlyOriginal };
  };

  it("leaves original questions, their answers and bookmarks out of the view, without deleting them", () => {
    const { data } = withSessions();
    const hidden = scopeStudyData(data, "TSI", { hideOrigin: "original" });
    expect(hidden.questions.map((q) => q.id)).toEqual(["tsi-o1", "tsi-o2"]);
    expect(hidden.attempts.map((a) => a.questionId)).toEqual(["tsi-o1"]);
    expect(Object.keys(hidden.annotations)).toEqual(["tsi-o1"]);
    // Nothing was deleted: the full view still has everything.
    const shown = scopeStudyData(data, "TSI");
    expect(shown.questions).toHaveLength(4);
    expect(shown.attempts).toHaveLength(2);
    expect(Object.keys(shown.annotations)).toHaveLength(2);
  });

  it("keeps a session that contains hidden questions, without those questions", () => {
    const { data, mixed, onlyOriginal } = withSessions();
    const hidden = scopeStudyData(data, "TSI", { hideOrigin: "original" });
    const seen = hidden.sessions.find((s) => s.id === mixed.id)!;
    expect(seen.questionIds).toEqual(["tsi-o1"]);
    expect(seen.index).toBe(0);
    // A session with nothing else in it has nothing to show, so it is left out.
    expect(hidden.sessions.some((s) => s.id === onlyOriginal.id)).toBe(false);
    // The stored session is untouched, so turning the setting off restores it.
    const stored = scopeStudyData(data, "TSI").sessions.find(
      (s) => s.id === mixed.id,
    )!;
    expect(stored.questionIds).toEqual(["tsi-n1", "tsi-o1", "tsi-n2"]);
  });

  it("keeps the position: the question it was on, or the next one still shown", () => {
    const data = everything();
    const session = beginSession(
      data,
      ["tsi-o1", "tsi-n1", "tsi-o2", "tsi-n2"],
      defaultFilters,
      undefined,
      true,
    );
    const at = (index: number) => {
      session.index = index;
      return scopeStudyData(data, "TSI", { hideOrigin: "original" })
        .sessions[0];
    };
    expect(at(0).index).toBe(0);
    // On a hidden question: the next shown one.
    expect(at(1).questionIds[at(1).index]).toBe("tsi-o2");
    expect(at(3).questionIds[at(3).index]).toBe("tsi-o2");
    expect(at(2).questionIds[at(2).index]).toBe("tsi-o2");
  });

  it("can hide the official ones instead, and does nothing on the SAT", () => {
    const { data } = withSessions();
    const view = scopeStudyData(data, "TSI", { hideOrigin: "official" });
    expect(view.questions.map((q) => q.id)).toEqual(["tsi-n1", "tsi-n2"]);
    expect(
      scopeStudyData(data, "SAT", { hideOrigin: "original" }).questions,
    ).toEqual(scopeStudyData(data, "SAT").questions);
  });
});

describe("which calculator a question offers", () => {
  it("follows the tag for TSI Math, the full calculator for SAT Math, nothing else", () => {
    expect(calculatorTierOf({ section: "tsi-math", calculator: "sqrt" })).toBe(
      "sqrt",
    );
    expect(calculatorTierOf({ section: "tsi-math" })).toBeUndefined();
    expect(
      calculatorTierOf({ section: "tsi-elar", calculator: "basic" }),
    ).toBeUndefined();
    expect(calculatorTierOf({ section: "math" })).toBe("graphing");
    expect(calculatorTierOf({ section: "reading-writing" })).toBeUndefined();
    expect(calculatorTierOf({ section: "lectura" })).toBeUndefined();
  });

  it("picks the most capable tier when looking back over a session", () => {
    expect(
      strongestTier([
        { section: "tsi-math", calculator: "basic" },
        { section: "tsi-math", calculator: "sqrt" },
        { section: "tsi-elar" },
      ]),
    ).toBe("sqrt");
    expect(strongestTier([{ section: "tsi-elar" }])).toBeUndefined();
    expect(
      strongestTier([
        { section: "tsi-math", calculator: "graphing" },
        { section: "tsi-math", calculator: "basic" },
      ]),
    ).toBe("graphing");
  });
});
