export type Section = "math" | "reading-writing";
export type TestStatus = "active" | "inactive" | "unknown";
export interface Question {
  id: string;
  sourceId?: string;
  source?: string;
  section: Section;
  domain?: string;
  skill?: string;
  difficulty?: "easy" | "medium" | "hard";
  passage?: string;
  stem: string;
  choices?: { id: string; text: string }[];
  answer:
    { type: "choice"; value: string } | { type: "numeric"; accepted: string[] };
  rationale?: string;
  testStatus: TestStatus;
  media?: { alt: string; dataUrl: string }[];
  importMetadata?: { importedAt?: string; filename?: string; parser?: string };
}
export interface Attempt {
  id: string;
  questionId: string;
  sessionId: string;
  answer: string;
  correct: boolean;
  durationMs: number;
  submittedAt: string;
}
export interface Annotation {
  bookmarked: boolean;
  note: string;
}
export interface Filters {
  section: string;
  domain: string;
  skill: string;
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
};
export interface Session {
  id: string;
  questionIds: string[];
  index: number;
  startedAt: string;
  finishedAt?: string;
  filters: Filters;
  drafts: Record<string, string>;
  elapsed: Record<string, number>;
  paused: boolean;
}
export interface StudyData {
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
export const emptyData = (): StudyData => ({
  version: 1,
  questions: [],
  attempts: [],
  annotations: {},
  sessions: [],
  imports: [],
});
