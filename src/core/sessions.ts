import { sectionLabel } from "./assessments";
import type { Session, StudyData } from "./model";
import { testName } from "./tsiNames";

export const SESSION_NAME_MAX_LENGTH = 80;

/** Turns an English phrase into the portal's language; English passes through. */
export type Say = (
  text: string,
  values?: Record<string, string | number>,
) => string;
const english: Say = (text, values) =>
  values
    ? text.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in values ? String(values[name]) : match,
      )
    : text;

export function normalizeSessionName(value: string): string | undefined {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized) return undefined;
  return Array.from(normalized).slice(0, SESSION_NAME_MAX_LENGTH).join("");
}

export function sessionDefaultName(
  data: StudyData,
  session: Session,
  t: Say = english,
): string {
  if (session.practiceTest) return "Practice Test";
  if (session.tsiTest)
    return testName(session.tsiTest.kind, session.tsiTest.subject);
  const questions = session.questionIds
    .map((id) => data.questions.find((question) => question.id === id))
    .filter((question) => question !== undefined);
  const sections = [...new Set(questions.map((question) => question.section))];
  const section =
    sections.length === 1 ? sectionLabel(sections[0]) : t("Mixed practice");
  const skills = [
    ...new Set(questions.map((question) => question.skill).filter(Boolean)),
  ];
  const domains = [
    ...new Set(questions.map((question) => question.domain).filter(Boolean)),
  ];
  const statuses = session.filters.status
    ? [session.filters.status]
    : session.filters.statuses?.length
      ? session.filters.statuses
      : [];
  const source = session.filters.bookmark
    ? t("Bookmarks")
    : statuses.length === 1 &&
        (statuses[0] === "incorrect" || statuses[0] === "ever-missed")
      ? t("Mistakes")
      : statuses.length === 1 && statuses[0] === "unanswered"
        ? t("Unanswered")
        : "";
  const focus =
    skills.length === 1 ? skills[0] : domains.length === 1 ? domains[0] : "";
  const count = t(
    session.questionIds.length === 1 ? "{n} question" : "{n} questions",
    { n: session.questionIds.length },
  );
  return (
    normalizeSessionName(
      [source, section, focus, count].filter(Boolean).join(" · "),
    ) || t("Practice session")
  );
}

export function sessionDisplayName(
  data: StudyData,
  session: Session,
  t: Say = english,
): string {
  return session.name || sessionDefaultName(data, session, t);
}

export function repracticeSessionName(data: StudyData, session: Session) {
  return normalizeSessionName(
    `${sessionDisplayName(data, session)} — Repractice`,
  );
}
