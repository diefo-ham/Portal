// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CancelTestPanel } from "./CancelTestPanel";

afterEach(cleanup);

describe("CancelTestPanel", () => {
  it("explains what is lost and keeps or cancels", async () => {
    const onKeep = vi.fn();
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <CancelTestPanel pending={false} onKeep={onKeep} onConfirm={onConfirm} />,
    );
    expect(
      screen.getByText(/removed without results or an SAT estimate/),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Keep test" }));
    await user.click(
      screen.getByRole("button", { name: "Cancel Practice Test" }),
    );
    expect(onKeep).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cannot cancel twice while saving", () => {
    render(<CancelTestPanel pending onKeep={() => {}} onConfirm={() => {}} />);
    const confirm = screen.getByRole("button", {
      name: "Cancel Practice Test",
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(confirm.className).toBe("danger");
  });
});
