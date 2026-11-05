// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { choiceQuestion } from "../../../tests/questionFixtures";
import { QuestionHeading } from "./QuestionHeading";

afterEach(cleanup);

const setup = (isTest: boolean, marked: boolean, onToggle = vi.fn()) => {
  render(
    <QuestionHeading
      question={choiceQuestion()}
      isTest={isTest}
      marked={marked}
      onToggle={onToggle}
    />,
  );
  return onToggle;
};

describe("QuestionHeading", () => {
  it("names the part and domain", () => {
    setup(false, false);
    expect(screen.getByText("Math")).toBeTruthy();
    expect(screen.getByText("Algebra")).toBeTruthy();
  });

  it("offers a bookmark in practice", () => {
    setup(false, false);
    const button = screen.getByRole("button", { name: "Bookmark question" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("title")).toBe("Bookmark question (E)");
    expect(button.textContent).toBe("☆");
  });

  it("shows a set bookmark", () => {
    setup(false, true);
    const button = screen.getByRole("button", { name: "Remove bookmark" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.className).toContain("selected");
    expect(button.textContent).toBe("★");
  });

  it("marks for review in a test instead", () => {
    setup(true, false);
    const button = screen.getByRole("button", { name: "Mark for review" });
    expect(button.className).toContain("review-mark");
    expect(button.getAttribute("title")).toBe("Mark for review (E)");
    expect(button.textContent).toBe("⚐Mark for review");
  });

  it("shows a set review mark", () => {
    setup(true, true);
    const button = screen.getByRole("button", { name: "Unmark for review" });
    expect(button.getAttribute("title")).toBe("Unmark for review (E)");
    expect(button.textContent).toContain("⚑");
  });

  it("tells a pointer press from a keyboard one", async () => {
    const onToggle = setup(false, false);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button"), { detail: 0 });
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });
});
