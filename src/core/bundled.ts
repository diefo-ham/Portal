/**
 * The example questions that ship with the app (`public/examples/`). They are
 * original questions written for the portal, one small set per test. They work
 * like any other question in Browse, Practice and Review, but they are not the
 * person's own material: see `hasImportedQuestions` in `assessments.ts`.
 */
import type { Question } from "./model";

/** `source` of every bundled question; kept apart from every importer's label. */
export const EXAMPLES_SOURCE = "Portal example questions";

/** Where the prepared example library is served from, under the app's base path. */
export const EXAMPLES_PATH = "examples/";

export const isBundled = (q: Pick<Question, "bundled">) => q.bundled === true;

/**
 * Browser key that turns the examples off ("off"). Only the browser test suite
 * sets it, so a fresh profile starts empty; the app has no setting for it and a
 * release never sets it. Erase all data removes it with the other `sat-` keys.
 */
export const EXAMPLES_OFF_KEY = "sat-bundled-examples";
