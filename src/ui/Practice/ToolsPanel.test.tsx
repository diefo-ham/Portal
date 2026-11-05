// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolsPanel, type ToolsPanelProps } from "./ToolsPanel";

afterEach(cleanup);

const setup = (overrides: Partial<ToolsPanelProps> = {}) => {
  const props: ToolsPanelProps = {
    isTest: false,
    showTime: false,
    paused: false,
    pending: false,
    onOverview: vi.fn(),
    onDetails: vi.fn(),
    onShowTime: vi.fn(),
    onTogglePause: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  };
  render(<ToolsPanel {...props} />);
  return { props, user: userEvent.setup() };
};

describe("ToolsPanel", () => {
  it("has the shortcuts folded away", () => {
    setup();
    expect(screen.getByText("Keyboard shortcuts & help")).toBeTruthy();
  });

  it("opens the overview and the details", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Question overview" }));
    await user.click(screen.getByRole("button", { name: "Question details" }));
    expect(props.onOverview).toHaveBeenCalledOnce();
    expect(props.onDetails).toHaveBeenCalledOnce();
  });

  it("shows and hides the timer", async () => {
    const { props, user } = setup({ showTime: false });
    const box = screen.getByRole("checkbox", {
      name: "Show timer",
    }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    await user.click(box);
    expect(props.onShowTime).toHaveBeenCalledWith(true);
  });

  it("pauses and resumes the timer", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Pause timer" }));
    expect(props.onTogglePause).toHaveBeenCalledOnce();
    cleanup();
    setup({ paused: true });
    expect(screen.getByRole("button", { name: "Resume timer" })).toBeTruthy();
  });

  it("finishes the session, except while saving", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Finish session" }));
    expect(props.onFinish).toHaveBeenCalledOnce();
    cleanup();
    setup({ pending: true });
    expect(
      (
        screen.getByRole("button", {
          name: "Finish session",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("drops the timer and finish controls in a test", () => {
    setup({ isTest: true });
    expect(screen.queryByRole("checkbox", { name: "Show timer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pause timer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Finish session" })).toBeNull();
  });

  it("offers cancelling only in a test that allows it", async () => {
    setup({ isTest: true });
    expect(
      screen.queryByRole("button", { name: "Cancel Practice Test" }),
    ).toBeNull();
    cleanup();
    const onCancelTest = vi.fn();
    const { user } = setup({ isTest: true, onCancelTest });
    await user.click(
      screen.getByRole("button", { name: "Cancel Practice Test" }),
    );
    expect(onCancelTest).toHaveBeenCalledOnce();
    cleanup();
    setup({ isTest: false, onCancelTest });
    expect(
      screen.queryByRole("button", { name: "Cancel Practice Test" }),
    ).toBeNull();
  });
});
