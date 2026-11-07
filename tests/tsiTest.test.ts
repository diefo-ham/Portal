import { describe, expect, it } from "vitest";
import { backfillAssessments, scopeStudyData } from "../src/core/assessments";
import { beginSession, submitAnswer } from "../src/core/commands";
import {
  defaultFilters,
  emptyData,
  type Question,
  type StudyData,
} from "../src/core/model";
import {
  beginTsiTest,
  buildTsiTest,
  elarFocus,
  finishTsiTest,
  plannedTotal,
  tsiTestAvailability,
  tsiTestSlots,
  TSI_KINDS,
  TSI_SUBJECTS,
} from "../src/core/tsiTest";

// Invented questions: nothing here is College Board material.
const D = {
  literary: "Literary Text Analysis",
  info: "Informational Text Analysis and Synthesis",
  essay: "Essay Revision and Editing",
  sentence: "Sentence Revision, Editing, and Completion",
  quant: "Quantitative Reasoning",
  algebra: "Algebraic Reasoning",
  geometry: "Geometric and Spatial Reasoning",
  stats: "Probabilistic and Statistical Reasoning",
};
let counter = 0;
const q = (
  section: "tsi-elar" | "tsi-math",
  domain: string,
  extra: Partial<Question> = {},
): Question => ({
  id: `tsi-q${String(++counter).padStart(4, "0")}`,
  assessment: "TSI",
  section,
  domain,
  skill: "Skill",
  difficulty: "easy",
  origin: "original",
  stem: "A synthetic stem.",
  choices: ["A", "B", "C", "D"].map((id) => ({ id, text: `Choice ${id}` })),
  answer: { type: "choice", value: "A" },
  testStatus: "unknown",
  ...extra,
});

/** A bank like the supplied one: 3 literary and 3 essay sets, 6 paired, 27 informational, 33 sentence; 24/28/12/16 math. */
function bank(): StudyData {
  counter = 0;
  const data = emptyData();
  const set = (domain: string, name: string, origin: Question["origin"]) =>
    [0, 1, 2, 3].map(() =>
      q("tsi-elar", domain, { passageGroup: name, origin }),
    );
  const many = (n: number, make: () => Question) =>
    Array.from({ length: n }, make);
  data.questions = [
    ...set(D.literary, "lit-1", "official"),
    ...set(D.literary, "lit-2", "original"),
    ...set(D.literary, "lit-3", "original"),
    ...many(6, () => q("tsi-elar", D.info, { skill: "Synthesis" })),
    ...many(27, () => q("tsi-elar", D.info, { skill: "Inferences" })),
    ...set(D.essay, "essay-1", "official"),
    ...set(D.essay, "essay-2", "original"),
    ...set(D.essay, "essay-3", "original"),
    ...many(33, () => q("tsi-elar", D.sentence)),
    ...many(24, () => q("tsi-math", D.quant)),
    ...many(28, () => q("tsi-math", D.algebra)),
    ...many(12, () => q("tsi-math", D.geometry)),
    ...many(16, () => q("tsi-math", D.stats)),
  ];
  return backfillAssessments(data);
}

/** A repeatable random source. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const byDomain = (data: StudyData, ids: string[]) => {
  const result: Record<string, number> = {};
  for (const id of ids) {
    const domain = data.questions.find((x) => x.id === id)!.domain!;
    result[domain] = (result[domain] ?? 0) + 1;
  }
  return result;
};

describe("the real test's composition", () => {
  it("has the sizes College Board publishes", () => {
    const total = (kind: "crc" | "diagnostic", subject: "elar" | "math") =>
      plannedTotal(tsiTestSlots(kind, subject));
    expect(total("crc", "math")).toBe(20);
    expect(total("diagnostic", "math")).toBe(48);
    expect(total("crc", "elar")).toBe(30);
    expect(total("diagnostic", "elar")).toBe(48);
  });

  it("splits Mathematics 6/7/3/4 and 12 each", () => {
    expect(tsiTestSlots("crc", "math").map((s) => s.need)).toEqual([
      6, 7, 3, 4,
    ]);
    expect(tsiTestSlots("diagnostic", "math").map((s) => s.need)).toEqual([
      12, 12, 12, 12,
    ]);
  });

  it("makes ELAR from sets, paired passages, informational and sentence questions", () => {
    const need = (kind: "crc" | "diagnostic") =>
      Object.fromEntries(tsiTestSlots(kind, "elar").map((s) => [s.id, s.need]));
    expect(need("crc")).toEqual({
      literary: 1,
      synthesis: 2,
      informational: 9,
      essay: 1,
      sentence: 11,
    });
    expect(need("diagnostic")).toEqual({
      literary: 3,
      synthesis: 2,
      informational: 10,
      essay: 3,
      sentence: 12,
    });
  });
});

describe("building a test", () => {
  it.each(
    TSI_SUBJECTS.flatMap((subject) =>
      TSI_KINDS.map((kind) => [kind, subject] as const),
    ),
  )(
    "builds the full %s %s test from a bank like the supplied one",
    (kind, subject) => {
      const data = bank();
      const { questionIds, shortfall } = buildTsiTest(
        data,
        kind,
        subject,
        seeded(7),
      );
      expect(shortfall).toEqual([]);
      expect(questionIds).toHaveLength(
        plannedTotal(tsiTestSlots(kind, subject)),
      );
      expect(new Set(questionIds).size).toBe(questionIds.length);
    },
  );

  it("takes the right number from each Mathematics domain", () => {
    const data = bank();
    const { questionIds } = buildTsiTest(data, "crc", "math", seeded(1));
    expect(byDomain(data, questionIds)).toEqual({
      [D.quant]: 6,
      [D.algebra]: 7,
      [D.geometry]: 3,
      [D.stats]: 4,
    });
    const diagnostic = buildTsiTest(data, "diagnostic", "math", seeded(1));
    expect(byDomain(data, diagnostic.questionIds)).toEqual({
      [D.quant]: 12,
      [D.algebra]: 12,
      [D.geometry]: 12,
      [D.stats]: 12,
    });
  });

  it("orders ELAR: reading then writing, each starting with its whole sets", () => {
    const data = bank();
    const { questionIds } = buildTsiTest(data, "diagnostic", "elar", seeded(3));
    const questions = questionIds.map((id) =>
      data.questions.find((x) => x.id === id)!,
    );
    const focus = questions.map(elarFocus);
    // 24 reading questions, then 24 writing.
    expect(focus.slice(0, 24).every((f) => f === "reading")).toBe(true);
    expect(focus.slice(24).every((f) => f === "writing")).toBe(true);
    // The first twelve are the three literary sets, each of four together.
    for (const start of [0, 4, 8]) {
      const group = questions[start].passageGroup;
      expect(group).toBeDefined();
      expect(
        questions
          .slice(start, start + 4)
          .every((x) => x.passageGroup === group),
      ).toBe(true);
      expect(questions[start].domain).toBe(D.literary);
    }
    // Writing starts with the three essay sets.
    for (const start of [24, 28, 32])
      expect(
        questions
          .slice(start, start + 4)
          .every(
            (x) =>
              x.domain === D.essay &&
              x.passageGroup === questions[start].passageGroup,
          ),
      ).toBe(true);
    expect(byDomain(data, questionIds)).toEqual({
      [D.literary]: 12,
      [D.info]: 12,
      [D.essay]: 12,
      [D.sentence]: 12,
    });
  });

  it("has two paired-passage questions among the informational ones", () => {
    const data = bank();
    const { questionIds } = buildTsiTest(data, "crc", "elar", seeded(5));
    const synthesis = questionIds
      .map((id) => data.questions.find((x) => x.id === id)!)
      .filter((x) => x.skill === "Synthesis");
    expect(synthesis).toHaveLength(2);
  });

  it("keeps a set's questions in the bank's own order", () => {
    const data = bank();
    const { questionIds } = buildTsiTest(data, "crc", "elar", seeded(9));
    const first = questionIds.slice(0, 4);
    const positions = first.map((id) =>
      data.questions.findIndex((x) => x.id === id),
    );
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("is the same for the same random source, and different for another", () => {
    const data = bank();
    const a = buildTsiTest(data, "crc", "math", seeded(11)).questionIds;
    expect(buildTsiTest(data, "crc", "math", seeded(11)).questionIds).toEqual(
      a,
    );
    expect(
      buildTsiTest(data, "crc", "math", seeded(12)).questionIds,
    ).not.toEqual(a);
  });

  it("uses the questions answered least first", () => {
    const data = bank();
    const algebra = data.questions.filter((x) => x.domain === D.algebra);
    // Answer 21 of the 28 Algebraic questions: the CRC test needs 7, so it takes the other 7.
    const session = beginTsiTest(
      data,
      "crc",
      "math",
      data.questions
        .filter((x) => x.section === "tsi-math")
        .slice(0, 1)
        .map((x) => x.id),
    );
    const answered = algebra.slice(0, 21);
    for (const x of answered) {
      session.questionIds.push(x.id);
      submitAnswer(data, session.id, x.id, "A");
    }
    const { questionIds } = buildTsiTest(data, "crc", "math", seeded(2));
    const used = questionIds.filter((id) => algebra.some((x) => x.id === id));
    expect(used).toHaveLength(7);
    expect(used.every((id) => !answered.some((x) => x.id === id))).toBe(true);
  });
});

describe("a bank smaller than the real test", () => {
  it("builds what it can and says what was short", () => {
    const data = bank();
    // Only official questions: one literary set, one essay set, and none for Math but the rest.
    const official = scopeStudyData(data, "TSI", { hideOrigin: "original" });
    const { questionIds, shortfall } = buildTsiTest(
      official,
      "diagnostic",
      "elar",
      seeded(1),
    );
    // The bank's official questions are the two sets (8) and nothing else.
    expect(questionIds).toHaveLength(8);
    expect(shortfall.join("; ")).toContain(
      "Literary passage sets: 1 of 3 sets",
    );
    expect(shortfall.join("; ")).toContain("Essay revision sets: 1 of 3 sets");
    expect(shortfall.join("; ")).toContain("Sentence revision: 0 of 12");
  });

  it("reports availability before a test is built", () => {
    const data = bank();
    const a = tsiTestAvailability(data, "crc", "math");
    expect(a.short).toBe(false);
    expect(a.possible).toBe(true);
    expect(a.slots.map((s) => [s.have, s.take])).toEqual([
      [24, 6],
      [28, 7],
      [12, 3],
      [16, 4],
    ]);
    const empty = tsiTestAvailability(emptyData(), "diagnostic", "elar");
    expect(empty.possible).toBe(false);
    expect(empty.short).toBe(true);
  });

  it("does not count a lone question with a passage group as a set", () => {
    const data = bank();
    data.questions = data.questions.filter(
      (x) => x.passageGroup !== "lit-2" && x.passageGroup !== "lit-3",
    );
    expect(tsiTestAvailability(data, "diagnostic", "elar").slots[0].have).toBe(
      1,
    );
  });
});

describe("a test as a session", () => {
  it("is a TSI session with its kind, name and any shortfall", () => {
    const data = bank();
    const ids = buildTsiTest(data, "crc", "math", seeded(4)).questionIds;
    const session = beginTsiTest(data, "crc", "math", ids, [
      "Sentence revision: 0 of 11",
    ]);
    expect(session.assessment).toBe("TSI");
    expect(session.tsiTest).toEqual({
      version: 1,
      kind: "crc",
      subject: "math",
      shortfall: ["Sentence revision: 0 of 11"],
    });
    expect(session.name).toBe("Mathematics College Readiness test");
    expect(session.questionIds).toEqual(ids);
    expect(data.sessions).toContain(session);
  });

  it("stays in the view when original questions are hidden, without those questions", () => {
    const data = bank();
    const ids = buildTsiTest(data, "diagnostic", "elar", seeded(6)).questionIds;
    const session = beginTsiTest(data, "diagnostic", "elar", ids);
    const hidden = scopeStudyData(data, "TSI", { hideOrigin: "original" });
    const seen = hidden.sessions.find((s) => s.id === session.id)!;
    expect(seen.tsiTest?.kind).toBe("diagnostic");
    expect(seen.questionIds.length).toBeLessThan(ids.length);
    expect(
      seen.questionIds.every(
        (id) => data.questions.find((x) => x.id === id)!.origin === "official",
      ),
    ).toBe(true);
  });
});

describe("finishing a test", () => {
  it("scores the drafts, leaves unanswered questions unanswered, and ends the test", () => {
    const data = bank();
    const ids = buildTsiTest(data, "crc", "math", seeded(8)).questionIds;
    const session = beginTsiTest(data, "crc", "math", ids);
    // Every answer is "A", which is right; one is changed to a wrong one; one is left open.
    for (const id of ids.slice(0, 5)) session.drafts[id] = "A";
    session.drafts[ids[1]] = "B";
    finishTsiTest(data, session.id);
    expect(session.finishedAt).toBeDefined();
    expect(data.attempts).toHaveLength(5);
    expect(data.attempts.filter((a) => a.correct)).toHaveLength(4);
    expect(data.attempts.every((a) => a.sessionId === session.id)).toBe(true);
  });

  it("refuses a session that is not a TSI test", () => {
    const data = bank();
    const ids = data.questions.slice(0, 2).map((x) => x.id);
    const session = beginSession(data, ids, defaultFilters);
    expect(() => finishTsiTest(data, session.id)).toThrow(
      "not a TSI practice test",
    );
  });
});
