import { studySlice, type StudySlice } from "../core/assessments";
import type { Assessment, StudyData } from "../core/model";
import { parseBackup } from "../importing/backup";

export interface ResetArchive {
  format: "sat-study-reset-v1";
  createdAt: string;
  /** Whose progress this holds. Archives from before PAA support are SAT's. */
  assessment?: Assessment;
  study: StudySlice;
}

/** SAT keeps its original key, so an archive saved before PAA still restores. */
export const resetArchiveKey = (assessment: Assessment) =>
  assessment === "SAT" ? "reset-archive" : `reset-archive-${assessment}`;

export function createResetArchive(
  data: StudyData,
  assessment: Assessment = "SAT",
): ResetArchive {
  return {
    format: "sat-study-reset-v1",
    createdAt: new Date().toISOString(),
    assessment,
    study: structuredClone(studySlice(data, assessment)),
  };
}

/** Reuse strict history validation against the current corpus before recovery.
 * Questions/assets/preferences are never part of the reset archive.
 */
export function validateResetArchive(
  raw: unknown,
  data: StudyData,
): ResetArchive {
  const archive = raw as ResetArchive | undefined;
  if (
    archive?.format !== "sat-study-reset-v1" ||
    typeof archive.createdAt !== "string" ||
    !Number.isFinite(Date.parse(archive.createdAt)) ||
    !archive.study
  )
    throw new Error("No compatible reset archive is available.");
  const validated = parseBackup({
    format: "sat-study-backup-v1",
    data: {
      ...data,
      attempts: archive.study.attempts,
      sessions: archive.study.sessions,
      annotations: archive.study.annotations,
      practiceTestUsedIds: archive.study.practiceTestUsedIds,
    },
  });
  return {
    format: archive.format,
    createdAt: archive.createdAt,
    ...(archive.assessment ? { assessment: archive.assessment } : {}),
    study: {
      attempts: validated.attempts,
      sessions: validated.sessions,
      annotations: validated.annotations,
      practiceTestUsedIds: validated.practiceTestUsedIds,
    },
  };
}
