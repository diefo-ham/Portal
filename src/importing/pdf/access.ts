/**
 * The access code each question PDF carries on every page ("Ref. SAT-XXXX-…").
 * It says the PDF is one of the portal's own, for the right test. Only the
 * SHA-256 hash of each code is kept here, so this file, the repository and the
 * built app do not contain the codes themselves.
 *
 * This is a deterrent, not copy protection: it runs in the person's browser, so
 * anyone who can build the app can remove it. Pure functions apart from the
 * hash, which uses the platform's `crypto.subtle`.
 */
import type { Assessment } from "../../core/model.ts";
import { sha256Hex } from "./panels.ts";

export type AccessHashes = Record<Assessment, string>;

/** SHA-256 of "SAT-…", "PAA-…" and "TSI-…" (the whole code, upper case). */
export const ACCESS_HASHES: AccessHashes = {
  SAT: "3dfe925d6bad047b3c53d55a200a11a4358d2c351ed1962e2f781ab0ad881861",
  PAA: "e411499ef3aefea8cac342f9cc5354b35c29282d16d616eebe53a4d2af0cfcb5",
  TSI: "959a7e4f2c500c569e770d9a8006c6cef63f7d8f2c5bf5b100b9f54ffc571e1b",
};

/** Four groups of four after the test's name; letters are upper case. */
const SHAPE = /^(SAT|PAA|TSI)-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/;

/** Whether a page's access code is the one for this test. */
export type AccessCheck = (
  assessment: Assessment,
  token: string | undefined,
) => Promise<boolean>;

/**
 * A checker for the given hashes. Answers are remembered per code, so a
 * 4,000-page file costs one hash, not 4,000.
 */
export function accessChecker(
  hashes: Readonly<Partial<AccessHashes>> = ACCESS_HASHES,
): AccessCheck {
  const known = new Map<string, Promise<string>>();
  return async (assessment, token) => {
    const expected = hashes[assessment];
    if (!expected || !token || !SHAPE.test(token)) return false;
    // A SAT page carrying the PAA code is not accepted.
    if (!token.startsWith(assessment + "-")) return false;
    let digest = known.get(token);
    if (!digest) {
      digest = sha256Hex(new TextEncoder().encode(token));
      known.set(token, digest);
    }
    return (await digest) === expected;
  };
}
