/**
 * Two marks the question PDFs carry outside the question itself, read from a
 * page's text layout:
 *
 *  - the access line, small gray text at the bottom left of every page
 *    ("Ref. SAT-XXXX-XXXX-XXXX-XXXX"), one code per test (`access.ts` checks it);
 *  - on SAT pages, an ACTIVE or INACTIVE badge at the top right, which says
 *    whether the question is in a live official practice test.
 *
 * Pure functions: no PDF library, no DOM, no storage.
 */
import type { Line, PageLayout } from "./layout.ts";

/** The line starts in the left margin and sits in the bottom tenth of the page. */
const BOTTOM = 0.9;
const LEFT = 60;
/** The badge sits in the right quarter and the top 50 points. */
const RIGHT = 0.7;
const TOP = 50;

export interface AccessLine {
  line: Line;
  /** Top of the line in points; the explanation image ends above it. */
  y0: number;
  /** What follows "Ref.", or "" when nothing does. */
  token: string;
}

/** The access line of a page, if it has one. */
export function accessLine(page: PageLayout): AccessLine | undefined {
  const line = page.lines.find(
    (candidate) =>
      /^Ref\.(\s|$)/.test(candidate.text) &&
      candidate.words[0].x0 < LEFT &&
      candidate.words[0].y0 > page.height * BOTTOM,
  );
  if (!line) return undefined;
  return {
    line,
    y0: Math.min(...line.words.map((word) => word.y0)),
    token: line.text.replace(/^Ref\.\s*/, "").trim(),
  };
}

export type Badge = "active" | "inactive";

/** The ACTIVE / INACTIVE badge at the top right of a SAT page. */
export function badgeOf(page: PageLayout): Badge | undefined {
  const word = page.words.find(
    (candidate) =>
      candidate.x0 > page.width * RIGHT &&
      candidate.y0 < TOP &&
      /^(?:IN)?ACTIVE$/.test(candidate.text),
  );
  if (!word) return undefined;
  return word.text === "ACTIVE" ? "active" : "inactive";
}
