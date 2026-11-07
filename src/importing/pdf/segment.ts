/**
 * One question of an export: its printed ID and metadata, and the pages it
 * spans. Identity comes from the printed "Question ID", never from page counts.
 * The readers (`paa.ts`) extend it with what each test needs.
 */
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
