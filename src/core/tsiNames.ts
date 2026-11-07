import type { TsiSubject, TsiTestKind } from "./model";

/** Names of the TSI practice tests; a leaf module so anything may import it. */
export const subjectName = (subject: TsiSubject) =>
  subject === "elar" ? "ELAR" : "Mathematics";
export const kindName = (kind: TsiTestKind) =>
  kind === "crc" ? "College Readiness" : "Diagnostic";
export const testName = (kind: TsiTestKind, subject: TsiSubject) =>
  `${subjectName(subject)} ${kindName(kind)} test`;
