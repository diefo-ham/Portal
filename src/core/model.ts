export type Section = "math" | "reading-writing";
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
  sourceId?: string;
  source?: string;
  section: Section;
  domain?: string;
  skill?: string;
  difficulty?: Difficulty;
  passage?: string;
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
    provenance: { filename: string; sha256: string; pages: number[] }[];
  };
  importMetadata?: { importedAt?: string; filename?: string; parser?: string };
}
export interface Attempt {
  id: string;
  questionId: string;
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
  section: string;
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
export interface Session {
  practiceTest?: PracticeTest;
  id: string;
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
  calculator?: import("../calculator/model").CalculatorState;
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
export type TestSelection = "full" | `${Section}:${ModuleMix}`;
export interface TestModule {
  section: Section;
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
  routes: Partial<Record<Section, TestRoute>>;
  phase: "module" | "break" | "results";
  /** Test-local state; deliberately separate from persistent annotations. */
  markedForReview?: string[];
  /** Persist the dedicated pre-submission overview across reloads. */
  reviewingModule?: boolean;
  breakStartedAt?: number;
}
export const emptyData = (): StudyData => ({
  version: 1,
  questions: [],
  attempts: [],
  annotations: {},
  sessions: [],
  imports: [],
});
