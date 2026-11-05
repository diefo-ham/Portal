// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Question } from "../../core/model";
import { choiceQuestion } from "../../../tests/questionFixtures";
import { QuestionDetails } from "./QuestionDetails";

afterEach(cleanup);

describe("QuestionDetails", () => {
  it("lists difficulty, skill and source", () => {
    render(
      <QuestionDetails
        question={choiceQuestion({
          difficulty: "hard",
          skillDetail: "Two variables",
          source: "Question bank",
          sourceId: "ab12",
        })}
      />,
    );
    expect(screen.getByText("Difficulty: hard")).toBeTruthy();
    expect(screen.getByText("Linear equations · Two variables")).toBeTruthy();
    expect(screen.getByText("Question bank · ab12")).toBeTruthy();
    expect(screen.getByText("Practice-test status: inactive")).toBeTruthy();
  });

  it("says what is unspecified", () => {
    render(
      <QuestionDetails
        question={choiceQuestion({
          difficulty: undefined,
          skill: undefined,
          source: undefined,
        })}
      />,
    );
    expect(screen.getByText("Difficulty: Unspecified")).toBeTruthy();
    expect(screen.getByText("Skill unspecified")).toBeTruthy();
    expect(screen.getByText("Source unspecified")).toBeTruthy();
  });

  it("leaves out the practice-test status for the PAA", () => {
    render(
      <QuestionDetails question={choiceQuestion({ assessment: "PAA" })} />,
    );
    expect(screen.queryByText(/Practice-test status/)).toBeNull();
  });

  it("names the PDF pages a question came from", () => {
    render(
      <QuestionDetails
        question={choiceQuestion({
          document: {
            provenance: [{ filename: "math.pdf", pages: [3, 4] }],
          } as unknown as NonNullable<Question["document"]>,
        })}
      />,
    );
    expect(screen.getByText("PDF source details")).toBeTruthy();
    expect(screen.getByText("math.pdf · pages 3, 4")).toBeTruthy();
  });
});
