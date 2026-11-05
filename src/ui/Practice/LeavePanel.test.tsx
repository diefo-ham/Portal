// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeavePanel } from "./LeavePanel";

afterEach(cleanup);

const setup = (isTest = false, pending = false) => {
  const onStay = vi.fn();
  const onLeave = vi.fn();
  render(
    <LeavePanel
      isTest={isTest}
      pending={pending}
      onStay={onStay}
      onLeave={onLeave}
    />,
  );
  return { onStay, onLeave, user: userEvent.setup() };
};

describe("LeavePanel", () => {
  it("reassures that practice resumes later", () => {
    setup();
    expect(
      screen.getByText(/You can resume this session from Practice/),
    ).toBeTruthy();
  });

  it("explains that leaving a test pauses the module", () => {
    setup(true);
    expect(screen.getByText(/Leaving pauses the module/)).toBeTruthy();
  });

  it("stays or leaves", async () => {
    const { onStay, onLeave, user } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Leave session" }));
    expect(onStay).toHaveBeenCalledOnce();
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it("cannot leave twice while saving", () => {
    setup(false, true);
    expect(
      (
        screen.getByRole("button", {
          name: "Leave session",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
