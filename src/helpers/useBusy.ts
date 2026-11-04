import { useState } from "react";

/**
 * Tracks whether an async action is running, so its buttons can be disabled.
 * `run` clears the flag whether the action succeeds or throws, and rethrows.
 */
export const useBusy = () => {
  const [busy, setBusy] = useState(false);
  const run = async <T>(action: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await action();
    } finally {
      setBusy(false);
    }
  };
  return [busy, run] as const;
};
