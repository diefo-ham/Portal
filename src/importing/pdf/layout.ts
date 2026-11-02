/**
 * Text layout for PDF pages: turns the loose text fragments a PDF reader reports
 * into words and lines, and finds phrases with page coordinates. Pure functions;
 * nothing here touches a PDF library, the DOM, or storage.
 *
 * Coordinates are in points with the origin at the top-left of the page, and
 * boxes follow PyMuPDF's convention so the rules ported from the Python
 * preparation tool keep their numeric thresholds.
 */

/** One run of text as a PDF reader reports it. */
export interface TextFragment {
  text: string;
  /** Left edge of the run. */
  x: number;
  /** Baseline distance from the top of the page. */
  baseline: number;
  width: number;
  /** Font size; tiny values (scaled fonts) are treated as unknown. */
  size: number;
  /** The reader marked a line break after this run. */
  endsLine: boolean;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Word extends Box {
  text: string;
}

export interface Line {
  /** Text with no trailing whitespace. */
  text: string;
  words: Word[];
  baseline: number;
}

export interface PageLayout {
  width: number;
  height: number;
  lines: Line[];
  words: Word[];
  /** Lines joined by newlines, each line terminated, in reading order. */
  text: string;
}

/**
 * A glyph box spans the font size, split between ascent above the baseline and
 * descent below it. This ratio was calibrated against PyMuPDF on the supported
 * export (heading, answer-key, and rationale labels agree to 0.01 pt).
 */
export const ASCENT_RATIO = 0.8555;

const NEW_LINE_BASELINE_TOLERANCE = 2;
const BACKWARD_TOLERANCE = 2;
/**
 * PyMuPDF treats a jump of at least 0.08 of the font size (the larger of the two
 * runs) between two runs, in either direction, as a word space. The bound is
 * sharp: 0.0815 already changes results on the supported export. Kerned pairs
 * such as "T." and a closing quote that starts under the previous period
 * therefore read as separate words.
 */
const WORD_GAP_MIN_RATIO = 0.08;

/**
 * A size is only trusted when it is plausible for printed text. Scaled Type3
 * fonts report 1.2 or 1.35; their real size is about 12, which keeps kerned
 * pairs from reading as spaces.
 */
const usableSize = (size: number) => (size >= 4 ? size : 12);

/** Structural subset of a pdf.js text item, so this module needs no pdf.js types. */
export interface TextItemLike {
  str?: string;
  transform: ArrayLike<number>;
  width: number;
  height: number;
  hasEOL?: boolean;
}

export function fragmentsFromItems(
  items: readonly (TextItemLike | { type?: string })[],
  pageTop: number,
): TextFragment[] {
  const fragments: TextFragment[] = [];
  for (const raw of items) {
    const item = raw as TextItemLike;
    if (typeof item.str !== "string") continue;
    fragments.push({
      text: item.str,
      x: item.transform[4],
      baseline: pageTop - item.transform[5],
      width: item.width,
      size: item.height,
      endsLine: item.hasEOL === true,
    });
  }
  return fragments;
}

const isSpace = (character: string) => /\s/.test(character);

interface Pending {
  text: string;
  x0: number;
  x1: number;
  baseline: number;
  size: number;
}

function wordBox(word: Pending): Word {
  const size = usableSize(word.size);
  return {
    text: word.text,
    x0: word.x0,
    x1: word.x1,
    y0: word.baseline - ASCENT_RATIO * size,
    y1: word.baseline + (1 - ASCENT_RATIO) * size,
  };
}

function lineFrom(fragments: TextFragment[]): Line | undefined {
  let text = "";
  const words: Word[] = [];
  let current: Pending | undefined;
  let previousEnd: number | undefined;
  let previousSize = 8;
  const flush = () => {
    if (current) words.push(wordBox(current));
    current = undefined;
  };
  for (const fragment of fragments) {
    const size = usableSize(fragment.size);
    const startsWithSpace =
      fragment.text.length > 0 && isSpace(fragment.text[0]);
    // A jump between runs with no space character between them still separates words.
    if (previousEnd !== undefined && current && !startsWithSpace) {
      const basis = Math.max(size, usableSize(previousSize));
      const jump = Math.abs(fragment.x - previousEnd) / basis;
      if (jump >= WORD_GAP_MIN_RATIO) {
        flush();
        text += " ";
      }
    }
    let index = 0;
    const length = fragment.text.length;
    while (index < length) {
      const character = fragment.text[index];
      if (isSpace(character)) {
        flush();
        text += character;
        index++;
        continue;
      }
      const start = index;
      while (index < length && !isSpace(fragment.text[index])) index++;
      const part = fragment.text.slice(start, index);
      const left = fragment.x + (fragment.width * start) / length;
      const right = fragment.x + (fragment.width * index) / length;
      if (current) {
        current.text += part;
        current.x1 = right;
      } else
        current = {
          text: part,
          x0: left,
          x1: right,
          baseline: fragment.baseline,
          size: fragment.size,
        };
      text += part;
    }
    previousEnd = fragment.x + fragment.width;
    previousSize = fragment.size;
  }
  flush();
  const trimmed = text.replace(/\s+$/, "");
  if (!trimmed) return undefined;
  return { text: trimmed, words, baseline: fragments[0].baseline };
}

/** Groups fragments, in content order, into lines. */
export function layoutPage(
  fragments: readonly TextFragment[],
  height: number,
  width = 612,
): PageLayout {
  const lines: Line[] = [];
  let group: TextFragment[] = [];
  let previous: TextFragment | undefined;
  const close = () => {
    const line = group.length ? lineFrom(group) : undefined;
    if (line) lines.push(line);
    group = [];
  };
  for (const fragment of fragments) {
    if (
      previous &&
      group.length &&
      (previous.endsLine ||
        Math.abs(fragment.baseline - previous.baseline) >
          NEW_LINE_BASELINE_TOLERANCE ||
        fragment.x < previous.x - BACKWARD_TOLERANCE)
    )
      close();
    group.push(fragment);
    previous = fragment;
  }
  close();
  return {
    width,
    height,
    lines,
    words: lines.flatMap((line) => line.words),
    text:
      lines.map((line) => line.text).join("\n") + (lines.length ? "\n" : ""),
  };
}

/**
 * Case-insensitive phrase search within single lines, like PyMuPDF's
 * `search_for`. Hits are returned in reading order.
 */
export function findPhrase(page: PageLayout, phrase: string): Box[] {
  const target = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  const hits: Box[] = [];
  for (const line of page.lines) {
    const words = line.words;
    for (let start = 0; start + target.length <= words.length; start++) {
      const window = words.slice(start, start + target.length);
      if (window.every((word, i) => word.text.toLowerCase() === target[i])) {
        hits.push({
          x0: window[0].x0,
          y0: Math.min(...window.map((word) => word.y0)),
          x1: window[window.length - 1].x1,
          y1: Math.max(...window.map((word) => word.y1)),
        });
        start += target.length - 1;
      }
    }
  }
  return hits;
}
