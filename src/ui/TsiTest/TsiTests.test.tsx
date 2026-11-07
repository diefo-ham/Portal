// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { backfillAssessments } from "../../core/assessments";
import { emptyData, type Question, type StudyData } from "../../core/model";
import { beginTsiTest, buildTsiTest } from "../../core/tsiTest";
import { AssessmentProvider } from "../i18n";
import { TsiTests } from "./TsiTests";

afterEach(cleanup);

let n = 0;
const q = (
  section: "tsi-elar" | "tsi-math",
  domain: string,
  extra: Partial<Question> = {},
): Question => ({
  id: `tsi-t${++n}`,
  assessment: "TSI",
  section,
  domain,
  skill: "Skill",
  stem: "A synthetic stem.",
  choices: ["A", "B", "C", "D"].map((id) => ({ id, text: `Choice ${id}` })),
  answer: { type: "choice", value: "A" },
  testStatus: "unknown",
  origin: "original",
  ...extra,
});

/** Math only, a few more than a College Readiness test needs from each domain. */
const mathBank = (): StudyData => {
  n = 0;
  const data = emptyData();
  const many = (count: number, domain: string) =>
    Array.from({ length: count }, () => q("tsi-math", domain));
  data.questions = [
    ...many(8, "Quantitative Reasoning"),
    ...many(8, "Algebraic Reasoning"),
    ...many(4, "Geometric and Spatial Reasoning"),
    ...many(5, "Probabilistic and Statistical Reasoning"),
  ];
  return backfillAssessments(data);
};

const show = (
  data: StudyData,
  props: Partial<Parameters<typeof TsiTests>[0]> = {},
) => {
  const mutate = vi.fn(async (fn: (d: StudyData) => void) => {
    fn(data);
    return data;
  });
  const onOpen = vi.fn();
  render(
    <AssessmentProvider value="TSI">
      <TsiTests
        data={data}
        mutate={mutate}
        onOpen={onOpen}
        removesAnswers={false}
        timerDefault
        {...props}
      />
    </AssessmentProvider>,
  );
  return { mutate, onOpen, user: userEvent.setup() };
};

const rows = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      [...row.querySelectorAll("th, td")].map((cell) => cell.textContent),
    );

describe("the Tests tab", () => {
  it("shows what each test is made of and what the bank holds", async () => {
    const { user } = show(mathBank());
    await user.click(screen.getByRole("button", { name: "Mathematics" }));
    expect(
      screen.getByRole("button", { name: /College Readiness · 20 questions/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Diagnostic · 48 questions/ }),
    ).toBeTruthy();
    expect(rows()).toEqual([
      ["Quantitative Reasoning", "6", "8"],
      ["Algebraic Reasoning", "7", "8"],
      ["Geometric and Spatial Reasoning", "3", "4"],
      ["Probabilistic and Statistical Reasoning", "4", "5"],
    ]);
    expect(screen.getByText("20 questions")).toBeTruthy();
    expect(screen.queryByText(/fewer questions than the real test/)).toBeNull();
  });

  it("says when the bank is too small and how many questions the test will have", async () => {
    const { user } = show(mathBank());
    await user.click(screen.getByRole("button", { name: "Mathematics" }));
    await user.click(screen.getByRole("button", { name: /Diagnostic/ }));
    expect(screen.getByText("25 questions")).toBeTruthy();
    expect(screen.getByText(/the real test has 48/)).toBeTruthy();
    expect(
      screen.getByText(/fewer questions than the real test uses/),
    ).toBeTruthy();
  });

  it("explains the rules of the test, which cannot be gone back on", () => {
    show(mathBank());
    expect(screen.getByText(/cannot go back/)).toBeTruthy();
    expect(screen.getByText(/no time limit/)).toBeTruthy();
  });

  it("starts a test and opens it", async () => {
    const data = mathBank();
    const { mutate, onOpen, user } = show(data);
    await user.click(screen.getByRole("button", { name: "Mathematics" }));
    await user.click(screen.getByRole("button", { name: /Start the test/ }));
    expect(mutate).toHaveBeenCalledOnce();
    const session = data.sessions[0];
    expect(session.tsiTest).toMatchObject({ kind: "crc", subject: "math" });
    expect(session.questionIds).toHaveLength(20);
    expect(onOpen).toHaveBeenCalledWith(session.id);
  });

  it("cannot start with nothing to build from, and offers to add questions instead", async () => {
    const onAddQuestions = vi.fn();
    const data = mathBank();
    data.questions = data.questions.filter((x) => x.section === "tsi-math");
    const { user } = show(data, { onAddQuestions });
    // ELAR has nothing in this bank.
    expect(
      (
        screen.getByRole("button", {
          name: /Start the test/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    const none = show(emptyData(), { onAddQuestions });
    await none.user.click(
      screen.getAllByRole("button", { name: "Add your question PDFs" })[0],
    );
    expect(onAddQuestions).toHaveBeenCalled();
    void user;
  });

  it("lists tests: one in progress to continue and one finished with its result", () => {
    const data = mathBank();
    const ids = buildTsiTest(data, "crc", "math", () => 0.5).questionIds;
    const done = beginTsiTest(data, "crc", "math", ids);
    done.finishedAt = "2026-01-02T00:00:00.000Z";
    for (const id of ids.slice(0, 5))
      data.attempts.push({
        id: `a-${id}`,
        questionId: id,
        assessment: "TSI",
        sessionId: done.id,
        answer: "A",
        correct: true,
        durationMs: 1,
        submittedAt: "2026-01-02T00:00:00.000Z",
      });
    beginTsiTest(data, "crc", "math", ids);
    show(data);
    expect(screen.getByRole("button", { name: "View results" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    expect(screen.getByText(/5 of 20 correct \(25%\)/)).toBeTruthy();
    expect(screen.getByText(/in progress/)).toBeTruthy();
  });
});
