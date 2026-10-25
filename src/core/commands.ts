import type { Filters, Session, StudyData } from "./model";
import { createSession, isCorrect, numericValue } from "./practice";

/** Domain operations mutate a transaction-local snapshot, never UI or storage. */
export function beginSession(
  data: StudyData,
  questionIds: string[],
  filters: Filters,
): Session {
  if (
    !questionIds.length ||
    questionIds.some((id) => !data.questions.some((q) => q.id === id))
  )
    throw new Error("Select existing questions before starting a session.");
  const session = createSession([...new Set(questionIds)], filters);
  data.sessions
    .filter((s) => !s.finishedAt)
    .forEach((s) => {
      s.finishedAt = session.startedAt;
    });
  data.sessions.push(session);
  return session;
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
  session.finishedAt ??= new Date().toISOString();
}
