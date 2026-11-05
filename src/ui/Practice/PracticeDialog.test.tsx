// @vitest-environment jsdom
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PracticeDialog, type PracticeDialogProps } from "./PracticeDialog";

afterEach(cleanup);

const setup = (overrides: Partial<PracticeDialogProps> = {}) => {
  const props: PracticeDialogProps = {
    dialogRef: createRef<HTMLDialogElement>(),
    title: "Practice tools",
    showBack: false,
    onBack: vi.fn(),
    onDismiss: vi.fn(),
    onCancel: vi.fn(),
    onClosed: vi.fn(),
    children: <p>Panel body</p>,
    ...overrides,
  };
  const user = userEvent.setup();
  render(<PracticeDialog {...props} />);
  const dialog = document.querySelector("dialog")!;
  dialog.setAttribute("open", "");
  return { props, user, dialog };
};

describe("PracticeDialog", () => {
  it("shows its title and the panel", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "Practice tools" }),
    ).toBeTruthy();
    expect(screen.getByText("Panel body")).toBeTruthy();
  });

  it("hands its element to the caller", () => {
    const dialogRef = createRef<HTMLDialogElement>();
    setup({ dialogRef });
    expect(dialogRef.current?.className).toBe("practice-dialog");
  });

  it("closes from ×", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Close panel" }));
    expect(props.onDismiss).toHaveBeenCalledOnce();
  });

  it("closes from a click on the backdrop, not inside", async () => {
    const { props, user, dialog } = setup();
    await user.click(screen.getByText("Panel body"));
    expect(props.onDismiss).not.toHaveBeenCalled();
    fireEvent.click(dialog);
    expect(props.onDismiss).toHaveBeenCalledOnce();
  });

  it("offers Back only when asked", async () => {
    setup();
    expect(
      screen.queryByRole("button", { name: "Back to Practice tools" }),
    ).toBeNull();
    cleanup();
    const { props, user } = setup({ showBack: true });
    await user.click(
      screen.getByRole("button", { name: "Back to Practice tools" }),
    );
    expect(props.onBack).toHaveBeenCalledOnce();
  });

  it("passes on Escape and the close event", () => {
    const { props, dialog } = setup();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(props.onCancel).toHaveBeenCalledOnce();
    fireEvent(dialog, new Event("close"));
    expect(props.onClosed).toHaveBeenCalledOnce();
  });

  it("swallows a held Escape so it cannot close two dialogs", () => {
    const { dialog } = setup();
    const held = fireEvent.keyDown(dialog, { key: "Escape", repeat: true });
    const pressed = fireEvent.keyDown(dialog, { key: "Escape" });
    expect(held).toBe(false);
    expect(pressed).toBe(true);
  });
});
