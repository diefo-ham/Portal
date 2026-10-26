import { useCallback, useEffect, useRef, useState } from "react";
import { emptyCalculator, type CalculatorState } from "./model";
import type { StudyData } from "../core/model";

/** Session-owned state; immediate editing, debounced local writes, explicit
 * flush on close/exit/finish and cleanup. Other questions never clear this work.
 */
export function useCalculatorState(
  sessionId: string,
  saved: CalculatorState | undefined,
  mutate: (fn: (d: StudyData) => void) => Promise<StudyData>,
) {
  const [state, setState] = useState(saved ?? emptyCalculator);
  const latest = useRef(state),
    dirty = useRef(false);
  const flush = useCallback(async () => {
    if (!dirty.current) return;
    const snapshot = latest.current;
    dirty.current = false;
    try {
      await mutate((d) => {
        const session = d.sessions.find((s) => s.id === sessionId);
        if (session) session.calculator = snapshot;
      });
    } catch (error) {
      dirty.current = true;
      throw error;
    }
  }, [sessionId, mutate]);
  const change = (next: CalculatorState) => {
    latest.current = next;
    dirty.current = true;
    setState(next);
  };
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      void flush().catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [state, flush]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) void flush().catch(() => {});
    };
    const pagehide = () => {
      void flush().catch(() => {});
    };
    window.addEventListener("pagehide", pagehide);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", pagehide);
      document.removeEventListener("visibilitychange", visibility);
      void flush().catch(() => {});
    };
  }, [flush]);
  return { state, change, flush };
}
