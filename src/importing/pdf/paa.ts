/**
 * Reading profile for PAA (Prueba de Aptitud Académica) question exports that
 * follow the Educator Question Bank layout: English labels, Spanish content,
 * one page per question. It differs from the SAT export in ways that matter:
 *
 *  - Pages with long readings are scaled down to fit one page, so the header
 *    table sits higher and the SAT's fixed coordinates miss it. Columns are
 *    found from the header row instead.
 *  - The reading is printed between the question and its choices, but PDF text
 *    order puts it after the rationale. Question, choices and rationale are
 *    therefore read by position, never by text order.
 *  - Many questions repeat one reading. Neighbouring pages that share it are
 *    grouped so a session can keep them together.
 *
 * Pure functions only: no PDF library, no DOM, no storage. Imports use
 * extensions so the local verification script can run this file directly.
 */
import { coarsePaaSkill } from "../../core/paaTaxonomy.ts";
import {
  extractAnswer,
  normalizedText,
  type Answer,
  type AnswerOrigin,
} from "./answers.ts";
import { findPhrase, type Line, type PageLayout, type Word } from "./layout.ts";
import type { ReviewedOverride } from "./record.ts";
import type { SourceRecord } from "./segment.ts";

export const PAA_SOURCE = "PAA: banco de preguntas";

const ID_PATTERN = /Question ID:\s*([a-zA-Z0-9]+)/;

/** A page of a question export carries a "Question ID:" line; any other PDF does not. */
export const isPaaQuestionPage = (page: PageLayout) =>
  ID_PATTERN.test(page.text);

/** Test names as printed, compared without accents or case. */
export const flat = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const TESTS: Record<string, PaaQuestionText["section"]> = {
  lectura: "lectura",
  redaccion: "redaccion",
  matematicas: "matematicas",
  ingles: "ingles",
};

export interface PaaRecord extends SourceRecord {
  assessment: string;
  /** Lines between the "Question" heading and the choices (or the answer key). */
  stemLines: string[];
  /** Height of each stem line in points; a reading is printed smaller than its question. */
  stemHeights?: number[];
  /** Lines between the "Answer" label and the answer key; empty for grid-ins. */
  optionLines: string[];
  /** Lines below the "Rationale" heading. */
  rationaleLines: string[];
}

export interface PaaQuestionText {
  id: string;
  assessment: "PAA";
  sourceId: string;
  source: string;
  section: "lectura" | "redaccion" | "matematicas" | "ingles";
  domain: string;
  skill: string;
  /** The skill as the source printed it, when `skill` is a grouped label. */
  skillDetail?: string;
  difficulty: "easy" | "medium" | "hard";
  stem: string;
  passage?: string;
  passageGroup?: string;
  answer: Answer;
  answerKeyOrigin: AnswerOrigin;
  rationale: string;
  choices?: { id: string; text: string }[];
  extractionWarnings?: string[];
}

const top = (line: Line) => line.words[0]?.y0 ?? line.baseline;
const wordsOf = (page: PageLayout, text: string, belowY = -Infinity) =>
  page.words.filter((word) => word.text === text && word.y0 > belowY);
const labelLine = (page: PageLayout, text: string, belowY: number) =>
  page.lines.find(
    (line) =>
      line.text === text && line.words[0].x0 < 25 && line.words[0].y0 > belowY,
  )?.words[0];

const DIFFICULTIES: Record<string, string> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
  facil: "easy",
  medio: "medium",
  dificil: "hard",
};

/** The Assessment value printed on the first question page of an export. */
export const peekAssessment = (page: PageLayout): string =>
  indexPaaExport("export", [page])[0]?.assessment ?? "";

/** Only an export of PAA questions counts: an SAT export read here is left aside. */
export const isPaaRecord = (record: PaaRecord) =>
  flat(record.assessment) === "paa";

export function indexPaaExport(
  filename: string,
  pages: readonly PageLayout[],
): PaaRecord[] {
  const records: PaaRecord[] = [];
  pages.forEach((page, index) => {
    const match = ID_PATTERN.exec(page.text);
    if (match) {
      const heading = page.words.find(
        (word) => word.text === "Question" && word.x0 < 25 && word.y0 > 70,
      );
      if (!heading)
        throw new Error(
          `Missing question boundary in ${filename}, page ${index + 1}`,
        );
      const header = (text: string) =>
        wordsOf(page, text).find((word) => word.y0 < heading.y0);
      const [assessment, test, domain, skill, difficulty] = [
        "Assessment",
        "Test",
        "Domain",
        "Skill",
        "Difficulty",
      ].map(header);
      if (!assessment || !test || !domain || !skill || !difficulty)
        throw new Error(
          `Cannot find the metadata table in ${filename}, page ${index + 1}`,
        );
      const headerBottom = Math.max(
        assessment.y1,
        test.y1,
        domain.y1,
        skill.y1,
        difficulty.y1,
      );
      const edges = [assessment, test, domain, skill, difficulty].map(
        (word) => word.x0 - 2,
      );
      const column = (position: number) =>
        normalizedText(
          page.words
            .filter(
              (word: Word) =>
                word.y0 >= headerBottom - 0.5 &&
                word.y0 < heading.y0 - 4 &&
                word.x0 >= edges[position] &&
                word.x0 < (edges[position + 1] ?? Infinity),
            )
            .map((word) => word.text)
            .join(" "),
        );
      const key = findPhrase(page, "Correct Answer:").find(
        (box) => box.y0 > heading.y0,
      );
      const answer = labelLine(page, "Answer", heading.y1);
      const rationale = labelLine(page, "Rationale", heading.y1);
      const stemEnd = answer?.y0 ?? key?.y0 ?? Infinity;
      const between = (from: number, to: number) =>
        page.lines
          .filter((line) => top(line) > from - 1 && top(line) < to - 0.5)
          .map((line) => normalizedText(line.text))
          .filter(Boolean);
      const stem = page.lines
        .filter(
          (line) => top(line) > heading.y1 - 1 && top(line) < stemEnd - 0.5,
        )
        .map((line) => ({
          text: normalizedText(line.text),
          height: Math.max(...line.words.map((word) => word.y1 - word.y0)),
        }))
        .filter((line) => line.text);
      records.push({
        id: match[1].toLowerCase(),
        startPage: index + 1,
        pages: [],
        texts: [],
        assessment: column(0),
        section: column(1),
        domain: column(2),
        skill: column(3),
        difficulty: column(4),
        stemLines: stem.map((line) => line.text),
        stemHeights: stem.map((line) => line.height),
        optionLines: answer ? between(answer.y1, key?.y0 ?? Infinity) : [],
        rationaleLines: rationale
          ? between(rationale.y1, Infinity).filter(
              (line) => !/^Correct Answer:/.test(line),
            )
          : [],
      });
    }
    if (!records.length)
      throw new Error(`Unassigned page ${index + 1} in ${filename}`);
    const last = records[records.length - 1];
    last.pages.push(index + 1);
    last.texts.push(page.text);
  });
  return records;
}

/** A line number printed in the margin of a reading is not text. */
export const isLineNumber = (line: string) => /^\d{1,3}$/.test(line);

export interface PassageGroup {
  /** Stable id for the reading: the same text always gives the same id. */
  id: string;
  passage: string;
  /** Lines of the reading, to be left out of each question's own stem. */
  lines: Set<string>;
}

/** 32-bit FNV-1a; enough to name a handful of readings, and synchronous. */
const fnv = (text: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

/** Shared text needed before neighbouring questions count as one reading. */
const MIN_SHARED_CHARACTERS = 150;

/**
 * Finds the questions that share a reading. Neighbouring questions of the same
 * test belong together when the text they have in common (the reading, with
 * margin numbers removed) is long enough; a quoted "Pregunta anterior" is not in
 * every question, so it never counts as part of the reading.
 */
export interface GroupOptions {
  /** Prefix of the group ids; defaults to the PAA's. */
  prefix?: string;
  /**
   * Lines that are instructions, not reading (e.g. "Read the passage(s) below…").
   * They are printed on every question, so they must not make two different
   * readings look like one.
   */
  ignore?: (line: string) => boolean;
}

export function groupPassages(
  records: readonly PaaRecord[],
  options: GroupOptions = {},
): Map<string, PassageGroup> {
  const result = new Map<string, PassageGroup>();
  const clean = (record: PaaRecord) =>
    record.stemLines.filter(
      (line) => !isLineNumber(line) && !options.ignore?.(line),
    );
  const size = (lines: Iterable<string>) =>
    [...lines].reduce((total, line) => total + line.length, 0);
  let run: PaaRecord[] = [];
  let common = new Set<string>();
  const flush = () => {
    if (run.length > 1 && size(common) >= MIN_SHARED_CHARACTERS) {
      const first = clean(run[0]);
      const lines = new Set(first.filter((line) => common.has(line)));
      const passage = first.filter((line) => lines.has(line)).join("\n");
      const group = {
        id: (options.prefix ?? "paa-g-") + fnv(passage),
        passage,
        lines,
      };
      for (const member of run) result.set(member.id, group);
    }
  };
  for (const record of records) {
    const lines = new Set(clean(record));
    const shared = new Set([...common].filter((line) => lines.has(line)));
    if (
      run.length &&
      run[0].section === record.section &&
      size(shared) >= MIN_SHARED_CHARACTERS
    ) {
      run.push(record);
      common = shared;
    } else {
      flush();
      run = [record];
      common = lines;
    }
  }
  flush();
  return result;
}

/**
 * The choice labels in reading order. Normally each starts a line; image
 * choices may sit two to a row, so a second pass takes A, B, C, D in sequence
 * wherever they appear (a sentence ending "lectura A." is never mistaken for one).
 */
export function choiceLabels(lines: readonly string[]): string[] {
  const atLineStart = lines
    .map((line) => /^([A-D])\.(?:\s|$)/.exec(line)?.[1])
    .filter((label): label is string => !!label);
  if (atLineStart.slice(0, 4).join("") === "ABCD") return atLineStart;
  const found: string[] = [];
  for (const match of lines.join(" ").matchAll(/(?:^|\s)([A-D])\.(?=\s|$)/g))
    if (match[1] === "ABCD"[found.length]) found.push(match[1]);
  return found.length === 4 ? found : atLineStart;
}

export function convertPaaRecord(
  record: PaaRecord,
  group?: PassageGroup,
  override?: ReviewedOverride,
): PaaQuestionText {
  const joined = record.texts.join("\n");
  const { answer, origin } = extractAnswer(joined);
  if (flat(record.assessment) !== "paa")
    throw new Error(
      `Assessment is "${record.assessment || "empty"}", expected PAA`,
    );
  const section = TESTS[flat(record.section)];
  const difficulty = DIFFICULTIES[flat(record.difficulty)];
  if (!section || !difficulty || !record.domain || !record.skill)
    throw new Error("Missing or unrecognized metadata");
  const stemLines = record.stemLines.filter(
    (line) => !isLineNumber(line) && !group?.lines.has(line),
  );
  const question: PaaQuestionText = {
    id: "paa-" + record.id,
    assessment: "PAA",
    sourceId: record.id,
    source: PAA_SOURCE,
    section,
    domain: record.domain,
    skill: coarsePaaSkill(section, record.domain, record.skill),
    difficulty: difficulty as PaaQuestionText["difficulty"],
    stem: stemLines.join(" ") || "Pregunta " + record.id,
    answer,
    answerKeyOrigin: origin,
    rationale: record.rationaleLines.join(" "),
  };
  if (question.skill !== record.skill) question.skillDetail = record.skill;
  if (group) {
    question.passage = group.passage;
    question.passageGroup = group.id;
  }
  if (answer.type === "choice") {
    const labels = choiceLabels(record.optionLines);
    if (
      labels.slice(0, 4).join("") !== "ABCD" &&
      !override?.choiceLabelsVerified
    )
      throw new Error(
        `Expected options A-D in order, found ${JSON.stringify(labels)}`,
      );
    question.choices = [..."ABCD"].map((id) => ({ id, text: "Opción " + id }));
  }
  if (override?.warning) question.extractionWarnings = [override.warning];
  return question;
}

/** Two copies of one ID must agree on metadata and answer key. */
export function paaSignature(record: PaaRecord): string {
  const keys = [
    ...record.texts.join("\n").matchAll(/Correct Answer:\s*([^\n]+)/g),
  ].map((match) => match[1]);
  return JSON.stringify([
    flat(record.assessment),
    flat(record.section),
    record.domain,
    record.skill,
    flat(record.difficulty),
    keys,
  ]);
}
