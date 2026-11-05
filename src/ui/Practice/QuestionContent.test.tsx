// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Question } from "../../core/model";
import {
  choiceQuestion,
  numericQuestion,
} from "../../../tests/questionFixtures";
import { QuestionContent } from "./QuestionContent";

afterEach(cleanup);

const pdfDocument = (warnings?: string[]) =>
  ({
    question: [],
    rationale: [],
    textIsApproximate: true,
    provenance: [],
    extractionWarnings: warnings,
  }) as unknown as NonNullable<Question["document"]>;

describe("QuestionContent", () => {
  it("shows a text question as the heading", () => {
    render(<QuestionContent question={choiceQuestion()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "What is 2 + 2?" }),
    ).toBeTruthy();
  });

  it("shows the passage above the question", () => {
    render(
      <QuestionContent
        question={choiceQuestion({ passage: "Read this first." })}
      />,
    );
    expect(screen.getByText("Read this first.").className).toBe("passage");
  });

  it("shows figures with their descriptions", () => {
    render(
      <QuestionContent
        question={choiceQuestion({
          media: [{ alt: "A triangle", dataUrl: "data:image/png;base64,AA==" }],
        })}
      />,
    );
    expect(screen.getByRole("img", { name: "A triangle" })).toBeTruthy();
    expect(
      screen.getByText("A triangle", { selector: "figcaption" }),
    ).toBeTruthy();
  });

  it("shows a PDF question as panels, with a hidden heading and no passage", () => {
    render(
      <QuestionContent
        question={choiceQuestion({
          sourceId: "abc123",
          passage: "Searchable text",
          document: pdfDocument(),
        })}
      />,
    );
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Question abc123",
    });
    expect(heading.className).toBe("sr-only");
    expect(screen.queryByText("Searchable text")).toBeNull();
    expect(
      screen.getByText("Select an answer from the choices shown above."),
    ).toBeTruthy();
  });

  it("says to type below for a numeric PDF question", () => {
    render(
      <QuestionContent
        question={numericQuestion({ document: pdfDocument() })}
      />,
    );
    expect(screen.getByText("Enter your answer below.")).toBeTruthy();
  });

  it("shows any extraction warnings", () => {
    render(
      <QuestionContent
        question={choiceQuestion({
          document: pdfDocument(["Page 3 was cropped."]),
        })}
      />,
    );
    expect(screen.getByText("Page 3 was cropped.").className).toBe("notice");
  });
});
