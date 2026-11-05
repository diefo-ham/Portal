// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionMap, type SessionMapProps } from "./SessionMap";

afterEach(cleanup);

const setup = (overrides: Partial<SessionMapProps> = {}) => {
  const props: SessionMapProps = {
    questionIds: ["a", "b", "c", "d"],
    index: 1,
    attempts: [
      { questionId: "a", correct: true },
      { questionId: "c", correct: false },
    ],
    drafts: {},
    isTest: false,
    pending: false,
    onGo: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  };
  render(<SessionMap {...props} />);
  return { props, user: userEvent.setup() };
};

const square = (n: number) =>
  screen.getByRole("button", { name: new RegExp(`^Go to question ${n}\\b`) });

describe("SessionMap", () => {
  it("has a square per question, numbered", () => {
    setup();
    expect(square(1).textContent).toBe("1");
    expect(square(4).textContent).toBe("4");
  });

  it("names and colours checked answers", () => {
    setup();
    expect(square(1).getAttribute("aria-label")).toBe(
      "Go to question 1, correct",
    );
    expect(square(1).className).toContain("map-correct");
    expect(square(3).getAttribute("aria-label")).toBe(
      "Go to question 3, incorrect",
    );
    expect(square(3).className).toContain("map-incorrect");
    expect(square(4).getAttribute("aria-label")).toBe("Go to question 4");
  });

  it("marks the current question", () => {
    setup();
    expect(square(2).getAttribute("aria-current")).toBe("step");
    expect(square(2).className).toContain("current");
    expect(square(1).getAttribute("aria-current")).toBeNull();
  });

  it("shows saved answers in a test without saying if they are right", () => {
    setup({ isTest: true, attempts: [], drafts: { b: "A" } });
    expect(square(2).getAttribute("aria-label")).toBe(
      "Go to question 2, answered",
    );
    expect(square(2).className).toContain("map-answered");
    expect(square(1).className).not.toContain("map-answered");
  });

  it("ignores drafts outside a test", () => {
    setup({ attempts: [], drafts: { b: "A" } });
    expect(square(2).className).not.toContain("map-answered");
  });

  it("goes to a question", async () => {
    const { props, user } = setup();
    await user.click(square(4));
    expect(props.onGo).toHaveBeenCalledWith(3);
  });

  it("finishes the session or the module", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Finish session" }));
    expect(props.onFinish).toHaveBeenCalledOnce();
    cleanup();
    setup({ isTest: true });
    expect(screen.getByRole("button", { name: "Finish module" })).toBeTruthy();
  });

  it("disables everything while saving", () => {
    setup({ pending: true });
    for (const button of screen.getAllByRole("button"))
      expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
