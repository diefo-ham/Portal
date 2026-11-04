import { scopeStudyData } from "./assessments";
import type { Assessment, Question, StudyData, TestStatus } from "./model";

/** What the person added, one entry per PDF, read from the questions' own provenance. */
export interface PdfSummary {
  /** Identifies the file: its content hash, or its name when no hash was kept. */
  key: string;
  filename: string;
  assessment: Assessment;
  questions: number;
  /** Questions in this PDF that are in no other stored PDF. Removing the file removes these. */
  onlyHere: number;
  status: Record<TestStatus, number>;
  /** Parts of the test the questions belong to, in the order first seen. */
  sections: string[];
  importedAt?: string;
}

const keyOf = (item: { sha256: string; filename: string }) =>
  item.sha256 || item.filename;

const questionAssessment = (question: Question): Assessment =>
  question.assessment ?? (question.id.startsWith("paa-") ? "PAA" : "SAT");

/** The PDFs behind one test's stored questions, most recently added first. */
export function summarizePdfs(
  data: StudyData,
  assessment: Assessment,
): PdfSummary[] {
  const byKey = new Map<string, PdfSummary>();
  for (const question of data.questions) {
    if (questionAssessment(question) !== assessment) continue;
    // A file listed twice on one question still counts once.
    const files = new Map(
      (question.document?.provenance ?? []).map((item) => [keyOf(item), item]),
    );
    for (const [key, item] of files) {
      let summary = byKey.get(key);
      if (!summary) {
        summary = {
          key,
          filename: item.filename,
          assessment,
          questions: 0,
          onlyHere: 0,
          status: { active: 0, inactive: 0, unknown: 0 },
          sections: [],
        };
        byKey.set(key, summary);
      }
      summary.questions += 1;
      if (files.size === 1) summary.onlyHere += 1;
      summary.status[question.testStatus] += 1;
      if (!summary.sections.includes(question.section))
        summary.sections.push(question.section);
      const at = question.importMetadata?.importedAt;
      if (at && (!summary.importedAt || at > summary.importedAt))
        summary.importedAt = at;
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      (b.importedAt ?? "").localeCompare(a.importedAt ?? "") ||
      a.filename.localeCompare(b.filename),
  );
}

/**
 * Takes one PDF out of one test's library, in place. A question that came from
 * several PDFs stays until the last of them is removed. Answers and bookmarks
 * are kept, as with removing all questions; saved sessions that used a removed
 * question end, and their answers stay without a session. Returns the number of
 * questions removed.
 */
export function removePdfFromData(
  data: StudyData,
  assessment: Assessment,
  key: string,
): number {
  const removed = new Set<string>();
  const kept: Question[] = [];
  for (const question of data.questions) {
    const provenance = question.document?.provenance;
    if (
      questionAssessment(question) !== assessment ||
      !provenance?.some((item) => keyOf(item) === key)
    ) {
      kept.push(question);
      continue;
    }
    const rest = provenance.filter((item) => keyOf(item) !== key);
    if (rest.length) {
      question.document = { ...question.document!, provenance: rest };
      kept.push(question);
    } else removed.add(question.id);
  }
  if (!removed.size) return 0;
  const endedSessions = new Set(
    scopeStudyData(data, assessment)
      .sessions.filter((session) =>
        session.questionIds.some((id) => removed.has(id)),
      )
      .map((session) => session.id),
  );
  data.questions = kept;
  data.sessions = data.sessions.filter(
    (session) => !endedSessions.has(session.id),
  );
  for (const attempt of data.attempts)
    if (attempt.sessionId && endedSessions.has(attempt.sessionId))
      delete attempt.sessionId;
  // Import receipts only record what was added; with nothing left they mean nothing.
  if (!data.questions.length) data.imports = [];
  return removed.size;
}
