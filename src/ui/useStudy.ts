import { useCallback, useEffect, useState } from "react";
import { type StudyData } from "../core/model";
import { readData, updateData } from "../storage/database";
export function useStudy() {
  const [data, setData] = useState<StudyData>();
  const [error, setError] = useState("");
  const [writes, setWrites] = useState(0);
  useEffect(() => {
    readData()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);
  const mutate = useCallback(async (fn: (d: StudyData) => void) => {
    setWrites((n) => n + 1);
    try {
      const next = await updateData(fn);
      setData(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setWrites((n) => n - 1);
    }
  }, []);
  return { data, mutate, error, setError, saving: writes > 0 };
}
