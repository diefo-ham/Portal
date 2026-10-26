import { useCallback, useEffect, useState } from "react";
import { type StudyData } from "../core/model";
import {
  readData,
  updateData,
  readResetArchive,
  type UpdateOptions,
} from "../storage/database";
import type { ResetArchive } from "../storage/resetArchive";
import { loadPreparedLibrary } from "../importing/preparedLibrary";
export function useStudy() {
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
        setArchive(await readResetArchive());
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
  const mutate = useCallback(
    async (fn: (d: StudyData) => void, options?: UpdateOptions) => {
      setWrites((n) => n + 1);
      try {
        const next = await updateData(fn, options);
        setData(next);
        if (options) setArchive(await readResetArchive());
        return next;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
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
    error,
    setError,
    saving: writes > 0,
    loadingMessage,
  };
}
