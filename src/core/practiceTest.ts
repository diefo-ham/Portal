import {
  defaultFilters,
  type StudyData,
  type Question,
  type SatSection,
  type ModuleMix,
  type TestModule,
  type TestSelection,
  type Session,
  type PracticeTest,
} from "./model";
import { createSession, isCorrect, numericValue } from "./practice";
import { domainKey, metadataKey, skillKey } from "./taxonomy";

const difficultyRank = (q: Question) =>
  q.difficulty === "easy" ? 0 : q.difficulty === "hard" ? 2 : 1;
const readingSkillOrder = [
  "words in context",
  "text structure and purpose",
  "cross-text connections",
  "central ideas and details",
  "command of evidence",
  "inferences",
  "standard english conventions",
  "transitions",
  "rhetorical synthesis",
] as const;

/** Imported sources sometimes qualify Command of Evidence as textual or
 * quantitative, while conventions is represented by its two component
 * skills. Both cases are presentation clusters, not changes to taxonomy. */
const readingCluster = (q: Question) => {
  const skill = metadataKey(q.skill);
  if (skill.startsWith("command of evidence")) return 4;
  if (
    skill === "boundaries" ||
    skill === "form, structure, and sense" ||
    metadataKey(q.domain) === "standard english conventions"
  )
    return 6;
  const exact = readingSkillOrder.indexOf(
    skill as (typeof readingSkillOrder)[number],
  );
  if (exact >= 0) return exact;

  // Keep incomplete/legacy metadata in a sensible broad position without ever
  // pushing it beyond the final Rhetorical Synthesis cluster.
  const domain = metadataKey(q.domain);
  if (domain === "craft and structure") return 1;
  if (domain === "information and ideas") return 3;
  if (domain === "expression of ideas") return 7.5;
  return 7.5;
};

/** Presentation ordering only. Selection and balancing are already complete. */
export function orderModuleQuestions(
  selected: Question[],
  section: SatSection,
): Question[] {
  if (section === "reading-writing")
    return selected.slice().sort((a, b) => {
      return (
        readingCluster(a) - readingCluster(b) ||
        difficultyRank(a) - difficultyRank(b) ||
        skillKey(a).localeCompare(skillKey(b)) ||
        a.id.localeCompare(b.id)
      );
    });

  const buckets = [0, 1, 2].map((rank) =>
    selected
      .filter((q) => difficultyRank(q) === rank)
      .sort(
        (a, b) =>
          domainKey(a).localeCompare(domainKey(b)) || a.id.localeCompare(b.id),
      ),
  );
  const ordered: Question[] = [];
  for (const bucket of buckets) {
    let previousDomain = ordered.length ? domainKey(ordered.at(-1)!) : "";
    while (bucket.length) {
      const next = bucket.findIndex((q) => domainKey(q) !== previousDomain);
      const [question] = bucket.splice(next < 0 ? 0 : next, 1);
      ordered.push(question);
      previousDomain = domainKey(question);
    }
  }
  return ordered;
}

export const moduleSize = (section: SatSection) => (section === "math" ? 22 : 27);
export const moduleLimit = (section: SatSection) =>
  (section === "math" ? 35 : 32) * 60_000;
export const sectionLabel = (section: SatSection) =>
  section === "math" ? "Math" : "Reading and Writing";
export const moduleLabel = (m: Pick<TestModule, "section" | "mix">) =>
  `${sectionLabel(m.section)} — ${m.mix === "first" ? "Module 1" : `Module 2, ${m.mix === "higher" ? "Higher" : "Lower"} Difficulty`}`;
export const selections: { value: TestSelection; label: string }[] = [
  { value: "full", label: "Full Test" },
  ...(["reading-writing", "math"] as const).flatMap((section) =>
    (["first", "lower", "higher"] as const).map((mix) => ({
      value: `${section}:${mix}` as TestSelection,
      label: moduleLabel({ section, mix }),
    })),
  ),
];
export function unusedPool(data: StudyData, section: SatSection) {
  const used = new Set([
    ...(data.practiceTestUsedIds || []),
    ...data.sessions
      .filter((s) => s.practiceTest)
      .flatMap((s) => s.questionIds),
  ]);
  return data.questions.filter(
    (q) =>
      q.testStatus === "active" && q.section === section && !used.has(q.id),
  );
}
export function availability(
  data: StudyData,
  selection: TestSelection,
): string | undefined {
  const sections: SatSection[] =
    selection === "full"
      ? ["reading-writing", "math"]
      : [selection.split(":")[0] as SatSection];
  for (const section of sections) {
    const needed = moduleSize(section) * (selection === "full" ? 2 : 1);
    // Reserve capacity, not identities, for unfinished Full Tests. Adaptive
    // selection remains free to balance the remaining pool when routing occurs.
    const reserved = data.sessions
      .filter((s) => s.practiceTest?.selection === "full" && !s.finishedAt)
      .reduce((sum, s) => {
        const built = s.practiceTest!.modules.filter(
          (m) => m.section === section,
        ).length;
        return sum + (2 - built) * moduleSize(section);
      }, 0);
    const pool = unusedPool(data, section);
    const count = Math.max(0, pool.length - reserved);
    if (count < needed)
      return `${sectionLabel(section)} needs ${needed} unused active questions; ${count} available after reserving capacity for unfinished Full Tests. Import more eligible material, or use Settings → Reset study progress to restore eligibility. Nothing is reset automatically.`;
    if (selection === "full" || !selection.endsWith(":first")) {
      const extreme = Math.max(
        pool.filter((q) => q.difficulty === "easy").length,
        pool.filter((q) => q.difficulty === "hard").length,
      );
      const varied = selection === "full" ? 2 : 1;
      if (pool.length - extreme - reserved / moduleSize(section) < varied)
        return `${sectionLabel(section)} needs more unused active questions with a different difficulty mix. A Module 2 cannot contain only Easy or only Hard questions. Import more eligible material, or open Settings → Reset study progress.`;
    }
  }
  return undefined;
}
/** Greedy deficit balancing. Targets are approximate, never proprietary SAT blueprints.
 * Difficulty targets: first 30/40/30, lower 50/35/15, higher 15/35/50.
 * Equal domain representation, then skill diversity, with seeded random tie breaks.
 * Missing difficulty counts as medium. Scarce metadata gracefully redistributes slots. */
export function constructModule(
  pool: Question[],
  section: SatSection,
  mix: ModuleMix,
  random = Math.random,
): Question[] {
  let remaining = [
    ...new Map(
      pool
        .filter((q) => q.section === section && q.testStatus === "active")
        .map((q) => [q.id, q]),
    ).values(),
  ];
  const size = moduleSize(section);
  if (remaining.length < size)
    throw new Error(
      "Not enough unused eligible active questions. Open Settings → Reset study progress, or import more questions.",
    );
  const targets =
    mix === "first"
      ? [0.3, 0.4, 0.3]
      : mix === "lower"
        ? [0.5, 0.35, 0.15]
        : [0.15, 0.35, 0.5];
  const domains = new Set(remaining.map(domainKey));
  const difficultyCounts = [0, 0, 0];
  const domainCounts = new Map<string, number>();
  const skillCounts = new Map<string, number>();
  const selected: Question[] = [];
  while (selected.length < size) {
    const ranked = remaining
      .map((q) => {
        const difficulty =
          q.difficulty === "easy" ? 0 : q.difficulty === "hard" ? 2 : 1;
        const score =
          (4 * (targets[difficulty] * size - difficultyCounts[difficulty])) /
            Math.max(1, targets[difficulty] * size) +
          (3 * (size / domains.size - (domainCounts.get(domainKey(q)) || 0))) /
            Math.max(1, size / domains.size) -
          0.25 * (skillCounts.get(skillKey(q)) || 0);
        return { q, difficulty, score, tie: random() };
      })
      .sort(
        (a, b) =>
          b.score - a.score || a.tie - b.tie || a.q.id.localeCompare(b.q.id),
      );
    const { q, difficulty } = ranked[0];
    selected.push(q);
    difficultyCounts[difficulty]++;
    domainCounts.set(domainKey(q), (domainCounts.get(domainKey(q)) || 0) + 1);
    skillCounts.set(skillKey(q), (skillCounts.get(skillKey(q)) || 0) + 1);
    remaining = remaining.filter((candidate) => candidate.id !== q.id);
  }
  if (
    mix !== "first" &&
    (selected.every((q) => q.difficulty === "easy") ||
      selected.every((q) => q.difficulty === "hard"))
  ) {
    const alternate = remaining.find(
      (q) => q.difficulty !== selected[0].difficulty,
    );
    if (!alternate)
      throw new Error(
        "Not enough unused active questions with varied difficulty for Module 2. Import more eligible material, or open Settings → Reset study progress.",
      );
    selected[selected.length - 1] = alternate;
  }
  return orderModuleQuestions(selected, section);
}
function appendModule(
  data: StudyData,
  session: Session,
  section: SatSection,
  mix: ModuleMix,
  now: number,
  random: () => number,
) {
  let pool = unusedPool(data, section);
  // Protect a small amount of difficulty variety for future Full Test modules,
  // in addition to the count reservation enforced by availability().
  const futureOtherModules = data.sessions
    .filter(
      (s) =>
        s.id !== session.id &&
        s.practiceTest?.selection === "full" &&
        !s.finishedAt,
    )
    .reduce(
      (sum, s) =>
        sum +
        2 -
        s.practiceTest!.modules.filter((m) => m.section === section).length,
      0,
    );
  const reserve =
    futureOtherModules +
    (session.practiceTest!.selection === "full" && mix === "first" ? 1 : 0);
  const dominant =
    pool.filter((q) => q.difficulty === "easy").length >
    pool.filter((q) => q.difficulty === "hard").length
      ? "easy"
      : "hard";
  const protectedIds = new Set(
    pool
      .filter((q) => q.difficulty !== dominant)
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, reserve)
      .map((q) => q.id),
  );
  pool = pool.filter((q) => !protectedIds.has(q.id));
  const ids = constructModule(pool, section, mix, random).map((q) => q.id);
  const first = Math.floor(random() * ids.length);
  const second =
    (first + 1 + Math.floor(random() * (ids.length - 1))) % ids.length;
  session.practiceTest!.modules.push({
    section,
    mix,
    questionIds: ids,
    unscoredIds: [ids[first], ids[second]],
    startedAt: now,
  });
  session.practiceTest!.reviewingModule = false;
  session.questionIds.push(...ids);
  data.practiceTestUsedIds = [
    ...new Set([...(data.practiceTestUsedIds || []), ...ids]),
  ];
  session.index = session.questionIds.length - ids.length;
}
export function beginPracticeTest(
  data: StudyData,
  selection: TestSelection,
  timing: PracticeTest["timing"],
  now = Date.now(),
  random = Math.random,
) {
  const error = availability(data, selection);
  if (error) throw new Error(error);
  const session = createSession([], {
    ...defaultFilters,
    active: "only",
    statuses: [],
  });
  session.startedAt = new Date(now).toISOString();
  session.assessment = "SAT";
  session.name = `Practice Test · ${selections.find((s) => s.value === selection)!.label}`;
  session.paused = false;
  session.timerVisible = true;
  session.practiceTest = {
    version: 1,
    selection,
    timing,
    modules: [],
    currentModule: 0,
    routes: {},
    phase: "module",
    markedForReview: [],
    reviewingModule: false,
  };
  const [section, mix] =
    selection === "full"
      ? (["reading-writing", "first"] as const)
      : (selection.split(":") as [SatSection, ModuleMix]);
  appendModule(data, session, section, mix, now, random);
  data.sessions.push(session);
  return session;
}

/** Abandon only an unfinished Practice Test attempt. The exposure ledger is
 * deliberately independent of the resumable session and must remain intact. */
export function cancelPracticeTest(data: StudyData, sessionId: string) {
  const index = data.sessions.findIndex((session) => session.id === sessionId);
  const session = data.sessions[index];
  if (!session?.practiceTest)
    throw new Error("Practice Test no longer exists.");
  if (session.finishedAt || session.practiceTest.phase === "results")
    throw new Error("Completed Practice Tests cannot be canceled.");
  data.sessions.splice(index, 1);
  data.attempts = data.attempts.filter(
    (attempt) => attempt.sessionId !== sessionId,
  );
}

/** Remove only a completed result and its display entry. Exposure is a
 * separate, append-only ledger so deletion can never recycle test questions. */
export function deleteCompletedPracticeTest(
  data: StudyData,
  sessionId: string,
) {
  const index = data.sessions.findIndex((session) => session.id === sessionId);
  const session = data.sessions[index];
  if (!session?.practiceTest)
    throw new Error("Practice Test no longer exists.");
  if (!session.finishedAt || session.practiceTest.phase !== "results")
    throw new Error("Only completed Practice Tests can be deleted.");
  data.sessions.splice(index, 1);
  data.attempts = data.attempts.filter(
    (attempt) => attempt.sessionId !== sessionId,
  );
}
export function moduleElapsed(
  module: TestModule,
  now = Date.now(),
  timed = false,
) {
  return (
    module.durationMs ??
    Math.max(
      0,
      Math.min(
        now -
          module.startedAt -
          (module.pausedMs || 0) -
          (module.pausedAt === undefined
            ? 0
            : Math.max(0, now - module.pausedAt)),
        timed ? moduleLimit(module.section) : Infinity,
      ),
    )
  );
}
export function deadlinePassed(session: Session, now = Date.now()) {
  const test = session.practiceTest;
  return (
    !!test &&
    test.phase === "module" &&
    test.timing === "timed" &&
    !session.paused &&
    moduleElapsed(test.modules[test.currentModule], now, true) >=
      moduleLimit(test.modules[test.currentModule].section)
  );
}
export const timerWarning = (remainingMs: number) =>
  remainingMs > 0 && remainingMs <= 5 * 60_000;

export function pausePracticeTest(
  data: StudyData,
  sessionId: string,
  now = Date.now(),
) {
  const session = data.sessions.find((s) => s.id === sessionId);
  const test = session?.practiceTest;
  if (
    !session ||
    !test ||
    test.phase !== "module" ||
    session.finishedAt ||
    session.paused
  )
    return;
  const module = test.modules[test.currentModule];
  module.pausedAt = Math.max(module.startedAt, now);
  session.paused = true;
}

export function resumePracticeTest(
  data: StudyData,
  sessionId: string,
  now = Date.now(),
) {
  const session = data.sessions.find((s) => s.id === sessionId);
  const test = session?.practiceTest;
  if (!session || !test || test.phase !== "module" || !session.paused) return;
  const module = test.modules[test.currentModule];
  if (module.pausedAt !== undefined) {
    module.pausedMs =
      (module.pausedMs || 0) + Math.max(0, now - module.pausedAt);
    delete module.pausedAt;
  }
  session.paused = false;
}

export function toggleReviewMark(
  data: StudyData,
  sessionId: string,
  questionId: string,
  now = Date.now(),
) {
  const session = data.sessions.find((s) => s.id === sessionId);
  const test = session?.practiceTest;
  if (
    !session ||
    !test ||
    test.phase !== "module" ||
    session.paused ||
    deadlinePassed(session, now) ||
    !test.modules[test.currentModule].questionIds.includes(questionId)
  )
    return;
  const marked = new Set(test.markedForReview || []);
  if (marked.has(questionId)) marked.delete(questionId);
  else marked.add(questionId);
  test.markedForReview = [...marked];
}

export function testAnswerIsValid(question: Question, value = "") {
  return question.answer.type === "choice"
    ? !!question.choices?.some((choice) => choice.id === value)
    : numericValue(value) !== undefined;
}
export function saveTestDraft(
  data: StudyData,
  id: string,
  questionId: string,
  value: string,
  now = Date.now(),
) {
  const s = data.sessions.find((s) => s.id === id)!;
  const test = s.practiceTest!;
  if (
    test.phase !== "module" ||
    s.paused ||
    deadlinePassed(s, now) ||
    !test.modules[test.currentModule].questionIds.includes(questionId)
  )
    return;
  s.drafts[questionId] = value;
}
const weight = (q: Question) =>
  q.difficulty === "hard" ? 1.2 : q.difficulty === "easy" ? 0.8 : 1;
export function scoredSummary(
  data: StudyData,
  session: Session,
  modules = session.practiceTest!.modules,
) {
  const unscored = new Set(modules.flatMap((m) => m.unscoredIds));
  const ids = modules
    .flatMap((m) => m.questionIds)
    .filter((id) => !unscored.has(id));
  const attempts = new Map(
    data.attempts
      .filter((a) => a.sessionId === session.id)
      .map((a) => [a.questionId, a]),
  );
  const correct = ids.filter((id) => attempts.get(id)?.correct).length;
  const incorrect = ids.filter(
    (id) => attempts.has(id) && !attempts.get(id)!.correct,
  ).length;
  return {
    correct,
    incorrect,
    unanswered: ids.length - correct - incorrect,
    scored: ids.length,
    percentage: ids.length ? (100 * correct) / ids.length : 0,
  };
}
/** Routing: 70% difficulty-weighted accuracy + 30% mean domain accuracy.
 * Unanswered scored items count as misses. Higher begins at >= .65, unrounded. */
export function routeModule(
  data: StudyData,
  session: Session,
  module: TestModule,
): "lower" | "higher" {
  const ids = module.questionIds.filter(
    (id) => !module.unscoredIds.includes(id),
  );
  const attempts = new Map(
    data.attempts
      .filter((a) => a.sessionId === session.id)
      .map((a) => [a.questionId, a]),
  );
  let earned = 0,
    possible = 0;
  const domains = new Map<string, [number, number]>();
  for (const id of ids) {
    const q = data.questions.find((q) => q.id === id)!;
    const correct = attempts.get(id)?.correct ? 1 : 0;
    earned += correct * weight(q);
    possible += weight(q);
    const d = domains.get(domainKey(q)) || [0, 0];
    d[0] += correct;
    d[1]++;
    domains.set(domainKey(q), d);
  }
  const balanced =
    [...domains.values()].reduce((sum, [c, n]) => sum + c / n, 0) /
    Math.max(1, domains.size);
  // Tolerance covers binary representation at the exact 65% boundary only.
  return (0.7 * earned) / Math.max(1, possible) + 0.3 * balanced >= 0.65 - 1e-12
    ? "higher"
    : "lower";
}
export function completeTestModule(
  data: StudyData,
  sessionId: string,
  now = Date.now(),
  random = Math.random,
) {
  const s = data.sessions.find((s) => s.id === sessionId)!;
  const test = s.practiceTest!;
  if (test.phase !== "module" || s.finishedAt || s.paused) return;
  const module = test.modules[test.currentModule];
  if (module.completedAt !== undefined) return;
  module.durationMs = moduleElapsed(module, now, test.timing === "timed");
  module.completedAt = now;
  test.reviewingModule = false;
  const completedIds = new Set(module.questionIds);
  test.markedForReview = (test.markedForReview || []).filter(
    (id) => !completedIds.has(id),
  );
  for (const id of module.questionIds) {
    const q = data.questions.find((q) => q.id === id)!;
    const answer = s.drafts[id] || "";
    if (!testAnswerIsValid(q, answer)) continue;
    data.attempts.push({
      id: crypto.randomUUID(),
      questionId: id,
      sessionId,
      answer,
      correct: isCorrect(q, answer),
      durationMs: Math.round(s.elapsed[id] || 0),
      submittedAt: new Date(module.completedAt).toISOString(),
    });
  }
  if (test.selection !== "full" || test.currentModule === 3) {
    test.phase = "results";
    s.finishedAt = new Date(now).toISOString();
    return;
  }
  if (test.currentModule === 1) {
    test.phase = "break";
    test.breakStartedAt = now;
    return;
  }
  const route = routeModule(data, s, module);
  test.routes[module.section] = route;
  appendModule(data, s, module.section, route, now, random);
  test.currentModule++;
}
export function continueAfterBreak(
  data: StudyData,
  sessionId: string,
  now = Date.now(),
  random = Math.random,
) {
  const s = data.sessions.find((s) => s.id === sessionId)!;
  if (s.practiceTest?.phase !== "break") return;
  appendModule(data, s, "math", "first", now, random);
  s.practiceTest.currentModule = 2;
  s.practiceTest.phase = "module";
}
/** Heuristic only: 200 + 600 * weighted scored accuracy, with a small route
 * adjustment (+/-25). Full section uncertainty +/-60; standalone +/-100.
 * Never uses proprietary conversion tables or claims psychometric validity. */
export function estimatedRange(
  data: StudyData,
  session: Session,
  section: SatSection,
  scope = session.practiceTest!.modules,
): [number, number] | undefined {
  const modules = scope.filter((m) => m.section === section);
  if (!modules.length) return;
  const attempts = new Map(
    data.attempts
      .filter((a) => a.sessionId === session.id)
      .map((a) => [a.questionId, a]),
  );
  let earned = 0,
    possible = 0;
  for (const m of modules)
    for (const id of m.questionIds.filter(
      (id) => !m.unscoredIds.includes(id),
    )) {
      const w = weight(data.questions.find((q) => q.id === id)!);
      possible += w;
      earned += attempts.get(id)?.correct ? w : 0;
    }
  const route = modules.find((m) => m.mix !== "first")?.mix;
  const center =
    200 +
    (600 * earned) / Math.max(1, possible) +
    (route === "higher" ? 25 : route === "lower" ? -25 : 0);
  const margin = modules.length === 2 ? 60 : 100;
  const bound = (n: number) =>
    Math.max(200, Math.min(800, Math.round(n / 10) * 10));
  return [bound(center - margin), bound(center + margin)];
}
