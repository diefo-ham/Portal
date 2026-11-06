import type { CalculatorTier, Question } from "./model";

/**
 * Which calculator a question offers. The SAT's Math section has the full
 * Offline (graphing) calculator; a TSI Math question offers the one its tag
 * names (see `Question.calculator`); everything else has none.
 */
export function calculatorTierOf(
  question: Pick<Question, "section" | "calculator">,
): CalculatorTier | undefined {
  if (question.section === "math") return "graphing";
  if (question.section === "tsi-math") return question.calculator;
  return undefined;
}

const ORDER: CalculatorTier[] = ["basic", "sqrt", "graphing"];

/** The most capable calculator any of these questions offers, for looking back over a session. */
export function strongestTier(
  questions: readonly Pick<Question, "section" | "calculator">[],
): CalculatorTier | undefined {
  return questions
    .map(calculatorTierOf)
    .reduce<CalculatorTier | undefined>(
      (best, tier) =>
        tier && (!best || ORDER.indexOf(tier) > ORDER.indexOf(best))
          ? tier
          : best,
      undefined,
    );
}
