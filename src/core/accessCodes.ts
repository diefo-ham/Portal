/**
 * THE ACCESS CODES, as hashes. This is the one place to change when a code is
 * replaced.
 *
 * Every question PDF carries one access code for its test ("Ref. SAT-XXXX-…",
 * small gray text at the bottom left of its pages). A PDF is accepted when the
 * code is found on any one page, and the app keeps the SHA-256 of that code with
 * the questions it read from the PDF. The codes themselves are never stored here
 * or anywhere else in the repository: only their SHA-256 hashes.
 *
 * To replace a code:
 *   1. Run `node scripts/access-hash.ts "SAT-XXXX-XXXX-XXXX-XXXX"` (it prints
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
// hash order: Week One, Week Two, Week Three, Week Four
export const ACCESS_HASHES: AccessHashes = {
  SAT: ["3dfe925d6bad047b3c53d55a200a11a4358d2c351ed1962e2f781ab0ad881861", "d2fc78336cc1f2eb96227a8d41c136c21a1ef08c67f90166ff42cb90378e7a58", "71d836f4824716ce54abc11b19b1499c052996d2229d2dbd6b080c6fc39c7f13", "0057ac46755eae6ccfe87196265c83356da2a3b98d6a1651235031c6c3c1973f"],
  PAA: ["e411499ef3aefea8cac342f9cc5354b35c29282d16d616eebe53a4d2af0cfcb5", "a7332bf9a095cb66329263be88004685c1cc0ce347725c0824c7b1f213608861", "24463900db7d2562be83cfb29a8f898c7b193427ef6516b9aa83187e8eaf3ab9", "88553f0a304fad023fa37a5e60c24492d3a18055211c2965c78bd34bfcb5e264"],
  TSI: ["959a7e4f2c500c569e770d9a8006c6cef63f7d8f2c5bf5b100b9f54ffc571e1b", "a71539e5ec0d87ce51837190d62d3c5e40b4ca6b9ad58a0bb354e5a68996a765", "07624cd1f0baa72bf4b0ff191ba3c0cb3b70f3a58ce3515311b553de97925637", "40fed86b1996a3db1964509041314bfba1ae12757c4b0b81cec8e3a0421c6d4d"],
};
