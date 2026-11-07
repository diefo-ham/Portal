/**
 * Small pieces shared by the question readers (`sat.ts`, `paa.ts`, `tsi.ts`).
 */

/** A reviewed exception for one source ID, supplied by the person importing. */
export interface ReviewedOverride {
  choiceLabelsVerified?: boolean;
  warning?: string;
}

/** Fixes known print-layout artifacts in a skill name. */
export const cleanSkill = (skill: string) =>
  skill
    .replaceAll("Cross-text", "Cross-Text")
    .replaceAll("propor tional", "proportional");
