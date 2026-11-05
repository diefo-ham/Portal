import { describe, expect, it } from "vitest";
import { beginPracticeTest } from "./practiceTest";
import { beginTimedTest, PART_ORDER } from "./timedTest";
import { beginSession } from "./commands";
import {
  defaultFilters,
  emptyData,
  isPracticeTestSession,
  isTimedTestSession,
  type Section,
} from "./model";
import { testCorpus } from "../../tests/practiceTestFixtures";

describe("session guards", () => {
  it("recognise a Practice Test", () => {
    const data = testCorpus();
    const session = beginPracticeTest(data, "math:first", "timed");
    expect(isPracticeTestSession(session)).toBe(true);
    expect(isTimedTestSession(session)).toBe(false);
  });

  it("recognise a timed test", () => {
    const data = emptyData();
    for (const section of PART_ORDER as Section[])
      data.questions.push({
        id: `paa-${section}`,
        assessment: "PAA",
        section,
        stem: "?",
        choices: [{ id: "A", text: "A" }],
        answer: { type: "choice", value: "A" },
        testStatus: "unknown",
      });
    const session = beginTimedTest(data, {
      parts: [...PART_ORDER],
      count: 4,
      unusedOnly: false,
    });
    expect(isTimedTestSession(session)).toBe(true);
    expect(isPracticeTestSession(session)).toBe(false);
  });

  it("recognise neither in an ordinary session", () => {
    const data = testCorpus(2);
    const session = beginSession(data, [data.questions[0].id], defaultFilters);
    expect(isPracticeTestSession(session)).toBe(false);
    expect(isTimedTestSession(session)).toBe(false);
  });

  it("narrow a list, so a test's details need no assertion", () => {
    const data = testCorpus();
    beginSession(data, [data.questions[0].id], defaultFilters);
    beginPracticeTest(data, "math:first", "untimed");
    const tests = data.sessions.filter(isPracticeTestSession);
    expect(tests).toHaveLength(1);
    expect(tests[0].practiceTest.timing).toBe("untimed");
  });
});
