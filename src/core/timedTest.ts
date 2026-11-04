import { sectionLabel } from "./assessments";
import {
  createSession,
  isCorrect,
  latestAttempt,
  numericValue,
} from "./practice";
import {
  assessmentOf,
  defaultFilters,
  type Question,
  type Section,
  type Session,
  type SegmentKey,
  type StudyData,
  type TimedSegment,
  type TimedTest,
} from "./model";

/**
 * PAA test mode: questions in the order of the real test, in the real test's
 * separately timed parts (Lectura y Redacción, Matemáticas, Inglés), each with
 * its own clock and locked once it ends, and no feedback until the end. It is its own small thing rather than a variant of the
 * SAT's adaptive modules, which depend on SAT sections, routing and score ranges.
 */

/** Order of the parts on the test. */
export const PART_ORDER: readonly Section[] = [
  "lectura",
  "redaccion",
  "matematicas",
  "ingles",
];
/**
 * The real test (College Board Puerto Rico y América Latina). Questions per
 * part: "Preguntas y respuestas" of the revised PAA, October 2017 (70, 55, 50;
 * 175 in all). Times: the study guide's 2 h 20 min for the first three parts and
 * 40 min for Inglés, split 80 / 60 as in College Board's 2024 comparison with the
 * SAT. (The 2017 document gave 75 / 60 / 50 minutes; the guide is newer.)
 * Lectura and Redacción are timed together, so they share one pace.
 */
export const REAL_TEST = {
  lecturaRedaccion: { questions: 70, minutes: 80 },
  matematicas: { questions: 55, minutes: 60 },
  ingles: { questions: 50, minutes: 40 },
} as const;
/** Minutes per question on the real test, by part. */
const PACE: Record<string, number> = {
  lectura:
    REAL_TEST.lecturaRedaccion.minutes / REAL_TEST.lecturaRedaccion.questions,
  redaccion:
    REAL_TEST.lecturaRedaccion.minutes / REAL_TEST.lecturaRedaccion.questions,
  matematicas: REAL_TEST.matematicas.minutes / REAL_TEST.matematicas.questions,
  ingles: REAL_TEST.ingles.minutes / REAL_TEST.ingles.questions,
};

const paaQuestions = (data: StudyData) =>
  data.questions.filter((q) => assessmentOf(q) === "PAA");

/** Questions a test could draw from: the chosen parts, optionally never answered. */
export function timedTestPool(
  data: StudyData,
  parts: readonly Section[],
  unusedOnly: boolean,
): Question[] {
  return paaQuestions(data).filter(
    (q) =>
      parts.includes(q.section) && (!unusedOnly || !latestAttempt(data, q.id)),
  );
}

/**
 * How many questions each part gets. Parts are weighted by their size on the
 * real test (Lectura y Redacción 70, Matemáticas 55, Inglés 50; the 70 is split
 * between Lectura and Redacción as this pool is), never beyond what a part has.
 */
export function allocateCounts(
  parts: readonly Section[],
  available: readonly number[],
  wanted: number,
): number[] {
  const lr = ["lectura", "redaccion"].reduce(
    (n, part) => n + (available[parts.indexOf(part as Section)] ?? 0),
    0,
  );
  const weight = parts.map((part, i) =>
    part === "matematicas"
      ? REAL_TEST.matematicas.questions
      : part === "ingles"
        ? REAL_TEST.ingles.questions
        : lr
          ? (REAL_TEST.lecturaRedaccion.questions * available[i]) / lr
          : 0,
  );
  const total = available.reduce((a, b) => a + b, 0);
  const goal = Math.max(0, Math.min(wanted, total));
  const share = parts.map(() => 0);
  let remaining = goal;
  while (remaining > 0) {
    const room = share.map((n, i) => i).filter((i) => share[i] < available[i]);
    if (!room.length) break;
    const weights = room.reduce((n, i) => n + weight[i], 0) || room.length;
    const quota = room.map((i) => (remaining * (weight[i] || 1)) / weights);
    room.forEach((i, k) => {
      share[i] += Math.min(Math.floor(quota[k]), available[i] - share[i]);
    });
    let left = goal - share.reduce((a, b) => a + b, 0);
    room
      .map((i, k) => [quota[k] - Math.floor(quota[k]), i] as const)
      .sort((a, b) => b[0] - a[0] || a[1] - b[1])
      .forEach(([, i]) => {
        if (left > 0 && share[i] < available[i]) {
          share[i]++;
          left--;
        }
      });
    remaining = goal - share.reduce((a, b) => a + b, 0);
  }
  return share;
}

/**
 * Chooses `limit` questions from one part, keeping each reading's questions
 * together. The size is hit exactly whenever whole readings can add up to it;
 * otherwise it falls back to the nearest size below.
 */
function pickWholeReadings(
  questions: readonly Question[],
  limit: number,
  random: () => number,
): Set<string> {
  const units = new Map<string, string[]>();
  for (const q of questions) {
    const key = q.passageGroup ?? q.id;
    units.set(key, [...(units.get(key) ?? []), q.id]);
  }
  const shuffled = [...units.values()];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // reach[i]: the sizes the units from i onward can add up to.
  const reach: Set<number>[] = Array.from(
    { length: shuffled.length + 1 },
    () => new Set<number>(),
  );
  reach[shuffled.length].add(0);
  for (let i = shuffled.length - 1; i >= 0; i--)
    for (const sum of reach[i + 1]) {
      reach[i].add(sum);
      if (sum + shuffled[i].length <= limit)
        reach[i].add(sum + shuffled[i].length);
    }
  let target = Math.max(...reach[0]);
  // No reading is small enough: keep the first questions of one, in order.
  if (target === 0) return new Set(shuffled[0].slice(0, limit));
  const chosen = new Set<string>();
  shuffled.forEach((unit, i) => {
    const take =
      target >= unit.length && reach[i + 1].has(target - unit.length);
    const skip = reach[i + 1].has(target);
    if (take && (!skip || random() < 0.5)) {
      unit.forEach((id) => chosen.add(id));
      target -= unit.length;
    }
  });
  return chosen;
}

/**
 * The questions of a test, in order: parts in PAA order, and inside a part the
 * bank's own order, with grid-in questions last in Matemáticas. When fewer
 * questions are wanted than are available, whole readings are kept together.
 */
export function buildTimedTestIds(
  data: StudyData,
  pool: readonly Question[],
  count: number,
  random: () => number = Math.random,
): string[] {
  const position = new Map(data.questions.map((q, i) => [q.id, i]));
  const bankOrder = (a: Question, b: Question) =>
    (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0);
  const byPart = PART_ORDER.map((part) =>
    pool.filter((q) => q.section === part).sort(bankOrder),
  ).filter((questions) => questions.length);
  const share = allocateCounts(
    byPart.map((questions) => questions[0].section),
    byPart.map((questions) => questions.length),
    count,
  );
  return byPart.flatMap((questions, i) => {
    const chosen =
      share[i] >= questions.length
        ? new Set(questions.map((q) => q.id))
        : pickWholeReadings(questions, share[i], random);
    const part = questions.filter((q) => chosen.has(q.id));
    return questions[0].section === "matematicas"
      ? [
          ...part.filter((q) => q.answer.type === "choice"),
          ...part.filter((q) => q.answer.type !== "choice"),
        ].map((q) => q.id)
      : part.map((q) => q.id);
  });
}

/** The separately timed parts of the real test. Lectura and Redacción are timed together. */
export const SEGMENT_ORDER: readonly SegmentKey[] = [
  "lectura-redaccion",
  "matematicas",
  "ingles",
];
export const segmentOf = (part: Section): SegmentKey =>
  part === "matematicas"
    ? "matematicas"
    : part === "ingles"
      ? "ingles"
      : "lectura-redaccion";
export const segmentLabel = (segment: Pick<TimedSegment, "parts">) =>
  segment.parts.map(sectionLabel).join(" y ");

export interface SegmentPlan {
  key: SegmentKey;
  parts: Section[];
  questions: number;
  /** The real test's pace applied to this many questions. */
  minutes: number;
}
/** How many questions each separately timed part would have, and a time for it. */
export function planSegments(
  pool: readonly Question[],
  count: number,
): SegmentPlan[] {
  const parts = PART_ORDER.filter((part) =>
    pool.some((q) => q.section === part),
  );
  const share = allocateCounts(
    parts,
    parts.map((part) => pool.filter((q) => q.section === part).length),
    count,
  );
  return SEGMENT_ORDER.flatMap((key) => {
    const inSegment = parts
      .map((part, i) => [part, share[i]] as const)
      .filter(([part, n]) => segmentOf(part) === key && n > 0);
    if (!inSegment.length) return [];
    const minutes = inSegment.reduce((m, [part, n]) => m + n * PACE[part], 0);
    return [
      {
        key,
        parts: inSegment.map(([part]) => part),
        questions: inSegment.reduce((n, [, k]) => n + k, 0),
        minutes: Math.max(1, Math.ceil(minutes)),
      },
    ];
  });
}

export interface TimedTestOptions {
  parts: Section[];
  count: number;
  /** Minutes allowed for each part; undefined means no limit (a stopwatch). */
  limitMinutes?: Partial<Record<SegmentKey, number>>;
  unusedOnly: boolean;
}

export function beginTimedTest(
  data: StudyData,
  options: TimedTestOptions,
  now = Date.now(),
  random: () => number = Math.random,
): Session {
  if (data.sessions.some((s) => s.timedTest && !s.finishedAt))
    throw new Error("Termina o elimina la prueba que tienes en curso primero.");
  const parts = PART_ORDER.filter((part) => options.parts.includes(part));
  if (!parts.length) throw new Error("Elige al menos una parte.");
  const pool = timedTestPool(data, parts, options.unusedOnly);
  const ids = buildTimedTestIds(data, pool, options.count, random);
  if (!ids.length)
    throw new Error("No hay preguntas disponibles con estas opciones.");
  const section = new Map(data.questions.map((q) => [q.id, q.section]));
  const segments: TimedSegment[] = SEGMENT_ORDER.flatMap((key) => {
    const inSegment = ids.filter((id) => segmentOf(section.get(id)!) === key);
    if (!inSegment.length) return [];
    const minutes = options.limitMinutes?.[key];
    return [
      {
        key,
        // Named for the parts that really have questions in it.
        parts: PART_ORDER.filter((part) =>
          inSegment.some((id) => section.get(id) === part),
        ),
        questionIds: inSegment,
        ...(minutes !== undefined
          ? { limitMs: Math.max(1, Math.round(minutes)) * 60_000 }
          : {}),
      },
    ];
  });
  segments[0].startedAt = now;
  const session = createSession(
    segments.flatMap((segment) => segment.questionIds),
    { ...defaultFilters },
  );
  session.assessment = "PAA";
  session.name = `Modo de prueba · ${parts.map(sectionLabel).join(", ")}`;
  session.timerVisible = true;
  session.timedTest = {
    version: 2,
    parts,
    segments,
    current: 0,
    phase: "segment",
    startedAt: now,
    marked: [],
    unusedOnly: options.unusedOnly,
  };
  session.startedAt = new Date(now).toISOString();
  data.sessions.push(session);
  return session;
}

const find = (data: StudyData, id: string) => {
  const session = data.sessions.find((s) => s.id === id);
  if (!session?.timedTest) throw new Error("La prueba ya no existe.");
  return session as Session & { timedTest: TimedTest };
};

export const currentSegment = (test: TimedTest) => test.segments[test.current];

/** Time on a part's clock so far, without the time spent paused. */
export function segmentElapsed(
  segment: TimedSegment,
  now = Date.now(),
): number {
  if (segment.durationMs !== undefined) return segment.durationMs;
  if (segment.startedAt === undefined) return 0;
  const paused =
    (segment.pausedMs ?? 0) +
    (segment.pausedAt === undefined ? 0 : Math.max(0, now - segment.pausedAt));
  const elapsed = Math.max(0, now - segment.startedAt - paused);
  return segment.limitMs === undefined
    ? elapsed
    : Math.min(elapsed, segment.limitMs);
}
/** Time left on the part being taken; undefined without a limit or between parts. */
export function timedRemaining(test: TimedTest, now = Date.now()) {
  const segment = currentSegment(test);
  return test.phase !== "segment" || segment.limitMs === undefined
    ? undefined
    : Math.max(0, segment.limitMs - segmentElapsed(segment, now));
}
/** The part being taken ran out of time. */
export function timedExpired(session: Session, now = Date.now()) {
  const test = session.timedTest;
  if (!test || session.finishedAt || session.paused || test.phase !== "segment")
    return false;
  const segment = currentSegment(test);
  return (
    segment.limitMs !== undefined &&
    segmentElapsed(segment, now) >= segment.limitMs
  );
}
/** Answers can be changed: a part is running, its clock is, and time is left. */
const open = (session: Session, now: number) =>
  !!session.timedTest &&
  !session.finishedAt &&
  session.timedTest.phase === "segment" &&
  !session.paused &&
  !timedExpired(session, now);
const inCurrent = (session: Session, questionId: string) =>
  currentSegment(session.timedTest!).questionIds.includes(questionId);

export function pauseTimedTest(data: StudyData, id: string, now = Date.now()) {
  const session = find(data, id);
  const test = session.timedTest;
  if (session.finishedAt || session.paused || test.phase !== "segment") return;
  const segment = currentSegment(test);
  segment.pausedAt = Math.max(segment.startedAt ?? now, now);
  session.paused = true;
}
export function resumeTimedTest(data: StudyData, id: string, now = Date.now()) {
  const session = find(data, id);
  if (session.finishedAt || !session.paused) return;
  const segment = currentSegment(session.timedTest);
  if (segment.pausedAt !== undefined) {
    segment.pausedMs =
      (segment.pausedMs ?? 0) + Math.max(0, now - segment.pausedAt);
    delete segment.pausedAt;
  }
  session.paused = false;
}

/** Moves within the part being taken; earlier parts are locked. */
export function goToTimedQuestion(
  data: StudyData,
  id: string,
  index: number,
  now = Date.now(),
) {
  const session = find(data, id);
  const target = session.questionIds[index];
  if (
    !open(session, now) ||
    target === undefined ||
    !inCurrent(session, target)
  )
    return;
  session.index = index;
}
export function saveTimedAnswer(
  data: StudyData,
  id: string,
  questionId: string,
  value: string,
  now = Date.now(),
) {
  const session = find(data, id);
  if (!open(session, now) || !inCurrent(session, questionId)) return;
  if (value) session.drafts[questionId] = value;
  else delete session.drafts[questionId];
}
export function toggleTimedMark(
  data: StudyData,
  id: string,
  questionId: string,
  now = Date.now(),
) {
  const session = find(data, id);
  if (!open(session, now) || !inCurrent(session, questionId)) return;
  const marked = new Set(session.timedTest.marked);
  if (!marked.delete(questionId)) marked.add(questionId);
  session.timedTest.marked = [...marked];
}

const answerIsValid = (question: Question, value = "") =>
  question.answer.type === "choice"
    ? !!question.choices?.some((choice) => choice.id === value)
    : numericValue(value) !== undefined;

/** Closes the part being taken: its clock stops and its answers are locked. */
function closeSegment(test: TimedTest, now: number) {
  const segment = currentSegment(test);
  if (segment.completedAt !== undefined) return;
  segment.durationMs = segmentElapsed(segment, now);
  segment.completedAt = now;
  delete segment.pausedAt;
  test.marked = [];
}

/**
 * Ends the part being taken (by hand, or because its time ran out). After the
 * last part the test is over and is scored; otherwise a break begins, during
 * which no clock runs, until the next part is started.
 */
export function endTimedSegment(data: StudyData, id: string, now = Date.now()) {
  const session = find(data, id);
  const test = session.timedTest;
  if (session.finishedAt || test.phase !== "segment") return;
  closeSegment(test, now);
  session.paused = false;
  if (test.current === test.segments.length - 1) {
    completeTimedTest(data, id, now);
    return;
  }
  test.phase = "break";
}

/** After a break: starts the next part and its clock. */
export function startNextTimedSegment(
  data: StudyData,
  id: string,
  now = Date.now(),
) {
  const session = find(data, id);
  const test = session.timedTest;
  if (session.finishedAt || test.phase !== "break") return;
  test.current++;
  test.phase = "segment";
  const segment = currentSegment(test);
  segment.startedAt = now;
  session.paused = false;
  session.index = session.questionIds.indexOf(segment.questionIds[0]);
}

/** Ends the whole test and scores what was answered. */
export function completeTimedTest(
  data: StudyData,
  id: string,
  now = Date.now(),
) {
  const session = find(data, id);
  if (session.finishedAt) return;
  const test = session.timedTest;
  if (test.phase === "segment") closeSegment(test, now);
  test.phase = "break";
  test.durationMs = test.segments.reduce((n, s) => n + (s.durationMs ?? 0), 0);
  test.completedAt = now;
  session.paused = false;
  test.marked = [];
  for (const questionId of session.questionIds) {
    const question = data.questions.find((q) => q.id === questionId);
    const answer = session.drafts[questionId] ?? "";
    if (!question || !answerIsValid(question, answer)) continue;
    data.attempts.push({
      id: crypto.randomUUID(),
      questionId,
      assessment: "PAA",
      sessionId: id,
      answer,
      correct: isCorrect(question, answer),
      durationMs: Math.round(session.elapsed[questionId] || 0),
      submittedAt: new Date(now).toISOString(),
    });
  }
  session.finishedAt = new Date(now).toISOString();
}

export interface PartResult {
  part: Section;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
}
export function timedSummary(data: StudyData, session: Session) {
  const attempts = new Map(
    data.attempts
      .filter((a) => a.sessionId === session.id)
      .map((a) => [a.questionId, a]),
  );
  const parts: PartResult[] = [];
  for (const id of session.questionIds) {
    const question = data.questions.find((q) => q.id === id);
    if (!question) continue;
    let row = parts.find((r) => r.part === question.section);
    if (!row)
      parts.push(
        (row = {
          part: question.section,
          total: 0,
          correct: 0,
          incorrect: 0,
          unanswered: 0,
        }),
      );
    row.total++;
    const attempt = attempts.get(id);
    if (!attempt) row.unanswered++;
    else if (attempt.correct) row.correct++;
    else row.incorrect++;
  }
  const sum = (key: "total" | "correct" | "incorrect" | "unanswered") =>
    parts.reduce((n, row) => n + row[key], 0);
  const total = sum("total");
  return {
    segments: (session.timedTest?.segments ?? []).map((segment) => ({
      key: segment.key,
      label: segmentLabel(segment),
      questions: segment.questionIds.length,
      durationMs: segment.durationMs ?? 0,
      limitMs: segment.limitMs,
    })),
    parts,
    total,
    correct: sum("correct"),
    incorrect: sum("incorrect"),
    unanswered: sum("unanswered"),
    percent: total ? Math.round((100 * sum("correct")) / total) : 0,
  };
}
