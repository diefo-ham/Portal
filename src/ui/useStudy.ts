import { useCallback, useEffect, useState } from "react";
import { type StudyData } from "../core/model";
import { dropResetArchives, readData, updateData } from "../storage/database";
import {
  keepStorage,
  revokeUnverifiedQuestions,
  storageErrorMessage,
} from "../storage/localData";
import {
  loadBundledExamples,
  loadPreparedLibrary,
} from "../importing/preparedLibrary";
export function useStudy() {
  const [data, setData] = useState<StudyData>();
  const [error, setError] = useState("");
  const [writes, setWrites] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState(
    "Opening your local library…",
  );
  // Questions removed on load because their PDF's access code is not accepted.
  const [revoked, setRevoked] = useState(0);
  useEffect(() => {
    loadPreparedLibrary(setLoadingMessage)
      // A damaged local library is reported, but the questions already stored
      // and the bundled examples still load.
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .then(() => revokeUnverifiedQuestions())
      .then(({ removed }) => {
        if (removed) setRevoked(removed);
        return loadBundledExamples(setLoadingMessage);
      })
      .then((next) => {
        setData(next);
      })
      .catch(async (e) => {
        setError(e instanceof Error ? e.message : String(e));
        try {
          setData(await readData());
        } catch {
          /* retain the storage error */
        }
      });
  }, []);
  // Earlier versions kept a restorable copy of the study state from before a
  // reset. Failing to remove a leftover copy must not disturb the app.
  useEffect(() => {
    void dropResetArchives().catch(() => {});
  }, []);
  const mutate = useCallback(async (fn: (d: StudyData) => void) => {
    setWrites((n) => n + 1);
    try {
      const next = await updateData(fn);
      setData(next);
      return next;
    } catch (e) {
      setError(storageErrorMessage(e));
      throw e;
    } finally {
      setWrites((n) => n - 1);
    }
  }, []);
  /** Runs a preparation that ends in a library, then shows the stored data. */
  const adoptLibrary = useCallback(
    async <T extends { result: { data: StudyData } }>(
      work: () => Promise<T>,
    ) => {
      setWrites((n) => n + 1);
      try {
        const outcome = await work();
        setData(outcome.result.data);
        // Prepared questions are the one thing that is slow to rebuild.
        void keepStorage();
        return outcome;
      } finally {
        setWrites((n) => n - 1);
      }
    },
    [],
  );
  return {
    data,
    mutate,
    adoptLibrary,
    error,
    setError,
    saving: writes > 0,
    loadingMessage,
    revoked,
  };
}
