// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ConfirmTestDialog,
  type ConfirmTestDialogProps,
} from "./ConfirmTestDialog";

afterEach(cleanup);

const setup = (
  overrides: Partial<Omit<ConfirmTestDialogProps, "children">> = {},
) => {
  const props = {
    eyebrow: "DELETE PRACTICE TEST",
    heading: "Delete this completed test?",
    cancelLabel: "Keep test",
    confirmLabel: "Delete test",
    busy: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(
    <ConfirmTestDialog {...props}>
      <p>This cannot be undone.</p>
      <p>Bookmarks are kept.</p>
    </ConfirmTestDialog>,
  );
  return { props, user };
};

describe("ConfirmTestDialog", () => {
  it("is a modal dialog named by its heading, with its eyebrow", () => {
    setup();
    const dialog = screen.getByRole("dialog", {
      name: "Delete this completed test?",
    });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("DELETE PRACTICE TEST")).toBeTruthy();
  });

  it("shows whatever explanation it is given", () => {
    setup();
    expect(screen.getByText("This cannot be undone.")).toBeTruthy();
    expect(screen.getByText("Bookmarks are kept.")).toBeTruthy();
  });

  it("confirms with a danger-styled button", async () => {
    const { props, user } = setup();
    const confirm = screen.getByRole("button", { name: "Delete test" });
    expect(confirm.className).toBe("danger");
    await user.click(confirm);
    expect(props.onConfirm).toHaveBeenCalledOnce();
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it("cancels without confirming", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Keep test" }));
    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("disables only the confirm button while busy", async () => {
    const { props, user } = setup({ busy: true });
    const confirm = screen.getByRole("button", {
      name: "Delete test",
    }) as HTMLButtonElement;
    const cancel = screen.getByRole("button", {
      name: "Keep test",
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(cancel.disabled).toBe(false);
    await user.click(confirm);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
