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

export interface DomainPerformance {
  key: string;
  section: "math" | "reading-writing";
  domain: string;
  answered: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}

/** Accuracy is calculated from submitted attempts only. Repeated attempts are
 * intentionally retained because this describes study performance over time,
 * rather than the current state of each unique question. */
export function performanceOverview(data: StudyData) {
  const questions = new Map(
    data.questions.map((question) => [question.id, question]),
  );
  const domains = new Map<string, DomainPerformance>();
  let correct = 0;
  for (const attempt of data.attempts) {
    const question = questions.get(attempt.questionId);
    if (!question) continue;
    if (attempt.correct) correct += 1;
    const domain = question.domain || "Domain unspecified";
    const key = `${question.section}:${domain}`;
    const aggregate = domains.get(key) || {
      key,
      section: question.section,
      domain,
      answered: 0,
      correct: 0,
      incorrect: 0,
      accuracy: 0,
    };
    aggregate.answered += 1;
    aggregate.correct += attempt.correct ? 1 : 0;
    aggregate.incorrect += attempt.correct ? 0 : 1;
    aggregate.accuracy = Math.round(
      (100 * aggregate.correct) / aggregate.answered,
    );
    domains.set(key, aggregate);
  }
  const answered = [...domains.values()].reduce(
    (total, domain) => total + domain.answered,
    0,
  );
  return {
    answered,
    correct,
    incorrect: answered - correct,
    accuracy: answered ? Math.round((100 * correct) / answered) : undefined,
    domains: [...domains.values()].sort(
      (a, b) =>
        a.section.localeCompare(b.section) || a.domain.localeCompare(b.domain),
    ),
  };
}
