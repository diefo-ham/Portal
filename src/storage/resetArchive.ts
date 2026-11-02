import type { StudyData } from "../core/model";
import { parseBackup } from "../importing/backup";

export interface ResetArchive {
  format: "sat-study-reset-v1";
  createdAt: string;
  study: Pick<
    StudyData,
    "attempts" | "sessions" | "annotations" | "practiceTestUsedIds"
  >;
}

export function createResetArchive(data: StudyData): ResetArchive {
  return {
    format: "sat-study-reset-v1",
    createdAt: new Date().toISOString(),
    study: structuredClone({
      attempts: data.attempts,
      sessions: data.sessions,
      annotations: data.annotations,
      practiceTestUsedIds: data.practiceTestUsedIds,
    }),
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
    study: {
      attempts: validated.attempts,
      sessions: validated.sessions,
      annotations: validated.annotations,
      practiceTestUsedIds: validated.practiceTestUsedIds,
    },
  };
}
