// @vitest-environment jsdom
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionFooter, type QuestionFooterProps } from "./QuestionFooter";

afterEach(cleanup);

const setup = (overrides: Partial<QuestionFooterProps> = {}) => {
  const props: QuestionFooterProps = {
    index: 1,
    total: 3,
    isTest: false,
    answered: false,
    disabled: false,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<QuestionFooter {...props} />);
  return { props, user };
};

const disabled = (name: string) =>
  (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;

describe("QuestionFooter", () => {
  it("goes back and offers to skip an unanswered question", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "← Previous" }));
    const skip = screen.getByRole("button", { name: "Skip for now →" });
    expect(skip.className).toBe("text-button");
    await user.click(skip);
    expect(props.onPrevious).toHaveBeenCalledOnce();
    expect(props.onNext).toHaveBeenCalledOnce();
  });

  it("makes Next the main action once answered", () => {
    setup({ answered: true });
    expect(
      screen.getByRole("button", { name: "Next question →" }).className,
    ).toBe("primary");
  });

  it("has nowhere to go back to from the first question", () => {
    setup({ index: 0 });
    expect(disabled("← Previous")).toBe(true);
  });

  it("offers the session review on the last question", async () => {
    const { props, user } = setup({ index: 2 });
    await user.click(screen.getByRole("button", { name: "Review session →" }));
    expect(props.onFinish).toHaveBeenCalledOnce();
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it("uses the test wording", () => {
    setup({ isTest: true });
    expect(
      screen.getByRole("button", { name: "Next question →" }),
    ).toBeTruthy();
    cleanup();
    setup({ isTest: true, index: 2 });
    expect(
      screen.getByRole("button", { name: "Finish module →" }),
    ).toBeTruthy();
  });

  it("disables moving while busy", () => {
    setup({ disabled: true });
    expect(disabled("← Previous")).toBe(true);
    expect(disabled("Skip for now →")).toBe(true);
  });

  it("hands the forward button to the caller, to focus it", () => {
    const ref = createRef<HTMLButtonElement>();
    setup({ nextButtonRef: ref });
    expect(ref.current?.textContent).toBe("Skip for now →");
  });
});
