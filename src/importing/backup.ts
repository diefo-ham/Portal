import { type StudyData } from "../core/model";
import { parseQuestions } from "./json";
import { validateCalculator } from "../calculator/model";
import { validatePracticeTest } from "./practiceTestBackup";
import {
  normalizeSessionName,
  SESSION_NAME_MAX_LENGTH,
} from "../core/sessions";

export interface BackupPreferences {
  theme?: "auto" | "light" | "dark";
  originalPdf?: boolean;
  timerDefault?: boolean;
  showCorrectExplanations?: boolean;
  protectTests?: boolean;
  deleteRemovesAnswers?: boolean;
}

export interface ParsedBackup {
  data: StudyData;
  preferences?: BackupPreferences;
}

function parsePreferences(raw: unknown): BackupPreferences | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid backup preferences.");
  const value = raw as Record<string, unknown>;
  if (
    (value.theme !== undefined &&
      !["auto", "light", "dark"].includes(String(value.theme))) ||
    [
      value.originalPdf,
      value.timerDefault,
      value.showCorrectExplanations,
      value.protectTests,
      value.deleteRemovesAnswers,
    ].some((setting) => setting !== undefined && typeof setting !== "boolean")
  )
    throw new Error("Invalid backup preferences.");
  return {
    ...(value.theme !== undefined ? { theme: value.theme as BackupPreferences["theme"] } : {}),
    ...(value.originalPdf !== undefined ? { originalPdf: value.originalPdf as boolean } : {}),
    ...(value.timerDefault !== undefined ? { timerDefault: value.timerDefault as boolean } : {}),
    ...(value.showCorrectExplanations !== undefined
      ? { showCorrectExplanations: value.showCorrectExplanations as boolean }
      : {}),
    ...(value.protectTests !== undefined ? { protectTests: value.protectTests as boolean } : {}),
    ...(value.deleteRemovesAnswers !== undefined
      ? { deleteRemovesAnswers: value.deleteRemovesAnswers as boolean }
      : {}),
  };
}

export function parseBackupPayload(raw: unknown): ParsedBackup {
  const envelope = raw as { preferences?: unknown } | undefined;
  return {
    data: parseBackup(raw),
    preferences: parsePreferences(envelope?.preferences),
  };
}

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
  if (
    d.practiceTestUsedIds !== undefined &&
    (!Array.isArray(d.practiceTestUsedIds) ||
      d.practiceTestUsedIds.some(
        (id) => typeof id !== "string" || !ids.has(id),
      ) ||
      new Set(d.practiceTestUsedIds).size !== d.practiceTestUsedIds.length)
  )
    throw new Error("Invalid Practice Test exposure history.");
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
      (s.eliminated !== undefined && !object(s.eliminated)) ||
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
    if (s.timedTest !== undefined) {
      const test = s.timedTest;
      const number = (v: unknown) =>
        typeof v === "number" && Number.isFinite(v) && v >= 0;
      const optional = (v: unknown) => v === undefined || number(v);
      const segmentOk = (seg: (typeof test.segments)[number]) =>
        object(seg) &&
        ["lectura-redaccion", "matematicas", "ingles"].includes(seg.key) &&
        Array.isArray(seg.parts) &&
        seg.parts.every((part) => typeof part === "string") &&
        Array.isArray(seg.questionIds) &&
        seg.questionIds.length > 0 &&
        seg.questionIds.every((id) => s.questionIds.includes(id)) &&
        [
          seg.limitMs,
          seg.startedAt,
          seg.pausedAt,
          seg.pausedMs,
          seg.completedAt,
          seg.durationMs,
        ].every(optional);
      if (
        !object(test) ||
        test.version !== 2 ||
        !Array.isArray(test.parts) ||
        !test.parts.length ||
        test.parts.some((part) => typeof part !== "string") ||
        !Array.isArray(test.segments) ||
        !test.segments.length ||
        !test.segments.every(segmentOk) ||
        test.segments.reduce((n, seg) => n + seg.questionIds.length, 0) !==
          s.questionIds.length ||
        !Number.isInteger(test.current) ||
        test.current < 0 ||
        test.current >= test.segments.length ||
        !["segment", "break"].includes(test.phase) ||
        !number(test.startedAt) ||
        !optional(test.completedAt) ||
        !optional(test.durationMs) ||
        typeof test.unusedOnly !== "boolean" ||
        !Array.isArray(test.marked) ||
        test.marked.some((id) => !s.questionIds.includes(id))
      )
        throw new Error("Invalid timed test in backup.");
    }
    if (
      [
        s.filters.sections,
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
      (s.eliminated !== undefined &&
        Object.entries(s.eliminated).some(
          ([id, choices]) =>
            !s.questionIds.includes(id) ||
            !Array.isArray(choices) ||
            choices.length > 4 ||
            new Set(choices).size !== choices.length ||
            choices.some(
              (choice) =>
                !safe(choice) ||
                !questions
                  .find((question) => question.id === id)
                  ?.choices?.some((candidate) => candidate.id === choice),
            ),
        )) ||
      Object.entries(s.elapsed).some(
        ([id, v]) => !s.questionIds.includes(id) || !duration(v),
      )
    )
      throw new Error("Invalid saved session work.");
  }
  const sessionIds = new Set(d.sessions.map((s) => s.id));
  for (const session of d.sessions)
    if (session.practiceTest !== undefined)
      validatePracticeTest(session, questions);
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
      (a.sessionId !== undefined &&
        (!safe(a.sessionId) ||
          !sessionIds.has(a.sessionId) ||
          !d.sessions
            .find((s) => s.id === a.sessionId)!
            .questionIds.includes(a.questionId))) ||
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
    practiceTestUsedIds: [
      ...new Set([
        ...(d.practiceTestUsedIds || []),
        ...d.sessions
          .filter((s) => s.practiceTest)
          .flatMap((s) => s.questionIds),
      ]),
    ],
    sessions: d.sessions.map((s) => {
      // A restored test starts paused, with its clock stopped now. Between
      // parts no clock runs, so there is nothing to pause.
      if (s.timedTest && !s.finishedAt) {
        const test = s.timedTest;
        if (test.phase === "break") return { ...s, paused: false };
        return {
          ...s,
          paused: true,
          timedTest: {
            ...test,
            segments: test.segments.map((seg, i) =>
              i === test.current
                ? { ...seg, pausedAt: seg.pausedAt ?? Date.now() }
                : seg,
            ),
          },
        };
      }
      if (!s.practiceTest) return { ...s, paused: true };
      const currentIds = new Set(
        s.practiceTest.modules[s.practiceTest.currentModule]?.questionIds || [],
      );
      const live = s.practiceTest.phase === "module";
      return {
        ...s,
        practiceTest: {
          ...s.practiceTest,
          markedForReview: live
            ? (s.practiceTest.markedForReview || []).filter((id) =>
                currentIds.has(id),
              )
            : [],
          reviewingModule: live && !!s.practiceTest.reviewingModule,
        },
      };
    }),
  };
}
