/**
 * TSI practice tests: a fixed set of questions with the composition College
 * Board publishes for the TSIA2 (Technical Manual, chapter 3), taken in order
 * with no going back and no feedback until the end. The real tests are adaptive
 * and untimed; with a bank this size the portal does not route by difficulty, it
 * keeps the content balance. Pure functions: no UI, no storage.
 *
 *   Mathematics CRC          20: Quantitative 6, Algebraic 7, Geometric 3, Probabilistic 4
 *   Mathematics Diagnostic   48: 12 from each of the four
 *   ELAR CRC                 30: 1 literary set (4) + 2 paired (Synthesis) + 9 other
 *                                informational | 1 essay set (4) + 11 sentence
 *   ELAR Diagnostic          48: 3 literary sets + 2 Synthesis + 10 other
 *                                informational | 3 essay sets + 12 sentence
 *
 * Reading-focused questions come first in ELAR, each part starting with its sets,
 * as the Diagnostic does. The essay test is not part of this.
 */
import { assessmentInfo } from "./assessments";
import { beginSession, finishSession, submitAnswer } from "./commands";
import {
  defaultFilters,
  type Question,
  type Session,
  type StudyData,
  type TsiSubject,
  type TsiTestKind,
} from "./model";
import { metadataKey } from "./taxonomy";

export const TSI_SUBJECTS: readonly TsiSubject[] = ["elar", "math"];
export const TSI_KINDS: readonly TsiTestKind[] = ["crc", "diagnostic"];

import { testName } from "./tsiNames";
export { kindName, subjectName, testName } from "./tsiNames";

/** How many questions a set has on the real test. */
export const SET_SIZE = 4;

/** What a slot of the test is made of, and where in the bank it comes from. */
type Pool = "literary" | "synthesis" | "informational" | "essay" | "sentence";
export interface Slot {
  id: string;
  /** Plain-language name, shown in the setup. */
  label: string;
  /** Sets (a passage with its questions) or single questions. */
  unit: "set" | "question";
  need: number;
  /** Math slots take one domain; ELAR slots one of the pools. */
  domain?: string;
  pool?: Pool;
}

const MATH_COUNTS: Record<TsiTestKind, number[]> = {
  crc: [6, 7, 3, 4],
  diagnostic: [12, 12, 12, 12],
};

const ELAR_COUNTS: Record<
  TsiTestKind,
  {
    literary: number;
    synthesis: number;
    informational: number;
    essay: number;
    sentence: number;
  }
> = {
  crc: { literary: 1, synthesis: 2, informational: 9, essay: 1, sentence: 11 },
  diagnostic: {
    literary: 3,
    synthesis: 2,
    informational: 10,
    essay: 3,
    sentence: 12,
  },
};

/** The parts of a test, in the order they are taken. */
export function tsiTestSlots(kind: TsiTestKind, subject: TsiSubject): Slot[] {
  if (subject === "math") {
    const domains = assessmentInfo("TSI").domains["tsi-math"] ?? [];
    return domains.map((domain, i) => ({
      id: domain,
      label: domain,
      unit: "question",
      need: MATH_COUNTS[kind][i],
      domain,
    }));
  }
  const n = ELAR_COUNTS[kind];
  return [
    {
      id: "literary",
      label: "Literary passage sets",
      unit: "set",
      need: n.literary,
      pool: "literary",
    },
    {
      id: "synthesis",
      label: "Paired passages (Synthesis)",
      unit: "question",
      need: n.synthesis,
      pool: "synthesis",
    },
    {
      id: "informational",
      label: "Informational passages",
      unit: "question",
      need: n.informational,
      pool: "informational",
    },
    {
      id: "essay",
      label: "Essay revision sets",
      unit: "set",
      need: n.essay,
      pool: "essay",
    },
    {
      id: "sentence",
      label: "Sentence revision",
      unit: "question",
      need: n.sentence,
      pool: "sentence",
    },
  ];
}

/** Questions the real test has: sets count as four. */
export const plannedTotal = (slots: readonly Slot[]) =>
  slots.reduce(
    (total, slot) => total + slot.need * (slot.unit === "set" ? SET_SIZE : 1),
    0,
  );

const DOMAIN = {
  literary: "Literary Text Analysis",
  informational: "Informational Text Analysis and Synthesis",
  essay: "Essay Revision and Editing",
  sentence: "Sentence Revision, Editing, and Completion",
} as const;
const is = (question: Question, domain: string) =>
  metadataKey(question.domain) === metadataKey(domain);
const isSynthesis = (question: Question) =>
  metadataKey(question.skill) === metadataKey("Synthesis");

function inPool(question: Question, slot: Slot): boolean {
  if (slot.domain) return is(question, slot.domain);
  switch (slot.pool) {
    case "literary":
      return is(question, DOMAIN.literary);
    case "essay":
      return is(question, DOMAIN.essay);
    case "sentence":
      return is(question, DOMAIN.sentence);
    case "synthesis":
      return is(question, DOMAIN.informational) && isSynthesis(question);
    case "informational":
      return is(question, DOMAIN.informational) && !isSynthesis(question);
    default:
      return false;
  }
}

const section = (subject: TsiSubject) =>
  subject === "elar" ? "tsi-elar" : "tsi-math";

/** A candidate for a slot: one question, or the questions of one passage set. */
interface Candidate {
  ids: string[];
}

function candidates(
  data: StudyData,
  subject: TsiSubject,
  slot: Slot,
): Candidate[] {
  const mine = data.questions.filter(
    (question) =>
      question.section === section(subject) && inPool(question, slot),
  );
  if (slot.unit === "question")
    return mine.map((question) => ({ ids: [question.id] }));
  // A set is a passage with its questions; a question with no passage group is not one.
  const groups = new Map<string, string[]>();
  for (const question of mine)
    if (question.passageGroup)
      groups.set(question.passageGroup, [
        ...(groups.get(question.passageGroup) ?? []),
        question.id,
      ]);
  return [...groups.values()]
    .filter((ids) => ids.length > 1)
    .map((ids) => ({ ids }));
}

/** What the bank can supply for each part of a test, before building it. */
export function tsiTestAvailability(
  data: StudyData,
  kind: TsiTestKind,
  subject: TsiSubject,
) {
  const slots = tsiTestSlots(kind, subject).map((slot) => {
    const have = candidates(data, subject, slot).length;
    return { slot, have, take: Math.min(slot.need, have) };
  });
  return {
    slots,
    planned: plannedTotal(slots.map((entry) => entry.slot)),
    /** True when at least one part has fewer than the real test uses. */
    short: slots.some((entry) => entry.have < entry.slot.need),
    /** Whether anything at all can be built. */
    possible: slots.some((entry) => entry.take > 0),
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Builds a test from the questions in `data` (a scoped view, so hidden questions
 * are never used). Prefers questions that have been answered least, then picks at
 * random. Returns the question IDs in test order and notes on any shortfall.
 */
export function buildTsiTest(
  data: StudyData,
  kind: TsiTestKind,
  subject: TsiSubject,
  random: () => number = Math.random,
): { questionIds: string[]; shortfall: string[] } {
  const answered = new Map<string, number>();
  for (const attempt of data.attempts)
    answered.set(
      attempt.questionId,
      (answered.get(attempt.questionId) ?? 0) + 1,
    );
  const order = new Map(data.questions.map((question, i) => [question.id, i]));
  const shortfall: string[] = [];
  const chosen = new Map<string, string[][]>();
  for (const slot of tsiTestSlots(kind, subject)) {
    const pool = candidates(data, subject, slot);
    const weight = (c: Candidate) =>
      c.ids.reduce((sum, id) => sum + (answered.get(id) ?? 0), 0) /
      c.ids.length;
    // Shuffled first, then stably sorted by how much each was answered: ties are random.
    const picked = shuffle(pool, random)
      .sort((a, b) => weight(a) - weight(b))
      .slice(0, slot.need)
      .map((c) =>
        [...c.ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
      );
    chosen.set(slot.id, picked);
    if (picked.length < slot.need)
      shortfall.push(
        `${slot.label}: ${picked.length} of ${slot.need}${slot.unit === "set" ? " sets" : ""}`,
      );
  }
  const take = (...ids: string[]) => ids.flatMap((id) => chosen.get(id) ?? []);
  const ids =
    subject === "math"
      ? shuffle(
          take(...tsiTestSlots(kind, subject).map((s) => s.id)),
          random,
        ).flat()
      : [
          // Reading-focused, then writing-focused; each starts with its sets.
          ...take("literary").flat(),
          ...shuffle(take("synthesis", "informational"), random).flat(),
          ...take("essay").flat(),
          ...shuffle(take("sentence"), random).flat(),
        ];
  return { questionIds: ids, shortfall };
}

/** Starts a test as a session. `data` is the whole record; `questionIds` comes from `buildTsiTest`. */
export function beginTsiTest(
  data: StudyData,
  kind: TsiTestKind,
  subject: TsiSubject,
  questionIds: string[],
  shortfall: string[] = [],
  timerVisible = true,
): Session {
  const session = beginSession(
    data,
    questionIds,
    defaultFilters,
    testName(kind, subject),
    timerVisible,
  );
  session.tsiTest = {
    version: 1,
    kind,
    subject,
    ...(shortfall.length ? { shortfall } : {}),
  };
  return session;
}

/** "Reading-focused" or "Writing-focused": which half of the ELAR test a question belongs to. */
export const elarFocus = (
  question: Question,
): "reading" | "writing" | undefined =>
  is(question, DOMAIN.literary) || is(question, DOMAIN.informational)
    ? "reading"
    : is(question, DOMAIN.essay) || is(question, DOMAIN.sentence)
      ? "writing"
      : undefined;

/**
 * Scores a test and ends it. Answers are kept as drafts while the test is open,
 * so a question can be reopened and changed; here each draft becomes an answer,
 * and a question with none stays unanswered.
 */
export function finishTsiTest(data: StudyData, sessionId: string) {
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session?.tsiTest) throw new Error("This is not a TSI practice test.");
  for (const id of session.questionIds) {
    const draft = session.drafts[id];
    if (draft) submitAnswer(data, sessionId, id, draft);
  }
  finishSession(data, sessionId);
}
