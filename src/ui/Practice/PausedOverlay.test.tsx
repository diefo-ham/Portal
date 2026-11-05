// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PausedOverlay } from "./PausedOverlay";

afterEach(cleanup);

describe("PausedOverlay", () => {
  it("is a modal named by its heading", () => {
    render(
      <PausedOverlay pending={false} onResume={() => {}} onExit={() => {}} />,
    );
    const dialog = screen.getByRole("dialog", { name: "Your time is frozen." });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("PRACTICE TEST PAUSED")).toBeTruthy();
  });

  it("resumes or exits", async () => {
    const onResume = vi.fn();
    const onExit = vi.fn();
    const user = userEvent.setup();
    render(
      <PausedOverlay pending={false} onResume={onResume} onExit={onExit} />,
    );
    await user.click(screen.getByRole("button", { name: "Resume test" }));
    await user.click(screen.getByRole("button", { name: "Exit test" }));
    expect(onResume).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("disables both while saving", () => {
    render(<PausedOverlay pending onResume={() => {}} onExit={() => {}} />);
    for (const name of ["Resume test", "Exit test"])
      expect(
        (screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
      ).toBe(true);
  });
});
