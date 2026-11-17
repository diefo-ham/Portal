// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgressTicks, type ProgressTicksProps } from "./ProgressTicks";

afterEach(cleanup);

const setup = (overrides: Partial<ProgressTicksProps> = {}) => {
  const props: ProgressTicksProps = {
    questionIds: ["a", "b", "c", "d"],
    index: 1,
    attempts: [
      { questionId: "a", correct: true },
      { questionId: "c", correct: false },
    ],
    drafts: {},
    isTest: false,
    ...overrides,
  };
  const { container } = render(<ProgressTicks {...props} />);
  const strip = container.firstElementChild!;
  return { props, strip, ticks: [...strip.children], user: userEvent.setup() };
};

describe("ProgressTicks", () => {
  it("draws one tick per question with its outcome and marks the open one", () => {
    const { ticks } = setup();
    expect(ticks.map((tick) => tick.className.trim())).toEqual([
      "tick-correct",
      "tick-open current",
      "tick-incorrect",
      "tick-open",
    ]);
  });

  it("shows only 'answered' in a test, never right or wrong", () => {
    const { ticks } = setup({ isTest: true, drafts: { a: "B", c: "D" } });
    expect(ticks.map((tick) => tick.className.trim())).toEqual([
      "tick-answered",
      "tick-open current",
      "tick-answered",
      "tick-open",
    ]);
  });

  it("stays out of the accessibility tree; the overview is the labelled way", () => {
    expect(setup().strip.getAttribute("aria-hidden")).toBe("true");
  });

  it("opens the clicked question when navigation is allowed", async () => {
    const onGo = vi.fn();
    const { strip, ticks, user } = setup({ onGo });
    expect(strip.className).toContain("can-go");
    await user.click(ticks[3]);
    expect(onGo).toHaveBeenCalledWith(3);
  });

  it("does nothing on click when navigation is not allowed", async () => {
    const { strip, ticks, user } = setup();
    expect(strip.className).not.toContain("can-go");
    await user.click(ticks[3]);
  });

  it("closes the gaps for a long session", () => {
    const ids = Array.from({ length: 41 }, (_, i) => `q${i}`);
    expect(setup({ questionIds: ids }).strip.className).toContain("dense");
  });
});
