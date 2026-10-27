import { type StudyData } from "../core/model";
import { parseQuestions } from "./json";
import { validateCalculator } from "../calculator/model";
import {
  normalizeSessionName,
  SESSION_NAME_MAX_LENGTH,
} from "../core/sessions";
export function parseBackup(raw: unknown): StudyData {
  if (!raw || typeof raw !== "object") throw new Error("Invalid backup.");
  const envelope = raw as { format?: string; data?: StudyData };
  if (envelope.format !== "sat-study-backup-v1" || envelope.data?.version !== 1)
    throw new Error("Unsupported backup format.");
  const d = envelope.data;
  const questions = parseQuestions({
    schemaVersion: 1,
    questions: d.questions,
  });
  const ids = new Set(questions.map((q) => q.id));
  const safe = (s: unknown): s is string =>
    typeof s === "string" &&
    !["__proto__", "constructor", "prototype"].includes(s);
  const object = (v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v);
  const date = (v: unknown) =>
    typeof v === "string" && Number.isFinite(Date.parse(v));
  const duration = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (
    !Array.isArray(d.attempts) ||
    !Array.isArray(d.sessions) ||
    !object(d.annotations) ||
    !Array.isArray(d.imports)
  )
    throw new Error("Incomplete backup.");
  for (const s of d.sessions) {
    if (s?.calculator !== undefined)
      s.calculator = validateCalculator(s.calculator);
    if (
      !s ||
      !safe(s.id) ||
      !date(s.startedAt) ||
      (s.finishedAt !== undefined && !date(s.finishedAt)) ||
      !Array.isArray(s.questionIds) ||
      !s.questionIds.length ||
      s.questionIds.some((id) => !ids.has(id)) ||
      new Set(s.questionIds).size !== s.questionIds.length ||
      !Number.isInteger(s.index) ||
      s.index < 0 ||
      s.index >= s.questionIds.length ||
      typeof s.paused !== "boolean" ||
      !object(s.drafts) ||
      !object(s.elapsed) ||
      !object(s.filters)
    )
      throw new Error("Invalid session in backup.");
    if (
      (s.name !== undefined && typeof s.name !== "string") ||
      (s.starred !== undefined && typeof s.starred !== "boolean") ||
      (s.timerVisible !== undefined && typeof s.timerVisible !== "boolean") ||
      (typeof s.name === "string" &&
        Array.from(s.name).length > SESSION_NAME_MAX_LENGTH)
    )
      throw new Error("Invalid session label in backup.");
    if (typeof s.name === "string") s.name = normalizeSessionName(s.name);
    if (
      [
        s.filters.domains,
        s.filters.skills,
        s.filters.statuses,
        s.filters.difficulties,
      ].some(
        (values) =>
          values !== undefined &&
          (!Array.isArray(values) ||
            values.length > 200 ||
            values.some((value) => typeof value !== "string")),
      ) ||
      (s.filters.statuses !== undefined &&
        s.filters.statuses.some(
          (status) =>
            !["incorrect", "unanswered", "completed"].includes(status),
        )) ||
      (s.filters.difficulties !== undefined &&
        s.filters.difficulties.some(
          (difficulty) => !["easy", "medium", "hard"].includes(difficulty),
        )) ||
      Object.entries(s.drafts).some(
        ([id, v]) => !s.questionIds.includes(id) || typeof v !== "string",
      ) ||
      Object.entries(s.elapsed).some(
        ([id, v]) => !s.questionIds.includes(id) || !duration(v),
      )
    )
      throw new Error("Invalid saved session work.");
  }
  const sessionIds = new Set(d.sessions.map((s) => s.id));
  if (
    sessionIds.size !== d.sessions.length ||
    new Set(d.attempts.map((a) => a?.id)).size !== d.attempts.length
  )
    throw new Error("Duplicate history IDs.");
  for (const a of d.attempts)
    if (
      !a ||
      !safe(a.id) ||
      !ids.has(a.questionId) ||
      !sessionIds.has(a.sessionId) ||
      !d.sessions
        .find((s) => s.id === a.sessionId)!
        .questionIds.includes(a.questionId) ||
      typeof a.answer !== "string" ||
      typeof a.correct !== "boolean" ||
      !duration(a.durationMs) ||
      !date(a.submittedAt)
    )
      throw new Error("Invalid attempt in backup.");
  for (const [id, a] of Object.entries(d.annotations))
    if (
      !ids.has(id) ||
      !a ||
      typeof a.bookmarked !== "boolean" ||
      typeof a.note !== "string"
    )
      throw new Error("Invalid annotation in backup.");
  for (const x of d.imports)
    if (
      !x ||
      !safe(x.id) ||
      typeof x.filename !== "string" ||
      !date(x.importedAt) ||
      !Number.isInteger(x.added) ||
      x.added < 0 ||
      !Number.isInteger(x.skipped) ||
      x.skipped < 0
    )
      throw new Error("Invalid import history.");
  return {
    ...d,
    questions: questions.map((q, i) => ({
      ...q,
      importMetadata: d.questions[i].importMetadata,
    })),
    sessions: d.sessions.map((s) => ({ ...s, paused: true })),
  };
}
export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
