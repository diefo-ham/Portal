// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ActiveQuestionsDialog,
  type ActiveQuestionsDialogProps,
} from "./ActiveQuestionsDialog";

afterEach(cleanup);

const setup = (overrides: Partial<ActiveQuestionsDialogProps> = {}) => {
  const props: ActiveQuestionsDialogProps = {
    busy: false,
    onCancel: vi.fn(),
    onBegin: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<ActiveQuestionsDialog {...props} />);
  return { props, user };
};

describe("ActiveQuestionsDialog", () => {
  it("is a modal dialog that warns about spoilers", () => {
    setup();
    const dialog = screen.getByRole("dialog", {
      name: "Practice these questions again?",
    });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("may spoil a future official test");
    expect(screen.getByText("ACTIVE PRACTICE-TEST QUESTIONS")).toBeTruthy();
  });

  it("begins when the person insists", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Begin anyway" }));
    expect(props.onBegin).toHaveBeenCalledOnce();
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it("can be cancelled", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(props.onBegin).not.toHaveBeenCalled();
  });

  it("does not begin twice while busy", async () => {
    const { props, user } = setup({ busy: true });
    const begin = screen.getByRole("button", {
      name: "Begin anyway",
    }) as HTMLButtonElement;
    expect(begin.disabled).toBe(true);
    await user.click(begin);
    expect(props.onBegin).not.toHaveBeenCalled();
  });
});
