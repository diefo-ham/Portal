import type { ReviewedOverride } from "./record.ts";

/**
 * Source questions whose printed layout is known to differ from the usual one
 * and that have been checked by eye against their explanation. They carry only
 * a source ID and a note, no question text. Anyone can add more through the
 * optional reviewed-exceptions file; a file entry replaces one of these.
 */
export const KNOWN_EXCEPTIONS: Record<string, ReviewedOverride> = {
  e3bbf2bf: {
    choiceLabelsVerified: true,
    warning:
      "The source PDF formats option D as a bullet after option C. Treat the final bullet as option D.",
  },
};
