/**
 * Prints the SHA-256 hash of an access code, to paste into
 * src/core/accessCodes.ts. Nothing is saved or sent anywhere.
 *
 *   node scripts/access-hash.ts "SAT-XXXX-XXXX-XXXX-XXXX"
 */
import { createHash } from "node:crypto";

const code = process.argv[2];
if (!code || !/^(SAT|PAA|TSI)-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(code)) {
  console.error(
    'Usage: node scripts/access-hash.ts "SAT-XXXX-XXXX-XXXX-XXXX"  (SAT, PAA or TSI; four groups of four, upper case)',
  );
  process.exit(1);
}
console.log(
  `${code.slice(0, 3)}: "${createHash("sha256").update(code).digest("hex")}"`,
);
