/**
 * Reading profile for TSIA2 (Texas Success Initiative Assessment 2.0) question
 * exports in the Educator Question Bank layout: English, one page per question,
 * a header table (Assessment, Test, Domain, Skill, Difficulty). The page layout
 * is the PAA export's, so the PAA reader's functions do the reading; this file
 * adds what TSI needs on top:
 *
 *  - Official / Original: the last "Source:" line of the rationale says whether
 *    an item is a College Board sample or an original practice item.
 *  - Calculator: a Math stem ends with [basic], [square root] or [graphing],
 *    which is the on-screen calculator the real test offers for that item.
 *  - Reading sets: several questions share one passage. The instruction printed
 *    above every passage ("Read the passage(s) below…") is on all of them, so it
 *    is set aside before looking for shared text.
 *
 * Pure functions only: no PDF library, no DOM, no storage.
 */
import { OFFICIAL_ITEMS_ALLOWED } from "../../core/buildFlags.ts";
import type { CalculatorTier, QuestionOrigin } from "../../core/model.ts";
import { extractAnswer, normalizedText, type Answer } from "./answers.ts";
import type { ReviewedOverride } from "./record.ts";
import {
  choiceLabels,
  flat,
  groupPassages,
  isLineNumber,
  type PaaRecord,
  type PassageGroup,
} from "./paa.ts";

export const TSI_SOURCE = "TSI practice bank (TSIA2)";

const TESTS: Record<string, "tsi-elar" | "tsi-math"> = {
  elar: "tsi-elar",
  mathematics: "tsi-math",
  math: "tsi-math",
};
const DIFFICULTIES: Record<string, "easy" | "medium" | "hard"> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
};
const CALCULATORS: Record<string, CalculatorTier> = {
  basic: "basic",
  "square root": "sqrt",
  graphing: "graphing",
};

/** The export says TSIA2; "TSI" is accepted too. */
export const isTsiRecord = (record: PaaRecord) =>
  ["tsia2", "tsi"].includes(flat(record.assessment));

/** Instructions printed above every reading and every sentence item. */
const INSTRUCTION =
  /^(?:Read the (?:passage|following)|Select the best version)/i;

/**
 * The record without its leading instruction ("Read the passage(s) below and then
 * choose…"). It is printed on every question, so it must not make two different
 * readings look like one, and it is not part of any stem. A wrapped instruction
 * continues on the next line until a sentence ends.
 */
export function withoutInstruction(record: PaaRecord): PaaRecord {
  const lines = [...record.stemLines];
  if (!lines.length || !INSTRUCTION.test(lines[0])) return record;
  let end = 1;
  while (end < lines.length && !/[.?!:]["”’)]*$/.test(lines[end - 1])) end++;
  return {
    ...record,
    stemLines: lines.slice(end),
    ...(record.stemHeights
      ? { stemHeights: record.stemHeights.slice(end) }
      : {}),
  };
}

/**
 * A reading is printed in smaller type than the question under it: about 6.5 to
 * 7.6 pt against 8.6 pt in the supplied files, so anything under 93% of the
 * largest line counts as reading.
 */
const SMALL_TYPE = 0.93;
function readingLines(record: PaaRecord): Set<number> {
  const heights = record.stemHeights;
  if (!heights?.length) return new Set();
  const largest = Math.max(...heights);
  return new Set(
    heights.flatMap((height, i) => (height < largest * SMALL_TYPE ? [i] : [])),
  );
}

/** Groups the questions of one reading, keeping the shared instruction out of the comparison. */
export const groupTsiPassages = (records: readonly PaaRecord[]) =>
  groupPassages(records.map(withoutInstruction), { prefix: "tsi-g-" });

/** The calculator tag at the end of a Math stem, as printed. */
export const CALCULATOR_TAG = /\[(basic|square root|graphing)\]\s*$/i;
/** Phrases whose position is painted over in the question picture. */
export const CALCULATOR_TAG_PHRASES = [
  "[basic]",
  "[square root]",
  "[graphing]",
] as const;

/** Official or original, from the "Source:" line. Anything else counts as official. */
export function originOf(lines: readonly string[]): {
  origin: QuestionOrigin;
  recognized: boolean;
} {
  const source = [...lines].reverse().find((line) => /^Source:/i.test(line));
  if (source && /\bofficial\b/i.test(source))
    return { origin: "official", recognized: true };
  if (source && /\boriginal\b/i.test(source))
    return { origin: "original", recognized: true };
  // The safe side for a version that must carry no College Board items.
  return { origin: "official", recognized: false };
}

export interface TsiQuestionText {
  id: string;
  assessment: "TSI";
  sourceId: string;
  source: string;
  section: "tsi-elar" | "tsi-math";
  domain: string;
  skill: string;
  difficulty: "easy" | "medium" | "hard";
  origin: QuestionOrigin;
  calculator?: CalculatorTier;
  stem: string;
  passage?: string;
  passageGroup?: string;
  answer: Answer;
  answerKeyOrigin: "answer-key" | "rationale";
  rationale: string;
  choices?: { id: string; text: string }[];
  extractionWarnings?: string[];
}

export function convertTsiRecord(
  source: PaaRecord,
  group?: PassageGroup,
  override?: ReviewedOverride,
): { text: TsiQuestionText; notes: string[] } {
  const record = withoutInstruction(source);
  const { answer, origin: answerKeyOrigin } = extractAnswer(
    record.texts.join("\n"),
  );
  if (!isTsiRecord(record))
    throw new Error(
      `Assessment is "${record.assessment || "empty"}", expected TSIA2`,
    );
  const section = TESTS[flat(record.section)];
  const difficulty = DIFFICULTIES[flat(record.difficulty)];
  if (!section || !difficulty || !record.domain || !record.skill)
    throw new Error("Missing or unrecognized metadata");
  const { origin, recognized } = originOf(record.rationaleLines);
  if (origin === "official" && !OFFICIAL_ITEMS_ALLOWED)
    throw new Error(
      "College Board sample item left out: this build includes original items only",
    );
  const notes: string[] = [];
  if (!recognized)
    notes.push(
      "no recognizable Source line, so the item is treated as Official",
    );

  let calculator: CalculatorTier | undefined;
  // A reading shared with neighbouring questions comes from the group; one
  // that belongs to this question alone is told apart by its smaller type.
  const reading =
    group || section !== "tsi-elar" ? new Set<number>() : readingLines(record);
  const stemLines = record.stemLines
    .filter(
      (line, i) =>
        !isLineNumber(line) && !group?.lines.has(line) && !reading.has(i),
    )
    .map((line) => {
      const tag = CALCULATOR_TAG.exec(line);
      if (!tag) return line;
      calculator = CALCULATORS[tag[1].toLowerCase()];
      return normalizedText(line.slice(0, tag.index));
    })
    .filter(Boolean);
  if (section === "tsi-math" && !calculator)
    notes.push("Math item without a calculator tag: no calculator offered");

  const text: TsiQuestionText = {
    id: "tsi-" + record.id,
    assessment: "TSI",
    sourceId: record.id,
    source: TSI_SOURCE,
    section,
    domain: record.domain,
    skill: record.skill,
    difficulty,
    origin,
    stem: stemLines.join(" ") || "Question " + record.id,
    answer,
    answerKeyOrigin,
    rationale: record.rationaleLines
      .filter((line) => !/^Source:/i.test(line))
      .join(" "),
  };
  if (calculator) text.calculator = calculator;
  if (group) {
    text.passage = group.passage;
    text.passageGroup = group.id;
  } else if (reading.size)
    text.passage = record.stemLines.filter((_, i) => reading.has(i)).join("\n");
  if (answer.type === "choice") {
    const labels = choiceLabels(record.optionLines);
    if (
      labels.slice(0, 4).join("") !== "ABCD" &&
      !override?.choiceLabelsVerified
    )
      throw new Error(
        `Expected options A-D in order, found ${JSON.stringify(labels)}`,
      );
    text.choices = [..."ABCD"].map((id) => ({ id, text: "Choice " + id }));
  }
  if (override?.warning) text.extractionWarnings = [override.warning];
  return { text, notes };
}

/** Two copies of one ID must agree on metadata, origin and answer key. */
export function tsiSignature(record: PaaRecord): string {
  const keys = [
    ...record.texts.join("\n").matchAll(/Correct Answer:\s*([^\n]+)/g),
  ].map((match) => match[1]);
  return JSON.stringify([
    flat(record.assessment),
    flat(record.section),
    record.domain,
    record.skill,
    flat(record.difficulty),
    originOf(record.rationaleLines).origin,
    keys,
  ]);
}
