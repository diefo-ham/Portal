/**
 * THE ACCESS CODES, as hashes. This is the one place to change when a code is
 * replaced.
 *
 * Every question PDF carries one access code for its test ("Ref. SAT-XXXX-XXXX-…",
 * small gray text at the bottom left of its pages). A PDF is accepted when the
 * code is found on any one page, and the app keeps the SHA-256 of that code with
 * the questions it read from the PDF. The codes themselves are never stored here
 * or anywhere else in the repository: only their SHA-256 hashes.
 *
 * To replace a code:
 *   1. Run `node scripts/access-hash.mjs "SAT-XXXX-XXXX-XXXX-XXXX"` (it prints
 *      the hash; nothing is saved).
 *   2. Put the hash below, for that test.
 *   3. Release. When a person updates the app (the pop-up cannot be dismissed
 *      without updating), the questions of every PDF whose code is no longer in
 *      the list are removed. Their answers and bookmarks stay.
 *
 * Each test has a list so a new code can be added beside the old one for a while
 * (both PDFs work). Remove the old hash from the list to revoke its PDFs.
 */
import type { Assessment } from "./model";

export type AccessHashes = Record<Assessment, readonly string[]>;

export const ACCESS_HASHES: AccessHashes = {
  SAT: ["3dfe925d6bad047b3c53d55a200a11a4358d2c351ed1962e2f781ab0ad881861"],
  PAA: ["e411499ef3aefea8cac342f9cc5354b35c29282d16d616eebe53a4d2af0cfcb5"],
  TSI: ["959a7e4f2c500c569e770d9a8006c6cef63f7d8f2c5bf5b100b9f54ffc571e1b"],
};
