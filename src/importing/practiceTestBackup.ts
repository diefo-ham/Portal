import type { Question, Session } from "../core/model";
import { moduleSize, moduleLimit, selections } from "../core/practiceTest";
/** Reject malformed test metadata rather than silently turning it into ordinary practice. */
export function validatePracticeTest(session: Session, questions: Question[]) {
  const t = session.practiceTest!;
  const fail = () => {
    throw new Error("Invalid Practice Test state in backup.");
  };
  const finite = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= 0;
  if (
    !t ||
    t.version !== 1 ||
    !selections.some((s) => s.value === t.selection) ||
    !["timed", "untimed"].includes(t.timing) ||
    !["module", "break", "results"].includes(t.phase) ||
    !Array.isArray(t.modules) ||
    !t.modules.length ||
    t.modules.length > 4 ||
    !Number.isInteger(t.currentModule) ||
    t.currentModule !== t.modules.length - 1 ||
    !t.routes ||
    typeof t.routes !== "object" ||
    Array.isArray(t.routes) ||
    (t.reviewingModule !== undefined && typeof t.reviewingModule !== "boolean") ||
    (t.markedForReview !== undefined &&
      (!Array.isArray(t.markedForReview) ||
        new Set(t.markedForReview).size !== t.markedForReview.length ||
        t.markedForReview.some((id) => typeof id !== "string")))
  )
    fail();
  if (
    Object.entries(t.routes).some(
      ([key, value]) =>
        !["math", "reading-writing"].includes(key) ||
        !["lower", "higher"].includes(value),
    )
  )
    fail();
  const all: string[] = [];
  for (const [index, m] of t.modules.entries()) {
    if (
      !m ||
      !["math", "reading-writing"].includes(m.section) ||
      !["first", "lower", "higher"].includes(m.mix) ||
      !Array.isArray(m.questionIds) ||
      m.questionIds.length !== moduleSize(m.section) ||
      !Array.isArray(m.unscoredIds) ||
      m.unscoredIds.length !== 2 ||
      new Set(m.unscoredIds).size !== 2 ||
      m.unscoredIds.some((id) => !m.questionIds.includes(id)) ||
      !finite(m.startedAt) ||
      (m.pausedAt !== undefined && !finite(m.pausedAt)) ||
      (m.pausedMs !== undefined && !finite(m.pausedMs)) ||
      (m.completedAt !== undefined &&
        (!finite(m.completedAt) || m.completedAt < m.startedAt)) ||
      (m.durationMs !== undefined &&
        (!finite(m.durationMs) ||
          (t.timing === "timed" && m.durationMs > moduleLimit(m.section)))) ||
      (m.completedAt === undefined) !== (m.durationMs === undefined)
    )
      fail();
    if (
      m.questionIds.some(
        (id) =>
          !questions.some(
            (q) =>
              q.id === id &&
              q.section === m.section &&
              q.testStatus === "active",
          ),
      )
    )
      fail();
    if (index < t.currentModule && m.completedAt === undefined) fail();
    if (t.selection === "full") {
      if (
        m.section !== (index < 2 ? "reading-writing" : "math") ||
        (index % 2 === 0
          ? m.mix !== "first"
          : m.mix === "first" || t.routes[m.section] !== m.mix)
      )
        fail();
    } else if (
      t.modules.length !== 1 ||
      `${m.section}:${m.mix}` !== t.selection
    )
      fail();
    all.push(...m.questionIds);
  }
  if (
    new Set(all).size !== all.length ||
    JSON.stringify(all) !== JSON.stringify(session.questionIds) ||
    (t.markedForReview || []).some((id) => !all.includes(id))
  )
    fail();
  const current = t.modules[t.currentModule];
  if (
    t.phase === "module" &&
    (current.completedAt !== undefined ||
      !current.questionIds.includes(session.questionIds[session.index]) ||
      session.finishedAt ||
      session.paused !== (current.pausedAt !== undefined))
  )
    fail();
  if (
    t.phase === "break" &&
    (t.selection !== "full" ||
      t.currentModule !== 1 ||
      current.completedAt === undefined ||
      session.finishedAt)
  )
    fail();
  if (
    t.phase === "results" &&
    (!session.finishedAt ||
      current.completedAt === undefined ||
      (t.selection === "full" && t.modules.length !== 4))
  )
    fail();
  if (
    t.breakStartedAt !== undefined &&
    (!finite(t.breakStartedAt) || t.modules.length < 2)
  )
    fail();
  if (t.phase === "break" && t.breakStartedAt === undefined) fail();
}
