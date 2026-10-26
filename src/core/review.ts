import { defaultFilters, type Session, type StudyData } from "./model";
import { filterQuestions, latestAttempt } from "./practice";

export function sessionOutcomes(data: StudyData, session: Session) {
  const attempts = new Map(
    data.attempts
      .filter((a) => a.sessionId === session.id)
      .map((a) => [a.questionId, a]),
  );
  return {
    correct: session.questionIds.filter(
      (id) => attempts.get(id)?.correct === true,
    ),
    incorrect: session.questionIds.filter(
      (id) => attempts.get(id)?.correct === false,
    ),
    unanswered: session.questionIds.filter((id) => !attempts.has(id)),
    attempts,
  };
}

// Revisit unanswered *assigned* material, rather than treating the entire unseen
// bank as unfinished work. A later answer resolves it in the global review queue.
export function reviewQueues(data: StudyData, protectTests = true) {
  const assigned = new Set(data.sessions.flatMap((s) => s.questionIds));
  const eligible = filterQuestions(data, {
    ...defaultFilters,
    active: protectTests ? "hide" : "include",
  });
  return {
    mistakes: eligible
      .filter((q) => latestAttempt(data, q.id)?.correct === false)
      .map((q) => q.id),
    unanswered: eligible
      .filter((q) => assigned.has(q.id) && !latestAttempt(data, q.id))
      .map((q) => q.id),
  };
}
