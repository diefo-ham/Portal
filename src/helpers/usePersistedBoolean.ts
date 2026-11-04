import { useState } from "react";
import { readStorage, writeStorage } from "@/src/utils/storage";

/**
 * A true/false preference kept in localStorage. Only the opposite of the
 * default is ever recognised, so a stray value falls back to the default:
 * a default-on setting is off only when stored as "false", and a default-off
 * setting is on only when stored as "true". If storage is unavailable the
 * setting still works for this visit.
 */
export const usePersistedBoolean = (key: string, defaultValue: boolean) => {
  const [value, setValue] = useState(() => {
    const stored = readStorage(key);
    return defaultValue ? stored !== "false" : stored === "true";
  });
  const set = (next: boolean) => {
    setValue(next);
    writeStorage(key, String(next));
  };
  return [value, set] as const;
};
