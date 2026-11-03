import { clearAssets, deleteDatabase, updateData } from "./database";

/**
 * Removes the questions and their images but keeps answers and bookmarks.
 * Sessions are dropped with the questions they point at (attempts stay, without
 * a session); adding the same PDFs again brings the questions back under the
 * same IDs, so the saved answers apply again.
 */
export async function removeQuestionLibrary() {
  const data = await updateData((d) => {
    d.questions = [];
    d.imports = [];
    d.sessions = [];
    for (const attempt of d.attempts) delete attempt.sessionId;
  });
  await clearAssets();
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
