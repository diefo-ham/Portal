/**
 * Turns one indexed source question into its text fields (everything except the
 * page images, which come from the crop step). Ported from `convert` in
 * scripts/import_college_board.py; anything unrecognized throws, and the caller
 * quarantines that question rather than importing a guess.
 */
import {
  extractAnswer,
  normalizedText,
  type Answer,
  type AnswerOrigin,
} from "./answers.ts";
import type { SourceRecord } from "./segment.ts";

/** A reviewed exception for one source ID, supplied by the person importing. */
export interface ReviewedOverride {
  choiceLabelsVerified?: boolean;
  warning?: string;
}

export interface QuestionText {
  id: string;
  sourceId: string;
  source: string;
  section: "math" | "reading-writing";
  domain: string;
  skill: string;
  difficulty: "easy" | "medium" | "hard";
  stem: string;
  answer: Answer;
  answerKeyOrigin: AnswerOrigin;
  rationale: string;
  choices?: { id: string; text: string }[];
  extractionWarnings?: string[];
}

const SECTIONS: Record<string, QuestionText["section"]> = {
  Math: "math",
  "Reading and Writing": "reading-writing",
};

/** Python's `str.split(sep, 1)[-1]`. */
const afterFirst = (text: string, separator: string) => {
  const index = text.indexOf(separator);
  return index < 0 ? text : text.slice(index + separator.length);
};
/** Python's `str.split(sep, 1)[0]`. */
const beforeFirst = (text: string, separator: string) => {
  const index = text.indexOf(separator);
  return index < 0 ? text : text.slice(0, index);
};

/** Fixes known print-layout artifacts in a skill name. */
export const cleanSkill = (skill: string) =>
  skill
    .replaceAll("Cross-text", "Cross-Text")
    .replaceAll("propor tional", "proportional");

export function convertRecordText(
  record: SourceRecord,
  override?: ReviewedOverride,
): QuestionText {
  const joined = record.texts.join("\n");
  const { answer, origin } = extractAnswer(joined);
  const section = SECTIONS[record.section];
  const difficulty = record.difficulty.toLowerCase();
  if (
    !section ||
    !["easy", "medium", "hard"].includes(difficulty) ||
    !record.domain ||
    !record.skill
  )
    throw new Error("Missing or unrecognized metadata");
  const body = beforeFirst(
    beforeFirst(afterFirst(joined, "\nQuestion\n"), "Correct Answer:"),
    "\nRationale\n",
  );
  const question: QuestionText = {
    id: "cb-" + record.id,
    sourceId: record.id,
    source: "College Board SAT question bank",
    section,
    domain: record.domain,
    skill: cleanSkill(record.skill),
    difficulty: difficulty as QuestionText["difficulty"],
    stem:
      normalizedText(beforeFirst(body, "\nAnswer\n")) ||
      "Original PDF question " + record.id,
    answer,
    answerKeyOrigin: origin,
    rationale: normalizedText(afterFirst(joined, "\nRationale\n")),
  };
  if (answer.type === "choice") {
    const labels = [
      ...afterFirst(body, "\nAnswer\n").matchAll(/^([A-D])\.\s*/gm),
    ].map((match) => match[1]);
    if (
      labels.slice(0, 4).join("") !== "ABCD" &&
      !override?.choiceLabelsVerified
    )
      throw new Error(
        `Expected options A-D in order, found ${JSON.stringify(labels)}`,
      );
    question.choices = [...("ABCD" as const)].map((id) => ({
      id,
      text: "Option " + id,
    }));
  }
  if (override?.warning) question.extractionWarnings = [override.warning];
  return question;
}

/** Two exports of the same ID must agree on metadata and answer keys. */
export function recordSignature(record: SourceRecord): string {
  const keys = [
    ...record.texts.join("\n").matchAll(/Correct Answer:\s*([^\n]+)/g),
  ].map((match) => match[1]);
  return JSON.stringify([
    record.section,
    record.domain,
    record.skill.toLowerCase(),
    record.difficulty,
    keys,
  ]);
}
