// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PracticeToolbar, type PracticeToolbarProps } from "./PracticeToolbar";

afterEach(cleanup);

const setup = (overrides: Partial<PracticeToolbarProps> = {}) => {
  const props: PracticeToolbarProps = {
    index: 2,
    total: 10,
    onExit: vi.fn(),
    onOverview: vi.fn(),
    onTools: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<PracticeToolbar {...props} />);
  return { props, user };
};

describe("PracticeToolbar", () => {
  it("shows which question this is, and opens the overview from it", async () => {
    const { props, user } = setup();
    const count = screen.getByRole("button", {
      name: "Open question overview",
    });
    expect(count.textContent).toBe("Question 3 of 10");
    await user.click(count);
    expect(props.onOverview).toHaveBeenCalledOnce();
  });

  it("exits and opens the tools", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "← Exit" }));
    await user.click(screen.getByRole("button", { name: "Practice tools" }));
    expect(props.onExit).toHaveBeenCalledOnce();
    expect(props.onTools).toHaveBeenCalledOnce();
  });

  it("hides the timer, pause and calculator unless asked for", () => {
    setup();
    expect(document.querySelector(".timer")).toBeNull();
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Calculator" })).toBeNull();
  });

  it("shows a question timer", () => {
    setup({
      timer: {
        text: "1:05",
        label: "Time on this question",
        test: false,
        warning: false,
      },
    });
    const timer = screen.getByLabelText("Time on this question");
    expect(timer.textContent).toBe("1:05");
    expect(timer.className).not.toContain("test-timer");
  });

  it("styles a test clock and its warning", () => {
    setup({
      timer: {
        text: "4:59",
        label: "Module time left",
        test: true,
        warning: true,
      },
    });
    const timer = screen.getByLabelText("Module time left");
    expect(timer.className).toContain("test-timer");
    expect(timer.className).toContain("timer-warning");
  });

  it("pauses a test", async () => {
    const onPause = vi.fn();
    const { user } = setup({ pause: { disabled: false, onPause } });
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPause).toHaveBeenCalledOnce();
  });

  it("disables pausing while unavailable", () => {
    setup({ pause: { disabled: true, onPause: vi.fn() } });
    expect(
      (screen.getByRole("button", { name: "Pause" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("toggles the calculator, describing what a press will do", async () => {
    const onToggle = vi.fn();
    const { user } = setup({
      calculator: { open: false, expanded: false, disabled: false, onToggle },
    });
    const button = screen.getByRole("button", { name: "Calculator" });
    expect(button.getAttribute("title")).toBe("Open Calculator · \\ toggles");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await user.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("says Close when the calculator is open", () => {
    setup({
      calculator: {
        open: true,
        expanded: true,
        disabled: false,
        onToggle: vi.fn(),
      },
    });
    const button = screen.getByRole("button", { name: "Calculator" });
    expect(button.getAttribute("title")).toBe("Close Calculator · \\ toggles");
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });
});
