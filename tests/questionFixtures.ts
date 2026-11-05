import type { Question } from "../src/core/model";

/** Original synthetic questions only; no imported question material. */
export const choiceQuestion = (
  overrides: Partial<Question> = {},
): Question => ({
  id: "q-choice",
  section: "math",
  domain: "Algebra",
  skill: "Linear equations",
  difficulty: "medium",
  stem: "What is 2 + 2?",
  choices: [
    { id: "A", text: "Three" },
    { id: "B", text: "Four" },
    { id: "C", text: "Five" },
    { id: "D", text: "Six" },
  ],
  answer: { type: "choice", value: "B" },
  rationale: "Two and two make four.",
  testStatus: "inactive",
  ...overrides,
});

export const numericQuestion = (
  overrides: Partial<Question> = {},
): Question => ({
  id: "q-numeric",
  section: "math",
  domain: "Arithmetic",
  stem: "Half of one, as a number?",
  answer: { type: "numeric", accepted: ["0.5", "1/2"] },
  rationale: "One divided by two.",
  testStatus: "inactive",
  ...overrides,
});
