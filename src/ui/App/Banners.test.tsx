// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Assessment } from "../../core/model";
import { AssessmentProvider, translator } from "../i18n";
import { Banners, type BannersProps } from "./Banners";

afterEach(cleanup);

const setup = (
  overrides: Partial<BannersProps> = {},
  assessment: Assessment = "SAT",
) => {
  const props: BannersProps = {
    error: "",
    onDismissError: vi.fn(),
    updateReady: false,
    onUpdate: vi.fn(),
    message: "",
    onDismissMessage: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  const view = render(
    <AssessmentProvider value={assessment}>
      <Banners {...props} />
    </AssessmentProvider>,
  );
  return { props, user, view };
};

describe("Banners", () => {
  it("shows nothing when there is nothing to say", () => {
    const { view } = setup();
    expect(view.container.innerHTML).toBe("");
  });

  it("shows an error as an alert and dismisses it", async () => {
    const { props, user } = setup({ error: "Storage is full." });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Storage is full.");
    expect(alert.className).toBe("banner error");
    await user.click(screen.getByRole("button", { name: "Dismiss error" }));
    expect(props.onDismissError).toHaveBeenCalledOnce();
  });

  it("offers a reload when a new version is ready", async () => {
    const { props, user } = setup({ updateReady: true });
    expect(screen.getByRole("status").textContent).toContain(
      "A new version of the portal is ready.",
    );
    await user.click(screen.getByRole("button", { name: "Reload to update" }));
    expect(props.onUpdate).toHaveBeenCalledOnce();
  });

  it("shows a message and dismisses it", async () => {
    const { props, user } = setup({ message: "Study progress reset." });
    expect(screen.getByRole("status").textContent).toContain(
      "Study progress reset.",
    );
    await user.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(props.onDismissMessage).toHaveBeenCalledOnce();
  });

  it("shows every notice at once, each with its own role", () => {
    setup({ error: "Oops", updateReady: true, message: "Done" });
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("dismisses only the notice whose button was pressed", async () => {
    const { props, user } = setup({ error: "Oops", message: "Done" });
    await user.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(props.onDismissMessage).toHaveBeenCalledOnce();
    expect(props.onDismissError).not.toHaveBeenCalled();
  });

  it("speaks Spanish for the PAA", () => {
    setup({ error: "Oops", updateReady: true, message: "Hecho" }, "PAA");
    const t = translator("PAA");
    expect(
      screen.getByRole("button", { name: t("Dismiss error") }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t("Reload to update") }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t("Dismiss message") }),
    ).toBeTruthy();
  });
});
