import type { StudyData, Question, Section } from "../src/core/model";
import { emptyData } from "../src/core/model";
/** Original synthetic items only; no imported question material. */
export function testCorpus(perSection = 180): StudyData {
  const data = emptyData();
  for (const section of ["reading-writing", "math"] as Section[]) {
    for (let i = 0; i < perSection; i++)
      data.questions.push({
        id: `${section}-${i}`,
        section,
        domain: `Domain ${i % 4}`,
        skill: `Skill ${i % 12}`,
        difficulty: (["easy", "medium", "hard"] as const)[
          Math.floor(i / 4) % 3
        ],
        testStatus: "active",
        stem: `Synthetic ${section} question ${i}: choose one.`,
        choices: [
          { id: "A", text: "One" },
          { id: "B", text: "Two" },
        ],
        answer: { type: "choice", value: "A" },
        rationale: "One is the synthetic answer.",
      });
  }
  return data;
}
export function seededRandom(seed = 42) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export const difficultyCounts = (questions: Question[]) =>
  ["easy", "medium", "hard"].map(
    (d) => questions.filter((q) => q.difficulty === d).length,
  );
