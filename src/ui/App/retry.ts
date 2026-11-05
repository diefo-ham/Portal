import {
  defaultFilters,
  type AnswerStatus,
  type Filters,
  type Session,
} from "../../core/model";
import { normalizeSessionName } from "../../core/sessions";

/** What to practise again from a finished session. */
export type RetryKind = "mistakes" | "unanswered" | "entire";

/** Where a Review shortcut starts from. */
export type ReviewSource = "mistakes" | "unanswered" | "bookmarks";

/** The answer-status narrowing for "mistakes" and "unanswered"; none otherwise. */
const narrowing = (
  kind: RetryKind | ReviewSource | undefined,
): { status: string; statuses: AnswerStatus[] } => {
  if (kind === "mistakes")
    return { status: "incorrect", statuses: ["incorrect"] };
  if (kind === "unanswered")
    return { status: "unanswered", statuses: ["unanswered"] };
  return { status: "", statuses: [] };
};

const retryLabel: Record<RetryKind, string> = {
  entire: "Repractice",
  mistakes: "Mistakes",
  unanswered: "Unanswered",
};

/** A timed (PAA) test's retry draws from any question, used or not. */
export const timedTestRetryFilters = (kind: RetryKind): Filters => ({
  ...defaultFilters,
  active: "include",
  ...narrowing(kind),
});

/** A Practice Test's retry stays among active (practice-test) questions. */
export const practiceTestRetryFilters = (kind: RetryKind): Filters => ({
  ...defaultFilters,
  active: "only",
  status: narrowing(kind).status,
  statuses: [],
});

/**
 * A plain Practice session's retry: the same filters, narrowed to its mistakes
 * or unanswered questions, and named after the original.
 */
export const sessionRetry = (
  session: Pick<Session, "filters" | "name">,
  kind: RetryKind,
): { filters: Filters; name?: string } => {
  return {
    filters: {
      ...session.filters,
      ...(kind === "entire" ? {} : narrowing(kind)),
    },
    name: session.name
      ? normalizeSessionName(`${session.name} — ${retryLabel[kind]}`)
      : undefined,
  };
};

/** Starting a session from a Review shortcut. */
export const reviewFilters = (
  source: ReviewSource | undefined,
  protectTests: boolean,
): Filters => ({
  ...defaultFilters,
  active: protectTests ? "hide" : "include",
  ...narrowing(source),
  bookmark: source === "bookmarks" ? "yes" : "",
});
