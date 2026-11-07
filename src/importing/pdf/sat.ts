/**
 * Reading profile for SAT questions in the Educator Question Bank layout (the
 * layout the PAA and TSI exports use) with `Assessment` = SAT: one PDF with
 * both tests and every status. Whether a question is in a live College Board
 * practice test comes from the ACTIVE / INACTIVE badge at the top right of its
 * page (`marks.ts`); a page without one is `unknown`, which is not a promise
 * that the question is safe from spoilers.
 *
 * Pure functions: no PDF library, no DOM, no storage.
 */
import { extractAnswer, type Answer } from "./answers.ts";
import { choiceLabels, flat, isLineNumber, type PaaRecord } from "./paa.ts";
import { cleanSkill, type ReviewedOverride } from "./record.ts";

export const SAT_SOURCE = "College Board SAT question bank";

const SECTIONS: Record<string, "math" | "reading-writing"> = {
  math: "math",
  "reading and writing": "reading-writing",
};
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

export const isSatBankRecord = (record: PaaRecord) =>
  flat(record.assessment) === "sat";

export interface SatQuestionText {
  id: string;
  assessment: "SAT";
  sourceId: string;
  source: string;
  section: "math" | "reading-writing";
  domain: string;
  skill: string;
  difficulty: "easy" | "medium" | "hard";
  stem: string;
  answer: Answer;
  answerKeyOrigin: "answer-key" | "rationale";
  rationale: string;
  choices?: { id: string; text: string }[];
  extractionWarnings?: string[];
}

export function convertSatRecord(
  record: PaaRecord,
  override?: ReviewedOverride,
): { text: SatQuestionText; notes: string[] } {
  const { answer, origin: answerKeyOrigin } = extractAnswer(
    record.texts.join("\n"),
  );
  if (!isSatBankRecord(record))
    throw new Error(
      `Assessment is "${record.assessment || "empty"}", expected SAT`,
    );
  const section = SECTIONS[flat(record.section)];
  const difficulty = flat(record.difficulty);
  if (
    !section ||
    !DIFFICULTIES.has(difficulty) ||
    !record.domain ||
    !record.skill
  )
    throw new Error("Missing or unrecognized metadata");
  const text: SatQuestionText = {
    id: "cb-" + record.id,
    assessment: "SAT",
    sourceId: record.id,
    source: SAT_SOURCE,
    section,
    domain: record.domain,
    skill: cleanSkill(record.skill),
    difficulty: difficulty as SatQuestionText["difficulty"],
    stem:
      record.stemLines.filter((line) => !isLineNumber(line)).join(" ") ||
      "Question " + record.id,
    answer,
    answerKeyOrigin,
    // The closing "Source:" line says who wrote the item; the app does not show it.
    rationale: record.rationaleLines
      .filter((line) => !/^Source:/i.test(line))
      .join(" "),
  };
  if (answer.type === "choice") {
    const labels = choiceLabels(record.optionLines);
    if (
      labels.slice(0, 4).join("") !== "ABCD" &&
      !override?.choiceLabelsVerified
    )
      throw new Error(
        `Expected options A-D in order, found ${JSON.stringify(labels)}`,
      );
    text.choices = [..."ABCD"].map((id) => ({ id, text: "Option " + id }));
  }
  if (override?.warning) text.extractionWarnings = [override.warning];
  return { text, notes: [] };
}

/** Two copies of one ID must agree on metadata, status and answer key. */
export function satSignature(record: PaaRecord): string {
  const keys = [
    ...record.texts.join("\n").matchAll(/Correct Answer:\s*([^\n]+)/g),
  ].map((match) => match[1]);
  return JSON.stringify([
    flat(record.assessment),
    flat(record.section),
    record.domain,
    record.skill,
    flat(record.difficulty),
    record.badge ?? null,
    keys,
  ]);
}

/** Active or inactive from the badge; no badge is unknown. */
export const satStatus = (
  record: PaaRecord,
): "active" | "inactive" | "unknown" => record.badge ?? "unknown";
