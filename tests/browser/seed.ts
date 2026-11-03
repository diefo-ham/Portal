import type { Page } from "@playwright/test";
import { emptyData, type StudyData } from "../../src/core/model";
import { parseQuestions } from "../../src/importing/json";
import sample from "../fixtures/synthetic.json" with { type: "json" };

/**
 * Writes study data straight into the app's IndexedDB database and reloads, so a
 * test can start from exact fixtures without going through an import screen.
 * Inline `data:` images are shown as they are, so fixtures need no asset store.
 */
export async function seedStudyData(
  page: Page,
  data: Partial<StudyData>,
): Promise<void> {
  const full = { ...emptyData(), ...data };
  await page.evaluate(async (value) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sat-study-local", 2);
      request.onupgradeneeded = () => {
        for (const name of ["state", "assets"])
          if (!request.result.objectStoreNames.contains(name))
            request.result.createObjectStore(name);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      tx.objectStore("state").put(value, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, full);
  await page.reload();
}

/** Starts from the twelve original example questions the tests share. */
export async function loadSample(page: Page): Promise<void> {
  await seedStudyData(page, { questions: parseQuestions(sample) });
}
