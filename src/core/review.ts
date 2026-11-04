import { assessmentInfo } from "./assessments";
import {
  assessmentOf,
  defaultFilters,
  type Assessment,
  type SatSection,
  type Section,
  type Session,
  type StudyData,
} from "./model";
import { filterQuestions, latestAttempt } from "./practice";
import { metadataKey, metadataName, skillKey } from "./taxonomy";

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

export interface SessionTiming {
  /** Cumulative active Practice time across every visited question. */
  totalMs?: number;
  /** Submitted-question time only; unanswered time is deliberately excluded. */
  averageAnsweredMs?: number;
}

/** Timing is already persisted per question and snapshotted on each attempt.
 * Undefined distinguishes older/unrecorded timing from a meaningful zero. */
export function sessionTiming(
  data: StudyData,
  session: Session,
): SessionTiming {
  const elapsed = Object.values(session.elapsed).filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  const attempts = data.attempts.filter(
    (attempt) => attempt.sessionId === session.id,
  );
  return {
    totalMs: elapsed.length
      ? elapsed.reduce((total, value) => total + value, 0)
      : undefined,
    averageAnsweredMs:
      elapsed.length && attempts.length
        ? attempts.reduce((total, attempt) => total + attempt.durationMs, 0) /
          attempts.length
        : undefined,
  };
}

// Revisit unanswered *assigned* material, rather than treating the entire unseen
// bank as unfinished work. A later answer resolves it in the global review queue.
export function reviewQueues(data: StudyData, protectTests = true) {
  // A timed test still in progress has not left anything unanswered yet.
  const assigned = new Set(
    data.sessions
      .filter((s) => !(s.timedTest && !s.finishedAt))
      .flatMap((s) => s.questionIds),
  );
  const eligible = filterQuestions(data, {
    ...defaultFilters,
    statuses: [],
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

export const SAT_DOMAINS = assessmentInfo("SAT").domains as Record<
  SatSection,
  readonly string[]
>;

export interface AttemptPerformance {
  attempts: number;
  correct: number;
  incorrect: number;
  accuracy?: number;
  /** Chronological submitted outcomes; retained for evidence-aware displays. */
  outcomes: boolean[];
}

export interface SkillPerformance extends AttemptPerformance {
  key: string;
  skill: string;
}

export interface DomainPerformance extends AttemptPerformance {
  key: string;
  section: Section;
  domain: string;
  questionIds: string[];
  skills: SkillPerformance[];
}

/** Accuracy is calculated from submitted attempts only. Repeated attempts are
 * intentionally retained because this describes study performance over time,
 * rather than the current state of each unique question. */
export function performanceOverview(
  data: StudyData,
  assessment: Assessment = "SAT",
) {
  const info = assessmentInfo(assessment);
  const ownQuestions = data.questions.filter(
    (question) => assessmentOf(question) === assessment,
  );
  const questions = new Map(
    ownQuestions.map((question) => [question.id, question]),
  );
  type MutableMetric = Omit<AttemptPerformance, "accuracy">;
  type MutableDomain = Omit<
    DomainPerformance,
    keyof AttemptPerformance | "skills"
  > &
    MutableMetric & { skills: Map<string, SkillPerformance> };
  const blank = (): MutableMetric => ({
    attempts: 0,
    correct: 0,
    incorrect: 0,
    outcomes: [],
  });
  const add = (metric: MutableMetric, correct: boolean) => {
    metric.attempts += 1;
    metric.correct += correct ? 1 : 0;
    metric.incorrect += correct ? 0 : 1;
    metric.outcomes.push(correct);
  };
  const finish = (metric: MutableMetric): AttemptPerformance => ({
    ...metric,
    accuracy: metric.attempts
      ? Math.round((100 * metric.correct) / metric.attempts)
      : undefined,
  });
  const all = blank();
  const sectionMetrics = Object.fromEntries(
    info.performanceOrder.map((section) => [section, blank()]),
  ) as Record<string, MutableMetric>;
  const domains = new Map<string, MutableDomain>();
  const domainKeyFor = (section: Section, domain: string) =>
    `${section}:${metadataKey(domain)}`;
  const ensureDomain = (section: Section, domain: string) => {
    const key = domainKeyFor(section, domain);
    const existing = domains.get(key);
    if (existing) return existing;
    const created: MutableDomain = {
      key,
      section,
      domain: metadataName(domain) || "Domain unspecified",
      questionIds: [],
      skills: new Map(),
      ...blank(),
    };
    domains.set(key, created);
    return created;
  };
  for (const section of info.performanceOrder)
    for (const domain of info.domains[section] ?? [])
      ensureDomain(section, domain);
  for (const question of ownQuestions) {
    const domain = ensureDomain(
      question.section,
      question.domain || "Domain unspecified",
    );
    if (!domain.questionIds.includes(question.id))
      domain.questionIds.push(question.id);
    if (question.skill) {
      const key = skillKey(question);
      if (!domain.skills.has(key))
        domain.skills.set(key, {
          key,
          skill: metadataName(question.skill),
          ...finish(blank()),
        });
    }
  }
  for (const attempt of [...data.attempts].sort((a, b) =>
    a.submittedAt.localeCompare(b.submittedAt),
  )) {
    const question = questions.get(attempt.questionId);
    if (!question) continue;
    add(all, attempt.correct);
    add(sectionMetrics[question.section], attempt.correct);
    const domain = ensureDomain(
      question.section,
      question.domain || "Domain unspecified",
    );
    add(domain, attempt.correct);
    if (question.skill) {
      const key = skillKey(question);
      const skill = domain.skills.get(key)!;
      add(skill, attempt.correct);
      skill.accuracy = skill.attempts
        ? Math.round((100 * skill.correct) / skill.attempts)
        : undefined;
    }
  }
  return {
    all: finish(all),
    sections: Object.fromEntries(
      Object.entries(sectionMetrics).map(([section, metric]) => [
        section,
        finish(metric),
      ]),
    ) as Record<string, AttemptPerformance>,
    domains: [...domains.values()].map((domain) => ({
      ...finish(domain),
      key: domain.key,
      section: domain.section,
      domain: domain.domain,
      questionIds: domain.questionIds,
      skills: [...domain.skills.values()].sort((a, b) =>
        a.skill.localeCompare(b.skill),
      ),
    })),
  };
}
