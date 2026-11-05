// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { choiceQuestion } from "../../../tests/questionFixtures";
import { AnswerFeedback, type AnswerFeedbackProps } from "./AnswerFeedback";

afterEach(cleanup);

const setup = (overrides: Partial<AnswerFeedbackProps> = {}) =>
  render(
    <AnswerFeedback
      question={choiceQuestion()}
      attempt={{ correct: true, answer: "B", durationMs: 65_000 }}
      showCorrectExplanations={false}
      showTime={false}
      {...overrides}
    />,
  );

describe("AnswerFeedback", () => {
  it("praises a correct answer and folds its explanation away", () => {
    const { container } = setup();
    expect(
      screen.getByRole("heading", { name: "Correct. Nicely done." }),
    ).toBeTruthy();
    const details = container.querySelector(
      "details.correct-explanation",
    ) as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain("Two and two make four.");
  });

  it("opens the explanation for a correct answer when asked to", () => {
    const { container } = setup({ showCorrectExplanations: true });
    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByRole("heading", { name: "Explanation" })).toBeTruthy();
    expect(screen.getByText("Two and two make four.")).toBeTruthy();
  });

  it("always explains a wrong answer", () => {
    const { container } = setup({
      attempt: { correct: false, answer: "A", durationMs: 0 },
    });
    expect(
      screen.getByRole("heading", {
        name: "Not quite. Let’s work through it.",
      }),
    ).toBeTruthy();
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("section")!.className).toBe("feedback miss");
  });

  it("gives the correct answer and the person's own", () => {
    const { container } = setup({
      attempt: { correct: false, answer: "A", durationMs: 0 },
    });
    expect(container.textContent).toContain("Correct answer:");
    expect(container.textContent).toMatch(/Your answer: A/);
  });

  it("adds the time taken only when timing is shown", () => {
    const { container, unmount } = setup();
    expect(container.textContent).not.toContain("1:05");
    unmount();
    expect(setup({ showTime: true }).container.textContent).toContain(
      " · 1:05",
    );
  });

  it("says when there is no explanation", () => {
    setup({
      question: choiceQuestion({ rationale: undefined }),
      showCorrectExplanations: true,
    });
    expect(
      screen.getByText("No rationale was included in this import."),
    ).toBeTruthy();
  });

  it("is announced politely", () => {
    const { container } = setup();
    expect(container.querySelector("section")!.getAttribute("aria-live")).toBe(
      "polite",
    );
  });
});
