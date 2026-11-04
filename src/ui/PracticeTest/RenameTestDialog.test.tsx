// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SESSION_NAME_MAX_LENGTH } from "../../core/sessions";
import {
  RenameTestDialog,
  type RenameTestDialogProps,
} from "./RenameTestDialog";

afterEach(cleanup);

const setup = (overrides: Partial<RenameTestDialogProps> = {}) => {
  const props: RenameTestDialogProps = {
    initialName: "My test",
    eyebrow: "PRACTICE TEST",
    heading: "Rename Practice Test",
    fieldLabel: "Test name",
    cancelLabel: "Cancel",
    saveLabel: "Save name",
    busy: false,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<RenameTestDialog {...props} />);
  return { props, user };
};

describe("RenameTestDialog", () => {
  it("is a modal dialog named by its heading", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Rename Practice Test" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("PRACTICE TEST")).toBeTruthy();
  });

  it("starts with the current name selected, so typing replaces it", () => {
    setup();
    const input = screen.getByLabelText("Test name") as HTMLInputElement;
    expect(input.value).toBe("My test");
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("My test".length);
  });

  it("limits the name to the session name length", () => {
    setup();
    const input = screen.getByLabelText("Test name") as HTMLInputElement;
    expect(input.maxLength).toBe(SESSION_NAME_MAX_LENGTH);
  });

  it("saves the typed name from the button", async () => {
    const { props, user } = setup();
    await user.tab(); // focus keeps the selection, so typing replaces the name
    await user.keyboard("Mock exam");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(props.onSave).toHaveBeenCalledWith("Mock exam");
  });

  it("saves with Enter", async () => {
    const { props, user } = setup();
    await user.tab();
    await user.keyboard("Renamed{Enter}");
    expect(props.onSave).toHaveBeenCalledWith("Renamed");
  });

  it("saves the original name if nothing is typed", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(props.onSave).toHaveBeenCalledWith("My test");
  });

  it("cancels without saving", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("disables saving while busy", () => {
    setup({ busy: true });
    const save = screen.getByRole("button", {
      name: "Save name",
    }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it("uses the labels it is given", () => {
    setup({
      heading: "Renombrar la prueba",
      fieldLabel: "Nombre de la prueba",
      cancelLabel: "Cancelar",
      saveLabel: "Guardar nombre",
    });
    expect(
      screen.getByRole("dialog", { name: "Renombrar la prueba" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Nombre de la prueba")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar nombre" })).toBeTruthy();
  });

  it("gives two open dialogs different heading ids", () => {
    render(
      <>
        <RenameTestDialog
          initialName="a"
          eyebrow="E"
          heading="First"
          fieldLabel="Name one"
          cancelLabel="No"
          saveLabel="Yes"
          busy={false}
          onSave={() => {}}
          onCancel={() => {}}
        />
        <RenameTestDialog
          initialName="b"
          eyebrow="E"
          heading="Second"
          fieldLabel="Name two"
          cancelLabel="No"
          saveLabel="Yes"
          busy={false}
          onSave={() => {}}
          onCancel={() => {}}
        />
      </>,
    );
    expect(screen.getByRole("dialog", { name: "First" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Second" })).toBeTruthy();
  });
});
