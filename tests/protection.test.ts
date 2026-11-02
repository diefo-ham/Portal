import { describe, it, expect } from "vitest";
import {
  defaultFilters,
  type StudyData,
  type Filters,
} from "../src/core/model";
import { filterQuestions, selectSessionQuestions } from "../src/core/practice";
import { reviewQueues } from "../src/core/review";
import {
  beginSession,
  resetStudyProgress,
  submitAnswer,
} from "../src/core/commands";
import { beginPracticeTest, unusedPool } from "../src/core/practiceTest";
import { parseBackupPayload } from "../src/importing/backup";
import {
  createResetArchive,
  validateResetArchive,
} from "../src/storage/resetArchive";
import { testCorpus, seededRandom } from "./practiceTestFixtures";

function corpus() {
  const d = testCorpus(540);
  d.questions.forEach((q, i) => {
    q.testStatus = (["active", "inactive", "unknown"] as const)[i % 3];
    d.annotations[q.id] = { bookmarked: true, note: "" };
  });
  return d;
}
function assertProtected(d: StudyData, filters: Filters = defaultFilters) {
  const pool = filterQuestions(d, filters);
  expect(pool.length).toBeGreaterThan(0);
  expect(pool.every((q) => q.testStatus !== "active")).toBe(true);
  for (const size of [1, 10, 100, 0, 2000])
    for (let seed = 1; seed <= 8; seed++) {
      const ids = selectSessionQuestions(
        pool.map((q) => q.id),
        size,
        [],
        seededRandom(seed),
      );
      expect(
        ids.every((id) =>
          d.questions.some((q) => q.id === id && q.testStatus !== "active"),
        ),
      ).toBe(true);
    }
}

describe("active-question protection is separate from Test exposure", () => {
  it("protects ordinary generated pools, Browse filters and bookmark queues across a mixed corpus", () => {
    const d = corpus();
    assertProtected(d);
    for (const section of ["", "math", "reading-writing"]) {
      for (const bookmark of ["", "yes"]) {
        const filters = { ...defaultFilters, section, bookmark, statuses: [] };
        assertProtected(d, filters);
        expect(
          filterQuestions(d, filters).some((q) => q.testStatus === "unknown"),
        ).toBe(true);
      }
    }
    // Unknown is allowed but never reclassified as inactive/safe.
    expect(
      filterQuestions(d, defaultFilters).filter(
        (q) => q.testStatus === "unknown",
      ),
    ).toHaveLength(360);
    expect(
      filterQuestions(d, { ...defaultFilters, active: "only" }),
    ).toHaveLength(360);
    expect(
      filterQuestions(d, { ...defaultFilters, active: "include" }),
    ).toHaveLength(1080);
  });

  it("protects global mistakes and unanswered reviews even for active bookmarked assigned questions", () => {
    const d = corpus();
    const selected = d.questions.slice(0, 12);
    const saved = beginSession(
      d,
      selected.map((q) => q.id),
      { ...defaultFilters, active: "include" },
    );
    selected.slice(0, 6).forEach((q) => submitAnswer(d, saved.id, q.id, "B"));
    for (const protect of [true, false]) {
      const queues = reviewQueues(d, protect);
      for (const ids of [queues.mistakes, queues.unanswered]) {
        expect(ids).toHaveLength(protect ? 4 : 6);
        expect(
          ids.every(
            (id) =>
              !protect ||
              d.questions.find((q) => q.id === id)!.testStatus !== "active",
          ),
        ).toBe(true);
      }
    }
    assertProtected(d, { ...defaultFilters, statuses: ["incorrect"] });
    assertProtected(d, {
      ...defaultFilters,
      statuses: ["completed"],
      bookmark: "yes",
    });
    // Saved/repractice IDs remain explicit. The UI must confirm before creating
    // a new active-containing session; resuming existing history preserves order.
    expect(saved.questionIds).toEqual(selected.map((q) => q.id));
    expect(saved.filters.active).toBe("include");
  });

  it("allows active Test questions, records their exposure, and leaves Practice eligibility independent", () => {
    const d = corpus();
    const before = filterQuestions(d, {
      ...defaultFilters,
      active: "include",
    }).map((q) => q.id);
    const s = beginPracticeTest(
      d,
      "math:first",
      "untimed",
      1_800_000_000_000,
      seededRandom(),
    );
    expect(s.questionIds).toHaveLength(22);
    expect(
      s.questionIds.every(
        (id) => d.questions.find((q) => q.id === id)!.testStatus === "active",
      ),
    ).toBe(true);
    expect(d.practiceTestUsedIds).toEqual(
      expect.arrayContaining(s.questionIds),
    );
    expect(
      unusedPool(d, "math").every((q) => !s.questionIds.includes(q.id)),
    ).toBe(true);
    assertProtected(d);
    expect(
      filterQuestions(d, { ...defaultFilters, active: "include" }).map(
        (q) => q.id,
      ),
    ).toEqual(before);
    // Ordinary intentional Practice does not consume Test eligibility.
    const ledger = [...d.practiceTestUsedIds];
    beginSession(d, [unusedPool(d, "math")[0].id], {
      ...defaultFilters,
      active: "include",
    });
    expect(d.practiceTestUsedIds).toEqual(ledger);
  });

  it("reset, recovery and backup restore preserve statuses and protected selection semantics", () => {
    const d = corpus();
    beginPracticeTest(
      d,
      "math:first",
      "untimed",
      1_800_000_000_000,
      seededRandom(),
    );
    const archive = createResetArchive(d),
      statuses = d.questions.map((q) => q.testStatus);
    resetStudyProgress(d);
    expect(d.practiceTestUsedIds).toEqual([]);
    expect(Object.values(d.annotations).every((a) => a.bookmarked)).toBe(true);
    expect(d.questions.map((q) => q.testStatus)).toEqual(statuses);
    assertProtected(d);
    Object.assign(d, validateResetArchive(archive, d).study);
    expect(d.practiceTestUsedIds).toHaveLength(22);
    assertProtected(d);
    const restored = parseBackupPayload({
      format: "sat-study-backup-v1",
      data: structuredClone(d),
      preferences: { protectTests: true },
    });
    expect(restored.preferences?.protectTests).toBe(true);
    expect(restored.data.questions.map((q) => q.testStatus)).toEqual(statuses);
    expect(restored.data.practiceTestUsedIds).toEqual(d.practiceTestUsedIds);
    assertProtected(restored.data);
    // Legacy backups omit preferences: the UI retains its current setting.
    expect(
      parseBackupPayload({
        format: "sat-study-backup-v1",
        data: structuredClone(d),
      }).preferences,
    ).toBeUndefined();
  });
});
