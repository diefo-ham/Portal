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
/**
 * PAA grid-in rule (study guide, "ejercicios para suplir la respuesta"): answers
 * are positive; a decimal is accepted when it is exact, or when it has at least
 * three decimals and is the correct value cut off or rounded at that point
 * (2/3 accepts .666 and .667, never .66 or .67).
 */
function isCorrectGridIn(accepted: string[], answer: string): boolean {
  const text = answer.trim();
  const value = numericValue(text);
  if (value === undefined || value < 0 || /^[-−]/.test(text)) return false;
  const exact = accepted.some((a) => {
    const n = numericValue(a);
    return (
      n !== undefined && Math.abs(n - value) <= 1e-9 * Math.max(1, Math.abs(n))
    );
  });
  if (exact) return true;
  const decimals = /^\d*\.(\d+)$/.exec(text)?.[1].length ?? 0;
  if (decimals < 3) return false;
  const scale = 10 ** decimals;
  return accepted.some((a) => {
    const n = numericValue(a);
    if (n === undefined || n < 0) return false;
    const cut = Math.floor(n * scale + 1e-9) / scale;
    const rounded = Math.round(n * scale) / scale;
    return Math.abs(value - cut) < 1e-12 || Math.abs(value - rounded) < 1e-12;
  });
}
export function isCorrect(q: Question, answer: string): boolean {
  if (q.answer.type === "choice") return q.answer.value === answer;
  if (q.assessment === "PAA") return isCorrectGridIn(q.answer.accepted, answer);
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
/** The parts a filter asks for; none means every part. */
export const selectedSections = (f: Filters): string[] =>
  f.sections?.length ? f.sections : f.section ? [f.section] : [];
export function filterQuestions(data: StudyData, f: Filters): Question[] {
  const sections = selectedSections(f);
  return data.questions.filter((q) => {
    const statuses = f.status
      ? [f.status]
      : f.statuses?.length
        ? f.statuses
        : [];
    const difficulties = f.difficulties?.length
      ? f.difficulties
      : f.difficulty
        ? [f.difficulty]
        : [];
    return (
      (!sections.length || sections.includes(q.section)) &&
      (!f.domain || metadataKey(q.domain) === metadataKey(f.domain)) &&
      (!f.skill || metadataKey(q.skill) === metadataKey(f.skill)) &&
      (!f.domains?.length || f.domains.includes(domainKey(q))) &&
      (!f.skills?.length || f.skills.includes(skillKey(q))) &&
      (!difficulties.length ||
        (!!q.difficulty && difficulties.includes(q.difficulty))) &&
      (f.active === "include" ||
        (f.active === "hide"
          ? q.testStatus !== "active"
          : q.testStatus === (f.active === "only" ? "active" : f.active))) &&
      (!statuses.length ||
        statuses.some((status) => matchesAnswerStatus(data, q.id, status))) &&
      (!f.bookmark || !!data.annotations[q.id]?.bookmarked) &&
      (!f.search ||
        [q.stem, q.passage, q.sourceId, q.skill, q.skillDetail, q.domain]
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
      ...(filters.difficulties
        ? { difficulties: [...filters.difficulties] }
        : {}),
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
/**
 * Like selectSessionQuestions, but questions that share a reading stay together
 * and in their original order. A reading's questions are chosen or left out as a
 * whole where the size allows it. Without shared readings it is the same call.
 */
export function selectSessionQuestionIds(
  questions: readonly Question[],
  ids: string[],
  limit = 0,
  previous: string[] = [],
  random: () => number = Math.random,
): string[] {
  const byId = new Map(questions.map((q, position) => [q.id, { q, position }]));
  if (!ids.some((id) => byId.get(id)?.q.passageGroup))
    return selectSessionQuestions(ids, limit, previous, random);
  const units = new Map<string, string[]>();
  for (const id of [...new Set(ids)].sort(
    (a, b) => (byId.get(a)?.position ?? 0) - (byId.get(b)?.position ?? 0),
  )) {
    const key = byId.get(id)?.q.passageGroup ?? id;
    units.set(key, [...(units.get(key) ?? []), id]);
  }
  const shuffled = [...units.values()];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (!limit) return shuffled.flat();
  const selected: string[] = [];
  const left: string[][] = [];
  for (const unit of shuffled) {
    if (selected.length < limit && selected.length + unit.length <= limit)
      selected.push(...unit);
    else left.push(unit);
  }
  // Whole readings fall short of the size (or one is longer than it): make it up
  // with the first questions, in order, of another reading, so a session is never
  // smaller than asked for while enough questions exist.
  if (selected.length < limit && left.length)
    selected.push(...left[0].slice(0, limit - selected.length));
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
