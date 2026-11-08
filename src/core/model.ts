import type { CalculatorState } from "@/src/types/calculator";
/** Which test a question, attempt or session belongs to. Absent means SAT. */
export type Assessment = "SAT" | "PAA" | "TSI";
export type SatSection = "math" | "reading-writing";
export type PaaSection = "lectura" | "redaccion" | "matematicas" | "ingles";
export type TsiSection = "tsi-elar" | "tsi-math";
/** A part of a test. Ids are unique across assessments. */
export type Section = SatSection | PaaSection | TsiSection;
/** Whether a TSI item is a sample item from the test publisher or an original practice item. */
export type QuestionOrigin = "official" | "original";
/** The on-screen calculator the real TSIA2 offers for an item. */
export type CalculatorTier = "basic" | "sqrt" | "graphing";
export type TestStatus = "active" | "inactive" | "unknown";
export type AnswerStatus = "incorrect" | "unanswered" | "completed";
export type Difficulty = "easy" | "medium" | "hard";
export interface DocumentPanel {
  src: string;
  alt: string;
  width: number;
  height: number;
}
export interface Question {
  id: string;
  /** Defaults to SAT when absent; the storage layer always fills it in. */
  assessment?: Assessment;
  sourceId?: string;
  source?: string;
  /**
   * True for the example questions that ship with the app. They are not the
   * person's own: they never unlock the Tests screens and "Remove my questions"
   * leaves them. Absent on everything else.
   */
  bundled?: true;
  section: Section;
  domain?: string;
  skill?: string;
  /** The skill as the source printed it, when `skill` is a grouped label (PAA). */
  skillDetail?: string;
  difficulty?: Difficulty;
  /** TSI only: a sample item from the test publisher, or an original practice item. */
  origin?: QuestionOrigin;
  /** TSI Math only: which on-screen calculator the item allows. Absent means none. */
  calculator?: CalculatorTier;
  passage?: string;
  /** Questions that share one reading carry the same group id; sessions keep them together. */
  passageGroup?: string;
  stem: string;
  choices?: { id: string; text: string }[];
  answer:
    { type: "choice"; value: string } | { type: "numeric"; accepted: string[] };
  rationale?: string;
  testStatus: TestStatus;
  media?: { alt: string; dataUrl: string }[];
  document?: {
    question: DocumentPanel[];
    rationale: DocumentPanel[];
    textIsApproximate: boolean;
    answerKeyOrigin?: "answer-key" | "rationale";
    extractionWarnings?: string[];
    provenance: {
      filename: string;
      sha256: string;
      pages: number[];
      /** SHA-256 of the access code the PDF carried (see `core/accessCodes.ts`). */
      access?: string;
    }[];
  };
  importMetadata?: { importedAt?: string; filename?: string; parser?: string };
}
export interface Attempt {
  id: string;
  questionId: string;
  /** Kept on the attempt so history stays separated even if the question is removed. */
  assessment?: Assessment;
  /** Absent when the session was deleted but its study history was retained. */
  sessionId?: string;
  answer: string;
  correct: boolean;
  durationMs: number;
  submittedAt: string;
}
export interface Annotation {
  bookmarked: boolean;
  /** Legacy backup compatibility only. Notes have no editing or display UI. */
  note: string;
}
export interface Filters {
  /** Legacy single part. `sections` supersedes it; empty means every part. */
  section: string;
  sections?: string[];
  domain: string;
  skill: string;
  /** Scoped multi-selections. Legacy domain/skill strings remain readable. */
  domains?: string[];
  skills?: string[];
  /** Empty means unrestricted. The legacy single status remains readable. */
  statuses?: AnswerStatus[];
  /** Empty means unrestricted. The legacy single difficulty remains readable. */
  difficulties?: Difficulty[];
  difficulty: string;
  status: string;
  bookmark: string;
  active: "hide" | "include" | "only" | "inactive" | "unknown";
  search: string;
}
export const defaultFilters: Filters = {
  section: "",
  sections: [],
  domain: "",
  skill: "",
  difficulty: "",
  status: "",
  bookmark: "",
  active: "hide",
  search: "",
  statuses: ["unanswered"],
  difficulties: [],
};
/** The separately timed parts of the PAA: Lectura y Redacción, Matemáticas, Inglés. */
export type SegmentKey = "lectura-redaccion" | "matematicas" | "ingles";
export interface TimedSegment {
  key: SegmentKey;
  parts: Section[];
  /** The segment's questions, in order. A finished segment is locked. */
  questionIds: string[];
  /** Milliseconds allowed; absent means no limit. */
  limitMs?: number;
  /** Set when the segment's clock starts. */
  startedAt?: number;
  /** Set while paused; the clock excludes paused time. */
  pausedAt?: number;
  pausedMs?: number;
  completedAt?: number;
  durationMs?: number;
}
/** PAA test mode: ordered, separately timed parts answered without feedback. See core/timedTest.ts. */
export interface TimedTest {
  version: 2;
  parts: Section[];
  segments: TimedSegment[];
  /** Index of the segment being taken (or about to start, in a break). */
  current: number;
  /** "break": the last segment ended and the next has not started; no clock runs. */
  phase: "segment" | "break";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  /** Questions of the current segment marked to come back to; cleared when it ends. */
  marked: string[];
  unusedOnly: boolean;
}
/** The two stages of a TSIA2 subject: the College Readiness Classification test, then the Diagnostic. */
export type TsiTestKind = "crc" | "diagnostic";
export type TsiSubject = "elar" | "math";
/**
 * A TSI practice test: a session with a fixed composition (see core/tsiTest.ts)
 * answered in order, with no going back and no feedback until the end.
 */
export interface TsiTest {
  version: 1;
  kind: TsiTestKind;
  subject: TsiSubject;
  /** What the bank could not supply when the test was built, in words. */
  shortfall?: string[];
}
export interface Session {
  practiceTest?: PracticeTest;
  timedTest?: TimedTest;
  tsiTest?: TsiTest;
  id: string;
  assessment?: Assessment;
  /** Optional user-facing override; the default label is derived on demand. */
  name?: string;
  /** Session favorites are distinct from per-question bookmarks. */
  starred?: boolean;
  questionIds: string[];
  index: number;
  startedAt: string;
  finishedAt?: string;
  filters: Filters;
  drafts: Record<string, string>;
  /** Legacy option-elimination state; retained only for saved-data compatibility. */
  eliminated?: Record<string, string[]>;
  elapsed: Record<string, number>;
  paused: boolean;
  /** Snapshot of the timer-visibility preference for this session. */
  timerVisible?: boolean;
  calculator?: CalculatorState;
}
export interface StudyData {
  /** Exposure ledger survives deletion of an individual session. */
  practiceTestUsedIds?: string[];
  version: 1;
  questions: Question[];
  attempts: Attempt[];
  annotations: Record<string, Annotation>;
  sessions: Session[];
  imports: {
    id: string;
    filename: string;
    importedAt: string;
    added: number;
    skipped: number;
  }[];
}
export type TestRoute = "lower" | "higher";
export type ModuleMix = "first" | TestRoute;
export type TestSelection = "full" | `${SatSection}:${ModuleMix}`;
export interface TestModule {
  section: SatSection;
  mix: ModuleMix;
  questionIds: string[];
  unscoredIds: string[];
  startedAt: number;
  /** Wall-clock instant when the live module was paused. */
  pausedAt?: number;
  /** Accumulated paused wall-clock time before the current pause. */
  pausedMs?: number;
  completedAt?: number;
  durationMs?: number;
}
export interface PracticeTest {
  version: 1;
  selection: TestSelection;
  timing: "timed" | "untimed";
  modules: TestModule[];
  currentModule: number;
  routes: Partial<Record<SatSection, TestRoute>>;
  phase: "module" | "break" | "results";
  /** Test-local state; deliberately separate from persistent annotations. */
  markedForReview?: string[];
  /** Persist the dedicated pre-submission overview across reloads. */
  reviewingModule?: boolean;
  breakStartedAt?: number;
}
export const assessmentOf = (item: { assessment?: Assessment }): Assessment =>
  item.assessment ?? "SAT";
export const emptyData = (): StudyData => ({
  version: 1,
  questions: [],
  attempts: [],
  annotations: {},
  sessions: [],
  imports: [],
});

/** A session that is a module-style SAT Practice Test. */
export type PracticeTestSession = Session & { practiceTest: PracticeTest };
/** A session that is a PAA timed test. */
export type TimedTestSession = Session & { timedTest: TimedTest };

/** A session that is a TSI practice test. */
export type TsiTestSession = Session & { tsiTest: TsiTest };
export const isTsiTestSession = (session: Session): session is TsiTestSession =>
  !!session.tsiTest;
export const isPracticeTestSession = (
  session: Session,
): session is PracticeTestSession => !!session.practiceTest;
export const isTimedTestSession = (
  session: Session,
): session is TimedTestSession => !!session.timedTest;
