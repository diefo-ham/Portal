import {
  defaultFilters,
  type Filters,
  type Question,
  type StudyData,
  type Session,
} from "./model";
import { domainKey, skillKey, metadataKey } from "./taxonomy";
export function numericValue(text: string): number | undefined {
  const value = text.trim().replace(/−/g, "-");
  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\s*\/\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$/.test(
      value,
    )
  )
    return;
  const parts = value.split("/").map(Number);
  const n = parts.length === 2 ? parts[0] / parts[1] : parts[0];
  return Number.isFinite(n) ? n : undefined;
}
export function isCorrect(q: Question, answer: string): boolean {
  if (q.answer.type === "choice") return q.answer.value === answer;
  const value = numericValue(answer);
  return (
    value !== undefined &&
    q.answer.accepted.some((a) => {
      const n = numericValue(a);
      return (
        n !== undefined &&
        Math.abs(n - value) <= 1e-9 * Math.max(1, Math.abs(n))
      );
    })
  );
}
export function latestAttempt(data: StudyData, id: string) {
  return data.attempts
    .filter((attempt) => attempt.questionId === id)
    .reduce<(typeof data.attempts)[number] | undefined>(
      (latest, attempt) =>
        !latest || attempt.submittedAt >= latest.submittedAt ? attempt : latest,
      undefined,
    );
}
function matchesAnswerStatus(
  data: StudyData,
  questionId: string,
  status: string,
) {
  const attempt = latestAttempt(data, questionId);
  return status === "unanswered"
    ? !attempt
    : status === "completed"
      ? !!attempt
      : status === "ever-missed"
        ? data.attempts.some(
            (candidate) =>
              candidate.questionId === questionId && !candidate.correct,
          )
        : !!attempt && attempt.correct === (status === "correct");
}
export function filterQuestions(data: StudyData, f: Filters): Question[] {
  return data.questions.filter((q) => {
    const statuses = f.statuses?.length
      ? f.statuses
      : f.status
        ? [f.status]
        : [];
    return (
      (!f.section || q.section === f.section) &&
      (!f.domain || metadataKey(q.domain) === metadataKey(f.domain)) &&
      (!f.skill || metadataKey(q.skill) === metadataKey(f.skill)) &&
      (!f.domains?.length || f.domains.includes(domainKey(q))) &&
      (!f.skills?.length || f.skills.includes(skillKey(q))) &&
      (!f.difficulty || q.difficulty === f.difficulty) &&
      (f.active === "include" ||
        (f.active === "hide"
          ? q.testStatus !== "active"
          : q.testStatus === (f.active === "only" ? "active" : f.active))) &&
      (!statuses.length ||
        statuses.some((status) => matchesAnswerStatus(data, q.id, status))) &&
      (!f.bookmark || !!data.annotations[q.id]?.bookmarked) &&
      (!f.search ||
        [q.stem, q.passage, q.sourceId, q.skill, q.domain]
          .join(" ")
          .toLowerCase()
          .includes(f.search.toLowerCase()))
    );
  });
}
export function createSession(
  ids: string[],
  filters = defaultFilters,
): Session {
  return {
    id: crypto.randomUUID(),
    questionIds: [...ids],
    index: 0,
    startedAt: new Date().toISOString(),
    filters: {
      ...filters,
      ...(filters.domains ? { domains: [...filters.domains] } : {}),
      ...(filters.skills ? { skills: [...filters.skills] } : {}),
      ...(filters.statuses ? { statuses: [...filters.statuses] } : {}),
    },
    drafts: {},
    elapsed: {},
    paused: false,
  };
}

/** Shuffle a fresh candidate pool once, before selecting the session size.
 * Saved sessions are never passed through this function when resumed.
 */
export function selectSessionQuestions(
  ids: string[],
  limit = 0,
  previous: string[] = [],
  random: () => number = Math.random,
): string[] {
  const shuffled = [...new Set(ids)];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const selected = shuffled.slice(0, limit || shuffled.length);
  if (
    selected.length > 1 &&
    selected.length === previous.length &&
    selected.every((id, i) => id === previous[i])
  ) {
    [selected[0], selected[1]] = [selected[1], selected[0]];
  }
  return selected;
}
export function summarize(data: StudyData) {
  const attempts = data.attempts;
  return {
    total: attempts.length,
    accuracy: attempts.length
      ? Math.round(
          (100 * attempts.filter((a) => a.correct).length) / attempts.length,
        )
      : 0,
    averageSeconds: attempts.length
      ? Math.round(
          attempts.reduce((n, a) => n + a.durationMs, 0) /
            attempts.length /
            1000,
        )
      : 0,
    weaknesses: [
      ...new Set(data.questions.map((q) => q.skill || "Unspecified skill")),
    ]
      .map((skill) => {
        const ids = new Set(
          data.questions
            .filter((q) => (q.skill || "Unspecified skill") === skill)
            .map((q) => q.id),
        );
        const matching = attempts.filter((a) => ids.has(a.questionId));
        return {
          skill,
          total: matching.length,
          missed: matching.filter((a) => !a.correct).length,
        };
      })
      .filter((s) => s.missed)
      .sort((a, b) => b.missed - a.missed),
  };
}
