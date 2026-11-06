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
import { filterQuestions } from "../src/core/practice";
import { removeOfficialFromData } from "../src/core/pdfLibrary";
import { parseQuestions } from "../src/importing/json";
import sample from "./fixtures/synthetic.json";

// Invented questions: nothing here is College Board material.
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

describe("hiding the College Board sample items", () => {
  it("leaves official items, their answers, bookmarks and sessions out of the view, without deleting them", () => {
    const data = everything();
    const official = data.questions.find((q) => q.id === "tsi-o1")!;
    const original = data.questions.find((q) => q.id === "tsi-n1")!;
    const withOfficial = beginSession(
      data,
      [official.id],
      defaultFilters,
      undefined,
      true,
    );
    submitAnswer(data, withOfficial.id, official.id, "B");
    const withOriginal = beginSession(
      data,
      [original.id],
      defaultFilters,
      undefined,
      true,
    );
    submitAnswer(data, withOriginal.id, original.id, "B");
    data.annotations[official.id] = { bookmarked: true, note: "" };

    const hidden = scopeStudyData(data, "TSI", { hideOfficial: true });
    expect(hidden.questions.map((q) => q.id)).toEqual(["tsi-n1", "tsi-n2"]);
    expect(hidden.attempts.map((a) => a.questionId)).toEqual(["tsi-n1"]);
    expect(hidden.sessions.map((s) => s.id)).toEqual([withOriginal.id]);
    expect(Object.keys(hidden.annotations)).toEqual([]);
    // Nothing was deleted: the full view still has everything.
    const shown = scopeStudyData(data, "TSI");
    expect(shown.questions).toHaveLength(4);
    expect(shown.attempts).toHaveLength(2);
    expect(shown.sessions).toHaveLength(2);
    expect(data.annotations[official.id]).toBeDefined();
  });

  it("does not hide anything on the SAT", () => {
    const data = everything();
    expect(
      scopeStudyData(data, "SAT", { hideOfficial: true }).questions,
    ).toEqual(scopeStudyData(data, "SAT").questions);
  });
});

describe("removing the official items", () => {
  it("removes only official items, keeps answers and bookmarks, and ends sessions that used them", () => {
    const data = everything();
    const official = "tsi-o1";
    const original = "tsi-n1";
    const ended = beginSession(
      data,
      [official, original],
      defaultFilters,
      undefined,
      true,
    );
    submitAnswer(data, ended.id, official, "B");
    const kept = beginSession(
      data,
      [original],
      defaultFilters,
      undefined,
      true,
    );
    data.annotations[official] = { bookmarked: true, note: "" };
    const removed = removeOfficialFromData(data);
    expect(removed).toBe(2);
    expect(data.questions.filter((q) => q.origin === "official")).toEqual([]);
    expect(scopeStudyData(data, "TSI").questions).toHaveLength(2);
    expect(data.sessions.map((s) => s.id)).toEqual([kept.id]);
    expect(data.attempts).toHaveLength(1);
    expect(data.attempts[0].sessionId).toBeUndefined();
    expect(data.annotations[official]?.bookmarked).toBe(true);
    // SAT questions are untouched.
    expect(data.questions.some((q) => q.assessment === "SAT")).toBe(true);
    expect(removeOfficialFromData(data)).toBe(0);
  });
});

describe("the Source filter", () => {
  it("selects official, original or both", () => {
    const data = scopeStudyData(everything(), "TSI");
    const ids = (origins: Question["origin"][]) =>
      filterQuestions(data, {
        ...defaultFilters,
        statuses: [],
        origins: origins as never,
      }).map((q) => q.id);
    expect(ids([])).toHaveLength(4);
    expect(ids(["official"])).toEqual(["tsi-o1", "tsi-o2"]);
    expect(ids(["original"])).toEqual(["tsi-n1", "tsi-n2"]);
    expect(ids(["official", "original"])).toHaveLength(4);
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
