/**
 * Splits an export into source questions and reads their metadata table.
 * Identity comes from the printed "Question ID", never from page counts.
 */
import { normalizedText } from "./answers.ts";
import type { PageLayout } from "./layout.ts";

const ID_PATTERN = /Question ID:\s*([a-zA-Z0-9]+)/;

export interface SourceRecord {
  id: string;
  startPage: number;
  pages: number[];
  texts: string[];
  section: string;
  domain: string;
  skill: string;
  difficulty: string;
}

/** Metadata column bounds (points), as printed in the export's header table. */
const COLUMNS = {
  section: [130, 245],
  domain: [245, 360],
  skill: [360, 480],
  difficulty: [480, 600],
} as const;

export function indexExport(
  filename: string,
  pages: readonly PageLayout[],
): SourceRecord[] {
  const records: SourceRecord[] = [];
  pages.forEach((page, index) => {
    const match = ID_PATTERN.exec(page.text);
    if (match) {
      const heading = page.words.find(
        (word) => word.text === "Question" && word.x0 < 25 && word.y0 > 70,
      );
      if (!heading)
        throw new Error(
          `Missing question boundary in ${filename}, page ${index + 1}`,
        );
      const column = (left: number, right: number) =>
        normalizedText(
          page.words
            .filter(
              (word) =>
                left <= word.x0 &&
                word.x0 < right &&
                word.y0 > 75 &&
                word.y0 < heading.y0 - 4,
            )
            .map((word) => word.text)
            .join(" "),
        );
      records.push({
        id: match[1].toLowerCase(),
        startPage: index + 1,
        pages: [],
        texts: [],
        section: column(...COLUMNS.section),
        domain: column(...COLUMNS.domain),
        skill: column(...COLUMNS.skill),
        difficulty: column(...COLUMNS.difficulty),
      });
    }
    if (!records.length)
      throw new Error(`Unassigned page ${index + 1} in ${filename}`);
    const last = records[records.length - 1];
    last.pages.push(index + 1);
    last.texts.push(page.text);
  });
  return records;
}
