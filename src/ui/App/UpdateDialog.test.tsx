// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssessmentProvider, translator } from "../i18n";
import { UpdateDialog } from "./UpdateDialog";

// jsdom has no modal <dialog>: opening one just marks it open.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
});
afterEach(cleanup);

describe("UpdateDialog", () => {
  it("is open as soon as it appears and says what updating does", () => {
    render(<UpdateDialog onUpdate={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(
      screen.getByRole("heading", {
        name: "A new version of the portal is ready.",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(/checks your PDFs against the current access codes/),
    ).toBeTruthy();
  });

  it("has only one way out: updating", async () => {
    const onUpdate = vi.fn();
    render(<UpdateDialog onUpdate={onUpdate} />);
    // No close button, and Escape is refused.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const cancel = new Event("cancel", { cancelable: true });
    screen.getByRole("dialog").dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Update now" }));
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Updating…" })).toBeTruthy();
  });

  it("comes back if the browser closes it anyway", () => {
    render(<UpdateDialog onUpdate={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    dialog.removeAttribute("open");
    fireEvent(dialog, new Event("close"));
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("speaks Spanish for the PAA", () => {
    const t = translator("PAA");
    render(
      <AssessmentProvider value="PAA">
        <UpdateDialog onUpdate={vi.fn()} />
      </AssessmentProvider>,
    );
    expect(screen.getByRole("button", { name: t("Update now") })).toBeTruthy();
  });
});
