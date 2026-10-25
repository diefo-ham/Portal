import { useEffect, useRef, useState } from "react";
import type { StudyData } from "../core/model";

export function useQuestionTimer(
  sessionId: string,
  questionId: string,
  running: boolean,
  mutate: (update: (data: StudyData) => void) => Promise<StudyData>,
) {
  const unsaved = useRef(0);
  const [pendingMs, setPendingMs] = useState(0);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let previous = performance.now();
    let lastSave = previous;
    const flush = async () => {
      const delta = unsaved.current;
      unsaved.current = 0;
      setPendingMs(0);
      if (delta)
        await mutate((data) => {
          const session = data.sessions.find((s) => s.id === sessionId);
          if (session)
            session.elapsed[questionId] =
              (session.elapsed[questionId] || 0) + delta;
        });
    };
    flushRef.current = flush;
    const timer = setInterval(() => {
      const now = performance.now();
      if (!document.hidden && running)
        unsaved.current += Math.min(now - previous, 2000);
      previous = now;
      setPendingMs(unsaved.current);
      if (now - lastSave >= 5000) {
        lastSave = now;
        void flush().catch(() => {});
      }
    }, 250);
    const visibility = () => {
      previous = performance.now();
      if (document.hidden) void flush().catch(() => {});
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      void flush().catch(() => {});
    };
  }, [sessionId, questionId, running, mutate]);
  return { pendingMs, flush: () => flushRef.current() };
}
