// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  choiceQuestion,
  numericQuestion,
} from "../../../tests/questionFixtures";
import { AssessmentProvider } from "../i18n";
import { AnswerChoices, type AnswerChoicesProps } from "./AnswerChoices";

afterEach(cleanup);

const setup = (overrides: Partial<AnswerChoicesProps> = {}) => {
  const props: AnswerChoicesProps = {
    question: choiceQuestion(),
    answer: "",
    disabled: false,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<AnswerChoices {...props} />);
  return { props, user };
};

const choice = (letter: string) =>
  screen.getByRole("radio", {
    name: new RegExp(`^${letter}`),
  }) as HTMLInputElement;

describe("AnswerChoices with choices", () => {
  it("lists every choice as a radio with its letter and text", () => {
    setup();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(choice("B").closest("label")!.textContent).toBe("BFour");
  });

  it("shows only letters for a PDF question, whose text is in the image", () => {
    setup({ question: choiceQuestion({ document: {} as never }) });
    expect(choice("B").closest("label")!.textContent).toBe("B");
  });

  it("chooses an answer", async () => {
    const { props, user } = setup();
    await user.click(choice("C"));
    expect(props.onChange).toHaveBeenCalledWith("C");
  });

  it("clears the answer when the chosen one is pressed again", async () => {
    const { props, user } = setup({ answer: "C" });
    expect(choice("C").checked).toBe(true);
    await user.click(choice("C"));
    expect(props.onChange).toHaveBeenCalledWith("");
  });

  it("marks the chosen, right and wrong answers once checked", () => {
    setup({ answer: "A", attempt: { correct: false } });
    const label = (letter: string) =>
      choice(letter).closest("label")!.className;
    expect(label("A")).toContain("chosen");
    expect(label("A")).toContain("wrong-answer");
    expect(label("B")).toContain("right-answer");
    expect(label("C")).not.toMatch(/chosen|wrong|right/);
  });

  it("does not call a correct answer wrong", () => {
    setup({ answer: "B", attempt: { correct: true } });
    const label = choice("B").closest("label")!.className;
    expect(label).toContain("right-answer");
    expect(label).not.toContain("wrong-answer");
  });

  it("can be disabled as a group", () => {
    setup({ disabled: true });
    expect((screen.getByRole("group") as HTMLFieldSetElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole("group", { name: "Your answer" })).toBeTruthy();
  });
});

describe("AnswerChoices with a number", () => {
  const numeric = (overrides: Partial<AnswerChoicesProps> = {}) =>
    setup({ question: numericQuestion(), ...overrides });
  const field = () =>
    screen.getByRole("textbox", { name: "Your numeric answer" });

  it("offers a field for the number", () => {
    numeric({ answer: "1/2" });
    expect((field() as HTMLInputElement).value).toBe("1/2");
    expect(field().getAttribute("placeholder")).toBe(
      "Enter a number or fraction",
    );
    expect(screen.getByText(/Decimals and fractions accepted/)).toBeTruthy();
  });

  it("reports what is typed", () => {
    const { props } = numeric();
    fireEvent.change(field(), { target: { value: "0.5" } });
    expect(props.onChange).toHaveBeenCalledWith("0.5");
  });

  it("checks a valid number with Enter", async () => {
    const { props, user } = numeric({ answer: "1/2" });
    await user.type(field(), "{Enter}");
    expect(props.onSubmit).toHaveBeenCalledOnce();
  });

  it("explains an invalid number and does not check it", async () => {
    const { props, user } = numeric({ answer: "1/0" });
    expect(screen.getByText(/nonzero denominator/)).toBeTruthy();
    await user.type(field(), "{Enter}");
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("does not check again once answered", async () => {
    const { props } = numeric({ answer: "1/2", attempt: { correct: true } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("describes the PAA's stricter format", () => {
    render(
      <AssessmentProvider value="PAA">
        <AnswerChoices
          question={numericQuestion({ assessment: "PAA" })}
          answer=""
          disabled={false}
          onChange={() => {}}
          onSubmit={() => {}}
        />
      </AssessmentProvider>,
    );
    expect(
      document.querySelector(".numeric-answer .small")!.textContent,
    ).not.toMatch(/Decimals and fractions accepted/);
  });
});
