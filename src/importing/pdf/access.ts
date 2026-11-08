/**
 * Checking the access code a question PDF carries ("Ref. SAT-XXXX-…"). One code
 * per PDF is enough: the PDF is accepted when it is found on any page. The
 * hashes the code is compared with are in `src/core/accessCodes.ts`.
 *
 * This is a deterrent, not copy protection: it runs in the person's browser, so
 * anyone who can build the app can remove it. Pure functions apart from the
 * hash, which uses the platform's `crypto.subtle`.
 */
import { ACCESS_HASHES, type AccessHashes } from "../../core/accessCodes.ts";
import type { Assessment } from "../../core/model.ts";
import { sha256Hex } from "./panels.ts";

/** Four groups of four after the test's name; letters are upper case. */
const SHAPE = /^(SAT|PAA|TSI)-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/;

/** The SHA-256 of a code, as the app keeps it. */
export const accessDigest = (token: string) =>
  sha256Hex(new TextEncoder().encode(token));

/** Whether a page's access code is accepted for this test. */
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
    const accepted = hashes[assessment];
    if (!accepted?.length || !token || !SHAPE.test(token)) return false;
    // A SAT PDF carrying the PAA code is not accepted.
    if (!token.startsWith(assessment + "-")) return false;
    let digest = known.get(token);
    if (!digest) {
      digest = accessDigest(token);
      known.set(token, digest);
    }
    return accepted.includes(await digest);
  };
}
