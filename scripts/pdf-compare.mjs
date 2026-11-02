/** Shared by the local parity scripts. */

const SOFT_HYPHEN = String.fromCharCode(0xad);
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const GREEK_MU = String.fromCharCode(0x3bc);
const MICRO_SIGN = String.fromCharCode(0xb5);

/**
 * Compares text the way a reader sees it: PyMuPDF and pdf.js disagree on a few
 * invisible or look-alike characters (soft hyphen, zero-width space, micro sign
 * versus Greek mu) and on how much whitespace separates runs.
 */
export const comparable = (text) =>
  text
    .split(SOFT_HYPHEN)
    .join("")
    .split(ZERO_WIDTH_SPACE)
    .join("")
    .split(GREEK_MU)
    .join(MICRO_SIGN)
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
