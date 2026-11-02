import type { Section, Session, StudyData } from "./model";

export const SESSION_NAME_MAX_LENGTH = 80;

const sectionLabel = (section: Section) =>
  section === "math" ? "Math" : "Reading & Writing";

export function normalizeSessionName(value: string): string | undefined {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized) return undefined;
  return Array.from(normalized).slice(0, SESSION_NAME_MAX_LENGTH).join("");
}

export function sessionDefaultName(data: StudyData, session: Session): string {
  if (session.practiceTest) return "Practice Test";
  const questions = session.questionIds
    .map((id) => data.questions.find((question) => question.id === id))
    .filter((question) => question !== undefined);
  const sections = [...new Set(questions.map((question) => question.section))];
  const section =
    sections.length === 1 ? sectionLabel(sections[0]) : "Mixed practice";
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
    ? "Bookmarks"
    : statuses.length === 1 &&
        (statuses[0] === "incorrect" || statuses[0] === "ever-missed")
      ? "Mistakes"
      : statuses.length === 1 && statuses[0] === "unanswered"
        ? "Unanswered"
        : "";
  const focus =
    skills.length === 1 ? skills[0] : domains.length === 1 ? domains[0] : "";
  const count = `${session.questionIds.length} ${session.questionIds.length === 1 ? "question" : "questions"}`;
  return (
    normalizeSessionName(
      [source, section, focus, count].filter(Boolean).join(" · "),
    ) || "Practice session"
  );
}

export function sessionDisplayName(data: StudyData, session: Session): string {
  return session.name || sessionDefaultName(data, session);
}

export function repracticeSessionName(data: StudyData, session: Session) {
  return normalizeSessionName(
    `${sessionDisplayName(data, session)} — Repractice`,
  );
}
