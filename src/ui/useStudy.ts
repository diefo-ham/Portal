import { useCallback, useEffect, useState } from "react";
import { type Assessment, type StudyData } from "../core/model";
import {
  readData,
  updateData,
  readResetArchive,
  type UpdateOptions,
} from "../storage/database";
import type { ResetArchive } from "../storage/resetArchive";
import { keepStorage, storageErrorMessage } from "../storage/localData";
import { loadPreparedLibrary } from "../importing/preparedLibrary";
export function useStudy(assessment: Assessment = "SAT") {
  const [data, setData] = useState<StudyData>();
  const [archive, setArchive] = useState<ResetArchive>();
  const [error, setError] = useState("");
  const [writes, setWrites] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState(
    "Opening your local library…",
  );
  useEffect(() => {
    loadPreparedLibrary(setLoadingMessage)
      .then(async (next) => {
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
  // Each test keeps its own recovery archive for a progress reset.
  useEffect(() => {
    let current = true;
    readResetArchive(assessment)
      .then((found) => {
        if (current) setArchive(found);
      })
      .catch(() => {
        if (current) setArchive(undefined);
      });
    return () => {
      current = false;
    };
  }, [assessment, data === undefined]);
  const mutate = useCallback(
    async (fn: (d: StudyData) => void, options?: UpdateOptions) => {
      setWrites((n) => n + 1);
      try {
        const next = await updateData(fn, options);
        setData(next);
        if (options) setArchive(await readResetArchive(options.assessment));
        return next;
      } catch (e) {
        setError(storageErrorMessage(e));
        throw e;
      } finally {
        setWrites((n) => n - 1);
      }
    },
    [],
  );
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
    archive,
    mutate,
    adoptLibrary,
    error,
    setError,
    saving: writes > 0,
    loadingMessage,
  };
}
