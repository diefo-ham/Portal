import type { StudyData } from "../core/model";

/** Saves a change to the study data and resolves with the stored result. */
export type Mutate = (fn: (data: StudyData) => void) => Promise<StudyData>;

/** What to practise again from a finished session. */
export type RetryKind = "mistakes" | "unanswered" | "entire";

/** Where a Review shortcut starts a session from. */
export type ReviewSource = "mistakes" | "unanswered" | "bookmarks";

/** The screens the app switches between. */
export type Page =
  "home" | "review" | "library" | "tests" | "practice" | "data";
