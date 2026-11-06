import {
  assessmentOf,
  type Assessment,
  type Question,
  type QuestionOrigin,
  type Section,
  type Session,
  type StudyData,
} from "./model";
import { groupPaaSkill } from "./paaTaxonomy";

/** Everything that differs between the tests lives here, not in the UI. */
export const ASSESSMENTS: readonly Assessment[] = ["SAT", "PAA", "TSI"];

export interface PartInfo {
  id: Section;
  label: string;
}

export interface AssessmentInfo {
  id: Assessment;
  /** Name shown in the header and on the landing page. */
  name: string;
  language: "en" | "es";
  /** Parts of the test, in filter order. */
  parts: readonly PartInfo[];
  /** Order of parts in the performance overview. */
  performanceOrder: readonly Section[];
  /** Domains listed in the overview even before a question uses them. */
  domains: Partial<Record<Section, readonly string[]>>;
  calculator: boolean;
  /** Module-style Practice Tests built from active questions. */
  practiceTests: boolean;
  /** Timed, ordered test mode (see timedTest.ts). */
  testMode: boolean;
  /** Spoiler protection for active practice-test questions. */
  protectedTests: boolean;
  /** Internal question IDs start with this, so IDs never collide across tests. */
  idPrefix: string;
  /** Items carry an Official / Original label (TSI). */
  hasOrigins: boolean;
}

const SAT: AssessmentInfo = {
  id: "SAT",
  name: "SAT",
  language: "en",
  parts: [
    { id: "reading-writing", label: "Reading & Writing" },
    { id: "math", label: "Math" },
  ],
  performanceOrder: ["math", "reading-writing"],
  domains: {
    math: [
      "Algebra",
      "Advanced Math",
      "Problem-Solving and Data Analysis",
      "Geometry and Trigonometry",
    ],
    "reading-writing": [
      "Information and Ideas",
      "Craft and Structure",
      "Expression of Ideas",
      "Standard English Conventions",
    ],
  },
  calculator: true,
  practiceTests: true,
  testMode: false,
  protectedTests: true,
  idPrefix: "",
  hasOrigins: false,
};

const PAA: AssessmentInfo = {
  id: "PAA",
  name: "PAA",
  language: "es",
  parts: [
    { id: "lectura", label: "Lectura" },
    { id: "redaccion", label: "Redacción" },
    { id: "matematicas", label: "Matemáticas" },
    { id: "ingles", label: "Inglés" },
  ],
  performanceOrder: ["lectura", "redaccion", "matematicas", "ingles"],
  // The study guide's own categories; Matemáticas matches its four subscores.
  domains: {
    lectura: [
      "Vocabulario en contexto",
      "Ideas explícitas e implícitas",
      "Análisis, interpretación e inferencias",
      "Análisis de información cuantitativa o de gráficos",
      "Análisis literario",
    ],
    redaccion: [
      "Adición",
      "Elisión",
      "Generalización",
      "Integración",
      "Particularización",
    ],
    matematicas: [
      "Aritmética",
      "Álgebra",
      "Geometría",
      "Análisis de datos y Probabilidad",
    ],
    ingles: [
      "Uso del lenguaje y vocabulario",
      "Comprensión de lectura",
      "Redacción indirecta",
    ],
  },
  calculator: false,
  practiceTests: false,
  testMode: true,
  protectedTests: false,
  idPrefix: "paa-",
  hasOrigins: false,
};

/**
 * TSIA2 practice: fixed-order sets with no clock, no modules and no score (the
 * real test is adaptive and College Board publishes no conversion). Every item
 * is "unknown" for spoiler purposes, so nothing is hidden.
 */
const TSI: AssessmentInfo = {
  id: "TSI",
  name: "TSI",
  language: "en",
  parts: [
    { id: "tsi-elar", label: "ELAR" },
    { id: "tsi-math", label: "Mathematics" },
  ],
  performanceOrder: ["tsi-elar", "tsi-math"],
  domains: {
    "tsi-elar": [
      "Literary Text Analysis",
      "Informational Text Analysis and Synthesis",
      "Essay Revision and Editing",
      "Sentence Revision, Editing, and Completion",
    ],
    "tsi-math": [
      "Quantitative Reasoning",
      "Algebraic Reasoning",
      "Geometric and Spatial Reasoning",
      "Probabilistic and Statistical Reasoning",
    ],
  },
  // Which calculator opens depends on the item (see Question.calculator).
  calculator: true,
  practiceTests: false,
  testMode: false,
  protectedTests: false,
  idPrefix: "tsi-",
  hasOrigins: true,
};

const INFO: Record<Assessment, AssessmentInfo> = { SAT, PAA, TSI };

export const assessmentInfo = (assessment: Assessment) => INFO[assessment];

export const isAssessment = (value: unknown): value is Assessment =>
  value === "SAT" || value === "PAA" || value === "TSI";

/** Every test except the given one. */
export const otherAssessments = (assessment: Assessment): Assessment[] =>
  ASSESSMENTS.filter((id) => id !== assessment);

/** The assessment a part belongs to; part ids are unique across assessments. */
export const assessmentOfSection = (section: string): Assessment | undefined =>
  ASSESSMENTS.find((id) => INFO[id].parts.some((part) => part.id === section));

export const sectionLabel = (section: string) =>
  ASSESSMENTS.flatMap((id) => INFO[id].parts).find(
    (part) => part.id === section,
  )?.label ?? section;

/** Internal IDs carry their test, so an orphaned answer still belongs somewhere. */
export const assessmentOfId = (id: string): Assessment =>
  id.startsWith(PAA.idPrefix)
    ? "PAA"
    : id.startsWith(TSI.idPrefix)
      ? "TSI"
      : "SAT";

export function questionIdMatchesAssessment(
  id: string,
  assessment: Assessment,
) {
  return assessmentOfId(id) === assessment;
}

const questionAssessment = (question: Question) =>
  question.assessment ??
  assessmentOfSection(question.section) ??
  assessmentOfId(question.id);

/**
 * Fills in the assessment on stored data that predates it. Everything old is
 * SAT, so nothing is lost; the result is written back with the next save.
 */
/** A test taken before parts were timed separately had one clock; it becomes one segment. */
function upgradeTimedTest(session: Session) {
  const old = session.timedTest as unknown as
    | {
        version?: number;
        parts: Section[];
        limitMs?: number;
        startedAt: number;
        pausedAt?: number;
        pausedMs?: number;
        completedAt?: number;
        durationMs?: number;
        marked: string[];
        unusedOnly: boolean;
      }
    | undefined;
  if (!old || old.version !== 1) return;
  const first = old.parts[0];
  session.timedTest = {
    version: 2,
    parts: old.parts,
    segments: [
      {
        key:
          first === "matematicas"
            ? "matematicas"
            : first === "ingles"
              ? "ingles"
              : "lectura-redaccion",
        parts: old.parts,
        questionIds: [...session.questionIds],
        ...(old.limitMs !== undefined ? { limitMs: old.limitMs } : {}),
        startedAt: old.startedAt,
        ...(old.pausedAt !== undefined ? { pausedAt: old.pausedAt } : {}),
        ...(old.pausedMs !== undefined ? { pausedMs: old.pausedMs } : {}),
        ...(old.completedAt !== undefined
          ? { completedAt: old.completedAt }
          : {}),
        ...(old.durationMs !== undefined ? { durationMs: old.durationMs } : {}),
      },
    ],
    current: 0,
    phase: "segment",
    startedAt: old.startedAt,
    ...(old.completedAt !== undefined ? { completedAt: old.completedAt } : {}),
    ...(old.durationMs !== undefined ? { durationMs: old.durationMs } : {}),
    marked: old.marked,
    unusedOnly: old.unusedOnly,
  };
}

export function backfillAssessments(data: StudyData): StudyData {
  const byId = new Map<string, Assessment>();
  for (const question of data.questions) {
    question.assessment = questionAssessment(question);
    byId.set(question.id, question.assessment);
    // A PAA bank saved before skills were grouped gets the grouping on read.
    if (question.assessment === "PAA") {
      const grouped = groupPaaSkill(question);
      question.skill = grouped.skill;
      question.skillDetail = grouped.skillDetail;
      if (question.skillDetail === undefined) delete question.skillDetail;
    }
  }
  for (const attempt of data.attempts)
    attempt.assessment ??=
      byId.get(attempt.questionId) ?? assessmentOfId(attempt.questionId);
  for (const session of data.sessions) upgradeTimedTest(session);
  for (const session of data.sessions)
    session.assessment ??=
      (session.questionIds[0] !== undefined
        ? (byId.get(session.questionIds[0]) ??
          assessmentOfId(session.questionIds[0]))
        : undefined) ?? "SAT";
  return data;
}

/** The assessment of an answer, bookmark or question ID. */
const ownerOf = (data: StudyData) => {
  const byId = new Map(
    data.questions.map((question) => [
      question.id,
      questionAssessment(question),
    ]),
  );
  return (id: string) => byId.get(id) ?? assessmentOfId(id);
};

export interface ScopeOptions {
  /**
   * Leave out TSI items with this label (Original or Official), together with
   * their answers and bookmarks. Nothing is deleted: turning it off brings them
   * back. A session that contains some of them stays, without those questions;
   * only a session with nothing else in it is left out.
   */
  hideOrigin?: QuestionOrigin;
}

/**
 * A session as a screen sees it with some questions hidden: the same session,
 * with the hidden ones skipped. Its position is the question it was on, or the
 * next one still shown (the previous one if none follows).
 */
function withoutQuestions(
  session: Session,
  hidden: ReadonlySet<string>,
): Session | undefined {
  if (!session.questionIds.some((id) => hidden.has(id))) return session;
  const questionIds = session.questionIds.filter((id) => !hidden.has(id));
  if (!questionIds.length) return undefined;
  const after = session.questionIds
    .slice(session.index)
    .find((id) => !hidden.has(id));
  const before = session.questionIds
    .slice(0, session.index)
    .reverse()
    .find((id) => !hidden.has(id));
  return {
    ...session,
    questionIds,
    index: Math.max(0, questionIds.indexOf(after ?? before ?? questionIds[0])),
  };
}

/**
 * A view of the study data for one assessment. Everything the study screens
 * show (questions, answers, sessions, bookmarks) is separated; writes still go
 * to the whole record.
 */
export function scopeStudyData(
  data: StudyData,
  assessment: Assessment,
  options: ScopeOptions = {},
): StudyData {
  const owner = ownerOf(data);
  const hidden = new Set(
    options.hideOrigin
      ? data.questions
          .filter(
            (question) =>
              question.origin === options.hideOrigin &&
              questionAssessment(question) === assessment,
          )
          .map((question) => question.id)
      : [],
  );
  return {
    ...data,
    questions: data.questions.filter(
      (question) =>
        questionAssessment(question) === assessment && !hidden.has(question.id),
    ),
    attempts: data.attempts.filter(
      (attempt) =>
        (attempt.assessment ?? owner(attempt.questionId)) === assessment &&
        !hidden.has(attempt.questionId),
    ),
    sessions: data.sessions
      .filter(
        (session) =>
          (session.assessment ??
            (session.questionIds[0] !== undefined
              ? owner(session.questionIds[0])
              : "SAT")) === assessment,
      )
      .flatMap((session) => withoutQuestions(session, hidden) ?? []),
    annotations: Object.fromEntries(
      Object.entries(data.annotations).filter(
        ([id]) => owner(id) === assessment && !hidden.has(id),
      ),
    ),
    practiceTestUsedIds: (data.practiceTestUsedIds ?? []).filter(
      (id) => owner(id) === assessment && !hidden.has(id),
    ),
  };
}

/** The part of the study history that belongs to one assessment. */
export type StudySlice = Pick<
  StudyData,
  "attempts" | "sessions" | "annotations" | "practiceTestUsedIds"
>;

export function studySlice(
  data: StudyData,
  assessment: Assessment,
): StudySlice {
  const { attempts, sessions, annotations, practiceTestUsedIds } =
    scopeStudyData(data, assessment);
  return { attempts, sessions, annotations, practiceTestUsedIds };
}

/** Replaces one assessment's history, leaving the other's untouched. */
export function replaceSlice(
  data: StudyData,
  assessment: Assessment,
  slice: StudySlice,
) {
  const others = otherAssessments(assessment).map((id) =>
    scopeStudyData(data, id),
  );
  data.attempts = [...others.flatMap((o) => o.attempts), ...slice.attempts];
  data.sessions = [...others.flatMap((o) => o.sessions), ...slice.sessions];
  data.annotations = Object.assign(
    {},
    ...others.map((o) => o.annotations),
    slice.annotations,
  );
  data.practiceTestUsedIds = [
    ...others.flatMap((o) => o.practiceTestUsedIds ?? []),
    ...(slice.practiceTestUsedIds ?? []),
  ];
}

/** The assessment shared by every question of a session, or undefined if mixed. */
export function assessmentOfQuestions(
  data: StudyData,
  questionIds: readonly string[],
): Assessment | undefined {
  const owner = ownerOf(data);
  const found = new Set(questionIds.map(owner));
  return found.size === 1 ? [...found][0] : undefined;
}

export { assessmentOf };
