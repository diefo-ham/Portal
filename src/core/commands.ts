import { assessmentOfQuestions, scopeStudyData } from "./assessments";
import type { Assessment, Filters, Session, StudyData } from "./model";
import { createSession, isCorrect, numericValue } from "./practice";
import { normalizeSessionName } from "./sessions";

/** Domain operations mutate a transaction-local snapshot, never UI or storage. */
export function beginSession(
  data: StudyData,
  questionIds: string[],
  filters: Filters,
  name?: string,
  timerVisible = true,
): Session {
  if (
    !questionIds.length ||
    questionIds.some((id) => !data.questions.some((q) => q.id === id))
  )
    throw new Error("Select existing questions before starting a session.");
  const assessment = assessmentOfQuestions(data, questionIds);
  if (!assessment)
    throw new Error("A session uses questions from one test only.");
  const session = createSession([...new Set(questionIds)], filters);
  session.assessment = assessment;
  session.name = normalizeSessionName(name || "");
  session.timerVisible = timerVisible;
  data.sessions.push(session);
  return session;
}

export function renameSession(
  data: StudyData,
  sessionId: string,
  name: string,
) {
  const session = data.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) throw new Error("Session no longer exists.");
  session.name = normalizeSessionName(name);
}

export function toggleSessionStar(data: StudyData, sessionId: string) {
  const session = data.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) throw new Error("Session no longer exists.");
  session.starred = !session.starred;
}

/**
 * Removes a session from the lists. By default its answers stay in the study
 * history (mistakes, accuracy), without a session; with `removeAnswers` they go
 * too, and those questions are unanswered again. Bookmarks are never touched.
 */
export function deleteSession(
  data: StudyData,
  sessionId: string,
  removeAnswers = false,
) {
  const index = data.sessions.findIndex((session) => session.id === sessionId);
  if (index < 0) throw new Error("Session no longer exists.");
  data.sessions.splice(index, 1);
  if (removeAnswers)
    data.attempts = data.attempts.filter(
      (attempt) => attempt.sessionId !== sessionId,
    );
  else
    for (const attempt of data.attempts)
      if (attempt.sessionId === sessionId) delete attempt.sessionId;
}

export function submitAnswer(
  data: StudyData,
  sessionId: string,
  questionId: string,
  answer: string,
) {
  const session = data.sessions.find((s) => s.id === sessionId);
  const question = data.questions.find((q) => q.id === questionId);
  if (
    !session ||
    session.practiceTest ||
    session.finishedAt ||
    !question ||
    !session.questionIds.includes(questionId)
  )
    throw new Error("This question does not belong to an open session.");
  // Double clicks or another tab must not create two attempts in one session.
  if (
    data.attempts.some(
      (a) => a.sessionId === sessionId && a.questionId === questionId,
    )
  )
    return;
  if (
    question.answer.type === "choice"
      ? !question.choices?.some((c) => c.id === answer)
      : numericValue(answer) === undefined
  )
    throw new Error("Choose an answer or enter a valid number.");
  session.drafts[questionId] = answer;
  data.attempts.push({
    id: crypto.randomUUID(),
    questionId,
    assessment: question.assessment ?? session.assessment ?? "SAT",
    sessionId,
    answer,
    correct: isCorrect(question, answer),
    durationMs: Math.round(session.elapsed[questionId] || 0),
    submittedAt: new Date().toISOString(),
  });
}

export function finishSession(data: StudyData, sessionId: string) {
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("Session no longer exists.");
  if (session.practiceTest)
    throw new Error("Finish the current Practice Test module instead.");
  session.finishedAt ??= new Date().toISOString();
}

/** Clear personal study records; retain question definitions and import receipts.
 * The storage adapter commits this as one atomic state transaction; image assets
 * and interface preferences are outside these fields and are never touched.
 * With an assessment, only that test's progress is cleared.
 */
export function resetStudyProgress(
  data: StudyData,
  clearBookmarks = false,
  assessment?: Assessment,
) {
  const kept = (annotations: StudyData["annotations"]) =>
    clearBookmarks
      ? {}
      : Object.fromEntries(
          Object.entries(annotations)
            .filter(([, annotation]) => annotation.bookmarked)
            .map(([id]) => [id, { bookmarked: true, note: "" }]),
        );
  if (!assessment) {
    data.attempts = [];
    data.sessions = [];
    data.practiceTestUsedIds = [];
    data.annotations = kept(data.annotations);
    return;
  }
  const mine = scopeStudyData(data, assessment);
  const theirs = scopeStudyData(data, assessment === "SAT" ? "PAA" : "SAT");
  data.attempts = theirs.attempts;
  data.sessions = theirs.sessions;
  data.practiceTestUsedIds = theirs.practiceTestUsedIds;
  data.annotations = { ...theirs.annotations, ...kept(mine.annotations) };
}
