import { ACCESS_HASHES, type AccessHashes } from "../core/accessCodes";
import type { Assessment, StudyData } from "../core/model";
import {
  isUnverified,
  removePdfFromData,
  revokeUnverifiedPdfs,
} from "../core/pdfLibrary";
import { referencedAssetKeys } from "../importing/documents";
import { EXAMPLES_RECEIPT } from "../importing/preparedLibrary";
import {
  clearAssets,
  deleteAssetsExcept,
  deleteDatabase,
  readData,
  updateData,
} from "./database";

/**
 * Removes the questions and their images but keeps answers and bookmarks.
 * Sessions are dropped with the questions they point at (attempts stay, without
 * a session); adding the same PDFs again brings the questions back under the
 * same IDs, so the saved answers apply again. With an assessment, only that
 * test's questions go and the other test is left as it is. The bundled example
 * questions are not the person's: they stay, with their images, and so do the
 * sessions made only of them.
 */
export async function removeQuestionLibrary(assessment?: Assessment) {
  const data = await updateData((d) => {
    const removed = new Set(
      d.questions
        .filter(
          (q) =>
            q.bundled !== true && (!assessment || q.assessment === assessment),
        )
        .map((q) => q.id),
    );
    d.questions = d.questions.filter((q) => !removed.has(q.id));
    // A session goes when any of its questions did (a mixed one cannot continue).
    const gone = new Set(
      d.sessions
        .filter((s) => s.questionIds.some((id) => removed.has(id)))
        .map((s) => s.id),
    );
    d.sessions = d.sessions.filter((s) => !gone.has(s.id));
    for (const attempt of d.attempts)
      if (
        attempt.sessionId &&
        (gone.has(attempt.sessionId) || removed.has(attempt.questionId))
      )
        delete attempt.sessionId;
    // Receipts of the person's own libraries go, so the same PDFs can be added
    // again; the examples' receipt stays, so they are not copied a second time.
    if (!assessment || !d.questions.some((q) => q.bundled !== true))
      d.imports = d.imports.filter((x) => x.id.startsWith(EXAMPLES_RECEIPT));
  });
  if (data.questions.length)
    await deleteAssetsExcept(referencedAssetKeys(data));
  else await clearAssets();
  return data;
}

/**
 * Checks the stored PDFs against the access codes this version accepts and
 * removes the questions of every PDF whose code is not among them (a replaced
 * code, or a PDF added before codes existed). Answers and bookmarks stay; adding
 * a valid PDF again brings the questions back. Runs whenever the app loads, so a
 * newly installed version applies a replaced code at once. Returns how many
 * questions were removed and the data as it now stands.
 */
export async function revokeUnverifiedQuestions(
  accepted: Readonly<AccessHashes> = ACCESS_HASHES,
): Promise<{ removed: number; data: StudyData }> {
  const current = await readData();
  if (!current.questions.some((q) => isUnverified(q, accepted)))
    return { removed: 0, data: current };
  let removed = 0;
  const data = await updateData((d) => {
    removed = revokeUnverifiedPdfs(d, accepted);
    // With none of the person's own questions left, their import receipts mean
    // nothing; the examples' receipt stays so the examples are not copied again.
    if (!d.questions.some((q) => q.bundled !== true))
      d.imports = d.imports.filter((x) => x.id.startsWith(EXAMPLES_RECEIPT));
  });
  if (data.questions.length)
    await deleteAssetsExcept(referencedAssetKeys(data));
  else await clearAssets();
  return { removed, data };
}

/** Removes one PDF's questions (see `removePdfFromData`); answers and bookmarks stay. */
export async function removePdfQuestions(assessment: Assessment, key: string) {
  const data = await updateData((d) => {
    removePdfFromData(d, assessment, key);
  });
  if (data.questions.length)
    await deleteAssetsExcept(referencedAssetKeys(data));
  else await clearAssets();
  return data;
}

/** Everything this app keeps in the browser: database, settings, offline copy. */
export async function eraseAllLocalData(): Promise<void> {
  await deleteDatabase();
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("sat-")) localStorage.removeItem(key);
  } catch {
    /* storage can be unavailable; the database is already gone */
  }
  if ("caches" in globalThis)
    for (const key of await caches.keys())
      if (key.startsWith("sat-study-")) await caches.delete(key);
  if ("serviceWorker" in navigator)
    for (const registration of await navigator.serviceWorker.getRegistrations())
      await registration.unregister();
}

/** Bytes this site stores in the browser, or undefined when it cannot tell. */
export async function storageUsage(): Promise<number | undefined> {
  try {
    return (await navigator.storage?.estimate?.())?.usage;
  } catch {
    return undefined;
  }
}

/**
 * Asks the browser not to clear this site's data when it runs short of space.
 * Best effort: some browsers decide on their own and the answer can be no.
 */
export async function keepStorage(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Words a person can act on for a failed save, instead of the browser's own. */
export function storageErrorMessage(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "QuotaExceededError")
    return "This browser has no space left to save. Free up space in Settings (Free up space), or make room on this computer, then try again.";
  return error instanceof Error ? error.message : String(error);
}
